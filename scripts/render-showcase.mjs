import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  selectComposition,
  renderStill,
  renderMedia,
} from "@remotion/renderer";
import { ffmpegPath } from "../server/transcription.mjs";
const root = path.resolve(import.meta.dirname, ".."),
  args = process.argv.slice(2),
  option = (key, fallback) => {
    const i = args.indexOf(key);
    return i < 0 ? fallback : args[i + 1];
  };
const period = Number(option("--period", "0.6122")),
  sourceStart = Number(option("--start", "10.2922")),
  music = option("--music", ""),
  output = path.resolve(option("--output", path.join(root, "docs/media")));
if (
  !Number.isFinite(period) ||
  period < 0.35 ||
  period > 0.9 ||
  !Number.isFinite(sourceStart) ||
  sourceStart < 0
)
  throw Error("Grille musicale invalide.");
await fs.mkdir(output, { recursive: true });
const browserExecutable = (
    await fs.readFile(path.join(root, "browser-path.txt"), "utf8")
  ).trim(),
  serveUrl = path.join(root, "video-bundle");
let soundtrack;
if (music) {
  const temporary = path.join(
    os.tmpdir(),
    `anipic-showcase-${crypto.randomUUID()}.m4a`,
  );
  try {
    await promisify(execFile)(
      ffmpegPath({}),
      [
        "-v",
        "error",
        "-nostdin",
        "-ss",
        String(sourceStart),
        "-i",
        path.resolve(music),
        "-t",
        String(40 * period),
        "-vn",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-f",
        "mp4",
        temporary,
      ],
      { windowsHide: true, timeout: 60000, maxBuffer: 65536 },
    );
    soundtrack =
      "data:audio/mp4;base64," +
      (await fs.readFile(temporary)).toString("base64");
  } finally {
    await fs.unlink(temporary).catch(() => {});
  }
}
for (const portrait of [true, false]) {
  const label = portrait ? "story" : "paysage",
    inputProps = { period, portrait, soundtrack };
  const composition = await selectComposition({
    serveUrl,
    id: "ToolShowcase",
    inputProps,
    browserExecutable,
    logLevel: "warn",
  });
  const common = {
    serveUrl,
    composition,
    inputProps,
    browserExecutable,
    logLevel: "warn",
  };
  for (const [name, beat] of [
    ["ouverture", 2],
    ["home", 7],
    ["retouche", 13],
    ["affiches", 19],
    ["studio", 25],
    ["tv", 31],
    ["final", 38],
  ]) {
    await renderStill({
      ...common,
      frame: Math.round(beat * period * 30),
      output: path.join(output, `anipic-${label}-${name}.png`),
    });
  }
  if (!args.includes("--stills-only")) {
    let previous = -1;
    await renderMedia({
      ...common,
      outputLocation: path.join(output, `anipic-presentation-${label}.mp4`),
      codec: "h264",
      pixelFormat: "yuv420p",
      videoBitrate: "6M",
      audioBitrate: "192k",
      concurrency: 2,
      disallowParallelEncoding: true,
      onProgress: ({ progress }) => {
        const p = Math.floor(progress * 10);
        if (p !== previous) {
          previous = p;
          console.log(`${label} ${p * 10}%`);
        }
      },
    });
  }
  console.log(
    `${label} : ${composition.width} × ${composition.height}, ${(composition.durationInFrames / 30).toFixed(2)} s`,
  );
}
