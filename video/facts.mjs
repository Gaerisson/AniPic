export function compatibilityLabels(values = {}) {
  return Object.entries(values).map(([key, value]) => {
    const k = key.toLowerCase();
    const subject = /chat|cat/.test(k)
      ? "Chats"
      : /chien|dog/.test(k)
        ? "Chiens"
        : /enfant|child|kid/.test(k)
          ? "Enfants"
          : key.charAt(0).toUpperCase() + key.slice(1);
    const icon =
      subject === "Chats"
        ? "🐱"
        : subject === "Chiens"
          ? "🐶"
          : subject === "Enfants"
            ? "👧"
            : "🐾";
    const raw = String(value).trim(),
      v = raw.toLowerCase();
    const label = /^(ok|oui|yes|true|1)$/.test(v)
      ? "OK"
      : /^(ko|non|no|false|0)$/.test(v)
        ? "Pas OK"
        : /^(inconnu|unknown|à tester|a tester|n\/a|null|)$/.test(v)
          ? "À confirmer"
          : raw.charAt(0).toUpperCase() + raw.slice(1);
    return {
      subject,
      icon,
      label,
      text: ["OK", "Pas OK", "À confirmer"].includes(label)
        ? `${icon} ${label} ${subject}`
        : `${icon} ${subject} : ${label}`,
    };
  });
}
