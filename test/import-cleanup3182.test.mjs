import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { fixture, login, animal } from "./helpers.mjs";
import { scanImports } from "../server/inbox.mjs";
import { ingest } from "../server/storage.mjs";
import { Readable } from "node:stream";

async function deposited(t) {
  const ctx = await fixture(t);
  ctx.c.importDir = path.join(ctx.base, "depot");
  await fs.mkdir(path.join(ctx.c.importDir, "Chiens"), { recursive: true });
  const bytes = await sharp({
    create: { width: 80, height: 100, channels: 3, background: "#987151" },
  })
    .jpeg()
    .toBuffer();
  const filename = path.join(ctx.c.importDir, "Chiens", "portrait.jpg");
  await fs.writeFile(filename, bytes);
  const stable = new Date(Date.now() - 60000);
  await fs.utimes(filename, stable, stable);
  await scanImports(ctx.db, ctx.c);
  return {
    ...ctx,
    bytes,
    filename,
    photo: ctx.db.prepare("SELECT * FROM inbox_photos").get(),
  };
}
const post = (app, headers, url, payload) =>
  app.inject({ method: "POST", url, headers, payload });

test("assigning a deposited photo removes its source only after a retained AniPic copy exists and undo still works", async (t) => {
  const { app, db, c, bytes, filename, photo } = await deposited(t);
  const { headers } = await login(app, "agent");
  const result = await post(app, headers, "/api/inbox/assign", {
    photoIds: [photo.id],
    animalId: animal(db),
  });
  assert.equal(result.statusCode, 200, result.body);
  await assert.rejects(fs.access(filename), { code: "ENOENT" });
  assert.deepEqual(await fs.readFile(path.join(c.mediaDir, photo.hash)), bytes);
  assert.equal(result.json().sourceCleanup.deleted, 1);
  const undo = await post(app, headers, "/api/photos/assignment/undo", {
    token: result.json().undoToken,
  });
  assert.equal(undo.statusCode, 200, undo.body);
  assert.ok(db.prepare("SELECT id FROM inbox_photos WHERE id=?").get(photo.id));
  assert.equal(
    (await post(app, headers, `/api/inbox/${photo.id}/download`, {}))
      .statusCode,
    200,
  );
});

test("discarding removes the deposited file while preserving restoration in AniPic", async (t) => {
  const { app, db, c, bytes, filename, photo } = await deposited(t);
  const { headers } = await login(app, "agent");
  const archived = await post(app, headers, "/api/inbox/archive", {
    photoIds: [photo.id],
    archived: true,
  });
  assert.equal(archived.statusCode, 200, archived.body);
  await assert.rejects(fs.access(filename), { code: "ENOENT" });
  assert.equal(archived.json().sourceCleanup.deleted, 1);
  assert.deepEqual(await fs.readFile(path.join(c.mediaDir, photo.hash)), bytes);
  const restored = await post(app, headers, "/api/inbox/archive", {
    photoIds: [photo.id],
    archived: false,
  });
  assert.equal(restored.statusCode, 200, restored.body);
  assert.equal(
    db.prepare("SELECT archived_at FROM inbox_photos WHERE id=?").get(photo.id)
      .archived_at,
    null,
  );
});

test("direct uploads clean the matching deposit and a known assigned image is not put back in the queue", async (t) => {
  const { db, c, bytes, filename, photo } = await deposited(t);
  const uploaded = await ingest(
    db,
    c,
    animal(db),
    Readable.from(bytes),
    "portrait.jpg",
  );
  assert.equal(uploaded.sourceCleanup.deleted, 1);
  await assert.rejects(fs.access(filename), { code: "ENOENT" });
  assert.equal(
    db.prepare("SELECT id FROM inbox_photos WHERE id=?").get(photo.id),
    undefined,
  );
  const repeated = await ingest(
    db,
    c,
    null,
    Readable.from(bytes),
    "portrait.jpg",
    false,
    null,
    { folder: "Chiens", skipAssigned: true },
  );
  assert.equal(repeated.alreadyAssigned, true);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM inbox_photos").get().n, 0);
});

test("modified exports and damaged AniPic copies never cause deletion of the deposited original", async (t) => {
  for (const scenario of ["mtime", "same-stat", "damaged-copy"])
    await t.test(scenario, async (t) => {
      const { app, db, c, bytes, filename, photo } = await deposited(t);
      const { headers } = await login(app, "agent");
      let expected = bytes;
      if (scenario === "damaged-copy") {
        await fs.unlink(path.join(c.mediaDir, photo.hash));
        await fs.writeFile(path.join(c.mediaDir, photo.hash), "damaged");
      } else {
        const original = await fs.stat(filename);
        expected = Buffer.from(bytes);
        expected[expected.length - 1] ^= 1;
        await fs.writeFile(filename, expected);
        if (scenario === "same-stat")
          await fs.utimes(filename, original.atime, original.mtime);
      }
      const result = await post(app, headers, "/api/inbox/archive", {
        photoIds: [photo.id],
        archived: true,
      });
      assert.equal(result.statusCode, 200, result.body);
      assert.equal(result.json().sourceCleanup.deleted, 0);
      assert.deepEqual(await fs.readFile(filename), expected);
    });
});

test("read-only cleanup reports the problem without rolling back assignment and can be retried with team rights", async (t) => {
  const { app, db, filename, photo } = await deposited(t);
  const { headers } = await login(app, "agent");
  const rename = fs.rename;
  t.mock.method(fs, "rename", async (from, to) => {
    if (from === filename)
      throw Object.assign(Error("read only"), { code: "EROFS" });
    return rename(from, to);
  });
  const assigned = await post(app, headers, "/api/inbox/assign", {
    photoIds: [photo.id],
    animalId: animal(db),
  });
  assert.equal(assigned.statusCode, 200, assigned.body);
  assert.match(assigned.json().sourceCleanup.errors[0].error, /lecture seule/);
  await fs.access(filename);
  t.mock.restoreAll();
  assert.equal((await post(app, {}, "/api/inbox/cleanup", {})).statusCode, 401);
  assert.equal(
    (
      await post(
        app,
        { ...headers, "x-csrf-token": "wrong" },
        "/api/inbox/cleanup",
        {},
      )
    ).statusCode,
    403,
  );
  const retry = await post(app, headers, "/api/inbox/cleanup", {});
  assert.equal(retry.statusCode, 200, retry.body);
  assert.equal(retry.json().sourceCleanup.deleted, 1);
  await assert.rejects(fs.access(filename), { code: "ENOENT" });
});

test("an export replaced just before or after capture is preserved without overwriting the replacement", async (t) => {
  for (const phase of ["before", "after"])
    await t.test(phase, async (t) => {
      const { app, db, filename, photo } = await deposited(t);
      const { headers } = await login(app, "agent");
      const replacement = Buffer.from("a newer exported photo"),
        rename = fs.rename;
      t.mock.method(fs, "rename", async (from, to) => {
        if (from !== filename) return rename(from, to);
        if (phase === "before") await fs.writeFile(filename, replacement);
        const result = await rename(from, to);
        if (phase === "after") await fs.writeFile(filename, replacement);
        return result;
      });
      const archived = await post(app, headers, "/api/inbox/archive", {
        photoIds: [photo.id],
        archived: true,
      });
      assert.equal(archived.statusCode, 200, archived.body);
      assert.equal(
        archived.json().sourceCleanup.deleted,
        phase === "after" ? 1 : 0,
      );
      assert.deepEqual(await fs.readFile(filename), replacement);
      assert.equal(
        db.prepare("SELECT COUNT(*) n FROM import_cleanup_pending").get().n,
        0,
      );
    });
});

test("an interrupted cleanup resumes from its journal, or restores the deposit when the photo has returned to the queue", async (t) => {
  for (const undo of [false, true])
    await t.test(`undo=${undo}`, async (t) => {
      const { app, db, bytes, filename, photo } = await deposited(t);
      const { headers } = await login(app, "agent");
      const unlink = fs.unlink;
      t.mock.method(fs, "unlink", async (file) => {
        if (path.basename(file).startsWith(".anipic-processed-"))
          throw Object.assign(Error("interrupted"), { code: "EIO" });
        return unlink(file);
      });
      const archived = await post(app, headers, "/api/inbox/archive", {
        photoIds: [photo.id],
        archived: true,
      });
      assert.equal(archived.statusCode, 200, archived.body);
      assert.equal(archived.json().sourceCleanup.pending, 1);
      t.mock.restoreAll();
      if (undo)
        db.prepare("UPDATE inbox_photos SET archived_at=NULL WHERE id=?").run(
          photo.id,
        );
      const resumed = await post(app, headers, "/api/inbox/cleanup", {});
      assert.equal(resumed.statusCode, 200, resumed.body);
      assert.equal(resumed.json().sourceCleanup.pending, 0);
      if (undo) assert.deepEqual(await fs.readFile(filename), bytes);
      else await assert.rejects(fs.access(filename), { code: "ENOENT" });
    });
});

test("directory junctions and internal-storage overlaps never expand the cleanup root", async (t) => {
  const { app, db, c, base, bytes, filename, photo } = await deposited(t);
  const { headers } = await login(app, "agent");
  const outside = path.join(base, "outside"),
    retained = path.join(base, "original-folder");
  await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, "portrait.jpg"), bytes);
  await fs.rename(path.dirname(filename), retained);
  await fs.symlink(outside, path.dirname(filename), "junction");
  const archived = await post(app, headers, "/api/inbox/archive", {
    photoIds: [photo.id],
    archived: true,
  });
  assert.equal(archived.statusCode, 200, archived.body);
  assert.equal(archived.json().sourceCleanup.deleted, 0);
  assert.deepEqual(
    await fs.readFile(path.join(outside, "portrait.jpg")),
    bytes,
  );
  assert.deepEqual(
    await fs.readFile(path.join(retained, "portrait.jpg")),
    bytes,
  );
  c.importDir = base;
  const overlap = await post(app, headers, "/api/inbox/cleanup", {});
  assert.match(overlap.json().sourceCleanup.errors[0].error, /séparé/);
});

test("retry finishes a restoration interrupted after creating the source hard link", async (t) => {
  const { app, db, bytes, filename, photo } = await deposited(t);
  const { headers } = await login(app, "agent");
  const unlink = fs.unlink;
  t.mock.method(fs, "unlink", async (file) => {
    if (path.basename(file).startsWith(".anipic-processed-"))
      throw Object.assign(Error("interrupted"), { code: "EIO" });
    return unlink(file);
  });
  await post(app, headers, "/api/inbox/archive", {
    photoIds: [photo.id],
    archived: true,
  });
  db.prepare("UPDATE inbox_photos SET archived_at=NULL WHERE id=?").run(
    photo.id,
  );
  const interrupted = await post(app, headers, "/api/inbox/cleanup", {});
  assert.equal(interrupted.json().sourceCleanup.pending, 1);
  assert.deepEqual(await fs.readFile(filename), bytes);
  t.mock.restoreAll();
  const retry = await post(app, headers, "/api/inbox/cleanup", {});
  assert.equal(retry.json().sourceCleanup.pending, 0);
  assert.deepEqual(await fs.readFile(filename), bytes);
});

test("a writer retaining the original handle cannot lose changes made during final path validation", async (t) => {
  const { app, bytes, filename, photo } = await deposited(t);
  const { headers } = await login(app, "agent");
  const expected = Buffer.from(bytes);
  expected[20] ^= 1;
  const writer = await fs.open(filename, "r+");
  const realpath = fs.realpath,
    rename = fs.rename;
  let captured = false,
    parentChecks = 0;
  t.mock.method(fs, "rename", async (from, to) => {
    const result = await rename(from, to);
    if (from === filename) captured = true;
    return result;
  });
  t.mock.method(fs, "realpath", async (file, ...options) => {
    if (captured && file === path.dirname(filename) && ++parentChecks === 3)
      await writer.write(expected.subarray(20, 21), 0, 1, 20);
    return realpath(file, ...options);
  });
  let archived;
  try {
    archived = await post(app, headers, "/api/inbox/archive", {
      photoIds: [photo.id],
      archived: true,
    });
  } finally {
    await writer.close();
  }
  assert.equal(archived.statusCode, 200, archived.body);
  assert.ok(parentChecks >= 3);
  assert.equal(archived.json().sourceCleanup.deleted, 0);
  assert.deepEqual(await fs.readFile(filename), expected);
});
