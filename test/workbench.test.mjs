import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import sharp from "sharp";
import { fixture, login, animal, wav } from "./helpers.mjs";
import { saveSettings } from "../server/db.mjs";
import { collectorConfig } from "../server/source-collect.mjs";
import { collectorIO } from "../server/source-request.mjs";
import { parseSpaPage, collectSpa } from "../server/spa-collector.mjs";
import { normalizeSnapshot, applySnapshot } from "../server/source.mjs";
import {
  publicSpaImage,
  compatibilityFromText,
} from "../server/animal-facts.mjs";
import { ingest } from "../server/storage.mjs";
import { resolveFilm } from "../server/video.mjs";
import {
  adjustPixels,
  photoDefaults,
  cropForAspect,
} from "../shared/photo-edit.mjs";
import { upcomingPhotoWindow } from "../shared/photo-weather.mjs";
import { extendForNarration, filmDuration, FPS } from "../video/timing.mjs";
const refuge = "refuge-spa-de-moree-jean-leriche",
  api = "https://www.la-spa.fr/app/wp-json/spa/v1/animals/search/";
const imageUrl =
  "https://www.la-spa.fr/app/app/uploads/animals/42/portrait.jpg";
const record = {
  ID: 42,
  name: "Nala",
  description:
    "Entente chiens : Oui mais ne pourra pas vivre avec ; Entente chats : Non ; Entente enfants : Adolescents",
  full_url: "https://www.la-spa.fr/animal/nala/",
  image: imageUrl,
  sex: "female",
  races_label: "Croisée berger",
  age_number: "4 ans",
  establishment: { slug: refuge },
};

test("narration fitting accounts for overlaps and start time without stretching video clips or exceeding limits", () => {
  const film = {
    introSeconds: 2,
    outroSeconds: 2,
    voiceover: { start: 3 },
    clips: [
      { kind: "photo", seconds: 3 },
      { kind: "video", seconds: 2 },
      { kind: "photo", seconds: 3 },
    ],
  };
  const fitted = extendForNarration(film, 20);
  assert.ok(filmDuration(fitted) >= Math.ceil(23.25 * FPS));
  assert.equal(fitted.clips[1].seconds, 2);
  assert.equal(film.clips[0].seconds, 3);
  assert.ok(fitted.clips.every((clip) => clip.seconds <= 12));
  const tooLong = extendForNarration(film, 80);
  assert.equal(tooLong.clips[0].seconds, 12);
  assert.equal(tooLong.clips[2].seconds, 12);
  assert.ok(filmDuration(tooLong) < 83 * FPS);
  assert.equal(extendForNarration(film, 1), film);
});
test("public SPA API is opt-in, restricted to its exact route and keeps the robots check elsewhere", async () => {
  let checked = 0,
    read = 0;
  const cfg = collectorConfig({
      sourceMode: "spa",
      sourceRobotsPolicy: "spa_public_api",
    }),
    io = collectorIO(cfg, {
      checkRobots: async () => {
        checked++;
        throw Object.assign(Error("robots"), { code: "ROBOTS_DENIED" });
      },
      fetchText: async () => {
        read++;
        return "{}";
      },
      delay: async () => {},
    });
  await io.read(api + "?species=chien");
  assert.equal(checked, 0);
  assert.equal(read, 1);
  await assert.rejects(io.read("https://www.la-spa.fr/app/wp-json/other/"));
  assert.equal(checked, 1);
  assert.equal(read, 1);
  const safe = collectorIO(collectorConfig({ sourceMode: "spa" }), {
    checkRobots: async () => {
      throw Object.assign(Error("robots"), { code: "ROBOTS_DENIED" });
    },
    fetchText: async () => {
      throw Error("must not fetch");
    },
  });
  await assert.rejects(safe.read(api), /robots/);
});
test("current SPA schema retains reference photos, sex, breed, age and qualified compatibility without guessing birth dates", async (t) => {
  const parsed = parseSpaPage(
      { results: [record], nb_pages: 1, total: 1 },
      "dog",
    ),
    snap = normalizeSnapshot({ dog_list: { 42: parsed.records[0] } });
  const a = snap.animals[0];
  assert.equal(a.sourceId, "spa:42");
  assert.equal(a.sex, "female");
  assert.equal(a.breed, "Croisée berger");
  assert.equal(a.metadata.thumbnail, imageUrl);
  assert.equal(a.metadata.ageLabel, "4 ans");
  assert.equal(a.birthDate, null);
  assert.equal(a.compatibility.chien, "Oui mais ne pourra pas vivre avec");
  assert.equal(a.compatibility.enfant, "Adolescents");
  assert.equal(
    parseSpaPage({ results: [], nb_pages: 0, total: 0 }, "nac").records.length,
    0,
  );
  assert.throws(() =>
    parseSpaPage({ results: [record], nb_pages: 0, total: 1 }, "dog"),
  );
  const { db } = await fixture(t);
  applySnapshot(db, snap);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos").get().n, 0);
  let reads = 0;
  const result = await collectSpa({
    config: {
      sourceMode: "spa",
      sourceRobotsPolicy: "spa_public_api",
      sourceAttempts: 2,
    },
    fetchText: async (url) => {
      reads++;
      const species = new URL(url).searchParams.get("species");
      return JSON.stringify(
        species === "chien"
          ? { results: [record], nb_pages: 1, total: 1 }
          : { results: [], nb_pages: 0, total: 0 },
      );
    },
    checkRobots: async () => {},
    delay: async () => {},
  });
  assert.equal(result.complete, true);
  assert.equal(result.animals.length, 1);
  assert.equal(reads, 6);
});
test("SPA reference thumbnails are bounded and cached without adding a local portrait or accepting arbitrary hosts", async (t) => {
  let calls = 0;
  const image = await sharp({
    create: { width: 100, height: 160, channels: 3, background: "#aa7766" },
  })
    .jpeg()
    .toBuffer();
  const { app, db } = await fixture(t, {
      spaPhotoFetcher: async (url, limit, options) => {
        calls++;
        assert.equal(url, imageUrl);
        assert.equal(options.binary, true);
        return image;
      },
    }),
    a = animal(db);
  db.prepare("UPDATE animals SET source_metadata=? WHERE id=?").run(
    JSON.stringify({ thumbnail: imageUrl }),
    a,
  );
  for (let i = 0; i < 2; i++) {
    const r = await app.inject({ url: `/api/animals/${a}/source-photo?w=320` });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal((await sharp(r.rawPayload).metadata()).format, "webp");
  }
  assert.equal(calls, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos").get().n, 0);
  assert.equal(
    (await app.inject({ url: "/api/animals?photos=without" })).json().total,
    1,
  );
  for (const bad of [
    "http://www.la-spa.fr/app/uploads/animals/42/x.jpg",
    "https://localhost/app/uploads/animals/42/x.jpg",
    "https://www.la-spa.fr.evil/app/uploads/animals/42/x.jpg",
    "https://www.la-spa.fr/app/uploads/animals/42/x.svg",
    imageUrl + "?redirect=1",
  ])
    assert.equal(publicSpaImage(bad), "");
  db.prepare("UPDATE animals SET source_metadata=? WHERE id=?").run(
    JSON.stringify({ thumbnail: "https://localhost/private.jpg" }),
    a,
  );
  assert.equal(
    (await app.inject({ url: `/api/animals/${a}/source-photo` })).statusCode,
    404,
  );
  assert.equal(calls, 1);
});
test("photo adjustments preserve identity at neutral settings and alpha, while crop ratios stay centered within bounds", () => {
  const input = new Uint8ClampedArray([25, 100, 200, 120, 100, 100, 100, 255]);
  assert.deepEqual(adjustPixels(input.slice(), photoDefaults), input);
  const brighter = adjustPixels(input.slice(), {
    ...photoDefaults,
    exposure: 1,
  });
  assert.equal(brighter[0], 50);
  assert.equal(brighter[3], 120);
  const grey = adjustPixels(input.slice(), { ...photoDefaults, saturation: 0 });
  assert.equal(grey[0], grey[1]);
  assert.equal(grey[1], grey[2]);
  for (const [w, h, r] of [
    [3000, 2000, 0.8],
    [2000, 3000, 16 / 9],
    [2000, 3000, 1],
  ]) {
    const c = cropForAspect(w, h, r);
    assert.ok(Math.abs((w * c.w) / (h * c.h) - r) < 1e-8);
    assert.ok(c.x >= 0 && c.y >= 0 && c.x + c.w <= 1 && c.y + c.h <= 1);
  }
});
test("weather advice selects a future contiguous daylight window instead of merging distant slots", () => {
  const hours = [
    { time: "2026-10-15T08:00", suitable: true },
    { time: "2026-10-15T12:00", suitable: true },
    { time: "2026-10-15T13:00", suitable: false },
    { time: "2026-10-15T16:00", suitable: true },
    { time: "2026-10-15T17:00", suitable: true },
  ];
  assert.deepEqual(upcomingPhotoWindow(hours, "2026-10-15T11:30"), {
    date: "2026-10-15",
    start: "12:00",
    end: "13:00",
  });
  assert.deepEqual(upcomingPhotoWindow(hours, "2026-10-15T15:00"), {
    date: "2026-10-15",
    start: "16:00",
    end: "18:00",
  });
  assert.equal(upcomingPhotoWindow(hours, "2026-10-15T18:00"), null);
});
test("Mistral voice generation is protected, caches the audio and resolves separately from music", async (t) => {
  const calls = [],
    audio = wav(2),
    { app, db, c } = await fixture(t, {
      mistralApiKey: "test-mistral-key",
      mistralFetcher: async (url, init) => {
        calls.push({ url, init });
        return new Response(
          JSON.stringify(
            url.includes("/voices")
              ? {
                  data: [
                    {
                      id: "voice-fr",
                      name: "Français",
                      type: "preset",
                      languages: ["fr"],
                    },
                  ],
                  next_page_token: null,
                }
              : { audio_data: audio.toString("base64") },
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    }),
    { headers } = await login(app, "agent"),
    a = animal(db),
    img = await sharp({
      create: { width: 50, height: 80, channels: 3, background: "#778899" },
    })
      .jpeg()
      .toBuffer(),
    photo = await ingest(db, c, a, Readable.from(img), "test.jpg");
  const viewer = await login(app, "viewer");
  assert.equal(
    (await app.inject({ url: "/api/video/voices", headers: viewer.headers }))
      .statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/video/narration/generate",
        payload: { text: "Bonjour", voiceId: "voice-fr" },
      })
    ).statusCode,
    401,
  );
  const list = await app.inject({ url: "/api/video/voices", headers });
  assert.equal(list.json().items[0].id, "voice-fr");
  const body = {
    text: "Voici Nala. Contactez le refuge pour en savoir plus.",
    voiceId: "voice-fr",
  };
  const generated = await app.inject({
    method: "POST",
    url: "/api/video/narration/generate",
    headers,
    payload: body,
  });
  assert.equal(generated.statusCode, 200, generated.body);
  assert.equal(generated.body.includes("test-mistral-key"), false);
  assert.equal(calls[1].init.headers.Authorization, "Bearer test-mistral-key");
  const cached = await app.inject({
    method: "POST",
    url: "/api/video/narration/generate",
    headers,
    payload: body,
  });
  assert.equal(cached.json().cached, true);
  assert.equal(cached.json().id, generated.json().id);
  assert.equal(calls.length, 2);
  const film = {
    title: "Nala",
    clips: [{ kind: "photo", ref: photo.id, seconds: 4 }],
    music: null,
    voiceover: { assetId: generated.json().id, start: 1, volume: 0.8 },
  };
  const resolved = resolveFilm(db, c, film, (_kind, id) => "/private/" + id);
  assert.equal(resolved.music, null);
  assert.equal(resolved.voiceover.duration, 2);
  assert.equal(resolved.voiceover.volume, 0.8);
  assert.match(resolved.voiceover.src, /private/);
  assert.throws(
    () =>
      resolveFilm(
        db,
        c,
        { ...film, voiceover: { ...film.voiceover, start: 100 } },
        () => "",
      ),
    /après/,
  );
  const draft = await app.inject({
    method: "POST",
    url: "/api/video/narration/draft",
    headers,
    payload: { photoIds: [photo.id] },
  });
  assert.match(draft.json().text, /Nala/);
  assert.equal(calls.length, 2);
});
test("assistant LLM calls are explicit, server-side and receive public facts, while author links stay on GitHub", async (t) => {
  let request;
  const { app, db } = await fixture(t, {
      tokenharborApiKey: "secret-test",
      aiFetcher: async (url, init) => {
        request = { url, init };
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "Ouvrez le planning photo." } }],
          }),
          { status: 200 },
        );
      },
    }),
    { headers } = await login(app, "agent"),
    admin = await login(app, "admin"),
    a = animal(db, "Nala");
  saveSettings(db, { tokenharborModel: "fixture" });
  db.prepare("UPDATE animals SET source_metadata=? WHERE id=?").run(
    JSON.stringify({ ownerEmail: "never@example.test" }),
    a,
  );
  const result = await app.inject({
    method: "POST",
    url: "/api/assistant/answer",
    headers,
    payload: { query: "Ouvre Nala", provider: "tokenharbor" },
  });
  assert.equal(result.statusCode, 200, result.body);
  assert.equal(request.url, "https://tokenharbor.ai/v1/chat/completions");
  assert.equal(request.init.body.includes("ownerEmail"), false);
  assert.equal(result.body.includes("secret-test"), false);
  const cfg = (
    await app.inject({ url: "/api/admin/settings", headers: admin.headers })
  ).json();
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: "/api/admin/settings",
        headers: admin.headers,
        payload: { ...cfg, authorGithubUrl: "https://evil.test/Gaerisson" },
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (await app.inject({ url: "/api/overview" })).json().authorGithubUrl,
    "https://github.com/Gaerisson/",
  );
});
