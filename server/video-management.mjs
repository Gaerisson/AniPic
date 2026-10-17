import { z } from "zod";
import { now, audit, transaction } from "./db.mjs";
export async function registerVideoManagement(app, { db, authorized }) {
  const trash = (table, name) => {
    app.delete(
      `/api/video/${name}/:id`,
      { preHandler: authorized() },
      async (req, reply) => {
        const key = z.string().uuid().parse(req.params.id);
        const row = db
          .prepare(`SELECT * FROM ${table} WHERE id=? AND deleted_at IS NULL`)
          .get(key);
        if (!row)
          return reply.code(404).send({ error: "Élément introuvable." });
        const running =
          name === "projects"
            ? db
                .prepare(
                  "SELECT 1 FROM video_renders WHERE project_id=? AND state='running'",
                )
                .get(key)
            : row.state === "running";
        if (running)
          return reply
            .code(409)
            .send({ error: "Annulez le rendu en cours avant la suppression." });
        transaction(db, () => {
          db.prepare(`UPDATE ${table} SET deleted_at=? WHERE id=?`).run(
            now(),
            key,
          );
        });
        audit(db, req.user, `video_${name}_trashed`, { id: key });
        return { ok: true };
      },
    );
    app.post(
      `/api/video/${name}/:id/restore`,
      { preHandler: authorized() },
      async (req) => {
        db.prepare(`UPDATE ${table} SET deleted_at=NULL WHERE id=?`).run(
          z.string().uuid().parse(req.params.id),
        );
        return { ok: true };
      },
    );
  };
  trash("video_projects", "projects");
  trash("video_renders", "renders");
  app.get(
    "/api/video/trash",
    {
      preHandler: authorized([
        "admin",
        "editor",
        "agent",
        "volunteer",
        "viewer",
      ]),
    },
    async () => ({
      projects: db
        .prepare(
          "SELECT id,title,deleted_at FROM video_projects WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 100",
        )
        .all(),
      renders: db
        .prepare(
          "SELECT r.id,p.title,r.deleted_at FROM video_renders r JOIN video_projects p ON p.id=r.project_id WHERE r.deleted_at IS NOT NULL ORDER BY r.deleted_at DESC LIMIT 100",
        )
        .all(),
    }),
  );
  app.get(
    "/api/video/year/:year",
    {
      preHandler: authorized([
        "admin",
        "editor",
        "agent",
        "volunteer",
        "viewer",
      ]),
    },
    async (req) => {
      const year = String(
        z.coerce.number().int().min(2000).max(2100).parse(req.params.year),
      );
      const animals = db
        .prepare(
          "SELECT a.id,a.name,a.species,a.status,a.cover_id,a.source_metadata FROM animals a WHERE substr(COALESCE(a.departed_at,a.archived_at),1,4)=? OR EXISTS(SELECT 1 FROM animal_status_events e WHERE e.animal_id=a.id AND e.status='adopted' AND substr(e.observed_at,1,4)=?) ORDER BY a.name COLLATE NOCASE,a.id",
        )
        .all(year, year);
      const adopted = db
        .prepare(
          "SELECT COUNT(DISTINCT animal_id) n FROM animal_status_events WHERE status='adopted' AND substr(observed_at,1,4)=?",
        )
        .get(year).n;
      return {
        year: Number(year),
        adopted,
        animals: animals.map(({ source_metadata, ...a }) => ({
          ...a,
          hasSourcePhoto: !!JSON.parse(source_metadata || "{}").thumbnail,
        })),
      };
    },
  );
}
