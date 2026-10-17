import { publicFacts } from "./social.mjs";
import { settings } from "./db.mjs";
import { photoPrioritySql, photoPriority } from "../shared/photo-priority.mjs";
export const assistantTools = [
  [
    "gallery",
    "Accueil & photos",
    "Photos locales, dates des nouveautés, état de publication sur le site SPA.",
  ],
  [
    "animals",
    "Les animaux",
    "Fiches, ententes, photos SPA et locales, vidéos, publications et affichettes de box.",
  ],
  [
    "todo",
    "Planning photo",
    "Priorités SOS, séances, avancement et feuille de séance imprimable.",
  ],
  [
    "inbox",
    "Photos à trier",
    "Importer puis attribuer les photos aux animaux.",
  ],
  [
    "collections",
    "Albums privés",
    "Dossiers et sous-dossiers, images et vidéos, déplacements et corbeille.",
  ],
  [
    "studio",
    "Studio vidéo",
    "Films, bilan annuel, choix des animaux, musique, voix off, export MP4.",
  ],
  [
    "motion",
    "Fonds animés & réseaux",
    "Fonds vidéo et exports pour les réseaux, photos dans le logo SPA, styles et particules.",
  ],
  [
    "displaySettings",
    "Écran du refuge",
    "Programme TV par lien web, timeline, horaires, messages de saison, statistiques et logo SPA.",
    "admin",
  ],
  [
    "wallpaper",
    "Visuels & bannières",
    "Fonds d’écran, bannières, modèles, texte et photos.",
  ],
  ["editor", "Éditeur photo", "Retouche et recadrage avant téléchargement."],
  [
    "archives",
    "Archives",
    "Classement par espèce et année. Un archivage ne confirme pas une adoption.",
  ],
  [
    "history",
    "Fil & historique",
    "Arrivées, changements et départs observés dans les inventaires SPA.",
  ],
  [
    "settings",
    "Paramètres",
    "Thèmes, pages, stockage, accès, messages et réglages du refuge.",
    "admin",
  ],
  [
    "api",
    "API & connexions",
    "Canva OAuth, services IA, voix Mistral et synchronisation planifiée.",
    "admin",
  ],
];
export function assistantContext(db, query, history, role) {
  const tools = assistantTools.filter((t) => !t[3] || role === t[3]);
  const words = [
    ...query.split(/[^\p{L}\p{N}-]+/u),
    ...history
      .filter((m) => m.role === "user")
      .slice(-2)
      .flatMap((m) => m.content.split(/[^\p{L}\p{N}-]+/u)),
  ]
    .filter((w) => w.length > 2)
    .slice(0, 28);
  let animals = words.length
    ? db
        .prepare(
          `SELECT * FROM animals WHERE ${words.map(() => "instr(lower(name),lower(?))>0").join(" OR ")} ORDER BY archived_at IS NULL DESC,name LIMIT 8`,
        )
        .all(...words)
    : [];
  const cfg = settings(db),
    photoQuestion = /photographier|priorit|\bsos\b|sans photo/i.test(query);
  if (photoQuestion && !animals.length)
    animals = db
      .prepare(
        `SELECT a.* FROM animals a WHERE a.archived_at IS NULL AND a.status NOT IN ('adopted','source_missing') AND NOT EXISTS(SELECT 1 FROM photos p WHERE p.animal_id=a.id AND p.archived_at IS NULL AND p.deleted_at IS NULL) ORDER BY ${photoPrioritySql(cfg.photoRules)},a.created_at LIMIT 8`,
      )
      .all();
  const counts = db
    .prepare(
      "SELECT COUNT(*) animals,SUM(species='dog') dogs,SUM(species='cat') cats,SUM(species='other') nac FROM animals WHERE archived_at IS NULL",
    )
    .get();
  return {
    facts: {
      question: query,
      conversation: history,
      outils: tools.map(([id, name, description]) => ({
        id,
        name,
        description,
      })),
      animaux: animals.map((a) => ({
        ...publicFacts(a),
        identifiant_source: a.source_id || a.id,
        ...(photoQuestion
          ? { priorite_photo: photoPriority(a, cfg.photoRules) }
          : {}),
      })),
      selection_partielle: true,
      refuge: counts,
    },
    animals: animals.map((a) => ({
      id: a.id,
      name: a.name,
      species: a.species,
      sourceId: a.source_id || a.id.slice(0, 8),
      archived: !!a.archived_at,
    })),
    tools: tools
      .map((t) => ({
        ...{ id: t[0], name: t[1] },
        score: words
          .filter(
            (w) =>
              w.length > 3 &&
              !/^(comment|faire|pour|avec|dans|cette|puis|quand)$/i.test(w),
          )
          .reduce(
            (n, w) =>
              n +
              Number(
                (t[1] + " " + t[2])
                  .toLocaleLowerCase("fr")
                  .includes(w.toLocaleLowerCase("fr")),
              ),
            0,
          ),
      }))
      .filter((t) => t.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ id, name }) => ({ id, name })),
  };
}
