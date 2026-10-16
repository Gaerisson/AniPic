import { createHash } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";
import { now } from "./db.mjs";
import { sourcePhotoBuffer } from "./source-photo.mjs";
const fingerprints = new Map();
let active = 0;
const waiting = [];
export async function photoFingerprint(input, ratio) {
  let image = sharp(input, { limitInputPixels: 40e6 }).rotate();
  if (ratio) {
    const m = await image.metadata();
    const width = m.autoOrient?.width || m.width,
      height = m.autoOrient?.height || m.height;
    const sw = Math.min(width, Math.round(height * ratio)),
      sh = Math.min(height, Math.round(width / ratio));
    image = image.extract({
      left: Math.max(0, Math.floor((width - sw) / 2)),
      top: Math.max(0, Math.floor((height - sh) / 2)),
      width: sw,
      height: sh,
    });
  }
  const pixels = await image
    .resize(9, 9, { fit: "fill" })
    .flatten({ background: "#fff" })
    .greyscale()
    .raw()
    .toBuffer();
  let bits = "";
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      bits += pixels[y * 9 + x] > pixels[y * 9 + x + 1] ? "1" : "0";
      bits += pixels[y * 9 + x] > pixels[(y + 1) * 9 + x] ? "1" : "0";
    }
  const mean = pixels.reduce((a, b) => a + b, 0) / pixels.length,
    variance = pixels.reduce((a, b) => a + (b - mean) ** 2, 0) / pixels.length;
  return { bits, mean, variance };
}
export const fingerprintDistance = (a, b) =>
  [...a.bits].reduce((n, v, i) => n + (v !== b.bits[i]), 0);
function context(db, animal) {
  const photos = db
    .prepare(
      "SELECT id,hash FROM photos WHERE animal_id=? AND archived_at IS NULL ORDER BY created_at DESC,id LIMIT 100",
    )
    .all(animal.id);
  const thumbnail = JSON.parse(animal.source_metadata || "{}").thumbnail || "";
  return {
    photos,
    signature: createHash("sha256")
      .update(thumbnail + photos.map((p) => p.hash).join(":"))
      .digest("hex"),
  };
}
export function cachedSourceMatch(db, animal) {
  const v = db
    .prepare("SELECT * FROM source_photo_matches WHERE animal_id=?")
    .get(animal.id);
  if (!v || v.signature !== context(db, animal).signature) return null;
  return {
    ...JSON.parse(v.result),
    checkedAt: v.checked_at,
    stale: Date.now() - Date.parse(v.checked_at) > 86400000,
  };
}
export async function compareSourcePhoto(db, c, animal) {
  const cached = cachedSourceMatch(db, animal);
  if (cached && !cached.stale) return cached;
  if (waiting.length >= 40)
    throw Object.assign(
      new Error("Comparaisons en cours. Réessayez dans un instant."),
      { statusCode: 429 },
    );
  if (active >= 2) await new Promise((r) => waiting.push(r));
  active++;
  try {
    const { photos, signature } = context(db, animal);
    let result = { status: "unavailable", checkedPhotos: photos.length };
    if (photos.length) {
      const source = await sourcePhotoBuffer(db, c, animal.id, 640),
        meta = await sharp(source).metadata(),
        ratio = meta.width / meta.height,
        reference = await photoFingerprint(source);
      let best = 129,
        usable = 0;
      for (const photo of photos) {
        const key = photo.hash + ":" + ratio.toFixed(3);
        let variants = fingerprints.get(key);
        if (!variants) {
          const file = path.join(c.mediaDir, photo.hash);
          variants = [
            await photoFingerprint(file),
            await photoFingerprint(file, ratio),
          ];
          if (fingerprints.size > 2000) fingerprints.clear();
          fingerprints.set(key, variants);
        }
        for (const sample of variants) {
          if (sample.variance < 12 || reference.variance < 12) continue;
          usable++;
          const d = fingerprintDistance(reference, sample);
          if (Math.abs(reference.mean - sample.mean) < 45)
            best = Math.min(best, d);
        }
      }
      result = {
        status: !usable
          ? "unavailable"
          : best <= 12
            ? "probable_match"
            : best <= 24
              ? "review"
              : "not_detected",
        checkedPhotos: photos.length,
        distance: best,
      };
    }
    db.prepare(
      "INSERT INTO source_photo_matches VALUES(?,?,?,?) ON CONFLICT(animal_id) DO UPDATE SET signature=excluded.signature,result=excluded.result,checked_at=excluded.checked_at",
    ).run(animal.id, signature, JSON.stringify(result), now());
    return { ...result, checkedAt: now() };
  } catch {
    return { status: "unavailable", checkedAt: now() };
  } finally {
    active--;
    waiting.shift()?.();
  }
}
export async function registerSourceMatches(app, { db, c, authorized }) {
  app.post(
    "/api/animals/:id/source-match",
    {
      preHandler: authorized(["admin", "editor", "agent", "viewer"]),
      config: { rateLimit: { max: 40, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const animal = db
        .prepare("SELECT id,source_metadata FROM animals WHERE id=?")
        .get(z.string().uuid().parse(req.params.id));
      if (!animal)
        return reply.code(404).send({ error: "Animal introuvable." });
      return compareSourcePhoto(db, c, animal);
    },
  );
}
