import { sourceWasDeleted } from "./permanent-animal.mjs";
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
