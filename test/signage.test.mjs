import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { fixture, login, animal } from "./helpers.mjs";
import { ingest } from "../server/storage.mjs";
import { id, now, saveSettings } from "../server/db.mjs";
import {
  showDefaults,
  showTimeline,
  sceneAt,
  scheduleOpen,
} from "../shared/signage.mjs";
import { parseShow } from "../server/signage-schema.mjs";
import { buildDisplay } from "../server/refuge-display.mjs";
import { motionShow } from "../server/motion.mjs";
import { sourcePhotoBuffer } from "../server/source-photo.mjs";
const call = (app, headers, method, url, payload) =>
  app.inject({ headers, method, url, payload });
async function photo(db, c, a, color = "#ba7d4b", hidden = false) {
  return ingest(
    db,
    c,
    a,
    Readable.from(
      await sharp({
        create: { width: 480, height: 600, channels: 3, background: color },
      })
        .jpeg()
        .toBuffer(),
    ),
    "photo.jpg",
    hidden,
  );
}
function asset(db, c, user) {
  const hash = "a".repeat(64),
    value = id();
  db.prepare("INSERT OR IGNORE INTO blobs VALUES (?,?,?,?,?,?)").run(
    hash,
    20,
    1280,
    720,
    "video/mp4",
    now(),
  );
  db.prepare("INSERT INTO video_assets VALUES (?,?,?,?,?,?,?)").run(
    value,
    hash,
    "vie.mp4",
    "video",
    8,
    user.id,
    now(),
  );
  return { id: value, hash };
}
test("media tags are private, case deduplicated, role checked and never edit SPA facts", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    viewer = await login(app, "viewer"),
    a = animal(db),
    p = await photo(db, c, a);
  const url = `/api/media-tags/photo/${p.id}`;
  assert.equal((await app.inject({ url })).statusCode, 401);
  assert.equal(
    (await call(app, viewer.headers, "PUT", url, { tags: ["Noël"] }))
      .statusCode,
    403,
  );
  const r = await call(app, admin.headers, "PUT", url, {
    tags: [" Noël ", "noël", "Halloween"],
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.deepEqual(r.json().tags, ["noël", "Halloween"]);
  assert.equal(
    db.prepare("SELECT description FROM animals WHERE id=?").get(a).description,
    "Fiche SPA",
  );
  const filtered = await app.inject({
    url: "/api/animals?mediaTag=" + encodeURIComponent("Halloween"),
    headers: admin.headers,
  });
  assert.deepEqual(
    filtered.json().items.map((v) => v.id),
    [a],
  );
  assert.equal(
    (await app.inject({ url: "/api/animals?mediaTag=Halloween" })).json().total,
    0,
  );
  assert.equal(
    (
      await app.inject({
        url: "/api/animals?mediaTag=" + encodeURIComponent("' OR 1=1 --"),
        headers: admin.headers,
      })
    ).json().total,
    0,
  );
  assert.equal(
    (await call(app, admin.headers, "PUT", url, { tags: ["x".repeat(41)] }))
      .statusCode,
    400,
  );
});
test("animal videos start private, support public TV range reads, and revoke with programme exclusions", async (t) => {
  const { app, db, c } = await fixture(t),
    agent = await login(app, "agent"),
    a = animal(db),
    v = asset(db, c, agent.user);
  await fs.writeFile(
    path.join(c.mediaDir, v.hash),
    Buffer.from("01234567890123456789"),
  );
  await photo(db, c, a);
  const r = await call(app, agent.headers, "POST", `/api/animals/${a}/videos`, {
    assetId: v.id,
  });
  assert.equal(r.statusCode, 200, r.body);
  const av = r.json().items[0];
  assert.equal(av.show_on_tv, false);
  saveSettings(db, { displayEnabled: true, displayQr: false });
  const url = `/api/public/animal-videos/${av.id}/file`;
  assert.equal((await app.inject({ url })).statusCode, 404);
  assert.equal(
    (
      await call(app, agent.headers, "PATCH", `/api/animal-videos/${av.id}`, {
        caption: "En balade",
        showOnTv: true,
      })
    ).statusCode,
    200,
  );
  const range = await app.inject({ url, headers: { range: "bytes=2-6" } });
  assert.equal(range.statusCode, 206, range.body);
  assert.equal(range.body, "23456");
  assert.equal(range.headers["cache-control"], "private, no-store");
  saveSettings(db, {
    displayProgram: parseShow({ excludedScenes: [`animal:${a}:${av.id}`] }),
  });
  assert.equal((await app.inject({ url })).statusCode, 404);
  saveSettings(db, { displayProgram: parseShow({}) });
  const wallpaper = await buildDisplay(db, {
    displayProgram: parseShow({ mode: "wallpaper" }),
  });
  assert.ok(wallpaper.items[0].media.every((m) => m.kind === "photo"));
  saveSettings(db, { displayHiddenIds: [a] });
  assert.equal((await app.inject({ url })).statusCode, 404);
  saveSettings(db, { displayHiddenIds: [], displayEnabled: false });
  assert.equal((await app.inject({ url })).statusCode, 404);
  await call(app, agent.headers, "DELETE", `/api/animal-videos/${av.id}`);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM video_assets").get().n, 1);
});
test("TV selects multiple eligible photos by theme and excludes private, departed and nonmatching media", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    a = animal(db),
    p = await photo(db, c, a),
    q = await photo(db, c, a, "#a12345"),
    privatePhoto = await photo(db, c, a, "#123456", true);
  for (const id of [p.id, q.id, privatePhoto.id])
    await call(app, admin.headers, "PUT", `/api/media-tags/photo/${id}`, {
      tags: ["Noël"],
    });
  saveSettings(db, {
    displayEnabled: true,
    displayProgram: parseShow({ tags: ["Noël"], photosPerAnimal: 8 }),
    displayQr: false,
  });
  const r = await buildDisplay(db);
  assert.equal(r.items[0].media.length, 2);
  assert.ok(!JSON.stringify(r).includes(privatePhoto.id));
  assert.doesNotMatch(JSON.stringify(r), /"hash"|created_by/);
  saveSettings(db, { displayProgram: parseShow({ tags: ["Halloween"] }) });
  assert.equal((await buildDisplay(db)).items.length, 0);
});
test("TV admin preview is private and does not publish unsaved configuration", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    agent = await login(app, "agent"),
    a = animal(db);
  await photo(db, c, a);
  const cfg = (
    await app.inject({ url: "/api/admin/display", headers: admin.headers })
  ).json();
  assert.equal(
    (await call(app, agent.headers, "POST", "/api/admin/display/preview", cfg))
      .statusCode,
    200,
  );
  const r = await call(
    app,
    admin.headers,
    "POST",
    "/api/admin/display/preview",
    cfg,
  );
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().items.length, 1);
  assert.equal(
    (await app.inject({ url: "/api/public/display" })).json().enabled,
    false,
  );
  assert.equal(
    (
      await call(app, admin.headers, "PUT", "/api/admin/display", {
        ...cfg,
        displayProgram: { ...cfg.displayProgram, intensity: 101 },
      })
    ).statusCode,
    400,
  );
});
test("adoption interludes use dated source status events, never archived or missing animals", async (t) => {
  const { db } = await fixture(t),
    a = animal(db),
    b = animal(db),
    c = animal(db);
  db.prepare(
    "UPDATE animals SET status='source_missing',archived_at=? WHERE id=?",
  ).run(now(), a);
  for (const [v, date] of [
    [b, "2026-02-02"],
    [c, null],
    [b, "2026-05-01"],
  ])
    db.prepare("INSERT INTO animal_status_events VALUES (?,?,?,?)").run(
      id(),
      v,
      "adopted",
      date,
    );
  const r = await buildDisplay(
    db,
    { displayProgram: parseShow({ year: 2026 }) },
    { force: true },
  );
  assert.equal(r.stats.adoptions, 1);
});
test("playlist order, interlude timing, video limits and wrap are deterministic for live and exported frames", () => {
  const program = parseShow({
    species: ["cat", "dog"],
    photoSeconds: 4,
    introSeconds: 3,
    statsEvery: 1,
    logoEvery: 0,
    videoSeconds: 5,
  });
  const show = {
    program,
    items: [
      { id: "a", species: "dog", media: [{ kind: "photo" }] },
      {
        id: "b",
        species: "cat",
        media: [{ kind: "photo" }, { kind: "video", duration: 10 }],
      },
    ],
  };
  const tl = showTimeline(show);
  assert.deepEqual(
    tl.scenes.map((s) => s.type),
    ["logo", "animal", "animal", "stats", "animal", "stats"],
  );
  assert.equal(tl.scenes[1].animal.id, "b");
  assert.equal(tl.scenes[2].duration, 120);
  assert.equal(sceneAt(tl, tl.frames).start, 0);
  assert.equal(sceneAt(tl, -1).type, "stats");
});
test("weekly TV scheduling follows Paris time, handles midnight and ignores schedule during export", () => {
  const p = parseShow({
    scheduleEnabled: true,
    days: [1],
    startTime: "22:00",
    endTime: "02:00",
  });
  assert.ok(scheduleOpen(p, new Date("2026-10-19T21:00:00Z")));
  assert.ok(scheduleOpen(p, new Date("2026-10-20T00:30:00Z")) === false);
  assert.ok(scheduleOpen(p, new Date("2026-10-19T23:30:00Z")));
  assert.ok(!scheduleOpen(p, new Date("2026-10-20T21:30:00Z")));
});
test("SPA references can enter a movie through the bounded image cache without becoming local portraits", async (t) => {
  let calls = 0;
  const buffer = await sharp({
    create: { width: 300, height: 400, channels: 3, background: "#aa7755" },
  })
    .jpeg()
    .toBuffer();
  const { db, c } = await fixture(t, {
      spaPhotoFetcher: async () => {
        calls++;
        return buffer;
      },
    }),
    a = animal(db);
  db.prepare("UPDATE animals SET source_metadata=? WHERE id=?").run(
    JSON.stringify({
      thumbnail: "https://www.la-spa.fr/app/uploads/2026/10/animal.jpg",
    }),
    a,
  );
  saveSettings(db, { displaySpaPhotos: true });
  const show = await motionShow(db, {
    program: parseShow({ maxAnimals: 1 }),
    hiddenIds: [],
    title: "Référence",
  });
  assert.equal(show.items[0].media[0].source, true);
  await sourcePhotoBuffer(db, c, a);
  await sourcePhotoBuffer(db, c, a);
  assert.equal(calls, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos").get().n, 0);
});
test("motion export previews exclude private media, reject empty or overlong programmes, and downloads require login", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    a = animal(db);
  await photo(db, c, a);
  let input = {
    program: parseShow({
      introSeconds: 0,
      photosPerAnimal: 1,
      statsEvery: 0,
      logoEvery: 0,
    }),
    hiddenIds: [],
    title: "Test",
  };
  const r = await call(
    app,
    admin.headers,
    "POST",
    "/api/motion/preview",
    input,
  );
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().duration, 6);
  assert.equal(
    (await app.inject({ url: "/api/motion/exports" })).statusCode,
    401,
  );
  await assert.rejects(
    () => motionShow(db, { ...input, hiddenIds: [a] }),
    /au moins/,
  );
  for (let n = 0; n < 21; n++) {
    const b = animal(db);
    await photo(db, c, b);
  }
  await assert.rejects(
    () =>
      motionShow(db, {
        ...input,
        program: parseShow({ photoSeconds: 30, maxAnimals: 60 }),
      }),
    /10 min/,
  );
});
test("motion exports are private, byte-seekable and recoverable after removal", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    viewer = await login(app, "viewer"),
    v = asset(db, c, admin.user),
    render = id();
  await fs.writeFile(
    path.join(c.mediaDir, v.hash),
    Buffer.from("01234567890123456789"),
  );
  db.prepare(
    "INSERT INTO motion_exports(id,title,config,created_by,state,hash,created_at) VALUES (?,?,?,?,'done',?,?)",
  ).run(render, "Test", "{}", admin.user.id, v.hash, now());
  const file = `/api/motion/exports/${render}/file`;
  assert.equal((await app.inject({ url: file })).statusCode, 401);
  assert.equal(
    (
      await app.inject({
        url: file,
        headers: { ...viewer.headers, range: "bytes=1-3" },
      })
    ).body,
    "123",
  );
  assert.equal(
    (await call(app, viewer.headers, "DELETE", `/api/motion/exports/${render}`))
      .statusCode,
    403,
  );
  await call(app, admin.headers, "DELETE", `/api/motion/exports/${render}`);
  assert.equal(
    (await app.inject({ url: file, headers: admin.headers })).statusCode,
    404,
  );
  assert.equal(
    db.prepare("SELECT hash FROM motion_exports WHERE id=?").get(render).hash,
    v.hash,
  );
  await call(
    app,
    admin.headers,
    "POST",
    `/api/motion/exports/${render}/restore`,
    {},
  );
  assert.equal(
    (await app.inject({ url: file, headers: admin.headers })).statusCode,
    200,
  );
});
