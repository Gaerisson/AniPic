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
        .split(/\bTous les membres (?:du foyer|de la famille)\b/i)[0]
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
    else result[key] = raw;
  }
  return result;
}
