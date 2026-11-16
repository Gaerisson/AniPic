export function sourceCleanupFeedback(result) {
  const summaries = (Array.isArray(result) ? result : [result])
    .map((item) => item?.sourceCleanup)
    .filter(Boolean);
  const deleted = summaries.reduce((sum, item) => sum + (item.deleted || 0), 0);
  const modified = summaries.reduce(
    (sum, item) => sum + (item.modified || 0),
    0,
  );
  const warning = summaries.some((item) => item.errors?.length || item.pending);
  const remaining = summaries.some((item) => item.remaining);
  const parts = [];
  if (deleted) parts.push(`${deleted} fichier(s) retiré(s) du dépôt.`);
  if (modified) parts.push(`${modified} fichier(s) modifié(s) conservé(s).`);
  if (warning)
    parts.push(
      "Certains fichiers du dépôt sont conservés. Vérifiez l’accès en écriture puis relancez le nettoyage.",
    );
  if (remaining)
    parts.push("Le nettoyage peut être poursuivi depuis Photos à trier.");
  return { message: parts.length ? " " + parts.join(" ") : "", warning };
}
