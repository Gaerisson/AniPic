export const agendaCategories = Object.freeze({
  open_day: "Portes ouvertes",
  collection: "Collecte solidaire",
  event: "Événement",
  appointment: "Rendez-vous",
  other: "À noter",
});
export const parisDate = (at = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
export function monthRange(month, months = 1) {
  const end = new Date(`${month}-01T12:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + months);
  end.setUTCDate(0);
  return { from: `${month}-01`, to: end.toISOString().slice(0, 10) };
}
export const agendaDateLabel = (date) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
export function gazetteAgenda(options, events = []) {
  const excluded = new Set(options.excludedAgenda || []);
  const map = new Map(
    (options.includeAgenda ? events : [])
      .filter(
        (e) =>
          e.shareGazette && e.status !== "cancelled" && !excluded.has(e.id),
      )
      .map((e) => [
        e.id,
        {
          id: e.id,
          date: e.date,
          time: e.time,
          title: e.title,
          category: e.category,
          location: e.location,
          description: e.description,
        },
      ]),
  );
  for (const e of options.keyDates || []) map.set(e.id, e);
  return [...map.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
  );
}
