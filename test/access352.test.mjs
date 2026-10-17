import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, login } from "./helpers.mjs";
import { createApp } from "../server/app.mjs";
import { saveSettings, settings } from "../server/db.mjs";
import { hashPassword, hashToken } from "../server/auth.mjs";
import { gateCookieSeconds } from "../server/site-access.mjs";
import { canManageDisplay } from "../shared/page-access.mjs";
const cookies = (r) =>
  []
    .concat(r.headers["set-cookie"] || [])
    .map((s) => s.split(";")[0])
    .join("; ");
const gateCookie = (r) =>
  []
    .concat(r.headers["set-cookie"] || [])
    .find((s) => s.startsWith("anipic_gate="));
const configurePin = async (db) =>
  saveSettings(db, {
    accessPinEnabled: true,
    accessPinHash: await hashPassword("582104"),
  });

test("SPA agents configure and preview TV without access to unrelated administration", async (t) => {
  const { app, db } = await fixture(t),
    admin = await login(app),
    agent = await login(app, "agent");
  assert.equal(canManageDisplay(agent.user), true);
  assert.equal(canManageDisplay(admin.user), true);
  for (const role of ["editor", "viewer", null])
    assert.equal(canManageDisplay(role ? { role } : null), false);
  let r = await app.inject({
    url: "/api/admin/display",
    headers: agent.headers,
  });
  assert.equal(r.statusCode, 200, r.body);
  const cfg = r.json();
  assert.equal("accessPinHash" in cfg, false);
  assert.equal("refugeAgentId" in cfg, false);
  r = await app.inject({
    method: "POST",
    url: "/api/admin/display/preview",
    headers: agent.headers,
    payload: { ...cfg, displaySeconds: 17 },
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(settings(db).displayEnabled, false);
  const before = settings(db).publicHistoryEnabled;
  r = await app.inject({
    method: "PUT",
    url: "/api/admin/display",
    headers: agent.headers,
    payload: {
      ...cfg,
      displayEnabled: true,
      displaySeconds: 17,
      publicHistoryEnabled: !before,
      accessPinEnabled: true,
    },
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(settings(db).displayEnabled, true);
  assert.equal(settings(db).displaySeconds, 17);
  assert.equal(settings(db).publicHistoryEnabled, before);
  assert.equal(!!settings(db).accessPinEnabled, false);
  assert.equal(
    db
      .prepare(
        "SELECT user_id FROM audit WHERE action='display_configured' ORDER BY created_at DESC LIMIT 1",
      )
      .get().user_id,
    agent.user.id,
  );
  for (const url of [
    "/api/admin/settings",
    "/api/admin/settings/export",
    "/api/admin/users",
    "/api/admin/site-access",
  ]) {
    r = await app.inject({ url, headers: agent.headers });
    assert.equal(r.statusCode, 403, url);
  }
  r = await app.inject({
    method: "PUT",
    url: "/api/admin/display",
    headers: admin.headers,
    payload: { ...cfg, publicHistoryEnabled: !before },
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(settings(db).publicHistoryEnabled, !before);
});

test("TV configuration rejects anonymous, viewer, editor, expired sessions and missing CSRF", async (t) => {
  const { app, db } = await fixture(t),
    admin = await login(app);
  const cfg = (
    await app.inject({ url: "/api/admin/display", headers: admin.headers })
  ).json();
  for (const role of [null, "viewer", "editor"]) {
    const headers = role ? (await login(app, role)).headers : {};
    for (const [method, url] of [
      ["GET", "/api/admin/display"],
      ["PUT", "/api/admin/display"],
      ["POST", "/api/admin/display/preview"],
    ]) {
      const r = await app.inject({
        method,
        url,
        headers,
        ...(method === "GET" ? {} : { payload: cfg }),
      });
      assert.equal(
        r.statusCode,
        role ? 403 : 401,
        role + " " + method + " " + url,
      );
    }
  }
  const agent = await login(app, "agent");
  let r = await app.inject({
    method: "PUT",
    url: "/api/admin/display",
    headers: { cookie: agent.headers.cookie },
    payload: cfg,
  });
  assert.equal(r.statusCode, 403);
  r = await app.inject({
    method: "POST",
    url: "/api/admin/display/preview",
    headers: agent.headers,
    payload: { ...cfg, displaySeconds: 0 },
  });
  assert.equal(r.statusCode, 400);
  db.prepare(
    "UPDATE sessions SET expires_at='2000-01-01T00:00:00.000Z' WHERE user_id=?",
  ).run(agent.user.id);
  r = await app.inject({ url: "/api/admin/display", headers: agent.headers });
  assert.equal(r.statusCode, 401);
});

test("refuge IP automatic agent can manage TV, session remains bound to its network", async (t) => {
  const { app, db } = await fixture(t),
    agent = await login(app, "agent");
  saveSettings(db, {
    refugeNetworks: ["203.0.113.20"],
    refugeAgentId: agent.user.id,
    accessPinEnabled: true,
  });
  let r = await app.inject({
    url: "/api/session",
    remoteAddress: "203.0.113.20",
  });
  assert.equal(r.json().user.role, "agent");
  assert.equal(r.json().gateRequired, false);
  const headers = {
    cookie: cookies(r),
    "x-csrf-token": r.json().user.csrf,
    origin: "http://localhost:3000",
  };
  r = await app.inject({
    url: "/api/admin/display",
    headers,
    remoteAddress: "203.0.113.20",
  });
  assert.equal(r.statusCode, 200, r.body);
  const cfg = r.json();
  r = await app.inject({
    method: "POST",
    url: "/api/admin/display/preview",
    headers,
    remoteAddress: "203.0.113.20",
    payload: cfg,
  });
  assert.equal(r.statusCode, 200, r.body);
  r = await app.inject({
    url: "/api/admin/display",
    headers,
    remoteAddress: "203.0.113.21",
  });
  assert.equal(r.statusCode, 401);
});

test("remembered PIN has a persistent protected cookie, survives session expiry and server restart without becoming a user", async (t) => {
  const { app, db, c } = await fixture(t, { secureCookie: true });
  await configurePin(db);
  let r = await app.inject({
    method: "POST",
    url: "/api/gate/unlock",
    payload: { pin: "582104" },
  });
  assert.equal(r.statusCode, 200, r.body);
  const cookie = gateCookie(r),
    headers = { cookie: cookie.split(";")[0] };
  for (const pattern of [
    /HttpOnly/,
    /SameSite=Strict/,
    /Secure/,
    /Path=\//,
    new RegExp("Max-Age=" + gateCookieSeconds),
    /Expires=/,
  ])
    assert.match(cookie, pattern);
  assert.doesNotMatch(cookie, /582104/);
  const session = await login(app, "agent");
  db.prepare("UPDATE sessions SET expires_at='2000-01-01T00:00:00.000Z'").run();
  r = await app.inject({
    url: "/api/session",
    headers: { cookie: headers.cookie + "; " + session.headers.cookie },
  });
  assert.equal(r.json().gateRequired, false);
  assert.equal(r.json().user, null);
  assert.equal(
    (await app.inject({ url: "/api/admin/display", headers })).statusCode,
    401,
  );
  await app.close();
  const reopened = await createApp(c);
  try {
    r = await reopened.inject({ url: "/api/session", headers });
    assert.equal(r.json().gateRequired, false, r.body);
    assert.equal(r.json().user, null);
    assert.match(gateCookie(r), /Expires=/);
    assert.equal(
      (await reopened.inject({ url: "/api/animals", headers })).statusCode,
      200,
    );
  } finally {
    await reopened.close();
  }
});

test("valid legacy browser permission becomes permanent; legacy expiration and PIN rotation still revoke access", async (t) => {
  const { app, db } = await fixture(t);
  await configurePin(db);
  let r = await app.inject({
    method: "POST",
    url: "/api/gate/unlock",
    payload: { pin: "582104" },
  });
  const headers = { cookie: cookies(r) },
    token = headers.cookie.split("=")[1],
    hash = hashToken(token);
  db.prepare("UPDATE site_passes SET expires_at=? WHERE token_hash=?").run(
    new Date(Date.now() + 5 * 86400_000).toISOString(),
    hash,
  );
  r = await app.inject({ url: "/api/session", headers });
  assert.equal(r.json().gateRequired, false);
  const expiry = db
    .prepare("SELECT expires_at FROM site_passes WHERE token_hash=?")
    .get(hash).expires_at;
  assert.equal(expiry, "");
  assert.match(gateCookie(r), /Max-Age=/);
  db.prepare("UPDATE site_passes SET expires_at=? WHERE token_hash=?").run(
    new Date(Date.now() + 86400_000).toISOString(),
    hash,
  );
  r = await app.inject({ url: "/api/public/display", headers });
  assert.equal(r.statusCode, 200, r.body);
  assert.match(gateCookie(r), /Expires=/);
  assert.equal(
    db
      .prepare("SELECT expires_at FROM site_passes WHERE token_hash=?")
      .get(hash).expires_at,
    "",
  );
  const admin = await login(app);
  r = await app.inject({
    method: "PUT",
    url: "/api/admin/site-access",
    headers: admin.headers,
    payload: { enabled: true, pin: "697213", networks: [], agentId: "" },
  });
  assert.equal(r.statusCode, 200, r.body);
  r = await app.inject({ url: "/api/session", headers });
  assert.equal(r.json().gateRequired, true);
  assert.match(gateCookie(r), /Expires=Thu, 01 Jan 1970/);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM site_passes").get().n, 0);
  r = await app.inject({
    method: "POST",
    url: "/api/gate/unlock",
    payload: { pin: "697213" },
  });
  const newer = { cookie: cookies(r) };
  db.prepare(
    "UPDATE site_passes SET expires_at='2000-01-01T00:00:00.000Z'",
  ).run();
  r = await app.inject({ url: "/api/session", headers: newer });
  assert.equal(r.json().gateRequired, true);
  assert.equal(
    (await app.inject({ url: "/api/animals", headers: newer })).statusCode,
    401,
  );
});

test("PIN authorization has no server expiry even after decades and a server restart", async (t) => {
  const { app, db, c } = await fixture(t);
  await configurePin(db);
  const unlock = await app.inject({
    method: "POST",
    url: "/api/gate/unlock",
    payload: { pin: "582104" },
  });
  assert.equal(unlock.statusCode, 200, unlock.body);
  const headers = { cookie: cookies(unlock) };
  assert.equal(
    db.prepare("SELECT expires_at FROM site_passes").get().expires_at,
    "",
  );
  t.mock.timers.enable({
    apis: ["Date"],
    now: Date.now() + 50 * 365 * 86400_000,
  });
  let reopened;
  try {
    const r = await app.inject({ url: "/api/session", headers });
    assert.equal(r.json().gateRequired, false, r.body);
    assert.equal(r.json().user, null);
    await app.close();
    reopened = await createApp(c);
    const restored = await reopened.inject({ url: "/api/session", headers });
    assert.equal(restored.json().gateRequired, false, restored.body);
    assert.equal(
      reopened.db.prepare("SELECT COUNT(*) n FROM site_passes").get().n,
      1,
    );
    assert.match(gateCookie(restored), /Max-Age=/);
  } finally {
    if (reopened) await reopened.close();
    t.mock.timers.reset();
  }
});
