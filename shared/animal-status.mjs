export const statusDefaults = {
  available: { label: "À l’adoption", color: "#a1d3b6" },
  reserved: { label: "Réservé", color: "#f6c16c" },
  adopted: { label: "Adopté", color: "#c1acf4" },
  source_missing: { label: "Absent de la source", color: "#b4becb" },
};
export const statusKeys = Object.keys(statusDefaults);

// Keep badge text readable even when a very pale or dark accent is selected.
export function statusInk(color, light = false) {
  const rgb = color
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16));
  const luminance = (channels) =>
    channels
      .map((v) => {
        const s = v / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const background = luminance(light ? [228, 228, 228] : [51, 51, 51]);
  for (let step = 0; step <= 20; step++) {
    const mixed = rgb.map((v) =>
      Math.round(v + (((light ? 0 : 255) - v) * step) / 20),
    );
    const value = luminance(mixed);
    if (
      (Math.max(value, background) + 0.05) /
        (Math.min(value, background) + 0.05) >=
      4.5
    )
      return "#" + mixed.map((v) => v.toString(16).padStart(2, "0")).join("");
  }
  return light ? "#000000" : "#ffffff";
}
