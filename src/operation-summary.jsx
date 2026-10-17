export function operationResult(detail) {
  try {
    return typeof detail === "string" ? JSON.parse(detail) : detail;
  } catch {
    return null;
  }
}
export function OperationSummary({ detail }) {
  const r = operationResult(detail);
  if (
    !r ||
    !["created", "archived", "changed", "updated"].some((k) =>
      Number.isFinite(r[k]),
    )
  )
    return null;
  const changed = Number.isFinite(r.changed) ? r.changed : null;
  return (
    <div className="sync-counts">
      <span>+{r.created || 0} arrivées</span>
      <span>−{r.archived || 0} archivages</span>
      <span>
        {changed === null
          ? `${r.updated || 0} fiches actualisées`
          : `${changed} modifications`}
      </span>
      {Number.isFinite(r.unchanged) && <span>{r.unchanged} inchangées</span>}
      {changed === 0 && !r.created && !r.archived && (
        <small>Aucun changement dans les fiches.</small>
      )}
    </div>
  );
}
