export const photoRuleDefaults = {
  sos: "urgent",
  reserved: "low",
  standard: "normal",
};
export const priorityRank = { urgent: 0, high: 1, normal: 2, low: 3 };
export const priorityLabels = {
  urgent: "Urgente",
  high: "Haute",
  normal: "Normale",
  low: "Basse",
};
export function photoPriority(animal, rules = photoRuleDefaults) {
  const tags = Array.isArray(animal.tags)
    ? animal.tags
    : JSON.parse(animal.tags || "[]");
  const sos = tags.some((tag) => /^sos(?:\s|$)/i.test(String(tag).trim()));
  const reason = sos
    ? "SOS"
    : animal.status === "reserved"
      ? "Réservé"
      : "Sans photo locale";
  const priority =
    (sos
      ? rules.sos
      : animal.status === "reserved"
        ? rules.reserved
        : rules.standard) || "normal";
  return { priority, reason };
}
export function photoPrioritySql(rules = photoRuleDefaults) {
  return `CASE WHEN EXISTS(SELECT 1 FROM json_each(a.tags) tag WHERE lower(trim(tag.value))='sos' OR lower(trim(tag.value)) LIKE 'sos %') THEN ${priorityRank[rules.sos] ?? 2} WHEN a.status='reserved' THEN ${priorityRank[rules.reserved] ?? 2} ELSE ${priorityRank[rules.standard] ?? 2} END`;
}
