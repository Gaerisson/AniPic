import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { DatabaseSync } from "node:sqlite";
import { fixture, login, animal } from "./helpers.mjs";
import { ingest } from "../server/storage.mjs";
import { scanImports, assignInbox } from "../server/inbox.mjs";
import { id, now } from "../server/db.mjs";
import { createBackup, restoreBackup } from "../server/backup.mjs";
import { normalizeSnapshot, applySnapshot } from "../server/source.mjs";
import {
  publicAnimalMetadata,
  compatibilityFromText,
} from "../server/animal-facts.mjs";
import { parseSpaPage } from "../server/spa-collector.mjs";
const image = (background = "#ab723c") =>
  sharp({ create: { width: 80, height: 100, channels: 3, background } })
    .jpeg()
    .toBuffer();
async function upload(
  app,
  headers,
  buffer,
  filename = "export.jpg",
  folder = "Chiens/Nala",
) {
  const boundary = "AnipicInboxTest";
  return app.inject({
    method: "POST",
    url: "/api/inbox/photos?folder=" + encodeURIComponent(folder),
    headers: {
      ...headers,
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`,
      ),
      buffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
}
test("inbox stays private, deduplicates originals and atomically assigns a selected series to the correct homonym", async (t) => {
  const { app, db, c } = await fixture(t),
    { headers } = await login(app, "agent");
  const a = animal(db, "Nala"),
    b = animal(db, "Nala");
  const first = await upload(app, headers, await image());
  assert.equal(first.statusCode, 201, first.body);
  const p = first.json();
  const duplicate = await upload(app, headers, await image());
  assert.equal(duplicate.json().duplicate, true);
  assert.equal(duplicate.json().id, p.id);
  const second = await upload(
    app,
    headers,
    await image("#48634d"),
    "export-2.jpg",
  );
  assert.equal(second.statusCode, 201, second.body);
  const q = second.json();
  assert.equal((await app.inject({ url: "/api/inbox" })).statusCode, 401);
  const viewer = await login(app, "viewer");
  assert.equal(
    (await app.inject({ url: "/api/inbox", headers: viewer.headers }))
      .statusCode,
    403,
  );
  const list = await app.inject({
    url: "/api/inbox?folder=Chiens%2FNala",
    headers,
  });
  assert.equal(list.json().total, 2);
  assert.equal(list.json().items[0].hash, undefined);
  assert.equal(
    (await app.inject({ url: `/api/inbox/${p.id}/preview` })).statusCode,
    401,
  );
  assert.equal((await app.inject({ url: `/media/${p.id}` })).statusCode, 404);
  const preview = await app.inject({
    url: `/api/inbox/${p.id}/preview?width=160`,
    headers,
  });
  assert.equal(preview.statusCode, 200, preview.body);
  assert.equal((await sharp(preview.rawPayload).metadata()).format, "webp");
  const conflict = await app.inject({
    method: "POST",
    url: "/api/inbox/assign",
    headers,
    payload: { animalId: b, photoIds: [p.id, id()] },
  });
  assert.equal(conflict.statusCode, 409);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos").get().n, 0);
  const assigned = await app.inject({
    method: "POST",
    url: "/api/inbox/assign",
    headers,
    payload: { animalId: b, photoIds: [p.id, q.id] },
  });
  assert.equal(assigned.statusCode, 200, assigned.body);
  assert.equal(assigned.json().added, 2);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM photos WHERE animal_id=?").get(a).n,
    0,
  );
  assert.equal(
    db
      .prepare("SELECT COUNT(*) n FROM photos WHERE animal_id=? AND hidden=1")
      .get(b).n,
    2,
  );
  assert.equal(db.prepare("SELECT COUNT(*) n FROM inbox_photos").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM blobs").get().n, 2);
  assert.equal(
    (await fs.readdir(c.mediaDir)).filter((f) => !f.startsWith(".")).length,
    2,
  );
  assert.equal(
    (await app.inject({ url: "/api/animals/" + b })).json().photo_count,
    0,
  );
  const again = (await upload(app, headers, await image())).json();
  const repeated = await app.inject({
    method: "POST",
    url: "/api/inbox/assign",
    headers,
    payload: { animalId: b, photoIds: [again.id], hidden: false },
  });
  assert.equal(repeated.json().duplicates, 1);
  assert.equal(
    db.prepare("SELECT hidden FROM photos WHERE animal_id=? LIMIT 1").get(b)
      .hidden,
    1,
  );
});
test("discarded inbox photos are recoverable and inbox originals survive backup/restore", async (t) => {
  const { app, db, c, base } = await fixture(t),
    { headers } = await login(app);
  const p = (await upload(app, headers, await image())).json();
  const change = async (archived) =>
    app.inject({
      method: "POST",
      url: "/api/inbox/archive",
      headers,
      payload: { photoIds: [p.id], archived },
    });
  assert.equal((await change(true)).statusCode, 200);
  assert.equal(
    (await app.inject({ url: "/api/inbox", headers })).json().total,
    0,
  );
  assert.equal(
    (await app.inject({ url: "/api/inbox?archived=1", headers })).json().total,
    1,
  );
  assert.equal((await change(false)).statusCode, 200);
  const backup = await createBackup(db, c),
    destination = path.join(base, "restored");
  await restoreBackup(path.join(c.backupDir, backup.filename), destination);
  const restored = new DatabaseSync(
    path.join(destination, "data", "anipic.sqlite"),
    { readOnly: true },
  );
  try {
    const saved = restored.prepare("SELECT * FROM inbox_photos").get();
    assert.equal(saved.id, p.id);
    assert.equal(saved.folder, "Chiens/Nala");
    assert.equal(
      (await fs.stat(path.join(destination, "media", saved.hash))).size > 0,
      true,
    );
  } finally {
    restored.close();
  }
});
test("read-only export folder retains named directories, skips unfinished files and receipts prevent reimport after assignment", async (t) => {
  const { app, db, c, base } = await fixture(t),
    { user } = await login(app);
  c.importDir = path.join(base, "exports");
  const folder = path.join(c.importDir, "Chiens", "Nala");
  await fs.mkdir(folder, { recursive: true });
  const file = path.join(folder, "export.jpg"),
    recent = path.join(folder, "unfinished.jpg");
  await fs.writeFile(file, await image());
  await fs.writeFile(recent, await image("#111111"));
  const old = new Date(Date.now() - 20000);
  await fs.utimes(file, old, old);
  const scan = await scanImports(db, c, user.id);
  assert.equal(scan.added, 1);
  assert.equal(scan.skipped, 1);
  const row = db.prepare("SELECT * FROM inbox_photos").get();
  assert.equal(row.folder, "Chiens/Nala");
  assert.equal((await fs.stat(file)).isFile(), true);
  const a = animal(db, "Nala");
  assignInbox(db, [row.id], a);
  assert.equal((await scanImports(db, c, user.id)).added, 0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM inbox_photos").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM import_receipts").get().n, 1);
  assert.equal((await fs.stat(file)).mtimeMs, old.getTime());
});
test("printable session list merges requests and missing photos, excludes departed animals and preserves homonym IDs", async (t) => {
  const { app, db, c } = await fixture(t),
    { headers, user } = await login(app, "agent");
  const a = animal(db, "Nala"),
    b = animal(db, "Nala"),
    archived = animal(db, "Archivé");
  await ingest(db, c, a, Readable.from(await image()), "portrait.jpg");
  db.prepare("UPDATE animals SET archived_at=? WHERE id=?").run(
    now(),
    archived,
  );
  for (const priority of ["high", "normal"])
    db.prepare("INSERT INTO shoot_tasks VALUES (?,?,?,?,?,?,?,?,?,?)").run(
      id(),
      a,
      "Portrait extérieur",
      "Prendre le harnais",
      priority,
      "todo",
      user.id,
      null,
      now(),
      now(),
    );
  const response = await app.inject({ url: "/api/shoot-sheet", headers });
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(
    response.json().items.map((a) => a.id),
    [a, b],
  );
  assert.equal(response.json().items[0].requests.length, 2);
  assert.equal(
    (await app.inject({ url: "/api/shoot-sheet?mode=missing", headers })).json()
      .items[0].id,
    b,
  );
  assert.equal(
    (
      await app.inject({ url: "/api/shoot-sheet?mode=priorities", headers })
    ).json().total,
    1,
  );
  assert.equal((await app.inject({ url: "/api/shoot-sheet" })).statusCode, 401);
});
test("SPA extra fields normalize dates and explicit booleans while public animal responses exclude unrelated private metadata", async (t) => {
  const { app, db } = await fixture(t);
  const page = parseSpaPage(
    {
      animals: [
        {
          ID: 42,
          name: "Milo",
          establishment_slug: "refuge-spa-de-moree-jean-leriche",
          taille: "Moyenne",
          poids: "23 kg",
          date_entree: "01/09/2025",
          sterilise: false,
          couleur: "Roux",
          besoins_specifiques: "<b>Rencontres progressives</b>",
          entente: { chat: false },
          sos: "false",
        },
      ],
      max_num_pages: 1,
      total: 1,
    },
    "dog",
  );
  const snapshot = normalizeSnapshot({ dog_list: { 42: page.records[0] } });
  assert.equal(snapshot.animals[0].metadata.arrivalDate, "2025-09-01");
  assert.equal(snapshot.animals[0].metadata.sterilized, "Non");
  assert.equal(snapshot.animals[0].metadata.weight, "23 kg");
  assert.deepEqual(snapshot.animals[0].tags, []);
  applySnapshot(db, snapshot);
  const a = db.prepare("SELECT * FROM animals WHERE source_id='spa:42'").get();
  db.prepare("UPDATE animals SET source_metadata=? WHERE id=?").run(
    JSON.stringify({
      ...snapshot.animals[0].metadata,
      ownerEmail: "private@example.invalid",
      microchip: "not-public",
      apiToken: "secret",
    }),
    a.id,
  );
  const response = await app.inject({ url: "/api/animals/" + a.id });
  assert.equal(response.statusCode, 200);
  assert.equal(
    response.json().source_metadata.specialNeeds,
    "Rencontres progressives",
  );
  assert.equal(response.json().source_metadata.ownerEmail, undefined);
  assert.equal(response.json().source_metadata.microchip, undefined);
  assert.deepEqual(
    publicAnimalMetadata({ arrival_date: "31/02/2025", sterilised: 0 }),
    { sterilized: "Non" },
  );
  assert.deepEqual(
    publicAnimalMetadata({
      size: false,
      weight: false,
      special_needs: false,
      sterilized: false,
    }),
    { sterilized: "Non" },
  );
  assert.deepEqual(
    compatibilityFromText(
      "Ententes chat: non ; chiens: oui ; enfants: à tester",
    ),
    { chat: "non", chien: "oui", enfant: "à tester" },
  );
  assert.deepEqual(
    compatibilityFromText("Un chien joueur qui aime les chats."),
    {},
  );
  for (const animals of [
    "invalid",
    [null],
    [{ sourceId: "x", name: "Milo", species: "dog", metadata: "invalid" }],
  ])
    assert.throws(
      () => normalizeSnapshot({ schemaVersion: 1, animals }),
      (error) => error.name === "ZodError",
    );
  const search = await app.inject({ url: "/api/animals?q=spa%3A42" });
  assert.equal(search.json().items[0].id, a.id);
});
