import { useMemo } from "react";
import { textDiff } from "../shared/text-diff.mjs";
export function WritingReview({ original, proposal }) {
  const chunks = useMemo(
    () => textDiff(original, proposal),
    [original, proposal],
  );
  const changes = chunks.filter(
    (c) => c.kind !== "same" && c.text.trim(),
  ).length;
  return (
    <section
      className="writing-comparison writing-review"
      aria-label="Corrections proposées"
    >
      <header>
        <h2>Les corrections, dans le texte</h2>
        <span>
          {changes ? `${changes} passage(s) modifié(s)` : "Texte identique"}
        </span>
      </header>
      <div className="diff-legend review-legend">
        <span>
          <del>À remplacer</del>
        </span>
        <span>
          <ins>Proposition</ins>
        </span>
        <small>Espaces et ponctuation inclus.</small>
      </div>
      <div className="diff-inline" aria-label="Texte annoté">
        {chunks.map((c, i) =>
          c.kind === "remove" ? (
            <del key={i} title={"Retirer ou remplacer : " + c.text}>
              {c.text}
            </del>
          ) : c.kind === "add" ? (
            <ins key={i} title={"Ajouter : " + c.text}>
              {c.text}
            </ins>
          ) : (
            <span key={i}>{c.text}</span>
          ),
        )}
      </div>
    </section>
  );
}
export function WritingPreview({ text }) {
  return (
    <div className="writing-rich-preview writing-preview">
      {String(text)
        .split(/\n\s*\n/)
        .map((p, i) => (
          <p key={i}>
            {p
              .split(/(\*\*[^*]+\*\*)/)
              .map((s, j) =>
                s.startsWith("**") && s.endsWith("**") ? (
                  <strong key={j}>{s.slice(2, -2)}</strong>
                ) : (
                  s
                ),
              )}
          </p>
        ))}
    </div>
  );
}
