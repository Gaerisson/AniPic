import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fixture, login, audienceConsent } from "./helpers.mjs";
import { id, now, saveSettings } from "../server/db.mjs";
import { parseShow } from "../server/signage-schema.mjs";
import { showTimeline } from "../shared/signage.mjs";
import { audioConfig } from "../server/audio-settings.mjs";
const call = (app, h, method, url, payload) =>
  app.inject({ headers: h, method, url, payload });
test("manual TV insert order is stable, missing clips are skipped and the stats switch suppresses all stats", () => {
  const msg = {
      id: id(),
      type: "message",
      afterAnimal: 1,
      seconds: 5,
      title: "Joyeux Noël",
      body: "",
      theme: "christmas",
    },
    v = { id: id(), type: "video", afterAnimal: 0, seconds: 20, assetId: id() },
    stats = { id: id(), type: "stats", afterAnimal: 2, seconds: 7 };
  const show = {
    items: [
      { id: "a", species: "dog", media: [{ kind: "photo" }] },
      { id: "b", species: "cat", media: [{ kind: "photo" }] },
    ],
    program: parseShow({
      introSeconds: 0,
      logoEvery: 0,
      statsEvery: 1,
      statsEnabled: false,
      inserts: [v, msg, stats],
    }),
    insertMedia: {
      [v.assetId]: { kind: "video", duration: 8, src: "test.mp4" },
    },
  };
  const tl = showTimeline(show);
  assert.deepEqual(
    tl.scenes.map((s) => s.type),
    ["video", "animal", "message", "animal"],
  );
  assert.equal(tl.scenes[0].duration, 8 * 24);
  assert.equal(tl.scenes[2].block.title, "Joyeux Noël");
  assert.equal(
    showTimeline({ ...show, insertMedia: {} }).scenes[0].type,
    "animal",
  );
  assert.throws(() => parseShow({ inserts: [msg, { ...msg }] }));
});
test("a manual TV clip is public only while explicitly programmed on an enabled screen", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    viewer = await login(app, "viewer");
  const assetId = id(),
    hash = "f".repeat(64);
  db.prepare("INSERT INTO blobs VALUES (?,?,?,?,?,?)").run(
    hash,
    20,
    100,
    100,
    "video/mp4",
    now(),
  );
  db.prepare("INSERT INTO video_assets VALUES (?,?,?,?,?,?,?)").run(
    assetId,
    hash,
    "clip.mp4",
    "video",
    8,
    admin.user.id,
    now(),
  );
  await fs.writeFile(path.join(c.mediaDir, hash), Buffer.alloc(20, 9));
  const url = `/api/public/display/videos/${assetId}`,
    program = parseShow({
      inserts: [
        { id: id(), type: "video", afterAnimal: 0, seconds: 6, assetId },
      ],
    });
  assert.equal((await app.inject({ url })).statusCode, 404);
  saveSettings(db, { displayEnabled: true, displayProgram: program });
  const r = await app.inject({ url, headers: { range: "bytes=0-4" } });
  assert.equal(r.statusCode, 206);
  assert.equal(r.rawPayload.length, 5);
  saveSettings(db, {
    displayProgram: parseShow({
      ...program,
      excludedScenes: [`insert:${program.inserts[0].id}`],
    }),
  });
  assert.equal((await app.inject({ url })).statusCode, 404);
  saveSettings(db, {
    displayProgram: parseShow({ ...program, mode: "wallpaper" }),
  });
  assert.equal((await app.inject({ url })).statusCode, 404);
  saveSettings(db, { displayProgram: program });
  assert.equal(
    (await call(app, viewer.headers, "PUT", "/api/admin/display", {}))
      .statusCode,
    403,
  );
  saveSettings(db, { displayEnabled: false });
  assert.equal((await app.inject({ url })).statusCode, 404);
});
test("Mistral credentials are admin-only, persist outside exported settings and take effect without restarting", async (t) => {
  const { app, db, c } = await fixture(t, { mistralApiKey: "" }),
    admin = await login(app),
    viewer = await login(app, "viewer"),
    secret = "test-secret-do-not-export";
  const body = {
    apiKey: secret,
    ttsModel: "voxtral-mini-tts-2603",
    sttModel: "voxtral-mini-latest",
    voiceId: "",
  };
  assert.equal(
    (await call(app, viewer.headers, "PUT", "/api/admin/audio", body))
      .statusCode,
    403,
  );
  const r = await call(app, admin.headers, "PUT", "/api/admin/audio", body);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().configured, true);
  assert.ok(!r.body.includes(secret));
  assert.equal(audioConfig(c, db).key, secret);
  for (const url of [
    "/api/admin/settings/export",
    "/api/admin/settings",
    "/api/team-ai/status",
    "/api/admin/connections",
  ]) {
    const view = await call(app, admin.headers, "GET", url);
    assert.equal(view.statusCode, 200, view.body);
    assert.ok(!view.body.includes(secret));
  }
  assert.ok(
    !db
      .prepare("SELECT detail FROM audit")
      .all()
      .some((r) => r.detail.includes(secret)),
  );
  assert.equal(
    audioConfig({ ...c, mistralApiKey: "env-secret" }, db).key,
    "env-secret",
  );
  await call(app, admin.headers, "PUT", "/api/admin/audio", {
    ...body,
    apiKey: "",
    removeKey: true,
  });
  assert.equal(audioConfig(c, db).key, "");
});
test("visitor views are bounded, deduplicated, account-linked and private; untrusted country headers are ignored", async (t) => {
  const { app, db } = await fixture(t, {
      visitorCountryHeader: "cf-ipcountry",
      trustProxy: false,
    }),
    admin = await login(app),
    viewer = await login(app, "viewer");
  const consented = await audienceConsent(app,admin.headers);
  const payload = { session: id(), path: "#animals" },
    headers = {
      ...consented,
      "cf-ipcountry": "FR",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0",
    };
  for (let i = 0; i < 2; i++)
    assert.equal(
      (await call(app, headers, "POST", "/api/visit", payload)).statusCode,
      200,
    );
  assert.equal(db.prepare("SELECT COUNT(*) n FROM visits").get().n, 1);
  assert.equal(
    (await app.inject({ url: "/api/admin/visitors" })).statusCode,
    401,
  );
  assert.equal(
    (await call(app, viewer.headers, "GET", "/api/admin/visitors")).statusCode,
    403,
  );
  const data = (
    await call(app, admin.headers, "GET", "/api/admin/visitors")
  ).json();
  assert.equal(data.summary.sessions, 1);
  assert.equal(data.rows[0].account, "admin");
  assert.equal(data.rows[0].country, null);
  assert.equal(data.rows[0].browser, "Chrome");
  assert.ok(!data.rows[0].session_hash);
  assert.equal(
    (
      await call(
        app,
        { origin: "https://foreign.invalid" },
        "POST",
        "/api/visit",
        { session: id(), path: "#gallery" },
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await call(app, consented, "POST", "/api/visit", {
        session: id(),
        path: "#animals?q=secret",
      })
    ).statusCode,
    400,
  );
});
