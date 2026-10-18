import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { fixture, login, animal } from "./helpers.mjs";
import { ingest } from "../server/storage.mjs";
import { purgeTrash } from "../server/trash.mjs";
import { now, saveSettings } from "../server/db.mjs";
import { applySnapshot, normalizeSnapshot } from "../server/source.mjs";
import { pruneBackups, restoreBackup } from "../server/backup.mjs";
const post = (app, h, url, payload = {}) =>
  app.inject({ method: "POST", url, headers: h, payload });
async function add(db, c, a, color = "#ac7933", hidden = false) {
  return ingest(
    db,
    c,
    a,
    Readable.from(
      await sharp({
        create: { width: 70, height: 90, channels: 3, background: color },
      })
        .jpeg()
        .toBuffer(),
    ),
    "portrait.jpg",
    hidden,
  );
}
const archive = (db, a) =>
  db
    .prepare("UPDATE animals SET archived_at=?,departed_at=? WHERE id=?")
    .run(now(), now(), a);
test("an archived animal and all its photos can be trashed and restored without deleting originals; sync never resurrects it", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    a = animal(db),
    p = await add(db, c, a, "#ac7933", true);
  const photo = db.prepare("SELECT * FROM photos WHERE id=?").get(p.id),
    files = await fs.readdir(c.mediaDir);
  assert.equal(
    (await post(app, admin.headers, `/api/animals/${a}/trash`)).statusCode,
    409,
  );
  archive(db, a);
  assert.equal(
    (await post(app, admin.headers, `/api/animals/${a}/trash`)).statusCode,
    200,
  );
  assert.equal(
    (await app.inject({ url: "/api/animals?archive=1" })).json().total,
    0,
  );
  assert.equal(
    (await app.inject({ url: "/api/archive/folders" })).json().length,
    0,
  );
  assert.equal(
    (await app.inject({ url: `/api/animals/${a}` })).statusCode,
    404,
  );
  const trash = (
    await app.inject({ url: "/api/trash", headers: admin.headers })
  ).json();
  assert.equal(trash.animals[0].id, a);
  assert.equal(trash.photos.length, 0);
  const old = db.prepare("SELECT source_id FROM animals WHERE id=?").get(a);
  applySnapshot(
    db,
    normalizeSnapshot({
      schemaVersion: 1,
      scope: "spa:moree",
      animals: [
        { sourceId: old.source_id, name: "Nom source", species: "dog" },
      ],
    }),
  );
  assert.ok(
    db.prepare("SELECT archived_at FROM animals WHERE id=?").get(a).archived_at,
  );
  assert.equal(
    db.prepare("SELECT name FROM animals WHERE id=?").get(a).name,
    "Nala",
  );
  const restored = await post(
    app,
    admin.headers,
    `/api/animals/${a}/trash/restore`,
  );
  assert.equal(restored.statusCode, 200, restored.body);
  assert.deepEqual(
    db.prepare("SELECT * FROM photos WHERE id=?").get(p.id),
    photo,
  );
  assert.deepEqual(await fs.readdir(c.mediaDir), files);
  assert.equal(
    (await app.inject({ url: "/api/animals?archive=1" })).json().total,
    1,
  );
});
test("purge verifies and protects a recoverable backup, frees only unreferenced originals and preserves photos used by projects", async (t) => {
  const { app, db, c, base } = await fixture(t),
    admin = await login(app),
    a = animal(db),
    b = animal(db, "Autre");
  const shared = await add(db, c, a),
    unique = await add(db, c, a, "#e07433"),
    used = await add(db, c, a, "#233e7a");
  await add(db, c, b);
  const hashes = db
    .prepare("SELECT id,hash FROM photos WHERE animal_id=?")
    .all(a);
  db.prepare("INSERT INTO image_fingerprints VALUES (?,?)").run(
    hashes.find((p) => p.id === unique.id).hash,
    "0000000000000000",
  );
  saveSettings(db, { pinnedProjectPhoto: used.id });
  archive(db, a);
  await post(app, admin.headers, `/api/animals/${a}/trash`);
  const result = await purgeTrash(db, c, admin.user);
  assert.equal(result.deleted, 2);
  assert.equal(result.skipped, 1);
  assert.ok(result.freedBytes > 0);
  const hash = (id) => hashes.find((p) => p.id === id).hash;
  await fs.access(path.join(c.mediaDir, hash(shared.id)));
  await fs.access(path.join(c.mediaDir, hash(used.id)));
  await assert.rejects(fs.access(path.join(c.mediaDir, hash(unique.id))), {
    code: "ENOENT",
  });
  assert.ok(db.prepare("SELECT id FROM photos WHERE id=?").get(used.id));
  const saved = db
    .prepare("SELECT * FROM backups WHERE id=?")
    .get(result.backupId);
  await pruneBackups(db, c, 0);
  await fs.access(path.join(c.backupDir, saved.filename));
  const restored = path.join(base, "restored-before-purge");
  await restoreBackup(path.join(c.backupDir, saved.filename), restored);
  await fs.access(path.join(restored, "media", hash(unique.id)));
  db.prepare("DELETE FROM settings WHERE key='pinnedProjectPhoto'").run();
  const final = await purgeTrash(db, c, admin.user);
  assert.equal(final.animals, 1);
  assert.equal(final.deleted, 1);
  assert.equal(
    (await app.inject({ url: "/api/trash", headers: admin.headers })).json()
      .animals.length,
    0,
  );
  assert.equal(
    (await post(app, admin.headers, `/api/animals/${a}/trash/restore`))
      .statusCode,
    409,
  );
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});
test("an unavailable backup NAS aborts purge without removing metadata or originals or creating a local replacement", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    a = animal(db),
    p = await add(db, c, a);
  archive(db, a);
  await post(app, admin.headers, `/api/animals/${a}/trash`);
  const before = db.prepare("SELECT * FROM photos WHERE id=?").get(p.id),
    originals = await fs.readdir(c.mediaDir);
  await fs.rename(c.backupDir, c.backupDir + "-offline");
  await assert.rejects(purgeTrash(db, c, admin.user));
  assert.deepEqual(
    db.prepare("SELECT * FROM photos WHERE id=?").get(p.id),
    before,
  );
  assert.deepEqual(await fs.readdir(c.mediaDir), originals);
  await assert.rejects(fs.access(c.backupDir), { code: "ENOENT" });
  // Require the normal NAS markers as well: no bypass when a share disappears.
  c.requireMarker = true;
  await assert.rejects(
    purgeTrash(db, c, admin.user),
    /Volume de stockage absent/,
  );
});
test("trash endpoints enforce roles, CSRF and explicit purge confirmation, and the background job reports completion", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    agent = await login(app, "agent"),
    volunteer = await login(app, "volunteer"),
    a = animal(db),
    p = await add(db, c, a);
  for (const h of [{}, volunteer.headers])
    assert.ok(
      [401, 403].includes(
        (await app.inject({ url: "/api/trash", headers: h })).statusCode,
      ),
    );
  assert.equal(
    (
      await post(app, agent.headers, "/api/admin/trash/empty", {
        confirm: "VIDER",
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (await post(app, admin.headers, "/api/admin/trash/empty", {})).statusCode,
    400,
  );
  assert.equal(
    (
      await post(
        app,
        { ...admin.headers, "x-csrf-token": "wrong" },
        `/api/animals/${a}/trash`,
      )
    ).statusCode,
    403,
  );
  await app.inject({
    method: "PATCH",
    url: "/api/photos/" + p.id,
    headers: admin.headers,
    payload: { deleted: true },
  });
  const start = await post(app, admin.headers, "/api/admin/trash/empty", {
    confirm: "VIDER",
    animalId: a,
  });
  assert.equal(start.statusCode, 200, start.body);
  for (let n = 0; n < 100; n++) {
    const row = db
      .prepare("SELECT * FROM jobs WHERE id=?")
      .get(start.json().id);
    if (row.state !== "running") {
      assert.equal(row.state, "done", row.detail);
      assert.equal(JSON.parse(row.detail).deleted, 1);
      return;
    }
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.fail("Purge job did not complete");
});
