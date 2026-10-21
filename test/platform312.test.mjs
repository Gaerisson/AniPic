import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { Readable } from "node:stream";
import { fixture, login, animal } from "./helpers.mjs";
import { id, now, saveSettings, settings } from "../server/db.mjs";
import {
  privacyVersion,
  legalConfig,
  privacyCleanup,
} from "../server/privacy.mjs";
import { defaultModules } from "../shared/modules.mjs";
import {
  notice,
  collectNotifications,
  deliverNotifications,
  validPushEndpoint,
} from "../server/notifications.mjs";
import { hashToken } from "../server/auth.mjs";
import { ingest } from "../server/storage.mjs";
import { displayRevision } from "../server/display-monitor.mjs";
const call = (app, h, method, url, payload) =>
  app.inject({ headers: h, method, url, payload });
export async function allowAudience(app, headers) {
  const db = app.db;
  saveSettings(db, { legal: { ...legalConfig(db), analyticsEnabled: true } });
  const r = await call(app, headers, "POST", "/api/privacy/consent", {
    analytics: true,
    version: privacyVersion,
  });
  assert.equal(r.statusCode, 200, r.body);
  return {
    ...headers,
    cookie: [headers.cookie, r.headers["set-cookie"].split(";")[0]]
      .filter(Boolean)
      .join("; "),
  };
}
test("audience collection is disabled by default and requires a signed current consent; refusal and GPC stop storage", async (t) => {
  const { app, db } = await fixture(t),
    a = await login(app),
    payload = { session: id(), path: "#animals" };
  assert.equal(
    (await call(app, a.headers, "POST", "/api/visit", payload)).statusCode,
    204,
  );
  assert.equal(db.prepare("SELECT COUNT(*) n FROM visits").get().n, 0);
  const headers = await allowAudience(app, a.headers);
  assert.equal(
    (await call(app, headers, "POST", "/api/visit", payload)).statusCode,
    200,
  );
  assert.equal(db.prepare("SELECT COUNT(*) n FROM visits").get().n, 1);
  const forged = {
    ...headers,
    cookie: headers.cookie.replace(
      /anipic_privacy=[^;]+/,
      "anipic_privacy=forged",
    ),
  };
  assert.equal(
    (
      await call(app, forged, "POST", "/api/visit", {
        session: id(),
        path: "#gallery",
      })
    ).statusCode,
    204,
  );
  assert.equal(
    (
      await call(app, { ...headers, "sec-gpc": "1" }, "POST", "/api/visit", {
        session: id(),
        path: "#gallery",
      })
    ).statusCode,
    204,
  );
  const refused = await call(app, headers, "POST", "/api/privacy/consent", {
    analytics: false,
    version: privacyVersion,
  });
  const refusal = {
    ...a.headers,
    cookie:
      a.headers.cookie + "; " + refused.headers["set-cookie"].split(";")[0],
  };
  assert.equal(
    (
      await call(app, refusal, "POST", "/api/visit", {
        session: id(),
        path: "#gallery",
      })
    ).statusCode,
    204,
  );
  assert.equal(db.prepare("SELECT COUNT(*) n FROM visits").get().n, 1);
  assert.equal(
    (
      await call(
        app,
        { ...headers, origin: "https://foreign.invalid" },
        "POST",
        "/api/privacy/consent",
        { analytics: true, version: privacyVersion },
      )
    ).statusCode,
    403,
  );
});
test("public legal settings and consent do not unlock the PIN; retention and admin settings are enforced", async (t) => {
  const { app, db } = await fixture(t),
    a = await login(app),
    v = await login(app, "viewer");
  saveSettings(db, { accessPinEnabled: true });
  const r = await app.inject({ url: "/api/privacy" });
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().complete, false);
  assert.equal((await app.inject({ url: "/api/animals" })).statusCode, 401);
  assert.equal(
    (await call(app, v.headers, "PUT", "/api/admin/legal", {})).statusCode,
    403,
  );
  assert.equal(
    (
      await call(
        app,
        { cookie: a.headers.cookie },
        "PUT",
        "/api/admin/legal",
        legalConfig(db),
      )
    ).statusCode,
    403,
  );
  db.prepare("INSERT INTO visits VALUES (?,?,?,?,?,?,?,?)").run(
    id(),
    "hash",
    "ip",
    null,
    "#gallery",
    "ua",
    null,
    "2020-01-01T00:00:00Z",
  );
  privacyCleanup(db);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM visits").get().n, 0);
  const body = {
    ...legalConfig(db),
    operatorName: "Refuge Test",
    operatorAddress: "Adresse de test",
    contactEmail: "contact@example.org",
    publicationDirector: "Direction",
    hostName: "Hébergeur test",
    hostAddress: "Adresse hébergeur",
    hostContact: "https://example.org",
  };
  const saved = await call(app, a.headers, "PUT", "/api/admin/legal", body);
  assert.equal(saved.statusCode, 200, saved.body);
  assert.equal(saved.json().complete, true);
});
test("module switches block actual APIs, preserve projects and can be restored by administration", async (t) => {
  const { app, db } = await fixture(t),
    a = await login(app),
    v = await login(app, "volunteer"),
    aid = animal(db);
  const body = {
    modules: {
      ...defaultModules,
      video: false,
      photoEditor: false,
      signage: false,
      posters: false,
      planning: false,
    },
    publicPosters: true,
  };
  assert.equal(
    (await call(app, v.headers, "PUT", "/api/admin/modules", body)).statusCode,
    403,
  );
  assert.equal(
    (await call(app, a.headers, "PUT", "/api/admin/modules", body)).statusCode,
    200,
  );
  for (const url of [
    "/api/video/status",
    "/api/photos/" + id() + "/edits",
    "/api/public/display",
    "/api/volunteers",
    "/api/animals/" + aid + "/poster",
    "/api/creative/cutouts",
  ]) {
    const r = await call(app, a.headers, "POST", url, {});
    assert.equal(r.statusCode, 503, url + r.body);
    assert.equal(r.json().code, "MODULE_DISABLED");
  }
  assert.equal(db.prepare("SELECT COUNT(*) n FROM animals").get().n, 1);
  assert.equal(
    (
      await call(app, a.headers, "PUT", "/api/admin/modules", {
        modules: defaultModules,
        publicPosters: true,
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (await call(app, a.headers, "GET", "/api/video/status")).statusCode,
    200,
  );
});
test("volunteer planning validates calendar, roles, CSRF, capacity, ownership and revisions and summarizes actual people", async (t) => {
  const { app, db } = await fixture(t),
    a = await login(app),
    v = await login(app, "volunteer"),
    other = await login(app, "viewer");
  const shift = {
    title: "Collecte de croquettes",
    date: "2026-11-07",
    start: "09:00",
    end: "12:00",
    kind: "collection",
    capacity: 1,
    location: "Accueil",
    description: "Venez aider",
    repeatWeeks: 2,
  };
  assert.equal((await app.inject({ url: "/api/volunteers" })).statusCode, 401);
  assert.equal(
    (await call(app, v.headers, "POST", "/api/volunteers/shifts", shift))
      .statusCode,
    403,
  );
  assert.equal(
    (
      await call(
        app,
        { cookie: a.headers.cookie },
        "POST",
        "/api/volunteers/shifts",
        shift,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await call(app, a.headers, "POST", "/api/volunteers/shifts", {
        ...shift,
        date: "2026-02-30",
      })
    ).statusCode,
    400,
  );
  const r = await call(app, a.headers, "POST", "/api/volunteers/shifts", shift);
  assert.equal(r.statusCode, 200, r.body);
  const key = r.json().ids[0];
  assert.equal(r.json().ids.length, 2);
  assert.equal(
    (
      await call(
        app,
        v.headers,
        "PUT",
        "/api/volunteers/shifts/" + key + "/participation",
        { state: "yes" },
      )
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await call(
        app,
        other.headers,
        "PUT",
        "/api/volunteers/shifts/" + key + "/participation",
        { state: "yes" },
      )
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await call(
        app,
        other.headers,
        "PUT",
        "/api/volunteers/shifts/" + key + "/participation",
        { state: "waitlist" },
      )
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await call(
        app,
        v.headers,
        "PUT",
        "/api/volunteers/shifts/" + key + "/participation",
        { state: "no", userId: other.user.id },
      )
    ).statusCode,
    403,
  );
  const rows = (
    await call(
      app,
      v.headers,
      "GET",
      "/api/volunteers?from=2026-11-07&to=2026-11-14",
    )
  ).json();
  assert.equal(rows.shifts.length, 2);
  assert.equal(rows.days[0].confirmed, 1);
  assert.equal(rows.days[0].people[0].name, "volunteer");
  const { repeatWeeks, ...body } = shift;
  assert.equal(
    (
      await call(app, a.headers, "PUT", "/api/volunteers/shifts/" + key, {
        ...body,
        revision: 1,
        title: "Collecte modifiée",
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await call(app, a.headers, "PUT", "/api/volunteers/shifts/" + key, {
        ...body,
        revision: 1,
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await call(app, a.headers, "DELETE", "/api/volunteers/shifts/" + key, {
        revision: 2,
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await call(
        app,
        v.headers,
        "PUT",
        "/api/volunteers/shifts/" + key + "/participation",
        { state: "yes" },
      )
    ).statusCode,
    404,
  );
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) n FROM notification_events WHERE kind='planning'",
      )
      .get().n,
    4,
  );
});
test("remembered sessions expose revocable device IDs, never tokens and revocation cascades push subscriptions", async (t) => {
  const { app, db } = await fixture(t),
    a = await login(app),
    v = await login(app, "viewer");
  const another = await app.inject({
    method: "POST",
    url: "/api/login",
    payload: { name: "admin", password: "fixture password 12345" },
  });
  assert.match(String(another.headers["set-cookie"]), /Max-Age=7776000/);
  const h = { cookie: another.headers["set-cookie"].split(";")[0] };
  await call(app, h, "GET", "/api/session");
  const data = (
    await call(app, a.headers, "GET", "/api/account/devices")
  ).json();
  assert.equal(data.devices.length, 2);
  assert.equal("token_hash" in data.devices[0], false);
  const target = data.devices.find((d) => !d.current);
  assert.equal(
    (
      await call(
        app,
        v.headers,
        "GET",
        "/api/account/devices?userId=" + a.user.id,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (await call(app, a.headers, "DELETE", "/api/account/devices/" + target.id))
      .statusCode,
    200,
  );
  assert.equal((await call(app, h, "GET", "/api/session")).json().user, null);
  assert.ok(
    (await call(app, a.headers, "GET", "/api/account/data")).json().account.id,
  );
});
test("push notifications validate endpoints and permissions, deduplicate events, and stop on logout", async (t) => {
  const sent = [],
    { app, db, c } = await fixture(t, {
      pushSender: async (...args) => {
        sent.push(args);
      },
    }),
    a = await login(app),
    prefs = { arrivals: true, adoptions: true, photos: true, planning: true };
  assert.equal(validPushEndpoint("https://127.0.0.1/x"), false);
  assert.equal(
    validPushEndpoint("https://fcm.googleapis.com.evil.test/x"),
    false,
  );
  assert.equal(validPushEndpoint("http://fcm.googleapis.com/x"), false);
  assert.equal(validPushEndpoint("https://fcm.googleapis.com/x"), true);
  assert.equal(
    (await call(app, a.headers, "PUT", "/api/notifications/preferences", prefs))
      .statusCode,
    200,
  );
  const sub = {
    endpoint: "https://fcm.googleapis.com/fcm/send/test",
    keys: {
      p256dh: randomBytes(65).toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    },
  };
  assert.equal(
    (
      await call(
        app,
        { cookie: a.headers.cookie },
        "POST",
        "/api/notifications/subscriptions",
        sub,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await call(
        app,
        a.headers,
        "POST",
        "/api/notifications/subscriptions",
        sub,
      )
    ).statusCode,
    200,
  );
  const aid = animal(db);
  collectNotifications(db);
  collectNotifications(db);
  await deliverNotifications(db, c);
  assert.equal(sent.length, 1);
  assert.match(sent[0][1], /Nala/);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM notification_events").get().n,
    1,
  );
  await call(app, a.headers, "POST", "/api/logout", {});
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM notification_subscriptions").get().n,
    0,
  );
  notice(db, {
    id: id(),
    kind: "arrivals",
    animalId: aid,
    title: "Test",
    body: "Nala",
    url: "/#feed",
  });
  await deliverNotifications(db, c);
  assert.equal(sent.length, 1);
});
test("writing preserves SPA facts, saves private proposals and uses configured Harbor only on request", async (t) => {
  let calls = 0;
  const { app, db } = await fixture(t, {
      tokenharborApiKey: "fixture",
      aiFetcher: async () => {
        calls++;
        return new Response(
          JSON.stringify({
            choices: [
              { message: { content: "Texte corrigé sans fait ajouté." } },
            ],
          }),
          { status: 200 },
        );
      },
    }),
    v = await login(app, "volunteer"),
    other = await login(app, "viewer"),
    aid = animal(db);
  saveSettings(db, { tokenharborModel: "fixture-model" });
  const original = db
    .prepare("SELECT description FROM animals WHERE id=?")
    .get(aid).description;
  const review = await call(app, v.headers, "GET", "/api/writing/review");
  assert.equal(review.statusCode, 200, review.body);
  assert.equal(review.json().animals[0].localPhotos, 0);
  let r = await call(app, v.headers, "POST", "/api/writing/generate", {
    animalId: aid,
    mode: "correct",
    original: "Un  acceuil chaleureux .",
    provider: "local",
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.match(r.json().proposal, /accueil/);
  assert.equal(calls, 0);
  r = await call(app, v.headers, "POST", "/api/writing/generate", {
    animalId: aid,
    mode: "correct",
    original: "Texte de test",
    provider: "tokenharbor",
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(calls, 1);
  assert.equal(
    db.prepare("SELECT description FROM animals WHERE id=?").get(aid)
      .description,
    original,
  );
  assert.equal(
    (await call(app, other.headers, "GET", "/api/writing/drafts")).json().drafts
      .length,
    0,
  );
  assert.equal(
    (await app.inject({ url: "/api/writing/review" })).statusCode,
    401,
  );
});
test("real TV snapshots are screen-token protected, command-bound and manager-only; per-screen options survive refresh", async (t) => {
  const { app, db } = await fixture(t),
    a = await login(app),
    v = await login(app, "viewer");
  const payload = {
    id: id(),
    token: randomBytes(32).toString("base64url"),
    state: "playing",
    visible: true,
    fullscreen: false,
    persistent: true,
    width: 1920,
    height: 1080,
    revision: displayRevision(db),
    syncAgeMs: 0,
    progressAgeMs: 0,
    scene: null,
    issues: [],
  };
  const first = await call(
    app,
    {},
    "POST",
    "/api/public/display/heartbeat",
    payload,
  );
  assert.equal(first.statusCode, 200, first.body);
  const cfg = {
    ...first.json().config,
    orientation: "portrait",
    stats: "off",
    photoSeconds: 8,
  };
  assert.equal(
    (
      await call(
        app,
        v.headers,
        "PUT",
        "/api/admin/display/screens/" + payload.id + "/config",
        cfg,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await call(
        app,
        a.headers,
        "PUT",
        "/api/admin/display/screens/" + payload.id + "/config",
        cfg,
      )
    ).statusCode,
    200,
  );
  const r = await call(
    app,
    a.headers,
    "POST",
    "/api/admin/display/screens/" + payload.id + "/command",
    { kind: "snapshot" },
  );
  const command = r.json().id;
  const hb = await call(
    app,
    {},
    "POST",
    "/api/public/display/heartbeat",
    payload,
  );
  assert.equal(hb.json().config.stats, "off");
  assert.equal(hb.json().commands[0].id, command);
  const jpg = await sharp({
      create: { width: 300, height: 200, channels: 3, background: "orange" },
    })
      .jpeg()
      .toBuffer(),
    result = {
      id: payload.id,
      token: payload.token,
      command,
      image: "data:image/jpeg;base64," + jpg.toString("base64"),
    };
  assert.equal(
    (
      await call(app, {}, "POST", "/api/public/display/command-result", {
        ...result,
        token: randomBytes(32).toString("base64url"),
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (await call(app, {}, "POST", "/api/public/display/command-result", result))
      .statusCode,
    200,
  );
  assert.equal(
    (
      await app.inject({
        url: "/api/admin/display/screens/" + payload.id + "/snapshot",
      })
    ).statusCode,
    401,
  );
  const picture = await call(
    app,
    a.headers,
    "GET",
    "/api/admin/display/screens/" + payload.id + "/snapshot",
  );
  assert.equal(picture.headers["content-type"], "image/jpeg");
  assert.ok((await sharp(picture.rawPayload).metadata()).width > 0);
  assert.equal(
    (await call(app, {}, "POST", "/api/public/display/command-result", result))
      .statusCode,
    409,
  );
});
test("anonymous posters render a real PDF from SPA fallback and never choose a private local portrait; PIN remains required", async (t) => {
  let downloads = 0;
  const bytes = await sharp({
    create: { width: 200, height: 300, channels: 3, background: "orange" },
  })
    .jpeg()
    .toBuffer();
  const { app, db, c } = await fixture(t, {
      spaPhotoFetcher: async () => {
        downloads++;
        return bytes;
      },
    }),
    aid = animal(db);
  db.prepare("UPDATE animals SET source_metadata=? WHERE id=?").run(
    JSON.stringify({
      thumbnail: "https://www.la-spa.fr/app/app/uploads/2026/10/nala.jpg",
    }),
    aid,
  );
  const local = await sharp({
    create: { width: 200, height: 300, channels: 3, background: "blue" },
  })
    .jpeg()
    .toBuffer();
  await ingest(db, c, aid, Readable.from(local), "private.jpg", true);
  const headers = { origin: "http://localhost:3000" },
    r = await call(app, headers, "POST", "/api/public/posters", {
      animalIds: [aid],
      template: "spa",
    });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.headers["content-type"], "application/pdf");
  assert.equal(r.rawPayload.subarray(0, 5).toString(), "%PDF-");
  assert.equal(downloads, 1);
  assert.equal(
    (
      await call(
        app,
        { origin: "https://other.invalid" },
        "POST",
        "/api/public/posters",
        { animalIds: [aid] },
      )
    ).statusCode,
    403,
  );
  saveSettings(db, { accessPinEnabled: true });
  assert.equal(
    (
      await call(app, headers, "POST", "/api/public/posters", {
        animalIds: [aid],
      })
    ).statusCode,
    401,
  );
  assert.equal(
    db.prepare("SELECT hidden FROM photos WHERE animal_id=?").get(aid).hidden,
    1,
  );
});
