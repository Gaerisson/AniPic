import { beginMediaWrite } from "./media-maintenance.mjs";
import { createReadStream, createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { id, now, transaction } from "./db.mjs";
import { assertStorage } from "./config.mjs";
const ALLOWED = new Set(["jpeg", "png", "webp", "avif"]);
sharp.concurrency(1);
sharp.cache({ memory: 32, files: 0, items: 128 });
const locks = new Map();
let processing = 0;
const waiting = [];
async function limited(fn) {
  if (processing >= 2) await new Promise((resolve) => waiting.push(resolve));
  processing++;
  try {
    return await fn();
  } finally {
    processing--;
    waiting.shift()?.();
  }
}
export async function ingest(
  db,
  c,
  animalId,
  readable,
  filename,
  hidden = false,
  albumId = null,
  inbox = null,
) {
  assertStorage(c);
  const finishWrite = beginMediaWrite(c);
  const tmp = path.join(c.mediaDir, `.upload-${randomUUID()}`);
  const hash = createHash("sha256");
  let size = 0;
  try {
    await pipeline(
      readable,
      new Transform({
        transform(chunk, encoding, cb) {
          size += chunk.length;
          if (size > c.maxUploadBytes)
            return cb(
              Object.assign(new Error("Photo trop volumineuse."), {
                statusCode: 413,
              }),
            );
          hash.update(chunk);
          cb(null, chunk);
        },
      }),
      createWriteStream(tmp, { flags: "wx", mode: 0o600 }),
    );
    if (readable.truncated)
      throw Object.assign(new Error("Photo trop volumineuse."), {
        statusCode: 413,
      });
    const metadata = await limited(() =>
      sharp(tmp, { limitInputPixels: 40_000_000, animated: false }).metadata(),
    );
    if (
      !ALLOWED.has(metadata.format) ||
      (metadata.pages ?? 1) > 1 ||
      !metadata.width ||
      !metadata.height
    )
      throw Object.assign(
        new Error("JPEG, PNG, WebP ou AVIF statique requis."),
        { statusCode: 400 },
      );
    // Decode once to reject corrupt files and decoder bombs before publication.
    await limited(() =>
      sharp(tmp, { limitInputPixels: 40_000_000 })
        .resize(8, 8, { fit: "inside" })
        .raw()
        .toBuffer(),
    );
    const digest = hash.digest("hex");
    const target = path.join(c.mediaDir, digest);
    // Hard-link publishes an immutable blob without replacing an existing original.
    try {
      await fs.link(tmp, target);
    } catch (e) {
      if (e.code !== "EEXIST") {
        try {
          await fs.copyFile(tmp, target, 1);
        } catch (copy) {
          if (copy.code !== "EEXIST") throw copy;
        }
      }
    }
    const photoId = id();
    const mime = `image/${metadata.format === "jpeg" ? "jpeg" : metadata.format}`;
    const name = path
      .basename(filename || "photo")
      .replace(/[\x00-\x1f]/g, "")
      .slice(0, 180);
    const duplicate = db
      .prepare(
        inbox
          ? "SELECT id FROM inbox_photos WHERE hash=?"
          : albumId
            ? "SELECT id FROM album_photos WHERE collection_id=? AND hash=?"
            : "SELECT id,deleted_at FROM photos WHERE animal_id=? AND hash=?",
      )
      .get(...(inbox ? [digest] : [albumId || animalId, digest]));
    if (duplicate) {
      if (albumId)
        db.prepare("UPDATE album_photos SET deleted_at=NULL WHERE id=?").run(
          duplicate.id,
        );
      else if (!inbox && duplicate.deleted_at)
        transaction(db, () => {
          db.prepare(
            "UPDATE photos SET deleted_at=NULL,archived_at=NULL,hidden=MAX(hidden,?),created_at=? WHERE id=?",
          ).run(Number(hidden), now(), duplicate.id);
          db.prepare(
            "UPDATE animals SET cover_id=COALESCE(cover_id,?),updated_at=? WHERE id=?",
          ).run(duplicate.id, now(), animalId);
        });
      return { id: duplicate.id, duplicate: true };
    }
    transaction(db, () => {
      db.prepare("INSERT OR IGNORE INTO blobs VALUES (?,?,?,?,?,?)").run(
        digest,
        size,
        metadata.width,
        metadata.height,
        mime,
        now(),
      );
      if (inbox)
        db.prepare(
          "INSERT INTO inbox_photos(id,hash,filename,folder,created_by,created_at) VALUES (?,?,?,?,?,?)",
        ).run(
          photoId,
          digest,
          name,
          inbox.folder || "",
          inbox.userId || null,
          now(),
        );
      else if (albumId)
        db.prepare(
          "INSERT INTO album_photos(id,collection_id,hash,filename,created_at) VALUES (?,?,?,?,?)",
        ).run(photoId, albumId, digest, name, now());
      else {
        db.prepare(
          "INSERT INTO photos(id,animal_id,hash,filename,hidden,created_at) VALUES (?,?,?,?,?,?)",
        ).run(photoId, animalId, digest, name, Number(hidden), now());
        db.prepare(
          "UPDATE animals SET cover_id=COALESCE(cover_id,?),updated_at=? WHERE id=?",
        ).run(photoId, now(), animalId);
      }
    });
    return { id: photoId, duplicate: false };
  } finally {
    await fs.unlink(tmp).catch(() => {});
    finishWrite();
  }
}
export async function directoryBytes(directory) {
  let total = 0;
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isFile() && !entry.name.startsWith("."))
      total += (await fs.stat(path.join(directory, entry.name))).size;
  }
  return total;
}
export async function sweepCache(c, limit, all = false) {
  const files = [];
  for (const e of await fs.readdir(c.cacheDir, { withFileTypes: true }))
    if (e.isFile() && /^[a-f0-9]{64}-\d+-\d+\.webp$/.test(e.name)) {
      const stat = await fs
        .stat(path.join(c.cacheDir, e.name))
        .catch(() => null);
      if (stat) files.push({ name: e.name, ...stat });
    }
  let total = files.reduce((sum, f) => sum + f.size, 0);
  let removed = 0;
  for (const file of files.sort((a, b) => a.mtimeMs - b.mtimeMs)) {
    if (!all && total <= limit) break;
    try {
      await fs.unlink(path.join(c.cacheDir, file.name));
      total -= file.size;
      removed += file.size;
    } catch {}
  }
  return { bytes: total, removed };
}
export async function derivative(c, blob, width, quality, limit) {
  const name = `${blob.hash}-${width}-${quality}.webp`;
  const target = path.join(c.cacheDir, name);
  if (locks.has(name)) return locks.get(name);
  const task = limited(async () => {
    try {
      await fs.access(target);
      await fs.utimes(target, new Date(), new Date());
      return target;
    } catch {}
    const tmp = path.join(c.cacheDir, `.resize-${randomUUID()}`);
    try {
      await sharp(path.join(c.mediaDir, blob.hash), {
        limitInputPixels: 40_000_000,
      })
        .rotate()
        .resize(width, null, { withoutEnlargement: true })
        .webp({ quality, effort: 4 })
        .toFile(tmp);
      await fs.rename(tmp, target);
      // Keep the requested object alive while evicting older files.
      await sweepCache(c, limit);
      return target;
    } finally {
      await fs.unlink(tmp).catch(() => {});
    }
  });
  locks.set(name, task);
  try {
    return await task;
  } finally {
    locks.delete(name);
  }
}
export const originalStream = (c, hash) =>
  createReadStream(path.join(c.mediaDir, hash));
