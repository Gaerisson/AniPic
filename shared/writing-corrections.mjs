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

// A generation is a review session, not a target document to restore on every
// keystroke. Keep its identities and decisions while positions follow edits.
export function createWritingReview(text, proposal) {
  const issues =
    proposal == null
      ? localWritingIssues(text)
      : writingCorrections(text, proposal);
  return {
    text,
    local: proposal == null,
    nextId: issues.length,
    issues: issues.map((issue, id) => ({
      ...issue,
      id,
      status: "pending",
    })),
  };
}
export function updateWritingReview(review, text) {
  if (review.text === text) return review;
  let prefix = 0,
    suffix = 0;
  while (
    prefix < review.text.length &&
    prefix < text.length &&
    review.text[prefix] === text[prefix]
  )
    prefix++;
  while (
    suffix < review.text.length - prefix &&
    suffix < text.length - prefix &&
    review.text.at(-1 - suffix) === text.at(-1 - suffix)
  )
    suffix++;
  const edits = writingCorrections(
    review.text.slice(prefix, review.text.length - suffix),
    text.slice(prefix, text.length - suffix),
  ).map((edit) => {
    // The word diff is useful for proposals, but a manual edit can change only
    // one character inside a word. Do not invalidate its untouched neighbours.
    let { before, after } = edit;
    let from = edit.from + prefix,
      to = edit.to + prefix;
    while (before && after && before[0] === after[0]) {
      from++;
      before = before.slice(1);
      after = after.slice(1);
    }
    while (before && after && before.at(-1) === after.at(-1)) {
      to--;
      before = before.slice(0, -1);
      after = after.slice(0, -1);
    }
    return { from, to, before, after };
  });
  const next = {
    ...review,
    text,
    issues: review.issues.map((issue) => {
      let shift = 0,
        touched = false;
      for (const edit of edits) {
        if (issue.from === issue.to) {
          if (edit.from <= issue.from && edit.to >= issue.from) touched = true;
        } else if (
          (edit.from < issue.to && edit.to > issue.from) ||
          (edit.from === edit.to &&
            edit.from > issue.from &&
            edit.from < issue.to)
        )
          touched = true;
        if (edit.to <= issue.from)
          shift += edit.after.length - edit.before.length;
      }
      const from = Math.max(0, issue.from + shift),
        to = Math.max(from, issue.to + shift);
      return {
        ...issue,
        from,
        to,
        status:
          issue.status === "pending" &&
          (touched || text.slice(from, to) !== issue.before)
            ? "invalidated"
            : issue.status,
      };
    }),
  };
  if (review.local) {
    for (const issue of localWritingIssues(text)) {
      if (
        !next.issues.some(
          (old) =>
            ["pending", "ignored"].includes(old.status) &&
            old.from === issue.from &&
            old.to === issue.to &&
            old.before === issue.before &&
            old.after === issue.after,
        )
      ) {
        next.issues.push({ ...issue, id: next.nextId++, status: "pending" });
      }
    }
  }
  return next;
}
export function resolveWritingCorrection(review, id, decision) {
  const issue = review.issues.find((item) => item.id === id);
  if (!issue || issue.status !== "pending") return review;
  const next = {
    ...review,
    issues: review.issues.map((item) =>
      item.id === id
        ? { ...item, status: decision === "ignore" ? "ignored" : "applied" }
        : item,
    ),
  };
  if (decision === "ignore") return next;
  return updateWritingReview(
    next,
    review.text.slice(0, issue.from) +
      issue.after +
      review.text.slice(issue.to),
  );
}
export function applyWritingCorrections(review) {
  return review.issues
    .filter((issue) => issue.status === "pending")
    .sort((a, b) => b.from - a.from)
    .reduce(
      (current, issue) => resolveWritingCorrection(current, issue.id, "apply"),
      review,
    );
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
