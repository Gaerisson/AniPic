import { createHash } from "node:crypto";
import { now } from "./db.mjs";
export const sourceDeletionFingerprint = (scope, sourceId) =>
  createHash("sha256")
    .update(JSON.stringify(["anipic-deleted-source-v1", sourceId]))
    .digest("hex");
export const sourceWasDeleted = (db, scope, sourceId) =>
  Boolean(
    sourceId &&
    db
      .prepare("SELECT 1 FROM source_deletions WHERE fingerprint=?")
      .get(sourceDeletionFingerprint(scope, sourceId)),
  );

// Called only inside the explicit, backed-up trash purge transaction, once all
// photos have been removed. Never called by schema migrations or synchronization.
export function eraseAnimalRecord(db, animalId) {
  const animal = db.prepare("SELECT * FROM animals WHERE id=?").get(animalId);
  if (
    !animal ||
    db.prepare("SELECT 1 FROM photos WHERE animal_id=?").get(animalId)
  )
    return false;
  if (animal.source_id)
    db.prepare("INSERT OR IGNORE INTO source_deletions VALUES (?,?)").run(
      sourceDeletionFingerprint(animal.source_scope, animal.source_id),
      now(),
    );
  for (const row of db
    .prepare(
      "SELECT DISTINCT substr(observed_at,1,4) year FROM animal_status_events WHERE animal_id=? AND status='adopted' AND observed_at IS NOT NULL",
    )
    .all(animalId)) {
    const year = Number(row.year);
    if (Number.isInteger(year) && year >= 2000 && year <= 2100)
      db.prepare(
        "INSERT INTO erased_animal_statistics(year,adoptions) VALUES (?,1) ON CONFLICT(year) DO UPDATE SET adoptions=adoptions+1",
      ).run(year);
  }
  // Both cascade and SET NULL relations are removed: a deleted animal must not
  // leave a named draft, OAuth request, favorite or old change record behind.
  for (const { name } of db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .all()) {
    for (const fk of db.prepare(`PRAGMA foreign_key_list("${name}")`).all()) {
      if (fk.table === "animals" && name !== "photos")
        db.prepare(`DELETE FROM "${name}" WHERE "${fk.from}"=?`).run(animalId);
    }
  }
  db.prepare("DELETE FROM feed_events WHERE animal_id=?").run(animalId);
  // Remove obsolete animal-specific settings, retaining settings belonging to
  // other animals and application configuration.
  for (const row of db
    .prepare(
      "SELECT key,value FROM settings WHERE instr(key,?)>0 OR instr(value,?)>0",
    )
    .all(animalId, animalId)) {
    if (row.key.includes(animalId)) {
      db.prepare("DELETE FROM settings WHERE key=?").run(row.key);
      continue;
    }
    let value;
    try {
      value = JSON.parse(row.value);
    } catch {
      continue;
    }
    const drop = Symbol("deleted"),
      prune = (entry) => {
        if (entry === animalId || entry === "spa:" + animalId) return drop;
        if (Array.isArray(entry))
          return entry.map(prune).filter((item) => item !== drop);
        if (entry && typeof entry === "object") {
          if (
            entry.animalId === animalId ||
            entry.animal_id === animalId ||
            entry.id === animalId
          )
            return drop;
          return Object.fromEntries(
            Object.entries(entry)
              .filter(([k]) => k !== animalId)
              .map(([k, v]) => [k, prune(v)])
              .filter(([, v]) => v !== drop),
          );
        }
        return entry;
      };
    const clean = prune(value);
    if (clean === drop)
      db.prepare("DELETE FROM settings WHERE key=?").run(row.key);
    else
      db.prepare("UPDATE settings SET value=? WHERE key=?").run(
        JSON.stringify(clean),
        row.key,
      );
  }
  db.prepare("DELETE FROM animals WHERE id=?").run(animalId);
  return true;
}
