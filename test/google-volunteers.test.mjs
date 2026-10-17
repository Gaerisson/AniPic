import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, createHash } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { fixture, login, animal } from "./helpers.mjs";
import { saveSettings } from "../server/db.mjs";
import { createSession } from "../server/auth.mjs";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const publicPem = publicKey.export({ type: "spki", format: "pem" });
const cookie = (r, name) =>
  []
    .concat(r.headers["set-cookie"] || [])
    .find((s) => s.startsWith(name + "="))
    ?.split(";")[0];
const hash = (v) => createHash("sha256").update(v).digest("base64url");
async function googleFixture(t, options = {}) {
  const codes = new Map();
  let counter = 0;
  const f = await fixture(t, {
    googleClientId: "fixture.apps.googleusercontent.com",
    googleClientSecret: "fixture-only-secret",
    googleClientFactory: (cfg) => {
      const client = new OAuth2Client({
        clientId: cfg.clientId,
        clientSecret: cfg.secret,
        redirectUri: cfg.redirectUri,
      });
      client.getFederatedSignonCertsAsync = async () => ({
        certs: { fixture: publicPem },
        format: "PEM",
      });
      client.getToken = async ({ code, codeVerifier, redirect_uri }) => {
        const item = codes.get(code);
        codes.delete(code);
        assert.ok(item, "authorization code must exist and be single-use");
        assert.equal(
          hash(codeVerifier),
          item.challenge,
          "PKCE verifier must match the authorization request",
        );
        assert.equal(redirect_uri, cfg.redirectUri);
        return { tokens: { id_token: item.jwt } };
      };
      return client;
    },
    ...options,
  });
  saveSettings(f.db, { googleLoginEnabled: true });
  const start = async () => {
    const r = await f.app.inject({
      method: "POST",
      url: "/api/auth/google/start",
      headers: { origin: "http://localhost:3000" },
      payload: {},
    });
    assert.equal(r.statusCode, 200, r.body);
    const u = new URL(r.json().url);
    assert.equal(u.origin, "https://accounts.google.com");
    assert.equal(u.searchParams.get("code_challenge_method"), "S256");
    return { url: u, headers: { cookie: cookie(r, "anipic_google") } };
  };
  const finish = async (flow, claims = {}, extra = {}) => {
    const at = Math.floor(Date.now() / 1000),
      header = Buffer.from(
        JSON.stringify({ alg: "RS256", kid: "fixture", typ: "JWT" }),
      ).toString("base64url");
    const payload = {
      iss: "https://accounts.google.com",
      aud: "fixture.apps.googleusercontent.com",
      iat: at,
      exp: at + 3600,
      sub: "google-subject-one",
      email: "volunteer@example.test",
      email_verified: true,
      name: "Camille bénévole",
      nonce: flow.url.searchParams.get("nonce"),
      ...claims,
    };
    const body =
        header +
        "." +
        Buffer.from(JSON.stringify(payload)).toString("base64url"),
      jwt =
        body +
        "." +
        sign("RSA-SHA256", Buffer.from(body), privateKey).toString("base64url");
    const code = "test-code-" + ++counter;
    codes.set(code, {
      jwt: extra.badSignature ? jwt.slice(0, -8) + "badvalue" : jwt,
      challenge: flow.url.searchParams.get("code_challenge"),
    });
    return f.app.inject({
      url:
        "/api/auth/google/callback?" +
        new URLSearchParams({
          state: flow.url.searchParams.get("state"),
          code,
        }),
      headers: flow.headers,
    });
  };
  return { ...f, start, finish };
}

test("Google volunteer requests require explicit admin approval; no session before approval and no account linking by email", async (t) => {
  const f = await googleFixture(t),
    admin = await login(f.app),
    viewer = await login(f.app, "viewer");
  const start = await f.start(),
    r = await f.finish(start, {
      name: "admin",
      email: "admin@example.test",
      role: "admin",
    });
  assert.match(r.headers.location, /google=pending/);
  assert.equal(cookie(r, "anipic_session"), undefined);
  const g = f.db.prepare("SELECT * FROM google_identities").get(),
    u = f.db.prepare("SELECT * FROM users WHERE id=?").get(g.user_id);
  assert.notEqual(u.id, admin.user.id);
  assert.equal(u.role, "volunteer");
  assert.equal(u.active, 0);
  assert.equal(
    (await f.app.inject({ url: "/api/video/projects" })).statusCode,
    401,
  );
  const url = `/api/admin/volunteers/${u.id}/review`;
  assert.equal(
    (
      await f.app.inject({
        method: "POST",
        url,
        headers: viewer.headers,
        payload: { decision: "approve" },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await f.app.inject({
        method: "POST",
        url,
        headers: { cookie: admin.headers.cookie },
        payload: { decision: "approve" },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await f.app.inject({
        method: "PATCH",
        url: `/api/admin/users/${u.id}`,
        headers: admin.headers,
        payload: { active: true, role: "admin" },
      })
    ).statusCode,
    409,
  );
  // A pending identity cannot gain access even if a row is accidentally active.
  f.db.prepare("UPDATE users SET active=1 WHERE id=?").run(u.id);
  const forced = createSession(f.db, u.id);
  assert.equal(
    (
      await f.app.inject({
        url: "/api/session",
        headers: { cookie: "anipic_session=" + forced.token },
      })
    ).json().user,
    null,
  );
  const reviewed = await f.app.inject({
    method: "POST",
    url,
    headers: admin.headers,
    payload: { decision: "approve" },
  });
  assert.equal(reviewed.statusCode, 200, reviewed.body);
  const logged = await f.finish(await f.start());
  assert.match(logged.headers.location, /google=connected/);
  const session = await f.app.inject({
    url: "/api/session",
    headers: { cookie: cookie(logged, "anipic_session") },
  });
  assert.equal(session.json().user.id, u.id);
  assert.equal(session.json().user.role, "volunteer");
  assert.equal(
    f.db.prepare("SELECT COUNT(*) n FROM google_identities").get().n,
    1,
  );
  const updated = await f.app.inject({
    method: "PATCH",
    url: `/api/admin/users/${u.id}`,
    headers: admin.headers,
    payload: { active: false },
  });
  assert.equal(updated.statusCode, 200);
  assert.equal(
    (
      await f.app.inject({
        url: "/api/session",
        headers: { cookie: cookie(logged, "anipic_session") },
      })
    ).json().user,
    null,
  );
  assert.match(
    (await f.finish(await f.start())).headers.location,
    /google=disabled/,
  );
});

test("Google validates JWT signature, issuer, audience, expiry, nonce and verified email", async (t) => {
  const f = await googleFixture(t);
  for (const [claims, extra] of [
    [{ nonce: "wrong" }, {}],
    [{ aud: "other.apps.googleusercontent.com" }, {}],
    [{ iss: "https://evil.example" }, {}],
    [{ exp: Math.floor(Date.now() / 1000) - 3600 }, {}],
    [{ email_verified: false }, {}],
    [{}, { badSignature: true }],
  ]) {
    const r = await f.finish(await f.start(), claims, extra);
    assert.match(r.headers.location, /google=invalid/);
    assert.equal(
      f.db.prepare("SELECT COUNT(*) n FROM google_identities").get().n,
      0,
    );
  }
});

test("Google callback is browser-bound, single-use and expiring, without removing global PIN protection", async (t) => {
  const f = await googleFixture(t);
  saveSettings(f.db, { accessPinEnabled: true });
  assert.equal(
    (await f.app.inject("/api/animals")).json().code,
    "SITE_PIN_REQUIRED",
  );
  assert.equal(
    (await f.app.inject("/api/auth/google/status")).json().available,
    true,
  );
  assert.equal(
    (
      await f.app.inject({
        method: "POST",
        url: "/api/auth/google/start",
        headers: { origin: "https://evil.example" },
        payload: {},
      })
    ).statusCode,
    403,
  );
  let flow = await f.start();
  const r = await f.finish({ ...flow, headers: {} });
  assert.match(r.headers.location, /google=invalid/);
  const accepted = await f.finish(flow);
  assert.match(accepted.headers.location, /google=pending/);
  assert.match((await f.finish(flow)).headers.location, /google=invalid/);
  flow = await f.start();
  f.db
    .prepare("UPDATE google_oauth SET expires_at='2000-01-01T00:00:00.000Z'")
    .run();
  assert.match((await f.finish(flow)).headers.location, /google=invalid/);
  flow = await f.start();
  flow.url.searchParams.set("state", "incorrect-state-long-enough");
  assert.match((await f.finish(flow)).headers.location, /google=invalid/);
  assert.equal(
    (await f.app.inject("/api/video/projects")).json().code,
    "SITE_PIN_REQUIRED",
  );
});

test("rejected Google requests remain blocked and the connector secret is admin-only", async (t) => {
  const f = await googleFixture(t),
    admin = await login(f.app);
  await f.finish(await f.start());
  const g = f.db.prepare("SELECT * FROM google_identities").get();
  await f.app.inject({
    method: "POST",
    url: `/api/admin/volunteers/${g.user_id}/review`,
    headers: admin.headers,
    payload: { decision: "reject" },
  });
  assert.match(
    (await f.finish(await f.start())).headers.location,
    /google=rejected/,
  );
  const cfg = await f.app.inject({
    url: "/api/admin/google-auth",
    headers: admin.headers,
  });
  assert.equal(cfg.statusCode, 200);
  assert.doesNotMatch(cfg.body, /fixture-only-secret/);
  assert.equal((await f.app.inject("/api/admin/google-auth")).statusCode, 401);
  assert.doesNotMatch(
    (await f.app.inject("/api/overview")).body,
    /fixture-only-secret/,
  );
});

test("volunteer role reaches creation tools, stats, C8 and albums but never administration, register or TV configuration", async (t) => {
  const { app, db } = await fixture(t),
    v = await login(app, "volunteer"),
    id = animal(db);
  for (const url of [
    "/api/video/projects",
    "/api/video/assets",
    "/api/video/year/2026",
    "/api/media-tags",
    "/api/stats",
    "/api/collections",
    "/api/animals?archive=1",
    "/api/broadcasts",
  ]) {
    const r = await app.inject({ url, headers: v.headers });
    assert.ok(r.statusCode !== 401 && r.statusCode !== 403, url + " " + r.body);
  }
  let r = await app.inject({
    method: "POST",
    url: "/api/collections",
    headers: v.headers,
    payload: { name: "Créations bénévoles" },
  });
  assert.equal(r.statusCode, 201, r.body);
  for (const url of [
    "/api/admin/users",
    "/api/admin/settings",
    "/api/admin/google-auth",
    "/api/admin/display",
    "/api/internal-register",
  ]) {
    r = await app.inject({ url, headers: v.headers });
    assert.equal(r.statusCode, 403, url + " " + r.body);
  }
  r = await app.inject({
    method: "POST",
    url: `/api/animals/${id}/archive`,
    headers: v.headers,
    payload: {},
  });
  assert.equal(r.statusCode, 403);
  db.prepare("UPDATE animals SET source_metadata=? WHERE id=?").run(
    JSON.stringify({
      thumbnail: "https://www.la-spa.fr/app/uploads/animals/volunteer.jpg",
    }),
    id,
  );
  r = await app.inject({
    method: "POST",
    url: "/api/video/projects",
    headers: v.headers,
    payload: {
      title: "Présentation depuis sa fiche",
      clips: [{ kind: "spa", ref: id, seconds: 4 }],
    },
  });
  assert.equal(r.statusCode, 201, r.body);
  assert.equal(
    db
      .prepare("SELECT created_by FROM video_projects WHERE id=?")
      .get(r.json().id).created_by,
    v.user.id,
  );
});

test("Google interface configuration stores the secret outside settings exports and disabled connector refuses sign-in", async (t) => {
  const { app } = await fixture(t),
    admin = await login(app),
    volunteer = await login(app, "volunteer");
  const payload = {
    enabled: true,
    clientId: "web.apps.googleusercontent.com",
    clientSecret: "private-client-secret-for-test",
  };
  const refused = await app.inject({
    method: "PUT",
    url: "/api/admin/google-auth",
    headers: volunteer.headers,
    payload,
  });
  assert.equal(refused.statusCode, 403);
  const r = await app.inject({
    method: "PUT",
    url: "/api/admin/google-auth",
    headers: admin.headers,
    payload,
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().configured, true);
  assert.equal(r.json().secretSource, "interface");
  assert.doesNotMatch(r.body, /private-client-secret-for-test/);
  assert.equal(
    (await app.inject("/api/auth/google/status")).json().available,
    true,
  );
  const exported = await app.inject({
    url: "/api/admin/settings/export",
    headers: admin.headers,
  });
  assert.equal(exported.statusCode, 200);
  assert.doesNotMatch(exported.body, /private-client-secret-for-test/);
  await app.inject({
    method: "PUT",
    url: "/api/admin/google-auth",
    headers: admin.headers,
    payload: { enabled: false, clientId: payload.clientId },
  });
  assert.equal(
    (await app.inject("/api/auth/google/status")).json().available,
    false,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/auth/google/start",
        headers: { origin: "http://localhost:3000" },
        payload: {},
      })
    ).statusCode,
    503,
  );
});
