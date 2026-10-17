import { Worker } from "node:worker_threads";
import path from "node:path";
import { Readable } from "node:stream";
import sharp from "sharp";
import { z } from "zod";
import { createHash } from "node:crypto";
import {
  photoReference,
  creativeSource,
  creativeError,
  creators,
} from "./creative-sources.mjs";
import { photoQuality } from "./photo-quality.mjs";
import { fingerprint, hamming } from "./similar-photos.mjs";
import { audit, now } from "./db.mjs";
import { ingest } from "./storage.mjs";

const decision = z.enum(["keep", "maybe", "reject", "clear"]);
const renderOptions = z
  .object({
    feather: z.number().min(0).max(3).default(0.4),
    shrink: z.number().int().min(0).max(3).default(0),
    background: z
      .union([z.literal("transparent"), z.string().regex(/^#[a-fA-F0-9]{6}$/)])
      .default("transparent"),
  })
  .strict();
export async function renderCutout(buffer, input = {}) {
  const o = renderOptions.parse(input),
    source = sharp(buffer, { limitInputPixels: 5e6 });
  const { data, info } = await source
    .clone()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let mask = source.clone().extractChannel(3);
  if (o.shrink) mask = mask.erode(o.shrink);
  if (o.feather) mask = mask.blur(Math.max(0.3, o.feather));
  const alpha = await mask.raw().toBuffer();
  for (let i = 0; i < alpha.length; i++) data[i * 4 + 3] = alpha[i];
  let result = sharp(data, { raw: info });
  if (o.background !== "transparent")
    result = result.flatten({ background: o.background });
  return result.png().toBuffer();
}
export async function registerPhotoWorkshop(app, { db, c, authorized, jobs }) {
  app.get(
    "/api/creative/photos",
    { preHandler: authorized(creators) },
    async (req) => {
      const animalId = req.query.animalId
        ? z.string().uuid().parse(req.query.animalId)
        : null;
      if (animalId) {
        const a = db
          .prepare("SELECT id,name,source_metadata FROM animals WHERE id=?")
          .get(animalId);
        if (!a) throw creativeError("Animal introuvable.", 404);
        const photos = db
          .prepare(
            "SELECT id,filename,hidden FROM photos WHERE animal_id=? AND archived_at IS NULL AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 60",
          )
          .all(a.id)
          .map((p) => ({
            ref: { kind: "local", id: p.id },
            label: p.filename,
            private: !!p.hidden,
            preview: `/media/${p.id}?w=640`,
          }));
        if (JSON.parse(a.source_metadata || "{}").thumbnail)
          photos.unshift({
            ref: { kind: "spa", id: a.id },
            label: `${a.name} · Site SPA`,
            preview: `/api/animals/${a.id}/source-photo?w=640`,
          });
        return photos;
      }
      return db
        .prepare(
          "SELECT id,filename,folder FROM inbox_photos WHERE archived_at IS NULL ORDER BY created_at DESC LIMIT 60",
        )
        .all()
        .map((p) => ({
          ref: { kind: "inbox", id: p.id },
          label: p.filename,
          folder: p.folder,
          preview: `/api/inbox/${p.id}/preview`,
        }));
    },
  );
  app.post(
    "/api/creative/review",
    { preHandler: authorized(creators) },
    async (req, reply) => {
      const refs = z
        .object({ photos: z.array(photoReference).min(1).max(30) })
        .strict()
        .parse(req.body).photos;
      const unique = [
        ...new Map(refs.map((r) => [`${r.kind}:${r.id}`, r])).values(),
      ];
      return reply.code(202).send(
        jobs.start(req.user, "review", unique.length, async (j) => {
          const results = [];
          for (const ref of unique) {
            j.stage = `Analyse ${j.done + 1} / ${j.total}`;
            try {
              const source = await creativeSource(db, c, ref),
                signature = createHash("sha256")
                  .update(source.buffer)
                  .digest("hex"),
                key = `${ref.kind}:${ref.id}`;
              const quality = await photoQuality(source.buffer),
                fp = await fingerprint(source.buffer);
              const saved = db
                .prepare(
                  "SELECT decision,reviewed_at FROM photo_reviews WHERE reference=? AND signature=?",
                )
                .get(key, signature);
              results.push({
                ref,
                key,
                signature,
                name: source.name,
                preview: source.preview,
                quality,
                fp,
                decision: saved?.decision || "",
                reviewedAt: saved?.reviewed_at,
              });
            } catch {
              j.errors.push({
                ref,
                message: "Photo indisponible : réessayez après son chargement.",
              });
            }
            j.done++;
          }
          if (!results.length)
            throw creativeError(
              "Aucune photo n’a pu être chargée. Vérifiez le stockage ou la connexion SPA.",
              422,
            );
          j.result = results
            .sort((a, b) => b.quality.score - a.quality.score)
            .map(({ fp, ...r }) => ({
              ...r,
              similar: results
                .filter((x) => x.key !== r.key && hamming(fp, x.fp) <= 5)
                .map((x) => x.key),
            }));
          audit(db, req.user, "photo_reviewed", {
            count: results.length,
            spa: results.filter((r) => r.ref.kind === "spa").length,
          });
        }),
      );
    },
  );
  app.put(
    "/api/creative/review",
    { preHandler: authorized(creators) },
    async (req) => {
      const o = z
          .object({
            ref: photoReference,
            signature: z.string().regex(/^[a-f0-9]{64}$/),
            decision,
          })
          .strict()
          .parse(req.body),
        reference = `${o.ref.kind}:${o.ref.id}`;
      // A choice must refer to a photo actually analysed by this account, not an arbitrary UUID.
      const job = jobs.read({
        params: { id: z.string().uuid().parse(req.query.job) },
        user: req.user,
      });
      if (
        job.kind !== "review" ||
        job.state !== "done" ||
        !job.result.some(
          (r) => r.key === reference && r.signature === o.signature,
        )
      )
        throw creativeError("Relancez l’analyse de cette photo.", 409);
      if (o.decision === "clear")
        db.prepare("DELETE FROM photo_reviews WHERE reference=?").run(
          reference,
        );
      else
        db.prepare(
          "INSERT INTO photo_reviews(reference,signature,decision,user_id,reviewed_at) VALUES (?,?,?,?,?) ON CONFLICT(reference) DO UPDATE SET signature=excluded.signature,decision=excluded.decision,user_id=excluded.user_id,reviewed_at=excluded.reviewed_at",
        ).run(reference, o.signature, o.decision, req.user.id, now());
      return { ok: true };
    },
  );
  let cutting = false;
  app.post(
    "/api/creative/cutouts",
    {
      preHandler: authorized(creators),
      config: { rateLimit: { max: 6, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const ref = photoReference.parse(req.body);
      if (
        !c.cutoutProcessor &&
        (c.cutoutAvailableMemory?.() ?? process.availableMemory()) <
          3 * 1024 ** 3
      )
        throw creativeError(
          "Mémoire insuffisante pour le détourage. Prévoyez au moins 3 Gio disponibles et environ 4 Go de RAM alloués au conteneur. Les autres outils restent utilisables.",
          422,
        );
      if (cutting)
        throw creativeError("Un détourage est en cours. Attendez sa fin.", 429);
      cutting = true;
      try {
        return reply.code(202).send(
          jobs.start(req.user, "cutout", 1, async (j) => {
            try {
              const source = await creativeSource(db, c, ref);
              j.stage = "Chargement du moteur local…";
              j.binary = c.cutoutProcessor
                ? await c.cutoutProcessor(source.buffer, j)
                : await new Promise((resolve, reject) => {
                    const worker = new Worker(
                      new URL("./cutout-worker.mjs", import.meta.url),
                      {
                        workerData: {
                          image: source.buffer,
                          cacheDir: path.join(c.cacheDir, "cutout-model"),
                        },
                      },
                    );
                    let settled = false;
                    const finish = (error, bytes) => {
                      if (settled) return;
                      settled = true;
                      clearTimeout(timer);
                      worker.terminate();
                      error ? reject(error) : resolve(Buffer.from(bytes));
                    };
                    const timer = setTimeout(
                      () =>
                        finish(
                          creativeError(
                            "Le détourage a dépassé 10 minutes. Vérifiez la connexion et la mémoire du serveur.",
                            422,
                          ),
                        ),
                      600_000,
                    );
                    worker.on("message", (m) => {
                      if (m.result) finish(null, m.result);
                      else if (m.error) finish(creativeError(m.error, 422));
                      else {
                        j.stage = m.stage;
                        j.progress = m.progress;
                      }
                    });
                    worker.on("error", () =>
                      finish(
                        creativeError(
                          "Le moteur local n’a pas pu démarrer. Vérifiez son installation et la mémoire du serveur.",
                          422,
                        ),
                      ),
                    );
                    worker.on("exit", () => {
                      if (!settled)
                        finish(
                          creativeError(
                            "Le moteur local s’est interrompu. Vérifiez la mémoire du serveur.",
                            422,
                          ),
                        );
                    });
                  });
              const meta = await sharp(j.binary).metadata();
              if (!meta.hasAlpha)
                throw creativeError(
                  "Le moteur n’a pas produit de transparence.",
                  422,
                );
              j.done = 1;
              j.result = {
                name: source.name,
                width: meta.width,
                height: meta.height,
                ref,
              };
              audit(db, req.user, "animal_cutout", {
                kind: ref.kind,
                sourceId: ref.id,
              });
            } finally {
              cutting = false;
            }
          }),
        );
      } catch (e) {
        cutting = false;
        throw e;
      }
    },
  );
  function cutout(req) {
    const j = jobs.read(req);
    if (j.kind !== "cutout" || j.state !== "done" || !j.binary)
      throw creativeError("Le détourage n’est pas encore prêt.", 409);
    return j;
  }
  app.post(
    "/api/creative/cutouts/:id/render",
    { preHandler: authorized(creators) },
    async (req, reply) => {
      const j = cutout(req),
        png = await renderCutout(j.binary, req.body || {});
      return reply
        .header("Cache-Control", "private, no-store")
        .type("image/png")
        .send(png);
    },
  );
  app.post(
    "/api/creative/cutouts/:id/save",
    { preHandler: authorized(creators) },
    async (req, reply) => {
      const j = cutout(req),
        png = await renderCutout(j.binary, req.body || {});
      const result = await ingest(
        db,
        c,
        null,
        Readable.from(png),
        `${j.result.name.slice(0, 90)}-detourage.png`,
        false,
        null,
        { folder: "Détourages", userId: req.user.id },
      );
      audit(db, req.user, "cutout_saved", { inboxId: result.id });
      return reply.code(201).send(result);
    },
  );
}
