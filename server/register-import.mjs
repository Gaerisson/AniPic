import yauzl from "yauzl";
import * as cheerio from "cheerio";
import path from "node:path";
const fail = (message) =>
  Object.assign(new Error(message), { statusCode: 400 });
const key = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
function csvRows(text) {
  const first = text.split(/\r?\n/, 1)[0],
    delimiter = first.includes(";") ? ";" : ",";
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === delimiter || c === "\n")) {
      row.push(cell.replace(/\r$/, ""));
      cell = "";
      if (c === "\n") {
        rows.push(row);
        row = [];
      }
    } else cell += c;
    if (cell.length > 5000 || row.length > 40 || rows.length > 1001)
      throw fail("Import limité à 1 000 lignes et 40 colonnes.");
  }
  if (quoted) throw fail("CSV invalide : guillemets non fermés.");
  if (cell || row.length) rows.push([...row, cell]);
  return rows;
}
async function excelRows(buffer) {
  const files = await new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      buffer,
      { lazyEntries: true, validateEntrySizes: true },
      (err, zip) => {
        if (err)
          return reject(
            fail("Classeur Excel illisible. Utilisez un fichier .xlsx ou CSV."),
          );
        const files = new Map();
        let bytes = 0,
          count = 0,
          finished = false;
        const stop = (error) => {
          if (finished) return;
          finished = true;
          zip.close();
          reject(error);
        };
        zip.on("error", () => stop(fail("Archive Excel invalide.")));
        zip.on("end", () => {
          if (!finished) {
            finished = true;
            resolve(files);
          }
        });
        zip.on("entry", (entry) => {
          if (
            ++count > 600 ||
            (bytes += entry.uncompressedSize) > 16 * 1024 ** 2 ||
            entry.generalPurposeBitFlag & 1
          )
            return stop(fail("Classeur trop volumineux ou chiffré."));
          if (
            !/^(xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml))$/.test(
              entry.fileName,
            )
          )
            return zip.readEntry();
          zip.openReadStream(entry, (error, stream) => {
            if (error) return stop(fail("Lecture Excel impossible."));
            const chunks = [];
            let size = 0;
            stream.on("error", () => stop(fail("Flux Excel invalide.")));
            stream.on("data", (b) => {
              size += b.length;
              if (size > 12 * 1024 ** 2) {
                stream.destroy();
                stop(fail("Feuille Excel trop volumineuse."));
              } else chunks.push(b);
            });
            stream.on("end", () => {
              if (finished) return;
              const xml = Buffer.concat(chunks).toString("utf8");
              if (/<!DOCTYPE|<!ENTITY/i.test(xml))
                return stop(fail("Déclarations XML non acceptées."));
              files.set(entry.fileName, xml);
              zip.readEntry();
            });
          });
        });
        zip.readEntry();
      },
    );
  });
  const xml = (text) => cheerio.load(text || "", { xmlMode: true });
  const workbook = xml(files.get("xl/workbook.xml"));
  const first = workbook("sheet").first(),
    rel = first.attr("r:id");
  const rels = xml(files.get("xl/_rels/workbook.xml.rels"));
  const target = rels("Relationship")
    .toArray()
    .find((e) => rels(e).attr("Id") === rel);
  if (target && rels(target).attr("TargetMode") === "External")
    throw fail("Feuille externe non acceptée.");
  const rawTarget = target
    ? rels(target).attr("Target")
    : "worksheets/sheet1.xml";
  const sheetPath = rawTarget?.startsWith("/")
    ? rawTarget.slice(1)
    : path.posix.normalize("xl/" + rawTarget);
  if (!/^xl\/worksheets\/[^/]+\.xml$/.test(sheetPath) || !files.has(sheetPath))
    throw fail("Première feuille du classeur introuvable.");
  const shared = xml(files.get("xl/sharedStrings.xml"));
  const strings = shared("si")
    .toArray()
    .map((si) =>
      shared(si)
        .find("t")
        .toArray()
        .map((t) => shared(t).text())
        .join(""),
    );
  const sheet = xml(files.get(sheetPath)),
    rows = [];
  let formulas = 0;
  for (const element of sheet("sheetData > row").toArray()) {
    if (rows.length >= 1001) throw fail("Import limité à 1 000 lignes.");
    const row = [];
    for (const c of sheet(element).find("c").toArray()) {
      const cell = sheet(c),
        ref = cell.attr("r") || "",
        letters = ref.match(/^[A-Z]+/)?.[0];
      if (!letters) continue;
      const col =
        [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
      if (col >= 40) continue;
      if (cell.find("f").length) {
        formulas++;
        continue;
      }
      const type = cell.attr("t"),
        value = cell.find("v").text();
      row[col] = (
        type === "s"
          ? strings[Number(value)] || ""
          : type === "inlineStr"
            ? cell
                .find("is t")
                .toArray()
                .map((t) => sheet(t).text())
                .join("")
            : value
      ).slice(0, 5000);
    }
    if (row.some((v) => String(v || "").trim())) rows.push(row);
  }
  return { rows, formulas };
}
export async function parseRegisterImport(buffer, filename) {
  if (!buffer.length || buffer.length > 8 * 1024 ** 2)
    throw fail("Fichier limité à 8 Mo.");
  let table,
    formulas = 0;
  if (/\.xlsx$/i.test(filename))
    ({ rows: table, formulas } = await excelRows(buffer));
  else if (/\.csv$/i.test(filename))
    table = csvRows(buffer.toString("utf8").replace(/^\uFEFF/, ""));
  else
    throw fail(
      "Formats acceptés : Excel .xlsx et CSV UTF-8. Convertissez les anciens .xls en .xlsx.",
    );
  if (table.length < 2)
    throw fail("Le fichier doit contenir un en-tête et au moins une ligne.");
  const headers = table[0].map(key);
  const find = (...names) => headers.findIndex((h) => names.includes(h));
  const columns = {
    name: find("nom", "name", "nomcomplet", "identite"),
    first: find("prenom", "firstname"),
    contact: find("contact", "telephone", "tel", "email", "mail"),
    reason: find("motif", "reason", "notes", "note", "observations", "raison"),
    instructions: find(
      "consigne",
      "consignes",
      "instructions",
      "conduiteatenir",
    ),
    review_date: find("revision", "daterevision", "revoirle", "reviewdate"),
  };
  if (columns.name < 0)
    throw fail(
      "Ajoutez une colonne « Nom » (et éventuellement « Prénom », « Contact », « Motif », « Consignes », « Révision »).",
    );
  const rows = [],
    warnings = [];
  const date = (raw) => {
    if (!raw) return "";
    if (/^\d{5}$/.test(raw))
      return new Date(Date.UTC(1899, 11, 30) + Number(raw) * 86400000)
        .toISOString()
        .slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
  };
  for (const [index, row] of table.slice(1).entries()) {
    if (!row.some((v) => String(v || "").trim())) continue;
    const get = (k, max) =>
      String(row[columns[k]] ?? "")
        .trim()
        .slice(0, max);
    const name = [get("first", 80), get("name", 120)]
      .filter(Boolean)
      .join(" ")
      .slice(0, 160);
    if (!name) {
      warnings.push(`Ligne ${index + 2} ignorée : nom absent.`);
      continue;
    }
    const review_date = date(get("review_date", 30));
    if (get("review_date", 30) && !review_date)
      warnings.push(`Ligne ${index + 2} : date de révision ignorée.`);
    rows.push({
      name,
      contact: get("contact", 200),
      reason: get("reason", 2000),
      instructions: get("instructions", 1000),
      review_date,
    });
  }
  if (formulas)
    warnings.push(`${formulas} cellule(s) avec formule ignorée(s).`);
  return { rows, warnings, sheet: "Première feuille", total: rows.length };
}
