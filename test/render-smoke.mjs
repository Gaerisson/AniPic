// Optional full renderer integration test. No external AI/source request.
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { fixture, login, animal, wav } from "./helpers.mjs";
import { ingest } from "../server/storage.mjs";
import { ingestAsset, renderFilm, mediaMetadata } from "../server/video.mjs";
import { Input, FilePathSource, MP4 } from "mediabunny";
const clean = [];
const { app, db, c } = await fixture({
  after(fn) {
    clean.push(fn);
  },
});
try {
  const { user } = await login(app),
    a = animal(db, "Nala · Démonstration");
  db.prepare("UPDATE animals SET sex=?,breed=?,compatibility=? WHERE id=?").run(
    "female",
    "Croisée",
    '{"chats":"ok","chiens":"non"}',
    a,
  );
  const p1 = await ingest(
    db,
    c,
    a,
    createReadStream(new URL("../demo/images/nala.jpg", import.meta.url)),
    "nala.jpg",
  );
  const p2 = await ingest(
    db,
    c,
    a,
    createReadStream(new URL("../demo/images/rio.jpg", import.meta.url)),
    "rio.jpg",
  );
  const music = await ingestAsset(
    db,
    c,
    Readable.from(wav(3)),
    "test-tone.wav",
    "audio",
    user.id,
  );
  const clips = [p1, p2].map((p) => ({
    kind: "photo",
    ref: p.id,
    seconds: 3,
    fit: "contain",
    caption: "Photos d’illustration · profil fictif.",
  }));
  const film = {
    title: "Chaque regard compte.",
    subtitle: "Démonstration Anipic",
    outro: "Une nouvelle histoire.",
    look: "editorial",
    motion: "lively",
    transition: "fade",
    clips,
    music: { assetId: music.id, volume: 0.12 },
  };
  let mark = -1;
  const progress = ({ progress }) => {
    const n = Math.floor(progress * 10) * 10;
    if (n > mark) {
      mark = n;
      console.log("Rendu " + n + " %");
    }
  };
  const one = await renderFilm(db, c, film, { onProgress: progress });
  const out =
    process.env.SMOKE_OUTPUT_DIR ||
    path.join(import.meta.dirname, "..", "smoke-output");
  await fs.mkdir(out, { recursive: true });
  const first = path.join(out, "anipic-video-demo.mp4");
  await fs.copyFile(path.join(c.mediaDir, one.hash), first);
  const meta = await mediaMetadata(first, "video");
  assert.equal(meta.width, 1280);
  assert.equal(meta.height, 720);
  assert.ok(Math.abs(meta.duration - one.duration) < 0.1);
  const input = new Input({
    source: new FilePathSource(first),
    formats: [MP4],
  });
  try {
    assert.ok(await input.getPrimaryAudioTrack(), "audio track missing");
  } finally {
    input.dispose();
  }
  const asset = await ingestAsset(
    db,
    c,
    createReadStream(first),
    "demo.mp4",
    "video",
    user.id,
  );
  mark = -1;
  const two = await renderFilm(
    db,
    c,
    {
      ...film,
      title: "Les histoires de 2026",
      template: "year",
      year: 2026,
      aspect: "portrait",
      look: "cinema",
      motion: "gentle",
      transition: "wipe",
      clips: [
        {
          kind: "video",
          ref: asset.id,
          seconds: 3,
          trim: 2,
          fit: "contain",
          muted: true,
          title: "Au refuge",
        },
        clips[0],
      ],
    },
    { onProgress: progress },
  );
  const second = path.join(out, "anipic-video-annuelle-demo.mp4");
  await fs.copyFile(path.join(c.mediaDir, two.hash), second);
  const m2 = await mediaMetadata(second, "video");
  assert.equal(m2.width, 720);
  assert.equal(m2.height, 1280);
  assert.ok(Math.abs(m2.duration - two.duration) < 0.1);
  console.log(
    JSON.stringify(
      { photoMusic: one, videoPhotoMusic: two, files: [first, second] },
      null,
      2,
    ),
  );
} finally {
  for (const fn of clean.reverse()) await fn();
}
