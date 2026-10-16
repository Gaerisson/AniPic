import { z } from "zod";
import { id, now, audit } from "./db.mjs";
const UUID = z.string().uuid();
const fail = (message, statusCode = 404) =>
  Object.assign(new Error(message), { statusCode });
export async function registerPhotoCollaboration(app, { db, authorized }) {
  function photo(value) {
    const p = db
      .prepare("SELECT id FROM photos WHERE id=?")
      .get(UUID.parse(value));
    if (!p) throw fail("Photo introuvable.");
    return p;
  }
  app.get(
    "/api/photos/:id/comments",
    { preHandler: authorized(["admin", "editor", "agent", "viewer"]) },
    async (req) => {
      photo(req.params.id);
      return {
        items: db
          .prepare(
            "SELECT c.*,u.name author FROM photo_comments c JOIN users u ON u.id=c.user_id WHERE photo_id=? ORDER BY created_at LIMIT 500",
          )
          .all(req.params.id),
      };
    },
  );
  app.post(
    "/api/photos/:id/comments",
    { preHandler: authorized() },
    async (req) => {
      photo(req.params.id);
      const input = z
        .object({
          body: z.string().trim().min(1).max(1200),
          x: z.number().min(0).max(1).nullable().default(null),
          y: z.number().min(0).max(1).nullable().default(null),
        })
        .refine((v) => (v.x === null) === (v.y === null))
        .parse(req.body);
      if (
        db
          .prepare("SELECT COUNT(*) n FROM photo_comments WHERE photo_id=?")
          .get(req.params.id).n >= 500
      )
        throw fail("500 commentaires maximum par photo.", 400);
      const value = id(),
        at = now();
      db.prepare("INSERT INTO photo_comments VALUES (?,?,?,?,?,?,0,?,?)").run(
        value,
        req.params.id,
        req.user.id,
        input.body,
        input.x,
        input.y,
        at,
        at,
      );
      audit(db, req.user, "photo_comment_added", {
        photoId: req.params.id,
        commentId: value,
      });
      return { id: value };
    },
  );
  app.patch(
    "/api/photo-comments/:id",
    { preHandler: authorized() },
    async (req) => {
      const row = db
        .prepare("SELECT * FROM photo_comments WHERE id=?")
        .get(UUID.parse(req.params.id));
      if (!row) throw fail("Commentaire introuvable.");
      const input = z
        .object({
          body: z.string().trim().min(1).max(1200).optional(),
          resolved: z.boolean().optional(),
        })
        .parse(req.body);
      if (
        input.body !== undefined &&
        row.user_id !== req.user.id &&
        req.user.role !== "admin"
      )
        throw fail(
          "Seul l’auteur ou l’administrateur peut modifier ce texte.",
          403,
        );
      db.prepare(
        "UPDATE photo_comments SET body=?,resolved=?,updated_at=? WHERE id=?",
      ).run(
        input.body ?? row.body,
        input.resolved === undefined ? row.resolved : Number(input.resolved),
        now(),
        row.id,
      );
      audit(db, req.user, "photo_comment_updated", { commentId: row.id });
      return { ok: true };
    },
  );
  app.delete(
    "/api/photo-comments/:id",
    { preHandler: authorized() },
    async (req) => {
      const row = db
        .prepare("SELECT * FROM photo_comments WHERE id=?")
        .get(UUID.parse(req.params.id));
      if (!row) throw fail("Commentaire introuvable.");
      if (row.user_id !== req.user.id && req.user.role !== "admin")
        throw fail(
          "Seul l’auteur ou l’administrateur peut supprimer ce commentaire.",
          403,
        );
      db.prepare("DELETE FROM photo_comments WHERE id=?").run(row.id);
      audit(db, req.user, "photo_comment_deleted", { commentId: row.id });
      return { ok: true };
    },
  );
  app.put(
    "/api/animals/:id/publication",
    { preHandler: authorized() },
    async (req) => {
      const animalId = UUID.parse(req.params.id),
        { published } = z.object({ published: z.boolean() }).parse(req.body);
      if (!db.prepare("SELECT 1 FROM animals WHERE id=?").get(animalId))
        throw fail("Animal introuvable.");
      if (published)
        db.prepare(
          "INSERT INTO animal_publications VALUES (?,?,?) ON CONFLICT(animal_id) DO UPDATE SET user_id=excluded.user_id,published_at=excluded.published_at",
        ).run(animalId, req.user.id, now());
      else
        db.prepare("DELETE FROM animal_publications WHERE animal_id=?").run(
          animalId,
        );
      audit(db, req.user, "animal_publication_marked", { animalId, published });
      return { ok: true };
    },
  );
}
