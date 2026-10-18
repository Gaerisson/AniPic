import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Camera,
  Film,
  MonitorPlay,
  Printer,
  CalendarDays,
  Newspaper,
} from "lucide-react";

// Editable composition made from the project's demonstration captures.
// No live installation, account data or remote assets are used.
const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "docs/images");
const uri = (bytes, mime = "image/png") =>
  `data:${mime};base64,${bytes.toString("base64")}`;
const screenshot = async (file, crop) => {
  let image = sharp(path.join(root, file));
  if (crop) image = image.extract(crop);
  return uri(await image.png().toBuffer());
};
const home = await screenshot("public/presentation-v32/home.png");
const studio = await screenshot("public/presentation-v32/studio.png", {
  left: 250,
  top: 380,
  width: 1095,
  height: 665,
});
const tv = await screenshot("docs/images/readme-tv.png");
const logo = uri(
  await fs.readFile(path.join(root, "public/anipic-logo.svg")),
  "image/svg+xml",
);
const icon = (component, x, y, size = 26, color = "#ff995b") =>
  renderToStaticMarkup(
    createElement(component, {
      x,
      y,
      width: size,
      height: size,
      color,
      strokeWidth: 1.7,
    }),
  );
const pill = (
  x,
  width,
  component,
  title,
) => `<rect x="${x}" y="1455" width="${width}" height="54" rx="27" fill="#ffffff08" stroke="#ffffff18"/>
  ${icon(component, x + 21, 1468, 27)}<text x="${x + 62}" y="1489" font-size="23" fill="#d9d5d0">${title}</text>`;
const windowTitle = (x, y, component, title, subtitle) => `
  ${icon(component, x + 25, y + 25, 26)}
  <text x="${x + 69}" y="${y + 47}" font-size="27" font-weight="700" fill="#faf5ed">${title}</text>
  <text x="${x + 25}" y="${y + 82}" font-size="20" fill="#aaa7a5">${subtitle}</text>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="2000" height="1560" viewBox="0 0 2000 1560" role="img" aria-labelledby="title desc">
<title id="title">AniPic — les images du refuge, de la photothèque à l’écran TV</title>
<desc id="desc">Vues de démonstration de la photothèque, du studio vidéo et d’un portrait diffusé sur la TV du refuge. Photos, affiches, gazette et agenda dans AniPic, conçu par Gaerisson.</desc>
<defs>
  <linearGradient id="base" x2="1" y2="1"><stop stop-color="#17171c"/><stop offset="1" stop-color="#0c0f13"/></linearGradient>
  <radialGradient id="warm"><stop stop-color="#f07831" stop-opacity=".22"/><stop offset="1" stop-color="#f07831" stop-opacity="0"/></radialGradient>
  <radialGradient id="cool"><stop stop-color="#406888" stop-opacity=".19"/><stop offset="1" stop-color="#406888" stop-opacity="0"/></radialGradient>
  <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#3b3430" stop-opacity=".72"/><stop offset="1" stop-color="#1c2027" stop-opacity=".93"/></linearGradient>
  <linearGradient id="edge"><stop stop-color="#ffb47d" stop-opacity=".58"/><stop offset=".6" stop-color="#ffffff" stop-opacity=".16"/><stop offset="1" stop-color="#ffffff" stop-opacity=".06"/></linearGradient>
  <filter id="shadow" x="-25%" y="-20%" width="150%" height="160%"><feDropShadow dx="0" dy="26" stdDeviation="28" flood-color="#000" flood-opacity=".4"/></filter>
  <clipPath id="home"><rect x="81" y="424" width="1158" height="988" rx="0"/></clipPath>
  <clipPath id="studio"><rect x="1306" y="443" width="612" height="369" rx="16"/></clipPath>
  <clipPath id="tv"><rect x="1306" y="1053" width="612" height="344" rx="16"/></clipPath>
  <clipPath id="homeFrame"><rect x="80" y="350" width="1160" height="1062" rx="28"/></clipPath>
  <clipPath id="canvas"><rect width="2000" height="1560" rx="36"/></clipPath>
</defs>
<g font-family="Arial, sans-serif" clip-path="url(#canvas)">
  <rect width="2000" height="1560" rx="36" fill="url(#base)"/>
  <ellipse cx="230" cy="220" rx="1050" ry="790" fill="url(#warm)"/>
  <ellipse cx="1740" cy="1200" rx="1000" ry="850" fill="url(#cool)"/>
  <path d="M80 314H1920" stroke="#ffffff12"/>
  <image x="70" y="36" width="270" height="87" xlink:href="${logo}"/>
  <rect x="1482" y="63" width="438" height="43" rx="21.5" fill="#ffffff07" stroke="#ffffff1a"/>
  <circle cx="1510" cy="85" r="4" fill="#ff995b"/>
  <text x="1530" y="92" font-size="19" letter-spacing="1.3" fill="#dbd5ce">POUR LES ÉQUIPES DU REFUGE</text>
  <text x="80" y="215" font-size="78" font-weight="700" letter-spacing="-3.2" fill="#faf5ed">Le refuge, côté images<tspan fill="#f58b4f">.</tspan></text>
  <text x="84" y="270" font-size="29" fill="#bdb7b0">Photos, affiches, vidéos et vie d’équipe. Un même espace.</text>
  <text x="1918" y="249" text-anchor="end" font-size="21" fill="#bdb7b0">Conçu par <tspan fill="#f3dfca" font-weight="700">Gaerisson</tspan></text>

  <rect x="80" y="350" width="1160" height="1062" rx="28" fill="url(#glass)" stroke="url(#edge)" filter="url(#shadow)"/>
  ${icon(Camera, 106, 373, 28)}
  <text x="153" y="399" font-size="28" font-weight="700" fill="#faf5ed">La photothèque</text>
  <text x="1211" y="396" text-anchor="end" font-size="20" fill="#c8b8a9">Photos &amp; fiches animaux</text>
  <g clip-path="url(#homeFrame)"><g clip-path="url(#home)">
    <image x="81" y="424" width="1158" height="1019" preserveAspectRatio="xMinYMin meet" xlink:href="${home}"/>
  </g></g>

  <rect x="1280" y="350" width="640" height="510" rx="28" fill="url(#glass)" stroke="url(#edge)" filter="url(#shadow)"/>
  ${windowTitle(1280, 350, Film, "Le studio vidéo", "Des portraits aux bilans de l’année.")}
  <image x="1306" y="443" width="612" height="369" preserveAspectRatio="xMidYMid slice" clip-path="url(#studio)" xlink:href="${studio}"/>
  <text x="1307" y="840" font-size="19" fill="#d5c1ae">Stories · Films · Animations du logo SPA</text>

  <rect x="1280" y="898" width="640" height="514" rx="28" fill="url(#glass)" stroke="url(#edge)" filter="url(#shadow)"/>
  ${windowTitle(1280, 898, MonitorPlay, "L’écran du refuge", "Le programme de l’accueil, depuis le web.")}
  <rect x="1306" y="1019" width="612" height="378" rx="18" fill="#080b0f" stroke="#ffffff18"/>
  <rect x="1513" y="1030" width="198" height="4" rx="2" fill="#fa8b4f"/>
  <image x="1306" y="1053" width="612" height="344" preserveAspectRatio="xMidYMid meet" clip-path="url(#tv)" xlink:href="${tv}"/>

  ${pill(80, 302, Printer, "Affiches &amp; réseaux")}
  ${pill(406, 236, Newspaper, "Gazette")}
  ${pill(666, 276, CalendarDays, "Agenda partagé")}
  <text x="1920" y="1486" text-anchor="end" font-size="20" fill="#a9a6a4">© Gaerisson · Vibecodé avec Codex</text>
</g>
</svg>`;
await fs.mkdir(output, { recursive: true });
await sharp(Buffer.from(svg))
  .png({ compressionLevel: 9 })
  .toFile(path.join(output, "anipic-overview.png"));
console.log(
  "Visuel README généré : docs/images/anipic-overview.png (2000 × 1560).",
);
