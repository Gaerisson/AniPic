import { seasonalTheme } from "./content-defaults.mjs";
export const visualThemes = {
  classic: {
    name: "Classique",
    accent: "#ffb575",
    start: "#63391f",
    end: "#12141b",
    particle: "paws",
  },
  halloween: {
    name: "Halloween",
    accent: "#ffb362",
    start: "#582073",
    end: "#170f2e",
    particle: "season",
  },
  christmas: {
    name: "Noël",
    accent: "#ffe1a8",
    start: "#7e2339",
    end: "#1c293b",
    particle: "snow",
  },
  easter: {
    name: "Pâques",
    accent: "#f6d291",
    start: "#5b436c",
    end: "#223a43",
    particle: "season",
  },
  summer: {
    name: "Été",
    accent: "#ffe3a1",
    start: "#1c677c",
    end: "#173148",
    particle: "bokeh",
  },
};
export function visualTheme(id = "classic", day) {
  const key = id === "auto" ? seasonalTheme(day) : id;
  return {
    ...(visualThemes[key] || visualThemes.classic),
    id: visualThemes[key] ? key : "classic",
  };
}
export const particleStyles = {
  auto: "Selon la saison",
  dust: "Poussière lumineuse",
  bokeh: "Bulles de lumière",
  snow: "Neige",
  paws: "Patounes",
  confetti: "Confettis",
  stars: "Étoiles",
  none: "Aucun",
};
export const logoAnimations = {
  fade: "Fondu · photos dans le logo",
  mosaic: "Assemblage de la mosaïque",
  sweep: "Dévoilement lumineux",
  bloom: "Éclosion en douceur",
  prism: "Prisme en relief",
};
export function scheduleRows(text) {
  return String(text || "")
    .split(/[\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((s) => {
      const m = s.match(
        /^(.{2,32}?)(?:\s*:\s*|\s+(?=\d{1,2}(?:h|:)|ferm[ée]))(.+)$/i,
      );
      return m ? { day: m[1], hours: m[2] } : { day: "Au refuge", hours: s };
    });
}
