import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fixture, login } from "./helpers.mjs";
import { root } from "../server/config.mjs";
import { publicAsset } from "../server/public-assets.mjs";
import { sourceHealth } from "../server/source-health.mjs";
import { collectSpa } from "../server/spa-collector.mjs";
import { saveSettings, settings } from "../server/db.mjs";
import { normalizeSnapshot, applySnapshot } from "../server/source.mjs";
import { scheduledSyncDue, syncDue } from "../shared/sync-schedule.mjs";

test("production assets load from dist without a public folder; missing assets fail clearly", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "anipic-assets-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.mkdir(path.join(dir, "dist"));
  await fs.writeFile(path.join(dir, "dist/spa-logo.png"), "dist-logo");
  assert.equal(
    (await publicAsset("spa-logo.png", dir)).toString(),
    "dist-logo",
  );
  await fs.mkdir(path.join(dir, "public"));
  await fs.writeFile(path.join(dir, "public/fallback.png"), "dev-logo");
  assert.equal((await publicAsset("fallback.png", dir)).toString(), "dev-logo");
  await assert.rejects(publicAsset("missing.png", dir), {
    code: "ASSET_MISSING",
    statusCode: 503,
  });
  await assert.rejects(publicAsset("../package.json", dir), /invalide/);
});

test("real group poster endpoint works in a production-shaped checkout with dist assets only", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "anipic-production-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  for (const folder of ["server", "shared", "video"])
    await fs.cp(path.join(root, folder), path.join(dir, folder), {
      recursive: true,
    });
  await fs.copyFile(
    path.join(root, "package.json"),
    path.join(dir, "package.json"),
  );
  await fs.symlink(
    path.join(root, "node_modules"),
    path.join(dir, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await fs.mkdir(path.join(dir, "dist"));
  for (const name of ["android-download.json", "android-install.html"]) {
    await fs.copyFile(
      path.join(root, "public", name),
      path.join(dir, "dist", name),
    );
  }
  await fs.cp(
    path.join(root, "public/downloads"),
    path.join(dir, "dist/downloads"),
    { recursive: true },
  );
  await fs.copyFile(
    path.join(root, "public/spa-logo.png"),
    path.join(dir, "dist/spa-logo.png"),
  );
  await fs.writeFile(
    path.join(dir, "probe.mjs"),
    `
    import assert from 'node:assert/strict';
    import path from 'node:path';
    import {Readable} from 'node:stream';
    import sharp from 'sharp';
    import {createApp} from './server/app.mjs';
    import {createUser} from './server/auth.mjs';
    import {ingest} from './server/storage.mjs';
    const base=import.meta.dirname;
    const app=await createApp({dbDir:path.join(base,'data'),mediaDir:path.join(base,'media'),cacheDir:path.join(base,'cache'),backupDir:path.join(base,'backups'),requireMarker:false,scheduler:false,origin:'http://localhost:3000'});
    try {
      await createUser(app.db,'test','temporary production test password','admin');
      const login=await app.inject({method:'POST',url:'/api/login',payload:{name:'test',password:'temporary production test password'}});
      assert.equal(login.statusCode,200,login.body);
      const headers={cookie:login.headers['set-cookie'].split(';')[0],'x-csrf-token':login.json().user.csrf,origin:'http://localhost:3000'};
      const id=crypto.randomUUID(),date=new Date().toISOString();
      app.db.prepare("INSERT INTO animals(id,name,species,created_at,updated_at) VALUES (?,'Production','cat',?,?)").run(id,date,date);
      const jpeg=await sharp({create:{width:320,height:400,channels:3,background:'orange'}}).jpeg().toBuffer();
      await ingest(app.db,app.anipicConfig,id,Readable.from(jpeg),'test.jpg');
      const response=await app.inject({method:'POST',url:'/api/group-posters',headers,payload:{animals:[{id}],output:'preview'}});
      assert.equal(response.statusCode,200,response.body.slice(0,200));
      assert.equal((await sharp(response.rawPayload).metadata()).width,868);
      console.log('Production-shaped poster: OK, dist assets only');
    } finally { await app.close(); }
  `,
  );
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["probe.mjs"], {
      cwd: dir,
      windowsHide: true,
      timeout: 30000,
    });
    let output = "";
    child.stdout.on("data", (b) => (output += b));
    child.stderr.on("data", (b) => (output += b));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, output }));
  });
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /dist assets only/);
});

test("sync and absence intervals accept fifteen minutes and keep the existing 24-hour default", async (t) => {
  const { app, db } = await fixture(t),
    { headers } = await login(app);
  assert.equal(settings(db).sourceAbsenceIntervalHours, 24);
  const put = (payload) =>
    app.inject({ method: "PUT", url: "/api/admin/settings", headers, payload });
  assert.equal(
    (await put({ sourceAbsenceIntervalHours: 0.25, syncIntervalHours: 0.25 }))
      .statusCode,
    200,
  );
  assert.equal(settings(db).sourceAbsenceIntervalHours, 0.25);
  for (const payload of [
    { sourceAbsenceIntervalHours: 0 },
    { sourceAbsenceIntervalHours: 0.1 },
    { syncIntervalHours: 0.1 },
  ])
    assert.equal((await put(payload)).statusCode, 400);
  const cfg = {
    sourceMode: "spa",
    syncScheduleMode: "interval",
    syncIntervalHours: 0.25,
  };
  assert.equal(
    syncDue(cfg, "2026-10-18T03:00:00Z", new Date("2026-10-18T03:14:59Z")),
    false,
  );
  assert.equal(
    syncDue(cfg, "2026-10-18T03:00:00Z", new Date("2026-10-18T03:15:00Z")),
    true,
  );
});

test("short absence confirmation delay still requires distinct inventories and never counts rapid repeats", async (t) => {
  const { db } = await fixture(t);
  saveSettings(db, {
    archiveMissing: true,
    sourceMissingOutcome: "adopted",
    sourceAbsenceIntervalHours: 0.25,
    missingThreshold: 2,
  });
  let at = Date.now() - 5000;
  const snap = (ids) =>
    normalizeSnapshot({
      schemaVersion: 1,
      scope: "spa:moree",
      complete: true,
      expectedCount: ids.length,
      fetchedAt: new Date((at += 10)).toISOString(),
      animals: ids.map((n) => ({
        sourceId: "spa:" + n,
        name: n,
        species: "cat",
      })),
    });
  const age = () =>
    db
      .prepare("UPDATE settings SET value=? WHERE key='complete:spa:moree'")
      .run(
        JSON.stringify({
          at: new Date(Date.now() - 16 * 60000).toISOString(),
          fetchedAt: new Date(at).toISOString(),
        }),
      );
  applySnapshot(db, snap(["one", "two"]));
  assert.equal(applySnapshot(db, snap(["one"])).absenceCheck, false);
  age();
  const first = snap(["one"]);
  assert.equal(applySnapshot(db, first).autoAdopted, 0);
  age();
  assert.equal(applySnapshot(db, first).absenceCheck, false); // exact same inventory
  assert.equal(applySnapshot(db, snap(["one"])).autoAdopted, 1);
});

const cfg = {
  sourceMode: "spa",
  syncScheduleMode: "interval",
  syncIntervalHours: 6,
};
test("an incomplete scheduled sync remains visible as a health warning while preserving the last reliable inventory", async (t) => {
  const { db } = await fixture(t);
  saveSettings(db, { sourceMode: "spa" });
  applySnapshot(
    db,
    normalizeSnapshot({
      schemaVersion: 1,
      scope: "spa:moree",
      complete: true,
      expectedCount: 1,
      fetchedAt: new Date(Date.now() - 1000).toISOString(),
      animals: [{ sourceId: "spa:present", name: "Présent", species: "cat" }],
    }),
  );
  db.prepare(
    "INSERT INTO jobs(id,kind,state,detail,created_at,finished_at) VALUES ('partial','sync','done',?,?,?)",
  ).run(
    '{"complete":false}',
    new Date().toISOString(),
    new Date().toISOString(),
  );
  const health = sourceHealth(db);
  assert.equal(health.state, "error");
  assert.equal(health.sourceCount, 1);
  assert.equal(
    db.prepare("SELECT status FROM animals").get().status,
    "available",
  );
});
test("scheduled sync retries failed and partial jobs with bounded backoff, without bypassing manual mode", () => {
  const failed = {
    state: "failed",
    created_at: "2026-10-18T03:00:00Z",
    finished_at: "2026-10-18T03:01:00Z",
  };
  const when = (text) => new Date("2026-10-18T" + text + "Z");
  assert.equal(scheduledSyncDue(cfg, [failed], when("03:05:59")), false);
  assert.equal(scheduledSyncDue(cfg, [failed], when("03:06:00")), true);
  assert.equal(
    scheduledSyncDue(cfg, [failed, failed], when("03:10:59")),
    false,
  );
  assert.equal(scheduledSyncDue(cfg, [failed, failed], when("03:11:00")), true);
  assert.equal(
    scheduledSyncDue(cfg, Array(8).fill(failed), when("03:31:00")),
    true,
  );
  assert.equal(
    scheduledSyncDue(
      { ...cfg, syncScheduleMode: "manual" },
      [failed],
      when("09:00:00"),
    ),
    false,
  );
  assert.equal(
    scheduledSyncDue(
      { ...cfg, sourceMode: "disabled" },
      [failed],
      when("09:00:00"),
    ),
    false,
  );
  assert.equal(
    scheduledSyncDue(cfg, [{ ...failed, state: "running" }], when("09:00:00")),
    false,
  );
  assert.equal(
    scheduledSyncDue(
      cfg,
      [{ ...failed, state: "done", detail: '{"complete":false}' }],
      when("03:06:00"),
    ),
    true,
  );
  assert.equal(
    scheduledSyncDue(
      cfg,
      [{ ...failed, state: "done", detail: '{"complete":true}' }],
      when("03:06:00"),
    ),
    false,
  );
});

const record = (id) => ({
  ID: id,
  name: "Chat",
  establishment_slug: "refuge-spa-de-moree-jean-leriche",
});
test("per-species total mismatches cannot compensate each other and falsely validate a SPA inventory", async () => {
  const result = await collectSpa({
    attempts: 1,
    checkRobots: async () => {},
    delay: async () => {},
    fetchText: async (url) => {
      const species = new URL(url).searchParams.get("species");
      return JSON.stringify({
        total: 1,
        nb_pages: 1,
        results:
          species === "chien"
            ? [record(1), record(2)]
            : species === "chat"
              ? []
              : [record(3)],
      });
    },
  });
  assert.equal(result.animals.length, 3);
  assert.equal(result.complete, false);
  assert.equal(result.failures.length, 2);
});
test("a source identifier appearing in different species rejects the SPA inventory", async () => {
  await assert.rejects(
    collectSpa({
      attempts: 1,
      checkRobots: async () => {},
      delay: async () => {},
      fetchText: async () =>
        JSON.stringify({ total: 1, nb_pages: 1, results: [record(1)] }),
    }),
    { code: "INVALID_SPA" },
  );
});
