import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import sharp from "sharp";
import { fixture, login } from "./helpers.mjs";
import { applySnapshot, normalizeSnapshot } from "../server/source.mjs";
import { guardInventory, collectorConfig } from "../server/source-collect.mjs";
import { saveSettings, settings } from "../server/db.mjs";
import { adoptionOrigin } from "../server/source-adoption.mjs";
import { ingest } from "../server/storage.mjs";
import { gazetteMonth } from "../server/gazette-data.mjs";

function scenario(db) {
  let time = Date.now() - 10000;
  const snapshot = (ids = ["one"], overrides = {}) =>
    normalizeSnapshot({
      schemaVersion: 1,
      scope: "spa:moree",
      complete: true,
      expectedCount: ids.length,
      fetchedAt: new Date((time += 10)).toISOString(),
      animals: ids.map((id) => ({
        sourceId: "spa:" + id,
        name: id,
        species: "cat",
        status: "available",
      })),
      ...overrides,
    });
  const age = () => {
    const value = JSON.parse(
      db
        .prepare("SELECT value FROM settings WHERE key='complete:spa:moree'")
        .get().value,
    );
    value.at = new Date(Date.now() - 48 * 3600000).toISOString();
    db.prepare(
      "UPDATE settings SET value=? WHERE key='complete:spa:moree'",
    ).run(JSON.stringify(value));
  };
  const apply = (s) =>
    applySnapshot(db, guardInventory(db, s, collectorConfig(settings(db))));
  const adopted = () =>
    db
      .prepare("SELECT * FROM animal_status_events WHERE status='adopted'")
      .all();
  return { snapshot, age, apply, adopted };
}
const auto = {
  sourceMode: "spa",
  archiveMissing: true,
  sourceMissingOutcome: "adopted",
  missingThreshold: 2,
  sourceAbsenceIntervalHours: 24,
  sourceMaxDropPercent: 100,
};

test("automatic adoption is opt-in, confirms two spaced safe absences, preserves photos, and exposes provenance in API/CSV/gazette", async (t) => {
  const { app, db, c } = await fixture(t),
    s = scenario(db);
  assert.equal(settings(db).sourceMissingOutcome, "unconfirmed");
  saveSettings(db, auto);
  s.apply(s.snapshot(["one", "two"]));
  const a = db.prepare("SELECT * FROM animals WHERE source_id='spa:two'").get();
  const bytes = await sharp({
    create: { width: 40, height: 50, channels: 3, background: "orange" },
  })
    .jpeg()
    .toBuffer();
  await ingest(db, c, a.id, Readable.from(bytes), "portrait.jpg", true);
  const photos = db.prepare("SELECT * FROM photos").all(),
    blobs = db.prepare("SELECT * FROM blobs").all();
  s.age();
  assert.equal(s.apply(s.snapshot()).autoAdopted, 0);
  assert.equal(s.apply(s.snapshot()).absenceCheck, false);
  assert.equal(s.adopted().length, 0);
  s.age();
  const result = s.apply(s.snapshot());
  assert.equal(result.autoAdopted, 1);
  assert.equal(result.archived, 1);
  assert.equal(result.missingFromSource, 0);
  const updated = db.prepare("SELECT * FROM animals WHERE id=?").get(a.id);
  assert.equal(updated.status, "adopted");
  assert.ok(updated.archived_at && updated.departed_at);
  assert.equal(updated.missing_count, 2);
  assert.equal(s.adopted().length, 1);
  assert.equal(adoptionOrigin(db, a.id).kind, "automatic_absence");
  assert.equal(adoptionOrigin(db, a.id).confirmations, 2);
  assert.deepEqual(db.prepare("SELECT * FROM photos").all(), photos);
  assert.deepEqual(db.prepare("SELECT * FROM blobs").all(), blobs);
  s.age();
  s.apply(s.snapshot());
  assert.equal(s.adopted().length, 1);
  const view = (await app.inject({ url: "/api/animals/" + a.id })).json();
  assert.equal(view.adoption_origin.kind, "automatic_absence");
  assert.equal(view.photos.length, 0); // original privacy preserved
  const auth = await login(app);
  const csv = await app.inject({
    url: "/api/animals?archive=1&presence=all&format=csv",
    headers: auth.headers,
  });
  assert.equal(csv.statusCode, 200);
  assert.match(csv.body, /Règle automatique d’absence AniPic/);
  const gazette = gazetteMonth(db, resultDate());
  assert.equal(gazette.adopted.length, 1);
  assert.equal(gazette.adopted[0].adoption_origin.kind, "automatic_absence");
  const health = (
    await app.inject({ url: "/api/source/health", headers: auth.headers })
  ).json();
  assert.equal(health.canInferAdoption, true);
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) n FROM audit WHERE action='source_adoption_automatic'",
      )
      .get().n,
    1,
  );
});
function resultDate() {
  return new Date().toISOString().slice(0, 7);
}

test("partial, stale, filtered and suspicious inventories never trigger the automatic adoption rule; default archive does not infer adoption", async (t) => {
  const { db } = await fixture(t),
    s = scenario(db);
  saveSettings(db, auto);
  s.apply(s.snapshot(["one", "two"]));
  s.age();
  const partial = s.snapshot(["one"], { complete: false });
  assert.equal(s.apply(partial).absenceCheck, false);
  const stale = {
    ...s.snapshot(),
    fetchedAt: new Date(Date.now() - 48 * 3600000).toISOString(),
  };
  assert.throws(() => s.apply(stale), /plus ancien/);
  saveSettings(db, { sourceSpecies: ["cat"] });
  assert.equal(s.apply(s.snapshot()).absenceCheck, false);
  saveSettings(db, {
    sourceSpecies: ["dog", "cat", "other"],
    sourceMaxDropPercent: 20,
  });
  assert.equal(s.apply(s.snapshot()).absenceCheck, false);
  assert.equal(s.adopted().length, 0);
  assert.equal(
    db
      .prepare("SELECT missing_count FROM animals WHERE source_id='spa:two'")
      .get().missing_count,
    0,
  );
  saveSettings(db, {
    sourceMaxDropPercent: 100,
    sourceMissingOutcome: "unconfirmed",
  });
  s.age();
  s.apply(s.snapshot());
  s.age();
  s.apply(s.snapshot());
  assert.equal(
    db.prepare("SELECT status FROM animals WHERE source_id='spa:two'").get()
      .status,
    "source_missing",
  );
  assert.equal(s.adopted().length, 0);
  // Enabling automatic adoption also covers an already confirmed source-missing archive.
  saveSettings(db, { sourceMissingOutcome: "adopted" });
  s.age();
  assert.equal(s.apply(s.snapshot()).autoAdopted, 1);
});

test("a returned animal reverses only its inferred adoption; explicit source adoption confirms it without double counting", async (t) => {
  const { db } = await fixture(t),
    s = scenario(db);
  saveSettings(db, auto);
  s.apply(s.snapshot(["one", "two", "three"]));
  s.age();
  s.apply(s.snapshot());
  s.age();
  s.apply(s.snapshot());
  assert.equal(s.adopted().length, 2);
  const two = db
    .prepare("SELECT * FROM animals WHERE source_id='spa:two'")
    .get();
  const three = db
    .prepare("SELECT * FROM animals WHERE source_id='spa:three'")
    .get();
  // An independent historic observation must survive the correction.
  db.prepare(
    "INSERT INTO animal_status_events VALUES ('independent',?,'adopted','2020-01-01')",
  ).run(two.id);
  const returned = s.snapshot(["one", "two", "three"], { complete: false });
  returned.animals.find((a) => a.sourceId === "spa:two").status = "reserved";
  returned.animals.find((a) => a.sourceId === "spa:three").status = "adopted";
  assert.equal(s.apply(returned).autoAdoptionsReversed, 1);
  const active = db.prepare("SELECT * FROM animals WHERE id=?").get(two.id);
  assert.equal(active.status, "reserved");
  assert.equal(active.archived_at, null);
  assert.equal(active.departed_at, null);
  assert.equal(adoptionOrigin(db, two.id), null);
  assert.equal(adoptionOrigin(db, three.id), null);
  assert.equal(
    db
      .prepare("SELECT status,archived_at FROM animals WHERE id=?")
      .get(three.id).status,
    "adopted",
  );
  assert.ok(
    db.prepare("SELECT archived_at FROM animals WHERE id=?").get(three.id)
      .archived_at,
  );
  assert.equal(s.adopted().length, 2); // independent event + confirmed third animal
  assert.ok(
    db
      .prepare("SELECT 1 FROM animal_status_events WHERE id='independent'")
      .get(),
  );
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) n FROM audit WHERE action='source_adoption_reversed'",
      )
      .get().n,
    1,
  );
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) n FROM audit WHERE action='source_adoption_confirmed'",
      )
      .get().n,
    1,
  );
});

test("manual archives and trashed fiches are not auto-adopted; only administrators can change the mode", async (t) => {
  const { app, db } = await fixture(t),
    s = scenario(db);
  saveSettings(db, auto);
  s.apply(s.snapshot(["one", "two", "three"]));
  const a = db
    .prepare("SELECT id FROM animals WHERE source_id='spa:two'")
    .get().id;
  const b = db
    .prepare("SELECT id FROM animals WHERE source_id='spa:three'")
    .get().id;
  db.prepare("UPDATE animals SET archived_at=? WHERE id=?").run(
    new Date().toISOString(),
    a,
  );
  db.prepare(
    "UPDATE animals SET archived_at=?,status='source_missing' WHERE id=?",
  ).run(new Date().toISOString(), b);
  saveSettings(db, { ["animalTrash:" + b]: { at: new Date().toISOString() } });
  s.age();
  s.apply(s.snapshot());
  s.age();
  s.apply(s.snapshot());
  assert.equal(s.adopted().length, 0);
  const admin = await login(app),
    agent = await login(app, "agent");
  const request = (headers) =>
    app.inject({
      method: "PUT",
      url: "/api/admin/settings",
      headers,
      payload: { sourceMissingOutcome: "adopted", archiveMissing: true },
    });
  assert.equal((await request(agent.headers)).statusCode, 403);
  assert.equal((await request(admin.headers)).statusCode, 200);
  assert.equal(settings(db).sourceMissingOutcome, "adopted");
  const bad = await app.inject({
    method: "PUT",
    url: "/api/admin/settings",
    headers: admin.headers,
    payload: { sourceMissingOutcome: "invalid" },
  });
  assert.equal(bad.statusCode, 400);
});
