export const canvaFormats = {
  story: { label: "Story · 9:16", width: 1080, height: 1920 },
  portrait: { label: "Publication · 4:5", width: 1080, height: 1350 },
  presentation: { label: "Présentation · 16:9", width: 1920, height: 1080 },
};
export const canvaPresets = {
  editorial: {
    label: "Éditorial",
    background: "#f6f1e8",
    ink: "#252d2b",
    muted: "#5b655f",
    accent: "#b45a33",
  },
  midnight: {
    label: "Nuit",
    background: "#172626",
    ink: "#fcf7ee",
    muted: "#b8c7be",
    accent: "#f4ab70",
  },
  botanical: {
    label: "Sauge",
    background: "#e8ede4",
    ink: "#253e35",
    muted: "#56665a",
    accent: "#48775b",
  },
};
// A shared, deterministic scene describes both the on-screen preview and editable PPTX objects.
export function canvaLayout(facts, photoIds, options) {
  const { width: w, height: h } = canvaFormats[options.format],
    palette = { ...canvaPresets[options.preset], accent: options.accent },
    landscape = w > h,
    m = w * 0.065,
    pages = [];
  const page = (label) => {
    const p = {
      label,
      width: w,
      height: h,
      background: palette.background,
      items: [],
    };
    pages.push(p);
    return p;
  };
  const rect = (p, x, y, width, height, color) =>
    p.items.push({ type: "rect", x, y, width, height, color });
  const text = (
    p,
    value,
    x,
    y,
    width,
    height,
    size,
    color = palette.ink,
    bold = false,
    align = "left",
  ) => {
    if (value)
      p.items.push({
        type: "text",
        value,
        x,
        y,
        width,
        height,
        size,
        color,
        bold,
        align,
      });
  };
  const photo = (p, index, x, y, width, height) =>
    p.items.push({
      type: "photo",
      photoId: photoIds[index],
      x,
      y,
      width,
      height,
    });
  const cover = page("Le portrait");
  if (landscape) {
    photo(cover, 0, w * 0.44, 0, w * 0.56, h);
    rect(cover, m, h * 0.19, w * 0.055, 7, palette.accent);
    text(
      cover,
      facts.statusLabel.toLocaleUpperCase("fr"),
      m,
      h * 0.25,
      w * 0.32,
      50,
      23,
      palette.accent,
      true,
    );
    text(
      cover,
      facts.name,
      m,
      h * 0.36,
      w * 0.32,
      h * 0.22,
      Math.min(92, (650 / Math.max(7, facts.name.length)) * 1.2),
      palette.ink,
      true,
    );
    text(
      cover,
      facts.subtitle,
      m,
      h * 0.62,
      w * 0.31,
      h * 0.13,
      29,
      palette.muted,
    );
    text(cover, facts.refuge, m, h * 0.88, w * 0.32, 42, 22, palette.muted);
  } else {
    const split = h * (options.format === "story" ? 0.65 : 0.59);
    photo(cover, 0, 0, 0, w, split);
    rect(cover, m, split + 55, 72, 6, palette.accent);
    text(
      cover,
      facts.statusLabel.toLocaleUpperCase("fr"),
      m + 96,
      split + 40,
      w - 2 * m - 96,
      45,
      36,
      palette.accent,
      true,
    );
    text(
      cover,
      facts.name,
      m,
      split + 112,
      w - 2 * m,
      150,
      Math.min(100, 850 / Math.max(8, facts.name.length)),
      palette.ink,
      true,
    );
    text(
      cover,
      facts.subtitle,
      m,
      split + 275,
      w - 2 * m,
      92,
      40,
      palette.muted,
    );
    text(cover, facts.refuge, m, h - 100, w - 2 * m, 80, 34, palette.muted);
  }
  if (
    (options.includeDescription && facts.description) ||
    (options.includeCompatibility && facts.compatibility)
  ) {
    const about = page("Son histoire"),
      imageW = landscape ? w * 0.48 : w,
      imageH = landscape ? h : h * 0.39,
      tx = landscape ? w * 0.54 : m,
      ty = landscape ? h * 0.12 : imageH + 70,
      tw = landscape ? w * 0.39 : w - 2 * m;
    photo(about, photoIds.length > 1 ? 1 : 0, 0, 0, imageW, imageH);
    text(
      about,
      "À la rencontre de",
      tx,
      ty,
      tw,
      60,
      landscape ? 26 : 38,
      palette.accent,
      true,
    );
    text(about, facts.name, tx, ty + 66, tw, 112, 65, palette.ink, true);
    text(
      about,
      options.includeDescription ? facts.description : "",
      tx,
      ty + 218,
      tw,
      landscape ? h * 0.37 : h * 0.25,
      landscape ? 30 : 40,
    );
    text(
      about,
      options.includeCompatibility ? facts.compatibility : "",
      tx,
      h - (landscape ? 195 : 210),
      tw,
      145,
      landscape ? 25 : 36,
      palette.muted,
    );
  }
  photoIds.slice(1).forEach((_, n) => {
    const p = page(`Photo ${n + 2}`),
      panelH = landscape ? 185 : 220;
    photo(p, n + 1, 0, 0, w, h - panelH);
    rect(p, 0, h - panelH, w, panelH, palette.background);
    text(
      p,
      facts.name,
      m,
      h - panelH + 42,
      w - 2 * m - 140,
      90,
      landscape ? 60 : 66,
      palette.ink,
      true,
    );
    text(
      p,
      `${String(n + 2).padStart(2, "0")} / ${String(photoIds.length).padStart(2, "0")}`,
      w - m - 140,
      h - panelH + 60,
      140,
      60,
      landscape ? 24 : 36,
      palette.accent,
      true,
      "right",
    );
    text(
      p,
      facts.refuge,
      m,
      h - (landscape ? 67 : 80),
      w - 2 * m,
      60,
      landscape ? 23 : 34,
      palette.muted,
    );
  });
  const end = page("La rencontre");
  photo(
    end,
    0,
    landscape ? w * 0.55 : w * 0.25,
    landscape ? h * 0.16 : h * 0.1,
    landscape ? w * 0.37 : w * 0.5,
    landscape ? h * 0.68 : h * 0.35,
  );
  const x = landscape ? m : m,
    y = landscape ? h * 0.26 : h * 0.52,
    width = landscape ? w * 0.4 : w - 2 * m;
  text(
    end,
    options.closing,
    x,
    y,
    width,
    landscape ? 215 : 210,
    landscape ? 65 : 70,
    palette.ink,
    true,
    landscape ? "left" : "center",
  );
  text(
    end,
    facts.refuge,
    x,
    y + 260,
    width,
    100,
    30,
    palette.accent,
    true,
    landscape ? "left" : "center",
  );
  text(
    end,
    facts.sourceUrl
      ? "Retrouvez sa fiche sur la-spa.fr"
      : "Contactez le refuge pour en savoir plus",
    x,
    y + 385,
    width,
    95,
    25,
    palette.muted,
    false,
    landscape ? "left" : "center",
  );
  return pages;
}
