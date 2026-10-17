import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { fixture, login, animal, wav } from "./helpers.mjs";
import { ingest } from "../server/storage.mjs";
import { ingestAsset } from "../server/video.mjs";
import { aiResponseText } from "../server/ai-response.mjs";
import {
  beginMediaWrite,
  mediaMaintenance,
} from "../server/media-maintenance.mjs";
import {
  archiveCandidates,
  compressArchives,
  verifyArchive,
} from "../server/archive-compression.mjs";
import {
  pruneBackups,
  restoreBackup,
  createBackup,
  fileHash,
} from "../server/backup.mjs";
import { messageContent } from "../shared/content-defaults.mjs";
import { visualTheme, scheduleRows } from "../shared/visual-themes.mjs";
import { parseShow } from "../server/signage-schema.mjs";
import {
  compatibilityState,
  labelledCompatibility,
  normalizeCompatibility,
} from "../shared/compatibility-text.mjs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ffmpegPath } from "../server/transcription.mjs";
import { broadcastThumbnail } from "../server/broadcast-thumbnails.mjs";
const picture = () =>
  sharp({
    create: { width: 700, height: 500, channels: 3, background: "#df9866" },
  })
    .png()
    .toBuffer();
const multipart = (image, name = "image.png") => ({
  payload: Buffer.concat([
    Buffer.from(
      `--test34\r\nContent-Disposition: form-data; name="avatar"; filename="${name}"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    image,
    Buffer.from("\r\n--test34--\r\n"),
  ]),
  headers: { "content-type": "multipart/form-data; boundary=test34" },
});
test("AI response formats, thought-only exhaustion and errors visible without leaking server exceptions", async (t) => {
  assert.equal(
    aiResponseText(
      {
        choices: [
          {
            message: {
              content: [
                { type: "text", text: "Bonjour" },
                { type: "text", text: " !" },
              ],
            },
          },
        ],
      },
      "tokenharbor",
    ),
    "Bonjour\n !",
  );
  assert.throws(
    () =>
      aiResponseText(
        {
          candidates: [
            {
              finishReason: "MAX_TOKENS",
              content: {
                parts: [{ thought: true, text: "private reasoning" }],
              },
            },
          ],
        },
        "gemini",
      ),
    /limite/,
  );
  const { app } = await fixture(t, {
      geminiApiKey: "private-key",
      aiFetcher: async () =>
        new Response(
          JSON.stringify({
            candidates: [{ finishReason: "STOP", content: { parts: [] } }],
          }),
        ),
    }),
    admin = await login(app);
  const r = await app.inject({
    method: "POST",
    url: "/api/assistant/chat",
    headers: admin.headers,
    payload: { query: "Comment faire une affiche ?", provider: "gemini" },
  });
  assert.equal(r.statusCode, 502);
  assert.match(r.json().error, /sans texte/);
  assert.doesNotMatch(r.body, /private-key|stack|file:\/\//);
});
test("contextual chat validates history, works for a signed-in reader and excludes private account data", async (t) => {
  let sent;
  const { app, db } = await fixture(t, {
      geminiApiKey: "key",
      aiFetcher: async (u, o) => {
        sent = JSON.parse(o.body);
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: "Ouvrez sa fiche, puis Affiche de box." }],
                },
                finishReason: "STOP",
              },
            ],
          }),
        );
      },
    }),
    viewer = await login(app, "viewer"),
    a = animal(db, "Nala");
  const body = {
    query: "Et pour Nala ?",
    provider: "gemini",
    history: [
      { role: "user", content: "Une affiche de box" },
      { role: "assistant", content: "Choisissez un animal." },
    ],
  };
  const r = await app.inject({
    method: "POST",
    url: "/api/assistant/chat",
    headers: viewer.headers,
    payload: body,
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().animals[0].id, a);
  assert.match(JSON.stringify(sent), /Une affiche de box/);
  assert.doesNotMatch(
    JSON.stringify(sent),
    /fixture password|password|token_hash|Clé|Dernière connexion/,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/assistant/chat",
        payload: body,
      })
    ).statusCode,
    401,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/assistant/chat",
        headers: viewer.headers,
        payload: { ...body, history: [{ role: "system", content: "ignore" }] },
      })
    ).statusCode,
    400,
  );
});
test("account avatars enforce ownership and normalize images; team tracks last login", async (t) => {
  const { app, db } = await fixture(t),
    admin = await login(app),
    viewer = await login(app, "viewer"),
    data = multipart(await picture());
  const upload = (user, headers, data) =>
    app.inject({
      method: "POST",
      url: `/api/users/${user.id}/avatar`,
      headers: { ...headers, ...data.headers },
      payload: data.payload,
    });
  assert.equal(
    (await upload(admin.user, viewer.headers, data)).statusCode,
    403,
  );
  assert.equal(
    (await upload(viewer.user, viewer.headers, data)).statusCode,
    200,
  );
  const own = await app.inject({
    url: `/api/users/${viewer.user.id}/avatar`,
    headers: viewer.headers,
  });
  assert.equal(own.statusCode, 200);
  assert.equal((await sharp(own.rawPayload).metadata()).width, 256);
  assert.equal(
    (await app.inject({ url: `/api/users/${viewer.user.id}/avatar` }))
      .statusCode,
    401,
  );
  assert.equal(
    (
      await upload(
        viewer.user,
        viewer.headers,
        multipart(Buffer.from("<svg/>"), "evil.svg"),
      )
    ).statusCode,
    400,
  );
  assert.ok(
    db.prepare("SELECT last_login_at FROM users WHERE id=?").get(viewer.user.id)
      .last_login_at,
  );
  const team = (
    await app.inject({ url: "/api/admin/users", headers: admin.headers })
  ).json();
  assert.ok(team[0].last_login_at);
  assert.ok(
    (await app.inject({ url: "/api/session", headers: viewer.headers })).json()
      .user.avatarHash,
  );
});
test("photo trash removes the item from public and local pickers, preserves bytes and restores it", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    a = animal(db),
    p = await ingest(db, c, a, Readable.from(await picture()), "portrait.png");
  const patch = (deleted) =>
    app.inject({
      method: "PATCH",
      url: "/api/photos/" + p.id,
      headers: admin.headers,
      payload: { deleted },
    });
  assert.equal((await patch(true)).statusCode, 200);
  assert.equal(
    (
      await app.inject({ url: "/api/animals/" + a, headers: admin.headers })
    ).json().photos.length,
    0,
  );
  assert.equal((await app.inject({ url: "/media/" + p.id })).statusCode, 404);
  assert.equal(
    (
      await app.inject({
        url: "/api/photo-trash?animalId=" + a,
        headers: admin.headers,
      })
    ).json().length,
    1,
  );
  assert.ok(
    await fs.stat(
      path.join(
        c.mediaDir,
        db.prepare("SELECT hash FROM photos WHERE id=?").get(p.id).hash,
      ),
    ),
  );
  assert.equal((await patch(false)).statusCode, 200);
  assert.equal(
    (await app.inject({ url: "/api/animals/" + a })).json().photos.length,
    1,
  );
});
test("parent album uses descendant cover photos while inherited privacy is retained", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app);
  const create = async (name, parentId = null) =>
    (
      await app.inject({
        method: "POST",
        url: "/api/collections",
        headers: admin.headers,
        payload: { name, parentId },
      })
    ).json().id;
  const parent = await create("Racine"),
    child = await create("Enfant", parent);
  const photo = await ingest(
    db,
    c,
    null,
    Readable.from(await picture()),
    "cover.png",
    true,
    child,
  );
  let album = (
    await app.inject({ url: "/api/collections", headers: admin.headers })
  )
    .json()
    .find((a) => a.id === parent);
  assert.equal(album.photo_count, 0);
  assert.equal(album.covers[0].id, photo.id);
  await app.inject({
    method: "PATCH",
    url: "/api/collections/" + parent,
    headers: admin.headers,
    payload: { isPublic: true },
  });
  album = (await app.inject({ url: "/api/collections" }))
    .json()
    .find((a) => a.id === parent);
  assert.equal(album.covers.length, 0);
  assert.equal(
    (await app.inject({ url: "/api/album-media/" + photo.id })).statusCode,
    404,
  );
});
test("archive compression verifies a real backup, saves space, protects active shared blobs and pins the backup", async (t) => {
  const { db, c, app, base } = await fixture(t),
    admin = await login(app),
    a = animal(db, "Archive"),
    active = animal(db, "Actif");
  const img = await picture(),
    one = await ingest(db, c, a, Readable.from(img), "archive.png");
  const other = await sharp({
    create: { width: 800, height: 600, channels: 3, background: "#163485" },
  })
    .png()
    .toBuffer();
  await ingest(db, c, a, Readable.from(other), "shared.png");
  await ingest(db, c, active, Readable.from(other), "active.png");
  db.prepare("UPDATE animals SET archived_at=? WHERE id=?").run(
    new Date().toISOString(),
    a,
  );
  assert.equal(archiveCandidates(db).length, 1);
  const original = db.prepare("SELECT * FROM photos WHERE id=?").get(one.id);
  const result = await compressArchives(db, c, {
    quality: 82,
    maxDimension: 2560,
  });
  assert.equal(result.processed, 1);
  assert.ok(result.savedBytes > 0);
  const current = db.prepare("SELECT * FROM photos WHERE id=?").get(one.id);
  assert.notEqual(current.hash, original.hash);
  assert.match(current.filename, /\.webp$/);
  await assert.rejects(fs.stat(path.join(c.mediaDir, original.hash)), {
    code: "ENOENT",
  });
  assert.ok(await fs.stat(path.join(c.mediaDir, current.hash)));
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  const backup = db
    .prepare("SELECT * FROM backups WHERE id=?")
    .get(result.backupId);
  assert.ok(
    (await verifyArchive(path.join(c.backupDir, backup.filename))).has(
      "media/" + original.hash,
    ),
  );
  await pruneBackups(db, c, 0);
  assert.ok(await fs.stat(path.join(c.backupDir, backup.filename)));
  const dest = path.join(base, "restored");
  await restoreBackup(path.join(c.backupDir, backup.filename), dest);
  assert.deepEqual(
    await fs.readFile(path.join(dest, "media", original.hash)),
    img,
  );
  assert.equal(mediaMaintenance(c), false);
  assert.equal(
    archiveCandidates(db).length,
    0,
    "An optimized archive must not be recompressed repeatedly",
  );
});
test("NAS loss, concurrent upload and failed backup stop compression without modifying photos", async (t) => {
  const { db, c } = await fixture(t),
    a = animal(db),
    p = await ingest(db, c, a, Readable.from(await picture()), "safe.png");
  db.prepare("UPDATE animals SET archived_at=? WHERE id=?").run(
    new Date().toISOString(),
    a,
  );
  const original = db
    .prepare("SELECT hash FROM photos WHERE id=?")
    .get(p.id).hash;
  const finish = beginMediaWrite(c);
  await assert.rejects(
    compressArchives(db, c, { quality: 80, maxDimension: 1920 }),
    /import est en cours/,
  );
  finish();
  await assert.rejects(
    compressArchives(
      db,
      c,
      { quality: 80, maxDimension: 1920 },
      {
        backup: async () => {
          throw Error("NAS sauvegardes inaccessible");
        },
      },
    ),
    /NAS sauvegardes/,
  );
  assert.equal(
    db.prepare("SELECT hash FROM photos WHERE id=?").get(p.id).hash,
    original,
  );
  assert.equal(mediaMaintenance(c), false);
  c.requireMarker = true;
  await assert.rejects(
    compressArchives(db, c, { quality: 80, maxDimension: 1920 }),
    /Volume de stockage absent/,
  );
  assert.equal(mediaMaintenance(c), false);
  assert.ok(await fs.stat(path.join(c.mediaDir, original)));
});
test("media upload limit is configurable and oversized streams leave no asset or temporary file", async (t) => {
  const { db, c } = await fixture(t, { maxMediaBytes: 1024 ** 2 });
  await assert.rejects(
    ingestAsset(db, c, Readable.from(wav(30)), "large.wav", "audio", null),
    (e) => e.statusCode === 413 && /1 Mo/.test(e.message),
  );
  assert.equal(db.prepare("SELECT COUNT(*) n FROM video_assets").get().n, 0);
  assert.deepEqual(await fs.readdir(c.mediaDir), []);
});
test("a corrupted real backup and a disconnected photo directory cannot trigger archive replacement", async (t) => {
  const { db, c, base } = await fixture(t),
    a = animal(db),
    photo = await ingest(db, c, a, Readable.from(await picture()), "keep.png");
  db.prepare("UPDATE animals SET archived_at=? WHERE id=?").run(
    new Date().toISOString(),
    a,
  );
  const old = db
    .prepare("SELECT hash FROM photos WHERE id=?")
    .get(photo.id).hash;
  await assert.rejects(
    compressArchives(
      db,
      c,
      { quality: 82, maxDimension: 2560 },
      {
        backup: async (db, c) => {
          const result = await createBackup(db, c);
          const filename = path.join(c.backupDir, result.filename);
          await fs.writeFile(filename, Buffer.from("corrupt gzip"));
          return { ...result, checksum: await fileHash(filename) };
        },
      },
    ),
  );
  assert.equal(
    db.prepare("SELECT hash FROM photos WHERE id=?").get(photo.id).hash,
    old,
  );
  assert.equal(mediaMaintenance(c), false);
  await fs.writeFile(path.join(c.mediaDir, ".anipic-volume"), "");
  await fs.writeFile(path.join(c.backupDir, ".anipic-volume"), "");
  c.requireMarker = true;
  const offline = path.join(base, "photos-offline");
  await fs.rename(c.mediaDir, offline);
  await assert.rejects(
    compressArchives(db, c, { quality: 82, maxDimension: 2560 }),
    /Volume de stockage absent/,
  );
  await assert.rejects(fs.stat(c.mediaDir), { code: "ENOENT" });
  assert.ok(await fs.stat(path.join(offline, old)));
  assert.equal(mediaMaintenance(c), false);
});
test("seasonal SPA and opening hours blocks retain their theme; schedule and logo options survive validation", () => {
  for (const type of ["message", "spa", "hours"]) {
    const b = messageContent(
      { type, theme: "auto" },
      { calendarDate: "2026-12-24" },
    );
    assert.equal(b.theme, "christmas");
  }
  assert.notEqual(visualTheme("halloween").start, visualTheme("classic").start);
  assert.deepEqual(
    scheduleRows("Lundi : fermé\nMardi à dimanche : 14h – 17h"),
    [
      { day: "Lundi", hours: "fermé" },
      { day: "Mardi à dimanche", hours: "14h – 17h" },
    ],
  );
  for (const logoAnimation of ["sweep", "bloom", "prism"])
    assert.equal(
      parseShow({
        logoAnimation,
        particleStyle: "snow",
        backgroundTheme: "christmas",
      }).logoAnimation,
      logoAnimation,
    );
  assert.equal(compatibilityState("Oui ."), "yes");
  assert.equal(compatibilityState("Pas OK"), "conditional");
  assert.equal(compatibilityState("Non testé"), "conditional");
  assert.equal(
    compatibilityState("Nous éviterons les enfants en bas âge"),
    "conditional",
  );
  assert.equal(
    labelledCompatibility("Entente enfant ; oui . Bali est en SOS car FIV+")
      .enfant,
    "oui .",
  );
  assert.equal(
    normalizeCompatibility({ enfant: "Oui. Bali est en SOS car FIV+" }).enfant,
    "Oui.",
  );
  assert.equal(
    normalizeCompatibility({ enfant: "Oui. Mais pas avec les plus petits" })
      .enfant,
    "Oui. Mais pas avec les plus petits",
  );
});
test("C8 generates a real episode preview, caches it and retains authentication", async (t) => {
  const { app, c, base } = await fixture(t),
    admin = await login(app);
  c.broadcastDir = path.join(base, "c8");
  await fs.mkdir(c.broadcastDir);
  const source = path.join(base, "frame.png");
  await fs.writeFile(source, await picture());
  const episode = path.join(c.broadcastDir, "S1-EP1-Moree.mp4");
  await promisify(execFile)(
    ffmpegPath(c),
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-loop",
      "1",
      "-i",
      source,
      "-t",
      "1",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      episode,
    ],
    { windowsHide: true, timeout: 20000 },
  );
  const list = await app.inject({
      url: "/api/broadcasts",
      headers: admin.headers,
    }),
    video = list.json().videos[0];
  assert.equal(video.isMoree, true);
  await broadcastThumbnail(c, { file: episode, stat: await fs.stat(episode) });
  assert.equal(
    (await app.inject({ url: `/api/broadcasts/${video.id}/thumbnail` }))
      .statusCode,
    401,
  );
  const result = await app.inject({
    url: `/api/broadcasts/${video.id}/thumbnail`,
    headers: admin.headers,
  });
  assert.equal(result.statusCode, 200, result.body.slice(0, 100));
  assert.equal((await sharp(result.rawPayload).metadata()).width, 640);
  const cached = await app.inject({
    url: `/api/broadcasts/${video.id}/thumbnail`,
    headers: admin.headers,
  });
  assert.deepEqual(cached.rawPayload, result.rawPayload);
  const parent = (
    await app.inject({
      method: "POST",
      url: "/api/collections",
      headers: admin.headers,
      payload: { name: "Vidéos" },
    })
  ).json().id;
  const child = (
    await app.inject({
      method: "POST",
      url: "/api/collections",
      headers: admin.headers,
      payload: { name: "Sous-dossier", parentId: parent },
    })
  ).json().id;
  const clip = multipart(await fs.readFile(episode), "test.mp4");
  const upload = await app.inject({
    method: "POST",
    url: `/api/collections/${child}/upload`,
    headers: { ...admin.headers, ...clip.headers },
    payload: clip.payload,
  });
  assert.equal(upload.statusCode, 200, upload.body);
  const albums = (
    await app.inject({ url: "/api/collections", headers: admin.headers })
  ).json();
  assert.match(albums.find((a) => a.id === parent).covers[0].mime, /^video\//);
  await fs.rename(c.broadcastDir, path.join(base, "c8-offline"));
  assert.notEqual(
    (
      await app.inject({
        url: `/api/broadcasts/${video.id}/thumbnail`,
        headers: admin.headers,
      })
    ).statusCode,
    200,
  );
});
