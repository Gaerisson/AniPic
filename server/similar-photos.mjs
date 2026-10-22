import { z } from "zod";
import path from "node:path";
import sharp from "sharp";
import { audit, now } from "./db.mjs";
import { assertStorage } from "./config.mjs";
export function hamming(a, b) {
  let value = BigInt("0x" + a) ^ BigInt("0x" + b),
    count = 0;
  while (value) {
    count++;
    value &= value - 1n;
  }
  return count;
}
export async function fingerprint(file) {
  const pixels = await sharp(file, { limitInputPixels: 40e6 })
    .rotate()
    .flatten({ background: "#888888" })
    .resize(9, 8, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer();
  let bits = 0n;
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++)
      bits =
        (bits << 1n) | (pixels[y * 9 + x] > pixels[y * 9 + x + 1] ? 1n : 0n);
  return bits.toString(16).padStart(16, "0");
}
export async function findSimilar(db, c, threshold = 5) {
  assertStorage(c);
  const rows = db
    .prepare(
      "SELECT DISTINCT b.hash,b.size FROM blobs b WHERE EXISTS(SELECT 1 FROM photos p JOIN animals a ON a.id=p.animal_id WHERE p.hash=b.hash AND p.archived_at IS NULL AND p.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM settings s WHERE s.key='animalTrash:'||a.id)) OR EXISTS(SELECT 1 FROM inbox_photos p WHERE p.hash=b.hash AND p.archived_at IS NULL) ORDER BY b.created_at DESC LIMIT 1501",
    )
    .all();
  const limited = rows.length > 1500,
    items = rows.slice(0, 1500),
    prints = [],
    errors = [];
  for (const b of items) {
    let fp = db
      .prepare("SELECT fingerprint FROM image_fingerprints WHERE hash=?")
      .get(b.hash)?.fingerprint;
    if (!fp) {
      try {
        fp = await fingerprint(path.join(c.mediaDir, b.hash));
        db.prepare(
          "INSERT OR REPLACE INTO image_fingerprints VALUES (?,?)",
        ).run(b.hash, fp);
      } catch {
        errors.push("Un fichier n’a pas pu être analysé.");
        continue;
      }
    }
    prints.push({ ...b, fp });
  }
  const ignored = new Set(
      db
        .prepare("SELECT pair FROM duplicate_ignored")
        .all()
        .map((r) => r.pair),
    ),
    pairs = [];
  function references(hash) {
    const photos = db
      .prepare(
        "SELECT p.id,p.filename,p.animal_id,a.name FROM photos p JOIN animals a ON a.id=p.animal_id WHERE p.hash=? AND p.archived_at IS NULL AND p.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM settings s WHERE s.key='animalTrash:'||a.id) LIMIT 8",
      )
      .all(hash)
      .map((p) => ({ ...p, preview: `/media/${p.id}?w=640`, kind: "photo" }));
    const inbox = db
      .prepare(
        "SELECT id,filename,folder FROM inbox_photos WHERE hash=? AND archived_at IS NULL LIMIT 8",
      )
      .all(hash)
      .map((p) => ({
        ...p,
        preview: `/api/inbox/${p.id}/preview`,
        kind: "inbox",
      }));
    return [...photos, ...inbox];
  }
  for (let i = 0; i < prints.length; i++) {
    for (let j = i + 1; j < prints.length; j++) {
      const a = prints[i],
        b = prints[j],
        distance = hamming(a.fp, b.fp),
        key = [a.hash, b.hash].sort().join(":");
      if (distance <= threshold && !ignored.has(key))
        pairs.push({
          key,
          distance,
          a: { size: a.size, refs: references(a.hash) },
          b: { size: b.size, refs: references(b.hash) },
        });
      if (pairs.length >= 100) break;
    }
    if (pairs.length >= 100) break;
    if (i % 50 === 0) await new Promise((r) => setImmediate(r));
  }
  return {
    items: pairs.sort((a, b) => a.distance - b.distance),
    analysed: prints.length,
    limited,
    pairsLimited: pairs.length >= 100,
    errors: errors.length,
  };
}
export async function registerSimilar(app, { db, c, authorized, job }) {
  app.post(
    "/api/admin/similar-photos",
    { preHandler: authorized(["admin"]) },
    async (req) => {
      const { threshold } = z
        .object({ threshold: z.number().int().min(0).max(12).default(5) })
        .parse(req.body || {});
      return job("similar_photos", req.user, () =>
        findSimilar(db, c, threshold),
      );
    },
  );
  app.post(
    "/api/admin/similar-photos/ignore",
    { preHandler: authorized(["admin"]) },
    async (req) => {
      const { pair } = z
        .object({ pair: z.string().regex(/^[a-f0-9]{64}:[a-f0-9]{64}$/) })
        .parse(req.body);
      db.prepare("INSERT OR IGNORE INTO duplicate_ignored VALUES (?,?)").run(
        pair,
        now(),
      );
      audit(db, req.user, "similar_pair_ignored", { pair });
      return { ok: true };
    },
  );
}
