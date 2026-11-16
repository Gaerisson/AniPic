import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import sharp from "sharp";
import { fixture, animal } from "./helpers.mjs";
import { ingest } from "../server/storage.mjs";
import { scanImports } from "../server/inbox.mjs";
import { promises as fs } from "node:fs";
import path from "node:path";

test("a folder import keeps its receipt when the inbox image is immediately assigned", async (t) => {
  const { db, c, base } = await fixture(t);
  const target = animal(db);
  c.importDir = path.join(base, "depot");
  await fs.mkdir(c.importDir);
  const source = await sharp({
    create: { width: 80, height: 60, channels: 3, background: "#6a8871" },
  })
    .jpeg()
    .toBuffer();
  const filename = path.join(c.importDir, "portrait.jpg");
  await fs.writeFile(filename, source);
  const stable = new Date(Date.now() - 60000);
  await fs.utimes(filename, stable, stable);
  // Reproduce an immediate hand-off: the import result remains valid after its queue row is gone.
  db.exec(`CREATE TRIGGER assign_immediately AFTER INSERT ON inbox_photos BEGIN
    INSERT INTO photos(id,animal_id,hash,filename,hidden,created_at) VALUES (NEW.id,'${target}',NEW.hash,NEW.filename,0,NEW.created_at);
    DELETE FROM inbox_photos WHERE id=NEW.id;
  END;`);
  const result = await scanImports(db, c);
  assert.deepEqual(result.errors, []);
  assert.equal(result.added, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM inbox_photos").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM import_receipts").get().n, 1);
  assert.equal((await scanImports(db, c)).added, 0);
  await assert.rejects(fs.access(filename), { code: "ENOENT" });
});

test("uploading an inbox image directly to an animal clears its active inbox entry while preserving the assigned image", async (t) => {
  const { db, c } = await fixture(t);
  const source = await sharp({
    create: { width: 80, height: 60, channels: 3, background: "#946244" },
  })
    .jpeg()
    .toBuffer();
  const inbox = await ingest(
    db,
    c,
    null,
    Readable.from(source),
    "portrait.jpg",
    false,
    null,
    { folder: "A trier" },
  );
  const animalId = animal(db);
  const upload = await ingest(
    db,
    c,
    animalId,
    Readable.from(source),
    "portrait.jpg",
  );
  assert.equal(
    db.prepare("SELECT id FROM inbox_photos WHERE id=?").get(inbox.id),
    undefined,
  );
  const photo = db.prepare("SELECT * FROM photos WHERE id=?").get(upload.id);
  assert.equal(photo.animal_id, animalId);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM blobs WHERE hash=?").get(photo.hash).n,
    1,
  );
  // A background folder import does not reintroduce an already assigned image.
  const known = await ingest(
    db,
    c,
    null,
    Readable.from(source),
    "copie.jpg",
    false,
    null,
    {
      folder: "A trier",
      skipAssigned: true,
    },
  );
  assert.equal(known.alreadyAssigned, true);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM inbox_photos").get().n, 0);
  // Also reconcile an active legacy queue row from before this behavior existed.
  db.prepare(
    "INSERT INTO inbox_photos(id,hash,filename,folder,created_at) VALUES (?,?,?,?,?)",
  ).run(inbox.id, photo.hash, "copie.jpg", "A trier", photo.created_at);
  const duplicate = await ingest(
    db,
    c,
    animalId,
    Readable.from(source),
    "copie.jpg",
    true,
  );
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.id, upload.id);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM inbox_photos").get().n, 0);
  assert.equal(
    db.prepare("SELECT hidden FROM photos WHERE id=?").get(upload.id).hidden,
    0,
  );
});

test("a failed direct upload does not clear inbox work and discarded images remain restorable", async (t) => {
  const { db, c } = await fixture(t);
  const source = await sharp({
    create: { width: 70, height: 80, channels: 3, background: "#3f704f" },
  })
    .jpeg()
    .toBuffer();
  const inbox = await ingest(
    db,
    c,
    null,
    Readable.from(source),
    "portrait.jpg",
    false,
    null,
    { folder: "A trier" },
  );
  await assert.rejects(
    ingest(
      db,
      c,
      "00000000-0000-4000-8000-000000000000",
      Readable.from(source),
      "portrait.jpg",
    ),
  );
  assert.ok(db.prepare("SELECT id FROM inbox_photos WHERE id=?").get(inbox.id));
  db.prepare("UPDATE inbox_photos SET archived_at=? WHERE id=?").run(
    new Date().toISOString(),
    inbox.id,
  );
  await ingest(db, c, animal(db), Readable.from(source), "portrait.jpg");
  assert.ok(
    db.prepare("SELECT archived_at FROM inbox_photos WHERE id=?").get(inbox.id)
      .archived_at,
  );
});
