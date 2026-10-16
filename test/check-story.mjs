import { Input, FilePathSource, MP4 } from "mediabunny";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const input = new Input({
  source: new FilePathSource(
    fileURLToPath(new URL("../../anipic-story-instagram.mp4", import.meta.url)),
  ),
  formats: [MP4],
});
try {
  const video = await input.getPrimaryVideoTrack(),
    audio = await input.getPrimaryAudioTrack(),
    duration = await input.computeDuration(),
    width = await video.getDisplayWidth(),
    height = await video.getDisplayHeight();
  assert.equal(width, 1080);
  assert.equal(height, 1920);
  assert.ok(Math.abs(duration - 28) < 0.1);
  assert.ok(audio);
  console.log(JSON.stringify({ width, height, duration, audio: !!audio }));
} finally {
  input.dispose();
}
