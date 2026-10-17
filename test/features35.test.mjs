import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import yazl from "yazl";
import { PDFDocument } from "pdf-lib";
import { fixture, login, animal } from "./helpers.mjs";
import { ingest } from "../server/storage.mjs";
import { compatibilityState } from "../shared/compatibility-text.mjs";
import { hasAnimalInfo } from "../shared/animal-info.mjs";
import { browserTheme, rememberTheme } from "../src/theme-store.mjs";
import { parseRegisterImport } from "../server/register-import.mjs";
const png = () =>
  sharp({
    create: { width: 500, height: 600, channels: 3, background: "#bd7649" },
  })
    .png()
    .toBuffer();
const xlsx = async (files) => {
  const zip = new yazl.ZipFile();
  for (const [name, text] of Object.entries(files))
    zip.addBuffer(Buffer.from(text), name);
  const chunks = [];
  const done = new Promise((resolve, reject) => {
    zip.outputStream.on("data", (b) => chunks.push(b));
    zip.outputStream.on("end", () => resolve(Buffer.concat(chunks)));
    zip.outputStream.on("error", reject);
  });
  zip.end();
  return done;
};
test("qualified ententes are amber, missing values are omitted, theme choice survives reload and invalid storage", () => {
  for (const s of [
    "Oui si habitué aux chats",
    "Non, pour la rencontre prévoir un accompagnement",
    "Oui. Mais pas de jeunes enfants",
    "OK sous surveillance",
  ])
    assert.equal(compatibilityState(s), "conditional");
  assert.equal(compatibilityState("Non testé"), "unknown");
  assert.equal(compatibilityState("Non."), "no");
  assert.equal(compatibilityState("Oui !"), "yes");
  for (const value of ["N/A", "n.a", "Non renseigné", null, "—"])
    assert.equal(hasAnimalInfo(value), false);
  assert.equal(hasAnimalInfo("3 ans"), true);
  const m = new Map(),
    storage = { getItem: (k) => m.get(k), setItem: (k, v) => m.set(k, v) };
  assert.equal(browserTheme(storage), null);
  assert.equal(rememberTheme("spa", storage), true);
  assert.equal(browserTheme(storage), "spa");
  assert.equal(rememberTheme("bad", storage), false);
  assert.equal(browserTheme(storage), "spa");
  assert.equal(
    browserTheme({
      getItem() {
        throw Error("blocked");
      },
    }),
    null,
  );
});
test("themed names preserve sex, first-letter and existing animal exclusion", async (t) => {
  const { app, db } = await fixture(t, {
    nameCatalogueSnapshot: {
      complete: true,
      checkedAt: new Date().toISOString(),
      names: [],
    },
  });
  animal(db, "Orion");
  let r = await app.inject("/api/tools/names?theme=cosmos&sex=male&letter=O");
  assert.equal(r.statusCode, 200, r.body);
  assert.ok(!r.json().names.includes("Orion"));
  r = await app.inject("/api/tools/names?theme=noel&sex=female&letter=N");
  assert.ok(r.json().names.includes("Neige"));
  assert.ok(!r.json().names.includes("Olaf"));
  r = await app.inject("/api/tools/names?theme=unknown");
  assert.equal(r.statusCode, 400);
});
test("SOS and compatibility filters match visible facts with pagination and combined filters", async (t) => {
  const { app, db } = await fixture(t);
  const a = animal(db, "Réglisse"),
    b = animal(db, "Alba"),
    c = animal(db, "Pixel");
  db.prepare("UPDATE animals SET tags=?,compatibility=? WHERE id=?").run(
    '["SOS"]',
    '{"chat":"Oui","chien":"Non, pour la rencontre il faut un éducateur"}',
    a,
  );
  db.prepare("UPDATE animals SET compatibility=? WHERE id=?").run(
    '{"cats":"Oui si habitué"}',
    b,
  );
  db.prepare("UPDATE animals SET description=? WHERE id=?").run(
    "Entente chat : Oui · Entente enfant : Non",
    c,
  );
  let r = await app.inject("/api/animals?sos=yes&cats=yes&limit=1");
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().total, 1);
  assert.equal(r.json().items[0].id, a);
  r = await app.inject("/api/animals?cats=conditional");
  assert.deepEqual(
    r.json().items.map((a) => a.id),
    [b],
  );
  r = await app.inject("/api/animals?cats=yes");
  assert.equal(r.json().total, 2);
  r = await app.inject("/api/animals?dogs=conditional&sos=yes");
  assert.equal(r.json().items[0].id, a);
  r = await app.inject("/api/animals?cats=no");
  assert.equal(r.json().total, 0);
});
test("removing a planning request removes it everywhere and undo restores it with conflict checks", async (t) => {
  const { app, db } = await fixture(t),
    { headers } = await login(app),
    a = animal(db);
  let r = await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers,
    payload: { animalId: a, title: "Portrait" },
  });
  const id = r.json().id;
  let task = db.prepare("SELECT * FROM shoot_tasks WHERE id=?").get(id);
  r = await app.inject({
    method: "PATCH",
    url: "/api/tasks/" + id,
    headers: { ...headers, "x-anipic-version": task.updated_at },
    payload: { deleted: true },
  });
  assert.equal(r.statusCode, 200, r.body);
  const revision = r.json().updatedAt;
  assert.equal(
    (await app.inject({ url: "/api/tasks", headers })).json().length,
    0,
  );
  assert.equal(
    (await app.inject({ url: "/api/overview", headers })).json().stats
      .openTasks,
    0,
  );
  assert.equal(
    (
      await app.inject({ url: "/api/shoot-sheet?mode=priorities", headers })
    ).json().items.length,
    0,
  );
  r = await app.inject({
    method: "PATCH",
    url: "/api/tasks/" + id,
    headers: { ...headers, "x-anipic-version": task.updated_at },
    payload: { deleted: false },
  });
  assert.equal(r.statusCode, 409);
  r = await app.inject({
    method: "PATCH",
    url: "/api/tasks/" + id,
    headers: { ...headers, "x-anipic-version": revision },
    payload: { deleted: false },
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(
    (await app.inject({ url: "/api/tasks", headers })).json().length,
    1,
  );
});
test("private animal photos stay private in listing, direct files, public albums and group posters", async (t) => {
  const { app, db, c } = await fixture(t),
    { headers } = await login(app),
    a = animal(db),
    buffer = await png();
  const photo = await ingest(db, c, a, Readable.from(buffer), "private.png");
  let r = await app.inject({
    method: "PATCH",
    url: "/api/photos/" + photo.id,
    headers,
    payload: { hidden: true },
  });
  assert.equal(r.statusCode, 200, r.body);
  r = await app.inject("/api/animals/" + a);
  assert.equal(r.json().photos.length, 0);
  assert.equal(r.json().cover_id, null);
  assert.equal((await app.inject("/media/" + photo.id)).statusCode, 404);
  r = await app.inject({ url: "/api/animals/" + a, headers });
  assert.equal(r.json().public_cover_id, null);
  assert.equal(r.json().private_photo_count, 1);
  assert.equal(r.json().photos.length, 1);
  r = await app.inject({
    method: "POST",
    url: "/api/collections",
    headers,
    payload: { name: "Public", photoIds: [photo.id] },
  });
  assert.equal(r.statusCode, 201, r.body);
  const albumId = r.json().id;
  r = await app.inject({
    method: "PATCH",
    url: "/api/collections/" + albumId,
    headers,
    payload: { isPublic: true },
  });
  assert.equal(r.statusCode, 200, r.body);
  const album = (await app.inject("/api/collections/" + albumId)).json();
  assert.equal(album.photos.length, 0);
  r = await app.inject({
    method: "POST",
    url: "/api/group-posters",
    headers,
    payload: { animals: [{ id: a }] },
  });
  assert.equal(r.statusCode, 422, r.body);
  r = await app.inject({
    method: "PATCH",
    url: "/api/photos/" + photo.id,
    headers,
    payload: { hidden: false },
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal((await app.inject("/media/" + photo.id)).statusCode, 200);
});
test("internal register permissions, CSRF, optimistic updates, recoverable removal and duplicate-safe import", async (t) => {
  const { app, db } = await fixture(t),
    admin = await login(app),
    agent = await login(app, "agent"),
    viewer = await login(app, "viewer"),
    editor = await login(app, "editor");
  assert.equal((await app.inject("/api/internal-register")).statusCode, 401);
  for (const account of [viewer, editor])
    assert.equal(
      (
        await app.inject({
          url: "/api/internal-register",
          headers: account.headers,
        })
      ).statusCode,
      403,
    );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/internal-register",
        headers: { cookie: agent.headers.cookie },
        payload: { name: "Exemple fictif" },
      })
    ).statusCode,
    403,
  );
  let r = await app.inject({
    method: "POST",
    url: "/api/internal-register",
    headers: agent.headers,
    payload: { name: "Exemple fictif", reason: "Exemple de test privé" },
  });
  assert.equal(r.statusCode, 201, r.body);
  const record = r.json().id;
  r = await app.inject({
    url: "/api/internal-register",
    headers: admin.headers,
  });
  assert.equal(r.headers["cache-control"], "private, no-store");
  const version = r.json().items[0].updated_at;
  const csv = Buffer.from(
    '--reg35\r\nContent-Disposition: form-data; name="file"; filename="registre.csv"\r\nContent-Type: text/csv\r\n\r\nNom;Motif\nExemple de fichier;Ligne de test\r\n--reg35--\r\n',
  );
  const preview = await app.inject({
    method: "POST",
    url: "/api/internal-register/import-preview",
    headers: {
      ...agent.headers,
      "content-type": "multipart/form-data; boundary=reg35",
    },
    payload: csv,
  });
  assert.equal(preview.statusCode, 200, preview.body);
  assert.equal(preview.json().rows.length, 1);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM internal_register").get().n,
    1,
  );
  r = await app.inject({
    method: "PATCH",
    url: "/api/internal-register/" + record,
    headers: { ...admin.headers, "x-anipic-version": version },
    payload: { deleted: true },
  });
  assert.equal(r.statusCode, 200);
  const next = r.json().updatedAt;
  assert.equal(
    (
      await app.inject({
        url: "/api/internal-register",
        headers: agent.headers,
      })
    ).json().total,
    0,
  );
  r = await app.inject({
    method: "PATCH",
    url: "/api/internal-register/" + record,
    headers: { ...admin.headers, "x-anipic-version": version },
    payload: { deleted: false },
  });
  assert.equal(r.statusCode, 409);
  r = await app.inject({
    method: "PATCH",
    url: "/api/internal-register/" + record,
    headers: { ...admin.headers, "x-anipic-version": next },
    payload: { deleted: false },
  });
  assert.equal(r.statusCode, 200);
  r = await app.inject({
    method: "POST",
    url: "/api/internal-register/import",
    headers: agent.headers,
    payload: {
      rows: [
        { name: "Exemple fictif" },
        { name: "Autre exemple" },
        { name: "Autre exemple" },
      ],
    },
  });
  assert.deepEqual(r.json(), { imported: 1, skipped: 2 });
  const audit = JSON.stringify(
    db.prepare("SELECT detail FROM audit WHERE action LIKE 'register_%'").all(),
  );
  assert.ok(!audit.includes("Exemple de test privé"));
  assert.ok(!audit.includes("Exemple fictif"));
  db.prepare(
    "UPDATE sessions SET expires_at='2000-01-01T00:00:00.000Z' WHERE user_id=?",
  ).run(agent.user.id);
  assert.equal(
    (
      await app.inject({
        url: "/api/internal-register",
        headers: agent.headers,
      })
    ).statusCode,
    401,
  );
});
test("Excel and CSV import use first sheet, shared/inline text, skip formulas and reject unsafe/oversized XML", async () => {
  const files = {
    "xl/workbook.xml":
      '<workbook><sheets><sheet name="Exemple" r:id="rId2"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels":
      '<Relationships><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>',
    "xl/sharedStrings.xml":
      "<sst><si><t>Nom</t></si><si><t>Prénom</t></si><si><t>Motif</t></si><si><t>Test</t></si></sst>",
    "xl/worksheets/sheet2.xml":
      '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row><row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="inlineStr"><is><t>Fictif</t></is></c><c r="C2"><f>HYPERLINK("https://example.org")</f><v>cached</v></c></row></sheetData></worksheet>',
  };
  let result = await parseRegisterImport(await xlsx(files), "registre.xlsx");
  assert.equal(result.rows[0].name, "Fictif Test");
  assert.equal(result.rows[0].reason, "");
  assert.match(result.warnings.join(), /formule/);
  result = await parseRegisterImport(
    Buffer.from(
      'Nom;Motif;Consignes\n"Exemple";"ligne 1\nligne 2";"Contacter l’équipe"',
    ),
    "exemple.csv",
  );
  assert.equal(result.rows[0].reason, "ligne 1\nligne 2");
  await assert.rejects(
    () => parseRegisterImport(Buffer.from("Nom\nExemple"), "exemple.xls"),
    /xlsx/,
  );
  const malicious = await xlsx({
    ...files,
    "xl/sharedStrings.xml":
      '<!DOCTYPE x [<!ENTITY leak SYSTEM "file:///etc/passwd">]><sst/>',
  });
  await assert.rejects(() => parseRegisterImport(malicious, "x.xlsx"), /XML/);
  await assert.rejects(
    () => parseRegisterImport(Buffer.alloc(8 * 1024 ** 2 + 1), "x.xlsx"),
    /8 Mo/,
  );
});
test("group posters render all styles, high-resolution exports and fail clearly when a photo is unavailable", async (t) => {
  const { app, db, c } = await fixture(t),
    { headers } = await login(app),
    a = animal(db, "Portrait"),
    p = await ingest(db, c, a, Readable.from(await png()), "portrait.png");
  for (const template of ["spa", "glass", "editorial", "polaroid"]) {
    const r = await app.inject({
      method: "POST",
      url: "/api/group-posters",
      headers,
      payload: {
        animals: [{ id: a }],
        template,
        output: "preview",
        qrUrl: "https://www.la-spa.fr/",
      },
    });
    assert.equal(r.statusCode, 200, r.body.slice(0, 100));
    const meta = await sharp(r.rawPayload).metadata();
    assert.equal(meta.width, 868);
    assert.ok(meta.height > 1200);
  }
  let r = await app.inject({
    method: "POST",
    url: "/api/group-posters",
    headers,
    payload: { animals: [{ id: a }], output: "pdf", format: "A4" },
  });
  assert.equal(r.statusCode, 200);
  const pdf = await PDFDocument.load(r.rawPayload);
  assert.equal(pdf.getPageCount(), 1);
  assert.ok(Math.abs(pdf.getPage(0).getWidth() - 595.276) < 1);
  await fs.rename(
    path.join(
      c.mediaDir,
      db.prepare("SELECT hash FROM photos WHERE id=?").get(p.id).hash,
    ),
    path.join(c.mediaDir, "missing-test"),
  );
  r = await app.inject({
    method: "POST",
    url: "/api/group-posters",
    headers,
    payload: { animals: [{ id: a }] },
  });
  assert.equal(r.statusCode, 422);
  assert.match(r.json().error, /Portrait/);
});

test("group poster waits for every SPA picture without creating local originals", async (t) => {
  const buffer = await png();
  let downloads = 0;
  const { app, db } = await fixture(t, {
      spaPhotoFetcher: async () => {
        downloads++;
        await new Promise((resolve) => setTimeout(resolve, 25));
        return buffer;
      },
    }),
    { headers } = await login(app),
    a = animal(db, "Source SPA"),
    b = animal(db, "Autre SPA");
  for (const id of [a, b])
    db.prepare("UPDATE animals SET source_metadata=? WHERE id=?").run(
      JSON.stringify({
        thumbnail: `https://www.la-spa.fr/app/uploads/animals/${id}.jpg`,
      }),
      id,
    );
  const r = await app.inject({
    method: "POST",
    url: "/api/group-posters",
    headers,
    payload: {
      animals: [{ id: a, source: "spa" }, { id: b }],
      template: "glass",
    },
  });
  assert.equal(r.statusCode, 200, r.body.slice(0, 150));
  assert.equal(downloads, 2);
  assert.equal((await sharp(r.rawPayload).metadata()).width, 868);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM blobs").get().n, 0);
});
