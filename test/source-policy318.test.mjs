import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { z } from "zod";
import {
  openDb,
  id,
  now,
  saveSettings,
  settings,
  transaction,
} from "../server/db.mjs";
import { applySnapshot, normalizeSnapshot } from "../server/source.mjs";
import { guardInventory, collectorConfig } from "../server/source-collect.mjs";
import {
  automaticAdoption,
  pendingAdoptionCount,
  settleDueAdoptions,
} from "../server/source-adoption.mjs";
import { sourceFields } from "../server/preferences-schema.mjs";

async function scenario(t, overrides = {}) {
  const base = await mkdtemp(path.join(os.tmpdir(), "anipic-source318-"));
  const db = openDb({ dbDir: base });
  t.mock.timers.enable({
    apis: ["Date"],
    now: Date.parse("2026-11-15T10:00:00Z"),
  });
  t.after(async () => {
    t.mock.timers.reset();
    db.close();
    await rm(base, { recursive: true, force: true });
  });
  saveSettings(db, {
    sourceMode: "spa",
    sourceScope: "spa:moree",
    archiveMissing: true,
    sourceMissingOutcome: "automatic",
    missingThreshold: 2,
    sourceAbsenceIntervalHours: 0.25,
    sourceMaxDropPercent: 100,
    sourceShortPresenceHours: 2,
    ...overrides,
  });
  const advance = (minutes) => t.mock.timers.tick(minutes * 60000);
  const apply = (ids, options = {}) => {
    const cfg = collectorConfig(settings(db));
    const snapshot = normalizeSnapshot({
      schemaVersion: 1,
      scope: "spa:moree",
      complete: true,
      expectedCount: ids.length + 1,
      fetchedAt: now(),
      animals: ["anchor", ...ids].map((name) => ({
        sourceId: "spa:" + name,
        name,
        species: "cat",
        status: "available",
      })),
      ...options,
    });
    return applySnapshot(db, guardInventory(db, snapshot, cfg));
  };
  const row = (name = "one") =>
    db.prepare("SELECT * FROM animals WHERE source_id=?").get("spa:" + name);
  const adopted = () =>
    db
      .prepare(
        "SELECT COUNT(*) n FROM animal_status_events WHERE status='adopted'",
      )
      .get().n;
  const missing = () => {
    advance(15);
    apply([]);
    advance(15);
    return apply([]);
  };
  return { db, advance, apply, row, adopted, missing };
}

test("short observed presence is frozen before days of missing checks and never counted as adopted", async (t) => {
  const s = await scenario(t);
  s.apply(["one"]);
  s.advance(60);
  s.apply(["one"]);
  s.advance(15);
  s.apply([]);
  s.advance(3 * 24 * 60);
  s.apply([]);
  const a = s.row(),
    p = automaticAdoption(s.db, a.id);
  assert.equal(a.status, "source_missing");
  assert.ok(a.archived_at);
  assert.equal(s.adopted(), 0);
  assert.equal(p.requiresConfirmation, true);
  assert.equal(p.reason, "short_presence");
  assert.equal(p.observedPresence.durationHours, 1);
  assert.equal(p.observedPresence.firstMissingAt, "2026-11-15T11:15:00.000Z");
  assert.equal(pendingAdoptionCount(s.db), 1);
  for (const policy of ["after24h", "automatic"]) {
    saveSettings(s.db, {
      sourceMissingOutcome: policy,
      sourceShortPresenceHours: 0,
    });
    s.advance(2 * 24 * 60);
    s.apply([]);
    assert.equal(
      transaction(s.db, () => settleDueAdoptions(s.db)),
      0,
    );
    assert.equal(s.adopted(), 0);
    assert.equal(automaticAdoption(s.db, a.id).requiresConfirmation, true);
  }
});

test("normal automatic adoption includes the exact threshold and creates no pending review", async (t) => {
  const s = await scenario(t);
  s.apply(["one"]);
  s.advance(120);
  s.apply(["one"]);
  s.missing();
  assert.equal(s.row().status, "adopted");
  assert.equal(s.adopted(), 1);
  assert.equal(pendingAdoptionCount(s.db), 0);
  assert.equal(automaticAdoption(s.db, s.row().id).review.by, "automatic");
});

test("the adjustable short-presence threshold applies to observed duration", async (t) => {
  const s = await scenario(t, { sourceShortPresenceHours: 3 });
  s.apply(["one"]);
  s.advance(120);
  s.apply(["one"]);
  s.missing();
  assert.equal(s.row().status, "source_missing");
  assert.equal(automaticAdoption(s.db, s.row().id).requiresConfirmation, true);
});

test("mandatory manual policy never counts an adoption before team confirmation even after switching global policy", async (t) => {
  const s = await scenario(t, { sourceMissingOutcome: "manual" });
  s.apply(["one"]);
  s.advance(180);
  s.apply(["one"]);
  s.missing();
  const a = s.row(),
    p = automaticAdoption(s.db, a.id);
  assert.equal(a.status, "source_missing");
  assert.equal(s.adopted(), 0);
  assert.equal(p.requiresConfirmation, true);
  assert.equal(p.reason, "manual_policy");
  assert.equal(p.reviewDueAt, undefined);
  saveSettings(s.db, { sourceMissingOutcome: "automatic" });
  s.advance(48 * 60);
  s.apply([]);
  assert.equal(s.adopted(), 0);
  assert.equal(pendingAdoptionCount(s.db), 1);
});

test("legacy animals without a known episode start are not falsely classified as short-lived", async (t) => {
  const s = await scenario(t);
  const animalId = id();
  s.db
    .prepare(
      "INSERT INTO animals(id,name,species,source_id,source_scope,source_seen_at,created_at,updated_at) VALUES (?,?,'cat',?,'spa:moree',?,?,?)",
    )
    .run(animalId, "one", "spa:one", now(), now(), now());
  s.apply(["one"]);
  s.missing();
  assert.equal(s.row().status, "adopted");
  assert.equal(s.adopted(), 1);
  assert.equal(pendingAdoptionCount(s.db), 0);
});

test("partial missing inventories do not close an episode and positive partial observations extend it", async (t) => {
  const s = await scenario(t);
  s.apply(["one"]);
  s.advance(30);
  s.apply([], { complete: false });
  s.advance(150);
  s.apply(["one"], { complete: false });
  s.missing();
  assert.equal(s.row().status, "adopted");
  assert.equal(s.adopted(), 1);
  assert.equal(pendingAdoptionCount(s.db), 0);
});

test("reappearance clears a short-presence decision and starts a fresh observed episode", async (t) => {
  const s = await scenario(t);
  s.apply(["one"]);
  s.missing();
  const animalId = s.row().id;
  assert.equal(s.row().status, "source_missing");
  s.advance(15);
  const returnAt = now();
  s.apply(["one"]);
  assert.equal(s.row().archived_at, null);
  assert.equal(automaticAdoption(s.db, animalId), null);
  assert.equal(pendingAdoptionCount(s.db), 0);
  s.advance(60);
  s.apply(["one"]);
  s.missing();
  const next = automaticAdoption(s.db, animalId);
  assert.equal(next.requiresConfirmation, true);
  assert.equal(next.observedPresence.firstSeenAt, returnAt);
  assert.equal(next.observedPresence.durationHours, 1);
  assert.equal(s.adopted(), 0);
});

test("source settings support mandatory reviews and a bounded configurable two-hour default", () => {
  const schema = z.object(sourceFields);
  const cfg = schema.parse({ sourceMissingOutcome: "manual" });
  assert.equal(cfg.sourceMissingOutcome, "manual");
  assert.equal(cfg.sourceShortPresenceHours, 2);
  for (const value of [-1, 169, "2"])
    assert.equal(
      schema.safeParse({ sourceShortPresenceHours: value }).success,
      false,
    );
  assert.equal(
    schema.parse({ sourceMissingOutcome: "adopted" }).sourceMissingOutcome,
    "adopted",
  );
});

test("an older complete inventory cannot count an absence after a newer partial positive observation", async (t) => {
  const s = await scenario(t);
  s.apply(["one"]);
  s.advance(180);
  const lastPositive = now();
  s.apply(["one"], { complete: false });
  s.advance(15);
  s.apply(["one"], { complete: false, fetchedAt: "2026-11-15T11:00:00.000Z" });
  assert.equal(s.row().source_seen_at, lastPositive);
  s.apply([], { fetchedAt: "2026-11-15T12:00:00.000Z" });
  assert.equal(s.row().missing_count, 0);
  s.advance(15);
  s.apply([]);
  assert.equal(s.row().archived_at, null);
  s.advance(15);
  s.apply([]);
  assert.equal(s.row().status, "adopted");
});

test("a single observation requires confirmation but a suspicious or stale absence cannot freeze it", async (t) => {
  const s = await scenario(t);
  s.apply(["one"]);
  s.advance(30);
  saveSettings(s.db, { sourceMaxDropPercent: 20 });
  assert.equal(s.apply([]).absenceCheck, false);
  assert.equal(s.row().missing_count, 0);
  s.advance(150);
  s.apply(["one"]);
  assert.throws(
    () => s.apply([], { fetchedAt: "2026-11-13T10:00:00.000Z" }),
    /plus ancien/,
  );
  saveSettings(s.db, { sourceMaxDropPercent: 100 });
  s.missing();
  assert.equal(s.row().status, "adopted");
  s.advance(15);
  s.apply(["two"]);
  s.missing();
  assert.equal(s.row("two").status, "source_missing");
  assert.equal(
    automaticAdoption(s.db, s.row("two").id).observedPresence.durationHours,
    0,
  );
});

test("positive observations compare timestamp instants rather than optional ISO fractions", async (t) => {
  const s = await scenario(t);
  s.apply(["one"], { fetchedAt: "2026-11-15T10:00:00Z" });
  t.mock.timers.tick(1);
  s.apply(["one"], { complete: false });
  assert.equal(s.row().source_seen_at, "2026-11-15T10:00:00.001Z");
});
