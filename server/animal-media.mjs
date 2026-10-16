import { z } from "zod";
import path from "node:path";
import { id, now, audit, transaction } from "./db.mjs";
import { rangeReply } from "./video.mjs";
import { showTimeline } from "../shared/signage.mjs";
const uuid = z.string().uuid(),
  all = ["admin", "editor", "agent", "viewer"];
const fail = (message, statusCode = 404) =>
  Object.assign(new Error(message), { statusCode });
export function mediaTags(db, kind, value) {
  return db
    .prepare(
      "SELECT tag FROM media_tags WHERE kind=? AND media_id=? ORDER BY tag",
    )
    .all(kind, value)
    .map((r) => r.tag);
}
export function matchingTag(db, kind, value, tags) {
  return (
    !tags.length ||
    mediaTags(db, kind, value).some((t) =>
      tags.some((q) => q.toLocaleLowerCase("fr") === t.toLocaleLowerCase("fr")),
    )
  );
}
export async function registerAnimalMedia(app, { db, c, authorized }) {
  const animal = (v) => {
    const a = db
      .prepare("SELECT id FROM animals WHERE id=?")
      .get(uuid.parse(v));
    if (!a) throw fail("Animal introuvable.");
    return a;
  };
  const media = (kind, value) => {
    if (!["photo", "video"].includes(kind)) throw fail("Type invalide.", 400);
    const row = db
      .prepare(
        kind === "photo"
          ? "SELECT id FROM photos WHERE id=?"
          : "SELECT id FROM video_assets WHERE id=? AND kind='video'",
      )
      .get(uuid.parse(value));
    if (!row) throw fail("Média introuvable.");
    return row;
  };
  app.get("/api/media-tags", { preHandler: authorized(all) }, async () =>
    db
      .prepare(
        "SELECT tag,COUNT(*) AS count FROM media_tags GROUP BY tag ORDER BY tag COLLATE NOCASE",
      )
      .all(),
  );
  app.get(
    "/api/media-tags/:kind/:id",
    { preHandler: authorized(all) },
    async (req) => {
      media(req.params.kind, req.params.id);
      return { tags: mediaTags(db, req.params.kind, req.params.id) };
    },
  );
  app.put(
    "/api/media-tags/:kind/:id",
    { preHandler: authorized() },
    async (req) => {
      const { kind, id: value } = req.params;
      media(kind, value);
      const { tags } = z
        .object({ tags: z.array(z.string().trim().min(1).max(40)).max(20) })
        .parse(req.body);
      const cleaned = [
        ...new Map(tags.map((t) => [t.toLocaleLowerCase("fr"), t])).values(),
      ];
      transaction(db, () => {
        db.prepare("DELETE FROM media_tags WHERE kind=? AND media_id=?").run(
          kind,
          value,
        );
        for (const tag of cleaned)
          db.prepare("INSERT INTO media_tags VALUES (?,?,?)").run(
            kind,
            value,
            tag,
          );
      });
      audit(db, req.user, "media_tagged", { kind, id: value, tags: cleaned });
      return { tags: cleaned };
    },
  );
  const list = (v) =>
    db
      .prepare(
        "SELECT av.*,v.filename,v.duration,b.width,b.height,b.size,b.mime FROM animal_videos av JOIN video_assets v ON v.id=av.asset_id JOIN blobs b ON b.hash=v.hash WHERE av.animal_id=? ORDER BY av.created_at,av.id",
      )
      .all(v)
      .map((v) => ({
        ...v,
        show_on_tv: !!v.show_on_tv,
        tags: mediaTags(db, "video", v.asset_id),
        src: `/api/video/assets/${v.asset_id}/file`,
      }));
  app.get(
    "/api/animals/:id/videos",
    { preHandler: authorized(all) },
    async (req) => {
      animal(req.params.id);
      return { items: list(req.params.id) };
    },
  );
  app.post(
    "/api/animals/:id/videos",
    { preHandler: authorized() },
    async (req) => {
      animal(req.params.id);
      const v = z
        .object({
          assetId: uuid,
          caption: z.string().trim().max(200).default(""),
        })
        .parse(req.body);
      media("video", v.assetId);
      db.prepare(
        "INSERT OR IGNORE INTO animal_videos VALUES (?,?,?,?,0,?)",
      ).run(id(), req.params.id, v.assetId, v.caption, now());
      audit(db, req.user, "animal_video_attached", {
        animalId: req.params.id,
        assetId: v.assetId,
      });
      return { items: list(req.params.id) };
    },
  );
  app.patch(
    "/api/animal-videos/:id",
    { preHandler: authorized() },
    async (req) => {
      const v = z
        .object({ caption: z.string().trim().max(200), showOnTv: z.boolean() })
        .parse(req.body);
      const r = db
        .prepare("UPDATE animal_videos SET caption=?,show_on_tv=? WHERE id=?")
        .run(v.caption, +v.showOnTv, uuid.parse(req.params.id));
      if (!r.changes) throw fail("Vidéo introuvable.");
      audit(db, req.user, "animal_video_updated", { id: req.params.id, ...v });
      return { ok: true };
    },
  );
  app.delete(
    "/api/animal-videos/:id",
    { preHandler: authorized() },
    async (req) => {
      db.prepare("DELETE FROM animal_videos WHERE id=?").run(
        uuid.parse(req.params.id),
      );
      audit(db, req.user, "animal_video_detached", { id: req.params.id });
      return { ok: true };
    },
  );
  // TV authorization is evaluated on every request, including byte-range requests.
  app.get("/api/public/animal-videos/:id/file", async (req, reply) => {
    const { buildDisplay } = await import("./refuge-display.mjs");
    const show = await buildDisplay(db);
    if (!show.enabled) throw fail("Vidéo indisponible.");
    const videoId = uuid.parse(req.params.id);
    const video = showTimeline(show).scenes.find(
      (scene) =>
        scene.type === "animal" &&
        scene.media?.kind === "video" &&
        scene.media.id === videoId,
    )?.media;
    if (!video) throw fail("Vidéo indisponible.");
    const row = db
      .prepare(
        "SELECT b.hash,b.mime FROM animal_videos av JOIN video_assets v ON v.id=av.asset_id JOIN blobs b ON b.hash=v.hash WHERE av.id=?",
      )
      .get(video.id);
    reply.header("Cache-Control", "private, no-store");
    return rangeReply(req, reply, path.join(c.mediaDir, row.hash), row.mime);
  });
}
