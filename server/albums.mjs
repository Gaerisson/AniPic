import { z } from "zod";
import { createReadStream } from "node:fs";
import path from "node:path";
import { id, now, audit, settings, transaction } from "./db.mjs";
import { ingest, derivative } from "./storage.mjs";
import { albumZip, exportPhoto } from "./exports.mjs";
const UUID = z.string().uuid(),
  fail = (message, code = 404) =>
    Object.assign(new Error(message), { statusCode: code });
export function publicAlbum(db, albumId) {
  let current = albumId;
  const seen = new Set();
  while (current) {
    if (seen.has(current) || seen.size > 12) return false;
    seen.add(current);
    const row = db
      .prepare("SELECT parent_id,is_public FROM collections WHERE id=?")
      .get(current);
    if (!row?.is_public) return false;
    current = row.parent_id;
  }
  return true;
}
export async function registerAlbums(app, { db, c, authorized }) {
  const find = (value, user) => {
    const row = db
      .prepare("SELECT * FROM collections WHERE id=?")
      .get(UUID.parse(value));
    if (!row || (!user && !publicAlbum(db, row.id)))
      throw fail("Album introuvable.");
    return row;
  };
  const photos = (albumId, user, limit = 60, offset = 0) =>
    db
      .prepare(
        `
    SELECT p.id AS id,NULL animal_id,p.hash,p.filename,p.caption,p.created_at AS created_at,b.width,b.height,b.size,b.mime,p.filename name,'private' kind FROM album_photos p JOIN blobs b ON b.hash=p.hash WHERE collection_id=?
    UNION ALL
    SELECT p.id,p.animal_id,p.hash,p.filename,p.caption,p.created_at,b.width,b.height,b.size,b.mime,a.name,'animal' FROM collection_photos cp JOIN photos p ON p.id=cp.photo_id JOIN animals a ON a.id=p.animal_id JOIN blobs b ON b.hash=p.hash WHERE cp.collection_id=? AND (?=1 OR (p.hidden=0 AND p.archived_at IS NULL AND a.archived_at IS NULL))
    ORDER BY created_at DESC,id LIMIT ? OFFSET ?`,
      )
      .all(albumId, albumId, user ? 1 : 0, limit, offset);
  const output = (row, user, limit = 60, page = 1) => {
    const items = photos(row.id, user, limit, (page - 1) * limit);
    const total = db
      .prepare(
        "SELECT (SELECT COUNT(*) FROM album_photos WHERE collection_id=?)+(SELECT COUNT(*) FROM collection_photos cp JOIN photos p ON p.id=cp.photo_id JOIN animals a ON a.id=p.animal_id WHERE cp.collection_id=? AND (?=1 OR (p.hidden=0 AND p.archived_at IS NULL AND a.archived_at IS NULL))) n",
      )
      .get(row.id, row.id, user ? 1 : 0).n;
    return {
      ...row,
      effective_public: publicAlbum(db, row.id),
      photo_count: total,
      page,
      pages: Math.ceil(total / limit),
      photos: items.slice(0, limit).map(({ hash, ...p }) => p),
    };
  };
  app.get("/api/collections", async (req) =>
    db
      .prepare("SELECT * FROM collections ORDER BY name COLLATE NOCASE")
      .all()
      .filter((row) => req.user || publicAlbum(db, row.id))
      .map((row) => output(row, req.user, 4)),
  );
  app.get("/api/collections/:id", async (req) => {
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .default(1)
      .parse(req.query.page);
    return output(find(req.params.id, req.user), req.user, 60, page);
  });
  app.post(
    "/api/collections",
    { preHandler: authorized() },
    async (req, reply) => {
      const v = z
        .object({
          name: z.string().trim().min(1).max(80),
          description: z.string().max(200).default(""),
          parentId: UUID.nullable().default(null),
          photoIds: z.array(UUID).max(300).default([]),
        })
        .parse(req.body);
      if (v.parentId) {
        find(v.parentId, req.user);
        let cursor = v.parentId,
          depth = 0;
        while (cursor) {
          if (++depth >= 12) throw fail("12 niveaux de dossiers maximum.", 400);
          cursor = db
            .prepare("SELECT parent_id FROM collections WHERE id=?")
            .get(cursor)?.parent_id;
        }
      }
      const albumId = id();
      transaction(db, () => {
        db.prepare(
          "INSERT INTO collections(id,name,description,created_at,parent_id,is_public) VALUES (?,?,?,?,?,0)",
        ).run(albumId, v.name, v.description, now(), v.parentId);
        for (const p of v.photoIds) {
          if (!db.prepare("SELECT id FROM photos WHERE id=?").get(p))
            throw fail("Photo introuvable.", 400);
          db.prepare(
            "INSERT OR IGNORE INTO collection_photos VALUES (?,?)",
          ).run(albumId, p);
        }
      });
      audit(db, req.user, "album_created", {
        id: albumId,
        parentId: v.parentId,
      });
      return reply.code(201).send({ id: albumId });
    },
  );
  app.patch(
    "/api/collections/:id",
    { preHandler: authorized() },
    async (req) => {
      const row = find(req.params.id, req.user),
        v = z
          .object({
            name: z.string().trim().min(1).max(80).optional(),
            description: z.string().max(200).optional(),
            isPublic: z.boolean().optional(),
          })
          .parse(req.body);
      db.prepare(
        "UPDATE collections SET name=?,description=?,is_public=? WHERE id=?",
      ).run(
        v.name ?? row.name,
        v.description ?? row.description,
        v.isPublic === undefined ? row.is_public : Number(v.isPublic),
        row.id,
      );
      audit(db, req.user, "album_updated", {
        id: row.id,
        isPublic: v.isPublic,
      });
      return { ok: true };
    },
  );
  app.post(
    "/api/collections/:id/photos",
    { preHandler: authorized() },
    async (req) => {
      const row = find(req.params.id, req.user),
        { photoIds } = z
          .object({ photoIds: z.array(UUID).max(300) })
          .parse(req.body);
      transaction(db, () => {
        for (const p of photoIds) {
          if (!db.prepare("SELECT id FROM photos WHERE id=?").get(p))
            throw fail("Photo introuvable.", 400);
          db.prepare(
            "INSERT OR IGNORE INTO collection_photos VALUES (?,?)",
          ).run(row.id, p);
        }
      });
      return { ok: true };
    },
  );
  app.post(
    "/api/collections/:id/upload",
    {
      preHandler: authorized(),
      config: { rateLimit: { max: 12, timeWindow: "1 minute" } },
    },
    async (req) => {
      const row = find(req.params.id, req.user);
      const imported = [];
      for await (const part of req.parts({
        limits: { files: 50, fields: 0, fileSize: c.maxUploadBytes },
      }))
        if (part.type === "file")
          imported.push(
            await ingest(db, c, null, part.file, part.filename, true, row.id),
          );
      if (!imported.length) throw fail("Choisissez au moins une photo.", 400);
      audit(db, req.user, "album_uploaded", {
        id: row.id,
        count: imported.length,
      });
      return { photos: imported };
    },
  );
  app.get("/api/album-media/:id", async (req, reply) => {
    const p = db
      .prepare(
        "SELECT p.*,b.mime,b.size,b.width,b.height FROM album_photos p JOIN blobs b ON b.hash=p.hash WHERE p.id=?",
      )
      .get(UUID.parse(req.params.id));
    if (!p) throw fail("Photo introuvable.");
    find(p.collection_id, req.user);
    reply.header("Cache-Control", "private, no-store");
    const q = z
      .object({
        w: z.coerce
          .number()
          .refine((n) => [320, 640, 1280].includes(n))
          .default(640),
        original: z.enum(["1"]).optional(),
        download: z.enum(["1"]).optional(),
      })
      .parse(req.query);
    if (q.original && !req.user)
      throw fail("Connexion requise pour les originaux.", 401);
    if (q.original || q.download)
      reply.header(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(q.original ? p.filename : path.parse(p.filename).name + ".jpg")}`,
      );
    if (q.original)
      return reply
        .type(p.mime)
        .send(createReadStream(path.join(c.mediaDir, p.hash)));
    if (q.download)
      return reply.type("image/jpeg").send(
        await exportPhoto(c, p, {
          format: "jpeg",
          size: "medium",
          layout: "fit",
        }),
      );
    return reply
      .type("image/webp")
      .send(
        createReadStream(
          await derivative(
            c,
            p,
            q.w,
            settings(db).thumbQuality,
            settings(db).cacheMB * 1024 ** 2,
          ),
        ),
      );
  });
  app.get(
    "/api/collections/:id/download",
    {
      preHandler: authorized(["admin", "editor", "agent", "viewer"]),
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const row = find(req.params.id, req.user),
        items = photos(row.id, req.user, 2001);
      if (!items.length) throw fail("Album vide.", 400);
      reply.header(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(row.name + ".zip")}`,
      );
      return reply.type("application/zip").send(albumZip(c, row, items));
    },
  );
}
