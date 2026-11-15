import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, login, animal } from "./helpers.mjs";
import { saveSettings } from "../server/db.mjs";
import { defaultModules } from "../shared/modules.mjs";

const origin = "http://localhost:3000";
const view = (app, headers = {}, body = { page: "animals" }) =>
  app.inject({
    method: "POST",
    url: "/api/audience/pageview",
    headers: { origin, ...headers },
    payload: body,
  });

test("rejected anonymous measurement never stores IP, browser or account in either journal", async (t) => {
  const { app, db } = await fixture(t),
    admin = await login(app);
  const access = db.prepare("SELECT COUNT(*) n FROM access_log").get().n;
  const errors = db.prepare("SELECT COUNT(*) n FROM diagnostic_log").get().n;
  assert.equal(
    (await view(app, admin.headers, { page: "forbidden/private-token" }))
      .statusCode,
    400,
  );
  assert.equal(
    (await view(app, { ...admin.headers, origin: "https://evil.invalid" }))
      .statusCode,
    403,
  );
  assert.equal(db.prepare("SELECT COUNT(*) n FROM access_log").get().n, access);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM diagnostic_log").get().n,
    errors,
  );
});

test("anonymous audience counts consultations without cookies, identities or detailed consent", async (t) => {
  const { app, db } = await fixture(t);
  assert.equal(
    (
      await view(app, {
        "user-agent": "CONFIDENTIAL_BROWSER",
        "x-forwarded-for": "198.51.100.42",
      })
    ).statusCode,
    204,
  );
  const response = await view(app);
  assert.equal(response.statusCode, 204);
  assert.equal(response.headers["set-cookie"], undefined);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM visits").get().n, 0);
  const rows = db.prepare("SELECT * FROM audience_daily").all();
  assert.equal(rows.length, 1);
  assert.deepEqual(Object.keys(rows[0]).sort(), ["day", "page", "views"]);
  assert.equal(rows[0].page, "animals");
  assert.equal(rows[0].views, 2);
  assert.ok(!JSON.stringify(rows).includes("CONFIDENTIAL_BROWSER"));
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) n FROM access_log WHERE path='/api/audience/pageview'",
      )
      .get().n,
    0,
  );
  assert.equal(
    (await view(app, { origin: "https://evil.invalid" })).statusCode,
    403,
  );
  assert.equal(
    (await view(app, {}, { page: "animal/secret-token" })).statusCode,
    400,
  );
  assert.equal(
    (await view(app, {}, { page: "animals", session: "forbidden" })).statusCode,
    400,
  );
});

test("audience honours GPC, persistent opposition, admin switch, retention and permissions", async (t) => {
  const { app, db } = await fixture(t),
    admin = await login(app),
    viewer = await login(app, "viewer");
  assert.equal((await view(app, { "sec-gpc": "1" })).statusCode, 204);
  const preference = await app.inject({
    method: "POST",
    url: "/api/audience/preference",
    headers: { origin },
    payload: { optOut: true },
  });
  assert.equal(preference.statusCode, 200, preference.body);
  const cookie = preference.headers["set-cookie"].split(";")[0];
  assert.equal((await view(app, { cookie })).statusCode, 204);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM audience_daily").get().n, 0);
  assert.equal(
    (await app.inject({ url: "/api/privacy", headers: { cookie } })).json()
      .audience.optedOut,
    true,
  );
  for (const [headers, code] of [
    [{}, 401],
    [viewer.headers, 403],
  ])
    assert.equal(
      (await app.inject({ url: "/api/admin/audience", headers })).statusCode,
      code,
    );
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: "/api/admin/audience",
        headers: admin.headers,
        payload: { enabled: false },
      })
    ).statusCode,
    200,
  );
  await view(app);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM audience_daily").get().n, 0);
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: "/api/admin/audience",
        headers: admin.headers,
        payload: { enabled: true },
      })
    ).statusCode,
    200,
  );
  db.prepare("INSERT INTO audience_daily VALUES (?,?,?)").run(
    "2000-01-01",
    "animals",
    99,
  );
  await view(app);
  const summary = await app.inject({
    url: "/api/admin/audience?days=7",
    headers: admin.headers,
  });
  assert.equal(summary.statusCode, 200, summary.body);
  assert.equal(summary.json().total, 1);
  assert.equal(summary.json().retentionDays, 90);
  assert.equal(
    db
      .prepare("SELECT COUNT(*) n FROM audience_daily WHERE day='2000-01-01'")
      .get().n,
    0,
  );
});

test("anonymous collection behind the PIN never creates network sessions or device cookies", async (t) => {
  const { app, db } = await fixture(t),
    agent = await login(app, "agent");
  saveSettings(db, {
    accessPinEnabled: true,
    refugeNetworks: ["127.0.0.1/32"],
    refugeAgentId: agent.user.id,
  });
  const before = db.prepare("SELECT COUNT(*) n FROM sessions").get().n;
  const r = await view(app);
  assert.equal(r.statusCode, 204, r.body);
  assert.equal(r.headers["set-cookie"], undefined);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM sessions").get().n, before);
  assert.equal((await app.inject({ url: "/api/animals" })).statusCode, 200); // existing network login still works outside collection
});

test("optional register, photo planning, inbox and agenda modules block their APIs and preserve data", async (t) => {
  const { app, db } = await fixture(t),
    admin = await login(app),
    aid = animal(db);
  const modules = {
    ...defaultModules,
    register: false,
    photoPlanning: false,
    inbox: false,
    agenda: false,
  };
  const r = await app.inject({
    method: "PUT",
    url: "/api/admin/modules",
    headers: admin.headers,
    payload: { modules, publicPosters: true },
  });
  assert.equal(r.statusCode, 200, r.body);
  for (const url of [
    "/api/internal-register",
    "/api/tasks",
    "/api/shoot-sheet",
    "/api/inbox/count",
    "/api/agenda",
  ]) {
    const response = await app.inject({ url, headers: admin.headers });
    assert.equal(response.statusCode, 503, url + response.body);
  }
  assert.ok(db.prepare("SELECT id FROM animals WHERE id=?").get(aid));
  const restore = await app.inject({
    method: "PUT",
    url: "/api/admin/modules",
    headers: admin.headers,
    payload: { modules: { register: true }, publicPosters: true },
  });
  assert.equal(restore.statusCode, 200, restore.body);
  assert.equal(
    (
      await app.inject({ url: "/api/admin/modules", headers: admin.headers })
    ).json().modules.inbox,
    false,
  );
  assert.equal(
    (
      await app.inject({
        url: "/api/internal-register",
        headers: admin.headers,
      })
    ).statusCode,
    200,
  );
});
