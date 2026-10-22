export const appDestinations = [
  { page: "mobile", name: "Refuge", symbol: "home" },
  { page: "feed", name: "Fil", symbol: "feed" },
  { page: "mobilePhotos", name: "Photos", symbol: "photos" },
  { page: "collections", name: "Albums", symbol: "albums", module: "albums" },
  { page: "broadcasts", name: "C8", symbol: "tv", module: "broadcasts" },
  {
    page: "volunteers",
    name: "Planning",
    symbol: "planning",
    module: "planning",
  },
  { page: "posters", name: "Affiches", symbol: "posters", module: "posters" },
  { page: "writing", name: "Rédaction", symbol: "writing", module: "writing" },
  { page: "stats", name: "Stats", symbol: "stats", module: "stats" },
  { page: "polls", name: "Sondages", symbol: "polls", module: "planning" },
];
export const appWidgets = {
  recap: "Récapitulatif du refuge",
  pending: "Adoptions à confirmer",
  feed: "Dernières nouvelles",
  today: "Équipe et missions du jour",
  shortcuts: "Mes raccourcis",
  portraits: "Nouveaux portraits",
  notifications: "Mes notifications",
};
export const appPreferenceDefaults = {
  nav: ["mobile", "feed", "mobilePhotos", "collections", "broadcasts"],
  widgets: ["recap", "pending", "feed", "today", "shortcuts", "portraits"],
  largeText: false,
  reduceMotion: false,
};
export function normalizeAppPreferences(value = {}) {
  const unique = (values, allowed) => [
    ...new Set(
      (Array.isArray(values) ? values : []).filter((x) => allowed.includes(x)),
    ),
  ];
  const nav = unique(
    value.nav,
    appDestinations.map((d) => d.page),
  ).filter((p) => p !== "mobile");
  return {
    nav: [
      "mobile",
      ...(Array.isArray(value.nav) ? nav : appPreferenceDefaults.nav.slice(1)),
    ].slice(0, 5),
    widgets: Array.isArray(value.widgets)
      ? unique(value.widgets, Object.keys(appWidgets))
      : appPreferenceDefaults.widgets,
    largeText: value.largeText === true,
    reduceMotion: value.reduceMotion === true,
  };
}
export function readAppPreferences(storage) {
  try {
    return normalizeAppPreferences(
      JSON.parse(
        (storage || globalThis.localStorage).getItem(
          "anipic-app-preferences-v1",
        ) || "{}",
      ),
    );
  } catch {
    return normalizeAppPreferences();
  }
}
export function saveAppPreferences(value, storage = globalThis.localStorage) {
  const normalized = normalizeAppPreferences(value);
  storage.setItem("anipic-app-preferences-v1", JSON.stringify(normalized));
  globalThis.dispatchEvent?.(new Event("anipic-app-preferences"));
  return normalized;
}
