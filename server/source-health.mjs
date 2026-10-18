import { settings } from "./db.mjs";
import { readPresence } from "./source-presence.mjs";
export function sourceHealth(db, cfg = settings(db), clock = Date.now()) {
  if (!cfg.sourceMode || cfg.sourceMode === "disabled")
    return { state: "disabled" };
  const scope = cfg.sourceScope || "spa:moree",
    inventory = readPresence(db, scope);
  const candidate = cfg.sourceLastDiagnostic;
  const matches =
    candidate?.mode === cfg.sourceMode &&
    (candidate.configuration?.scope
      ? candidate.configuration.scope === scope
      : scope === "spa:moree") &&
    (cfg.sourceMode !== "spa" ||
      candidate.configuration?.refugeSlug === cfg.spaRefugeSlug) &&
    candidate.configuration?.species?.length === 3;
  const report = matches ? candidate : null;
  const safeReport =
    report?.status === "complete" && report.archiveSafe === true;
  const useReport =
    safeReport &&
    (!inventory ||
      Date.parse(report.testedAt) > Date.parse(inventory.appliedAt));
  const reference = useReport ? report : inventory;
  const at = useReport ? report.testedAt : inventory?.fetchedAt;
  const ids = useReport
    ? Array.isArray(report.sourceIds)
      ? new Set(report.sourceIds)
      : null
    : inventory?.ids;
  const expected = useReport
    ? (report.animalsKept ?? report.animalsFound)
    : inventory?.sourceIds.length;
  const rows = db
    .prepare(
      "SELECT id,name,source_id FROM animals WHERE source_scope=? AND archived_at IS NULL AND NOT EXISTS(SELECT 1 FROM settings s WHERE s.key='animalTrash:'||animals.id)",
    )
    .all(scope);
  const locals = new Set(rows.map((a) => a.source_id));
  const missing = ids ? rows.filter((a) => !ids.has(a.source_id)) : [],
    incoming = ids ? [...ids].filter((id) => !locals.has(id)) : [];
  const latest = db
    .prepare(
      "SELECT state,detail,created_at,finished_at FROM jobs WHERE kind='sync' ORDER BY created_at DESC,rowid DESC LIMIT 1",
    )
    .get();
  let partialSync = false;
  try {
    partialSync =
      latest?.state === "done" && JSON.parse(latest.detail)?.complete === false;
  } catch {
    /* Legacy jobs may not contain JSON. */
  }
  const failure =
    (latest?.state === "failed" || partialSync) &&
    (!inventory?.appliedAt ||
      Date.parse(latest.created_at) >= Date.parse(inventory.appliedAt));
  const testFailed =
    report &&
    ["blocked", "error", "partial"].includes(report.status) &&
    (!at || Date.parse(report.testedAt) >= Date.parse(at));
  const mismatch =
    Number.isInteger(expected) &&
    (expected !== rows.length || missing.length > 0 || incoming.length > 0);
  const stale =
    at && clock - Date.parse(at) > (cfg.sourceStaleHours || 24) * 3600000;
  return {
    state:
      failure || testFailed
        ? "error"
        : mismatch
          ? "mismatch"
          : stale
            ? "stale"
            : reference
              ? "ok"
              : "unverified",
    checkedAt: at || null,
    localCount: rows.length,
    sourceCount: Number.isInteger(expected) ? expected : null,
    missingCount: ids ? missing.length : null,
    newCount: ids ? incoming.length : null,
    missing: missing
      .slice(0, 8)
      .map((a) => ({ id: a.id, name: a.name, sourceId: a.source_id })),
    basedOn: useReport ? "diagnostic" : "synchronization",
    refreshing: latest?.state === "running",
    canInferAdoption: Boolean(
      cfg.archiveMissing &&
      ["adopted", "automatic", "after24h"].includes(cfg.sourceMissingOutcome),
    ),
    absencePolicy: {
      outcome: cfg.archiveMissing ? cfg.sourceMissingOutcome : "review",
      confirmations: cfg.missingThreshold,
      intervalHours: cfg.sourceAbsenceIntervalHours,
    },
  };
}
