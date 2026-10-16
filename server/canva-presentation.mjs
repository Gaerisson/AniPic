import PptxGenJS from "pptxgenjs";
import { z } from "zod";
import { exportPhoto } from "./exports.mjs";
import { settings } from "./db.mjs";
import { compatibilityLabels } from "../video/facts.mjs";
import { publicCompatibility } from "./animal-facts.mjs";
import { canvaLayout } from "../shared/canva-layout.mjs";
import * as cheerio from "cheerio";
import sharp from "sharp";
export const presentationInput = z
  .object({
    animalId: z.string().uuid(),
    photoIds: z
      .array(z.string().uuid())
      .min(1)
      .max(8)
      .refine((a) => new Set(a).size === a.length),
    format: z.enum(["story", "portrait", "presentation"]).default("story"),
    preset: z.enum(["editorial", "midnight", "botanical"]).default("editorial"),
    accent: z
      .string()
      .regex(/^#[a-fA-F0-9]{6}$/)
      .default("#b45a33"),
    closing: z
      .string()
      .trim()
      .min(1)
      .max(65)
      .default("Une rencontre commence ici."),
    includeDescription: z.boolean().default(true),
    includeCompatibility: z.boolean().default(true),
  })
  .strict();
const clean = (text, max) =>
  cheerio
    .load("<body>" + String(text || "") + "</body>")("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
export function presentationPlan(db, raw) {
  const options = presentationInput.parse(raw),
    animal = db
      .prepare("SELECT * FROM animals WHERE id=?")
      .get(options.animalId);
  if (!animal)
    throw Object.assign(new Error("Animal introuvable."), { statusCode: 404 });
  const photos = options.photoIds.map((photoId) =>
    db
      .prepare("SELECT * FROM photos WHERE id=? AND animal_id=?")
      .get(photoId, animal.id),
  );
  if (photos.some((p) => !p))
    throw Object.assign(
      new Error("Sélectionnez uniquement des photos de cet animal."),
      { statusCode: 400 },
    );
  const s = settings(db);
  const facts = {
    name: clean(animal.name, 55),
    subtitle: [
      { dog: "Chien", cat: "Chat", other: "NAC" }[animal.species],
      { female: "Femelle", male: "Mâle" }[animal.sex],
      clean(animal.breed, 55),
    ]
      .filter(Boolean)
      .join(" · "),
    description: clean(
      animal.description,
      options.format === "presentation"
        ? 380
        : options.format === "portrait"
          ? 250
          : 450,
    ),
    compatibility: compatibilityLabels(
      publicCompatibility(JSON.parse(animal.compatibility || "{}")),
    )
      .map((v) => `${v.label} ${v.subject}`)
      .slice(0, 3)
      .join("\n"),
    statusLabel:
      s.statusAppearance?.[animal.status]?.label || "Statut à confirmer",
    refuge: clean(s.refugeName, 65),
    sourceUrl: /^https:\/\/(www\.)?la-spa\.fr\//.test(animal.source_url || "")
      ? animal.source_url
      : "",
  };
  return {
    animal,
    photos,
    options,
    facts,
    pages: canvaLayout(facts, options.photoIds, options),
  };
}
export const pptxMime =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export async function presentationBuffer(c, plan) {
  const pptx = new PptxGenJS(),
    { width, height } = plan.pages[0],
    inch = 144;
  pptx.defineLayout({
    name: "ANIMAL",
    width: width / inch,
    height: height / inch,
  });
  pptx.layout = "ANIMAL";
  pptx.author = "";
  pptx.subject = "Présentation d’un animal";
  pptx.title = plan.facts.name;
  pptx.lang = "fr-FR";
  pptx.theme = { headFontFace: "Arial", bodyFontFace: "Arial", lang: "fr-FR" };
  const images = new Map();
  for (const p of plan.photos) {
    // Exported JPEGs contain no EXIF/GPS; originals are never sent to Canva.
    const jpeg = await exportPhoto(c, p, {
      format: "jpeg",
      size: "medium",
      layout: "fit",
    });
    const dimensions = await sharp(jpeg).metadata();
    images.set(p.id, {
      data: "image/jpeg;base64," + jpeg.toString("base64"),
      width: dimensions.width,
      height: dimensions.height,
    });
  }
  for (const page of plan.pages) {
    const slide = pptx.addSlide();
    slide.background = { color: page.background.slice(1) };
    for (const item of page.items) {
      const box = {
        x: item.x / inch,
        y: item.y / inch,
        w: item.width / inch,
        h: item.height / inch,
      };
      if (item.type === "photo") {
        const image = images.get(item.photoId);
        slide.addImage({
          data: image.data,
          ...box,
          w: image.width / inch,
          h: image.height / inch,
          sizing: { type: "cover", w: box.w, h: box.h },
          altText: plan.facts.name,
        });
      } else if (item.type === "rect")
        slide.addShape(pptx.ShapeType.rect, {
          ...box,
          fill: { color: item.color.slice(1) },
          line: { color: item.color.slice(1), transparency: 100 },
        });
      else
        slide.addText(item.value, {
          ...box,
          fontFace: "Arial",
          fontSize: item.size / 2,
          color: item.color.slice(1),
          bold: item.bold,
          align: item.align,
          valign: "top",
          breakLine: false,
          margin: 0,
          fit: "shrink",
          paraSpaceAfter: 0,
          ...(page.label === "La rencontre" &&
          item.value.includes("la-spa.fr") &&
          plan.facts.sourceUrl
            ? { hyperlink: { url: plan.facts.sourceUrl } }
            : {}),
        });
    }
  }
  return pptx.write({ outputType: "nodebuffer", compression: true });
}
