import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp } from "../server/app.mjs";
import { createUser } from "../server/auth.mjs";
import { id, now, settings, saveSettings } from "../server/db.mjs";
import { collectSpa } from "../server/spa-collector.mjs";
import {
  collectorConfig,
  collectInventory,
  guardInventory,
} from "../server/source-collect.mjs";
import { diagnoseSource } from "../server/source-diagnostics.mjs";
import { applySnapshot, synchronize } from "../server/source.mjs";
async function fixture(t, dependencies) {
  const base = await mkdtemp(path.join(os.tmpdir(), "anipic-connector-"));
  const app = await createApp({
    dbDir: path.join(base, "db"),
    mediaDir: path.join(base, "media"),
    cacheDir: path.join(base, "cache"),
    backupDir: path.join(base, "backups"),
    scheduler: false,
    origin: "http://localhost:3000",
    sourceDependencies: dependencies,
  });
  t.after(async () => {
    await app.close();
    await rm(base, { recursive: true, force: true });
  });
  return { app, db: app.db };
}
const deps = { checkRobots: async () => {}, delay: async () => {} };
const snapshot = (names) => ({
  schemaVersion: 1,
  scope: "spa:moree",
  fetchedAt: now(),
  complete: true,
  expectedCount: names.length,
  animals: names.map((name, i) => ({
    sourceId: "spa:" + i,
    name,
    species: i === 2 ? "cat" : "dog",
    status: "available",
    sex: "unknown",
    description: "",
    breed: "",
    compatibility: {},
    metadata: {},
    tags: [],
  })),
});
test("SPA retries a failed pass and any failure prevents complete status", async () => {
  let reads = 0;
  const result = await collectSpa({
    ...deps,
    config: { sourceSpecies: ["dog"], sourceAttempts: 3 },
    fetchText: async () => {
      if (++reads === 2) throw new Error("Source HTTP 503");
      return JSON.stringify({
        max_num_pages: 1,
        total: 1,
        animals: [
          {
            id: 4,
            name: "Nala",
            establishment_slug: "refuge-spa-de-moree-jean-leriche",
          },
        ],
      });
    },
  });
  assert.equal(reads, 3);
  assert.equal(result.validAttempts, 2);
  assert.equal(result.complete, false);
  assert.equal(result.failures.length, 2);
  assert.equal(result.animals.length, 1);
});
test("custom SPA endpoint, refuge, species, retry pacing and timeout reach the transport", async () => {
  const urls = [],
    delays = [],
    timeouts = [];
  const result = await collectSpa({
    ...deps,
    delay: async (ms) => delays.push(ms),
    config: {
      spaApiUrl: "https://www.la-spa.fr/authorized-feed/",
      spaRefugeSlug: "other-refuge",
      sourceSpecies: ["dog"],
      sourceAttempts: 2,
      sourceDelayMs: 4000,
      sourceTimeoutSeconds: 8,
    },
    fetchText: async (url, limit, opt) => {
      urls.push(url);
      timeouts.push(opt.timeoutMs);
      assert.equal(limit, 5 * 1024 ** 2);
      return JSON.stringify({
        max_num_pages: 2,
        total: 2,
        animals: [
          {
            id: new URL(url).searchParams.get("paged"),
            name: "Nala",
            establishment_slug: "other-refuge",
          },
        ],
      });
    },
  });
  assert.equal(urls.length, 4);
  assert.deepEqual(delays, [4000, 4000, 4000]);
  assert.ok(timeouts.every((ms) => ms <= 8000));
  assert.ok(
    urls.every(
      (url) =>
        url.includes("/authorized-feed/") &&
        url.includes("establishment=other-refuge") &&
        url.includes("species=chien"),
    ),
  );
  assert.equal(result.complete, true);
  assert.equal(result.stable, true);
  assert.equal(result.animals.length, 2);
});
test("configured request and pagination budgets stop before importing an incomplete page set", async () => {
  let reads = 0;
  const fetchText = async () => {
    reads++;
    return JSON.stringify({
      max_num_pages: 3,
      animals: [
        {
          id: 1,
          name: "Nala",
          establishment_slug: "refuge-spa-de-moree-jean-leriche",
        },
      ],
    });
  };
  await assert.rejects(
    () =>
      collectSpa({
        ...deps,
        fetchText,
        config: { sourceSpecies: ["dog"], sourceMaxRequests: 1 },
      }),
    /Budget de requêtes/,
  );
  assert.equal(reads, 1);
  reads = 0;
  await assert.rejects(
    () => collectSpa({ ...deps, fetchText, config: { sourceMaxPages: 2 } }),
    /Pagination SPA supérieure/,
  );
  assert.equal(reads, 1);
});
test("JSON configured passes and species filters do not count cats as absent", async (t) => {
  const { db } = await fixture(t);
  applySnapshot(db, snapshot(["A", "B", "C"]));
  saveSettings(db, {
    sourceMode: "json",
    sourceUrl: "https://example.org/data",
    sourceAttempts: 2,
    sourceSpecies: ["dog"],
    archiveMissing: true,
    missingThreshold: 2,
  });
  let calls = 0;
  const result = await synchronize(db, {
    ...deps,
    fetchText: async () => {
      calls++;
      return JSON.stringify(snapshot(["A", "B"]));
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.absenceCheck, false);
  assert.equal(
    db
      .prepare("SELECT missing_count FROM animals WHERE source_id='spa:2'")
      .get().missing_count,
    0,
  );
});
test("sudden inventory loss and stale snapshots suspend archive; partial imports can be refused", async (t) => {
  const { db } = await fixture(t);
  applySnapshot(db, snapshot(["A", "B", "C"]));
  const cfg = collectorConfig({ sourceMaxDropPercent: 20 });
  const loss = guardInventory(db, snapshot(["A"]), cfg);
  assert.equal(loss.absenceSafe, false);
  assert.ok(loss.dropPercent > 60);
  const stale = guardInventory(
    db,
    {
      ...snapshot(["A", "B", "C"]),
      fetchedAt: new Date(Date.now() - 25 * 3600_000).toISOString(),
    },
    cfg,
  );
  assert.equal(stale.absenceSafe, false);
  assert.throws(
    () =>
      guardInventory(
        db,
        { ...snapshot(["A"]), complete: false },
        { ...cfg, sourceAllowPartial: false },
      ),
    /partiel refusé/,
  );
  assert.throws(
    () => guardInventory(db, snapshot(["A"]), { ...cfg, sourceMinAnimals: 2 }),
    /minimum configuré/,
  );
});
test("SPA dry run distinguishes browser shell from robots denial, never mutates animal data", async (t) => {
  const { db } = await fixture(t);
  applySnapshot(db, snapshot(["A"]));
  const before = db.prepare("SELECT * FROM animals").all();
  const report = await diagnoseSource(
    db,
    { ...settings(db), sourceMode: "spa" },
    {
      ...deps,
      checkRobots: async (url) => {
        if (url.includes("wp-json"))
          throw Object.assign(new Error("Robots refuse"), {
            code: "ROBOTS_DENIED",
          });
      },
      fetchText: async () =>
        '<title>SPA</title><div id="root"></div><script src="/static/js/main.js"></script>',
    },
  );
  assert.equal(report.status, "blocked");
  assert.equal(report.apiRequested, false);
  assert.equal(report.stopReason, "ROBOTS_DENIED");
  assert.equal(report.publicPage.animalLinks, 0);
  assert.equal(report.publicPage.javascriptApp, true);
  assert.equal(report.applied, false);
  assert.equal(report.requests, 1);
  assert.deepEqual(db.prepare("SELECT * FROM animals").all(), before);
});
test("test endpoint uses unsaved candidate config, is admin-only and does not save source settings", async (t) => {
  const { app, db } = await fixture(t, {
    ...deps,
    fetchText: async () => JSON.stringify(snapshot(["A", "B"])),
  });
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/admin/source/test",
        payload: {},
      })
    ).statusCode,
    401,
  );
  await createUser(db, "admin", "secure testing password 123", "admin");
  const login = await app.inject({
    method: "POST",
    url: "/api/login",
    payload: { name: "admin", password: "secure testing password 123" },
  });
  const headers = {
    cookie: login.headers["set-cookie"].split(";")[0],
    "x-csrf-token": login.json().user.csrf,
    origin: "http://localhost:3000",
  };
  const r = await app.inject({
    method: "POST",
    url: "/api/admin/source/test",
    headers,
    payload: {
      sourceMode: "json",
      sourceUrl: "https://example.org/data",
      sourceAttempts: 2,
    },
  });
  assert.equal(r.statusCode, 200);
  let d;
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 10));
    d = (
      await app.inject({ url: "/api/admin/source/diagnostic", headers })
    ).json();
    if (d.job?.state !== "running") break;
  }
  assert.equal(d.job.state, "done");
  assert.equal(d.report.status, "complete");
  assert.equal(d.report.configuration.attempts, 2);
  assert.equal(settings(db).sourceMode, "disabled");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM animals").get().n, 0);
  const invalid = await app.inject({
    method: "POST",
    url: "/api/admin/source/test",
    headers,
    payload: { sourceDelayMs: 0 },
  });
  assert.equal(invalid.statusCode, 400);
  const overview = (await app.inject({ url: "/api/overview" })).json();
  assert.equal(overview.interface.cardRadius, 18);
  assert.equal(overview.interface.hoverSeconds, 1.8);
  assert.equal(overview.interface.spaApiUrl, undefined);
  assert.equal(overview.interface.sourceLastDiagnostic, undefined);
});
test("JavaScript-only HTML fails explicitly instead of pretending to import cards", async () => {
  await assert.rejects(
    () =>
      collectInventory(
        { sourceMode: "html", sourceUrl: "https://www.la-spa.fr/adoption/" },
        { ...deps, fetchText: async () => '<div id="root"></div>' },
      ),
    /application JavaScript/,
  );
  assert.throws(() => collectorConfig({ sourceAttempts: 20 }));
  assert.throws(() =>
    collectorConfig({ spaApiUrl: "http://www.la-spa.fr/api" }),
  );
});
