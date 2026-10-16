import path from "node:path";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import {
  selectComposition,
  renderMedia,
  renderStill,
} from "@remotion/renderer";
const root = path.resolve(import.meta.dirname, "..");
const serveUrl = path.join(root, "video-bundle");
const browserExecutable =
  process.env.VIDEO_BROWSER_PATH ||
  (existsSync(path.join(root, "browser-path.txt"))
    ? readFileSync(path.join(root, "browser-path.txt"), "utf8").trim()
    : null);
if (!browserExecutable)
  throw new Error("Préparez le navigateur avec npm run video:browser.");
const outputLocation = path.resolve(
  process.argv[2] || path.join(root, "story-presentation.mp4"),
);
mkdirSync(path.dirname(outputLocation), { recursive: true });
const composition = await selectComposition({
  serveUrl,
  id: "ToolStory",
  browserExecutable,
  logLevel: "warn",
});
const common = { composition, serveUrl, browserExecutable, logLevel: "warn" };
await renderStill({
  ...common,
  frame: 36,
  output: path.join(path.dirname(outputLocation), "anipic-story-cover.png"),
  imageFormat: "png",
});
await renderStill({
  ...common,
  frame: 5 * 96 + 42,
  output: path.join(
    path.dirname(outputLocation),
    "anipic-story-publication.png",
  ),
  imageFormat: "png",
});
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
      console.log("Story : " + n + " %");
    }
  },
});
console.log("Story Instagram prête : " + outputLocation);
