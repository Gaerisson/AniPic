import path from "node:path";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import {
  selectComposition,
  renderMedia,
  renderStill,
} from "@remotion/renderer";
const root = path.resolve(import.meta.dirname, "..");
const browserExecutable =
  process.env.VIDEO_BROWSER_PATH ||
  (existsSync(path.join(root, "browser-path.txt"))
    ? readFileSync(path.join(root, "browser-path.txt"), "utf8").trim()
    : null);
if (!browserExecutable)
  throw new Error("Préparez le navigateur avec npm run video:browser.");
const outputLocation = path.resolve(
  process.argv[2] || path.join(root, "anipic-presentation-story.mp4"),
);
mkdirSync(path.dirname(outputLocation), { recursive: true });
const serveUrl = path.join(root, "video-bundle");
const composition = await selectComposition({
  serveUrl,
  id: "ToolTrailer",
  browserExecutable,
  logLevel: "warn",
});
const common = { serveUrl, composition, browserExecutable, logLevel: "warn" };
const stem = path.parse(outputLocation).name;
for (const [label, frame] of [
  ["before", 20],
  ["cover", 60],
  ["3d", 105],
  ["pages", 171],
  ["final", 218],
]) {
  await renderStill({
    ...common,
    frame,
    output: path.join(path.dirname(outputLocation), `${stem}-${label}.png`),
    imageFormat: "png",
  });
}
let previous = -1;
await renderMedia({
  ...common,
  outputLocation,
  codec: "h264",
  concurrency: 1,
  disallowParallelEncoding: true,
  offthreadVideoCacheSizeInBytes: 64 * 1024 ** 2,
  mediaCacheSizeInBytes: 64 * 1024 ** 2,
  videoBitrate: "6M",
  audioBitrate: "128k",
  pixelFormat: "yuv420p",
  onProgress: ({ progress }) => {
    const n = Math.floor(progress * 10) * 10;
    if (n > previous) {
      previous = n;
      console.log("Trailer : " + n + " %");
    }
  },
});
console.log("Trailer prêt : " + outputLocation);
