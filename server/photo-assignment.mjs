import { z } from "zod";
import { id, now, transaction, audit } from "./db.mjs";
import { assertStorage } from "./config.mjs";
import { registerAssignmentSuggestions } from "./assignment-suggestions.mjs";

const uuid = z.string().uuid();
const photoIds = z
  .array(uuid)
  .min(1)
  .max(200)
  .refine((v) => new Set(v).size === v.length);
const fail = (message, statusCode = 409) =>
  Object.assign(new Error(message), { statusCode });
const equal = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const photoRow = (db, value) =>
  db.prepare("SELECT * FROM photos WHERE id=?").get(value);
const animalRow = (db, value) =>
  db.prepare("SELECT * FROM animals WHERE id=?").get(value);
const folderRow = (db, value) =>
  db.prepare("SELECT * FROM import_folders WHERE folder=?").get(value);

export class AssignmentUndoHistory {
  constructor({
    clock = Date.now,
    ttl = 30 * 60000,
    maxEntries = 200,
    maxBytes = 8 * 1024 ** 2,
  } = {}) {
    Object.assign(this, { clock, ttl, maxEntries, maxBytes });
    this.entries = new Map();
  }
  prune() {
    for (const [token, entry] of this.entries)
      if (entry.expiresAt <= this.clock()) this.entries.delete(token);
  }
  put(userId, operation) {
    this.prune();
    const token = id(),
      expiresAt = this.clock() + this.ttl;
    const bytes = Buffer.byteLength(JSON.stringify(operation));
    if (bytes > this.maxBytes)
      throw fail("Lot trop volumineux pour l’annulation.", 413);
    const owned = [...this.entries].filter(
      ([, value]) => value.userId === userId,
    );
    for (const [key] of owned.slice(0, Math.max(0, owned.length - 29)))
      this.entries.delete(key);
    while (
      this.entries.size >= this.maxEntries ||
      [...this.entries.values()].reduce((sum, e) => sum + e.bytes, 0) + bytes >
        this.maxBytes
    )
      this.entries.delete(this.entries.keys().next().value);
    this.entries.set(token, { userId, operation, bytes, expiresAt });
    return {
      undoToken: token,
      undoExpiresAt: new Date(expiresAt).toISOString(),
    };
  }
  get(token, userId) {
    this.prune();
    const value = this.entries.get(token);
    if (!value || value.userId !== userId)
      throw fail(
        "Cette annulation n’est plus disponible. Vous pouvez réattribuer les photos depuis leur fiche.",
        410,
      );
    return value.operation;
  }
}

function presentAnimal(db, value) {
  const animal = animalRow(db, value);
  if (!animal || animal.archived_at || animal.departed_at)
    throw fail("Choisissez un animal présent dans le refuge.", 404);
  return animal;
}
function covers(db, ids) {
  return [...new Set(ids)].map((animalId) => ({
    animalId,
    coverId: animalRow(db, animalId)?.cover_id ?? null,
  }));
}
function invalidate(db, ids) {
  for (const animalId of new Set(ids)) {
    db.prepare("UPDATE animals SET updated_at=? WHERE id=?").run(
      now(),
      animalId,
    );
    db.prepare("DELETE FROM source_photo_matches WHERE animal_id=?").run(
      animalId,
    );
  }
}
function repairCovers(db, ids) {
  for (const animalId of new Set(ids)) {
    const a = animalRow(db, animalId);
    if (!a) continue;
    const valid = db
      .prepare(
        "SELECT id FROM photos WHERE id=? AND animal_id=? AND deleted_at IS NULL AND archived_at IS NULL",
      )
      .get(a.cover_id, animalId);
    if (valid) continue;
    const next = db
      .prepare(
        "SELECT id FROM photos WHERE animal_id=? AND deleted_at IS NULL AND archived_at IS NULL ORDER BY hidden,created_at DESC,id LIMIT 1",
      )
      .get(animalId);
    db.prepare("UPDATE animals SET cover_id=? WHERE id=?").run(
      next?.id ?? null,
      animalId,
    );
  }
}
function restoreCovers(db, operation) {
  for (const before of operation.beforeCovers) {
    const after = operation.afterCovers.find(
      (a) => a.animalId === before.animalId,
    );
    const current = animalRow(db, before.animalId);
    // Keep any cover deliberately chosen since this operation.
    if (current && current.cover_id === after?.coverId) {
      const original = before.coverId && photoRow(db, before.coverId);
      if (
        !before.coverId ||
        (original &&
          original.animal_id === before.animalId &&
          !original.deleted_at &&
          !original.archived_at)
      )
        db.prepare("UPDATE animals SET cover_id=? WHERE id=?").run(
          before.coverId,
          before.animalId,
        );
    }
  }
  repairCovers(db, operation.animalIds);
}
function assignRows(db, ids, animalId, hidden) {
  presentAnimal(db, animalId);
  const inbox = ids.map((value) =>
    db
      .prepare("SELECT * FROM inbox_photos WHERE id=? AND archived_at IS NULL")
      .get(value),
  );
  if (inbox.some((p) => !p))
    throw fail("Une photo n’est plus à trier. Actualisez la sélection.");
  const created = [],
    result = { added: 0, duplicates: 0, animalId };
  for (const p of inbox) {
    const existing = db
      .prepare("SELECT id FROM photos WHERE animal_id=? AND hash=?")
      .get(animalId, p.hash);
    if (existing) result.duplicates++;
    else {
      const photoId = id();
      db.prepare(
        "INSERT INTO photos(id,animal_id,hash,filename,hidden,created_at) VALUES (?,?,?,?,?,?)",
      ).run(
        photoId,
        animalId,
        p.hash,
        p.filename,
        Number(hidden),
        p.created_at,
      );
      created.push(photoRow(db, photoId));
      result.added++;
    }
    db.prepare("DELETE FROM inbox_photos WHERE id=?").run(p.id);
  }
  repairCovers(db, [animalId]);
  invalidate(db, [animalId]);
  return { result, inbox, created };
}
export function assignInbox(db, ids, animalId, hidden = false) {
  return transaction(db, () => assignRows(db, ids, animalId, hidden).result);
}

function hasReferences(db, photoId) {
  for (const table of ["photo_comments", "photo_likes", "collection_photos"])
    if (
      db.prepare(`SELECT 1 FROM ${table} WHERE photo_id=? LIMIT 1`).get(photoId)
    )
      return true;
  if (
    db
      .prepare(
        "SELECT 1 FROM media_tags WHERE kind='photo' AND media_id=? LIMIT 1",
      )
      .get(photoId)
  )
    return true;
  // Creative projects store photo references as JSON rather than foreign keys.
  for (const [table, field] of [
    ["video_projects", "config"],
    ["motion_exports", "config"],
    ["gazette_drafts", "config"],
    ["settings", "value"],
    ["box_posters", "photo_reference"],
    ["photo_reviews", "reference"],
  ])
    if (
      db
        .prepare(`SELECT 1 FROM ${table} WHERE ${field} LIKE ? LIMIT 1`)
        .get(`%${photoId}%`)
    )
      return true;
  return false;
}

export async function registerPhotoAssignments(app, { db, c, authorized }) {
  await registerAssignmentSuggestions(app, { db, c, authorized });
  const history = new AssignmentUndoHistory();
  app.addHook("onClose", async () => history.entries.clear());
  app.post("/api/inbox/assign", { preHandler: authorized() }, async (req) => {
    assertStorage(c);
    const input = z
      .object({
        photoIds,
        animalId: uuid,
        hidden: z.boolean().default(false),
        rememberFolder: z.boolean().default(false),
      })
      .strict()
      .parse(req.body);
    const { result, undo } = transaction(db, () => {
      const beforeCovers = covers(db, [input.animalId]);
      const assigned = assignRows(
        db,
        input.photoIds,
        input.animalId,
        input.hidden,
      );
      const folders = [];
      if (input.rememberFolder)
        for (const folder of new Set(
          assigned.inbox.map((p) => p.folder).filter(Boolean),
        )) {
          const before = folderRow(db, folder) ?? null;
          db.prepare(
            "INSERT INTO import_folders VALUES (?,?,?) ON CONFLICT(folder) DO UPDATE SET animal_id=excluded.animal_id,updated_at=excluded.updated_at",
          ).run(folder, input.animalId, now());
          folders.push({ folder, before, after: folderRow(db, folder) });
        }
      const operation = {
        kind: "inbox",
        animalIds: [input.animalId],
        beforeCovers,
        afterCovers: covers(db, [input.animalId]),
        inbox: assigned.inbox,
        photos: assigned.created,
        folders,
      };
      const undo = history.put(req.user.id, operation);
      audit(db, req.user, "inbox_assigned", {
        ...assigned.result,
        photoIds: input.photoIds,
        hidden: input.hidden,
      });
      return { result: assigned.result, undo };
    });
    return { ...result, ...undo };
  });
  app.post(
    "/api/photos/reassign",
    { preHandler: authorized() },
    async (req) => {
      assertStorage(c);
      const input = z
        .object({ photoIds, animalId: uuid, sourceAnimalId: uuid })
        .strict()
        .parse(req.body);
      if (input.sourceAnimalId === input.animalId)
        throw fail("Choisissez un autre animal.", 400);
      return transaction(db, () => {
        presentAnimal(db, input.animalId);
        const photos = input.photoIds.map((value) => photoRow(db, value));
        if (
          photos.some(
            (p) => !p || p.deleted_at || p.animal_id !== input.sourceAnimalId,
          )
        )
          throw fail(
            "Une photo a été déplacée ou supprimée depuis. Actualisez la fiche.",
          );
        const hashes = new Set();
        for (const photo of photos) {
          if (
            hashes.has(photo.hash) ||
            db
              .prepare("SELECT id FROM photos WHERE animal_id=? AND hash=?")
              .get(input.animalId, photo.hash)
          )
            throw fail(
              "Une photo est déjà présente chez cet animal, éventuellement dans sa corbeille. Aucune photo n’a été déplacée ; ajustez votre sélection.",
            );
          hashes.add(photo.hash);
        }
        const animalIds = [input.sourceAnimalId, input.animalId],
          beforeCovers = covers(db, animalIds);
        for (const photo of photos)
          db.prepare("UPDATE photos SET animal_id=? WHERE id=?").run(
            input.animalId,
            photo.id,
          );
        repairCovers(db, animalIds);
        invalidate(db, animalIds);
        const operation = {
          kind: "reassign",
          animalIds,
          beforeCovers,
          afterCovers: covers(db, animalIds),
          beforePhotos: photos,
          photos: photos.map((p) => photoRow(db, p.id)),
        };
        const undo = history.put(req.user.id, operation);
        audit(db, req.user, "photos_reassigned", {
          photoIds: input.photoIds,
          fromAnimalId: input.sourceAnimalId,
          animalId: input.animalId,
          count: photos.length,
        });
        return { moved: photos.length, animalId: input.animalId, ...undo };
      });
    },
  );
  app.post(
    "/api/photos/assignment/undo",
    { preHandler: authorized() },
    async (req) => {
      assertStorage(c);
      const { token } = z.object({ token: uuid }).strict().parse(req.body);
      const operation = history.get(token, req.user.id);
      const result = transaction(db, () => {
        for (const expected of operation.photos) {
          if (!equal(photoRow(db, expected.id), expected))
            throw fail(
              "Une photo a été modifiée depuis. Aucune modification annulée ; utilisez Réattribuer pour corriger sa fiche.",
            );
          if (operation.kind === "inbox" && hasReferences(db, expected.id))
            throw fail(
              "Une photo est utilisée ou commentée depuis. Elle est conservée ; utilisez Réattribuer pour corriger sa fiche.",
            );
        }
        if (operation.kind === "inbox") {
          for (const p of operation.inbox)
            if (
              db
                .prepare("SELECT id FROM inbox_photos WHERE id=? OR hash=?")
                .get(p.id, p.hash)
            )
              throw fail(
                "Une photo est déjà revenue dans le tri. Actualisez avant de corriger l’attribution.",
              );
          for (const folder of operation.folders)
            if (!equal(folderRow(db, folder.folder), folder.after))
              throw fail(
                "L’association du dossier a changé depuis. Aucune modification annulée.",
              );
          for (const p of operation.photos)
            db.prepare("DELETE FROM photos WHERE id=?").run(p.id);
          for (const p of operation.inbox)
            db.prepare(
              "INSERT INTO inbox_photos(id,hash,filename,folder,created_by,created_at,archived_at) VALUES (?,?,?,?,?,?,?)",
            ).run(
              p.id,
              p.hash,
              p.filename,
              p.folder,
              p.created_by,
              p.created_at,
              p.archived_at,
            );
          for (const folder of operation.folders) {
            if (folder.before)
              db.prepare(
                "UPDATE import_folders SET animal_id=?,updated_at=? WHERE folder=?",
              ).run(
                folder.before.animal_id,
                folder.before.updated_at,
                folder.folder,
              );
            else
              db.prepare("DELETE FROM import_folders WHERE folder=?").run(
                folder.folder,
              );
          }
        } else {
          for (const p of operation.beforePhotos) {
            if (!animalRow(db, p.animal_id))
              throw fail("La fiche d’origine n’est plus disponible.");
            if (
              db
                .prepare(
                  "SELECT id FROM photos WHERE animal_id=? AND hash=? AND id<>?",
                )
                .get(p.animal_id, p.hash, p.id)
            )
              throw fail(
                "Une copie a été ajoutée à la fiche d’origine. Aucune modification annulée.",
              );
            db.prepare("UPDATE photos SET animal_id=? WHERE id=?").run(
              p.animal_id,
              p.id,
            );
          }
        }
        restoreCovers(db, operation);
        invalidate(db, operation.animalIds);
        audit(db, req.user, "photo_assignment_undone", {
          kind: operation.kind,
          count:
            operation.kind === "inbox"
              ? operation.inbox.length
              : operation.photos.length,
        });
        return { ok: true };
      });
      history.entries.delete(token);
      return result;
    },
  );
}
