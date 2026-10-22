import { z } from "zod";
import { id, now, audit } from "./db.mjs";
import { validateCanvasDocument } from "../shared/canvas-document.mjs";
const creators = ["admin", "agent", "editor", "volunteer"];
const body = z
  .object({
    title: z.string().trim().min(1).max(120),
    document: z.unknown(),
    shared: z.boolean().default(false),
    revision: z.number().int().min(1).optional(),
  })
  .strict();
const denied = () =>
  Object.assign(new Error("Projet introuvable ou accès refusé."), {
    statusCode: 404,
  });
export async function registerCanvas(app, { db, authorized }) {
  const access = { preHandler: authorized([...creators, "viewer"]) };
  function project(req, writing = false) {
    const row = db
      .prepare("SELECT * FROM canvas_projects WHERE id=?")
      .get(z.string().uuid().parse(req.params.id));
    if (
      !row ||
      (row.owner_id !== req.user.id &&
        req.user.role !== "admin" &&
        !row.shared) ||
      (writing && !creators.includes(req.user.role))
    )
      throw denied();
    return row;
  }
  app.get("/api/canvas/projects", access, async (req) => ({
    projects: db
      .prepare(
        "SELECT id,title,shared,revision,owner_id,created_at,updated_at FROM canvas_projects WHERE owner_id=? OR shared=1 OR ?='admin' ORDER BY updated_at DESC LIMIT 100",
      )
      .all(req.user.id, req.user.role),
  }));
  app.get("/api/canvas/projects/:id", access, async (req) => {
    const row = project(req);
    return { ...row, document: JSON.parse(row.document) };
  });
  app.post(
    "/api/canvas/projects",
    { preHandler: authorized(creators), bodyLimit: 11000000 },
    async (req) => {
      const value = body.parse(req.body),
        document = validateCanvasDocument(value.document),
        key = id(),
        at = now();
      db.prepare("INSERT INTO canvas_projects VALUES (?,?,?,?,?,1,?,?)").run(
        key,
        value.title,
        JSON.stringify(document),
        req.user.id,
        Number(value.shared),
        at,
        at,
      );
      audit(db, req.user, "canvas_saved", {
        id: key,
        elements: document.scene.objects.length,
      });
      return { id: key, revision: 1, updated_at: at };
    },
  );
  app.put(
    "/api/canvas/projects/:id",
    { preHandler: authorized(creators), bodyLimit: 11000000 },
    async (req) => {
      const row = project(req, true),
        value = body.parse(req.body),
        document = validateCanvasDocument(value.document);
      if (value.revision !== row.revision)
        throw Object.assign(
          new Error(
            "Ce projet a changé sur un autre appareil. Rouvrez-le ou enregistrez une copie.",
          ),
          { statusCode: 409 },
        );
      if (
        value.shared !== Boolean(row.shared) &&
        row.owner_id !== req.user.id &&
        req.user.role !== "admin"
      )
        throw Object.assign(
          new Error("Seul le propriétaire peut changer le partage."),
          { statusCode: 403 },
        );
      const at = now();
      const result = db
        .prepare(
          "UPDATE canvas_projects SET title=?,document=?,shared=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?",
        )
        .run(
          value.title,
          JSON.stringify(document),
          Number(value.shared),
          at,
          row.id,
          value.revision,
        );
      if (!result.changes)
        throw Object.assign(
          new Error("Le projet a été modifié. Enregistrez une copie."),
          { statusCode: 409 },
        );
      audit(db, req.user, "canvas_saved", {
        id: row.id,
        elements: document.scene.objects.length,
      });
      return { id: row.id, revision: row.revision + 1, updated_at: at };
    },
  );
  app.delete(
    "/api/canvas/projects/:id",
    { preHandler: authorized(creators) },
    async (req) => {
      const row = project(req, true);
      if (row.owner_id !== req.user.id && req.user.role !== "admin")
        throw Object.assign(
          new Error("Seul le propriétaire peut supprimer ce projet."),
          { statusCode: 403 },
        );
      db.prepare("DELETE FROM canvas_projects WHERE id=?").run(row.id);
      audit(db, req.user, "canvas_removed", { id: row.id });
      return { ok: true };
    },
  );
}
