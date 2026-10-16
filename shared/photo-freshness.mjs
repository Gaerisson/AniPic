const day = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function calendarKey(value) {
  const parts = Object.fromEntries(
    day.formatToParts(value).map((p) => [p.type, p.value]),
  );
  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
  );
}
export function photoDateLabel(value, now = new Date()) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const elapsed = (calendarKey(now) - calendarKey(date)) / 86400000;
  if (elapsed === 0) return "Aujourd’hui";
  if (elapsed === 1) return "Hier";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
    ...(day.formatToParts(date).find((p) => p.type === "year").value !==
    day.formatToParts(now).find((p) => p.type === "year").value
      ? { year: "numeric" }
      : {}),
  }).format(date);
}
