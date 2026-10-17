import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, login } from "./helpers.mjs";
import { saveSettings } from "../server/db.mjs";
import { createSession, hashToken } from "../server/auth.mjs";
const config = {
  canvaClientId: "OC-pin",
  canvaClientSecret: "private",
  canvaEncryptionKey: Buffer.alloc(32, 9).toString("base64"),
};
for (const pin of [false, true])
  test(`Canva callback with PIN ${pin}: cross-site cookie, session/state/expiry/owner isolation`, async (t) => {
    let calls = 0;
    const { app, db } = await fixture(t, {
      ...config,
      canvaFetcher: async () => {
        calls++;
        return new Response(
          JSON.stringify({
            access_token: "a",
            refresh_token: "r",
            scope: "design:content:write design:meta:read",
            expires_in: 3600,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    });
    const alice = await login(app, "agent"),
      bob = await login(app, "editor");
    saveSettings(db, { accessPinEnabled: pin });
    async function begin() {
      const r = await app.inject({
        method: "POST",
        url: "/api/canva/connect",
        headers: alice.headers,
        payload: {},
      });
      assert.equal(r.statusCode, 200, r.body);
      const cookie = [r.headers["set-cookie"]]
        .flat()
        .find((c) => c.startsWith("anipic_canva_return="));
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /SameSite=Lax/);
      assert.match(cookie, /Path=\/api\/canva\/callback/);
      assert.match(cookie, /Max-Age=600/);
      const state = new URL(r.json().url).searchParams.get("state");
      return {
        url: `/api/canva/callback?state=${state}&code=valid-code`,
        cookie: cookie.split(";")[0],
        state,
      };
    }
    let flow = await begin();
    assert.equal((await app.inject({ url: flow.url })).statusCode, 401);
    assert.equal(
      (
        await app.inject({
          url: "/api/canva/status",
          headers: { cookie: flow.cookie },
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (
        await app.inject({
          url: flow.url,
          headers: { cookie: bob.headers.cookie + "; " + flow.cookie },
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await app.inject({
          url: flow.url.replace(flow.state, "wrong-state-000000000000000000"),
          headers: { cookie: flow.cookie },
        })
      ).statusCode,
      400,
    );
    const ok = await app.inject({
      url: flow.url,
      headers: { cookie: flow.cookie },
    });
    assert.equal(ok.statusCode, 302, ok.body);
    assert.match(ok.headers.location, /connected/);
    assert.equal(calls, 1);
    assert.equal(
      db.prepare("SELECT user_id FROM canva_connections").get().user_id,
      alice.user.id,
    );
    assert.equal(
      (await app.inject({ url: flow.url, headers: { cookie: flow.cookie } }))
        .statusCode,
      pin ? 401 : 401,
    );
    flow = await begin();
    db.prepare(
      "UPDATE canva_oauth SET expires_at='2000-01-01T00:00:00.000Z'",
    ).run();
    assert.equal(
      (await app.inject({ url: flow.url, headers: { cookie: flow.cookie } }))
        .statusCode,
      401,
    );
    flow = await begin();
    const other = createSession(db, alice.user.id);
    assert.equal(
      (
        await app.inject({
          url: flow.url,
          headers: {
            cookie: "anipic_session=" + other.token + "; " + flow.cookie,
          },
        })
      ).statusCode,
      400,
    );
    const token = alice.headers.cookie.split("=")[1];
    db.prepare(
      "UPDATE sessions SET expires_at='2000-01-01T00:00:00.000Z' WHERE token_hash=?",
    ).run(hashToken(token));
    assert.equal(
      (await app.inject({ url: flow.url, headers: { cookie: flow.cookie } }))
        .statusCode,
      401,
    );
    assert.equal(calls, 1);
    const protectedRoute = await app.inject({ url: "/api/animals" });
    assert.equal(protectedRoute.statusCode, pin ? 401 : 200);
  });
