export function historyGroups(items) {
  const groups = new Map();
  for (const item of items) {
    const key = [item.animal_id, item.observed_at, item.kind].join(":");
    if (!groups.has(key)) groups.set(key, { ...item, key, changes: [] });
    if (!groups.get(key).changes.some((c) => c.seq === item.seq))
      groups.get(key).changes.push(item);
  }
  return [...groups.values()].sort(
    (a, b) => b.observed_at.localeCompare(a.observed_at) || b.seq - a.seq,
  );
}
export function historyValue(value, field) {
  const labels = {
    dog: "Chien",
    cat: "Chat",
    other: "NAC",
    male: "Mâle",
    female: "Femelle",
    unknown: "Non renseigné",
    available: "À l’adoption",
    adopted: "Adopté",
    source_missing: "Absent du site SPA",
    dogs: "Chiens",
    cats: "Chats",
    children: "Enfants",
    yes: "Oui",
    no: "Non",
  };
  if (value == null || value === "") return "Non renseigné";
  if (Array.isArray(value))
    return value.map((v) => historyValue(v)).join(" · ") || "Aucun";
  if (typeof value === "object")
    return (
      Object.entries(value)
        .filter(([, v]) => v != null && v !== "")
        .map(([k, v]) => (labels[k] || k) + " : " + historyValue(v, k))
        .join("\n") || "Non renseigné"
    );
  return ["sex", "species", "status", "dogs", "cats", "children"].includes(
    field,
  )
    ? labels[String(value)] || String(value)
    : String(value);
}
