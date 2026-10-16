const bounds = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 7],
];
const invalid = () =>
  new Error(
    "Cron invalide : cinq champs numériques minute heure jour mois jour-semaine (0/7 = dimanche).",
  );
export function parseCron(value) {
  if (typeof value !== "string" || value.length > 100) throw invalid();
  const fields = value.trim().split(/\s+/);
  if (fields.length !== 5) throw invalid();
  return fields.map((field, index) => {
    const [min, max] = bounds[index],
      values = new Set();
    for (const segment of field.split(",")) {
      const match = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(segment);
      if (!match) throw invalid();
      const step = Number(match[2] || 1),
        wildcard = match[1] === "*";
      const range = wildcard ? [min, max] : match[1].split("-").map(Number);
      const start = range[0],
        end = range[1] ?? (match[2] ? max : start);
      if (
        !Number.isInteger(step) ||
        step < 1 ||
        step > max - min + 1 ||
        start < min ||
        end > max ||
        start > end
      )
        throw invalid();
      for (let n = start; n <= end; n += step)
        values.add(index === 4 ? n % 7 : n);
    }
    return { values, wildcard: field.startsWith("*") };
  });
}
export function validTimeZone(zone) {
  try {
    return (
      typeof zone === "string" &&
      zone.length <= 80 &&
      !!new Intl.DateTimeFormat("en", { timeZone: zone })
    );
  } catch {
    return false;
  }
}
function clock(zone) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  });
}
function matches(fields, formatter, date) {
  const p = Object.fromEntries(
    formatter.formatToParts(date).map((p) => [p.type, Number(p.value)]),
  );
  const day = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  const [minute, hour, dom, month, dow] = fields;
  return (
    minute.values.has(p.minute) &&
    hour.values.has(p.hour) &&
    month.values.has(p.month) &&
    (dom.wildcard || dow.wildcard
      ? dom.values.has(p.day) && dow.values.has(day)
      : dom.values.has(p.day) || dow.values.has(day))
  );
}
export function cronMatches(expression, zone, date = new Date()) {
  return matches(parseCron(expression), clock(zone), date);
}
export function syncDue(cfg, last, date = new Date()) {
  if (cfg.sourceMode === "disabled" || cfg.syncScheduleMode === "manual")
    return false;
  const previous = last ? Date.parse(last) : NaN;
  if (cfg.syncScheduleMode !== "cron")
    return (
      cfg.syncIntervalHours > 0 &&
      (!Number.isFinite(previous) ||
        +date - previous >= cfg.syncIntervalHours * 3600_000)
    );
  return (
    (!Number.isFinite(previous) ||
      Math.floor(+date / 60000) > Math.floor(previous / 60000)) &&
    cronMatches(cfg.syncCron, cfg.syncTimeZone, date)
  );
}
export function nextSyncDates(cfg, from = new Date(), count = 3) {
  if (
    cfg.syncScheduleMode === "manual" ||
    (cfg.syncScheduleMode !== "cron" && !cfg.syncIntervalHours)
  )
    return [];
  if (cfg.syncScheduleMode !== "cron")
    return Array.from({ length: count }, (_, i) =>
      new Date(
        +from + (i + 1) * cfg.syncIntervalHours * 3600_000,
      ).toISOString(),
    );
  const fields = parseCron(cfg.syncCron),
    formatter = clock(cfg.syncTimeZone),
    result = [];
  // Preview is bounded to eight days, including for sparse calendars. Match
  // local minutes rather than assuming that every timezone uses whole hours.
  const start = Math.floor(+from / 60000) * 60000 + 60000;
  for (
    let time = start, limit = start + 8 * 86400_000;
    time < limit && result.length < count;
    time += 60000
  ) {
    if (matches(fields, formatter, new Date(time)))
      result.push(new Date(time).toISOString());
  }
  return result;
}
