export const pageAccessDefaults = Object.freeze({
  broadcasts: "team",
  stats: "team",
  activity: "public",
});
export const pageAccessLabels = {
  broadcasts: "Vidéo C8",
  stats: "Statistiques des animaux",
  activity: "Fil du refuge et historique",
};
export function accessForPage(page, access = {}) {
  const key = ["feed", "history"].includes(page) ? "activity" : page;
  return access[key] || pageAccessDefaults[key] || "public";
}
