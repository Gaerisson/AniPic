import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { fixture, login, animal } from "./helpers.mjs";
import { now, id, settings, saveSettings, feedEvent } from "../server/db.mjs";
import { hashPassword } from "../server/auth.mjs";
import { ingest } from "../server/storage.mjs";
import { findSimilar } from "../server/similar-photos.mjs";
import { annualAdoptions } from "../server/annual-statistics.mjs";
import {
  inferAdoption,
  automaticAdoption,
  publicAdoptionOrigin,
  updateDecisionFeed,
} from "../server/adoption-decisions.mjs";
import { collectNotifications } from "../server/notifications.mjs";
import { nightlyNamesDue } from "../server/name-catalogue.mjs";
import { themedNames } from "../shared/name-themes.mjs";
import { textDiff } from "../shared/text-diff.mjs";
import { historyGroups, historyValue } from "../shared/history-groups.mjs";
import {
  normalizeAppPreferences,
  readAppPreferences,
  saveAppPreferences,
} from "../src/app-preferences.mjs";
const call = (app, headers, method, url, payload) =>
  app.inject({ headers, method, url, payload });
const picture = () =>
  sharp({
    create: { width: 240, height: 180, channels: 3, background: "#d89042" },
  })
    .jpeg()
    .toBuffer();
test("160px thumbnails work and deleted photo references cannot reappear in duplicate results; deliberate reupload restores a private original", async (t) => {
  const { app, db, c } = await fixture(t),
    a = animal(db),
    auth = await login(app),
    buffer = await picture();
  const p = await ingest(db, c, a, Readable.from(buffer), "portrait.jpg", true);
  let response = await app.inject({
    url: "/media/" + p.id + "?w=160",
    headers: auth.headers,
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal((await sharp(response.rawPayload).metadata()).width, 160);
  db.prepare("UPDATE photos SET deleted_at=? WHERE id=?").run(now(), p.id);
  await ingest(
    db,
    c,
    null,
    Readable.from(buffer),
    "portrait.jpg",
    false,
    null,
    { folder: "À trier" },
  );
  const matches = await findSimilar(db, c, 12);
  assert.equal(matches.analysed, 1);
  assert.equal(matches.items.length, 0);
  const variation = await sharp(buffer).jpeg({ quality: 45 }).toBuffer();
  await ingest(
    db,
    c,
    null,
    Readable.from(variation),
    "autre-export.jpg",
    false,
    null,
    { folder: "À trier" },
  );
  const pairs = await findSimilar(db, c, 12);
  assert.equal(pairs.analysed, 2);
  assert.ok(pairs.items.length > 0);
  assert.ok(
    pairs.items.every((pair) =>
      [...pair.a.refs, ...pair.b.refs].every((ref) => ref.id !== p.id),
    ),
  );
  const restored = await ingest(
    db,
    c,
    a,
    Readable.from(buffer),
    "portrait.jpg",
  );
  assert.equal(restored.id, p.id);
  assert.equal(
    db.prepare("SELECT deleted_at FROM photos WHERE id=?").get(p.id).deleted_at,
    null,
  );
  assert.equal(
    db.prepare("SELECT hidden FROM photos WHERE id=?").get(p.id).hidden,
    1,
  );
  assert.equal((await app.inject("/media/" + p.id + "?w=160")).statusCode, 404);
  assert.deepEqual(
    await readFile(
      path.join(
        c.mediaDir,
        db.prepare("SELECT hash FROM photos WHERE id=?").get(p.id).hash,
      ),
    ),
    buffer,
  );
});
test("adoption confirmation updates the original feed entry and observed year without changing its order; rejection is reversible and does not duplicate", async (t) => {
  const { app, db } = await fixture(t),
    auth = await login(app, "agent"),
    aid = animal(db),
    at = new Date(Date.now() - 48 * 3600000).toISOString(),
    cfg = { ...settings(db), sourceMissingOutcome: "after24h" };
  const a = db.prepare("SELECT * FROM animals WHERE id=?").get(aid);
  inferAdoption(db, a, { scope: "spa:moree", fetchedAt: at }, cfg, at, 2);
  db.prepare(
    "UPDATE animals SET archived_at=?,status='source_missing' WHERE id=?",
  ).run(at, aid);
  const p = automaticAdoption(db, aid),
    departure = { ...a, status: "source_missing" };
  feedEvent(db, departure, "removed", publicAdoptionOrigin(p), at);
  const before = db
    .prepare("SELECT * FROM feed_events WHERE animal_id=? AND kind='removed'")
    .get(aid);
  animal(db, "Plus récent");
  collectNotifications(db);
  const response = await call(
    app,
    auth.headers,
    "POST",
    "/api/adoption-reviews/" + aid + "/confirm",
    { expectedAt: at, expectedRevision: p.revision },
  );
  assert.equal(response.statusCode, 200, response.body);
  const after = db
    .prepare("SELECT * FROM feed_events WHERE id=?")
    .get(before.id);
  assert.equal(after.seq, before.seq);
  assert.equal(after.created_at, at);
  assert.equal(after.kind, "adopted");
  assert.equal(
    db
      .prepare("SELECT observed_at FROM animal_status_events WHERE animal_id=?")
      .get(aid).observed_at,
    at,
  );
  collectNotifications(db);
  collectNotifications(db);
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) n FROM notification_events WHERE id LIKE 'review:%'",
      )
      .get().n,
    1,
  );
  const confirmed = automaticAdoption(db, aid);
  const reject = await call(
    app,
    auth.headers,
    "POST",
    "/api/adoption-reviews/" + aid + "/reject",
    { expectedAt: at, expectedRevision: confirmed.revision },
  );
  assert.equal(reject.statusCode, 200, reject.body);
  assert.equal(
    db.prepare("SELECT seq FROM feed_events WHERE id=?").get(before.id).seq,
    before.seq,
  );
  assert.equal(
    db
      .prepare("SELECT COUNT(*) n FROM animal_status_events WHERE animal_id=?")
      .get(aid).n,
    0,
  );
  updateDecisionFeed(
    db,
    { ...departure, status: "source_missing" },
    automaticAdoption(db, aid),
    "removed",
  );
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) n FROM feed_events WHERE animal_id=? AND kind='removed'",
      )
      .get(aid).n,
    1,
  );
});
test("annual complements and explicit totals are isolated per year, require an agent and leave source adoption facts unchanged", async (t) => {
  const { app, db } = await fixture(t),
    agent = await login(app, "agent"),
    viewer = await login(app, "viewer"),
    aid = animal(db),
    year = new Date().getFullYear();
  db.prepare("INSERT INTO animal_status_events VALUES (?,?, 'adopted',?)").run(
    id(),
    aid,
    `${year}-04-01T10:00:00.000Z`,
  );
  assert.equal(annualAdoptions(db, year).count, 1);
  for (const [mode, value, total] of [
    ["complement", 32, 33],
    ["total", 76, 76],
    ["auto", 0, 1],
  ]) {
    const r = await call(
      app,
      agent.headers,
      "PUT",
      "/api/annual-statistics/" + year,
      { mode, value },
    );
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().count, total);
    assert.equal(annualAdoptions(db, year - 1).mode, "auto");
  }
  assert.equal(
    (
      await call(app, viewer.headers, "PUT", "/api/annual-statistics/" + year, {
        mode: "total",
        value: 20,
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (await app.inject("/api/annual-statistics/" + year)).statusCode,
    401,
  );
  assert.equal(
    (
      await call(
        app,
        { cookie: agent.headers.cookie },
        "PUT",
        "/api/annual-statistics/" + year,
        { mode: "total", value: 3 },
      )
    ).statusCode,
    403,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM animal_status_events").get().n,
    1,
  );
});
test("team polls enforce roles, scheduling, single versus multiple choices, ownership and closure without exposing voter identities", async (t) => {
  const { app, db } = await fixture(t),
    a = await login(app, "agent"),
    v = await login(app, "volunteer");
  const body = {
    question: "Qui vient samedi ?",
    options: ["Matin", "Après-midi", "Indisponible"],
    kind: "presence",
  };
  assert.equal(
    (await call(app, v.headers, "POST", "/api/team-polls", body)).statusCode,
    403,
  );
  assert.equal((await app.inject("/api/team-polls")).statusCode, 401);
  let r = await call(app, a.headers, "POST", "/api/team-polls", body);
  assert.equal(r.statusCode, 200, r.body);
  const key = r.json().poll.id;
  assert.equal(
    (
      await call(app, v.headers, "POST", "/api/team-polls/" + key + "/vote", {
        choices: [0, 1],
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await call(app, v.headers, "POST", "/api/team-polls/" + key + "/vote", {
        choices: [0],
      })
    ).statusCode,
    200,
  );
  r = await call(app, a.headers, "GET", "/api/team-polls");
  assert.equal(r.json().polls[0].participants, 1);
  assert.equal(r.json().polls[0].results[0].count, 1);
  assert.deepEqual(r.json().polls[0].mine, []);
  assert.ok(!r.body.includes(v.user.id));
  const scheduled = await call(app, a.headers, "POST", "/api/team-polls", {
    ...body,
    multiple: true,
    opensAt: new Date(Date.now() + 3600000).toISOString(),
  });
  const future = scheduled.json().poll;
  assert.equal(future.state, "scheduled");
  assert.equal(
    (
      await call(
        app,
        v.headers,
        "POST",
        "/api/team-polls/" + future.id + "/vote",
        { choices: [0] },
      )
    ).statusCode,
    409,
  );
  await call(app, a.headers, "POST", "/api/team-polls/" + key + "/close", {});
  assert.equal(
    (
      await call(app, v.headers, "POST", "/api/team-polls/" + key + "/vote", {
        choices: [1],
      })
    ).statusCode,
    409,
  );
  saveSettings(db, {
    enabledModules: { ...settings(db).enabledModules, planning: false },
  });
  assert.equal(
    (await call(app, a.headers, "GET", "/api/team-polls")).statusCode,
    503,
  );
});
test("fast TV capture polling requires the screen identity without a site PIN, expires safely, respects disabled capture and never exposes snapshots to visitors", async (t) => {
  const { app, db } = await fixture(t),
    a = await login(app, "agent"),
    key = id(),
    token = randomBytes(32).toString("base64url");
  const r = await call(app, {}, "POST", "/api/public/display/heartbeat", {
    id: key,
    token,
    state: "playing",
    visible: true,
    fullscreen: true,
    persistent: true,
    width: 1920,
    height: 1080,
    revision: "0".repeat(64),
    syncAgeMs: 0,
    progressAgeMs: 0,
    scene: null,
    issues: [],
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(
    (
      await call(
        app,
        a.headers,
        "POST",
        "/api/admin/display/screens/" + key + "/live",
        { seconds: 2 },
      )
    ).statusCode,
    200,
  );
  const poll = () =>
    call(app, {}, "POST", "/api/public/display/poll", { id: key, token });
  let result = await poll();
  assert.equal(result.statusCode, 200, result.body);
  assert.equal(result.json().commands[0].kind, "snapshot");
  await poll();
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM display_commands").get().n,
    1,
  );
  assert.equal(
    (
      await call(app, {}, "POST", "/api/public/display/poll", {
        id: key,
        token: randomBytes(32).toString("base64url"),
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (await app.inject("/api/admin/display/screens/" + key + "/snapshot"))
      .statusCode,
    401,
  );
  db.prepare("DELETE FROM display_commands").run();
  db.prepare("UPDATE display_live SET expires_at=?").run(
    new Date(Date.now() - 1000).toISOString(),
  );
  assert.equal((await poll()).json().commands.length, 0);
  saveSettings(db, {
    accessPinEnabled: true,
    accessPinHash: await hashPassword("582104"),
  });
  assert.equal((await poll()).statusCode, 200);
  saveSettings(db, { accessPinEnabled: false });
  await call(app, a.headers, "DELETE", "/api/admin/display/screens/" + key, {
    revision: 1,
  });
  assert.equal((await poll()).statusCode, 403);
});
test("a push subscription can be rebound to a new session of its owner, cannot be taken over, and offers a bounded authenticated delivery test", async (t) => {
  const sent = [],
    { app, db } = await fixture(t, {
      pushSender: async (...args) => sent.push(args),
    }),
    a = await login(app),
    other = await login(app, "volunteer");
  const sub = {
    endpoint: "https://fcm.googleapis.com/fcm/send/313",
    keys: {
      p256dh: randomBytes(65).toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    },
  };
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
  const newer = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: { name: "admin", password: "fixture password 12345" },
    }),
    headers = {
      cookie: newer.headers["set-cookie"].split(";")[0],
      "x-csrf-token": newer.json().user.csrf,
      origin: "http://localhost:3000",
    };
  assert.equal(
    (
      await call(app, headers, "POST", "/api/notifications/subscriptions", sub)
    ).json().requiresResubscribe,
    undefined,
  );
  assert.equal(
    (await call(app, headers, "GET", "/api/notifications/preferences")).json()
      .subscriptions[0].current,
    1,
  );
  assert.equal(
    (
      await call(
        app,
        other.headers,
        "POST",
        "/api/notifications/subscriptions",
        sub,
      )
    ).json().requiresResubscribe,
    true,
  );
  let r = await call(app, headers, "POST", "/api/notifications/test", {});
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0].endpoint, sub.endpoint);
  assert.equal(
    (await call(app, other.headers, "POST", "/api/notifications/test", {}))
      .statusCode,
    409,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM notification_subscriptions").get().n,
    1,
  );
});
test("name cache scheduling uses Paris time across DST and a large themed bank; app preferences survive invalid storage without losing defaults", () => {
  assert.ok(themedNames("all").length >= 1500);
  assert.equal(
    nightlyNamesDue("2026-10-20T01:20:00Z", Date.parse("2026-10-21T00:50:00Z")),
    false,
  );
  assert.equal(
    nightlyNamesDue("2026-10-20T01:20:00Z", Date.parse("2026-10-21T01:16:00Z")),
    true,
  );
  assert.equal(
    nightlyNamesDue("2026-10-21T01:16:00Z", Date.parse("2026-10-21T04:00:00Z")),
    false,
  );
  assert.equal(nightlyNamesDue(null, Date.parse("2026-10-26T02:16:00Z")), true);
  const store = new Map(),
    storage = {
      getItem: (k) => store.get(k),
      setItem: (k, v) => store.set(k, v),
    };
  saveAppPreferences(
    {
      nav: ["polls", "mobile", "polls", "INVALID", "collections"],
      widgets: ["today", "feed"],
      largeText: true,
    },
    storage,
  );
  assert.deepEqual(readAppPreferences(storage).nav, [
    "mobile",
    "polls",
    "collections",
  ]);
  assert.equal(readAppPreferences(storage).largeText, true);
  assert.deepEqual(normalizeAppPreferences({ widgets: [] }).widgets, []);
  assert.equal(
    readAppPreferences({
      getItem: () => {
        throw Error();
      },
    }).nav[0],
    "mobile",
  );
});
test("inline review differences reconstruct exact source and proposal including spaces, punctuation and Unicode; history groups one animal observation once", () => {
  for (const [a, b] of [
    ["Il est  gentil , oui...", "Il est gentil, oui."],
    ["Éloïse 🐱", "Éloïse 🐱 est là !"],
    ["<script>", "<b>"],
    ["mot ".repeat(2000), "autre ".repeat(2000)],
  ]) {
    const d = textDiff(a, b);
    assert.equal(
      d
        .filter((x) => x.kind !== "add")
        .map((x) => x.text)
        .join(""),
      a,
    );
    assert.equal(
      d
        .filter((x) => x.kind !== "remove")
        .map((x) => x.text)
        .join(""),
      b,
    );
  }
  const observation = {
    animal_id: "a",
    observed_at: "2026-10-20T00:00:00Z",
    kind: "updated",
  };
  const rows = [
    { ...observation, seq: 1, field: "name" },
    { ...observation, seq: 2, field: "sex" },
    { ...observation, seq: 2, field: "sex" },
  ];
  assert.equal(historyGroups(rows).length, 1);
  assert.equal(historyGroups(rows)[0].changes.length, 2);
  assert.equal(historyValue("male", "sex"), "Mâle");
});
test("history keeps public ascending cursor compatibility and offers reverse pagination for the grouped UI", async (t) => {
  const { app, db } = await fixture(t),
    aid = animal(db);
  saveSettings(db, { publicHistoryEnabled: true });
  for (const [field, after] of [
    ["name", "Nala"],
    ["sex", "female"],
    ["status", "reserved"],
  ])
    db.prepare(
      "INSERT INTO animal_changes(animal_id,kind,field,before_value,after_value,observed_at) VALUES (?,'updated',?,NULL,?,?)",
    ).run(aid, field, JSON.stringify(after), now());
  const ascending = (await app.inject("/api/public/changes?limit=2")).json();
  assert.ok(ascending.items[0].seq < ascending.items[1].seq);
  const descending = (
    await app.inject("/api/public/changes?limit=2&order=desc")
  ).json();
  assert.ok(descending.items[0].seq > descending.items[1].seq);
  const next = (
    await app.inject(
      "/api/public/changes?limit=2&order=desc&after=" + descending.next,
    )
  ).json();
  assert.ok(next.items.every((i) => i.seq < descending.next));
  assert.equal(
    new Set([...next.items, ...descending.items].map((i) => i.seq)).size,
    3,
  );
});
