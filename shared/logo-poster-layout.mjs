// Rectangles are entirely inside the hexagon, so neither faces nor names get clipped.
export function logoPosterLayout(count) {
  if (!Number.isInteger(count) || count < 1 || count > 60)
    throw new RangeError("1 à 60 portraits attendus");
  const cols = Math.max(
    3,
    Math.min(9, Math.ceil(Math.sqrt(count * 0.9) * 1.2)),
  );
  const width = 1040,
    height = 1150,
    gap = 9,
    cw = (width - gap * (cols - 1)) / cols;
  const insetAt = (y) =>
    (Math.max(0, (0.24 - y) / 0.24, (y - 0.76) / 0.24) * width) / 2;
  let slots = [],
    rows = 3,
    ch;
  for (; rows <= 24; rows++) {
    ch = (height - gap * (rows - 1)) / rows;
    slots = [];
    for (let row = 0; row < rows; row++) {
      const y = row * (ch + gap),
        inset = Math.max(insetAt(y / height), insetAt((y + ch) / height));
      const n = Math.floor((width - 2 * inset + gap) / (cw + gap));
      for (let col = 0; col < n; col++)
        slots.push({
          x: (width - n * cw - (n - 1) * gap) / 2 + col * (cw + gap),
          y,
          w: cw,
          h: ch,
        });
    }
    if (slots.length >= count) break;
  }
  // Balance complete centered rows; spare capacity never leaves holes between portraits.
  const groups = [...Map.groupBy(slots, (s) => s.y).values()].map((row) => ({
    row,
    quota: (row.length * count) / slots.length,
    n: Math.floor((row.length * count) / slots.length),
  }));
  let remaining = count - groups.reduce((sum, g) => sum + g.n, 0);
  for (const g of [...groups].sort((a, b) => b.quota - b.n - (a.quota - a.n)))
    if (remaining > 0 && g.n < g.row.length) {
      g.n++;
      remaining--;
    }
  return groups.flatMap((g) =>
    Array.from({ length: g.n }, (_, i) => ({
      x: 100 + (width - g.n * cw - (g.n - 1) * gap) / 2 + i * (cw + gap),
      y: 355 + g.row[0].y,
      w: cw,
      h: ch,
    })),
  );
}
