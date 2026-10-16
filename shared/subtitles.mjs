export function validateCues(cues, duration = 600) {
  if (!Array.isArray(cues) || cues.length > 500)
    throw new Error("500 sous-titres maximum.");
  const sorted = cues
    .map((c) => ({
      start: Number(c.start),
      end: Number(c.end),
      text: String(c.text ?? "").trim(),
    }))
    .sort((a, b) => a.start - b.start);
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];
    if (
      !Number.isFinite(c.start) ||
      !Number.isFinite(c.end) ||
      c.start < 0 ||
      c.end <= c.start ||
      c.end > duration + 0.001 ||
      !c.text ||
      c.text.length > 300 ||
      (i > 0 && c.start < sorted[i - 1].end - 0.001)
    )
      throw new Error(
        "Vérifiez les durées et le texte : les sous-titres ne doivent pas se chevaucher ni dépasser le montage.",
      );
  }
  return sorted;
}
export function estimatedCues(text, start = 0, duration = 30) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const groups = [];
  let line = [];
  for (const word of words) {
    if (line.join(" ").length + word.length > 56 && line.length) {
      groups.push(line.join(" "));
      line = [];
    }
    line.push(word);
    if (/[.!?…]$/.test(word) && line.length >= 4) {
      groups.push(line.join(" "));
      line = [];
    }
  }
  if (line.length) {
    if (
      line.length < 3 &&
      groups.length &&
      groups.at(-1).length + line.join(" ").length < 85
    )
      groups[groups.length - 1] += " " + line.join(" ");
    else groups.push(line.join(" "));
  }
  let at = start;
  return groups.map((text, i) => {
    const seconds = (text.split(/\s+/).length / words.length) * duration,
      end = i === groups.length - 1 ? start + duration : at + seconds;
    const cue = {
      start: +at.toFixed(3),
      end: +end.toFixed(3),
      text: text.slice(0, 300),
    };
    at = end;
    return cue;
  });
}
const stamp = (seconds) => {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
};
export function toSrt(cues) {
  return (
    validateCues(cues)
      .map(
        (c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}`,
      )
      .join("\n\n") + "\n"
  );
}
export function parseSrt(input) {
  if (typeof input !== "string" || input.length > 200000)
    throw new Error("Fichier SRT trop volumineux.");
  const sec = (value) => {
    const m = value.match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})$/);
    if (!m || +m[2] > 59 || +m[3] > 59)
      throw new Error("Horodatage SRT invalide.");
    return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000;
  };
  const blocks = input
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean);
  const cues = blocks.map((block) => {
    const lines = block.split("\n");
    if (/^\d+$/.test(lines[0])) lines.shift();
    const times = lines.shift()?.split(/\s+-->\s+/);
    if (times?.length !== 2) throw new Error("Format SRT invalide.");
    return {
      start: sec(times[0].trim()),
      end: sec(times[1].trim()),
      text: lines.join("\n").replace(/<[^>]*>/g, ""),
    };
  });
  return validateCues(cues);
}
