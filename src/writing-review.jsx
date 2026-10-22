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
