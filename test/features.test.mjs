import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import yauzl from "yauzl";
import { fixture, login, animal, wav } from "./helpers.mjs";
import { id, saveSettings } from "../server/db.mjs";
import { ingest } from "../server/storage.mjs";
import {
  synchronize,
  normalizeSnapshot,
  mergeSnapshots,
} from "../server/source.mjs";
import { validateNetwork, matchesNetwork } from "../server/ip-access.mjs";
import {
  ingestAsset,
  resolveFilm,
  Film,
  mediaMetadata,
} from "../server/video.mjs";
import { filmDuration, FPS } from "../video/timing.mjs";
import { localPost, aiPost } from "../server/social.mjs";
import { photoWindow, parseForecast } from "../server/weather.mjs";
import { broadcastFile } from "../server/broadcasts.mjs";
import { createBackup, restoreBackup } from "../server/backup.mjs";
import { DatabaseSync } from "node:sqlite";
const image = () =>
  sharp({
    create: { width: 1200, height: 700, channels: 3, background: "#ca935c" },
  })
    .jpeg()
    .toBuffer();
test("private albums and video audio assets survive verified backup/restore", async (t) => {
  const { app, db, c, base } = await fixture(t),
    { headers, user } = await login(app);
  const album = (
    await app.inject({
      method: "POST",
      url: "/api/collections",
      headers,
      payload: { name: "Private backup" },
    })
  ).json().id;
  const p = await ingest(
      db,
      c,
      null,
      Readable.from(await image()),
      "private.jpg",
      true,
      album,
    ),
    a = await ingestAsset(
      db,
      c,
      Readable.from(wav()),
      "music.wav",
      "audio",
      user.id,
    );
  const result = await createBackup(db, c),
    target = path.join(base, "restored");
  await restoreBackup(path.join(c.backupDir, result.filename), target);
  const restored = new DatabaseSync(path.join(target, "data/anipic.sqlite"), {
    readOnly: true,
  });
  try {
    assert.equal(
      restored
        .prepare("SELECT is_public FROM collections WHERE id=?")
        .get(album).is_public,
      0,
    );
    assert.equal(
      restored
        .prepare("SELECT COUNT(*) n FROM album_photos WHERE id=?")
        .get(p.id).n,
      1,
    );
    assert.equal(
      restored
        .prepare("SELECT COUNT(*) n FROM video_assets WHERE id=?")
        .get(a.id).n,
      1,
    );
    assert.equal(
      restored.prepare("SELECT COUNT(*) n FROM sessions").get().n,
      0,
    );
  } finally {
    restored.close();
  }
});
test("recent photos sorting and week filter use visible photo dates, not animal creation dates", async (t) => {
  const { app, db, c } = await fixture(t),
    one = animal(db, "Recently created"),
    two = animal(db, "Recent photo"),
    p1 = await ingest(db, c, one, Readable.from(await image()), "old.jpg"),
    p2 = await ingest(db, c, two, Readable.from(await image()), "new.jpg");
  db.prepare("UPDATE photos SET created_at=? WHERE id=?").run(
    new Date(Date.now() - 20 * 86400_000).toISOString(),
    p1.id,
  );
  db.prepare("UPDATE animals SET created_at=? WHERE id=?").run(
    "2020-01-01T00:00:00Z",
    two,
  );
  const r = (
    await app.inject({ url: "/api/animals?recent=1&sort=recent" })
  ).json();
  const missing = animal(db, "No portrait yet");
  db.prepare("UPDATE animals SET created_at=? WHERE id=?").run(
    new Date(Date.now() + 1000).toISOString(),
    missing,
  );
  assert.equal(r.total, 1);
  assert.equal(r.items[0].id, two);
  assert.equal(
    (await app.inject({ url: "/api/animals?sort=recent" })).json().items[0].id,
    two,
  );
});
async function zipNames(buffer) {
  return new Promise((resolve, reject) =>
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, z) => {
      if (err) return reject(err);
      const names = [];
      z.on("entry", (e) => {
        names.push(e.fileName);
        z.readEntry();
      });
      z.on("end", () => resolve(names));
      z.on("error", reject);
      z.readEntry();
    }),
  );
}
test("public resized exports preserve dimensions, private photos and originals stay protected; ZIP excludes thumbnails", async (t) => {
  const { app, db, c } = await fixture(t),
    { headers } = await login(app),
    a = animal(db),
    b = await image(),
    p = await ingest(db, c, a, Readable.from(b), "portrait.jpg"),
    secret = await ingest(
      db,
      c,
      a,
      Readable.from(await sharp(b).flop().png().toBuffer()),
      "secret.png",
      true,
    );
  for (const format of ["jpeg", "png", "webp"]) {
    const r = await app.inject({
      url: `/api/photos/${p.id}/download?format=${format}&size=small`,
    });
    assert.equal(r.statusCode, 200, r.body);
    const m = await sharp(r.rawPayload).metadata();
    assert.equal(m.format, format);
    assert.equal(m.width, 800);
  }
  assert.equal(
    (await app.inject({ url: `/api/photos/${secret.id}/download` })).statusCode,
    404,
  );
  assert.equal(
    (await app.inject({ url: `/api/photos/${p.id}/download?format=original` }))
      .statusCode,
    401,
  );
  const square = await app.inject({
      url: `/api/photos/${p.id}/download?format=png&layout=square`,
    }),
    m = await sharp(square.rawPayload).metadata();
  assert.equal(m.width, 1080);
  assert.equal(m.height, 1080);
  const z = await app.inject({ url: `/api/animals/${a}/download`, headers });
  assert.equal(z.statusCode, 200);
  assert.deepEqual(await zipNames(z.rawPayload), [
    "0001_portrait.jpg",
    "0002_secret.png",
  ]);
});
test("SPA animal facts cannot be edited manually, likes are idempotent and viewers cannot change tasks", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    viewer = await login(app, "viewer"),
    a = animal(db),
    p = await ingest(db, c, a, Readable.from(await image()), "a.jpg");
  assert.equal(
    (
      await app.inject({
        method: "PATCH",
        url: `/api/animals/${a}`,
        headers: admin.headers,
        payload: { name: "Changed" },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/animals",
        headers: admin.headers,
        payload: { name: "Invented" },
      })
    ).statusCode,
    403,
  );
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/api/photos/${p.id}/like`,
          headers: viewer.headers,
          payload: { liked: true },
        })
      ).statusCode,
      200,
    );
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photo_likes").get().n, 1);
  const r = await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers: admin.headers,
    payload: {
      animalId: a,
      title: "Refaire le portrait",
      note: "Fond calme",
      priority: "urgent",
    },
  });
  assert.equal(r.statusCode, 201, r.body);
  const task = r.json().id;
  assert.equal(
    (
      await app.inject({
        method: "PATCH",
        url: `/api/tasks/${task}`,
        headers: viewer.headers,
        payload: { state: "done" },
      })
    ).statusCode,
    403,
  );
  await app.inject({
    method: "PATCH",
    url: `/api/tasks/${task}`,
    headers: admin.headers,
    payload: { state: "progress" },
  });
  const row = db.prepare("SELECT * FROM shoot_tasks WHERE id=?").get(task);
  assert.equal(row.note, "Fond calme");
  assert.equal(row.priority, "urgent");
  assert.equal(row.state, "progress");
});
test("private nested albums enforce parent visibility; their uploads use shared immutable blobs", async (t) => {
  const { app, db, c } = await fixture(t),
    { headers } = await login(app),
    create = async (name, parentId = null) =>
      (
        await app.inject({
          method: "POST",
          url: "/api/collections",
          headers,
          payload: { name, parentId },
        })
      ).json().id;
  const parent = await create("Agents"),
    child = await create("Portes ouvertes", parent),
    p = await ingest(
      db,
      c,
      null,
      Readable.from(await image()),
      "agents.jpg",
      true,
      child,
    );
  assert.equal(
    (await app.inject({ url: "/api/collections" })).json().length,
    0,
  );
  assert.equal(
    (await app.inject({ url: `/api/album-media/${p.id}` })).statusCode,
    404,
  );
  assert.equal((await app.inject({ url: `/media/${p.id}` })).statusCode, 404);
  assert.equal(
    (await app.inject({ url: `/api/album-media/${p.id}`, headers })).statusCode,
    200,
  );
  await app.inject({
    method: "PATCH",
    url: `/api/collections/${child}`,
    headers,
    payload: { isPublic: true },
  });
  assert.equal(
    (await app.inject({ url: `/api/album-media/${p.id}` })).statusCode,
    404,
  );
  await app.inject({
    method: "PATCH",
    url: `/api/collections/${parent}`,
    headers,
    payload: { isPublic: true },
  });
  assert.equal(
    (await app.inject({ url: `/api/album-media/${p.id}` })).statusCode,
    200,
  );
  assert.equal(
    (await app.inject({ url: `/api/album-media/${p.id}?original=1` }))
      .statusCode,
    401,
  );
  await app.inject({
    method: "PATCH",
    url: `/api/collections/${parent}`,
    headers,
    payload: { isPublic: false },
  });
  assert.equal(
    (await app.inject({ url: `/api/album-media/${p.id}` })).statusCode,
    404,
  );
  const again = await ingest(
    db,
    c,
    null,
    Readable.from(await image()),
    "copy.jpg",
    true,
    child,
  );
  assert.equal(again.duplicate, true);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM blobs").get().n, 1);
  const zip = await app.inject({
    url: `/api/collections/${child}/download`,
    headers,
  });
  assert.deepEqual(await zipNames(zip.rawPayload), ["0001_agents.jpg"]);
});
test("feed includes permitted photos, paginates, escapes RSS and does not duplicate archive events", async (t) => {
  const { app, db, c } = await fixture(t),
    { headers } = await login(app),
    a = animal(db, "Nala <&>"),
    p = await ingest(db, c, a, Readable.from(await image()), "a.jpg");
  animal(db, "Rio");
  let r = (await app.inject({ url: "/api/feed?limit=1" })).json();
  assert.equal(r.events[0].photo_id, p.id);
  assert.equal(r.hasMore, true);
  const next = (
    await app.inject({ url: "/api/feed?after=" + r.lastSeq })
  ).json();
  assert.ok(next.events.every((e) => e.seq > r.lastSeq));
  const xml = (await app.inject({ url: "/feed.xml" })).body;
  assert.match(xml, /Nala &lt;&amp;&gt;/);
  for (let i = 0; i < 2; i++)
    await app.inject({
      method: "POST",
      url: `/api/animals/${a}/archive`,
      headers,
      payload: { archived: true },
    });
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) n FROM feed_events WHERE animal_id=? AND kind='removed'",
      )
      .get(a).n,
    1,
  );
});
test("inventory retries merge unstable pages and any failed pass prevents a complete snapshot", async (t) => {
  const { db } = await fixture(t);
  saveSettings(db, {
    sourceMode: "json",
    sourceUrl: "https://example.org/spa.json",
  });
  const snap = (names) => ({
    schemaVersion: 1,
    scope: "moree",
    fetchedAt: new Date().toISOString(),
    complete: true,
    expectedCount: names.length,
    animals: names.map((name) => ({
      sourceId: "spa:" + name,
      name,
      species: "dog",
    })),
  });
  let tries = 0;
  const result = await synchronize(db, {
    fetchText: async () =>
      JSON.stringify(snap(++tries === 2 ? ["A", "B"] : ["A"])),
    checkRobots: async () => {},
    delay: async () => {},
  });
  assert.equal(tries, 3);
  assert.equal(result.stable, false);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM animals").get().n, 2);
  tries = 0;
  const partial = await synchronize(db, {
    fetchText: async () => {
      if (++tries === 2) throw new Error("Source vide");
      return JSON.stringify(snap(["A", "B"]));
    },
    checkRobots: async () => {},
    delay: async () => {},
  });
  assert.equal(partial.validAttempts, 2);
  assert.equal(partial.failures.length, 1);
  const stable = mergeSnapshots([
    normalizeSnapshot(snap(["A"])),
    normalizeSnapshot(snap(["A"])),
  ]);
  assert.equal(stable.complete, true);
});
test("IP rules bind accounts to verified connection IP and do not trust spoofed forwarding", async (t) => {
  assert.equal(validateNetwork("192.168.1.2"), "192.168.1.2/32");
  assert.equal(matchesNetwork("::ffff:192.168.1.10", "192.168.1.0/24"), true);
  assert.equal(matchesNetwork("192.168.2.1", "192.168.1.0/24"), false);
  assert.equal(matchesNetwork("2001:db8::a", "2001:db8::/64"), true);
  assert.throws(() => validateNetwork("0.0.0.0/0"));
  const { app, db } = await fixture(t),
    u = await login(app, "viewer");
  db.prepare("INSERT INTO ip_rules VALUES (?,?,?,?,?)").run(
    id(),
    u.user.id,
    "192.168.1.0/24",
    "Refuge",
    new Date().toISOString(),
  );
  assert.equal(
    (
      await app.inject({
        url: "/api/tasks",
        remoteAddress: "203.0.113.1",
        headers: { ...u.headers, "x-forwarded-for": "192.168.1.1" },
      })
    ).statusCode,
    401,
  );
  assert.equal(
    (
      await app.inject({
        url: "/api/tasks",
        remoteAddress: "192.168.1.20",
        headers: u.headers,
      })
    ).statusCode,
    200,
  );
});
test("video assets validate actual containers, private ranges and film duration/ref limits", async (t) => {
  const { app, db, c, base } = await fixture(t),
    { headers, user } = await login(app),
    audio = await ingestAsset(
      db,
      c,
      Readable.from(wav()),
      "music.wav",
      "audio",
      user.id,
    ),
    a = animal(db),
    p = await ingest(db, c, a, Readable.from(await image()), "a.jpg");
  assert.equal(
    (await app.inject({ url: `/api/video/assets/${audio.id}/file` }))
      .statusCode,
    401,
  );
  const range = await app.inject({
    url: `/api/video/assets/${audio.id}/file`,
    headers: { ...headers, range: "bytes=0-9" },
  });
  assert.equal(range.statusCode, 206);
  assert.equal(range.rawPayload.length, 10);
  assert.equal(
    (
      await app.inject({
        url: `/api/video/assets/${audio.id}/file`,
        headers: { ...headers, range: "bytes=999999-" },
      })
    ).statusCode,
    416,
  );
  const film = {
    title: "Test",
    clips: [
      { kind: "photo", ref: p.id, seconds: 3 },
      { kind: "photo", ref: p.id, seconds: 3 },
    ],
    music: { assetId: audio.id, volume: 0.2 },
  };
  const f = resolveFilm(db, c, film, () => "/local");
  assert.equal(f.clips[0].title, "Nala");
  assert.equal(filmDuration(f) / FPS, 9.5);
  assert.throws(() =>
    Film.parse({
      ...film,
      clips: [{ kind: "photo", ref: "../../secret", seconds: 2 }],
    }),
  );
  assert.throws(() =>
    resolveFilm(
      db,
      c,
      { ...film, music: { assetId: id(), volume: 0.5 } },
      () => "/local",
    ),
  );
  const bad = path.join(base, "bad.m3u8");
  await fs.writeFile(bad, "#EXTM3U\nhttps://example.com/secret");
  await assert.rejects(
    () => mediaMetadata(bad, "video"),
    (e) => e.statusCode === 400,
  );
});
test("Facebook local text is formatted from public facts and AI adapters keep keys server-side", async () => {
  const a = {
    name: "Nala",
    species: "cat",
    sex: "female",
    breed: "Européen",
    description: "Très douce.",
    compatibility: '{"chats":"ok","chiens":"non"}',
    status: "available",
    internal_notes: "SECRET",
    source_url: "https://www.la-spa.fr/animal/nala",
  };
  const text = localPost(a);
  assert.match(text, /🐱 Chats : Ok/);
  assert.match(
    localPost({ ...a, compatibility: '{"chats":"Oui"}' }),
    /🐱 OK Chats/,
  );
  assert.match(text, /🐶 Pas OK Chiens/);
  assert.match(text, /\n\n/);
  assert.doesNotMatch(text, /SECRET/);
  const saved = {
    g: process.env.GEMINI_API_KEY,
    t: process.env.TOKENHARBOR_API_KEY,
    m: process.env.TOKENHARBOR_MODEL,
  };
  try {
    process.env.GEMINI_API_KEY = "test-only";
    process.env.TOKENHARBOR_API_KEY = "test-only";
    process.env.TOKENHARBOR_MODEL = "google/test";
    await aiPost(a, "gemini", "warm", async (url, opts) => {
      assert.match(url, /generativelanguage.googleapis.com/);
      assert.equal(opts.headers["x-goog-api-key"], "test-only");
      assert.doesNotMatch(opts.body, /SECRET/);
      return new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: "STOP",
              content: { parts: [{ text: "Brouillon Gemini" }] },
            },
          ],
        }),
      );
    });
    const result = await aiPost(a, "tokenharbor", "warm", async (url, opts) => {
      assert.equal(url, "https://tokenharbor.ai/v1/chat/completions");
      assert.equal(opts.headers.Authorization, "Bearer test-only");
      assert.doesNotMatch(opts.body, /SECRET/);
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "Brouillon Token Harbor" } }],
        }),
      );
    });
    assert.equal(result, "Brouillon Token Harbor");
  } finally {
    for (const [key, value] of [
      ["GEMINI_API_KEY", saved.g],
      ["TOKENHARBOR_API_KEY", saved.t],
      ["TOKENHARBOR_MODEL", saved.m],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
test("Morée photo weather heuristic excludes night, wind and rain", () => {
  assert.throws(() =>
    parseForecast({
      hourly: { time: ["2026-10-14T12:00"] },
      daily: { time: ["2026-10-14"] },
      current: {},
    }),
  );
  const hour = {
    day: 1,
    rainProbability: 10,
    rain: 0,
    wind: 10,
    temperature: 20,
  };
  assert.equal(photoWindow(hour).suitable, true);
  for (const v of [
    { day: 0 },
    { rainProbability: 80 },
    { wind: 40 },
    { temperature: 35 },
  ])
    assert.equal(photoWindow({ ...hour, ...v }).suitable, false);
});
test("C8 streaming is private, read-only, bounded to its root and supports byte seeking", async (t) => {
  const folder = await fs.mkdtemp(
    path.join((await import("node:os")).tmpdir(), "anipic-c8-"),
  );
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  await fs.mkdir(path.join(folder, "Saison 1"));
  await fs.writeFile(
    path.join(
      folder,
      "Saison 1",
      "Animaux à adopter - saison 2 - épisode 15 - diffusion septembre 2026 - version haute définition.mp4",
    ),
    Buffer.alloc(100, 1),
  );
  await fs.writeFile(path.join(folder, "secret.txt"), "PRIVATE");
  const { app } = await fixture(t, { broadcastDir: folder }),
    { headers } = await login(app);
  assert.equal((await app.inject({ url: "/api/broadcasts" })).statusCode, 401);
  const list = (await app.inject({ url: "/api/broadcasts", headers })).json();
  assert.equal(list.videos.length, 1);
  const key = list.videos[0].id;
  const r = await app.inject({
    url: `/api/broadcasts/${key}/file`,
    headers: { ...headers, range: "bytes=20-39" },
  });
  assert.equal(r.statusCode, 206);
  assert.equal(r.rawPayload.length, 20);
  await assert.rejects(() =>
    broadcastFile(folder, Buffer.from("../secret.txt").toString("base64url")),
  );
  await assert.rejects(() =>
    broadcastFile(folder, Buffer.from("secret.txt").toString("base64url")),
  );
});
