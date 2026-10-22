export const moduleCatalog = Object.freeze([
  {
    id: "photoEditor",
    name: "Édition photo",
    description: "Retouche et atelier photo",
    pages: ["editor"],
    api: ["/api/photo-edits", "/api/workshop/photos", "/api/photo-workshop"],
  },
  {
    id: "video",
    name: "Studio vidéo",
    description: "Montages, bilan annuel et exports vidéo",
    pages: ["studio", "motion"],
    api: ["/api/video", "/api/motion", "/api/annual"],
  },
  {
    id: "signage",
    name: "Affichage dynamique",
    description: "Programme TV et suivi des écrans",
    pages: ["displaySettings", "display"],
    api: ["/api/public/display", "/api/admin/display", "/api/display"],
  },
  {
    id: "posters",
    name: "Affiches",
    description: "Fiches de box, affiches collectives et bannières",
    pages: ["posters", "groupPoster", "wallpaper"],
    api: [
      "/api/posters",
      "/api/group-posters",
      "/api/public/posters",
      "/api/communication",
      "/api/wallpaper",
    ],
  },
  {
    id: "broadcasts",
    name: "Vidéos C8",
    description: "Catalogue et lecture des émissions",
    pages: ["broadcasts"],
    api: ["/api/broadcasts"],
  },
  {
    id: "albums",
    name: "Albums privés",
    description: "Albums et sous-dossiers de l’équipe",
    pages: ["collections"],
    api: ["/api/collections"],
  },
  {
    id: "planning",
    name: "Planning des bénévoles",
    description: "Créneaux, inscriptions et présences du jour",
    pages: ["volunteers", "polls"],
    api: ["/api/volunteers", "/api/team-polls"],
  },
  {
    id: "writing",
    name: "Rédaction et relecture",
    description: "Présentations d’animaux et propositions de corrections",
    pages: ["writing"],
    api: ["/api/writing"],
  },
  {
    id: "assistant",
    name: "Assistant",
    description: "Recherche et assistant IA de l’équipe",
    pages: [],
    api: ["/api/team-ai", "/api/assistant/chat", "/api/assistant/answer"],
  },
  {
    id: "gazette",
    name: "Gazette",
    description: "Création et export de la gazette du refuge",
    pages: [],
    api: ["/api/gazette"],
  },
  {
    id: "stats",
    name: "Statistiques",
    description: "Bilans du refuge",
    pages: ["stats"],
    api: ["/api/stats", "/api/insights"],
  },
]);
export const defaultModules = Object.freeze(
  Object.fromEntries(moduleCatalog.map((m) => [m.id, true])),
);
export const moduleEnabled = (config, id) => config?.[id] !== false;
export const pageModule = (page) =>
  moduleCatalog.find((m) => m.pages.includes(page))?.id;
export function apiModule(url) {
  const path = url.split("?")[0];
  if (
    /^\/api\/photos\/[^/]+\/(?:edits|edit-source)(?:\/|$)/.test(path) ||
    /^\/api\/creative\/(?:photos|cutouts|review)(?:\/|$)/.test(path)
  )
    return "photoEditor";
  if (path.startsWith("/api/creative/gazette")) return "gazette";
  if (
    path.startsWith("/api/creative/box-posters") ||
    /^\/api\/animals\/[^/]+\/communication-pack$/.test(path)
  )
    return "posters";
  if (/^\/api\/animals\/[^/]+\/poster$/.test(path)) return "posters";
  return moduleCatalog.find((m) =>
    m.api.some((prefix) => path === prefix || path.startsWith(prefix + "/")),
  )?.id;
}
