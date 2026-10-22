import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { fixture, login, animal } from "./helpers.mjs";
import { id, now, settings, saveSettings, openDb } from "../server/db.mjs";
import { hashPassword } from "../server/auth.mjs";
import { displayRevision } from "../server/display-monitor.mjs";
import { buildDisplay } from "../server/refuge-display.mjs";
import {
  displayScreenHealth,
  displayOfflineMs,
} from "../shared/display-monitor.mjs";
import {
  displayIdentity,
  playbackTelemetry,
  postDisplayHeartbeat,
} from "../src/display-monitor-client.mjs";
const heartbeat = "/api/public/display/heartbeat",
  list = "/api/admin/display/screens";
const report = (db, overrides = {}) => ({
  id: id(),
  token: randomBytes(32).toString("base64url"),
  state: "playing",
  visible: true,
  fullscreen: true,
  persistent: true,
  width: 1920,
  height: 1080,
  revision: displayRevision(db),
  syncAgeMs: 4000,
  progressAgeMs: 500,
  scene: {
    key: "logo:0",
    title: "Logo SPA",
    type: "logo",
    position: 3,
    duration: 240,
  },
  issues: [],
  ...overrides,
});
const send = (app, payload, headers = {}) =>
  app.inject({ method: "POST", url: heartbeat, payload, headers });
const screens = async (app, headers) => {
  const r = await app.inject({ url: list, headers });
  assert.equal(r.statusCode, 200, r.body);
  return r.json().screens;
};
test("TV heartbeat uses its device identity without a site PIN while keeping private manager access intact", async (t) => {
  const { app, db } = await fixture(t),
    payload = report(db);
  saveSettings(db, {
    accessPinEnabled: true,
    accessPinHash: await hashPassword("582104"),
  });
  assert.equal((await send(app, payload)).statusCode, 200);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM display_screens").get().n, 1);
  const unlocked = await app.inject({
    method: "POST",
    url: "/api/gate/unlock",
    payload: { pin: "582104" },
  });
  assert.equal(unlocked.statusCode, 200, unlocked.body);
  const cookie = []
    .concat(unlocked.headers["set-cookie"])
    .map((v) => v.split(";")[0])
    .join("; ");
  const result = await send(app, payload, {
    cookie,
    origin: "http://localhost:3000",
  });
  assert.equal(result.statusCode, 200, result.body);
  assert.deepEqual(Object.keys(result.json()).sort(), [
    "commands",
    "config",
    "id",
    "intervalMs",
    "name",
  ]);
  const row = db.prepare("SELECT * FROM display_screens").get();
  assert.notEqual(row.token_hash, payload.token);
  assert.ok(!row.status.includes(payload.token));
  assert.equal(
    (await app.inject({ url: list, headers: { cookie } })).statusCode,
    401,
  );
  saveSettings(db, { accessPinEnabled: false });
  const manager = await login(app, "agent");
  const overview = await screens(app, manager.headers);
  assert.equal(overview[0].online, true);
  assert.equal(overview[0].current, true);
  assert.ok(!JSON.stringify(overview).includes(payload.token));
  assert.ok(!("token_hash" in overview[0]));
  assert.ok(overview[0].lastSyncAt);
  const fresh = await buildDisplay(db);
  assert.equal(fresh.revision, displayRevision(db));
});
test("TV ownership, input limits, origin checks, roles and CSRF are enforced without changing other routes", async (t) => {
  const { app, db } = await fixture(t),
    manager = await login(app, "agent"),
    payload = report(db);
  assert.equal(
    (await send(app, payload, { origin: "https://foreign.example" }))
      .statusCode,
    403,
  );
  assert.equal(
    (await send(app, payload, { "sec-fetch-site": "cross-site" })).statusCode,
    403,
  );
  assert.equal((await send(app, payload)).statusCode, 200);
  assert.equal(
    (
      await send(app, {
        ...payload,
        token: randomBytes(32).toString("base64url"),
        state: "paused",
      })
    ).statusCode,
    403,
  );
  assert.equal(
    JSON.parse(db.prepare("SELECT status FROM display_screens").get().status)
      .state,
    "playing",
  );
  assert.equal(
    (await send(app, { ...payload, issues: ["untrusted free-form stack"] }))
      .statusCode,
    400,
  );
  assert.equal(
    (
      await send(app, {
        ...payload,
        scene: { ...payload.scene, title: "x".repeat(8000) },
      })
    ).statusCode,
    413,
  );
  for (const role of ["editor", "viewer", "volunteer"]) {
    const user = await login(app, role);
    assert.equal(
      (await app.inject({ url: list, headers: user.headers })).statusCode,
      403,
    );
  }
  const noCsrf = {
    cookie: manager.headers.cookie,
    origin: "http://localhost:3000",
  };
  assert.equal(
    (
      await app.inject({
        method: "PATCH",
        url: `${list}/${payload.id}`,
        headers: noCsrf,
        payload: { name: "Accueil", revision: 1 },
      })
    ).statusCode,
    403,
  );
  db.prepare(
    "UPDATE sessions SET expires_at='2000-01-01T00:00:00.000Z' WHERE user_id=?",
  ).run(manager.user.id);
  assert.equal(
    (await app.inject({ url: list, headers: manager.headers })).statusCode,
    401,
  );
});
test("manager detects absent heartbeats, stalled playback, hidden tabs and outstanding settings, with recovery", async (t) => {
  const { app, db } = await fixture(t),
    manager = await login(app),
    payload = report(db);
  await send(app, payload);
  db.prepare("UPDATE display_screens SET last_seen=? WHERE id=?").run(
    new Date(Date.now() - displayOfflineMs - 1000).toISOString(),
    payload.id,
  );
  assert.equal((await screens(app, manager.headers))[0].health, "offline");
  await send(app, { ...payload, progressAgeMs: 18000 });
  let current = (await screens(app, manager.headers))[0];
  assert.equal(current.health, "warning");
  assert.ok(current.issues.includes("playback_stalled"));
  assert.ok(current.events.filter((e) => e.kind === "connected").length >= 2);
  await send(app, { ...payload, state: "paused", progressAgeMs: 90000 });
  current = (await screens(app, manager.headers))[0];
  assert.equal(current.health, "ok");
  assert.ok(!current.issues.includes("playback_stalled"));
  await send(app, { ...payload, visible: false });
  assert.equal((await screens(app, manager.headers))[0].health, "warning");
  saveSettings(db, { displaySeconds: 17 });
  await send(app, payload);
  current = (await screens(app, manager.headers))[0];
  assert.equal(current.current, false);
  assert.equal(current.waitingUpdate, true);
  await send(app, { ...payload, revision: displayRevision(db), syncAgeMs: 0 });
  assert.equal((await screens(app, manager.headers))[0].health, "ok");
  await send(app, {
    ...payload,
    revision: displayRevision(db),
    syncAgeMs: 160000,
  });
  assert.equal((await screens(app, manager.headers))[0].current, false);
  assert.equal(
    displayScreenHealth(
      { ...payload, state: "standby", progressAgeMs: 90000 },
      now(),
      payload.revision,
    ).issues.length,
    0,
  );
});
test("incidents and recoveries are deduplicated, retain their time and have bounded history", async (t) => {
  const { app, db } = await fixture(t),
    manager = await login(app),
    payload = report(db);
  await send(app, payload);
  for (let i = 0; i < 4; i++)
    assert.equal(
      (await send(app, { ...payload, issues: ["video_load"] })).statusCode,
      200,
    );
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) n FROM display_screen_events WHERE kind='error'",
      )
      .get().n,
    1,
  );
  await send(app, payload);
  let view = (await screens(app, manager.headers))[0];
  assert.equal(view.events[0].kind, "recovered");
  assert.deepEqual(view.events[0].codes, ["video_load"]);
  assert.ok(view.events[0].occurred_at);
  for (let i = 0; i < 52; i++)
    assert.equal(
      (await send(app, { ...payload, issues: i % 2 ? ["image_load"] : [] }))
        .statusCode,
      200,
    );
  assert.ok(
    db.prepare("SELECT COUNT(*) n FROM display_screen_events").get().n <= 50,
  );
});
test("screen naming uses revisions; only offline screens can be hidden and the same authenticated identity reappears", async (t) => {
  const { app, db } = await fixture(t),
    manager = await login(app, "agent"),
    payload = report(db);
  await send(app, payload);
  let r = await app.inject({
    method: "PATCH",
    url: `${list}/${payload.id}`,
    headers: manager.headers,
    payload: { name: "Accueil · TV principale", revision: 1 },
  });
  assert.equal(r.statusCode, 200, r.body);
  r = await app.inject({
    method: "PATCH",
    url: `${list}/${payload.id}`,
    headers: manager.headers,
    payload: { name: "Ancien nom", revision: 1 },
  });
  assert.equal(r.statusCode, 409);
  assert.equal(
    (await send(app, payload)).json().name,
    "Accueil · TV principale",
  );
  const other = report(db);
  await send(app, other);
  assert.equal(
    (
      await app.inject({
        method: "DELETE",
        url: `${list}/${payload.id}`,
        headers: manager.headers,
        payload: { revision: 2 },
      })
    ).statusCode,
    409,
  );
  db.prepare("UPDATE display_screens SET last_seen=? WHERE id=?").run(
    new Date(Date.now() - displayOfflineMs - 1000).toISOString(),
    payload.id,
  );
  r = await app.inject({
    method: "DELETE",
    url: `${list}/${payload.id}`,
    headers: manager.headers,
    payload: { revision: 2 },
  });
  assert.equal(r.statusCode, 200);
  assert.deepEqual(
    (await screens(app, manager.headers)).map((s) => s.id),
    [other.id],
  );
  assert.equal(
    (
      await send(app, {
        ...payload,
        token: randomBytes(32).toString("base64url"),
      })
    ).statusCode,
    403,
  );
  assert.equal((await send(app, payload)).statusCode, 200);
  const restored = (await screens(app, manager.headers)).find(
    (s) => s.id === payload.id,
  );
  assert.equal(restored.name, "Accueil · TV principale");
  assert.ok(restored.revision > 2);
  assert.equal(
    (await app.inject({ url: "/api/public/display" })).statusCode,
    200,
  );
  assert.equal(settings(db).displayEnabled, false);
});
test("new screen registrations are bounded per network without throttling an existing TV", async (t) => {
  const { app, db } = await fixture(t);
  let first;
  for (let i = 0; i < 10; i++) {
    const p = report(db);
    first ||= p;
    assert.equal((await send(app, p)).statusCode, 200);
  }
  assert.equal((await send(app, report(db))).statusCode, 429);
  assert.equal((await send(app, first)).statusCode, 200);
});
test("schema 20 migration preserves data and sessions, and screen identities survive reopening", async (t) => {
  const { app, db, c } = await fixture(t),
    manager = await login(app),
    aid = animal(db);
  db.exec(
    "DROP TABLE display_screen_events;DROP TABLE display_screens;PRAGMA user_version=20;",
  );
  const migrated = openDb(c);
  assert.equal(migrated.prepare("PRAGMA user_version").get().user_version, 24);
  assert.equal(migrated.prepare("SELECT COUNT(*) n FROM sessions").get().n, 1);
  assert.equal(
    migrated.prepare("SELECT id FROM animals WHERE id=?").get(aid).id,
    aid,
  );
  migrated.close();
  const payload = report(db);
  await send(app, payload);
  const reopened = openDb(c);
  assert.equal(
    reopened.prepare("SELECT id FROM display_screens").get().id,
    payload.id,
  );
  assert.deepEqual(reopened.prepare("PRAGMA foreign_key_check").all(), []);
  reopened.close();
  assert.equal((await send(app, payload)).statusCode, 200);
  assert.equal((await screens(app, manager.headers)).length, 1);
});
test("browser telemetry keeps stable credentials, supports blocked storage, uses actual playback progress and posts no secrets in URLs", async () => {
  const map = new Map(),
    store = { getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v) };
  const first = displayIdentity({ local: store }),
    second = displayIdentity({ local: store });
  assert.equal(first.id, second.id);
  assert.equal(first.token, second.token);
  assert.equal(first.persistent, true);
  const blocked = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
  };
  const fallback = displayIdentity({ local: blocked, session: store });
  assert.equal(fallback.id, first.id);
  assert.equal(fallback.persistent, false);
  assert.notEqual(displayIdentity({ local: store, reset: true }).id, first.id);
  assert.ok(displayIdentity({ local: blocked, session: blocked }).token);
  let clock = 0;
  const tracker = playbackTelemetry(() => clock),
    environment = {
      visible: true,
      fullscreen: true,
      width: 1920,
      height: 1080,
    };
  tracker.sync();
  tracker.player({
    state: "playing",
    revision: "a".repeat(64),
    cursor: 1,
    scene: null,
    issues: [],
  });
  clock = 18000;
  assert.equal(tracker.snapshot(environment).progressAgeMs, 18000);
  tracker.player({ state: "playing", cursor: 2 });
  assert.equal(tracker.snapshot(environment).progressAgeMs, 0);
  tracker.failed();
  assert.deepEqual(tracker.snapshot(environment).issues, ["programme_fetch"]);
  tracker.sync();
  assert.equal(tracker.snapshot(environment).issues.length, 0);
  let called;
  await postDisplayHeartbeat(first, tracker.snapshot(environment), {
    fetcher: async (url, options) => {
      called = { url, options };
      return new Response(
        JSON.stringify({ id: first.id, name: "Accueil", intervalMs: 20000 }),
      );
    },
  });
  assert.equal(called.url, heartbeat);
  assert.equal(called.options.credentials, "same-origin");
  assert.equal(JSON.parse(called.options.body).token, first.token);
  assert.ok(!called.url.includes(first.token));
  await assert.rejects(
    () =>
      postDisplayHeartbeat(first, tracker.snapshot(environment), {
        fetcher: async () =>
          new Response(JSON.stringify({ error: "Retiré" }), { status: 410 }),
      }),
    (e) => e.status === 410,
  );
});
test("real client reports reach the server with correct progress, incident recovery and applied configuration", async (t) => {
  const { app, db } = await fixture(t),
    manager = await login(app, "agent");
  const client = displayIdentity(),
    environment = {
      visible: true,
      fullscreen: true,
      width: 1080,
      height: 1920,
    };
  let tick = 0;
  const tracker = playbackTelemetry(() => tick);
  const fetcher = async (url, options) => {
    const response = await app.inject({
      method: options.method,
      url,
      headers: { ...options.headers, origin: "http://localhost:3000" },
      payload: options.body,
    });
    return new Response(response.body, { status: response.statusCode });
  };
  tracker.sync();
  tracker.player({
    state: "playing",
    revision: displayRevision(db),
    cursor: 24,
    scene: {
      key: "logo:0",
      title: "Logo SPA",
      type: "logo",
      position: 1,
      duration: 6,
    },
    issues: [],
  });
  await postDisplayHeartbeat(client, tracker.snapshot(environment), {
    fetcher,
  });
  assert.equal((await screens(app, manager.headers))[0].health, "ok");
  tick = 17000;
  await postDisplayHeartbeat(client, tracker.snapshot(environment), {
    fetcher,
  });
  assert.ok(
    (await screens(app, manager.headers))[0].issues.includes(
      "playback_stalled",
    ),
  );
  tracker.player({ state: "playing", cursor: 48, issues: ["video_autoplay"] });
  await postDisplayHeartbeat(client, tracker.snapshot(environment), {
    fetcher,
  });
  assert.ok(
    (await screens(app, manager.headers))[0].issues.includes("video_autoplay"),
  );
  tracker.player({ state: "playing", cursor: 72, issues: [] });
  tracker.sync();
  await postDisplayHeartbeat(client, tracker.snapshot(environment), {
    fetcher,
  });
  const current = (await screens(app, manager.headers))[0];
  assert.equal(current.health, "ok");
  assert.equal(current.events[0].kind, "recovered");
});
