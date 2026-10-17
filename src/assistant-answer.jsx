import { copyText } from "./api.js";
import { Copy, LoaderCircle } from "lucide-react";
function Inline({ text }) {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((?:https:\/\/|#)[^)]+\))/g)
    .map((part, i) => {
      if (part.startsWith("**"))
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
      const m = part.match(/^\[([^\]]+)\]\(((?:https:\/\/|#)[^)]+)\)$/);
      if (m)
        return (
          <a
            key={i}
            href={m[2]}
            target={m[2].startsWith("https:") ? "_blank" : undefined}
            rel="noreferrer"
          >
            {m[1]}
          </a>
        );
      return part;
    });
}
export function AssistantThinking() {
  return (
    <div className="assistant-thinking" role="status">
      <LoaderCircle className="spin" size={17} />
      <span>
        L’assistant prépare sa réponse<i>…</i>
      </span>
    </div>
  );
}
export function AssistantAnswer({ text }) {
  return (
    <section className="assistant-answer">
      <header>
        <strong>Réponse de l’assistant</strong>
        <button
          type="button"
          className="icon-button"
          aria-label="Copier la réponse"
          onClick={async (e) => {
            try {
              await copyText(text);
              e.currentTarget?.setAttribute("title", "Copié");
            } catch {}
          }}
        >
          <Copy size={15} />
        </button>
      </header>
      <div>
        {text
          .split(/\n\s*\n/)
          .filter(Boolean)
          .map((block, i) => {
            const lines = block.split("\n");
            if (lines.every((l) => /^\s*(?:[-*•]|\d+[.)])\s/.test(l)))
              return (
                <ul key={i}>
                  {lines.map((l, j) => (
                    <li key={j}>
                      <Inline text={l.replace(/^\s*(?:[-*•]|\d+[.)])\s/, "")} />
                    </li>
                  ))}
                </ul>
              );
            if (/^#{1,4}\s/.test(block))
              return (
                <h4 key={i}>
                  <Inline text={block.replace(/^#{1,4}\s/, "")} />
                </h4>
              );
            return (
              <p key={i}>
                {lines.map((l, j) => (
                  <span key={j}>
                    <Inline text={l} />
                    {j < lines.length - 1 && <br />}
                  </span>
                ))}
              </p>
            );
          })}
      </div>
    </section>
  );
}
