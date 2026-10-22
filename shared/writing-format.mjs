export function leadCompatibilityEmojis(text) {
  return String(text)
    .split("\n")
    .map((line) =>
      line.replace(
        /^([ \t]*(?:[-•]\s*)?)(?:(?:🐱|🐈|🐶|🐕|👶|👧)\s*)?(\*{0,2}Ententes?\s+(chats?|chiens?|enfants?)\*{0,2})(\s*[:;])?(.*)$/iu,
        (_, prefix, label, subject, punctuation = "", rest) => {
          const icon = /^chat/i.test(subject)
            ? "🐱"
            : /^chien/i.test(subject)
              ? "🐶"
              : "👶";
          const value = rest
            .replace(/\s*(?:🐱|🐈|🐶|🐕|👶|👧)\s*([.!?…]*)$/u, "$1")
            .replace(/^\s*(?:🐱|🐈|🐶|🐕|👶|👧)\s*/u, " ");
          return `${prefix}${icon} ${label}${punctuation}${value}`;
        },
      ),
    )
    .join("\n");
}
