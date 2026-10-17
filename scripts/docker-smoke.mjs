import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import sharp from "sharp";
import { createApp } from "../server/app.mjs";
import { ingest } from "../server/storage.mjs";
import { renderFilm, mediaMetadata } from "../server/video.mjs";
import { createUser } from "../server/auth.mjs";
const base = await fs.mkdtemp(path.join(os.tmpdir(), "anipic-docker-smoke-"));
const app = await createApp({
  dbDir: path.join(base, "db"),
  mediaDir: path.join(base, "media"),
  cacheDir: path.join(base, "cache"),
  backupDir: path.join(base, "backups"),
  requireMarker: false,
  demo: false,
  scheduler: false,
});
try {
  assert.equal((await app.inject({ url: "/api/health" })).statusCode, 200);
  assert.equal(app.db.prepare("SELECT COUNT(*) n FROM animals").get().n, 0);
  const aid = crypto.randomUUID(),
    date = new Date().toISOString();
  app.db
    .prepare(
      "INSERT INTO animals(id,name,species,created_at,updated_at) VALUES (?,'Contrôle CI','dog',?,?)",
    )
    .run(aid, date, date);
  const jpeg = await sharp({
    create: { width: 640, height: 480, channels: 3, background: "#dc7130" },
  })
    .jpeg()
    .toBuffer();
  const photo = await ingest(
    app.db,
    app.anipicConfig,
    aid,
    Readable.from(jpeg),
    "ci.jpg",
  );
  const result = await renderFilm(app.db, app.anipicConfig, {
    title: "CI",
    aspect: "landscape",
    resolution: "720",
    template: "presentation",
    look: "minimal",
    clips: [{ kind: "photo", ref: photo.id, seconds: 2 }],
    introSeconds: 0,
    outroSeconds: 0,
    showQr: false,
  });
  const metadata = await mediaMetadata(
    path.join(app.anipicConfig.mediaDir, result.hash),
    "video",
  );
  assert.ok(metadata.duration > 0);
  await createUser(app.db, "ci", "temporary CI password 12345", "admin");
  const login = await app.inject({
    method: "POST",
    url: "/api/login",
    payload: { name: "ci", password: "temporary CI password 12345" },
  });
  const headers = {
    cookie: login.headers["set-cookie"].split(";")[0],
    "x-csrf-token": login.json().user.csrf,
    origin: app.anipicConfig.origin,
  };
  const album = (
    await app.inject({
      method: "POST",
      url: "/api/collections",
      headers,
      payload: { name: "Contrôle vidéo privé" },
    })
  ).json().id;
  const video = await fs.readFile(
      path.join(app.anipicConfig.mediaDir, result.hash),
    ),
    boundary = "anipic-ci-video";
  const upload = await app.inject({
    method: "POST",
    url: `/api/collections/${album}/upload`,
    headers: {
      ...headers,
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="ci.mp4"\r\nContent-Type: video/mp4\r\n\r\n`,
      ),
      video,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
  assert.equal(upload.statusCode, 200, upload.body);
  const pid = upload.json().photos[0].id;
  assert.equal(
    (await app.inject({ url: `/api/album-media/${pid}` })).statusCode,
    404,
  );
  const streamed = await app.inject({
    url: `/api/album-media/${pid}`,
    headers: { ...headers, range: "bytes=0-31" },
  });
  assert.equal(streamed.statusCode, 206);
  assert.equal(streamed.rawPayload.length, 32);
  const remove = () =>
    app.inject({
      method: "PATCH",
      url: `/api/collections/${album}/items/${pid}`,
      headers,
      payload: { deleted: true },
    });
  assert.equal((await remove()).statusCode, 200);
  assert.equal(
    (await app.inject({ url: `/api/collections/${album}`, headers })).json()
      .photos.length,
    0,
  );
  assert.equal(
    (
      await app.inject({
        method: "PATCH",
        url: `/api/collections/${album}/items/${pid}`,
        headers,
        payload: { deleted: false },
      })
    ).statusCode,
    200,
  );
  console.log(
    "Image de production : HTTP, SQLite, Sharp et rendu Remotion réels réussis.",
    metadata,
  );
} finally {
  await app.close();
  await fs.rm(base, { recursive: true, force: true });
}
