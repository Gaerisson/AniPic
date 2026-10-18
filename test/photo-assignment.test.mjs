import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { fixture, login, animal } from "./helpers.mjs";
import { ingest } from "../server/storage.mjs";
import { id, now } from "../server/db.mjs";
import { AssignmentUndoHistory } from "../server/photo-assignment.mjs";
import { isUndoShortcut } from "../shared/undo-shortcut.mjs";
const call = (app, headers, url, payload) =>
  app.inject({ method: "POST", url, headers, payload });
const image = (color) =>
  sharp({ create: { width: 60, height: 80, channels: 3, background: color } })
    .jpeg()
    .toBuffer();
async function photo(
  db,
  c,
  animalId,
  color = "#a14433",
  folder = "Série/Portraits",
) {
  return ingest(
    db,
    c,
    animalId,
    Readable.from(await image(color)),
    "portrait.jpg",
    false,
    null,
    animalId ? null : { folder },
  );
}
const row = (db, pid) => db.prepare("SELECT * FROM photos WHERE id=?").get(pid);

test("a two-photo assignment is public by default and undo restores the exact inbox series and folder hint", async (t) => {
  const { app, db, c } = await fixture(t),
    agent = await login(app, "agent"),
    a = animal(db),
    previous = animal(db, "Autre");
  const p = await photo(db, c, null),
    q = await photo(db, c, null, "#22a688");
  db.prepare("INSERT INTO import_folders VALUES (?,?,?)").run(
    "Série/Portraits",
    previous,
    now(),
  );
  const before = db.prepare("SELECT * FROM inbox_photos ORDER BY id").all();
  const hint = db.prepare("SELECT * FROM import_folders").get();
  const originals = await fs.readdir(c.mediaDir);
  const assigned = await call(app, agent.headers, "/api/inbox/assign", {
    animalId: a,
    photoIds: [p.id, q.id],
    rememberFolder: true,
  });
  assert.equal(assigned.statusCode, 200, assigned.body);
  assert.equal(assigned.json().added, 2);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM photos WHERE hidden=0").get().n,
    2,
  );
  assert.equal(
    (await app.inject({ url: `/api/animals/${a}` })).json().photos.length,
    2,
  );
  const undone = await call(app, agent.headers, "/api/photos/assignment/undo", {
    token: assigned.json().undoToken,
  });
  assert.equal(undone.statusCode, 200, undone.body);
  assert.deepEqual(
    db.prepare("SELECT * FROM inbox_photos ORDER BY id").all(),
    before,
  );
  assert.deepEqual(db.prepare("SELECT * FROM import_folders").get(), hint);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos").get().n, 0);
  assert.equal(
    db.prepare("SELECT cover_id FROM animals WHERE id=?").get(a).cover_id,
    null,
  );
  assert.deepEqual(await fs.readdir(c.mediaDir), originals);
  assert.equal(
    (
      await call(app, agent.headers, "/api/photos/assignment/undo", {
        token: assigned.json().undoToken,
      })
    ).statusCode,
    410,
  );
  const privateBatch = await call(app, agent.headers, "/api/inbox/assign", {
    animalId: a,
    photoIds: [p.id, q.id],
    hidden: true,
  });
  assert.equal(privateBatch.statusCode, 200);
  assert.equal(
    (await app.inject({ url: `/api/animals/${a}` })).json().photos.length,
    0,
  );
});

test("undo of a duplicate keeps the existing photo, its privacy and cover, and restores only the inbox entry", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    a = animal(db);
  const existing = await photo(db, c, a);
  db.prepare("UPDATE photos SET hidden=1,caption='À conserver' WHERE id=?").run(
    existing.id,
  );
  db.prepare("UPDATE animals SET cover_id=? WHERE id=?").run(existing.id, a);
  const before = row(db, existing.id),
    incoming = await photo(db, c, null);
  const assigned = await call(app, admin.headers, "/api/inbox/assign", {
    animalId: a,
    photoIds: [incoming.id],
  });
  assert.equal(assigned.json().duplicates, 1);
  assert.equal(
    (
      await call(app, admin.headers, "/api/photos/assignment/undo", {
        token: assigned.json().undoToken,
      })
    ).statusCode,
    200,
  );
  assert.deepEqual(row(db, existing.id), before);
  assert.equal(
    db.prepare("SELECT cover_id FROM animals WHERE id=?").get(a).cover_id,
    existing.id,
  );
  assert.ok(
    db.prepare("SELECT id FROM inbox_photos WHERE id=?").get(incoming.id),
  );
});

test("reassign preserves photo identity, bytes, privacy, comments/tags/collections and repairs covers, with successive undo", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    a = animal(db, "Mauvais"),
    b = animal(db, "Bon"),
    d = animal(db, "Troisième");
  const p = await photo(db, c, a),
    q = await photo(db, c, a, "#2299a4"),
    leftover = await photo(db, c, a, "#ffcc22");
  db.prepare(
    "UPDATE photos SET hidden=1,caption='Portrait privé' WHERE id=?",
  ).run(p.id);
  db.prepare("UPDATE animals SET cover_id=? WHERE id=?").run(p.id, a);
  db.prepare("INSERT INTO photo_comments VALUES (?,?,?,?,NULL,NULL,0,?,?)").run(
    id(),
    p.id,
    admin.user.id,
    "Garder ce portrait",
    now(),
    now(),
  );
  db.prepare("INSERT INTO media_tags VALUES ('photo',?,'Noël')").run(p.id);
  const collection = id();
  db.prepare(
    "INSERT INTO collections(id,name,created_at) VALUES (?,'Sélection',?)",
  ).run(collection, now());
  db.prepare("INSERT INTO collection_photos VALUES (?,?)").run(
    collection,
    p.id,
  );
  const before = [row(db, p.id), row(db, q.id)],
    bytes = await fs.readFile(path.join(c.mediaDir, before[0].hash));
  const moved = await call(app, admin.headers, "/api/photos/reassign", {
    sourceAnimalId: a,
    animalId: b,
    photoIds: [p.id, q.id],
  });
  assert.equal(moved.statusCode, 200, moved.body);
  assert.equal(moved.json().moved, 2);
  for (const original of before)
    assert.deepEqual(
      { ...row(db, original.id) },
      { ...original, animal_id: b },
    );
  assert.equal(
    db.prepare("SELECT cover_id FROM animals WHERE id=?").get(a).cover_id,
    leftover.id,
  );
  assert.equal(
    db
      .prepare("SELECT COUNT(*) n FROM photo_comments WHERE photo_id=?")
      .get(p.id).n,
    1,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM media_tags WHERE media_id=?").get(p.id)
      .n,
    1,
  );
  assert.equal(
    db
      .prepare("SELECT COUNT(*) n FROM collection_photos WHERE photo_id=?")
      .get(p.id).n,
    1,
  );
  assert.deepEqual(
    await fs.readFile(path.join(c.mediaDir, before[0].hash)),
    bytes,
  );
  const next = await call(app, admin.headers, "/api/photos/reassign", {
    sourceAnimalId: b,
    animalId: d,
    photoIds: [p.id, q.id],
  });
  assert.equal(next.statusCode, 200);
  for (const result of [next, moved])
    assert.equal(
      (
        await call(app, admin.headers, "/api/photos/assignment/undo", {
          token: result.json().undoToken,
        })
      ).statusCode,
      200,
    );
  assert.deepEqual([row(db, p.id), row(db, q.id)], before);
  assert.equal(
    db.prepare("SELECT cover_id FROM animals WHERE id=?").get(a).cover_id,
    p.id,
  );
  assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
});

test("a conflicting selection never moves partly; undo refuses later photo edits or new references", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    a = animal(db),
    b = animal(db, "Autre");
  const p = await photo(db, c, a),
    q = await photo(db, c, a, "#22aa44");
  await photo(db, c, b);
  const request = { sourceAnimalId: a, animalId: b, photoIds: [q.id, p.id] };
  assert.equal(
    (await call(app, admin.headers, "/api/photos/reassign", request))
      .statusCode,
    409,
  );
  assert.equal(row(db, q.id).animal_id, a);
  assert.equal(
    (
      await call(app, admin.headers, "/api/photos/reassign", {
        ...request,
        photoIds: [q.id, id()],
      })
    ).statusCode,
    409,
  );
  const moved = await call(app, admin.headers, "/api/photos/reassign", {
    ...request,
    photoIds: [q.id],
  });
  db.prepare(
    "UPDATE photos SET caption='Modification de collègue' WHERE id=?",
  ).run(q.id);
  assert.equal(
    (
      await call(app, admin.headers, "/api/photos/assignment/undo", {
        token: moved.json().undoToken,
      })
    ).statusCode,
    409,
  );
  assert.equal(row(db, q.id).caption, "Modification de collègue");
  const inbox = await photo(db, c, null, "#aa33cc");
  const assigned = await call(app, admin.headers, "/api/inbox/assign", {
    photoIds: [inbox.id],
    animalId: a,
  });
  const latest = db
    .prepare("SELECT id FROM photos WHERE animal_id=? AND id NOT IN (?,?)")
    .get(a, p.id, q.id);
  db.prepare("INSERT INTO photo_likes VALUES (?,?,?)").run(
    admin.user.id,
    latest.id,
    now(),
  );
  assert.equal(
    (
      await call(app, admin.headers, "/api/photos/assignment/undo", {
        token: assigned.json().undoToken,
      })
    ).statusCode,
    409,
  );
  assert.ok(row(db, latest.id));
});

test("assignment endpoints enforce session, role, CSRF, ownership, valid targets and source ownership", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    agent = await login(app, "agent"),
    viewer = await login(app, "viewer"),
    volunteer = await login(app, "volunteer");
  const a = animal(db),
    b = animal(db, "Cible"),
    p = await photo(db, c, a);
  const payload = { sourceAnimalId: a, animalId: b, photoIds: [p.id] };
  for (const [headers, status] of [
    [{}, 401],
    [viewer.headers, 403],
    [volunteer.headers, 403],
    [{ ...admin.headers, "x-csrf-token": "wrong" }, 403],
    [{ ...admin.headers, origin: "https://other.example" }, 403],
  ]) {
    assert.equal(
      (await call(app, headers, "/api/photos/reassign", payload)).statusCode,
      status,
    );
  }
  assert.equal(
    (
      await call(app, admin.headers, "/api/photos/reassign", {
        ...payload,
        photoIds: [p.id, p.id],
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await call(app, admin.headers, "/api/photos/reassign", {
        ...payload,
        sourceAnimalId: b,
      })
    ).statusCode,
    400,
  );
  db.prepare("UPDATE animals SET archived_at=? WHERE id=?").run(now(), b);
  assert.equal(
    (await call(app, admin.headers, "/api/photos/reassign", payload))
      .statusCode,
    404,
  );
  db.prepare("UPDATE animals SET archived_at=NULL WHERE id=?").run(b);
  const moved = await call(app, admin.headers, "/api/photos/reassign", payload);
  assert.equal(moved.statusCode, 200);
  assert.equal(
    (
      await call(app, agent.headers, "/api/photos/assignment/undo", {
        token: moved.json().undoToken,
      })
    ).statusCode,
    410,
  );
  assert.equal(
    (
      await call(app, admin.headers, "/api/photos/assignment/undo", {
        token: moved.json().undoToken,
      })
    ).statusCode,
    200,
  );
});

test("undo preserves a newer cover and rejects a duplicate in the destination trash without partially moving a lot", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    a = animal(db),
    b = animal(db, "Autre");
  const p = await photo(db, c, a),
    q = await photo(db, c, a, "#e4ad34"),
    chosenCover = await photo(db, c, a, "#44bca1");
  db.prepare("UPDATE animals SET cover_id=? WHERE id=?").run(p.id, a);
  const moved = await call(app, admin.headers, "/api/photos/reassign", {
    sourceAnimalId: a,
    animalId: b,
    photoIds: [p.id],
  });
  assert.equal(moved.statusCode, 200);
  const automaticCover = db
    .prepare("SELECT cover_id FROM animals WHERE id=?")
    .get(a).cover_id;
  const deliberateCover =
    automaticCover === chosenCover.id ? q.id : chosenCover.id;
  db.prepare("UPDATE animals SET cover_id=? WHERE id=?").run(
    deliberateCover,
    a,
  );
  assert.equal(
    (
      await call(app, admin.headers, "/api/photos/assignment/undo", {
        token: moved.json().undoToken,
      })
    ).statusCode,
    200,
  );
  assert.equal(
    db.prepare("SELECT cover_id FROM animals WHERE id=?").get(a).cover_id,
    deliberateCover,
  );
  const duplicate = await photo(db, c, b);
  db.prepare("UPDATE photos SET deleted_at=? WHERE id=?").run(
    now(),
    duplicate.id,
  );
  const blocked = await call(app, admin.headers, "/api/photos/reassign", {
    sourceAnimalId: a,
    animalId: b,
    photoIds: [q.id, p.id],
  });
  assert.equal(blocked.statusCode, 409, blocked.body);
  assert.equal(row(db, q.id).animal_id, a);
  assert.equal(row(db, p.id).animal_id, a);
  assert.ok(row(db, duplicate.id).deleted_at);
});

test("undo history expires and is bounded; keyboard undo respects text inputs and works from selection checkboxes", () => {
  let time = 0;
  const history = new AssignmentUndoHistory({
    clock: () => time,
    ttl: 1000,
    maxEntries: 2,
  });
  const first = history.put("owner", { value: 1 }),
    second = history.put("owner", { value: 2 });
  const third = history.put("owner", { value: 3 });
  assert.throws(() => history.get(first.undoToken, "owner"), {
    statusCode: 410,
  });
  assert.throws(() => history.get(second.undoToken, "another"), {
    statusCode: 410,
  });
  assert.deepEqual(history.get(third.undoToken, "owner"), { value: 3 });
  time = 1001;
  assert.throws(() => history.get(third.undoToken, "owner"), {
    statusCode: 410,
  });
  const event = { key: "z", ctrlKey: true };
  const field = (type, tagName = "INPUT") => ({
    closest: () => ({ tagName, type }),
  });
  assert.equal(isUndoShortcut({ ...event, target: field("checkbox") }), true);
  assert.equal(isUndoShortcut({ ...event, target: field("text") }), false);
  assert.equal(isUndoShortcut({ ...event, target: field("search") }), false);
  assert.equal(
    isUndoShortcut({ ...event, target: field("", "TEXTAREA") }),
    false,
  );
  assert.equal(isUndoShortcut({ ...event, defaultPrevented: true }), false);
  assert.equal(isUndoShortcut({ ...event, repeat: true }), false);
  assert.equal(isUndoShortcut({ key: "Z", metaKey: true }), true);
});
