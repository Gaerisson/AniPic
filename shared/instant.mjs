// Legacy SQLite timestamps omit the zone; all AniPic storage is UTC.
export function instant(value) {
  if (value instanceof Date) return value;
  const text = String(value || "");
  return new Date(
    /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d(?::\d\d(?:\.\d+)?)?$/.test(text)
      ? text.replace(" ", "T") + "Z"
      : value,
  );
}
export function formatInstant(value, zone = "Europe/Paris", options = {}) {
  const date = instant(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString("fr-FR", { timeZone: zone, ...options })
    : "Date indisponible";
}
