const drawableTypes = new Set([
  "rect",
  "circle",
  "textbox",
  "itext",
  "text",
  "image",
  "group",
  "triangle",
  "line",
  "path",
  "polygon",
  "polyline",
]);
const objectTypes = new Set([
  ...drawableTypes,
  "shadow",
  "linear",
  "radial",
  "brightness",
  "contrast",
  "saturation",
  "blur",
  "grayscale",
]);
export const canvasFormats = [
  { id: "banner", name: "Bannière panoramique", width: 1920, height: 720 },
  { id: "facebook", name: "Couverture Facebook", width: 1640, height: 624 },
  { id: "square", name: "Publication carrée", width: 1080, height: 1080 },
  { id: "story", name: "Story / téléphone", width: 1080, height: 1920 },
  { id: "poster", name: "Affiche A4", width: 2480, height: 3508 },
];
export function allowedCanvasImage(src) {
  return (
    typeof src === "string" &&
    (/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z\d+/=]+$/.test(src) ||
      /^\/media\/[a-f\d-]{36}(?:\?w=\d+)?$/.test(src) ||
      /^\/api\/animals\/[a-f\d-]{36}\/source-photo(?:\?w=\d+)?$/.test(src) ||
      ["/spa-logo.png", "/anipic-icon.svg"].includes(src))
  );
}
// Fabric serializes HTMLImageElement.src as an absolute URL. Keep only our own
// origin's approved paths portable across a localhost preview and the NAS.
export function canonicalCanvasDocument(doc, origin) {
  const walk = (value) => {
    if (Array.isArray(value)) return value.map(walk);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => {
        if (
          key === "src" &&
          typeof entry === "string" &&
          /^https?:\/\//.test(entry)
        ) {
          const url = new URL(entry);
          if (url.origin === origin) entry = url.pathname + url.search;
        }
        return [key, walk(entry)];
      }),
    );
  };
  return walk(doc);
}
export function validateCanvasDocument(doc) {
  const fail = (text) => {
    throw Object.assign(new Error(text), { statusCode: 400 });
  };
  if (
    !doc ||
    doc.schema !== 1 ||
    !Number.isInteger(doc.width) ||
    !Number.isInteger(doc.height) ||
    doc.width < 100 ||
    doc.height < 100 ||
    doc.width > 8000 ||
    doc.height > 8000 ||
    doc.width * doc.height > 16000000
  )
    fail("Format du visuel invalide (16 mégapixels maximum).");
  if (!Array.isArray(doc.scene?.objects) || doc.scene.objects.length > 250)
    fail("250 éléments maximum par visuel.");
  if (JSON.stringify(doc).length > 10000000)
    fail("Projet trop volumineux. Réduisez les images importées.");
  let nodes = 0;
  const walk = (value, depth = 0) => {
    if (++nodes > 30000 || depth > 24) fail("Projet trop complexe.");
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      if (value.length > 4000) fail("Trop de points dans une forme.");
      for (const entry of value) walk(entry, depth + 1);
      return;
    }
    for (const [key, entry] of Object.entries(value)) {
      if (["__proto__", "constructor", "prototype"].includes(key))
        fail("Propriété de projet interdite.");
      if (key === "type" && !objectTypes.has(String(entry).toLowerCase()))
        fail("Élément de visuel non pris en charge.");
      if (
        key === "objects" &&
        (!Array.isArray(entry) ||
          entry.some(
            (object) => !drawableTypes.has(String(object?.type).toLowerCase()),
          ))
      )
        fail("Calque de visuel non pris en charge.");
      if (key === "src" && !allowedCanvasImage(entry))
        fail(
          "Les images doivent provenir d’AniPic ou d’un import PNG, JPEG ou WebP.",
        );
      if (
        typeof entry === "number" &&
        (!Number.isFinite(entry) || Math.abs(entry) > 1000000)
      )
        fail("Dimension d’élément invalide.");
      walk(entry, depth + 1);
    }
  };
  walk(doc.scene);
  return doc;
}
export function canvasHistoryPush(history, value, maxBytes = 24000000) {
  if (history.at(-1) === value) return history;
  const result = [...history, value];
  let bytes = result.reduce((n, s) => n + s.length * 2, 0);
  while (result.length > 2 && (result.length > 30 || bytes > maxBytes))
    bytes -= result.shift().length * 2;
  return result;
}
