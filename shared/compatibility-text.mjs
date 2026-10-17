export function labelledCompatibility(value = "") {
  const input = String(value).replace(/\*/g, ""),
    matches = [
      ...input.matchAll(
        /\b(?:ententes?\s+)?(chats?|chiens?|enfants?)\s*[:;]\s*/gi,
      ),
    ],
    result = {};
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i],
      key = m[1].toLowerCase().replace(/s$/, ""),
      raw = input
        .slice(m.index + m[0].length, matches[i + 1]?.index ?? input.length)
        .split(/\bTous les membres\b/i)[0]
        .split(
          /(?<=[.!])\s+(?=[A-ZÀ-Ý][\p{L}'’\-]*\s+(?:est\s+en\s+SOS|est\s+arriv[ée]|a\s+[ée]t[ée]\s+recueilli)\b)/u,
        )[0]
        .replace(/[\s;|·\-–—]+$/, "")
        .trim()
        .slice(0, 240);
    if (raw && !/^[.\s…·_\-–—]+$/.test(raw))
      result[key] = raw.replace(/^a tester$/i, "À tester");
  }
  return result;
}
export function normalizeCompatibility(values = {}) {
  const result = {};
  for (const [key, value] of Object.entries(values || {})) {
    const raw = String(value ?? "").trim();
    if (/\b(?:ententes?\s+)?(?:chats?|chiens?|enfants?)\s*[:;]/i.test(raw))
      Object.assign(result, labelledCompatibility(`${key}: ${raw}`));
    else
      result[key] = raw
        .split(
          /(?<=[.!])\s+(?=[A-ZÀ-Ý][\p{L}'’\-]*\s+(?:est\s+en\s+SOS|est\s+arriv[ée]|a\s+[ée]t[ée]\s+recueilli)\b)/u,
        )[0]
        .trim();
  }
  return result;
}
export function compatibilityState(value) {
  const raw = String(value ?? "")
    .trim()
    .toLocaleLowerCase("fr")
    .replace(/[.!\s]+$/g, "");
  if (/^(non testé|non teste|pas testé|pas teste|inconnu|à tester)/.test(raw))
    return "unknown";
  if (/^(oui|ok|yes|true|1)$/.test(raw)) return "yes";
  if (/^(non|ko|no|false|0|pas ok)$/.test(raw)) return "no";
  return "unknown";
}
