import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import sharp from "sharp";
import { fixture, login, animal } from "./helpers.mjs";
import { normalizeSnapshot, applySnapshot } from "../server/source.mjs";
import { guardInventory, collectorConfig } from "../server/source-collect.mjs";
import { diagnoseSource } from "../server/source-diagnostics.mjs";
import { saveSettings } from "../server/db.mjs";
import { ingest } from "../server/storage.mjs";
import { animalCsv } from "../shared/animal-csv.mjs";
const snap = (names, stamp, complete = true) =>
  normalizeSnapshot({
    schemaVersion: 1,
    scope: "spa:moree",
    fetchedAt: stamp,
    complete,
    expectedCount: names.length,
    animals: names.map(([sourceId, name]) => ({
      sourceId,
      name,
      species: "cat",
      status: "available",
    })),
  });
test("safe source presence updates immediately between 24-hour archive confirmations; diagnostic is read-only and missing never means adopted", async (t) => {
  const { app, db } = await fixture(t);
  saveSettings(db, { archiveMissing: false });
  const initial = snap(
    [
      ["spa:250747", "O’MALLEY"],
      ["spa:247356", "DELTA"],
      ["spa:other", "Présent"],
    ],
    new Date(Date.now() - 3000).toISOString(),
  );
  applySnapshot(db, initial);
  const next = snap(
    [["spa:other", "Présent"]],
    new Date(Date.now() - 1000).toISOString(),
  );
  const cfg = collectorConfig({ sourceMaxDropPercent: 100 });
  const checked = guardInventory(db, next, cfg);
  const before = db.prepare("SELECT * FROM animals ORDER BY id").all();
  const report = await diagnoseSource(
    db,
    {
      sourceMode: "json",
      sourceUrl: "https://www.la-spa.fr/fixture.json",
      sourceMaxDropPercent: 100,
      sourceAttempts: 2,
    },
    {
      checkRobots: async () => {},
      delay: async () => {},
      fetchText: async () => JSON.stringify(next),
    },
  );
  assert.equal(report.applied, false);
  assert.equal(report.status, "complete");
  assert.deepEqual(
    report.reconciliation.missing.map((a) => a.sourceId).sort(),
    ["spa:247356", "spa:250747"],
  );
  assert.deepEqual(
    db.prepare("SELECT * FROM animals ORDER BY id").all(),
    before,
  );
  const result = applySnapshot(db, checked);
  assert.equal(result.absenceCheck, false);
  assert.equal(result.missingFromSource, 2);
  assert.equal((await app.inject({ url: "/api/animals" })).json().total, 1);
  const missing = (
    await app.inject({ url: "/api/animals?presence=missing" })
  ).json();
  assert.equal(missing.total, 2);
  assert.equal(missing.sourceMissingTotal, 2);
  assert.ok(
    missing.items.every(
      (a) =>
        a.status === "available" &&
        !a.archived_at &&
        a.source_presence.state === "missing",
    ),
  );
  assert.equal(
    (await app.inject({ url: "/api/animals?presence=all" })).json().total,
    3,
  );
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) n FROM animal_status_events WHERE status='adopted'",
      )
      .get().n,
    0,
  );
  const beforePresence = db
    .prepare("SELECT value FROM settings WHERE key='sourcePresence:spa:moree'")
    .get().value;
  applySnapshot(db, {
    ...next,
    complete: false,
    animals: [next.animals[0]],
    fetchedAt: new Date().toISOString(),
  });
  assert.equal(
    db
      .prepare(
        "SELECT value FROM settings WHERE key='sourcePresence:spa:moree'",
      )
      .get().value,
    beforePresence,
  );
  assert.throws(
    () =>
      applySnapshot(db, {
        ...initial,
        fetchedAt: new Date(Date.now() - 48 * 3600000).toISOString(),
      }),
    /plus ancien/,
  );
  assert.equal(
    db
      .prepare(
        "SELECT value FROM settings WHERE key='sourcePresence:spa:moree'",
      )
      .get().value,
    beforePresence,
  );
  // A partial list may positively verify a returned animal, never infer another absence.
  await new Promise((r) => setTimeout(r, 3));
  applySnapshot(
    db,
    snap([["spa:250747", "O’MALLEY"]], new Date().toISOString(), false),
  );
  const all = (await app.inject({ url: "/api/animals?presence=all" })).json();
  assert.equal(
    all.items.find((a) => a.source_id === "spa:250747").source_presence.state,
    "present",
  );
  assert.equal(
    all.items.find((a) => a.source_id === "spa:247356").source_presence.state,
    "missing",
  );
});
test("an unchanged source sync preserves the real last modification date", async (t) => {
  const { db } = await fixture(t),
    s = snap([["spa:one", "Stable"]], new Date().toISOString());
  applySnapshot(db, s);
  db.prepare("UPDATE animals SET updated_at='2020-01-01T00:00:00.000Z'").run();
  const r = applySnapshot(db, s);
  assert.equal(r.changed, 0);
  assert.equal(
    db.prepare("SELECT updated_at FROM animals").get().updated_at,
    "2020-01-01T00:00:00.000Z",
  );
});
async function photo(db, c, a, date, hidden = false, color = "#e28731") {
  const image = await sharp({
    create: { width: 40, height: 50, channels: 3, background: color },
  })
    .jpeg()
    .toBuffer();
  const p = await ingest(
    db,
    c,
    a,
    Readable.from(image),
    "portrait.jpg",
    hidden,
  );
  db.prepare("UPDATE photos SET created_at=? WHERE id=?").run(date, p.id);
  return p;
}
test("recent and oldest sort by the latest visible local series; SPA metadata, private/deleted/archived photos do not reorder anonymous results", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    a = animal(db, "Ancien"),
    b = animal(db, "Récent"),
    privateId = animal(db, "Privé"),
    spa = animal(db, "SPA seule"),
    deleted = animal(db, "Supprimée"),
    archived = animal(db, "Photo archivée");
  await photo(db, c, a, "2022-01-01T00:00:00.000Z");
  await photo(db, c, b, "2025-01-01T00:00:00.000Z");
  await photo(db, c, privateId, "2030-01-01T00:00:00.000Z", true);
  const p = await photo(db, c, deleted, "2031-01-01T00:00:00.000Z");
  db.prepare("UPDATE photos SET deleted_at=? WHERE id=?").run(
    "2031-01-02",
    p.id,
  );
  const q = await photo(db, c, archived, "2032-01-01T00:00:00.000Z");
  db.prepare("UPDATE photos SET archived_at=? WHERE id=?").run(
    "2032-01-02",
    q.id,
  );
  db.prepare("UPDATE animals SET updated_at='2099-01-01' WHERE id=?").run(spa);
  const recent = (await app.inject({ url: "/api/animals?sort=recent" })).json();
  assert.deepEqual(
    recent.items.slice(0, 2).map((a) => a.id),
    [b, a],
  );
  const old = (await app.inject({ url: "/api/animals?sort=oldest" })).json();
  assert.deepEqual(
    old.items.slice(0, 2).map((a) => a.id),
    [a, b],
  );
  const auth = (
    await app.inject({
      url: "/api/animals?sort=recent",
      headers: admin.headers,
    })
  ).json();
  assert.equal(auth.items[0].id, privateId);
});
test("200-animal pagination and CSV share filters, export all pages and escape Excel formulas", async (t) => {
  const { app, db } = await fixture(t),
    admin = await login(app);
  for (let n = 0; n < 205; n++)
    animal(db, "Chien " + String(n).padStart(3, "0"));
  const evil = animal(db, '=HYPERLINK("https://example.com")');
  const first = (
    await app.inject({ url: "/api/animals?limit=200&sort=name" })
  ).json();
  const second = (
    await app.inject({ url: "/api/animals?limit=200&sort=name&page=2" })
  ).json();
  assert.equal(first.items.length, 200);
  assert.equal(second.items.length, 6);
  assert.equal(first.pages, 2);
  assert.equal(first.pageSize, 200);
  assert.ok(!first.items.some((a) => second.items.some((b) => a.id === b.id)));
  assert.equal(
    (await app.inject({ url: "/api/animals?limit=201" })).statusCode,
    400,
  );
  assert.equal(
    (await app.inject({ url: "/api/animals?format=csv" })).statusCode,
    401,
  );
  const csv = await app.inject({
    url: "/api/animals?format=csv&limit=12&page=2",
    headers: admin.headers,
  });
  assert.equal(csv.statusCode, 200, csv.body);
  assert.match(csv.headers["content-type"], /text\/csv/);
  assert.equal(csv.body.split("\r\n").filter(Boolean).length, 207);
  assert.ok(csv.body.includes(evil));
  assert.ok(csv.body.includes("'="));
  const filtered = await app.inject({
    url: "/api/animals?format=csv&q=Chien%20001",
    headers: admin.headers,
  });
  assert.equal(filtered.body.split("\r\n").filter(Boolean).length, 2);
  const safe = animalCsv([{ id: "a", name: ' +SUM(1;2)\n"test"' }]);
  assert.ok(safe.startsWith("\uFEFF"));
  assert.ok(safe.includes("' +SUM"));
  assert.ok(safe.includes('""test""'));
});
