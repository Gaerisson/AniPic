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
      {r.autoAdopted > 0 && <span>{r.autoAdopted} adoptions automatiques</span>}
      {r.autoAdoptionsReversed > 0 && (
        <span>{r.autoAdoptionsReversed} retours · adoptions corrigées</span>
      )}
      <span>
        {changed === null
          ? `${r.updated || 0} fiches actualisées`
          : `${changed} modifications`}
      </span>
      {Number.isFinite(r.unchanged) && <span>{r.unchanged} inchangées</span>}
      {Number.isFinite(r.missingFromSource) && r.missingFromSource > 0 && (
        <span>{r.missingFromSource} absents de la liste SPA · à vérifier</span>
      )}
      {r.absenceProtection && <small>{r.absenceProtection}</small>}
      {changed === 0 && !r.created && !r.archived && (
        <small>Aucun changement dans les fiches.</small>
      )}
    </div>
  );
}
