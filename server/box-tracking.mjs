import { z } from "zod";
import { id, now, audit } from "./db.mjs";
import {
  animalReference,
  photoReference,
  creators,
  creativeError,
} from "./creative-sources.mjs";
import { publicCompatibility, publicSpaImage } from "./animal-facts.mjs";

const state = z.enum(["printed", "installed", "removed"]);
const stable = (value) =>
  JSON.stringify(
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => [k, JSON.parse(stable(v))]),
        )
      : (value ?? null),
  );
export function posterSnapshot(db, animal, ref) {
  if (
    ref.kind === "spa" &&
    !publicSpaImage(JSON.parse(animal.source_metadata || "{}").thumbnail)
  )
    throw creativeError(
      "La photo du site SPA est indisponible. Choisissez une photo publique avant d’enregistrer cette affiche.",
      400,
    );
  const local =
    ref.kind === "local"
      ? db
          .prepare(
            "SELECT hash,deleted_at,archived_at,hidden FROM photos WHERE id=? AND animal_id=?",
          )
          .get(ref.id, animal.id)
      : null;
  if (
    ref.kind === "inbox" ||
    (ref.kind === "spa" && ref.id !== animal.id) ||
    (ref.kind === "local" &&
      (!local || local.deleted_at || local.archived_at || local.hidden))
  )
    throw creativeError("Choisissez une photo publique de cet animal.", 400);
  const latest =
    db
      .prepare(
        "SELECT id FROM photos WHERE animal_id=? AND hidden=0 AND archived_at IS NULL AND deleted_at IS NULL ORDER BY created_at DESC,id DESC LIMIT 1",
      )
      .get(animal.id)?.id || "";
  return {
    identity: stable([
      animal.name,
      animal.sex,
      animal.birth_date,
      animal.breed,
      animal.description,
    ]),
    status: stable([animal.status, animal.archived_at]),
    compatibility: stable(
      publicCompatibility(JSON.parse(animal.compatibility || "{}")),
    ),
    photo: stable([
      animal.cover_id,
      latest,
      ref,
      local?.hash || JSON.parse(animal.source_metadata || "{}").thumbnail || "",
    ]),
  };
}
export async function registerBoxTracking(app, { db, authorized }) {
  const getAnimal = (value) => {
    const animal = db
      .prepare("SELECT * FROM animals WHERE id=?")
      .get(z.string().uuid().parse(value));
    if (!animal) throw creativeError("Animal introuvable.", 404);
    return animal;
  };
  app.get(
    "/api/creative/box-posters",
    { preHandler: authorized([...creators, "viewer"]) },
    async (req) => {
      const animalId = req.query.animalId
        ? z.string().uuid().parse(req.query.animalId)
        : null;
      const rows = db
        .prepare(
          `SELECT p.*,a.name,a.species,u.name AS updated_by_name FROM box_posters p JOIN animals a ON a.id=p.animal_id LEFT JOIN users u ON u.id=p.updated_by ${animalId ? "WHERE p.animal_id=?" : ""} ORDER BY p.updated_at DESC LIMIT 1000`,
        )
        .all(...(animalId ? [animalId] : []));
      return rows.map((row) => {
        let reasons = [];
        try {
          const current = posterSnapshot(
              db,
              getAnimal(row.animal_id),
              JSON.parse(row.photo_reference),
            ),
            previous = JSON.parse(row.snapshot);
          reasons = Object.entries({
            status: "Statut ou archivage",
            photo: "Photo",
            compatibility: "Ententes",
            identity: "Informations de la fiche",
          })
            .filter(([key]) => current[key] !== previous[key])
            .map(([, label]) => label);
        } catch {
          reasons = ["Photo retirée ou devenue privée"];
        }
        const ref = JSON.parse(row.photo_reference);
        return {
          ...row,
          snapshot: undefined,
          photo_reference: ref,
          current_reference: animalReference(db, getAnimal(row.animal_id)),
          preview:
            ref.kind === "spa"
              ? `/api/animals/${row.animal_id}/source-photo?w=320`
              : `/media/${ref.id}?w=320`,
          stale: row.state !== "removed" && reasons.length > 0,
          reasons,
        };
      });
    },
  );
  app.post(
    "/api/creative/box-posters",
    { preHandler: authorized(creators) },
    async (req, reply) => {
      const o = z
        .object({
          animalId: z.string().uuid(),
          location: z.string().trim().min(1).max(100),
          state: state.default("printed"),
          ref: photoReference.optional(),
          note: z.string().trim().max(500).default(""),
        })
        .strict()
        .parse(req.body);
      const animal = getAnimal(o.animalId),
        ref = o.ref || animalReference(db, animal),
        at = now(),
        key = id();
      const snapshot = posterSnapshot(db, animal, ref);
      db.prepare(
        "INSERT INTO box_posters(id,animal_id,location,state,photo_reference,snapshot,note,printed_at,installed_at,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      ).run(
        key,
        animal.id,
        o.location,
        o.state,
        JSON.stringify(ref),
        JSON.stringify(snapshot),
        o.note,
        o.state !== "removed" ? at : null,
        o.state === "installed" ? at : null,
        req.user.id,
        at,
      );
      audit(db, req.user, "box_poster_recorded", {
        id: key,
        animalId: animal.id,
        state: o.state,
        location: o.location,
      });
      return reply.code(201).send({ id: key });
    },
  );
  app.patch(
    "/api/creative/box-posters/:id",
    { preHandler: authorized(creators) },
    async (req) => {
      const key = z.string().uuid().parse(req.params.id),
        row = db.prepare("SELECT * FROM box_posters WHERE id=?").get(key);
      if (!row) throw creativeError("Affiche introuvable.", 404);
      const o = z
        .object({
          state: state.optional(),
          location: z.string().trim().min(1).max(100).optional(),
          note: z.string().trim().max(500).optional(),
          renew: z.boolean().default(false),
          ref: photoReference.optional(),
          revision: z.string().min(1).max(40),
        })
        .strict()
        .parse(req.body);
      const animal = getAnimal(row.animal_id),
        target = o.state || row.state,
        ref = o.ref || JSON.parse(row.photo_reference);
      if (o.ref && !o.renew)
        throw creativeError(
          "Confirmez le remplacement de l’affiche pour changer sa photo.",
        );
      const snapshot = o.renew
        ? JSON.stringify(posterSnapshot(db, animal, ref))
        : row.snapshot;
      const at = new Date(
        Math.max(Date.now(), Date.parse(row.updated_at) + 1),
      ).toISOString();
      const r = db
        .prepare(
          "UPDATE box_posters SET state=?,location=?,note=?,snapshot=?,photo_reference=?,printed_at=?,installed_at=?,updated_by=?,updated_at=? WHERE id=? AND updated_at=?",
        )
        .run(
          target,
          o.location ?? row.location,
          o.note ?? row.note,
          snapshot,
          JSON.stringify(ref),
          o.renew ? at : row.printed_at,
          target === "installed" && (row.state !== "installed" || o.renew)
            ? at
            : row.installed_at,
          req.user.id,
          at,
          key,
          o.revision,
        );
      if (!r.changes)
        throw creativeError(
          "Cette affiche a été modifiée par un collègue. Actualisez la liste.",
          409,
        );
      audit(db, req.user, "box_poster_updated", {
        id: key,
        animalId: animal.id,
        state: target,
        renewed: o.renew,
      });
      return { ok: true, updatedAt: at };
    },
  );
}
