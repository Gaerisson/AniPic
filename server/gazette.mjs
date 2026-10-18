import { z } from "zod";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import yazl from "yazl";
import { publicAsset } from "./public-assets.mjs";
import { now, audit, settings } from "./db.mjs";
import {
  animalReference,
  creativeSource,
  creativeError,
  creators,
} from "./creative-sources.mjs";
import {
  gazetteOptions,
  gazetteMonth,
  gazetteAnimalBrief,
  resolveGazetteContent,
} from "./gazette-data.mjs";
import { gazettePages, gazetteSocial } from "./gazette-render.mjs";
import { gazetteSourceRevision } from "../shared/gazette-content.mjs";
export { gazetteOptions, gazetteMonth, gazettePages };

export async function registerGazette(app, { db, c, authorized, jobs }) {
  const access = { preHandler: authorized(creators) };
  app.get("/api/creative/gazette/catalogue", access, async (req) => {
    const q = z
      .object({
        q: z.string().max(100).default(""),
        ids: z.string().max(12000).optional(),
      })
      .parse(req.query);
    let rows;
    if (q.ids !== undefined) {
      const ids = z
        .array(z.string().uuid())
        .max(60)
        .parse(q.ids ? q.ids.split(",") : []);
      rows = ids.length
        ? db
            .prepare(
              `SELECT * FROM animals WHERE id IN (${ids.map(() => "?").join(",")})`,
            )
            .all(...ids)
        : [];
    } else
      rows = db
        .prepare(
          "SELECT * FROM animals WHERE name LIKE ? OR source_id LIKE ? ORDER BY name LIMIT 60",
        )
        .all("%" + q.q + "%", "%" + q.q + "%");
    return { items: rows.map((a) => gazetteAnimalBrief(db, a)) };
  });
  app.get("/api/creative/gazette/month", access, async (req) =>
    gazetteMonth(db, gazetteOptions.shape.month.parse(req.query.month)),
  );
  app.get("/api/creative/gazette/drafts", access, async () =>
    db
      .prepare(
        "SELECT d.*,u.name AS updated_by_name FROM gazette_drafts d LEFT JOIN users u ON u.id=d.updated_by ORDER BY updated_at DESC LIMIT 100",
      )
      .all()
      .map((d) => {
        const config = gazetteOptions.parse(JSON.parse(d.config));
        const ids = new Set([
          ...config.animals.map((a) => a.id),
          ...config.movements.map((a) => a.animalId),
        ]);
        return {
          ...d,
          config,
          animalNames: Object.fromEntries(
            [...ids].map((id) => [
              id,
              db.prepare("SELECT name FROM animals WHERE id=?").get(id)?.name ||
                "Animal retiré",
            ]),
          ),
        };
      }),
  );
  app.put("/api/creative/gazette/drafts/:id", access, async (req) => {
    const key = z.string().uuid().parse(req.params.id),
      o = gazetteOptions.parse(req.body);
    db.prepare(
      "INSERT INTO gazette_drafts VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,config=excluded.config,updated_by=excluded.updated_by,updated_at=excluded.updated_at",
    ).run(key, o.title, JSON.stringify(o), req.user.id, now());
    return { id: key };
  });
  app.delete("/api/creative/gazette/drafts/:id", access, async (req) => {
    db.prepare("DELETE FROM gazette_drafts WHERE id=?").run(
      z.string().uuid().parse(req.params.id),
    );
    return { ok: true };
  });
  let generating = false;
  app.post(
    "/api/creative/gazette",
    { ...access, bodyLimit: 600_000 },
    async (req, reply) => {
      const {
        options: o,
        snapshot,
        movements,
        arrivals,
        adopted,
        portraits: selectedPortraits,
        keyDates,
        summary,
      } = resolveGazetteContent(db, req.body);
      const edition = { ...o, introduction: summary, keyDates };
      if (generating)
        throw creativeError(
          "Une gazette est déjà en préparation. Attendez sa fin.",
          429,
        );
      generating = true;
      try {
        const result = jobs.start(
          req.user,
          "gazette",
          movements.length + selectedPortraits.length + 1,
          async (j) => {
            try {
              const portraits = [],
                pictures = new Map(),
                movementIds = new Set(movements.map((m) => m.animalId));
              const picture = async (a, source) => {
                const key = a.id + ":" + source;
                if (!pictures.has(key)) {
                  const s = await creativeSource(
                    db,
                    c,
                    animalReference(db, a, source),
                    { publicOnly: true },
                  );
                  const buffer = await sharp(s.buffer, {
                    limitInputPixels: 40e6,
                  })
                    .rotate()
                    .flatten({ background: "#fff" })
                    .resize(1200, 1200, {
                      fit: "inside",
                      withoutEnlargement: true,
                    })
                    .jpeg({ quality: 90 })
                    .toBuffer();
                  pictures.set(key, {
                    buffer,
                    originLabel:
                      s.ref.kind === "spa" ? "Site SPA" : "Photo équipe",
                  });
                }
                return pictures.get(key);
              };
              for (const m of movements) {
                const a = db
                  .prepare("SELECT * FROM animals WHERE id=?")
                  .get(m.animalId);
                if (!a)
                  throw creativeError(
                    "Un animal de l’édition a été retiré. Actualisez les mouvements.",
                    422,
                  );
                j.stage = `${m.kind === "adoption" ? "Adoption" : "Arrivée"} · ${a.name}`;
                let image = {};
                try {
                  image = await picture(a, m.source || "auto");
                } catch {
                  j.errors.push({
                    animalId: a.id,
                    name: a.name,
                    message:
                      "Photo indisponible : fiche sans portrait dans cette édition.",
                  });
                }
                portraits.push({
                  ...image,
                  section: m.kind,
                  name: a.name,
                  date: m.date,
                  note: m.note || "",
                  label: { dog: "Chien", cat: "Chat", other: "NAC" }[a.species],
                });
                j.done++;
              }
              for (const entry of [...selectedPortraits]) {
                if (movementIds.has(entry.id)) {
                  j.done++;
                  continue;
                }
                const a = db
                  .prepare("SELECT * FROM animals WHERE id=?")
                  .get(entry.id);
                if (!a)
                  throw creativeError(
                    "Un portrait sélectionné n’existe plus.",
                    422,
                  );
                j.stage = `Portrait de ${a.name}`;
                try {
                  portraits.push({
                    ...(await picture(a, entry.source)),
                    section: "spotlight",
                    name: a.name,
                    label:
                      { dog: "Chien", cat: "Chat", other: "NAC" }[a.species] +
                      " · " +
                      (a.status === "adopted"
                        ? "Adopté"
                        : a.archived_at
                          ? "Souvenir du refuge"
                          : a.status === "reserved"
                            ? "Réservé"
                            : a.status === "available"
                              ? "À rencontrer"
                              : "Statut à vérifier"),
                    description: String(a.description || "").replace(
                      /<[^>]*>/g,
                      "",
                    ),
                  });
                } catch {
                  if (!entry.automatic)
                    throw creativeError(
                      `Photo indisponible pour ${a.name}. Choisissez une autre source ou retirez ce portrait à la une.`,
                      422,
                    );
                  j.errors.push({
                    animalId: a.id,
                    name: a.name,
                    message:
                      "Photo indisponible : portrait automatique sans image.",
                  });
                  portraits.push({
                    section: "spotlight",
                    name: a.name,
                    label: { dog: "Chien", cat: "Chat", other: "NAC" }[
                      a.species
                    ],
                  });
                }
                j.done++;
              }
              j.stage = "Mise en page et préparation des exports…";
              const logo = await publicAsset("spa-logo.png"),
                refuge = settings(db).refugeName,
                stats = { ...snapshot, arrivals, adopted };
              const pages = await gazettePages(
                  c,
                  edition,
                  stats,
                  portraits,
                  refuge,
                  logo,
                ),
                pdf = await PDFDocument.create();
              pdf.setTitle(o.title);
              pdf.setAuthor("Gaerisson");
              pdf.setCreator("AniPic");
              j.assets = {};
              j.pages = [];
              for (let i = 0; i < pages.length; i++) {
                const jpeg = await sharp(pages[i])
                  .jpeg({ quality: 92 })
                  .toBuffer();
                j.assets[`page-${i}`] = jpeg;
                const image = await pdf.embedJpg(jpeg);
                pdf.addPage([595.276, 841.89]).drawImage(image, {
                  x: 0,
                  y: 0,
                  width: 595.276,
                  height: 841.89,
                });
                j.pages.push(
                  await sharp(pages[i])
                    .resize(820)
                    .webp({ quality: 82 })
                    .toBuffer(),
                );
              }
              j.binary = Buffer.from(await pdf.save());
              j.assets.social = await gazetteSocial(
                edition,
                stats,
                portraits,
                refuge,
                logo,
              );
              j.done = j.total;
              j.result = {
                pages: pages.length,
                month: o.month,
                title: o.title,
                config: o,
                sourceRevision: gazetteSourceRevision(snapshot),
                arrivals: arrivals.length,
                adoptions: adopted.length,
                keyDates: keyDates.length,
                summary,
                portraits: selectedPortraits.length,
                caption: `${o.title} · ${o.month}\n${arrivals.length} arrivée(s), ${adopted.length} adoption(s).\n${o.signature}`,
                formats: {
                  social: { width: 1080, height: 1350, type: "image/png" },
                  pages: "image/jpeg",
                  document: "application/pdf",
                },
              };
              audit(db, req.user, "gazette_exported", {
                month: o.month,
                pages: pages.length,
                arrivals: arrivals.length,
                adoptions: adopted.length,
                keyDates: keyDates.length,
                warnings: j.errors.length,
              });
            } finally {
              generating = false;
            }
          },
        );
        return reply.code(202).send(result);
      } catch (e) {
        generating = false;
        throw e;
      }
    },
  );
  const ready = (req) => {
    const j = jobs.read(req);
    if (j.kind !== "gazette" || j.state !== "done")
      throw creativeError("La gazette n’est pas encore prête.", 409);
    return j;
  };
  const downloadable = (reply, type, name) =>
    reply
      .header("Cache-Control", "private, no-store")
      .header("Content-Disposition", `attachment; filename="${name}"`)
      .type(type);
  app.get("/api/creative/gazette/:id/file", access, async (req, reply) => {
    const j = ready(req);
    return downloadable(
      reply,
      "application/pdf",
      `gazette-${j.result.month}.pdf`,
    ).send(j.binary);
  });
  app.get(
    "/api/creative/gazette/:id/page/:page",
    access,
    async (req, reply) => {
      const j = ready(req),
        index = z.coerce.number().int().min(0).max(100).parse(req.params.page);
      if (!j.pages[index]) throw creativeError("Page indisponible.", 404);
      return reply
        .header("Cache-Control", "private, no-store")
        .type("image/webp")
        .send(j.pages[index]);
    },
  );
  app.get("/api/creative/gazette/:id/social", access, async (req, reply) => {
    const j = ready(req);
    return downloadable(
      reply,
      "image/png",
      `gazette-${j.result.month}-reseaux.png`,
    ).send(j.assets.social);
  });
  app.get(
    "/api/creative/gazette/:id/image/:page",
    access,
    async (req, reply) => {
      const j = ready(req),
        i = z.coerce.number().int().min(0).max(100).parse(req.params.page),
        image = j.assets[`page-${i}`];
      if (!image) throw creativeError("Page indisponible.", 404);
      return downloadable(
        reply,
        "image/jpeg",
        `gazette-${j.result.month}-page-${i + 1}.jpg`,
      ).send(image);
    },
  );
  app.get("/api/creative/gazette/:id/images", access, async (req, reply) => {
    const j = ready(req),
      zip = new yazl.ZipFile();
    for (let i = 0; i < j.result.pages; i++)
      zip.addBuffer(
        j.assets[`page-${i}`],
        `gazette-${j.result.month}-page-${String(i + 1).padStart(2, "0")}.jpg`,
      );
    zip.addBuffer(j.assets.social, `gazette-${j.result.month}-reseaux.png`);
    zip.end();
    return downloadable(
      reply,
      "application/zip",
      `gazette-${j.result.month}-images.zip`,
    ).send(zip.outputStream);
  });
}
