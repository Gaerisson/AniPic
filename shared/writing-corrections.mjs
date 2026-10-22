import { textDiff } from "./text-diff.mjs";
export function writingCorrections(original, proposal) {
  const result = [];
  let offset = 0,
    pending = null;
  const flush = () => {
    if (pending) {
      result.push({ ...pending, id: result.length });
      pending = null;
    }
  };
  for (const part of textDiff(original, proposal)) {
    if (part.kind === "same") {
      flush();
      offset += part.text.length;
    } else {
      pending ||= { from: offset, to: offset, before: "", after: "" };
      if (part.kind === "remove") {
        pending.before += part.text;
        offset += part.text.length;
        pending.to = offset;
      } else pending.after += part.text;
    }
  }
  flush();
  return result;
}
export function localWritingIssues(text) {
  const issues = [],
    add = (pattern, replacement, message) => {
      for (const match of text.matchAll(pattern))
        issues.push({
          from: match.index,
          to: match.index + match[0].length,
          before: match[0],
          after:
            typeof replacement === "function"
              ? replacement(match)
              : replacement,
          message,
          id: "local-" + issues.length,
        });
    };
  add(/[^\S\n]{2,}/g, " ", "Espaces répétés");
  add(/\.{4,}/g, "…", "Ponctuation répétée");
  add(
    /(?<![\p{L}\p{M}\p{N}_])([\p{L}\p{M}]+)[^\S\r\n]+\1(?![\p{L}\p{M}\p{N}_])/giu,
    (m) => m[1],
    "Mot répété : à vérifier",
  );
  return issues
    .sort((a, b) => a.from - b.from)
    .filter((issue, index, all) => !index || issue.from >= all[index - 1].to);
}
