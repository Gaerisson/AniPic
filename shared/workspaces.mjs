export const workspaceGroups = [
  {
    id: "configuration",
    parent: "settings",
    label: "Configuration",
    admin: true,
    pages: [
      ["settings", "Général"],
      ["modules", "Fonctions"],
      ["api", "Connexions"],
      ["sync", "Synchronisation SPA"],
      ["storage", "Stockage"],
      ["backups", "Sauvegardes"],
      ["legalSettings", "Mentions & confidentialité"],
    ],
  },
  {
    id: "administration",
    parent: "dashboard",
    label: "Administration",
    admin: true,
    pages: [
      ["dashboard", "Vue d’ensemble"],
      ["users", "Équipe & accès"],
      ["visitors", "Visiteurs"],
      ["journal", "Journal"],
      ["messages", "Messages"],
    ],
  },
  {
    id: "photos",
    parent: "todo",
    label: "Photos & séances",
    pages: [
      ["todo", "Planning photo"],
      ["inbox", "À trier"],
      ["print", "Feuille de séance"],
      ["editor", "Retouche photo"],
    ],
  },
  {
    id: "planning",
    parent: "volunteers",
    label: "Organisation du refuge",
    pages: [
      ["volunteers", "Présences & missions"],
      ["agenda", "Agenda partagé"],
    ],
  },
  {
    id: "account",
    parent: "accountHub",
    label: "Mon compte",
    pages: [
      ["accountHub", "Compte, appareils & notifications"],
      ["appOptions", "Mon application"],
    ],
  },
];
export function workspaceFor(page) {
  return workspaceGroups.find((group) =>
    group.pages.some(([key]) => key === page),
  );
}
export function workspaceParent(page) {
  return workspaceFor(page)?.parent || page;
}
