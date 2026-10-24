import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";
import { boundedFetch } from "./source.mjs";
import { publicSpaImage } from "./animal-facts.mjs";
import { settings } from "./db.mjs";
import { sweepCache } from "./storage.mjs";
// One bounded master per source URL feeds every preview size and movie export.
const masters = new Map(),
  variants = new Map();
let activeMasters = 0;
const masterQueue = [];
async function boundedMaster(fn) {
  if (activeMasters >= 3) {
    if (masterQueue.length >= 128)
      throw Object.assign(
        Error("Photos SPA en cours de préparation. Réessayez."),
        { statusCode: 503 },
      );
    await new Promise((resolve) => masterQueue.push(resolve));
  }
  activeMasters++;
  try {
    return await fn();
  } finally {
    activeMasters--;
    masterQueue.shift()?.();
  }
}
async function cached(file) {
  try {
    const stat = await fs.stat(file);
    if (Date.now() - stat.mtimeMs < 6 * 3600_000)
      return await fs.readFile(file);
  } catch {}
  return null;
}
async function store(file, data) {
  const tmp = file + "." + randomUUID() + ".tmp";
  try {
    await fs.writeFile(tmp, data);
    await fs.rename(tmp, file);
  } finally {
    await fs.unlink(tmp).catch(() => {});
  }
}
export async function sourcePhotoBuffer(db, c, animalId, width = 1280) {
  width = z.number().int().min(160).max(1280).parse(width);
  const animal = db
    .prepare("SELECT source_metadata FROM animals WHERE id=?")
    .get(z.string().uuid().parse(animalId));
  const url = publicSpaImage(
    JSON.parse(animal?.source_metadata || "{}").thumbnail,
  );
  if (!url)
    throw Object.assign(Error("Photo de référence SPA indisponible."), {
      statusCode: 404,
    });
  const stem = createHash("sha256")
    .update("spa:" + url)
    .digest("hex");
  const file = path.join(c.cacheDir, `${stem}-${width}-78.webp`),
    masterFile = path.join(c.cacheDir, `${stem}-1280-78.webp`);
  const hit = await cached(file);
  if (hit) return hit;
  if (variants.has(file)) return variants.get(file);
  const job = (async () => {
    if (!masters.has(masterFile)) {
      const masterJob = boundedMaster(async () => {
        const existing = await cached(masterFile);
        if (existing) return existing;
        const raw = await (c.spaPhotoFetcher || boundedFetch)(
          url,
          5 * 1024 ** 2,
          { timeoutMs: 12000, binary: true },
        );
        const data = await sharp(raw, { limitInputPixels: 40_000_000 })
          .rotate()
          .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 78 })
          .toBuffer();
        await store(masterFile, data);
        return data;
      }).finally(() => masters.delete(masterFile));
      masters.set(masterFile, masterJob);
    }
    const master = await masters.get(masterFile);
    const data =
      width === 1280
        ? master
        : await sharp(master, { limitInputPixels: 40_000_000 })
            .resize(width, width, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: 78 })
            .toBuffer();
    if (width !== 1280) await store(file, data);
    await sweepCache(c, settings(db).cacheMB * 1024 ** 2);
    return data;
  })().finally(() => variants.delete(file));
  variants.set(file, job);
  return job;
}
export async function registerSourcePhoto(app, { db, c }) {
  const pending = new Map(),
    queue = [];
  let active = 0;
  app.get(
    "/api/animals/:id/source-photo",
    { config: { rateLimit: { max: 300, timeWindow: "1 minute" } } },
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
      const existing = await cached(target);
      if (existing)
        return reply
          .header("Cache-Control", "private, max-age=1800")
          .type("image/webp")
          .send(existing);
      if (!pending.has(key)) {
        if (queue.length >= 128)
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
        // Resolve before choosing the image type: an upstream failure must still
        // be a JSON response, not an object sent with Content-Type image/webp.
        const data = await pending.get(key);
        return reply
          .header("Cache-Control", "private, max-age=1800")
          .type("image/webp")
          .send(data);
      } catch {
        return reply
          .header("Cache-Control", "no-store")
          .header("Retry-After", "2")
          .code(503)
          .send({ error: "Photo SPA temporairement indisponible." });
      }
    },
  );
}
