import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, login, animal as baseAnimal } from "./helpers.mjs";
import { saveSettings, id, now } from "../server/db.mjs";
import { sourceDefaults } from "../server/preferences-schema.mjs";
import { sourceHealth } from "../server/source-health.mjs";
import { applySnapshot, normalizeSnapshot } from "../server/source.mjs";
const config = { ...sourceDefaults, sourceMode: "spa" };
function animal(db, name) {
  const value = baseAnimal(db, name);
  db.prepare("UPDATE animals SET source_scope=? WHERE id=?").run(
    config.sourceScope,
    value,
  );
  return value;
}
function report(ids, time = new Date(Date.now() - 2000).toISOString()) {
  return {
    mode: "spa",
    status: "complete",
    archiveSafe: true,
    testedAt: time,
    animalsFound: ids.length,
    animalsKept: ids.length,
    sourceIds: ids,
    configuration: {
      scope: config.sourceScope,
      refugeSlug: config.spaRefugeSlug,
      species: config.sourceSpecies,
    },
  };
}
test("home alert detects a different membership even with equal counts, and a safe sync clears it", async (t) => {
  const { db } = await fixture(t),
    a = animal(db, "O’MALLEY"),
    b = animal(db, "Présent");
  const rows = db.prepare("SELECT id,source_id FROM animals ORDER BY id").all(),
    sourceB = rows.find((r) => r.id === b).source_id;
  const diagnostic = report([sourceB, "spa:new"]);
  saveSettings(db, { ...config, sourceLastDiagnostic: diagnostic });
  const health = sourceHealth(db);
  assert.equal(health.state, "mismatch");
  assert.equal(health.localCount, 2);
  assert.equal(health.sourceCount, 2);
  assert.equal(health.missingCount, 1);
  assert.equal(health.newCount, 1);
  assert.equal(health.missing[0].id, a);
  assert.equal(health.basedOn, "diagnostic");
  assert.equal(health.canInferAdoption, false);
  applySnapshot(
    db,
    normalizeSnapshot({
      schemaVersion: 1,
      scope: config.sourceScope,
      complete: true,
      expectedCount: 2,
      fetchedAt: new Date().toISOString(),
      animals: [
        {
          sourceId: rows.find((r) => r.id === a).source_id,
          name: "O’MALLEY",
          species: "dog",
        },
        { sourceId: sourceB, name: "Présent", species: "dog" },
      ],
    }),
  );
  assert.equal(sourceHealth(db).state, "ok");
});
test("a legacy diagnostic can flag a count gap; stale/failed/partial checks are visible without changing any animal", async (t) => {
  const { db } = await fixture(t);
  animal(db);
  const sourceId = db.prepare("SELECT source_id FROM animals").get().source_id;
  const old = report([sourceId, "spa:missing"]);
  delete old.sourceIds;
  delete old.configuration.scope;
  saveSettings(db, { ...config, sourceLastDiagnostic: old });
  assert.equal(sourceHealth(db).state, "mismatch");
  assert.equal(sourceHealth(db).missingCount, null);
  saveSettings(db, {
    sourceLastDiagnostic: report(
      [sourceId],
      new Date(Date.now() - 48 * 3600000).toISOString(),
    ),
  });
  assert.equal(sourceHealth(db).state, "stale");
  saveSettings(db, {
    sourceLastDiagnostic: {
      ...report([]),
      status: "partial",
      archiveSafe: false,
    },
  });
  assert.equal(sourceHealth(db).state, "error");
  saveSettings(db, { sourceLastDiagnostic: report([sourceId]) });
  db.prepare(
    "INSERT INTO jobs(id,kind,state,detail,created_at,finished_at) VALUES (?,?,?,?,?,?)",
  ).run(id(), "sync", "failed", "DO_NOT_EXPOSE_SECRET", now(), now());
  const failure = sourceHealth(db);
  assert.equal(failure.state, "error");
  saveSettings(db, {
    sourceLastDiagnostic: report(
      [sourceId],
      new Date(Date.now() + 1000).toISOString(),
    ),
  });
  assert.equal(
    sourceHealth(db).state,
    "error",
    "A newer read-only diagnostic must not clear a failed synchronization",
  );
  assert.ok(!JSON.stringify(failure).includes("DO_NOT_EXPOSE_SECRET"));
  assert.equal(db.prepare("SELECT COUNT(*) n FROM animals").get().n, 1);
});
test("source-health is private to approved team accounts and ignores diagnostics from another refuge or filtered species", async (t) => {
  const { app, db } = await fixture(t),
    admin = await login(app),
    viewer = await login(app, "viewer");
  animal(db);
  saveSettings(db, { ...config, sourceLastDiagnostic: report([]) });
  assert.equal(
    (await app.inject({ url: "/api/source/health" })).statusCode,
    401,
  );
  assert.equal(
    (await app.inject({ url: "/api/source/health", headers: viewer.headers }))
      .statusCode,
    200,
  );
  assert.ok(
    !("sourceSync" in (await app.inject({ url: "/api/overview" })).json()),
  );
  assert.equal(
    (await app.inject({ url: "/api/overview", headers: admin.headers })).json()
      .sourceSync.state,
    "mismatch",
  );
  const other = report([]);
  other.configuration.refugeSlug = "un-autre-refuge";
  saveSettings(db, { sourceLastDiagnostic: other });
  assert.equal(sourceHealth(db).state, "unverified");
  const filtered = report([]);
  filtered.configuration.species = ["cat"];
  saveSettings(db, { sourceLastDiagnostic: filtered });
  assert.equal(sourceHealth(db).state, "unverified");
  saveSettings(db, { sourceMode: "disabled" });
  assert.equal(sourceHealth(db).state, "disabled");
});
