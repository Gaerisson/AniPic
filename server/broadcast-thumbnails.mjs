import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ffmpegPath } from "./transcription.mjs";
const exec = promisify(execFile),
  pending = new Map();
let running = 0;
const queue = [];
export async function broadcastThumbnail(c, { file, stat }) {
  const signature = createHash("sha256")
      .update(`${file}:${stat.size}:${stat.mtimeMs}`)
      .digest("hex"),
    out = path.join(c.cacheDir, `c8-${signature}.jpg`);
  try {
    return await fs.readFile(out);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  if (pending.has(signature)) return pending.get(signature);
  if (pending.size >= 40)
    throw Object.assign(
      new Error(
        "Préparation des aperçus C8 en cours. Réessayez dans un instant.",
      ),
      { statusCode: 503 },
    );
  const work = (async () => {
    if (running >= 2) await new Promise((r) => queue.push(r));
    running++;
    try {
      let stdout;
      for (const seconds of [8, 0]) {
        ({ stdout } = await exec(
          ffmpegPath(c),
          [
            "-hide_banner",
            "-loglevel",
            "error",
            "-nostdin",
            "-ss",
            String(seconds),
            "-i",
            file,
            "-frames:v",
            "1",
            "-vf",
            "scale=640:-2,format=yuvj420p",
            "-f",
            "image2pipe",
            "-c:v",
            "mjpeg",
            "pipe:1",
          ],
          {
            encoding: "buffer",
            maxBuffer: 3 * 1024 ** 2,
            timeout: 25000,
            windowsHide: true,
          },
        ));
        if (stdout.length) break;
      }
      if (!stdout.length) throw Error("Vidéo trop courte ou illisible.");
      await fs
        .writeFile(out, stdout, { flag: "wx", mode: 0o600 })
        .catch((e) => {
          if (e.code !== "EEXIST") throw e;
        });
      const cached = (
        await fs.readdir(c.cacheDir, { withFileTypes: true })
      ).filter((e) => e.isFile() && /^c8-[a-f0-9]{64}\.jpg$/.test(e.name));
      if (cached.length > 500) {
        const rows = await Promise.all(
          cached.map(async (e) => ({
            file: path.join(c.cacheDir, e.name),
            at: (await fs.stat(path.join(c.cacheDir, e.name))).mtimeMs,
          })),
        );
        for (const row of rows.sort((a, b) => b.at - a.at).slice(500))
          await fs.unlink(row.file).catch(() => {});
      }
      return stdout;
    } finally {
      running--;
      queue.shift()?.();
    }
  })();
  pending.set(signature, work);
  try {
    return await work;
  } finally {
    pending.delete(signature);
  }
}
