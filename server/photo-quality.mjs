import sharp from "sharp";

// Relative technical indicators, never a judgement of the animal or its expression.
export async function photoQuality(buffer) {
  const image = sharp(buffer, { limitInputPixels: 40e6 }).rotate();
  const original = await image.metadata();
  const { data, info } = await image
    .clone()
    .flatten({ background: "#fff" })
    .resize(320, 320, { fit: "inside", withoutEnlargement: true })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let sum = 0,
    dark = 0,
    light = 0,
    lap = 0,
    square = 0,
    n = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    dark += data[i] < 16;
    light += data[i] > 242;
  }
  for (let y = 1; y < info.height - 1; y++)
    for (let x = 1; x < info.width - 1; x++) {
      const i = y * info.width + x,
        v =
          4 * data[i] -
          data[i - 1] -
          data[i + 1] -
          data[i - info.width] -
          data[i + info.width];
      lap += v;
      square += v * v;
      n++;
    }
  const sharpness = Math.max(
      0,
      square / Math.max(1, n) - (lap / Math.max(1, n)) ** 2,
    ),
    shadows = dark / data.length,
    highlights = light / data.length,
    brightness = sum / data.length,
    megapixels = (original.width * original.height) / 1e6;
  const warnings = [];
  if (sharpness < 45) warnings.push("Netteté à vérifier");
  if (shadows > 0.4 || brightness < 55) warnings.push("Image sombre");
  if (highlights > 0.4 || brightness > 220)
    warnings.push("Hautes lumières à vérifier");
  if (Math.min(original.width, original.height) < 600)
    warnings.push("Petite définition pour l’impression");
  return {
    width: original.width,
    height: original.height,
    megapixels: +megapixels.toFixed(2),
    sharpness: Math.round(sharpness),
    brightness: Math.round(brightness),
    shadows: Math.round(shadows * 100),
    highlights: Math.round(highlights * 100),
    score: Math.round(
      Math.min(65, Math.log2(1 + sharpness) * 7) +
        Math.max(0, 25 - Math.abs(brightness - 130) / 5) +
        Math.min(10, megapixels * 5) -
        (shadows + highlights) * 20,
    ),
    warnings,
  };
}
