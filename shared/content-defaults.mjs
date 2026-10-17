export const textDefaults = {
  title: "Une nouvelle rencontre",
  subtitle: "",
  conclusion: "Merci de leur offrir une nouvelle histoire.",
  signature: "© Gaerisson",
  invitation: "Rencontrez l’équipe du refuge",
  posterTitle: "Faisons connaissance",
  posterFooter: "Informations SPA · Photos : Gaerisson",
  hours: "Horaires à consulter sur la fiche du refuge.",
  spaInfo:
    "Retrouvez les informations et les compagnons à adopter sur le site de La SPA.",
};
export const seasonDefaults = {
  classic: {
    title: "Bienvenue au refuge",
    body: "Découvrez les compagnons à rencontrer.",
  },
  halloween: {
    title: "Joyeux Halloween",
    body: "Des petites bouilles, quelques frissons et beaucoup d’affection.",
  },
  christmas: {
    title: "Joyeuses fêtes",
    body: "Merci de partager cette fin d’année avec les compagnons du refuge.",
  },
  easter: {
    title: "Joyeuses Pâques",
    body: "Toute l’équipe du refuge vous souhaite un beau week-end de Pâques.",
  },
  summer: {
    title: "Un bel été au refuge",
    body: "Pensez à garder vos compagnons au frais et à leur laisser de l’eau.",
  },
};
export function easterDay(year) {
  const a = year % 19,
    b = Math.floor(year / 100),
    c = year % 100,
    d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451),
    month = Math.floor((h + l - 7 * m + 114) / 31),
    day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day, 12));
}
export function seasonalTheme(day) {
  const date = new Date(
      (day || new Date().toISOString().slice(0, 10)) + "T12:00:00Z",
    ),
    month = date.getUTCMonth() + 1,
    d = date.getUTCDate();
  if ((month === 10 && d >= 20) || (month === 11 && d <= 2)) return "halloween";
  if (month === 12 || (month === 1 && d <= 7)) return "christmas";
  if (Math.abs(date - easterDay(date.getUTCFullYear())) <= 7 * 86400000)
    return "easter";
  if (month >= 6 && month <= 8) return "summer";
  return "classic";
}
export function messageContent(block, show = {}) {
  const theme =
      block.theme === "auto"
        ? seasonalTheme(show.calendarDate)
        : block.theme || "classic",
    defaults = { ...seasonDefaults[theme], ...show.seasonMessages?.[theme] };
  if (block.type === "hours")
    return {
      ...block,
      theme,
      title: block.title || "Horaires du refuge",
      body: block.body || show.textDefaults?.hours || textDefaults.hours,
    };
  if (block.type === "spa")
    return {
      ...block,
      theme,
      title: block.title || "La SPA",
      body: block.body || show.textDefaults?.spaInfo || textDefaults.spaInfo,
    };
  return {
    ...block,
    theme,
    title: block.title || defaults.title,
    body: block.body || defaults.body,
  };
}

export const posterLayoutDefaults = {
  name: { x: 5, y: 54, size: 72 },
  facts: { x: 5, y: 62, size: 26 },
  description: { x: 40, y: 75, size: 24 },
  cta: { x: 40, y: 92, size: 26 },
};
