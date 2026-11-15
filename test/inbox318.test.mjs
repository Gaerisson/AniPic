import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import sharp from "sharp";
import { fixture, login, animal } from "./helpers.mjs";
import { ingest } from "../server/storage.mjs";
import path from "node:path";
import { promises as fs } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { saveSettings } from "../server/db.mjs";
import { purgeDiscardedInbox } from "../server/inbox-retention.mjs";
import {
  beginMediaWrite,
  mediaMaintenance,
} from "../server/media-maintenance.mjs";
import { pruneBackups, restoreBackup } from "../server/backup.mjs";

async function add(db, c, color, animalId = null) {
  const buffer = await sharp({
    create: { width: 70, height: 90, channels: 3, background: color },
  })
    .jpeg()
    .toBuffer();
  return ingest(
    db,
    c,
    animalId,
    Readable.from(buffer),
    "portrait.jpg",
    false,
    null,
    animalId ? null : { folder: "Exports/Nala" },
  );
}
const post = (app, headers, url, payload) =>
  app.inject({ method: "POST", url, headers, payload });

test("the private global inbox count follows discard, restore, assignment and undo", async (t) => {
  const { app, db, c } = await fixture(t);
  const admin = await login(app),
    agent = await login(app, "agent"),
    editor = await login(app, "editor");
  const viewer = await login(app, "viewer"),
    volunteer = await login(app, "volunteer");
  assert.equal((await app.inject({ url: "/api/inbox/count" })).statusCode, 401);
  for (const headers of [viewer.headers, volunteer.headers])
    assert.equal(
      (await app.inject({ url: "/api/inbox/count", headers })).statusCode,
      403,
    );
  const count = async (headers = agent.headers) => {
    const r = await app.inject({
      url: "/api/inbox/count?folder=missing&q=missing&archived=1",
      headers,
    });
    assert.equal(r.statusCode, 200, r.body);
    return r.json();
  };
  assert.deepEqual(await count(), { count: 0 });
  const p = await add(db, c, "#a14433"),
    q = await add(db, c, "#22a688");
  for (const headers of [admin.headers, agent.headers, editor.headers])
    assert.deepEqual(await count(headers), { count: 2 });
  const change = (archived) =>
    post(app, agent.headers, "/api/inbox/archive", {
      photoIds: [p.id],
      archived,
    });
  assert.equal((await change(true)).statusCode, 200);
  assert.deepEqual(await count(), { count: 1 });
  assert.equal((await change(false)).statusCode, 200);
  assert.deepEqual(await count(), { count: 2 });
  const assigned = await post(app, agent.headers, "/api/inbox/assign", {
    photoIds: [p.id, q.id],
    animalId: animal(db),
  });
  assert.equal(assigned.statusCode, 200, assigned.body);
  assert.deepEqual(await count(), { count: 0 });
  const undone = await post(app, agent.headers, "/api/photos/assignment/undo", {
    token: assigned.json().undoToken,
  });
  assert.equal(undone.statusCode, 200, undone.body);
  assert.deepEqual(await count(), { count: 2 });
});

test("discard retention is off by default and only an administrator can enable a bounded duration", async (t) => {
  const { app } = await fixture(t);
  const admin = await login(app),
    agent = await login(app, "agent");
  const read = await app.inject({
    url: "/api/inbox/retention",
    headers: admin.headers,
  });
  assert.equal(read.statusCode, 200, read.body);
  assert.equal(read.json().days, 0);
  assert.equal(read.json().scheduler, false);
  assert.equal(
    (await app.inject({ url: "/api/inbox/retention" })).statusCode,
    401,
  );
  assert.equal(
    (await app.inject({ url: "/api/inbox/retention", headers: agent.headers }))
      .statusCode,
    403,
  );
  const configure = (headers, payload) =>
    app.inject({
      method: "PUT",
      url: "/api/inbox/retention",
      headers,
      payload,
    });
  assert.equal((await configure(agent.headers, { days: 30 })).statusCode, 403);
  assert.equal(
    (
      await configure(
        { ...admin.headers, "x-csrf-token": "wrong" },
        { days: 30 },
      )
    ).statusCode,
    403,
  );
  for (const days of [-1, 1.5, 3651])
    assert.equal((await configure(admin.headers, { days })).statusCode, 400);
  assert.equal((await configure(admin.headers, { days: 30 })).statusCode, 200);
  const listed = await app.inject({
    url: "/api/inbox",
    headers: agent.headers,
  });
  assert.equal(listed.json().retention.days, 30);
  assert.equal((await configure(admin.headers, { days: 0 })).statusCode, 200);
  assert.equal(
    (
      await app.inject({ url: "/api/inbox/retention", headers: admin.headers })
    ).json().days,
    0,
  );
});

test("disabled retention preserves old discarded photos without creating a backup", async (t) => {
  const { db, c } = await fixture(t);
  const p = await add(db, c, "#a14433");
  db.prepare(
    "UPDATE inbox_photos SET archived_at='2000-01-01T00:00:00.000Z' WHERE id=?",
  ).run(p.id);
  const before = db.prepare("SELECT * FROM inbox_photos").all();
  assert.equal((await purgeDiscardedInbox(db, c)).deleted, 0);
  assert.deepEqual(db.prepare("SELECT * FROM inbox_photos").all(), before);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM backups").get().n, 0);
});

test("disabling the inbox module pauses retained-photo cleanup without changing its policy and reenabling resumes it", async (t) => {
  const { db, c } = await fixture(t);
  const p = await add(db, c, "#a14433");
  db.prepare(
    "UPDATE inbox_photos SET archived_at='2000-01-01T00:00:00.000Z' WHERE id=?",
  ).run(p.id);
  saveSettings(db, {
    inboxRetentionDays: 30,
    enabledModules: { inbox: false },
  });
  const before = db.prepare("SELECT * FROM inbox_photos").all();
  assert.equal((await purgeDiscardedInbox(db, c)).deleted, 0);
  assert.deepEqual(db.prepare("SELECT * FROM inbox_photos").all(), before);
  await fs.access(path.join(c.mediaDir, before[0].hash));
  assert.equal(db.prepare("SELECT COUNT(*) n FROM backups").get().n, 0);
  assert.equal(
    JSON.parse(
      db
        .prepare("SELECT value FROM settings WHERE key='inboxRetentionDays'")
        .get().value,
    ),
    30,
  );
  saveSettings(db, { enabledModules: { inbox: true } });
  assert.equal((await purgeDiscardedInbox(db, c)).deleted, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM inbox_photos").get().n, 0);
});

test("discard retention backs up eligible photos, protects creative references and shared blobs and keeps receipts and export files", async (t) => {
  const { app, db, c, base } = await fixture(t);
  const admin = await login(app);
  const unique = await add(db, c, "#aa1133"),
    shared = await add(db, c, "#22aa88");
  const pinned = await add(db, c, "#3355aa"),
    reviewed = await add(db, c, "#cc8822");
  const boundary = await add(db, c, "#224488"),
    recent = await add(db, c, "#ffaa55");
  const active = await add(db, c, "#ffffff");
  await add(db, c, "#22aa88", animal(db));
  for (const p of [unique, shared, pinned, reviewed])
    db.prepare(
      "UPDATE inbox_photos SET archived_at='2029-11-01T00:00:00.000Z' WHERE id=?",
    ).run(p.id);
  db.prepare(
    "UPDATE inbox_photos SET archived_at='2029-12-02T00:00:00.000Z' WHERE id=?",
  ).run(boundary.id);
  db.prepare(
    "UPDATE inbox_photos SET archived_at='2029-12-20T00:00:00.000Z' WHERE id=?",
  ).run(recent.id);
  const hash = (p) =>
    db.prepare("SELECT hash FROM inbox_photos WHERE id=?").get(p.id).hash;
  const uniqueHash = hash(unique),
    sharedHash = hash(shared);
  saveSettings(db, { inboxRetentionDays: 30, pinnedProjectPhoto: pinned.id });
  db.prepare("INSERT INTO photo_reviews VALUES (?,?,?,?,?)").run(
    "inbox:" + reviewed.id,
    "signature",
    "keep",
    admin.user.id,
    "2029-11-01",
  );
  db.prepare("INSERT INTO image_fingerprints VALUES (?,?)").run(
    uniqueHash,
    "0000000000000000",
  );
  db.prepare("INSERT INTO import_receipts VALUES (?,?,?,?,?)").run(
    "receipt",
    50,
    123,
    uniqueHash,
    "2029-11-01",
  );
  c.importDir = path.join(base, "exports");
  await fs.mkdir(c.importDir);
  await fs.writeFile(path.join(c.importDir, "original.jpg"), "original export");
  const result = await purgeDiscardedInbox(db, c, null, {
    clock: Date.parse("2030-01-01T00:00:00.000Z"),
  });
  assert.equal(result.deleted, 3);
  assert.equal(result.skipped, 2);
  assert.ok(result.freedBytes > 0);
  assert.equal(result.fileErrors, 0);
  for (const p of [pinned, reviewed, recent, active])
    assert.ok(db.prepare("SELECT id FROM inbox_photos WHERE id=?").get(p.id));
  assert.equal(
    db.prepare("SELECT id FROM inbox_photos WHERE id=?").get(unique.id),
    undefined,
  );
  assert.equal(
    db.prepare("SELECT id FROM inbox_photos WHERE id=?").get(shared.id),
    undefined,
  );
  await fs.access(path.join(c.mediaDir, sharedHash));
  await assert.rejects(fs.access(path.join(c.mediaDir, uniqueHash)), {
    code: "ENOENT",
  });
  assert.equal(db.prepare("SELECT COUNT(*) n FROM import_receipts").get().n, 1);
  assert.equal(
    await fs.readFile(path.join(c.importDir, "original.jpg"), "utf8"),
    "original export",
  );
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  const saved = db
    .prepare("SELECT * FROM backups WHERE id=?")
    .get(result.backupId);
  await pruneBackups(db, c, 0);
  await fs.access(path.join(c.backupDir, saved.filename));
  const restoredPath = path.join(base, "retention-restore");
  await restoreBackup(path.join(c.backupDir, saved.filename), restoredPath);
  const restored = new DatabaseSync(
    path.join(restoredPath, "data", "anipic.sqlite"),
    { readOnly: true },
  );
  try {
    assert.ok(
      restored.prepare("SELECT id FROM inbox_photos WHERE id=?").get(unique.id),
    );
  } finally {
    restored.close();
  }
  await fs.access(path.join(restoredPath, "media", uniqueHash));
  const log = db
    .prepare("SELECT detail FROM audit WHERE action='inbox_discarded_purged'")
    .get();
  assert.equal(JSON.parse(log.detail).backupId, saved.id);
});

test("discard retention aborts on unavailable backup storage or active writes and releases maintenance", async (t) => {
  const { db, c } = await fixture(t);
  const p = await add(db, c, "#a14433");
  db.prepare(
    "UPDATE inbox_photos SET archived_at='2000-01-01T00:00:00.000Z' WHERE id=?",
  ).run(p.id);
  saveSettings(db, { inboxRetentionDays: 30 });
  const before = db.prepare("SELECT * FROM inbox_photos").all(),
    files = await fs.readdir(c.mediaDir);
  const finish = beginMediaWrite(c);
  try {
    await assert.rejects(purgeDiscardedInbox(db, c), { statusCode: 409 });
  } finally {
    finish();
  }
  await fs.rename(c.backupDir, c.backupDir + "-offline");
  await assert.rejects(purgeDiscardedInbox(db, c));
  assert.equal(mediaMaintenance(c), false);
  assert.deepEqual(db.prepare("SELECT * FROM inbox_photos").all(), before);
  assert.deepEqual(await fs.readdir(c.mediaDir), files);
  await assert.rejects(fs.access(c.backupDir), { code: "ENOENT" });
  c.requireMarker = true;
  await assert.rejects(purgeDiscardedInbox(db, c), /Volume de stockage absent/);
});

test("a restored photo or a newly referenced creation is rechecked after the asynchronous backup", async (t) => {
  const { db, c } = await fixture(t);
  const restored = await add(db, c, "#a14433"),
    referenced = await add(db, c, "#22a688");
  db.prepare(
    "UPDATE inbox_photos SET archived_at='2000-01-01T00:00:00.000Z'",
  ).run();
  saveSettings(db, { inboxRetentionDays: 30 });
  const purging = purgeDiscardedInbox(db, c);
  db.prepare("UPDATE inbox_photos SET archived_at=NULL WHERE id=?").run(
    restored.id,
  );
  saveSettings(db, {
    newCreativeReference: { kind: "inbox", id: referenced.id },
  });
  const result = await purging;
  assert.equal(result.deleted, 0);
  assert.equal(result.skipped, 2);
  for (const p of [restored, referenced]) {
    const row = db
      .prepare("SELECT hash FROM inbox_photos WHERE id=?")
      .get(p.id);
    assert.ok(row);
    await fs.access(path.join(c.mediaDir, row.hash));
  }
});

test("an original whose bytes do not match its hash aborts retention before metadata is removed", async (t) => {
  const { db, c } = await fixture(t);
  const p = await add(db, c, "#a14433");
  db.prepare(
    "UPDATE inbox_photos SET archived_at='2000-01-01T00:00:00.000Z' WHERE id=?",
  ).run(p.id);
  saveSettings(db, { inboxRetentionDays: 30 });
  const original = db
    .prepare(
      "SELECT b.* FROM blobs b JOIN inbox_photos p ON p.hash=b.hash WHERE p.id=?",
    )
    .get(p.id);
  const corruptHash = "f".repeat(64);
  await fs.link(
    path.join(c.mediaDir, original.hash),
    path.join(c.mediaDir, corruptHash),
  );
  db.prepare("INSERT INTO blobs VALUES (?,?,?,?,?,?)").run(
    corruptHash,
    original.size,
    original.width,
    original.height,
    original.mime,
    original.created_at,
  );
  db.prepare("UPDATE inbox_photos SET hash=? WHERE id=?").run(
    corruptHash,
    p.id,
  );
  const before = db.prepare("SELECT * FROM inbox_photos").all();
  await assert.rejects(purgeDiscardedInbox(db, c), /Original endommagé/);
  assert.deepEqual(db.prepare("SELECT * FROM inbox_photos").all(), before);
  assert.equal(mediaMaintenance(c), false);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM backups").get().n, 0);
});

test("each retention pass removes at most two hundred photos and the next pass can finish the remainder", async (t) => {
  const { db, c } = await fixture(t);
  for (let i = 0; i < 201; i++) {
    const png = await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 3,
        background: { r: 12, g: 45, b: i },
      },
    })
      .png()
      .toBuffer();
    await ingest(
      db,
      c,
      null,
      Readable.from(png),
      `photo-${i}.png`,
      false,
      null,
      { folder: "batch" },
    );
  }
  db.prepare(
    "UPDATE inbox_photos SET archived_at='2000-01-01T00:00:00.000Z'",
  ).run();
  saveSettings(db, { inboxRetentionDays: 30 });
  const first = await purgeDiscardedInbox(db, c);
  assert.equal(first.deleted, 200);
  assert.equal(first.more, true);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM inbox_photos").get().n, 1);
  const second = await purgeDiscardedInbox(db, c);
  assert.equal(second.deleted, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM inbox_photos").get().n, 0);
});
