import { showTimeline } from "../shared/signage.mjs";
import { z } from "zod";
import path from "node:path";
import { id, now, audit } from "./db.mjs";
import { parseShow } from "./signage-schema.mjs";
import { buildDisplay } from "./refuge-display.mjs";
import { renderComposition, rangeReply } from "./video.mjs";
import { sourcePhotoBuffer } from "./source-photo.mjs";
const all = ["admin", "editor", "agent", "viewer"],
  uuid = z.string().uuid();
const fail = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });
const parse = (body) => {
  const v = z
    .object({
      program: z.record(z.string(), z.unknown()),
      hiddenIds: z.array(uuid).max(2000).default([]),
      title: z.string().trim().max(80).default("Film du refuge"),
    })
    .parse(body);
  return { ...v, program: parseShow(v.program) };
};
export async function motionShow(db, input, options = {}) {
  const show = await buildDisplay(
    db,
    {
      displayProgram: input.program,
      displayHiddenIds: input.hiddenIds,
      displayQr: input.program.showQr,
    },
    { force: true, exporting: true, ...options },
  );
  if (
    !show.items.length &&
    !showTimeline(show).scenes.some(
      (s) => s.type === "message" || s.type === "video",
    )
  )
    throw fail(
      "Choisissez au moins un animal avec une photo publique locale ou une vidéo autorisée sur la TV.",
    );
  if (show.duration > 600)
    throw fail(
      `Programme de ${Math.ceil(show.duration / 60)} min : réduisez la sélection ou les durées pour exporter (10 min maximum).`,
    );
  return show;
}
export async function renderMotion(db, c, input, options = {}) {
  return renderComposition(
    db,
    c,
    "RefugeShow",
    async (assetURL) => {
      const show = await motionShow(db, input, { assetURL });
      for (const animal of show.items)
        for (const media of animal.media)
          if (media.source) {
            try {
              media.src = `data:image/webp;base64,${(await sourcePhotoBuffer(db, c, animal.id)).toString("base64")}`;
              animal.photo = media.src;
            } catch {
              throw fail(
                `Photo SPA de ${animal.name} indisponible : retirez cet animal ou réessayez.`,
              );
            }
          }
      return { show };
    },
    options,
  );
}
export async function registerMotion(app, { db, c, authorized, job }) {
  const cancels = new Map();
  db.prepare(
    "UPDATE motion_exports SET state='failed',error='Rendu interrompu. Relancez un export.',finished_at=? WHERE state='running'",
  ).run(now());
  app.post(
    "/api/motion/preview",
    { preHandler: authorized(all) },
    async (req) => motionShow(db, parse(req.body)),
  );
  app.get("/api/motion/exports", { preHandler: authorized(all) }, async () =>
    db
      .prepare(
        "SELECT m.id,m.title,m.state,m.error,m.created_at,m.finished_at,b.size,j.detail progress FROM motion_exports m LEFT JOIN blobs b ON b.hash=m.hash LEFT JOIN jobs j ON j.id=m.job_id ORDER BY m.created_at DESC LIMIT 50",
      )
      .all(),
  );
  app.post(
    "/api/motion/render",
    {
      preHandler: authorized(),
      config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
    },
    async (req) => {
      if (process.env.VIDEO_RENDER_ENABLED === "false")
        throw fail("Le rendu vidéo est désactivé sur ce serveur.", 503);
      const input = parse(req.body);
      await motionShow(db, input);
      const { makeCancelSignal } = await import("@remotion/renderer"),
        signal = makeCancelSignal(),
        renderId = id();
      let jobId;
      const result = await job("video_render", req.user, async () => {
        db.prepare(
          "INSERT INTO motion_exports(id,title,config,created_by,job_id,state,created_at) VALUES (?,?,?,?,?,'running',?)",
        ).run(
          renderId,
          input.title,
          JSON.stringify(input),
          req.user.id,
          jobId,
          now(),
        );
        const timer = setTimeout(signal.cancel, 30 * 60_000);
        cancels.set(renderId, signal.cancel);
        try {
          let last = 0;
          const output = await renderMotion(db, c, input, {
            cancelSignal: signal.cancelSignal,
            onProgress: (v) => {
              if (Date.now() - last > 1000) {
                last = Date.now();
                db.prepare("UPDATE jobs SET detail=? WHERE id=?").run(
                  JSON.stringify({ progress: Math.round(v.progress * 100) }),
                  jobId,
                );
              }
            },
          });
          db.prepare(
            "UPDATE motion_exports SET state='done',hash=?,finished_at=? WHERE id=?",
          ).run(output.hash, now(), renderId);
          return { ...output, renderId };
        } catch (e) {
          db.prepare(
            "UPDATE motion_exports SET state='failed',error=?,finished_at=? WHERE id=?",
          ).run(e.message.slice(0, 500), now(), renderId);
          throw e;
        } finally {
          clearTimeout(timer);
          cancels.delete(renderId);
        }
      });
      jobId = result.id;
      return { ...result, renderId };
    },
  );
  app.post(
    "/api/motion/exports/:id/cancel",
    { preHandler: authorized() },
    async (req) => {
      cancels.get(uuid.parse(req.params.id))?.();
      return { ok: true };
    },
  );
  app.delete(
    "/api/motion/exports/:id",
    { preHandler: authorized() },
    async (req) => {
      const v = uuid.parse(req.params.id);
      const r = db
        .prepare("SELECT state FROM motion_exports WHERE id=?")
        .get(v);
      if (r?.state === "running")
        throw fail("Annulez le rendu avant de le retirer.", 409);
      db.prepare("UPDATE motion_exports SET state='removed' WHERE id=?").run(v);
      audit(db, req.user, "motion_export_removed", { id: v });
      return { ok: true };
    },
  );
  app.post(
    "/api/motion/exports/:id/restore",
    { preHandler: authorized() },
    async (req) => {
      const v = uuid.parse(req.params.id);
      db.prepare(
        "UPDATE motion_exports SET state=CASE WHEN hash IS NULL THEN 'failed' ELSE 'done' END WHERE id=? AND state='removed'",
      ).run(v);
      audit(db, req.user, "motion_export_restored", { id: v });
      return { ok: true };
    },
  );
  app.get(
    "/api/motion/exports/:id/file",
    { preHandler: authorized(all) },
    async (req, reply) => {
      const row = db
        .prepare(
          "SELECT m.hash,b.mime FROM motion_exports m JOIN blobs b ON b.hash=m.hash WHERE m.id=? AND m.state='done'",
        )
        .get(uuid.parse(req.params.id));
      if (!row) throw fail("Export introuvable.", 404);
      reply.header("Cache-Control", "private, no-store");
      if (req.query.download === "1")
        reply.header(
          "Content-Disposition",
          `attachment; filename="anipic-${req.params.id}.mp4"`,
        );
      return rangeReply(req, reply, path.join(c.mediaDir, row.hash), row.mime);
    },
  );
  app.addHook("preClose", async () => {
    for (const cancel of cancels.values()) cancel();
  });
}
