import { sourceWasDeleted } from "./permanent-animal.mjs";

export function readSourceObservation(db, animalId) {
  try {
    return JSON.parse(
      db
        .prepare("SELECT value FROM settings WHERE key=?")
        .get("sourceObservation:" + animalId)?.value || "null",
    );
  } catch {
    return null;
  }
}
function saveObservation(db, animalId, observation) {
  db.prepare(
    "INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  ).run("sourceObservation:" + animalId, JSON.stringify(observation));
}
// Legacy fiches have no known publication/episode start. Only a new fiche or a
// return after an observed safe absence establishes a new observed episode.
export function recordSourceObservation(db, animal, observedAt, isNew = false) {
  const previous = readSourceObservation(db, animal.id);
  const sameScope = previous?.scope === animal.source_scope;
  if (sameScope && Date.parse(previous.lastSeenAt) >= Date.parse(observedAt))
    return;
  const returned = sameScope && previous.firstMissingAt;
  saveObservation(db, animal.id, {
    scope: animal.source_scope,
    sourceId: animal.source_id,
    firstSeenAt:
      isNew || returned ? observedAt : sameScope ? previous.firstSeenAt : null,
    lastSeenAt: observedAt,
    firstMissingAt: null,
    durationHours: null,
  });
}
function freezeMissingObservations(db, snapshot) {
  const present = new Set(snapshot.animals.map((a) => a.sourceId));
  for (const row of db
    .prepare(
      "SELECT a.id,a.source_id,s.value FROM animals a JOIN settings s ON s.key='sourceObservation:'||a.id WHERE a.source_scope=? AND NOT EXISTS(SELECT 1 FROM settings t WHERE t.key='animalTrash:'||a.id)",
    )
    .all(snapshot.scope)) {
    if (present.has(row.source_id)) continue;
    const observation = JSON.parse(row.value);
    if (
      observation.scope !== snapshot.scope ||
      observation.firstMissingAt ||
      Date.parse(observation.lastSeenAt) > Date.parse(snapshot.fetchedAt)
    )
      continue;
    const duration =
      Date.parse(observation.lastSeenAt) - Date.parse(observation.firstSeenAt);
    saveObservation(db, row.id, {
      ...observation,
      firstMissingAt: snapshot.fetchedAt,
      durationHours:
        Number.isFinite(duration) && duration >= 0 ? duration / 3600000 : null,
    });
  }
}
// Presence is distinct from adoption. Only a safe complete inventory may
// establish an absence; partial/error responses never replace that inventory.
export function inventoryComparison(db, snapshot) {
  const seen = new Set(snapshot.animals.map((a) => a.sourceId));
  const rows = db
    .prepare(
      "SELECT id,name,source_id,status,source_seen_at,missing_count FROM animals WHERE source_scope=? AND archived_at IS NULL AND NOT EXISTS(SELECT 1 FROM settings s WHERE s.key='animalTrash:'||animals.id)",
    )
    .all(snapshot.scope);
  return {
    localActive: rows.length,
    sourceCount: snapshot.animals.filter(
      (a) => !sourceWasDeleted(db, snapshot.scope, a.sourceId),
    ).length,
    missing: rows
      .filter((a) => !seen.has(a.source_id))
      .map((a) => ({
        id: a.id,
        name: a.name,
        sourceId: a.source_id,
        lastKnownStatus: a.status,
        lastSeenAt: a.source_seen_at,
        confirmations: a.missing_count,
      })),
    new: snapshot.animals
      .filter(
        (a) =>
          !sourceWasDeleted(db, snapshot.scope, a.sourceId) &&
          !rows.some((r) => r.source_id === a.sourceId),
      )
      .map((a) => ({ name: a.name, sourceId: a.sourceId })),
  };
}
export function savePresence(db, snapshot, appliedAt) {
  const fetched = Date.parse(snapshot.fetchedAt || ""),
    latest = readPresence(db, snapshot.scope);
  if (
    !snapshot.complete ||
    snapshot.absenceSafe === false ||
    !Number.isFinite(fetched) ||
    fetched <= Date.parse(latest?.fetchedAt || "1970-01-01")
  )
    return null;
  const result = {
    scope: snapshot.scope,
    appliedAt,
    fetchedAt: snapshot.fetchedAt,
    sourceIds: snapshot.animals.map((a) => a.sourceId),
  };
  db.prepare(
    "INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  ).run("sourcePresence:" + snapshot.scope, JSON.stringify(result));
  freezeMissingObservations(db, snapshot);
  return inventoryComparison(db, snapshot);
}
export function readPresence(db, scope) {
  const row = db
    .prepare("SELECT value FROM settings WHERE key=?")
    .get("sourcePresence:" + scope);
  if (!row) return null;
  try {
    const v = JSON.parse(row.value);
    return Array.isArray(v.sourceIds)
      ? { ...v, ids: new Set(v.sourceIds) }
      : null;
  } catch {
    return null;
  }
}
export function animalPresence(db, animal, cache = new Map()) {
  if (!cache.has(animal.source_scope))
    cache.set(animal.source_scope, readPresence(db, animal.source_scope));
  const inventory = cache.get(animal.source_scope);
  if (!inventory) return { state: "unknown", checkedAt: null };
  const present =
    inventory.ids.has(animal.source_id) ||
    (animal.source_seen_at && animal.source_seen_at > inventory.fetchedAt);
  return {
    state: present ? "present" : "missing",
    checkedAt: inventory.fetchedAt,
  };
}
export function missingAnimalIds(db) {
  const cache = new Map();
  return db
    .prepare(
      "SELECT id,source_id,source_scope,source_seen_at FROM animals WHERE archived_at IS NULL",
    )
    .all()
    .filter((a) => animalPresence(db, a, cache).state === "missing")
    .map((a) => a.id);
}
