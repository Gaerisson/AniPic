export const movementKey = (entry) => `${entry.kind}:${entry.animalId}`;
export const gazetteSourceRevision = (snapshot) =>
  JSON.stringify(
    canonicalGazette({
      month: snapshot.month,
      present: snapshot.present,
      arrivals: snapshot.arrivals,
      adopted: snapshot.adopted,
      candidates: snapshot.candidates,
      agenda: snapshot.agenda,
    }),
  );
export function gazetteDefaults(
  month = new Date().toLocaleDateString("sv-SE").slice(0, 7),
) {
  return {
    month,
    title: "La gazette du refuge",
    introduction: "Des regards, des rencontres et des nouvelles à partager.",
    events: "",
    teamNote: "",
    signature: "L’équipe du refuge",
    template: "spa",
    animals: [],
    autoSummary: true,
    autoPortraits: true,
    portraitLimit: 12,
    excludedAnimals: [],
    includeAgenda: true,
    excludedAgenda: [],
    includeArrivals: true,
    includeAdoptions: true,
    movements: [],
    excludedMovements: [],
    keyDates: [],
  };
}
export function gazettePortraits(options, snapshot, movements = []) {
  const used = new Set(movements.map((m) => m.animalId));
  const excluded = new Set(options.excludedAnimals || []);
  const selected = new Map();
  for (const a of options.animals || [])
    if (!used.has(a.id)) selected.set(a.id, { ...a, automatic: false });
  if (options.autoPortraits) {
    const groups = ["dog", "cat", "other"].map((s) =>
      (snapshot.candidates || []).filter((a) => a.species === s),
    );
    for (let i = 0; i < Math.max(0, ...groups.map((g) => g.length)); i++)
      for (const group of groups) {
        const a = group[i];
        if (
          a &&
          !used.has(a.id) &&
          !excluded.has(a.id) &&
          !selected.has(a.id) &&
          selected.size < (options.portraitLimit || 12)
        )
          selected.set(a.id, { id: a.id, source: "auto", automatic: true });
      }
  }
  return [...selected.values()].slice(0, 24);
}
export function gazetteSummary(options, snapshot, movements = [], dates = []) {
  const label = new Date(options.month + "-15T12:00:00Z").toLocaleDateString(
    "fr-FR",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );
  const adopted = movements.filter((m) => m.kind === "adoption"),
    arrivals = movements.filter((m) => m.kind === "arrival");
  const sentence = (rows, one, many) =>
    rows.length
      ? `${rows.length} ${rows.length === 1 ? one : many}${
          rows.some((r) => r.name)
            ? ` : ${rows
                .slice(0, 5)
                .map((r) => r.name)
                .filter(Boolean)
                .join(", ")}${rows.length > 5 ? "…" : ""}`
            : ""
        }.`
      : "";
  return [
    `Les nouvelles du refuge · ${label}.`,
    sentence(adopted, "adoption enregistrée", "adoptions enregistrées"),
    sentence(arrivals, "arrivée confirmée", "arrivées confirmées"),
    !adopted.length && !arrivals.length
      ? "Aucun mouvement daté enregistré pour ce mois."
      : "",
    `${snapshot.present || 0} compagnon${snapshot.present === 1 ? "" : "s"} ${snapshot.present === 1 ? "est actuellement présent" : "sont actuellement présents"} au refuge.`,
    dates.length
      ? `${dates.length} rendez-vous ${dates.length === 1 ? "est à retrouver" : "sont à retrouver"} dans les dates clés.`
      : "",
    "Découvrez leurs portraits et les nouvelles de l’équipe.",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1200);
}
export function mergeGazetteMovements(options, snapshot) {
  const items = new Map();
  for (const record of [
    ...(options.includeAdoptions !== false ? snapshot.adopted || [] : []),
    ...(options.includeArrivals !== false ? snapshot.arrivals || [] : []),
  ])
    items.set(movementKey(record), { source: "auto", note: "", ...record });
  for (const record of options.movements || [])
    items.set(movementKey(record), {
      ...items.get(movementKey(record)),
      ...record,
      origin: "manual",
    });
  const excluded = new Set(options.excludedMovements || []);
  return [...items.values()]
    .filter(
      (r) =>
        !excluded.has(movementKey(r)) && r.date.startsWith(options.month + "-"),
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.name || "").localeCompare(b.name || ""),
    );
}
export function canonicalGazette(value) {
  if (Array.isArray(value)) return value.map(canonicalGazette);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonicalGazette(value[k])]),
    );
  return typeof value === "string" ? value.trim() : value;
}
