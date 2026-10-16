import { Input, FilePathSource, MP4 } from "mediabunny";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { stat } from "node:fs/promises";
const file =
  process.argv[2] ||
  fileURLToPath(
    new URL("../../anipic-presentation-story.mp4", import.meta.url),
  );
const expectedDuration = Number(process.argv[3] || 10);
const input = new Input({ source: new FilePathSource(file), formats: [MP4] });
try {
  const video = await input.getPrimaryVideoTrack(),
    audio = await input.getPrimaryAudioTrack();
  const duration = await input.computeDuration(),
    width = await video.getDisplayWidth(),
    height = await video.getDisplayHeight();
  assert.equal(width, 1080);
  assert.equal(height, 1920);
  assert.ok(Math.abs(duration - expectedDuration) < 0.1);
  assert.ok(audio);
  console.log(
    JSON.stringify({
      width,
      height,
      duration,
      audio: !!audio,
      bytes: (await stat(file)).size,
    }),
  );
} finally {
  input.dispose();
}
