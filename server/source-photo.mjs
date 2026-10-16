import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";
import { boundedFetch } from "./source.mjs";
import { publicSpaImage } from "./animal-facts.mjs";
import { settings } from "./db.mjs";
import { sweepCache } from "./storage.mjs";
// Motion exports read the same bounded, regenerated reference cache as the web gallery.
export async function sourcePhotoBuffer(db, c, animalId, width = 1280) {
  const animal = db
    .prepare("SELECT source_metadata FROM animals WHERE id=?")
    .get(z.string().uuid().parse(animalId));
  const url = publicSpaImage(
    JSON.parse(animal?.source_metadata || "{}").thumbnail,
  );
  if (!url) throw new Error("Photo de référence SPA indisponible.");
  const key = `${createHash("sha256")
      .update("spa:" + url)
      .digest("hex")}-${width}-78.webp`,
    target = path.join(c.cacheDir, key);
  const existing = await fs.stat(target).catch(() => null);
  if (existing && Date.now() - existing.mtimeMs < 6 * 3600_000)
    return fs.readFile(target);
  let raw;
  for (const alternative of [1280, 640]) {
    if (alternative < width) continue;
    const other = path.join(
      c.cacheDir,
      key.replace(`-${width}-78.webp`, `-${alternative}-78.webp`),
    );
    const stat = await fs.stat(other).catch(() => null);
    if (stat && Date.now() - stat.mtimeMs < 6 * 3600_000) {
      raw = await fs.readFile(other);
      break;
    }
  }
  raw ||= await (c.spaPhotoFetcher || boundedFetch)(url, 5 * 1024 ** 2, {
    timeoutMs: 8000,
    binary: true,
  });
  const data = await sharp(raw, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize(width, width, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
  const tmp = path.join(c.cacheDir, ".spa-" + randomUUID());
  try {
    await fs.writeFile(tmp, data);
    await fs.rename(tmp, target);
  } finally {
    await fs.unlink(tmp).catch(() => {});
  }
  await sweepCache(c, settings(db).cacheMB * 1024 ** 2);
  return data;
}
export async function registerSourcePhoto(app, { db, c }) {
  const pending = new Map(),
    queue = [];
  let active = 0;
  app.get(
    "/api/animals/:id/source-photo",
    { config: { rateLimit: { max: 90, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const animal = db
        .prepare("SELECT source_metadata FROM animals WHERE id=?")
        .get(z.string().uuid().parse(req.params.id));
      const url = publicSpaImage(
        JSON.parse(animal?.source_metadata || "{}").thumbnail,
      );
      if (!url)
        return reply.code(404).send({ error: "Photo SPA indisponible." });
      const width = z.coerce
          .number()
          .int()
          .min(160)
          .max(1280)
          .default(640)
          .parse(req.query.w),
        key = `${createHash("sha256")
          .update("spa:" + url)
          .digest("hex")}-${width}-78.webp`,
        target = path.join(c.cacheDir, key);
      reply.header("Cache-Control", "private, max-age=1800");
      const existing = await fs.stat(target).catch(() => null);
      if (existing && Date.now() - existing.mtimeMs < 6 * 3600_000)
        return reply.type("image/webp").send(await fs.readFile(target));
      if (!pending.has(key)) {
        if (queue.length >= 36)
          return reply
            .code(429)
            .send({ error: "Aperçus SPA en cours de chargement." });
        pending.set(
          key,
          (async () => {
            if (active >= 3)
              await new Promise((resolve) => queue.push(resolve));
            active++;
            try {
              return await sourcePhotoBuffer(db, c, req.params.id, width);
            } finally {
              active--;
              queue.shift()?.();
            }
          })().finally(() => {
            pending.delete(key);
          }),
        );
      }
      try {
        return reply.type("image/webp").send(await pending.get(key));
      } catch {
        return reply
          .code(404)
          .send({ error: "Photo SPA temporairement indisponible." });
      }
    },
  );
}
