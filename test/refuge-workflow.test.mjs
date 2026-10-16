import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, login, animal } from "./helpers.mjs";
import { saveSettings, settings } from "../server/db.mjs";
import {
  parseCron,
  cronMatches,
  syncDue,
  nextSyncDates,
} from "../shared/sync-schedule.mjs";
import { photoPriority } from "../shared/photo-priority.mjs";

test("cron validates five numeric fields and handles ranges, steps, Sunday and POSIX day alternatives", () => {
  for (const bad of [
    "* * * *",
    "60 * * * *",
    "* 24 * * *",
    "*/0 * * * *",
    "* * * 13 *",
    "* * * * 8",
    "5-2 * * * *",
    "0 9 * * * rm",
    "@daily",
    "a * * * *",
  ])
    assert.throws(() => parseCron(bad));
  assert.equal(
    cronMatches(
      "0 8,14,20 * * *",
      "Europe/Paris",
      new Date("2026-10-16T06:00:00Z"),
    ),
    true,
  );
  assert.equal(
    cronMatches(
      "*/15 9-17 * * 1-5",
      "Europe/Paris",
      new Date("2026-10-16T07:15:00Z"),
    ),
    true,
  );
  assert.equal(
    cronMatches("0 9 * * 7", "Europe/Paris", new Date("2026-10-18T07:00:00Z")),
    true,
  );
  assert.equal(
    cronMatches("0 9 1 * 5", "Europe/Paris", new Date("2026-10-16T07:00:00Z")),
    true,
  );
  assert.equal(
    cronMatches("0 9 1 * 5", "Europe/Paris", new Date("2026-10-17T07:00:00Z")),
    false,
  );
});

test("server scheduling is gated by source/mode, deduplicates a minute and respects timezone/DST", () => {
  const cfg = {
      sourceMode: "spa",
      syncScheduleMode: "cron",
      syncCron: "0 8 * * *",
      syncTimeZone: "Europe/Paris",
    },
    now = new Date("2026-10-16T06:00:34Z");
  assert.equal(syncDue(cfg, null, now), true);
  assert.equal(syncDue(cfg, "2026-10-16T06:00:00Z", now), false);
  assert.equal(syncDue({ ...cfg, sourceMode: "disabled" }, null, now), false);
  assert.equal(
    syncDue({ ...cfg, syncScheduleMode: "manual" }, null, now),
    false,
  );
  assert.equal(
    syncDue(
      { ...cfg, syncScheduleMode: "interval", syncIntervalHours: 6 },
      "2026-10-16T05:00:00Z",
      now,
    ),
    false,
  );
  assert.equal(
    syncDue(
      { ...cfg, syncScheduleMode: "interval", syncIntervalHours: 6 },
      "2026-10-15T23:00:00Z",
      now,
    ),
    true,
  );
  assert.equal(
    cronMatches("30 2 * * *", "Europe/Paris", new Date("2026-10-25T00:30:00Z")),
    true,
  );
  assert.equal(
    cronMatches("30 2 * * *", "Europe/Paris", new Date("2026-10-25T01:30:00Z")),
    true,
  );
  const dates = nextSyncDates(
    { ...cfg, syncTimeZone: "Asia/Kolkata" },
    new Date("2026-10-16T00:00:00Z"),
    1,
  );
  assert.equal(dates[0], "2026-10-16T02:30:00.000Z");
  assert.deepEqual(nextSyncDates({ ...cfg, syncCron: "0 1 31 2 *" }, now), []);
});

test("the actual server timer starts cron jobs once per minute and records source errors without modifying animals", async (t) => {
  t.mock.timers.enable({
    apis: ["setInterval", "Date"],
    now: Date.parse("2026-10-16T08:00:00Z"),
  });
  try {
    const { app, db } = await fixture(t, { scheduler: true });
    saveSettings(db, {
      sourceMode: "json",
      sourceUrl: "",
      sourceAttempts: 1,
      syncScheduleMode: "cron",
      syncCron: "* * * * *",
      syncTimeZone: "Europe/Paris",
    });
    t.mock.timers.tick(60000);
    for (let i = 0; i < 20; i++) {
      await new Promise(setImmediate);
      if (!db.prepare("SELECT 1 FROM jobs WHERE state='running'").get()) break;
    }
    const first = db.prepare("SELECT * FROM jobs WHERE kind='sync'").all();
    assert.equal(first.length, 1);
    assert.equal(first[0].state, "failed");
    assert.equal(db.prepare("SELECT COUNT(*) n FROM animals").get().n, 0);
    saveSettings(db, { syncScheduleMode: "manual" });
    t.mock.timers.tick(60000);
    await new Promise(setImmediate);
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM jobs WHERE kind='sync'").get().n,
      1,
    );
  } finally {
    t.mock.timers.reset();
  }
});

test("glass, scheduling and photo rules persist through the admin API with strict validation", async (t) => {
  const { app } = await fixture(t),
    { headers } = await login(app),
    current = (
      await app.inject({ url: "/api/admin/settings", headers })
    ).json();
  const patch = {
    ...current,
    glassEnabled: true,
    glassBlur: 20,
    glassOpacity: 75,
    syncScheduleMode: "cron",
    syncCron: "0 8,14 * * 1-5",
    syncTimeZone: "Europe/Paris",
    photoRules: { sos: "high", standard: "normal", reserved: "low" },
  };
  const saved = await app.inject({
    method: "PUT",
    url: "/api/admin/settings",
    headers,
    payload: patch,
  });
  assert.equal(saved.statusCode, 200, saved.body);
  const overview = (await app.inject({ url: "/api/overview" })).json();
  assert.equal(overview.interface.glassEnabled, true);
  assert.equal(overview.interface.glassOpacity, 75);
  assert.equal(overview.interface.syncCron, undefined);
  assert.equal(saved.json().syncCron, patch.syncCron);
  for (const invalid of [
    { syncCron: "* * * * * do-something" },
    { syncTimeZone: "No/Such_Zone" },
    { glassBlur: 100 },
    { photoRules: { sos: "hack" } },
  ])
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: "/api/admin/settings",
          headers,
          payload: { ...patch, ...invalid },
        })
      ).statusCode,
      400,
    );
  const agent = await login(app, "agent");
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: "/api/admin/settings",
        headers: agent.headers,
        payload: patch,
      })
    ).statusCode,
    403,
  );
});

test("photo suggestions rank SOS first and reserved last before pagination, drive default tasks and the printable sheet", async (t) => {
  const { app, db } = await fixture(t),
    { headers } = await login(app, "agent"),
    normal = animal(db, "A normal"),
    reserved = animal(db, "B réservé"),
    sos = animal(db, "Z SOS");
  db.prepare("UPDATE animals SET status='reserved' WHERE id=?").run(reserved);
  db.prepare("UPDATE animals SET tags='[\"SOS adoption\"]' WHERE id=?").run(
    sos,
  );
  let result = await app.inject({
    url: "/api/animals?missing=1&sort=photo_priority&limit=1",
    headers,
  });
  assert.equal(result.json().items[0].id, sos);
  assert.equal(result.json().items[0].photo_priority, "urgent");
  assert.equal(result.json().items[0].photo_count, 0);
  const second = (
    await app.inject({
      url: "/api/animals?missing=1&sort=photo_priority&limit=1&page=2",
      headers,
    })
  ).json();
  assert.equal(second.items[0].id, normal);
  const request = await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers,
    payload: { animalId: sos, title: "Portrait SOS" },
  });
  assert.equal(request.statusCode, 201, request.body);
  assert.equal(
    db
      .prepare("SELECT priority FROM shoot_tasks WHERE id=?")
      .get(request.json().id).priority,
    "urgent",
  );
  assert.deepEqual(
    (await app.inject({ url: "/api/shoot-sheet", headers }))
      .json()
      .items.map((a) => a.id),
    [sos, normal, reserved],
  );
  saveSettings(db, {
    photoRules: { sos: "low", standard: "normal", reserved: "high" },
  });
  result = await app.inject({
    url: "/api/animals?missing=1&sort=photo_priority&limit=3",
    headers,
  });
  assert.deepEqual(
    result.json().items.map((a) => a.id),
    [reserved, normal, sos],
  );
  assert.equal(
    db
      .prepare("SELECT priority FROM shoot_tasks WHERE id=?")
      .get(request.json().id).priority,
    "urgent",
  );
  assert.equal(
    photoPriority(
      { status: "reserved", tags: ["SOS adoption"] },
      settings(db).photoRules,
    ).priority,
    "low",
  );
});

test("feed filters are applied on the server and only expose safe SPA photo metadata", async (t) => {
  const { app, db } = await fixture(t),
    a = animal(db, "Nala"),
    b = animal(db, "Maya");
  db.prepare("UPDATE animals SET source_metadata=? WHERE id=?").run(
    JSON.stringify({
      thumbnail:
        "https://www.la-spa.fr/app/app/uploads/animals/42/portrait.jpg",
      privateEmail: "secret@example.test",
    }),
    a,
  );
  db.prepare(
    "UPDATE feed_events SET status='adopted',kind='removed' WHERE animal_id=?",
  ).run(b);
  const adopted = (
    await app.inject({ url: "/api/feed?latest=1&kind=adopted&limit=1" })
  ).json();
  assert.equal(adopted.events[0].animal_id, b);
  const arrival = (
    await app.inject({ url: "/api/feed?latest=1&kind=added&limit=1" })
  ).json();
  assert.equal(arrival.events[0].animal_id, a);
  assert.ok(arrival.events[0].source_metadata.thumbnail);
  assert.equal(arrival.events[0].source_metadata.privateEmail, undefined);
  assert.equal(
    (await app.inject({ url: "/api/feed?kind=unknown" })).statusCode,
    400,
  );
});
