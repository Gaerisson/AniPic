import yauzl from "yauzl";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "../server/config.mjs";
import { openDb, id, now, audit } from "../server/db.mjs";
import { ingest } from "../server/storage.mjs";
const args = process.argv.slice(2);
const get = (flag) => args[args.indexOf(flag) + 1];
const archive = args.includes("--zip") ? get("--zip") : null;
const directory = args.includes("--dir") ? get("--dir") : null;
const commit = args.includes("--commit");
const forceArchive = args.includes("--archive");
if (!archive && !directory)
  throw new Error(
    "Usage : npm run import:legacy -- --zip GPIC.zip [--mapping mapping.json] [--commit] ou --dir /photos. Sans --commit : simulation.",
  );
const mapping = args.includes("--mapping")
  ? JSON.parse(await fs.readFile(get("--mapping"), "utf8"))
  : {};
const c = config();
const db = openDb(c);
let photos = 0,
  skipped = 0;
const groups = new Map();
async function accept(filename, open, fileSize = 0, fileDate = null) {
  const normalized = filename.replace(/\\/g, "/");
  const parts = normalized.split("/");
  if (
    parts.some((p) => p === "..") ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:/.test(normalized)
  ) {
    skipped++;
    return;
  }
  if (
    !/\.(jpe?g|png|webp|avif)$/i.test(normalized) ||
    /(_thumb|thumbnail|\/assets\/|\/res\/|\/vendor\/|\/Remotion\/|\/node_modules\/)/i.test(
      normalized,
    )
  ) {
    skipped++;
    return;
  }
  const match = normalized.match(
    /(?:^|\/)(photos|Chiens|Chats|NAC|dog|cat|nac)\//i,
  );
  if (!match && !directory) {
    skipped++;
    return;
  }
  if (fileSize > c.maxUploadBytes)
    throw new Error(
      `Photo trop volumineuse : ${filename}. Limite : ${Math.round(c.maxUploadBytes / 1024 ** 2)} Mo.`,
    );
  const folder = parts.slice(0, -1).join("/");
  const name = parts.at(-2) || "À identifier";
  const species = /chat|\bcat\b/i.test(folder)
    ? "cat"
    : /nac/i.test(folder)
      ? "other"
      : "dog";
  const sourceId = mapping[folder] || `legacy:${folder}`;
  if (sourceId.length > 200)
    throw new Error(
      "Chemin trop long. Fournissez un mapping vers un ID stable.",
    );
  if (!groups.has(sourceId)) {
    const existing = db
      .prepare("SELECT id FROM animals WHERE source_id=?")
      .get(sourceId);
    const animalId = existing?.id || id();
    groups.set(sourceId, animalId);
    if (commit && !existing)
      db.prepare(
        "INSERT INTO animals(id,name,species,source_id,archived_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
      ).run(
        animalId,
        name,
        species,
        sourceId,
        forceArchive || /archive/i.test(folder) ? now() : null,
        now(),
        now(),
      );
  }
  if (commit) {
    const stream = await open();
    const result = await ingest(
      db,
      c,
      groups.get(sourceId),
      stream,
      path.basename(filename),
      true,
    );
    if (
      !result.duplicate &&
      fileDate &&
      Number.isFinite(new Date(fileDate).getTime())
    )
      db.prepare("UPDATE photos SET created_at=? WHERE id=?").run(
        new Date(
          Math.min(Date.now(), new Date(fileDate).getTime()),
        ).toISOString(),
        result.id,
      );
    if (
      forceArchive &&
      !result.duplicate &&
      !db
        .prepare("SELECT archived_at FROM animals WHERE id=?")
        .get(groups.get(sourceId)).archived_at
    )
      db.prepare("UPDATE photos SET archived_at=? WHERE id=?").run(
        now(),
        result.id,
      );
  }
  photos++;
}
try {
  if (archive)
    await new Promise((resolve, reject) =>
      yauzl.open(
        path.resolve(archive),
        { lazyEntries: true, validateEntrySizes: true },
        (err, zip) => {
          if (err) return reject(err);
          let entries = 0,
            expanded = 0;
          zip.on("error", reject);
          zip.on("end", resolve);
          zip.on("entry", (entry) => {
            entries++;
            expanded += entry.uncompressedSize;
            if (entries > 150000 || expanded > 100 * 1024 ** 3) {
              zip.close();
              reject(new Error("ZIP hors budget."));
              return;
            }
            accept(
              entry.fileName,
              () =>
                new Promise((res, rej) =>
                  zip.openReadStream(entry, (e, s) => (e ? rej(e) : res(s))),
                ),
              entry.uncompressedSize,
              entry.getLastModDate(),
            ).then(
              () => zip.readEntry(),
              (e) => {
                zip.close();
                reject(e);
              },
            );
          });
          zip.readEntry();
        },
      ),
    );
  if (directory) {
    const base = await fs.realpath(path.resolve(directory));
    async function visit(dir) {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isSymbolicLink()) {
          skipped++;
          continue;
        }
        if (entry.isDirectory()) await visit(full);
        else if (entry.isFile()) {
          const stat = await fs.stat(full);
          await accept(
            path.relative(base, full),
            async () => createReadStream(full),
            stat.size,
            stat.mtime,
          );
        }
      }
    }
    await visit(base);
  }
  if (commit)
    audit(db, null, "legacy_imported", { photos, animals: groups.size });
  console.log(
    JSON.stringify(
      {
        mode: commit ? "import" : "simulation",
        animals: groups.size,
        photos,
        skipped,
        visibility: "privée; vérifier puis publier depuis l’administration",
        identity: "mapping explicite ou chemin complet, jamais le prénom seul",
      },
      null,
      2,
    ),
  );
} finally {
  db.close();
}
