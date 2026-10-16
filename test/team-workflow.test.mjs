import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import yauzl from "yauzl";
import { fixture, login, animal, wav } from "./helpers.mjs";
import { ingest } from "../server/storage.mjs";
import { saveSettings, now } from "../server/db.mjs";
import { normalizeSnapshot, applySnapshot } from "../server/source.mjs";
import { findSimilar, hamming } from "../server/similar-photos.mjs";
import { Film, ingestAsset } from "../server/video.mjs";
import {
  parseSrt,
  toSrt,
  estimatedCues,
  validateCues,
} from "../shared/subtitles.mjs";
const image = (color = "#af753b") =>
  sharp({ create: { width: 400, height: 600, channels: 3, background: color } })
    .jpeg()
    .toBuffer();
const call = (app, headers, method, url, payload) =>
  app.inject({ method, url, headers, payload });
test("automatic folder polling imports a stable export once and records its status without assigning it", async (t) => {
  const native = global.setInterval,
    callbacks = [];
  t.mock.method(global, "setInterval", (fn, ms, ...args) => {
    if (ms === 15000) callbacks.push(fn);
    return native(fn, ms, ...args);
  });
  const { app, db, c, base } = await fixture(t, { scheduler: true });
  c.importDir = path.join(base, "depot");
  await fs.mkdir(path.join(c.importDir, "Chats", "Nala"), { recursive: true });
  const file = path.join(c.importDir, "Chats", "Nala", "lr-export.jpg");
  await fs.writeFile(file, await image());
  const stable = new Date(Date.now() - 60000);
  await fs.utimes(file, stable, stable);
  saveSettings(db, { importAutoEnabled: true, backupIntervalHours: 0 });
  assert.equal(callbacks.length, 1);
  await callbacks[0]();
  assert.equal(db.prepare("SELECT COUNT(*) n FROM inbox_photos").get().n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos").get().n, 0);
  await callbacks[0]();
  assert.equal(db.prepare("SELECT COUNT(*) n FROM inbox_photos").get().n, 1);
  const admin = await login(app);
  const status = (
    await app.inject({ url: "/api/inbox/automation", headers: admin.headers })
  ).json();
  assert.equal(status.last.added, 1);
  assert.equal(status.scheduler, true);
});
test("photo comments are private, anchored, role checked and only their author/admin can alter the text", async (t) => {
  const { app, db, c } = await fixture(t),
    agent = await login(app, "agent"),
    other = await login(app, "agent", "agent2"),
    viewer = await login(app, "viewer");
  const a = animal(db),
    p = await ingest(db, c, a, Readable.from(await image()), "photo.jpg");
  const url = `/api/photos/${p.id}/comments`;
  assert.equal((await app.inject({ url })).statusCode, 401);
  assert.equal(
    (await call(app, viewer.headers, "POST", url, { body: "note" })).statusCode,
    403,
  );
  const r = await call(app, agent.headers, "POST", url, {
    body: "Recadrer près de l’œil",
    x: 0.4,
    y: 0.3,
  });
  assert.equal(r.statusCode, 200, r.body);
  const id = r.json().id;
  assert.equal(
    (
      await call(app, other.headers, "PATCH", `/api/photo-comments/${id}`, {
        body: "remplacer",
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await call(app, other.headers, "PATCH", `/api/photo-comments/${id}`, {
        resolved: true,
      })
    ).statusCode,
    200,
  );
  const list = (await app.inject({ url, headers: viewer.headers })).json()
    .items;
  assert.equal(list[0].x, 0.4);
  assert.equal(list[0].body, "Recadrer près de l’œil");
  assert.equal(
    (await call(app, other.headers, "DELETE", `/api/photo-comments/${id}`))
      .statusCode,
    403,
  );
  assert.equal(
    (await call(app, agent.headers, "DELETE", `/api/photo-comments/${id}`))
      .statusCode,
    200,
  );
});
test("promotion checkbox is internal, records its date, and can filter a gallery", async (t) => {
  const { app, db } = await fixture(t),
    agent = await login(app, "agent"),
    a = animal(db);
  assert.equal(
    (
      await call(app, agent.headers, "PUT", `/api/animals/${a}/publication`, {
        published: true,
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (await app.inject({ url: `/api/animals/${a}` })).json().publication,
    undefined,
  );
  assert.ok(
    (
      await app.inject({ url: `/api/animals/${a}`, headers: agent.headers })
    ).json().publication.published_at,
  );
  assert.equal(
    (
      await app.inject({
        url: "/api/animals?publication=yes",
        headers: agent.headers,
      })
    ).json().total,
    1,
  );
  assert.equal(
    (
      await app.inject({
        url: "/api/animals?publication=no",
        headers: agent.headers,
      })
    ).json().total,
    0,
  );
  assert.equal(
    (await app.inject({ url: "/api/animals?publication=yes" })).json().total,
    0,
  );
});
test("SPA history captures field changes once, sanitizes metadata and exposes paginated public cursors without private team data", async (t) => {
  const { app, db } = await fixture(t);
  const data = {
    schemaVersion: 1,
    scope: "spa:moree",
    complete: false,
    animals: [
      {
        sourceId: "spa:111",
        name: "Nala",
        species: "cat",
        sex: "female",
        description: "Première présentation",
        metadata: {
          weight: "4 kg",
          microchip: "private",
          ownerEmail: "private@example.invalid",
        },
      },
    ],
  };
  const first = normalizeSnapshot(data);
  applySnapshot(db, first);
  const count = db.prepare("SELECT COUNT(*) n FROM animal_changes").get().n;
  applySnapshot(db, first);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM animal_changes").get().n,
    count,
  );
  data.animals[0].description = "Nouvelle présentation";
  data.animals[0].status = "reserved";
  applySnapshot(db, normalizeSnapshot(data));
  const response = await app.inject({
    url: "/api/public/changes?field=description&limit=1",
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.ok(response.json().next);
  const next = await app.inject({
    url: `/api/public/changes?field=description&after=${response.json().next}`,
  });
  assert.equal(next.json().items[0].before, "Première présentation");
  assert.equal(next.json().items[0].after, "Nouvelle présentation");
  assert.equal(
    (
      await app.inject({
        url: "/api/public/changes",
        headers: {
          "if-none-match": (await app.inject({ url: "/api/public/changes" }))
            .headers.etag,
        },
      })
    ).statusCode,
    304,
  );
  const raw = (await app.inject({ url: "/api/public/changes" })).body;
  assert.doesNotMatch(raw, /private@example|microchip|user_id|published_at/);
  saveSettings(db, { publicHistoryEnabled: false });
  assert.equal(
    (await app.inject({ url: "/api/public/changes" })).statusCode,
    404,
  );
});
test("folder suggestions preserve homonyms and remembered mappings never assign photos without confirmation", async (t) => {
  const { app, db, c } = await fixture(t),
    agent = await login(app, "agent"),
    a = animal(db, "Nala"),
    b = animal(db, "Nala");
  const p = await ingest(
    db,
    c,
    null,
    Readable.from(await image()),
    "export.jpg",
    false,
    null,
    { folder: "Chats/Nala", userId: agent.user.id },
  );
  const r = await call(app, agent.headers, "POST", "/api/inbox/suggestions", {
    photoIds: [p.id],
  });
  assert.equal(r.json().items.length, 2);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos").get().n, 0);
  const assigned = await call(app, agent.headers, "POST", "/api/inbox/assign", {
    photoIds: [p.id],
    animalId: b,
    hidden: true,
    rememberFolder: true,
  });
  assert.equal(assigned.statusCode, 200, assigned.body);
  const q = await ingest(
    db,
    c,
    null,
    Readable.from(await image("#cc3322")),
    "suite.jpg",
    false,
    null,
    { folder: "Chats/Nala", userId: agent.user.id },
  );
  const next = await call(
    app,
    agent.headers,
    "POST",
    "/api/inbox/suggestions",
    { photoIds: [q.id] },
  );
  assert.equal(next.json().items[0].id, b);
  assert.equal(next.json().items[0].score, 100);
  assert.ok(db.prepare("SELECT 1 FROM inbox_photos WHERE id=?").get(q.id));
  const admin = await login(app);
  assert.equal(
    (
      await call(app, agent.headers, "PUT", "/api/inbox/automation", {
        enabled: true,
        intervalMinutes: 2,
        stableSeconds: 20,
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await call(app, admin.headers, "PUT", "/api/inbox/automation", {
        enabled: true,
        intervalMinutes: 2,
        stableSeconds: 20,
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await app.inject({ url: "/api/inbox/automation", headers: admin.headers })
    ).json().scheduler,
    false,
  );
});
test("A4/A5 posters have physical print dimensions and communication packs contain only the selected animal's photos", async (t) => {
  const { app, db, c } = await fixture(t),
    agent = await login(app, "agent"),
    a = animal(db),
    b = animal(db, "Autre"),
    p = await ingest(db, c, a, Readable.from(await image()), "portrait.jpg"),
    q = await ingest(
      db,
      c,
      b,
      Readable.from(await image("#123456")),
      "autre.jpg",
    );
  db.prepare(
    "UPDATE animals SET source_url='https://www.la-spa.fr/animal/nala-111/',compatibility=? WHERE id=?",
  ).run(JSON.stringify({ chat: "Oui", chien: "À tester" }), a);
  const response = await call(
    app,
    agent.headers,
    "POST",
    `/api/animals/${a}/poster`,
    { photoId: p.id },
  );
  assert.equal(response.statusCode, 200, response.body.slice(0, 100));
  const doc = await PDFDocument.load(response.rawPayload);
  assert.equal(doc.getPageCount(), 1);
  const size = doc.getPage(0).getSize();
  assert.ok(Math.abs(size.width - 595.276) < 0.01);
  assert.ok(Math.abs(size.height - 841.89) < 0.01);
  const a5 = await call(
    app,
    agent.headers,
    "POST",
    `/api/animals/${a}/poster`,
    { photoId: p.id, paper: "a5" },
  );
  const a5Doc = await PDFDocument.load(a5.rawPayload),
    a5Size = a5Doc.getPage(0).getSize();
  assert.ok(Math.abs(a5Size.width - 419.528) < 0.01);
  assert.ok(Math.abs(a5Size.height - 595.276) < 0.01);
  const png = await call(
    app,
    agent.headers,
    "POST",
    `/api/animals/${a}/poster`,
    { photoId: p.id, format: "png" },
  );
  const meta = await sharp(png.rawPayload).metadata();
  assert.equal(meta.width, 2480);
  assert.equal(meta.height, 3508);
  assert.equal(meta.density, 300);
  assert.equal(
    (
      await call(app, agent.headers, "POST", `/api/animals/${a}/poster`, {
        photoId: q.id,
      })
    ).statusCode,
    404,
  );
  const pack = await call(
    app,
    agent.headers,
    "POST",
    `/api/animals/${a}/communication-pack`,
    { photoIds: [p.id], accent: "#e97435", includePoster: false },
  );
  assert.equal(pack.statusCode, 200);
  const zip = await yauzl.fromBufferPromise(pack.rawPayload, {
      lazyEntries: true,
    }),
    names = [];
  await new Promise((resolve, reject) => {
    zip.on("entry", (entry) => {
      names.push(entry.fileName);
      zip.readEntry();
    });
    zip.on("end", resolve);
    zip.on("error", reject);
    zip.readEntry();
  });
  assert.deepEqual(
    names.sort(),
    [
      "photos-web/01.jpg",
      "visuel-facebook.jpg",
      "visuel-story.jpg",
      "presentation.txt",
      "LIRE-MOI.txt",
    ].sort(),
  );
  assert.equal(
    (
      await call(
        app,
        agent.headers,
        "POST",
        `/api/animals/${a}/communication-pack`,
        { photoIds: [p.id, q.id], accent: "#e97435" },
      )
    ).statusCode,
    404,
  );
});
test("public TV display excludes private photos, hidden animals, reservations and departed animals", async (t) => {
  const { app, db, c } = await fixture(t),
    a = animal(db, "Visible"),
    b = animal(db, "Privé"),
    hidden = animal(db, "Masqué"),
    reserved = animal(db, "Réservé"),
    archived = animal(db, "Parti");
  for (const [id, privatePhoto] of [
    [a, false],
    [b, true],
    [hidden, false],
    [reserved, false],
    [archived, false],
  ])
    await ingest(
      db,
      c,
      id,
      Readable.from(await image()),
      "portrait.jpg",
      privatePhoto,
    );
  db.prepare("UPDATE animals SET status='reserved' WHERE id=?").run(reserved);
  db.prepare("UPDATE animals SET archived_at=? WHERE id=?").run(
    now(),
    archived,
  );
  saveSettings(db, {
    displayEnabled: true,
    displayHiddenIds: [hidden],
    displayQr: false,
  });
  const r = (await app.inject({ url: "/api/public/display" })).json();
  assert.deepEqual(
    r.items.map((a) => a.id),
    [a],
  );
  assert.doesNotMatch(JSON.stringify(r), /hash|user_id|published_at/);
  saveSettings(db, { displayReserved: true });
  assert.equal(
    (await app.inject({ url: "/api/public/display" })).json().items.length,
    2,
  );
  saveSettings(db, { displayEnabled: false });
  assert.equal(
    (await app.inject({ url: "/api/public/display" })).json().items.length,
    0,
  );
});
test("similarity analysis compares originals without deleting files or changing albums", async (t) => {
  const { app, db, c } = await fixture(t),
    a = animal(db),
    first = await image(),
    second = await sharp(first).jpeg({ quality: 65 }).toBuffer();
  await ingest(db, c, a, Readable.from(first), "a.jpg");
  await ingest(db, c, a, Readable.from(second), "b.jpg");
  const result = await findSimilar(db, c, 2);
  assert.equal(result.items.length, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos").get().n, 2);
  assert.equal(hamming("0000000000000000", "ffffffffffffffff"), 64);
  assert.equal(
    (
      await app.inject({
        url: "/api/admin/similar-photos",
        method: "POST",
        payload: {},
      })
    ).statusCode,
    401,
  );
});
test("editable subtitles round-trip SRT, reject overlaps and stay within the video", () => {
  const cues = estimatedCues(
    "Nala cherche une famille. Venez la rencontrer au refuge de Morée.",
    2,
    8,
  );
  assert.deepEqual(parseSrt(toSrt(cues)), cues);
  assert.equal(
    cues.map((c) => c.text).join(" "),
    "Nala cherche une famille. Venez la rencontrer au refuge de Morée.",
  );
  assert.ok(cues.every((c) => c.text.split(/\s+/).length >= 3));
  assert.throws(() =>
    validateCues([
      { start: 0, end: 3, text: "A" },
      { start: 2, end: 4, text: "B" },
    ]),
  );
  const film = {
    title: "Sous-titres",
    clips: [
      {
        kind: "photo",
        ref: "e0abc750-2c57-4367-9005-0e1ca41bf11b",
        seconds: 5,
      },
    ],
    subtitles: { enabled: true, cues: [{ start: 1, end: 3, text: "Nala" }] },
  };
  assert.ok(Film.parse(film).subtitles.enabled);
  assert.throws(() =>
    Film.parse({
      ...film,
      subtitles: {
        enabled: true,
        cues: [{ start: 0, end: 599, text: "Trop long" }],
      },
    }),
  );
});
test("Mistral transcription extracts local audio, uses bounded timestamp requests and never exposes the key", async (t) => {
  let called = 0;
  const { app, db, c } = await fixture(t, {
      mistralApiKey: "test-private-key",
      mistralFetcher: async (url, options) => {
        called++;
        assert.equal(url, "https://api.mistral.ai/v1/audio/transcriptions");
        assert.equal(options.headers.Authorization, "Bearer test-private-key");
        assert.equal(options.body.get("timestamp_granularities[]"), "segment");
        assert.equal(options.body.has("language"), false);
        assert.ok(options.body.get("file").size > 100);
        return new Response(
          JSON.stringify({
            text: "Nala",
            segments: [{ start: 0, end: 1, text: "Nala" }],
          }),
          { status: 200 },
        );
      },
    }),
    agent = await login(app, "agent");
  const asset = await ingestAsset(
    db,
    c,
    Readable.from(wav(2)),
    "voix.wav",
    "audio",
    agent.user.id,
  );
  assert.equal(
    (
      await call(app, agent.headers, "POST", "/api/video/transcribe", {
        assetId: asset.id,
      })
    ).statusCode,
    400,
  );
  assert.equal(called, 0);
  const result = await call(
    app,
    agent.headers,
    "POST",
    "/api/video/transcribe",
    { assetId: asset.id, confirmUpload: true, offset: 2 },
  );
  assert.equal(result.statusCode, 200, result.body);
  assert.equal(result.json().cues[0].start, 2);
  assert.equal(called, 1);
  assert.doesNotMatch(result.body, /test-private-key/);
  assert.equal(
    (await fs.readdir(c.cacheDir)).filter((n) => n.startsWith("speech-"))
      .length,
    0,
  );
});
