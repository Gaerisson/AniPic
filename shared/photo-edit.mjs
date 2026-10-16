export const photoDefaults = {
  exposure: 0,
  contrast: 0,
  shadows: 0,
  highlights: 0,
  saturation: 100,
  temperature: 0,
  tint: 0,
  vibrance: 0,
  fade: 0,
  sharpness: 0,
  glamour: 0,
  vignette: 0,
  vignetteSize: 55,
  rotation: 0,
  mirror: false,
  crop: { x: 0, y: 0, w: 1, h: 1 },
};
export const photoPresets = [
  { id: "neutral", name: "Neutre", color: "#ada99b", values: {} },
  {
    id: "natural",
    name: "Naturel",
    color: "#8ea888",
    values: {
      exposure: 0.1,
      contrast: 8,
      shadows: 12,
      highlights: -18,
      vibrance: 16,
      sharpness: 15,
    },
  },
  {
    id: "glamour",
    name: "Glamour",
    color: "#d3a6b9",
    values: {
      exposure: 0.15,
      contrast: -8,
      highlights: -22,
      shadows: 14,
      temperature: 8,
      glamour: 48,
      fade: 6,
      vignette: 18,
    },
  },
  {
    id: "golden",
    name: "Heure dorée",
    color: "#dfad6a",
    values: {
      exposure: 0.1,
      temperature: 24,
      tint: 7,
      highlights: -25,
      shadows: 10,
      vibrance: 12,
      vignette: 20,
    },
  },
  {
    id: "cinema",
    name: "Cinéma",
    color: "#7f9fa9",
    values: {
      contrast: 18,
      saturation: 86,
      highlights: -22,
      shadows: 8,
      temperature: -7,
      fade: 10,
      vignette: 30,
    },
  },
  {
    id: "mono",
    name: "Noir & blanc",
    color: "#c6c6c6",
    values: {
      saturation: 0,
      contrast: 24,
      highlights: -15,
      shadows: 12,
      sharpness: 22,
      vignette: 24,
    },
  },
];
export function applyPhotoPreset(edit, id, strength = 100) {
  const preset = photoPresets.find((p) => p.id === id);
  if (!preset) return edit;
  const amount = Math.max(0, Math.min(1, strength / 100));
  const result = { ...edit };
  for (const [key, value] of Object.entries(photoDefaults)) {
    if (typeof value !== "number" || key === "rotation") continue;
    const precision = key === "exposure" ? 100 : 1;
    result[key] =
      Math.round(
        (value + ((preset.values[key] ?? value) - value) * amount) * precision,
      ) / precision;
  }
  return result;
}
export function adjustPixels(data, o) {
  o = { ...photoDefaults, ...o };
  const exposure = 2 ** o.exposure,
    contrast = (100 + o.contrast) / 100,
    saturation = o.saturation / 100,
    temperature = o.temperature * 0.35,
    tint = o.tint * 0.22,
    fadeScale = 1 - o.fade / 200,
    fadeLift = o.fade * 0.45;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] * exposure,
      g = data[i + 1] * exposure,
      b = data[i + 2] * exposure;
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255,
      lift =
        o.shadows * (1 - Math.min(1, lum)) ** 2 * 0.65 +
        o.highlights * Math.min(1, lum) ** 2 * 0.65;
    r = (r + lift - 128) * contrast + 128 + temperature + tint / 2;
    g = (g + lift - 128) * contrast + 128 - tint;
    b = (b + lift - 128) * contrast + 128 - temperature + tint / 2;
    const grey = 0.2126 * r + 0.7152 * g + 0.0722 * b,
      sat =
        saturation *
        (1 +
          (o.vibrance / 100) *
            (1 - Math.min(1, (Math.max(r, g, b) - Math.min(r, g, b)) / 255)));
    data[i] = Math.round(
      Math.max(
        0,
        Math.min(255, (grey + (r - grey) * sat) * fadeScale + fadeLift),
      ),
    );
    data[i + 1] = Math.round(
      Math.max(
        0,
        Math.min(255, (grey + (g - grey) * sat) * fadeScale + fadeLift),
      ),
    );
    data[i + 2] = Math.round(
      Math.max(
        0,
        Math.min(255, (grey + (b - grey) * sat) * fadeScale + fadeLift),
      ),
    );
  }
  return data;
}
export function applyPhotoOptics(data, blurred, width, height, settings) {
  const o = { ...photoDefaults, ...settings },
    c = o.crop,
    midpoint = o.vignetteSize / 100,
    glow = o.glamour / 100,
    detail = o.sharpness / 100,
    x2 = o.vignette
      ? Float32Array.from(
          { length: width },
          (_, x) => (((x + 0.5) / width - c.x - c.w / 2) / (c.w / 2)) ** 2,
        )
      : null,
    y2 = o.vignette
      ? Float32Array.from(
          { length: height },
          (_, y) => (((y + 0.5) / height - c.y - c.h / 2) / (c.h / 2)) ** 2,
        )
      : null;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const distance = x2 ? Math.sqrt((x2[x] + y2[y]) / 2) : 0;
      const t = Math.max(
          0,
          Math.min(1, (distance - midpoint) / Math.max(0.1, 1 - midpoint)),
        ),
        vignette = 1 - (o.vignette / 100) * 0.78 * t * t * (3 - 2 * t);
      for (let k = 0; k < 3; k++) {
        const base = data[i + k],
          soft = blurred?.[i + k] ?? base;
        const sharpened = base + (base - soft) * detail * 0.9;
        const softened = sharpened * (1 - glow * 0.16) + soft * glow * 0.16;
        data[i + k] = Math.max(
          0,
          Math.min(
            255,
            (softened + soft * (1 - softened / 255) * glow * 0.32) * vignette,
          ),
        );
      }
    }
  return data;
}
export function cropForAspect(width, height, ratio) {
  if (!ratio) return { x: 0, y: 0, w: 1, h: 1 };
  const source = width / height;
  if (source > ratio) {
    const w = ratio / source;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = source / ratio;
  return { x: 0, y: (1 - h) / 2, w: 1, h };
}
export async function renderEditedPhoto(
  makeCanvas,
  image,
  o,
  {
    preview = false,
    before = false,
    format = "image/jpeg",
    quality = 0.92,
  } = {},
) {
  o = { ...photoDefaults, ...o };
  const rotated = o.rotation % 180 !== 0,
    fullW = rotated ? image.height : image.width,
    fullH = rotated ? image.width : image.height,
    scale = preview ? Math.min(1, 1600 / Math.max(fullW, fullH)) : 1;
  const canvas = makeCanvas(
      Math.max(1, Math.round(fullW * scale)),
      Math.max(1, Math.round(fullH * scale)),
    ),
    ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((o.rotation * Math.PI) / 180);
  ctx.scale(o.mirror ? -1 : 1, 1);
  ctx.drawImage(
    image,
    (-image.width * scale) / 2,
    (-image.height * scale) / 2,
    image.width * scale,
    image.height * scale,
  );
  ctx.restore();
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (!before) adjustPixels(pixels.data, o);
  ctx.putImageData(pixels, 0, 0);
  if (!before && (o.sharpness || o.glamour || o.vignette)) {
    let blurred;
    if (o.sharpness || o.glamour) {
      const soft = makeCanvas(canvas.width, canvas.height),
        sctx = soft.getContext("2d", { willReadFrequently: true });
      sctx.filter = `blur(${Math.max(0.5, Math.min(canvas.width, canvas.height) * 0.006)}px)`;
      sctx.drawImage(canvas, 0, 0);
      blurred = sctx.getImageData(0, 0, canvas.width, canvas.height).data;
    }
    applyPhotoOptics(pixels.data, blurred, canvas.width, canvas.height, o);
    ctx.putImageData(pixels, 0, 0);
  }
  const histogram = Array(64).fill(0);
  for (let i = 0; i < pixels.data.length; i += 16)
    histogram[
      Math.min(
        63,
        Math.floor(
          (0.2126 * pixels.data[i] +
            0.7152 * pixels.data[i + 1] +
            0.0722 * pixels.data[i + 2]) /
            4,
        ),
      )
    ]++;
  if (preview) return { canvas, histogram, width: fullW, height: fullH };
  const crop = o.crop,
    result = makeCanvas(
      Math.max(1, Math.round(fullW * crop.w)),
      Math.max(1, Math.round(fullH * crop.h)),
    ),
    out = result.getContext("2d");
  if (format === "image/jpeg") {
    out.fillStyle = "#fff";
    out.fillRect(0, 0, result.width, result.height);
  }
  out.drawImage(
    canvas,
    Math.round(crop.x * fullW),
    Math.round(crop.y * fullH),
    result.width,
    result.height,
    0,
    0,
    result.width,
    result.height,
  );
  const blob = result.convertToBlob
    ? await result.convertToBlob({ type: format, quality })
    : await new Promise((resolve) => result.toBlob(resolve, format, quality));
  if (!blob) throw Error("Ce navigateur ne peut pas exporter ce format.");
  return { blob, width: result.width, height: result.height };
}
