import { z } from "zod";
import path from "node:path";
import { promises as fs } from "node:fs";
import { now, transaction, audit } from "./db.mjs";
import { assertStorage } from "./config.mjs";
import { createBackup } from "./backup.mjs";
import { verifyArchive } from "./archive-compression.mjs";
import { beginMaintenance } from "./media-maintenance.mjs";
import { eraseAnimalRecord } from "./permanent-animal.mjs";
const fail = (message, statusCode = 409) =>
  Object.assign(Error(message), { statusCode });
const key = (id) => "animalTrash:" + id;
export const isAnimalTrashed = (db, id) =>
  !!db.prepare("SELECT 1 FROM settings WHERE key=?").get(key(id));
function entries(db, animalId = "", includePurged = false) {
  return db
    .prepare("SELECT key,value FROM settings WHERE key LIKE 'animalTrash:%'")
    .all()
    .map((r) => ({ ...JSON.parse(r.value), key: r.key }))
    .filter(
      (r) =>
        (r.state === "trashed" || (includePurged && r.state === "purged")) &&
        (!animalId || r.id === animalId),
    );
}
function referenced(db, photoId) {
  for (const [table, field] of [
    ["video_projects", "config"],
    ["motion_exports", "config"],
    ["gazette_drafts", "config"],
    ["box_posters", "photo_reference"],
    ["photo_reviews", "reference"],
  ])
    if (
      db
        .prepare(`SELECT 1 FROM ${table} WHERE ${field} LIKE ? LIMIT 1`)
        .get("%" + photoId + "%")
    )
      return true;
  return !!db
    .prepare(
      "SELECT 1 FROM settings WHERE key NOT LIKE 'animalTrash:%' AND key NOT LIKE 'trashPurge:%' AND value LIKE ? LIMIT 1",
    )
    .get("%" + photoId + "%");
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
    refs.some(([table, col]) =>
      db.prepare(`SELECT 1 FROM "${table}" WHERE "${col}"=? LIMIT 1`).get(hash),
    );
}
export async function purgeTrash(
  db,
  c,
  user,
  { animalId = "", release: reservedRelease } = {},
) {
  const release = reservedRelease || beginMaintenance(c);
  try {
    assertStorage(c);
    const photos = db
      .prepare(
        "SELECT id,animal_id,hash FROM photos WHERE deleted_at IS NOT NULL AND (?='' OR animal_id=?)",
      )
      .all(animalId, animalId);
    const animals = entries(db, animalId, true);
    if (!photos.length && !animals.length)
      return { deleted: 0, animals: 0, skipped: 0, freedBytes: 0 };
    const saved = await createBackup(db, c),
      verified = await verifyArchive(path.join(c.backupDir, saved.filename));
    for (const photo of photos)
      if (!verified.has("media/" + photo.hash))
        throw fail(
          "La sauvegarde ne contient pas tous les originaux. Corbeille conservée.",
        );
    // Protected backups are excluded from automatic retention pruning.
    db.prepare("INSERT INTO settings VALUES (?,?)").run(
      "protectedBackup:" + saved.id,
      JSON.stringify({ kind: "trash", at: now() }),
    );
    const deletable = photos.filter((p) => !referenced(db, p.id)),
      removed = [];
    let removedAnimals = 0;
    transaction(db, () => {
      for (const p of deletable) {
        db.prepare("UPDATE animals SET cover_id=NULL WHERE cover_id=?").run(
          p.id,
        );
        db.prepare("DELETE FROM collection_photos WHERE photo_id=?").run(p.id);
        db.prepare("DELETE FROM photo_likes WHERE photo_id=?").run(p.id);
        db.prepare(
          "DELETE FROM media_tags WHERE kind='photo' AND media_id=?",
        ).run(p.id);
        db.prepare(
          "DELETE FROM photos WHERE id=? AND deleted_at IS NOT NULL",
        ).run(p.id);
      }
      const used = blobReferences(db);
      for (const hash of new Set(deletable.map((p) => p.hash)))
        if (!used(hash)) {
          if (!/^[a-f\d]{64}$/.test(hash))
            throw fail("Identifiant d’original invalide. Corbeille conservée.");
          const row = db
            .prepare("SELECT size FROM blobs WHERE hash=?")
            .get(hash);
          db.prepare("DELETE FROM image_fingerprints WHERE hash=?").run(hash);
          db.prepare("DELETE FROM blobs WHERE hash=?").run(hash);
          if (row) removed.push({ hash, size: row.size });
        }
      for (const a of animals)
        if (!db.prepare("SELECT 1 FROM photos WHERE animal_id=?").get(a.id)) {
          if (eraseAnimalRecord(db, a.id)) removedAnimals++;
          db.prepare("DELETE FROM settings WHERE key=?").run(key(a.id));
        }
      audit(db, user, "trash_emptied", {
        deleted: deletable.length,
        animals: removedAnimals,
        skipped: photos.length - deletable.length,
        backupId: saved.id,
      });
    });
    let freedBytes = 0,
      fileErrors = 0;
    for (const p of removed)
      try {
        await fs.unlink(path.join(c.mediaDir, p.hash));
        freedBytes += p.size;
      } catch (e) {
        if (e.code !== "ENOENT") fileErrors++;
      }
    return {
      deleted: deletable.length,
      animals: removedAnimals,
      skipped: photos.length - deletable.length,
      freedBytes,
      fileErrors,
      backupId: saved.id,
    };
  } finally {
    release();
  }
}
export async function registerTrash(app, { db, c, authorized, job }) {
  app.get("/api/trash", { preHandler: authorized() }, async (req) => {
    const animalId = req.query.animalId
      ? z.string().uuid().parse(req.query.animalId)
      : "";
    const all = entries(db, animalId),
      nested = new Set(all.map((a) => a.id));
    const photos = db
      .prepare(
        "SELECT p.id,p.animal_id,p.filename,p.deleted_at,a.name FROM photos p JOIN animals a ON a.id=p.animal_id WHERE p.deleted_at IS NOT NULL AND (?='' OR p.animal_id=?) ORDER BY p.deleted_at DESC,p.id",
      )
      .all(animalId, animalId)
      .filter((p) => !nested.has(p.animal_id));
    return {
      photos: photos.slice(0, 300),
      photoTotal: photos.length,
      animals: all.map((a) => ({
        id: a.id,
        name: a.name,
        at: a.at,
        photos: db
          .prepare("SELECT COUNT(*) n FROM photos WHERE animal_id=?")
          .get(a.id).n,
      })),
      canPurge: req.user.role === "admin",
      retainedLegacy: entries(db, animalId, true).filter(
        (a) => a.state === "purged",
      ).length,
    };
  });
  app.post(
    "/api/animals/:id/trash",
    { preHandler: authorized() },
    async (req) => {
      assertStorage(c);
      const id = z.string().uuid().parse(req.params.id),
        a = db.prepare("SELECT * FROM animals WHERE id=?").get(id);
      if (!a || !a.archived_at)
        throw fail(
          "Seule une fiche archivée peut être placée dans cette corbeille.",
        );
      if (isAnimalTrashed(db, id))
        throw fail("Cette fiche est déjà supprimée.");
      const at = now();
      transaction(db, () => {
        const photos = db
          .prepare("SELECT id,deleted_at FROM photos WHERE animal_id=?")
          .all(id);
        db.prepare("INSERT INTO settings VALUES (?,?)").run(
          key(id),
          JSON.stringify({ state: "trashed", id, name: a.name, at, photos }),
        );
        db.prepare(
          "UPDATE photos SET deleted_at=? WHERE animal_id=? AND deleted_at IS NULL",
        ).run(at, id);
        audit(db, req.user, "archive_trashed", {
          animalId: id,
          name: a.name,
          photos: photos.length,
        });
      });
      return { ok: true };
    },
  );
  app.post(
    "/api/animals/:id/trash/restore",
    { preHandler: authorized() },
    async (req) => {
      assertStorage(c);
      const id = z.string().uuid().parse(req.params.id),
        row = db.prepare("SELECT value FROM settings WHERE key=?").get(key(id));
      const a = row && JSON.parse(row.value);
      if (!a || a.state !== "trashed")
        throw fail("Archive non restaurable depuis cette corbeille.");
      transaction(db, () => {
        for (const p of a.photos)
          if (!p.deleted_at)
            db.prepare(
              "UPDATE photos SET deleted_at=NULL WHERE id=? AND deleted_at=?",
            ).run(p.id, a.at);
        db.prepare("DELETE FROM settings WHERE key=?").run(key(id));
        audit(db, req.user, "archive_trash_restored", { animalId: id });
      });
      return { ok: true };
    },
  );
  app.post(
    "/api/admin/trash/empty",
    { preHandler: authorized(["admin"]) },
    async (req) => {
      const v = z
        .object({
          confirm: z.literal("VIDER"),
          animalId: z.string().uuid().optional(),
        })
        .strict()
        .parse(req.body);
      if (db.prepare("SELECT 1 FROM jobs WHERE state='running'").get())
        throw fail("Attendez la fin des traitements en cours.");
      const release = beginMaintenance(c);
      try {
        return await job("trash_empty", req.user, () =>
          purgeTrash(db, c, req.user, { ...v, release }),
        );
      } catch (e) {
        release();
        throw e;
      }
    },
  );
}
