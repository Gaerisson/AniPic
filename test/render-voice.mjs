// Optional real Remotion render; synthetic audio only, no paid TTS request.
import assert from "node:assert/strict";
import { createReadStream, promises as fs } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { fixture, login, animal, wav } from "./helpers.mjs";
import { ingest } from "../server/storage.mjs";
import { ingestAsset, renderFilm, mediaMetadata } from "../server/video.mjs";
import { Input, FilePathSource, MP4 } from "mediabunny";
const clean = [];
const { app, db, c } = await fixture({ after: (fn) => clean.push(fn) });
try {
  const { user } = await login(app);
  const a = animal(db, "Nala · Test audio");
  const photo = await ingest(
    db,
    c,
    a,
    createReadStream(new URL("../demo/images/nala.jpg", import.meta.url)),
    "nala.jpg",
  );
  const music = await ingestAsset(
    db,
    c,
    Readable.from(wav(3)),
    "musique-test.wav",
    "audio",
    user.id,
  );
  const narration = await ingestAsset(
    db,
    c,
    Readable.from(wav(1)),
    "signal-test.wav",
    "audio",
    user.id,
  );
  const result = await renderFilm(db, c, {
    title: "Test de mixage",
    look: "minimal",
    introSeconds: 0,
    outroSeconds: 1,
    showLogo: false,
    showFacts: false,
    clips: [{ kind: "photo", ref: photo.id, seconds: 3, fit: "contain" }],
    music: { assetId: music.id, volume: 0.12 },
    voiceover: { assetId: narration.id, volume: 0.7, start: 1 },
  });
  const file = path.join(c.mediaDir, result.hash);
  const metadata = await mediaMetadata(file, "video");
  assert.equal(metadata.width, 1280);
  assert.equal(metadata.height, 720);
  assert.ok(Math.abs(metadata.duration - 4) < 0.1);
  const input = new Input({ source: new FilePathSource(file), formats: [MP4] });
  try {
    assert.ok(await input.getPrimaryAudioTrack(), "Missing audio mix");
  } finally {
    input.dispose();
  }
  const out = path.join(import.meta.dirname, "..", "smoke-output");
  await fs.mkdir(out, { recursive: true });
  await fs.copyFile(file, path.join(out, "voice-mix.mp4"));
  console.log(
    JSON.stringify({
      ...metadata,
      bytes: (await fs.stat(file)).size,
      audio: "synthetic test signals",
    }),
  );
} finally {
  for (const fn of clean.reverse()) await fn();
}
