import { z } from "zod";
import { id, audit, now, transaction, feedEvent, settings } from "./db.mjs";
import { readPresence } from "./source-presence.mjs";
import { recordAnimalChanges } from "./animal-history.mjs";

export const adoptionPolicies = ["adopted", "automatic", "after24h"];
const save = (db, animalId, p) =>
  db
    .prepare(
      "INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
    .run("autoAdoption:" + animalId, JSON.stringify(p));
export function automaticAdoption(db, animalId) {
  try {
    return JSON.parse(
      db
        .prepare("SELECT value FROM settings WHERE key=?")
        .get("autoAdoption:" + animalId)?.value || "null",
    );
  } catch {
    return null;
  }
}
const stateOf = (p) =>
  p.review ? p.review.decision || "confirmed" : "pending";
const revision = (p) => p.revision || p.at;
export function publicAdoptionOrigin(p) {
  if (!p) return null;
  const state = stateOf(p);
  return {
    kind:
      state === "rejected"
        ? "team_rejected"
        : state === "confirmed"
          ? p.review.by === "automatic"
            ? "automatic_confirmed"
            : "team_confirmed"
          : p.eventId
            ? "automatic_absence"
            : "pending_review",
    at: p.at,
    confirmations: p.confirmations,
    ...(p.review ? { reviewedAt: p.review.at } : {}),
    ...(state === "pending" && p.reviewDueAt
      ? { reviewDueAt: p.reviewDueAt }
      : {}),
  };
}
export const adoptionOrigin = (db, animalId) =>
  publicAdoptionOrigin(automaticAdoption(db, animalId));
function currentAnimal(db, animalId) {
  return db
    .prepare(
      "SELECT * FROM animals WHERE id=? AND archived_at IS NOT NULL AND status IN ('adopted','source_missing') AND NOT EXISTS(SELECT 1 FROM settings s WHERE s.key='animalTrash:'||animals.id)",
    )
    .get(animalId);
}
function privateReview(p) {
  return {
    at: p.at,
    revision: revision(p),
    state: stateOf(p),
    by: p.review?.by || (p.review ? "team" : null),
    reviewedAt: p.review?.at || null,
    dueAt: p.reviewDueAt || null,
    canConfirm: stateOf(p) !== "confirmed",
    canReject: stateOf(p) !== "rejected",
  };
}
export function reviewForAnimal(db, animalId) {
  const p = automaticAdoption(db, animalId);
  return p && currentAnimal(db, animalId) ? privateReview(p) : null;
}
export function feedAdoptionOrigin(db, event) {
  const row = db
    .prepare("SELECT value FROM settings WHERE key=?")
    .get("feedOrigin:" + event.id);
  if (row) return JSON.parse(row.value);
  return event.status === "adopted"
    ? adoptionOrigin(db, event.animal_id)
    : null;
}
function updateOrigins(db, animalId, p, kind) {
  for (const row of db
    .prepare(
      "SELECT key,value FROM settings WHERE key LIKE 'feedOrigin:%' AND json_valid(value) AND json_extract(value,'$.at')=?",
    )
    .all(p.at)) {
    if (
      !db
        .prepare("SELECT 1 FROM feed_events WHERE id=? AND animal_id=?")
        .get(row.key.slice(11), animalId)
    )
      continue;
    db.prepare("UPDATE settings SET value=? WHERE key=?").run(
      JSON.stringify({ ...JSON.parse(row.value), kind, correctedAt: now() }),
      row.key,
    );
  }
}
const baseSQL = `FROM settings s JOIN animals a ON s.key='autoAdoption:'||a.id WHERE a.archived_at IS NOT NULL AND a.status IN ('adopted','source_missing') AND json_valid(s.value) AND NOT EXISTS(SELECT 1 FROM settings t WHERE t.key='animalTrash:'||a.id)`;
const pendingSQL = baseSQL + " AND json_extract(s.value,'$.review') IS NULL";
export function pendingAdoptionCount(db) {
  return db.prepare(`SELECT COUNT(*) n ${pendingSQL}`).get().n;
}

export function inferAdoption(db, animal, snapshot, cfg, at, confirmations) {
  const deferred = cfg.sourceMissingOutcome === "after24h",
    eventId = deferred ? null : id();
  if (eventId)
    db.prepare("INSERT INTO animal_status_events VALUES (?,?,?,?)").run(
      eventId,
      animal.id,
      "adopted",
      at,
    );
  const p = {
    eventId,
    at,
    sourceId: animal.source_id,
    scope: snapshot.scope,
    fetchedAt: snapshot.fetchedAt,
    confirmations,
    intervalHours: cfg.sourceAbsenceIntervalHours,
    previousStatus: animal.status,
    revision: id(),
    ...(deferred
      ? { reviewDueAt: new Date(Date.parse(at) + 86400000).toISOString() }
      : {}),
    ...(cfg.sourceMissingOutcome === "automatic"
      ? {
          review: {
            at,
            by: "automatic",
            decision: "confirmed",
            reason: "absence",
          },
        }
      : {}),
  };
  save(db, animal.id, p);
  audit(
    db,
    null,
    deferred ? "source_adoption_pending" : "source_adoption_automatic",
    { animalId: animal.id, name: animal.name, ...p },
  );
}
function confirm(db, animal, p, user, by, at, reason) {
  const before = { ...animal },
    previous = revision(p);
  if (!p.eventId) {
    p.eventId = id();
    db.prepare("INSERT INTO animal_status_events VALUES (?,?,?,?)").run(
      p.eventId,
      animal.id,
      "adopted",
      at,
    );
  }
  db.prepare("UPDATE animals SET status='adopted',updated_at=? WHERE id=?").run(
    at,
    animal.id,
  );
  p.review = {
    at,
    by,
    decision: "confirmed",
    ...(user ? { userId: user.id } : {}),
    fromRevision: previous,
    ...(reason ? { reason } : {}),
  };
  p.revision = id();
  save(db, animal.id, p);
  const after = { ...animal, status: "adopted", updated_at: at };
  recordAnimalChanges(db, before, after, at, "manual");
  audit(
    db,
    user,
    by === "automatic"
      ? "adoption_review_auto_confirmed"
      : "adoption_review_confirmed",
    {
      animalId: animal.id,
      name: animal.name,
      inferredAt: p.at,
      confirmedAt: at,
      reason,
    },
  );
  feedEvent(db, after, "adopted", publicAdoptionOrigin(p));
}
function reject(db, animal, p, user) {
  const at = now(),
    previous = revision(p);
  if (p.eventId)
    db.prepare(
      "DELETE FROM animal_status_events WHERE id=? AND animal_id=? AND status='adopted'",
    ).run(p.eventId, animal.id);
  p.eventId = null;
  p.review = {
    at,
    by: "team",
    decision: "rejected",
    userId: user.id,
    fromRevision: previous,
  };
  p.revision = id();
  save(db, animal.id, p);
  db.prepare(
    "UPDATE animals SET status='source_missing',updated_at=? WHERE id=?",
  ).run(at, animal.id);
  const after = { ...animal, status: "source_missing", updated_at: at };
  recordAnimalChanges(db, animal, after, at, "manual");
  updateOrigins(db, animal.id, p, "team_rejected");
  audit(db, user, "adoption_review_rejected", {
    animalId: animal.id,
    name: animal.name,
    inferredAt: p.at,
    at,
  });
  feedEvent(db, after, "removed", publicAdoptionOrigin(p));
}

// Run after a safe inventory and from the scheduler. Expiry alone never proves a continued absence.
export function settleDueAdoptions(db, cfg = settings(db), clock = Date.now()) {
  if (
    !cfg.archiveMissing ||
    cfg.sourceMode === "disabled" ||
    !["automatic", "after24h"].includes(cfg.sourceMissingOutcome)
  )
    return 0;
  let changed = 0;
  for (const row of db
    .prepare(`SELECT a.*,s.value decision ${pendingSQL}`)
    .all()) {
    const p = JSON.parse(row.decision),
      due =
        cfg.sourceMissingOutcome === "after24h"
          ? Date.parse(
              p.reviewDueAt ||
                new Date(Date.parse(p.at) + 86400000).toISOString(),
            )
          : Date.parse(p.at);
    if (clock < due || p.scope !== cfg.sourceScope) continue;
    const inventory = readPresence(db, p.scope),
      fetched = Date.parse(inventory?.fetchedAt || "");
    if (
      !inventory ||
      inventory.ids.has(row.source_id) ||
      !Number.isFinite(fetched) ||
      fetched < due ||
      fetched > clock + 300000 ||
      clock - fetched > cfg.sourceStaleHours * 3600000
    )
      continue;
    confirm(
      db,
      row,
      p,
      null,
      "automatic",
      new Date(clock).toISOString(),
      cfg.sourceMissingOutcome === "after24h" ? "no_response_24h" : "absence",
    );
    changed++;
  }
  return changed;
}

export function reconcileAdoption(db, animal, sourceStatus) {
  const p = automaticAdoption(db, animal.id);
  if (!p) return false;
  const confirmed = sourceStatus === "adopted";
  updateOrigins(
    db,
    animal.id,
    p,
    confirmed ? "source_confirmed" : "automatic_reversed",
  );
  if (!confirmed && p.eventId)
    db.prepare(
      "DELETE FROM animal_status_events WHERE id=? AND animal_id=? AND status='adopted'",
    ).run(p.eventId, animal.id);
  db.prepare("DELETE FROM settings WHERE key=?").run(
    "autoAdoption:" + animal.id,
  );
  audit(
    db,
    null,
    confirmed ? "source_adoption_confirmed" : "source_adoption_reversed",
    { animalId: animal.id, name: animal.name, inferredAt: p.at, sourceStatus },
  );
  return (
    !confirmed && ["available", "reserved", "unknown"].includes(sourceStatus)
  );
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
          state: z
            .enum(["pending", "all", "confirmed", "rejected"])
            .default("pending"),
          page: z.coerce.number().int().min(1).max(1000000).default(1),
          limit: z.coerce.number().int().min(1).max(40).default(40),
        })
        .parse(req.query);
      reply.header("Cache-Control", "private, no-store");
      const pending = pendingAdoptionCount(db);
      if (q.countOnly === "1") return { total: pending };
      const condition =
        q.state === "pending"
          ? pendingSQL
          : q.state === "all"
            ? baseSQL
            : baseSQL +
              (q.state === "rejected"
                ? " AND json_extract(s.value,'$.review.decision')='rejected'"
                : " AND json_extract(s.value,'$.review') IS NOT NULL AND COALESCE(json_extract(s.value,'$.review.decision'),'confirmed')='confirmed'");
      const total = db.prepare(`SELECT COUNT(*) n ${condition}`).get().n;
      const rows = db
        .prepare(
          `SELECT a.id,a.name,a.species,a.status,a.source_id,a.source_url,a.source_metadata,s.value,(SELECT p.id FROM photos p WHERE p.animal_id=a.id AND p.hidden=0 AND p.deleted_at IS NULL ORDER BY p.id=a.cover_id DESC,p.created_at DESC LIMIT 1) cover_id ${condition} ORDER BY json_extract(s.value,'$.at'),a.id LIMIT ? OFFSET ?`,
        )
        .all(q.limit, (q.page - 1) * q.limit);
      return {
        total,
        pending,
        page: q.page,
        pages: Math.max(1, Math.ceil(total / q.limit)),
        items: rows.map(({ value, source_metadata, ...a }) => {
          const p = JSON.parse(value);
          return {
            ...a,
            source_metadata: {
              thumbnail: JSON.parse(source_metadata || "{}").thumbnail,
            },
            at: p.at,
            confirmations: p.confirmations,
            adoption_origin: publicAdoptionOrigin(p),
            adoption_review: privateReview(p),
          };
        }),
      };
    },
  );
  const bodySchema = z
    .object({
      expectedAt: z.string().datetime(),
      expectedRevision: z.string().min(1).max(100).optional(),
    })
    .strict();
  for (const action of ["confirm", "reject"]) {
    app.post(
      `/api/adoption-reviews/:id/${action}`,
      { preHandler: access },
      async (req, reply) => {
        const animalId = z.string().uuid().parse(req.params.id),
          body = bodySchema.parse(req.body),
          desired = action === "confirm" ? "confirmed" : "rejected";
        return transaction(db, () => {
          const animal = currentAnimal(db, animalId),
            p = automaticAdoption(db, animalId);
          if (!animal || !p || p.at !== body.expectedAt)
            return reply
              .code(409)
              .send({
                error:
                  "Ce départ a changé ou n’est plus à vérifier. Actualisez la liste.",
              });
          if (
            stateOf(p) === desired &&
            (!body.expectedRevision ||
              [revision(p), p.review?.fromRevision].includes(
                body.expectedRevision,
              ))
          )
            return {
              ok: true,
              ...(desired === "confirmed"
                ? { alreadyConfirmed: true }
                : { alreadyRejected: true }),
              review: privateReview(p),
            };
          if (p.review && !body.expectedRevision)
            return reply
              .code(409)
              .send({ error: "Actualisez la décision avant de la modifier." });
          if (body.expectedRevision && body.expectedRevision !== revision(p))
            return reply
              .code(409)
              .send({
                error:
                  "Un autre membre ou la règle automatique a modifié cette décision. Actualisez avant de continuer.",
              });
          if (action === "confirm")
            confirm(db, animal, p, req.user, "team", now());
          else reject(db, animal, p, req.user);
          return { ok: true, review: privateReview(p) };
        });
      },
    );
  }
}
