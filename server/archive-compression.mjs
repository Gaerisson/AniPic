import sharp from "sharp";
import { promises as fs, createReadStream, unlinkSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import * as tar from "tar";
import { z } from "zod";
import { id, now, transaction } from "./db.mjs";
import { createBackup, fileHash } from "./backup.mjs";
import { assertStorage } from "./config.mjs";
import { beginMaintenance } from "./media-maintenance.mjs";
const input = z.object({
  quality: z.number().int().min(65).max(95).default(82),
  maxDimension: z
    .union([z.literal(1920), z.literal(2560), z.literal(3840)])
    .default(2560),
});
export function archiveCandidates(db) {
  return db
    .prepare(
      `SELECT b.* FROM blobs b WHERE b.mime IN ('image/jpeg','image/png','image/webp','image/avif') AND EXISTS(SELECT 1 FROM photos p JOIN animals a ON a.id=p.animal_id WHERE p.hash=b.hash AND (p.archived_at IS NOT NULL OR a.archived_at IS NOT NULL)) AND NOT EXISTS(SELECT 1 FROM photos p JOIN animals a ON a.id=p.animal_id WHERE p.hash=b.hash AND p.archived_at IS NULL AND a.archived_at IS NULL) AND NOT EXISTS(SELECT 1 FROM archive_compactions c,json_each(c.detail,'$.files') f WHERE json_extract(f.value,'$.optimized')=b.hash) AND NOT EXISTS(SELECT 1 FROM album_photos p WHERE p.hash=b.hash) AND NOT EXISTS(SELECT 1 FROM inbox_photos p WHERE p.hash=b.hash) AND NOT EXISTS(SELECT 1 FROM video_assets p WHERE p.hash=b.hash) AND NOT EXISTS(SELECT 1 FROM video_renders p WHERE p.hash=b.hash) AND NOT EXISTS(SELECT 1 FROM motion_exports p WHERE p.hash=b.hash) ORDER BY b.size DESC`,
    )
    .all();
}
async function optimized(c, blob, options) {
  return sharp(path.join(c.mediaDir, blob.hash), {
    limitInputPixels: 40_000_000,
  })
    .rotate()
    .resize(options.maxDimension, options.maxDimension, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: options.quality, effort: 5 })
    .toBuffer({ resolveWithObject: true });
}
export async function verifyArchive(filename) {
  const entries = new Map();
  let manifest = null;
  await new Promise((resolve, reject) => {
    const parser = new tar.Parser({ strict: true }),
      source = createReadStream(filename);
    let bad = false;
    const fail = (e) => {
      if (bad) return;
      bad = true;
      source.destroy();
      parser.abort(e);
      reject(e);
    };
    parser.on("entry", (entry) => {
      if (!["File", "OldFile"].includes(entry.type)) {
        entry.resume();
        return;
      }
      const name = entry.path;
      if (
        entries.has(name) ||
        (!["manifest.json", "anipic.sqlite"].includes(name) &&
          !/^media\/[a-f0-9]{64}$/.test(name))
      )
        return fail(Error("Entrée de sauvegarde invalide."));
      const hash = createHash("sha256"),
        chunks = [];
      let size = 0;
      entry.on("data", (data) => {
        size += data.length;
        hash.update(data);
        if (name === "manifest.json") {
          if (size > 30 * 1024 ** 2)
            return fail(Error("Manifest trop volumineux."));
          chunks.push(data);
        }
      });
      entry.on("end", () => {
        entries.set(name, { sha256: hash.digest("hex"), size });
        if (name === "manifest.json") {
          try {
            manifest = JSON.parse(Buffer.concat(chunks));
          } catch (e) {
            fail(e);
          }
        }
      });
    });
    source.on("error", fail);
    parser.on("error", reject);
    parser.on("end", resolve);
    source.pipe(parser);
  });
  if (
    manifest?.schemaVersion !== 1 ||
    manifest.files?.length !== entries.size - 1
  )
    throw Error("Sauvegarde incomplète.");
  const seen = new Set();
  for (const item of manifest.files) {
    const got = entries.get(item.path);
    if (
      seen.has(item.path) ||
      !got ||
      got.size !== item.size ||
      got.sha256 !== item.sha256
    )
      throw Error("Sauvegarde non vérifiée : " + item.path);
    seen.add(item.path);
  }
  return entries;
}
export async function compressArchives(
  db,
  c,
  options,
  { backup = createBackup, verify = verifyArchive } = {},
) {
  const release = beginMaintenance(c);
  try {
    assertStorage(c);
    const candidates = archiveCandidates(db);
    if (!candidates.length)
      return {
        processed: 0,
        savedBytes: 0,
        note: "Aucune photo d’archive éligible.",
      };
    const saved = await backup(db, c),
      backupFile = path.join(c.backupDir, saved.filename);
    if ((await fileHash(backupFile)) !== saved.checksum)
      throw Error(
        "La sauvegarde préalable est endommagée. Aucune photo modifiée.",
      );
    const verified = await verify(backupFile);
    const runId = id(),
      result = {
        backupId: saved.id,
        processed: 0,
        skipped: 0,
        savedBytes: 0,
        quality: options.quality,
        maxDimension: options.maxDimension,
        files: [],
      };
    for (const blob of candidates) {
      assertStorage(c);
      if (!verified.has(`media/${blob.hash}`))
        throw Error("Original absent de la sauvegarde. Traitement arrêté.");
      const { data, info } = await optimized(c, blob, options);
      if (data.length >= blob.size * 0.95) {
        result.skipped++;
        continue;
      }
      const hash = createHash("sha256").update(data).digest("hex"),
        out = path.join(c.mediaDir, hash);
      assertStorage(c);
      let wroteNew = true;
      await fs.writeFile(out, data, { flag: "wx", mode: 0o600 }).catch((e) => {
        if (e.code !== "EEXIST") throw e;
        wroteNew = false;
      });
      if ((await fileHash(out)) !== hash)
        throw Error("Copie optimisée invalide. Original conservé.");
      let removed = false;
      transaction(db, () => {
        if (!archiveCandidates(db).some((b) => b.hash === blob.hash)) return;
        if (result.processed === 0)
          db.prepare("INSERT INTO archive_compactions VALUES (?,?,?,?)").run(
            runId,
            saved.id,
            now(),
            JSON.stringify(result),
          );
        db.prepare("INSERT OR IGNORE INTO blobs VALUES (?,?,?,?,?,?)").run(
          hash,
          data.length,
          info.width,
          info.height,
          "image/webp",
          now(),
        );
        const ids = db
          .prepare("SELECT id,filename FROM photos WHERE hash=?")
          .all(blob.hash);
        for (const photo of ids)
          db.prepare("UPDATE photos SET hash=?,filename=? WHERE id=?").run(
            hash,
            path.parse(photo.filename).name + ".webp",
            photo.id,
          );
        db.prepare("DELETE FROM image_fingerprints WHERE hash=?").run(
          blob.hash,
        );
        db.prepare("DELETE FROM blobs WHERE hash=?").run(blob.hash);
        result.processed++;
        result.files.push({
          original: blob.hash,
          optimized: hash,
          photoIds: ids.map((p) => p.id),
          before: blob.size,
          after: data.length,
        });
        db.prepare("UPDATE archive_compactions SET detail=? WHERE id=?").run(
          JSON.stringify(result),
          runId,
        );
      });
      // Metadata now points to the verified new blob. A failed unlink leaves an orphan, never a missing original.
      if (result.files.at(-1)?.original === blob.hash) {
        try {
          assertStorage(c);
          unlinkSync(path.join(c.mediaDir, blob.hash));
          removed = true;
        } catch {
          result.note =
            "Certains originaux non référencés restent sur le NAS (suppression refusée).";
        }
      }
      if (removed)
        result.savedBytes += blob.size - (wroteNew ? data.length : 0);
      db.prepare("UPDATE archive_compactions SET detail=? WHERE id=?").run(
        JSON.stringify(result),
        runId,
      );
    }
    return {
      ...result,
      files: undefined,
      note:
        result.note ||
        "Originaux conservés dans la sauvegarde protégée. Gain mesuré sur le dossier photos ; la sauvegarde occupe de l’espace séparément.",
    };
  } finally {
    release();
  }
}
export async function registerArchiveCompression(
  app,
  { db, c, authorized, job },
) {
  app.post(
    "/api/admin/archives/estimate",
    { preHandler: authorized(["admin"]) },
    async (req) => {
      const options = input.parse(req.body),
        rows = archiveCandidates(db),
        sample = rows.slice(0, 12);
      let before = 0,
        after = 0;
      for (const row of sample) {
        const { data } = await optimized(c, row, options);
        before += row.size;
        after += Math.min(row.size, data.length);
      }
      const bytes = rows.reduce((n, r) => n + r.size, 0);
      return {
        count: rows.length,
        bytes,
        estimatedSaving: Math.round(
          bytes * (1 - (before ? after / before : 1)),
        ),
        sample: sample.length,
      };
    },
  );
  app.post(
    "/api/admin/archives/compress",
    { preHandler: authorized(["admin"]) },
    async (req) => {
      const options = input
        .extend({ confirmLoss: z.literal(true) })
        .parse(req.body);
      if (db.prepare("SELECT 1 FROM jobs WHERE state='running'").get())
        throw Object.assign(
          Error("Attendez la fin des traitements en cours."),
          { statusCode: 409 },
        );
      return job("archive_compress", req.user, () =>
        compressArchives(db, c, options),
      );
    },
  );
}
