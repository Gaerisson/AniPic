import { hasAnimalInfo } from "../shared/animal-info.mjs";
import sharp from "sharp";
import { z } from "zod";
import path from "node:path";
import { ZipFile } from "yazl";
import { createReadStream } from "node:fs";
const xml = (value) =>
  String(value ?? "").replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
let active = 0;
const queue = [];
async function limit(fn) {
  if (active >= 2) await new Promise((resolve) => queue.push(resolve));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    queue.shift()?.();
  }
}
export async function exportPhoto(
  c,
  photo,
  { format = "jpeg", size = "medium", layout = "fit" } = {},
) {
  const dimensions = { small: 800, medium: 1920, large: 3200, social: 1080 };
  if (
    !["jpeg", "png", "webp"].includes(format) ||
    !dimensions[size] ||
    !["fit", "square", "portrait"].includes(layout)
  )
    throw Object.assign(new Error("Format de téléchargement invalide."), {
      statusCode: 400,
    });
  return limit(async () => {
    let image = sharp(photo.buffer || path.join(c.mediaDir, photo.hash), {
      limitInputPixels: 40_000_000,
    }).rotate();
    const width = dimensions[size];
    if (layout === "fit")
      image = image.resize(width, width, {
        fit: "inside",
        withoutEnlargement: true,
      });
    else
      image = image.resize(1080, layout === "portrait" ? 1350 : 1080, {
        fit: "contain",
        background: "#f4efe7",
      });
    return image
      .toFormat(
        format,
        format === "png" ? { compressionLevel: 6 } : { quality: 92 },
      )
      .toBuffer();
  });
}
export function albumZip(c, animal, photos) {
  if (photos.length > 2000)
    throw Object.assign(
      new Error(
        "Album trop volumineux pour un export unique. Sélectionnez les photos par lots.",
      ),
      { statusCode: 413 },
    );
  const zip = new ZipFile();
  for (const [index, photo] of photos.entries()) {
    const filename =
      path.basename(photo.filename).replace(/[\x00-\x1f<>:"/\\|?*]/g, "_") ||
      "photo";
    zip.addFile(
      path.join(c.mediaDir, photo.hash),
      `${String(index + 1).padStart(4, "0")}_${filename}`,
      { compress: false },
    );
  }
  zip.end();
  return zip.outputStream;
}
export async function presentationCard(c, animal, photo, input = {}) {
  const o = z
    .object({
      format: z.enum(["portrait", "square", "story"]).default("portrait"),
      style: z.enum(["banner", "glass", "minimal"]).default("glass"),
      accent: z
        .string()
        .regex(/^#[a-fA-F0-9]{6}$/)
        .default("#f4ab70"),
      cta: z.string().max(80).default("Venez me rencontrer"),
      refuge: z.string().max(100).default("Refuge de Morée"),
      facts: z.enum(["0", "1"]).default("1"),
      preview: z.enum(["0", "1"]).default("0"),
    })
    .parse(input);
  const width = 1080,
    height = o.format === "story" ? 1920 : o.format === "square" ? 1080 : 1350;
  const panel = o.format === "square" ? 300 : 390;
  return limit(async () => {
    const image = await sharp(
      photo.buffer || path.join(c.mediaDir, photo.hash),
      {
        limitInputPixels: 40_000_000,
      },
    )
      .rotate()
      .resize(width, o.style === "banner" ? height - panel : height, {
        fit: "cover",
        position: "attention",
      })
      .toBuffer();
    const top = height - panel;
    const name = animal.name.slice(0, 55),
      font = Math.min(84, Math.max(28, 930 / (name.length * 0.59)));
    const details = [
      (hasAnimalInfo(animal.breed) ? animal.breed : "") ||
        { dog: "Chien", cat: "Chat", other: "NAC" }[animal.species],
      animal.sex === "female" ? "Femelle" : animal.sex === "male" ? "Mâle" : "",
      animal.birth_date
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - Date.parse(animal.birth_date)) / 31557600000,
            ),
          ) + " ans"
        : "",
    ]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 65);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${height}"><defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#0d1118" stop-opacity="0"/><stop offset="1" stop-color="#0d1118" stop-opacity=".95"/></linearGradient></defs>${o.style === "glass" ? `<rect y="${top - 160}" width="1080" height="${panel + 160}" fill="url(#fade)"/>` : o.style === "minimal" ? `<rect x="32" y="${top}" width="1016" height="${panel - 12}" rx="30" fill="#11151b" fill-opacity=".84"/>` : `<rect y="${top}" width="1080" height="${panel}" fill="#171a20"/>`}<rect x="60" y="${top + 40}" width="45" height="5" rx="2" fill="${o.accent}"/><text x="60" y="${top + 145}" fill="#fff" font-size="${font}" font-weight="bold" font-family="DejaVu Sans,Arial">${xml(name)}</text>${o.facts === "1" ? `<text x="64" y="${top + 198}" fill="#e5e5e5" font-size="${Math.min(25, 940 / (Math.max(1, details.length) * 0.6))}" font-family="DejaVu Sans,Arial">${xml(details)}</text>` : ""}<text x="64" y="${top + 254}" fill="${o.accent}" font-size="25" font-weight="bold" font-family="DejaVu Sans,Arial">${xml(o.cta.slice(0, 65))}</text>${o.refuge ? `<text x="64" y="${height - (o.format === "square" ? 20 : 52)}" fill="#d1d1d1" font-size="${o.format === "square" ? 16 : 21}" font-family="DejaVu Sans,Arial">${xml(o.refuge.slice(0, 70))}</text>` : ""}</svg>`;
    const composite = sharp({
      create: { width, height, channels: 3, background: "#171a20" },
    }).composite([
      { input: image, top: 0, left: 0 },
      { input: Buffer.from(svg) },
    ]);
    if (o.preview !== "1") return composite.jpeg({ quality: 92 }).toBuffer();
    // Composite first: Sharp executes resize before composite even when chained afterwards.
    const { data, info } = await composite
      .raw()
      .toBuffer({ resolveWithObject: true });
    return sharp(data, {
      raw: { width: info.width, height: info.height, channels: info.channels },
    })
      .resize(540)
      .jpeg({ quality: 80 })
      .toBuffer();
  });
}
export const originalStream = (c, photo) =>
  createReadStream(path.join(c.mediaDir, photo.hash));
