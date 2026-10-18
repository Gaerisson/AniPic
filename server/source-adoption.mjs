import { id, audit } from "./db.mjs";

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
        kind: "automatic_absence",
        at: value.at,
        confirmations: value.confirmations,
      }
    : null;
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
