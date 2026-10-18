import { z } from "zod";
import { id, audit, now, transaction, feedEvent } from "./db.mjs";

// This provenance belongs to AniPic's configured absence rule, not to SPA.
export function automaticAdoption(db, animalId) {
  const row = db
    .prepare("SELECT value FROM settings WHERE key=?")
    .get("autoAdoption:" + animalId);
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}
export function adoptionOrigin(db, animalId) {
  const value = automaticAdoption(db, animalId);
  return value
    ? {
        kind: value.review ? "team_confirmed" : "automatic_absence",
        at: value.at,
        confirmations: value.confirmations,
        ...(value.review ? { reviewedAt: value.review.at } : {}),
      }
    : null;
}

const pendingSQL = `FROM settings s JOIN animals a ON s.key='autoAdoption:'||a.id
  WHERE a.status='adopted' AND a.archived_at IS NOT NULL
  AND json_valid(s.value) AND json_extract(s.value,'$.review') IS NULL
  AND NOT EXISTS(SELECT 1 FROM settings t WHERE t.key='animalTrash:'||a.id)`;
export function feedAdoptionOrigin(db, event) {
  if (event.status !== "adopted") return null;
  const stored = db
    .prepare("SELECT value FROM settings WHERE key=?")
    .get("feedOrigin:" + event.id);
  return stored
    ? JSON.parse(stored.value)
    : adoptionOrigin(db, event.animal_id);
}
export function pendingAdoptionCount(db) {
  return db.prepare(`SELECT COUNT(*) n ${pendingSQL}`).get().n;
}
export async function registerAdoptionReviews(app, { db, authorized }) {
  const access = authorized(["admin", "agent"]);
  app.get(
    "/api/adoption-reviews",
    { preHandler: access },
    async (req, reply) => {
      const q = z
        .object({
          countOnly: z.enum(["0", "1"]).default("0"),
          page: z.coerce.number().int().min(1).default(1),
        })
        .parse(req.query);
      reply.header("Cache-Control", "private, no-store");
      const total = pendingAdoptionCount(db);
      if (q.countOnly === "1") return { total };
      const rows = db
        .prepare(
          `SELECT a.id,a.name,a.species,a.source_id,a.source_url,a.source_metadata,s.value,
      (SELECT p.id FROM photos p WHERE p.animal_id=a.id AND p.hidden=0 AND p.deleted_at IS NULL ORDER BY p.id=a.cover_id DESC,p.created_at DESC LIMIT 1) cover_id
      ${pendingSQL} ORDER BY json_extract(s.value,'$.at'),a.id LIMIT 40 OFFSET ?`,
        )
        .all((q.page - 1) * 40);
      return {
        total,
        page: q.page,
        pages: Math.max(1, Math.ceil(total / 40)),
        items: rows.map(({ value, source_metadata, ...a }) => {
          const origin = JSON.parse(value);
          const metadata = JSON.parse(source_metadata || "{}");
          return {
            ...a,
            source_metadata: { thumbnail: metadata.thumbnail },
            at: origin.at,
            confirmations: origin.confirmations,
          };
        }),
      };
    },
  );
  app.post(
    "/api/adoption-reviews/:id/confirm",
    { preHandler: access },
    async (req, reply) => {
      const animalId = z.string().uuid().parse(req.params.id);
      const body = z
        .object({ expectedAt: z.string().datetime() })
        .strict()
        .parse(req.body);
      return transaction(db, () => {
        const animal = db
          .prepare("SELECT * FROM animals WHERE id=?")
          .get(animalId);
        const provenance = automaticAdoption(db, animalId);
        if (
          !animal ||
          !provenance ||
          provenance.at !== body.expectedAt ||
          animal.status !== "adopted" ||
          !animal.archived_at ||
          db
            .prepare("SELECT 1 FROM settings WHERE key=?")
            .get("animalTrash:" + animalId)
        )
          return reply.code(409).send({
            error:
              "Cette adoption n’est plus à confirmer. Actualisez la liste.",
          });
        if (provenance.review) return { ok: true, alreadyConfirmed: true };
        provenance.review = { at: now(), userId: req.user.id };
        db.prepare("UPDATE settings SET value=? WHERE key=?").run(
          JSON.stringify(provenance),
          "autoAdoption:" + animalId,
        );
        // The automatic adoption already has an event: confirmation never counts it twice.
        audit(db, req.user, "adoption_review_confirmed", {
          animalId,
          name: animal.name,
          inferredAt: provenance.at,
          confirmedAt: provenance.review.at,
        });
        feedEvent(db, animal, "adopted", adoptionOrigin(db, animal.id));
        return { ok: true };
      });
    },
  );
}
export function inferAdoption(db, animal, snapshot, cfg, at, confirmations) {
  const eventId = id();
  db.prepare("INSERT INTO animal_status_events VALUES (?,?,?,?)").run(
    eventId,
    animal.id,
    "adopted",
    at,
  );
  const provenance = {
    eventId,
    at,
    sourceId: animal.source_id,
    scope: snapshot.scope,
    fetchedAt: snapshot.fetchedAt,
    confirmations,
    intervalHours: cfg.sourceAbsenceIntervalHours,
    previousStatus: animal.status,
  };
  db.prepare(
    "INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  ).run("autoAdoption:" + animal.id, JSON.stringify(provenance));
  audit(db, null, "source_adoption_automatic", {
    animalId: animal.id,
    name: animal.name,
    ...provenance,
  });
}
export function reconcileAdoption(db, animal, sourceStatus) {
  const provenance = automaticAdoption(db, animal.id);
  if (!provenance) return false;
  const confirmed = sourceStatus === "adopted";
  // Keep the distinction between an inferred movement and its later correction.
  for (const row of db
    .prepare(
      "SELECT key,value FROM settings WHERE key LIKE 'feedOrigin:%' AND json_valid(value) AND json_extract(value,'$.at')=?",
    )
    .all(provenance.at)) {
    const eventId = row.key.slice("feedOrigin:".length);
    if (
      !db
        .prepare("SELECT 1 FROM feed_events WHERE id=? AND animal_id=?")
        .get(eventId, animal.id)
    )
      continue;
    db.prepare("UPDATE settings SET value=? WHERE key=?").run(
      JSON.stringify({
        ...JSON.parse(row.value),
        kind: confirmed ? "source_confirmed" : "automatic_reversed",
        correctedAt: now(),
      }),
      row.key,
    );
  }
  // Only retract the exact inferred event. Keep all independent observations.
  if (!confirmed)
    db.prepare(
      "DELETE FROM animal_status_events WHERE id=? AND animal_id=? AND status='adopted'",
    ).run(provenance.eventId, animal.id);
  db.prepare("DELETE FROM settings WHERE key=?").run(
    "autoAdoption:" + animal.id,
  );
  audit(
    db,
    null,
    confirmed ? "source_adoption_confirmed" : "source_adoption_reversed",
    {
      animalId: animal.id,
      name: animal.name,
      inferredAt: provenance.at,
      sourceStatus,
    },
  );
  return (
    !confirmed && ["available", "reserved", "unknown"].includes(sourceStatus)
  );
}
