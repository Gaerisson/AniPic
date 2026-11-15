import { test } from "node:test";
import assert from "node:assert/strict";
import * as schedule from "../shared/sync-schedule.mjs";

test("daily time accepts 23:00 and round-trips only unrestricted daily cron expressions", () => {
  assert.equal(typeof schedule.cronFromDailyTime, "function");
  assert.equal(typeof schedule.dailyTimeFromCron, "function");
  assert.equal(schedule.cronFromDailyTime("23:00"), "0 23 * * *");
  assert.equal(schedule.cronFromDailyTime("07:05"), "5 7 * * *");
  assert.equal(schedule.dailyTimeFromCron("0 23 * * *"), "23:00");
  assert.equal(schedule.dailyTimeFromCron("  05 07 * * *  "), "07:05");
  for (const advanced of [
    "0 8,14 * * *",
    "0 23 * * 1-5",
    "*/5 * * * *",
    "0 23 1 * *",
  ])
    assert.equal(schedule.dailyTimeFromCron(advanced), null);
  for (const invalid of ["24:00", "23:60", "7:05", "", "23:00:00"])
    assert.throws(() => schedule.cronFromDailyTime(invalid));
  assert.equal(schedule.dailyTimeFromCron("60 23 * * *"), null);
});

test("daily time uses the configured timezone through summer and winter without modifying advanced cron", () => {
  assert.equal(typeof schedule.cronFromDailyTime, "function");
  const cfg = {
    sourceMode: "spa",
    syncScheduleMode: "cron",
    syncCron: schedule.cronFromDailyTime("23:00"),
    syncTimeZone: "Europe/Paris",
  };
  assert.equal(
    schedule.syncDue(cfg, null, new Date("2026-07-01T21:00:45Z")),
    true,
  );
  assert.equal(
    schedule.syncDue(cfg, null, new Date("2026-11-15T22:00:45Z")),
    true,
  );
  assert.equal(
    schedule.syncDue(cfg, null, new Date("2026-11-15T23:00:45Z")),
    false,
  );
  assert.deepEqual(
    schedule.nextSyncDates(cfg, new Date("2026-11-15T21:59:00Z"), 2),
    ["2026-11-15T22:00:00.000Z", "2026-11-16T22:00:00.000Z"],
  );
});
