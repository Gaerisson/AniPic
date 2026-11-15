import path from "node:path";
import { promises as fs } from "node:fs";
import { settings, now, transaction, audit } from "./db.mjs";
import { assertStorage } from "./config.mjs";
import { createBackup } from "./backup.mjs";
import { verifyArchive } from "./archive-compression.mjs";
import { beginMaintenance } from "./media-maintenance.mjs";

export const inboxRetentionDays = (db) => {
  const days = settings(db).inboxRetentionDays;
  return Number.isInteger(days) && days >= 1 && days <= 3650 ? days : 0;
};

export async function purgeDiscardedInbox(
  db,
  c,
  user = null,
  { clock = Date.now() } = {},
) {
  const result = { deleted: 0, skipped: 0, freedBytes: 0, fileErrors: 0 };
  const days = inboxRetentionDays(db);
  if (!days || settings(db).enabledModules?.inbox === false) return result;
  const release = beginMaintenance(c);
  try {
    assertStorage(c);
    const cutoff = new Date(clock - days * 86400000).toISOString();
    const rows = db
      .prepare(
        "SELECT id,hash FROM inbox_photos WHERE archived_at IS NOT NULL AND julianday(archived_at)<=julianday(?) ORDER BY archived_at,id",
      )
      .all(cutoff);
    const candidates = [];
    for (const photo of rows) {
      if (creativeReference(db, photo.id)) result.skipped++;
      else if (candidates.length < 200) candidates.push(photo);
      else {
        result.more = true;
        break;
      }
    }
    if (!candidates.length) return result;
    const saved = await createBackup(db, c);
    const verified = await verifyArchive(
      path.join(c.backupDir, saved.filename),
    );
    if (settings(db).enabledModules?.inbox === false) return result;
    for (const photo of candidates)
      if (!verified.has("media/" + photo.hash))
        throw Error("Sauvegarde incomplète. Photos écartées conservées.");
    const removed = [],
      deletedPhotos = [];
    transaction(db, () => {
      db.prepare("INSERT INTO settings VALUES (?,?)").run(
        "protectedBackup:" + saved.id,
        JSON.stringify({ kind: "inbox-retention", at: now() }),
      );
      // The maintenance lock rejects API mutations while the backup is prepared.
      for (const photo of candidates) {
        // Background work may still finish during an awaited backup.
        if (creativeReference(db, photo.id)) {
          result.skipped++;
          continue;
        }
        const deleted = db
          .prepare(
            "DELETE FROM inbox_photos WHERE id=? AND archived_at IS NOT NULL AND julianday(archived_at)<=julianday(?)",
          )
          .run(photo.id, cutoff);
        if (deleted.changes) {
          result.deleted++;
          deletedPhotos.push(photo);
        } else result.skipped++;
      }
      const used = blobReferences(db);
      for (const hash of new Set(deletedPhotos.map((p) => p.hash))) {
        if (used(hash)) continue;
        if (!/^[a-f\d]{64}$/.test(hash))
          throw Error("Identifiant d’original invalide.");
        const blob = db
          .prepare("SELECT size FROM blobs WHERE hash=?")
          .get(hash);
        db.prepare("DELETE FROM image_fingerprints WHERE hash=?").run(hash);
        db.prepare("DELETE FROM blobs WHERE hash=?").run(hash);
        if (blob) removed.push({ hash, size: blob.size });
      }
      audit(db, user, "inbox_discarded_purged", {
        deleted: result.deleted,
        skipped: result.skipped,
        days,
        cutoff,
        backupId: saved.id,
      });
    });
    for (const blob of removed) {
      try {
        await fs.unlink(path.join(c.mediaDir, blob.hash));
        result.freedBytes += blob.size;
      } catch (error) {
        if (error.code !== "ENOENT") result.fileErrors++;
      }
    }
    return { ...result, backupId: saved.id };
  } finally {
    release();
  }
}

function creativeReference(db, photoId) {
  for (const [table, field] of [
    ["video_projects", "config"],
    ["motion_exports", "config"],
    ["gazette_drafts", "config"],
    ["box_posters", "photo_reference"],
    ["box_posters", "snapshot"],
    ["photo_reviews", "reference"],
    ["canva_projects", "designs"],
    ["settings", "value"],
  ])
    if (
      db
        .prepare(`SELECT 1 FROM ${table} WHERE instr(${field},?)>0 LIMIT 1`)
        .get(photoId)
    )
      return true;
  return false;
}

function blobReferences(db) {
  const refs = [];
  for (const { name } of db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .all())
    for (const fk of db.prepare(`PRAGMA foreign_key_list("${name}")`).all())
      if (fk.table === "blobs" && name !== "image_fingerprints")
        refs.push([name, fk.from]);
  return (hash) =>
    refs.some(([table, column]) =>
      db
        .prepare(`SELECT 1 FROM "${table}" WHERE "${column}"=? LIMIT 1`)
        .get(hash),
    );
}
