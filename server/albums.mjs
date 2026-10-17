import { z } from "zod";
import { createReadStream } from "node:fs";
import path from "node:path";
import { id, now, audit, settings, transaction } from "./db.mjs";
import { ingest, derivative } from "./storage.mjs";
import { albumZip, exportPhoto } from "./exports.mjs";
import { ingestAsset, rangeReply } from "./video.mjs";
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
    SELECT p.id AS id,NULL animal_id,p.hash,p.filename,p.caption,p.created_at AS created_at,b.width,b.height,b.size,b.mime,p.filename name,'private' kind FROM album_photos p JOIN blobs b ON b.hash=p.hash WHERE collection_id=? AND p.deleted_at IS NULL
    UNION ALL
    SELECT p.id,p.animal_id,p.hash,p.filename,p.caption,p.created_at,b.width,b.height,b.size,b.mime,a.name,'animal' FROM collection_photos cp JOIN photos p ON p.id=cp.photo_id JOIN animals a ON a.id=p.animal_id JOIN blobs b ON b.hash=p.hash WHERE cp.collection_id=? AND p.deleted_at IS NULL AND (?=1 OR (p.hidden=0 AND p.archived_at IS NULL AND a.archived_at IS NULL))
    ORDER BY created_at DESC,id LIMIT ? OFFSET ?`,
      )
      .all(albumId, albumId, user ? 1 : 0, limit, offset);
  const output = (row, user, limit = 60, page = 1) => {
    const items = photos(row.id, user, limit, (page - 1) * limit);
    const total = db
      .prepare(
        "SELECT (SELECT COUNT(*) FROM album_photos WHERE collection_id=? AND deleted_at IS NULL)+(SELECT COUNT(*) FROM collection_photos cp JOIN photos p ON p.id=cp.photo_id JOIN animals a ON a.id=p.animal_id WHERE cp.collection_id=? AND p.deleted_at IS NULL AND (?=1 OR (p.hidden=0 AND p.archived_at IS NULL AND a.archived_at IS NULL))) n",
      )
      .get(row.id, row.id, user ? 1 : 0).n;
    return {
      ...row,
      effective_public: publicAlbum(db, row.id),
      covers: db
        .prepare(
          "WITH RECURSIVE children(id,depth) AS (SELECT ?,0 UNION ALL SELECT c.id,ch.depth+1 FROM collections c JOIN children ch ON c.parent_id=ch.id WHERE ch.depth<12) SELECT id FROM children ORDER BY depth",
        )
        .all(row.id)
        .filter((a) => user || publicAlbum(db, a.id))
        .flatMap((a) => photos(a.id, user, 4))
        .sort(
          (a, b) =>
            Number(b.mime.startsWith("image/")) -
            Number(a.mime.startsWith("image/")),
        )
        .slice(0, 4)
        .map(({ hash, ...p }) => p),
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
    const row = find(req.params.id, req.user);
    if (req.query.trash === "1") {
      if (!req.user) throw fail("Connexion requise.", 401);
      const items = db
        .prepare(
          "SELECT p.*,b.size,b.mime,b.width,b.height,'private' kind,p.filename name FROM album_photos p JOIN blobs b ON b.hash=p.hash WHERE collection_id=? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 200",
        )
        .all(row.id)
        .map(({ hash, ...r }) => r);
      return {
        ...row,
        photos: items,
        photo_count: items.length,
        page: 1,
        pages: 1,
      };
    }
    return output(row, req.user, 60, page);
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
            parentId: UUID.nullable().optional(),
          })
          .parse(req.body);
      if (v.parentId !== undefined) {
        let cursor = v.parentId,
          seen = new Set([row.id]);
        while (cursor) {
          if (seen.has(cursor) || seen.size >= 12)
            throw fail("Déplacement circulaire ou trop profond.", 400);
          seen.add(cursor);
          cursor = find(cursor, req.user).parent_id;
        }
        const height = (id, depth = 1) => {
          if (depth > 12) throw fail("12 niveaux maximum.", 400);
          const children = db
            .prepare("SELECT id FROM collections WHERE parent_id=?")
            .all(id);
          return Math.max(
            depth,
            ...children.map((a) => height(a.id, depth + 1)),
          );
        };
        if (seen.size - 1 + height(row.id) > 12)
          throw fail("12 niveaux maximum.", 400);
      }
      db.prepare(
        "UPDATE collections SET name=?,description=?,is_public=?,parent_id=? WHERE id=?",
      ).run(
        v.name ?? row.name,
        v.description ?? row.description,
        v.parentId !== undefined && v.parentId !== row.parent_id
          ? 0
          : v.isPublic === undefined
            ? row.is_public
            : Number(v.isPublic),
        v.parentId === undefined ? row.parent_id : v.parentId,
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
        limits: {
          files: 50,
          fields: 0,
          fileSize: c.maxMediaBytes || 512 * 1024 ** 2,
        },
      }))
        if (part.type === "file") {
          if (/\.(mp4|webm|mov|m4v)$/i.test(part.filename || "")) {
            const asset = await ingestAsset(
              db,
              c,
              part.file,
              part.filename,
              "video",
              req.user.id,
            );
            const blob = db
              .prepare("SELECT hash,filename FROM video_assets WHERE id=?")
              .get(asset.id);
            db.prepare(
              "INSERT INTO album_photos(id,collection_id,hash,filename,created_at) VALUES (?,?,?,?,?) ON CONFLICT(collection_id,hash) DO UPDATE SET deleted_at=NULL",
            ).run(id(), row.id, blob.hash, blob.filename, now());
            imported.push({
              id: db
                .prepare(
                  "SELECT id FROM album_photos WHERE collection_id=? AND hash=?",
                )
                .get(row.id, blob.hash).id,
            });
          } else
            imported.push(
              await ingest(db, c, null, part.file, part.filename, true, row.id),
            );
        }
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
    if (!p || (p.deleted_at && !req.user)) throw fail("Média introuvable.");
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
    if (p.mime.startsWith("video/")) {
      if (q.download || q.original)
        reply.header(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(p.filename)}`,
        );
      return rangeReply(req, reply, path.join(c.mediaDir, p.hash), p.mime);
    }
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
  app.patch(
    "/api/collections/:id/items/:itemId",
    { preHandler: authorized() },
    async (req) => {
      const album = find(req.params.id, req.user),
        itemId = UUID.parse(req.params.itemId);
      const v = z
        .object({
          kind: z.enum(["private", "animal"]).default("private"),
          filename: z
            .string()
            .trim()
            .min(1)
            .max(180)
            .regex(/^[^\\/\x00-\x1f]+$/)
            .optional(),
          caption: z.string().max(500).optional(),
          destinationId: UUID.optional(),
          deleted: z.boolean().optional(),
        })
        .strict()
        .parse(req.body);
      const item = db
        .prepare(
          v.kind === "private"
            ? "SELECT * FROM album_photos WHERE collection_id=? AND id=?"
            : "SELECT p.* FROM collection_photos cp JOIN photos p ON p.id=cp.photo_id WHERE cp.collection_id=? AND p.id=?",
        )
        .get(album.id, itemId);
      if (!item) throw fail("Média introuvable.");
      if (
        v.kind === "animal" &&
        (v.filename !== undefined || v.caption !== undefined)
      )
        throw fail("Modifiez la photo liée depuis sa fiche animal.", 400);
      if (v.destinationId) {
        find(v.destinationId, req.user);
        if (publicAlbum(db, v.destinationId))
          throw fail(
            "Choisissez un album privé pour éviter de publier un média pendant le déplacement.",
            409,
          );
      }
      transaction(db, () => {
        if (v.kind === "private") {
          if (
            v.destinationId &&
            v.destinationId !== album.id &&
            db
              .prepare(
                "SELECT 1 FROM album_photos WHERE collection_id=? AND hash=?",
              )
              .get(v.destinationId, item.hash)
          )
            throw fail("Ce média existe déjà dans la destination.", 409);
          const ext = path.extname(item.filename),
            filename = v.filename
              ? v.filename.replace(/\.[^.]+$/, "") + ext
              : item.filename;
          db.prepare(
            "UPDATE album_photos SET filename=?,caption=?,collection_id=?,deleted_at=? WHERE id=?",
          ).run(
            filename,
            v.caption ?? item.caption,
            v.destinationId || album.id,
            v.deleted === undefined
              ? item.deleted_at
              : v.deleted
                ? now()
                : null,
            itemId,
          );
        } else if (v.deleted || v.destinationId) {
          if (v.destinationId)
            db.prepare(
              "INSERT OR IGNORE INTO collection_photos VALUES (?,?)",
            ).run(v.destinationId, itemId);
          if (v.deleted || v.destinationId !== album.id)
            db.prepare(
              "DELETE FROM collection_photos WHERE collection_id=? AND photo_id=?",
            ).run(album.id, itemId);
        }
      });
      audit(db, req.user, "album_media_updated", {
        albumId: album.id,
        id: itemId,
        ...v,
      });
      return { ok: true };
    },
  );
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
