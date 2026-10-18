import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, login, animal } from "./helpers.mjs";
import { settings, saveSettings, transaction } from "../server/db.mjs";
import { applySnapshot, normalizeSnapshot } from "../server/source.mjs";
import {
  inferAdoption,
  settleDueAdoptions,
  automaticAdoption,
  pendingAdoptionCount,
} from "../server/source-adoption.mjs";
import { savePresence } from "../server/source-presence.mjs";
import sharp from "sharp";
import { Readable } from "node:stream";
import { ingest } from "../server/storage.mjs";

const cfg = {
  sourceMode: "spa",
  sourceScope: "spa:moree",
  archiveMissing: true,
  sourceMissingOutcome: "after24h",
  sourceStaleHours: 24,
  missingThreshold: 2,
  sourceAbsenceIntervalHours: 0.25,
  sourceMaxDropPercent: 100,
};
const count = (db) =>
  db
    .prepare(
      "SELECT COUNT(*) n FROM animal_status_events WHERE status='adopted'",
    )
    .get().n;
function deferred(db, policy = "after24h") {
  saveSettings(db, { ...cfg, sourceMissingOutcome: policy });
  const id = animal(db),
    at = new Date(Date.now() - 25 * 3600000).toISOString();
  db.prepare("UPDATE animals SET source_scope='spa:moree' WHERE id=?").run(id);
  const a = db.prepare("SELECT * FROM animals WHERE id=?").get(id);
  inferAdoption(
    db,
    a,
    { scope: "spa:moree", fetchedAt: at },
    settings(db),
    at,
    2,
  );
  db.prepare(
    "UPDATE animals SET status=?,archived_at=?,departed_at=? WHERE id=?",
  ).run(policy === "after24h" ? "source_missing" : "adopted", at, at, id);
  return { id, at, a, review: automaticAdoption(db, id) };
}
function inventory(db, ids = [], at = Date.now()) {
  const snap = {
    scope: "spa:moree",
    complete: true,
    animals: ids.map((sourceId) => ({ sourceId })),
    fetchedAt: new Date(at).toISOString(),
  };
  savePresence(db, snap, new Date(at).toISOString());
  return snap;
}
test("24 h mode defers statistics and requires a fresh safe inventory after deadline; outages do not confirm", async (t) => {
  const { db } = await fixture(t),
    p = deferred(db),
    clock = Date.now();
  assert.equal(count(db), 0);
  assert.equal(pendingAdoptionCount(db), 1);
  assert.equal(
    transaction(db, () => settleDueAdoptions(db, settings(db), clock)),
    0,
  );
  inventory(db, [], clock - 2 * 3600000);
  assert.equal(
    transaction(db, () => settleDueAdoptions(db, settings(db), clock)),
    0,
  );
  inventory(db, [p.a.source_id], clock - 1000);
  assert.equal(
    transaction(db, () => settleDueAdoptions(db, settings(db), clock)),
    0,
  );
  inventory(db, [], clock);
  assert.equal(
    transaction(db, () => settleDueAdoptions(db, settings(db), clock)),
    1,
  );
  assert.equal(count(db), 1);
  assert.equal(pendingAdoptionCount(db), 0);
  assert.equal(automaticAdoption(db, p.id).review.by, "automatic");
  assert.equal(
    transaction(db, () => settleDueAdoptions(db, settings(db), clock)),
    0,
  );
  assert.equal(count(db), 1);
});
test("agents reject, restore and cancel automatic decisions without duplicate counts, with revision conflicts and persistent refusal", async (t) => {
  const { db, app } = await fixture(t),
    p = deferred(db),
    auth = await login(app, "agent");
  const call = (action, review) =>
    app.inject({
      method: "POST",
      url: `/api/adoption-reviews/${p.id}/${action}`,
      headers: auth.headers,
      payload: { expectedAt: p.at, expectedRevision: review.revision },
    });
  let r = await call("reject", p.review);
  assert.equal(r.statusCode, 200);
  assert.equal(pendingAdoptionCount(db), 0);
  assert.equal(count(db), 0);
  inventory(db);
  assert.equal(
    transaction(db, () => settleDueAdoptions(db, settings(db))),
    0,
  );
  const refused = automaticAdoption(db, p.id);
  assert.equal((await call("reject", p.review)).statusCode, 200); // retry of same decision
  assert.equal((await call("confirm", p.review)).statusCode, 409);
  assert.equal((await call("confirm", refused)).statusCode, 200);
  assert.equal(count(db), 1);
  const confirmed = automaticAdoption(db, p.id);
  assert.equal((await call("confirm", refused)).statusCode, 200);
  assert.equal(count(db), 1);
  assert.equal((await call("reject", confirmed)).statusCode, 200);
  assert.equal(count(db), 0);
  // Subsequent absence inventories must preserve a refusal rather than restarting 24 h.
  const snapshot = normalizeSnapshot({
    schemaVersion: 1,
    scope: "spa:moree",
    complete: true,
    expectedCount: 1,
    fetchedAt: new Date(Date.now() + 100).toISOString(),
    animals: [
      {
        sourceId: "spa:other",
        name: "Autre",
        species: "cat",
        status: "available",
      },
    ],
  });
  applySnapshot(db, snapshot);
  assert.equal(automaticAdoption(db, p.id).review.decision, "rejected");
  assert.equal(count(db), 0);
  const history = (
    await app.inject({
      url: "/api/adoption-reviews?state=all",
      headers: auth.headers,
    })
  ).json();
  assert.equal(
    history.items.find((x) => x.id === p.id).adoption_review.state,
    "rejected",
  );
  const publicAnimal = (
    await app.inject({ url: `/api/animals/${p.id}` })
  ).json();
  assert.equal(publicAnimal.adoption_review, undefined);
  assert.equal(
    JSON.stringify(publicAnimal.adoption_origin).includes(auth.user.id),
    false,
  );
});
test("immediate confirmation remains cancellable and never gets re-applied while absent; a source return clears the hold", async (t) => {
  const { db, app } = await fixture(t),
    p = deferred(db, "automatic"),
    auth = await login(app, "agent");
  assert.equal(count(db), 1);
  assert.equal(pendingAdoptionCount(db), 0);
  assert.equal(automaticAdoption(db, p.id).review.by, "automatic");
  const denied = await app.inject({
    method: "POST",
    url: `/api/adoption-reviews/${p.id}/reject`,
    headers: { cookie: auth.headers.cookie, origin: auth.headers.origin },
    payload: { expectedAt: p.at, expectedRevision: p.review.revision },
  });
  assert.equal(denied.statusCode, 403);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: `/api/adoption-reviews/${p.id}/reject`,
        headers: auth.headers,
        payload: { expectedAt: p.at, expectedRevision: p.review.revision },
      })
    ).statusCode,
    200,
  );
  assert.equal(count(db), 0);
  inventory(db);
  transaction(db, () => settleDueAdoptions(db, settings(db)));
  assert.equal(count(db), 0);
  applySnapshot(
    db,
    normalizeSnapshot({
      schemaVersion: 1,
      scope: "spa:moree",
      complete: true,
      expectedCount: 1,
      fetchedAt: new Date().toISOString(),
      animals: [
        {
          sourceId: p.a.source_id,
          name: p.a.name,
          species: "dog",
          status: "available",
        },
      ],
    }),
  );
  assert.equal(automaticAdoption(db, p.id), null);
  assert.equal(
    db.prepare("SELECT archived_at FROM animals WHERE id=?").get(p.id)
      .archived_at,
    null,
  );
  assert.equal(count(db), 0);
});
test("pending deadline is retained across syncs; partial/old inventories, disabled policy and wrong scope cannot settle", async (t) => {
  const { db } = await fixture(t),
    p = deferred(db),
    old = automaticAdoption(db, p.id);
  const snapshot = normalizeSnapshot({
    schemaVersion: 1,
    scope: "spa:moree",
    complete: true,
    expectedCount: 1,
    fetchedAt: new Date().toISOString(),
    animals: [
      {
        sourceId: "spa:other",
        name: "Autre",
        species: "cat",
        status: "available",
      },
    ],
  });
  // No safe inventory beyond deadline => no automatic confirmation, even if timer runs much later.
  inventory(db, [], Date.now() - 26 * 3600000);
  assert.equal(
    transaction(db, () => settleDueAdoptions(db, settings(db))),
    0,
  );
  savePresence(db, { ...snapshot, complete: false }, new Date().toISOString());
  assert.equal(
    transaction(db, () => settleDueAdoptions(db, settings(db))),
    0,
  );
  inventory(db);
  for (const override of [
    { archiveMissing: false },
    { sourceMode: "disabled" },
    { sourceMissingOutcome: "unconfirmed" },
    { sourceScope: "other" },
  ])
    assert.equal(
      transaction(db, () =>
        settleDueAdoptions(db, { ...settings(db), ...override }),
      ),
      0,
    );
  assert.equal(automaticAdoption(db, p.id).reviewDueAt, old.reviewDueAt);
});
test("home coverage counts present animals per species and local visible photos, excluding archives, trash and SPA-only references", async (t) => {
  const { db, app, c } = await fixture(t),
    a = animal(db, "Portrait"),
    b = animal(db, "SPA seulement"),
    archived = animal(db, "Archive"),
    missing = animal(db, "Absent"),
    trash = animal(db, "Corbeille"),
    privateId = animal(db, "Privé");
  db.prepare(
    "UPDATE animals SET species='cat',source_metadata=? WHERE id=?",
  ).run(JSON.stringify({ thumbnail: "https://www.la-spa.fr/photo.jpg" }), b);
  db.prepare("UPDATE animals SET archived_at=? WHERE id=?").run(
    new Date().toISOString(),
    archived,
  );
  db.prepare("UPDATE animals SET source_scope='spa:moree' WHERE id=?").run(
    missing,
  );
  inventory(db, []);
  db.prepare("INSERT INTO settings VALUES (?,?)").run(
    "animalTrash:" + trash,
    "{}",
  );
  const buffer = await sharp({
    create: { width: 30, height: 40, channels: 3, background: "orange" },
  })
    .jpeg()
    .toBuffer();
  await ingest(db, c, a, Readable.from(buffer), "local.jpg", false);
  await ingest(db, c, privateId, Readable.from(buffer), "private.jpg", true);
  let data = (await app.inject({ url: "/api/overview" })).json().stats
    .photoCoverage;
  assert.deepEqual(
    data.find((x) => x.species === "dog"),
    { species: "dog", total: 2, photographed: 1, remaining: 1, percent: 50 },
  );
  assert.deepEqual(
    data.find((x) => x.species === "cat"),
    { species: "cat", total: 1, photographed: 0, remaining: 1, percent: 0 },
  );
  assert.equal(data.find((x) => x.species === "other").total, 0);
  const auth = await login(app, "agent");
  data = (
    await app.inject({ url: "/api/overview", headers: auth.headers })
  ).json().stats.photoCoverage;
  assert.equal(data.find((x) => x.species === "dog").photographed, 2);
});
