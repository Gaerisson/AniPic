import {
  textDefaults,
  posterLayoutDefaults,
} from "../shared/content-defaults.mjs";
import { sourcePhotoBuffer } from "./source-photo.mjs";
import { animalQrAddress } from "./qr.mjs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CompatibilityIcon } from "../shared/compatibility-icons.mjs";
import { z } from "zod";
import path from "node:path";
import { promises as fs } from "node:fs";
import sharp from "sharp";
import QRCode from "qrcode";
import { PDFDocument } from "pdf-lib";
import yazl from "yazl";
import { root } from "./config.mjs";
import { audit, settings } from "./db.mjs";
import { exportPhoto, presentationCard } from "./exports.mjs";
import { localPost } from "./social.mjs";
import { publicAnimalMetadata } from "./animal-facts.mjs";
import { compatibilityLabels } from "../video/facts.mjs";
const UUID = z.string().uuid();
const esc = (v) =>
  String(v ?? "").replace(
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
const fail = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });
export const communicationOptions = z.object({
  photoId: z.union([UUID, z.literal("spa")]),
  accent: z
    .string()
    .regex(/^#[a-fA-F0-9]{6}$/)
    .default("#eb783c"),
  format: z.enum(["pdf", "png", "preview"]).default("pdf"),
  paper: z.enum(["a4", "a5"]).default("a4"),
  template: z
    .enum(["spa", "editorial", "glass", "contrast", "custom"])
    .default("spa"),
  texts: z
    .object(
      Object.fromEntries(
        Object.entries(textDefaults).map(([k, v]) => [
          k,
          z.string().max(500).default(v),
        ]),
      ),
    )
    .strict()
    .default(textDefaults),
  customLayout: z
    .object(
      Object.fromEntries(
        Object.entries(posterLayoutDefaults).map(([k, v]) => [
          k,
          z
            .object({
              x: z.number().min(0).max(90),
              y: z.number().min(5).max(94),
              size: z.number().min(14).max(90),
            })
            .strict()
            .default(v),
        ]),
      ),
    )
    .strict()
    .default(posterLayoutDefaults),
  showCompatibility: z.boolean().default(true),
  showQr: z.boolean().default(true),
  focusX: z.number().min(0).max(100).default(50),
  focusY: z.number().min(0).max(100).default(50),
});
export function sourceLink(a) {
  try {
    const u = new URL(a.source_url);
    return u.origin === "https://www.la-spa.fr" &&
      /^\/(?:animal|animaux)\//.test(u.pathname) &&
      !u.username &&
      !u.password
      ? u.href
      : "";
  } catch {
    return "";
  }
}
function lines(value, max, count) {
  const words = String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .split(" "),
    result = [];
  let line = "";
  for (const raw of words) {
    const word = raw.length > max ? raw.slice(0, max - 1) + "…" : raw;
    if (line && (line + " " + word).length > max) {
      result.push(line);
      line = word;
    } else line += (line ? " " : "") + word;
  }
  if (line) result.push(line);
  return result
    .slice(0, count)
    .map((v, i) =>
      i === count - 1 && result.length > count ? v.slice(0, -1) + "…" : v,
    );
}
export async function posterImage(
  c,
  animal,
  photo,
  input,
  refuge = "Refuge de Morée",
) {
  const words = { ...textDefaults, ...input.texts };
  if (photo.buffer)
    words.posterFooter = "Informations et photo : SPA · Outil © Gaerisson";
  words.invitation = lines(words.invitation, 38, 1)[0] || "";
  words.posterTitle = String(words.posterTitle).slice(0, 55);
  words.posterFooter = String(words.posterFooter).slice(0, 120);
  const width = 1240,
    height = 1754,
    t = input.template || "spa",
    dark = t === "contrast",
    glass = t === "glass",
    institutional = t === "spa";
  const ink = dark ? "#fff9f3" : "#332c24",
    muted = dark ? "#d4c3b3" : "#70624f",
    accent = "#eb651c";
  // Register the bundled OFL web alternative with libvips/fontconfig before SVG rendering.
  await sharp({
    text: {
      text: "SPA",
      font: "Roboto",
      fontfile: path.join(root, "server/fonts/Roboto.ttf"),
      rgba: true,
    },
  })
    .png()
    .toBuffer();
  const box = institutional
    ? { x: 60, y: 460, w: 1120, h: 640 }
    : glass
      ? { x: 0, y: 0, w: 1240, h: 1150 }
      : { x: 60, y: 60, w: 1120, h: 760 };
  const horizontal =
    input.focusX < 33 ? "left" : input.focusX > 66 ? "right" : "";
  const vertical =
    input.focusY < 33 ? "top" : input.focusY > 66 ? "bottom" : "";
  const cover = await sharp(photo.buffer || path.join(c.mediaDir, photo.hash), {
    limitInputPixels: 40e6,
  })
    .rotate()
    .resize(box.w, box.h, {
      fit: "cover",
      position:
        [horizontal, vertical].filter(Boolean).join(" ") ||
        sharp.strategy.attention,
    })
    .jpeg({ quality: 95 })
    .toBuffer();
  const logo = (
    await fs
      .readFile(path.join(root, "dist/spa-logo.png"))
      .catch(() => fs.readFile(path.join(root, "public/spa-logo.png")))
  ).toString("base64");
  const meta = publicAnimalMetadata(JSON.parse(animal.source_metadata || "{}"));
  const facts = [
    { dog: "Chien", cat: "Chat", other: "NAC" }[animal.species],
    { female: "Femelle", male: "Mâle" }[animal.sex],
    meta.ageLabel,
    animal.breed,
  ]
    .filter(Boolean)
    .join(" · ");
  const status =
    animal.status === "reserved"
      ? "Réservé"
      : animal.status === "adopted"
        ? "Adopté"
        : animal.status === "source_missing"
          ? "À confirmer"
          : animal.status === "sos"
            ? "SOS · Famille recherchée"
            : "À l’adoption";
  const ententes = input.showCompatibility
    ? compatibilityLabels(JSON.parse(animal.compatibility || "{}")).slice(0, 3)
    : [];
  const text = (x, y, value, size = 24, color = ink, weight = 400) =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${esc(value)}</text>`;
  const paragraph = (
    x,
    y,
    value,
    max = 60,
    count = 4,
    size = 25,
    color = muted,
  ) =>
    lines(value, max, count)
      .map((line, i) => text(x, y + i * size * 1.45, line, size, color))
      .join("");
  const title = (x, y, max = 22) =>
    lines(animal.name, max, 2)
      .map((v, i) =>
        text(
          x,
          y + i * 77,
          v,
          animal.name.length > 25 ? 59 : 78,
          glass ? "#fff" : ink,
          800,
        ),
      )
      .join("");
  // Full logo 248 px on the A4 canvas = 42 mm (A5 = 29.6 mm), with a 55 px clear zone.
  const brand = (x, y) =>
    `<image x="${x + 55}" y="${y + 55}" width="248" height="274.1" href="data:image/png;base64,${logo}"/>`;
  const ententeLine = (x, y, e, size = 24) => {
    const icon = renderToStaticMarkup(
      createElement(CompatibilityIcon, {
        subject: e.subject,
        size: size + 6,
        color: accent,
      }),
    );
    const label = lines(
      e.text.replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, ""),
      46,
      1,
    )[0];
    return `<g transform="translate(${x},${y - size})">${icon}</g>${text(x + size + 16, y, label, size, ink, 600)}`;
  };
  const photoSvg = `<clipPath id="photo"><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="${glass ? 0 : 22}"/></clipPath><image x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" href="data:image/jpeg;base64,${cover.toString("base64")}" clip-path="url(#photo)"/>`;
  const qrAddress = animalQrAddress(animal);
  const link = input.showQr ? qrAddress.url : "";
  const qr = link
    ? await QRCode.toDataURL(link, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 220,
      })
    : "";
  const qrSvg = (x, y) =>
    qr
      ? `<rect x="${x}" y="${y}" width="164" height="164" rx="8" fill="#fff"/><image x="${x + 8}" y="${y + 8}" width="148" height="148" href="${qr}"/>`
      : "";
  let layout = "";
  if (institutional)
    layout = `${brand(60, 55)}${text(480, 110, refuge.toUpperCase().slice(0, 42), 19, muted, 600)}${text(480, 163, status.toUpperCase(), 20, accent, 700)}${title(480, 260, 16)}${paragraph(480, 380, facts, 40, 2, 24)}${photoSvg}${text(60, 1170, words.posterTitle.toUpperCase(), 19, accent, 700)}${paragraph(60, 1230, animal.description, 68, 4, 27)}${ententes.map((e, i) => ententeLine(60, 1430 + i * 41, e, 24)).join("")}${text(60, 1615, words.invitation, 28, ink, 700)}${text(60, 1653, link ? `Scannez : ${qrAddress.label.toLowerCase()}.` : "Pour en savoir plus, contactez le refuge.", 22, muted)}${qrSvg(1016, 1520)}`;
  else if (glass)
    layout = `${photoSvg}<defs><linearGradient id="glass" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity=".08"/></linearGradient><filter id="blur"><feGaussianBlur stdDeviation="28"/></filter><clipPath id="panel"><rect x="60" y="798" width="1120" height="310" rx="34"/></clipPath></defs><g clip-path="url(#panel)"><image x="0" y="0" width="1240" height="1150" href="data:image/jpeg;base64,${cover.toString("base64")}" filter="url(#blur)"/><rect x="60" y="798" width="1120" height="310" rx="34" fill="#101317" fill-opacity=".65"/><rect x="60" y="798" width="1120" height="310" rx="34" fill="url(#glass)" stroke="#fff" stroke-opacity=".55" stroke-width="2"/></g>${text(96, 855, status.toUpperCase(), 18, "#ffd8ba", 700)}${title(96, 949, 24)}${paragraph(96, 1064, facts, 65, 1, 25, "#fff")}${brand(60, 1210)}${text(475, 1220, refuge.toUpperCase().slice(0, 40), 18, accent, 700)}${paragraph(475, 1272, animal.description, 42, 4, 25)}${ententes.map((e, i) => ententeLine(475, 1465 + i * 35, e, 21)).join("")}${text(475, 1627, words.invitation, 30, ink, 700)}${qrSvg(1016, 1520)}`;
  else
    layout = `${photoSvg}<rect x="84" y="742" width="255" height="52" rx="26" fill="#fff"/>${text(108, 776, status.toUpperCase().slice(0, 24), 18, "#70624f", 700)}${title(60, 930, 25)}<rect x="64" y="1058" width="88" height="7" fill="${accent}"/>${paragraph(60, 1124, facts, 76, 2, 26, muted)}${brand(60, 1235)}${text(470, 1250, refuge.toUpperCase().slice(0, 40), 18, accent, 700)}${paragraph(470, 1305, animal.description, 43, 4, 24)}${ententes.map((e, i) => ententeLine(470, 1488 + i * 33, e, 21)).join("")}${text(470, 1650, words.invitation, 27, ink, 700)}${qrSvg(1016, 1520)}`;
  if (t === "custom") {
    const positions = { ...posterLayoutDefaults, ...input.customLayout },
      slot = (key, value, max = 65, count = 1) => {
        const b = positions[key];
        return paragraph(
          (b.x / 100) * width,
          (b.y / 100) * height,
          value,
          max,
          count,
          b.size,
          ink,
        );
      };
    layout = `${photoSvg}${brand(60, 1180)}${slot("name", animal.name, 24)}${slot("facts", facts, 70, 2)}${slot("description", animal.description, 45, 4)}${slot("cta", words.invitation, 40, 2)}${qrSvg(1016, 1520)}`;
  }
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="1240" height="1754" fill="${dark ? "#211e1a" : "#faf8f5"}"/><g font-family="Roboto,Arial,sans-serif">${layout}<path d="M60 1690H1180" stroke="${dark ? "#70624f" : "#d4c3b3"}"/>${text(60, 1723, `${words.posterFooter} · ${new Date().toLocaleDateString("fr-FR")} · ${String(animal.source_id || "").slice(0, 60)}`, 14, muted)}</g></svg>`;
  const outputWidth =
    input.format === "preview" ? 620 : input.paper === "a5" ? 1748 : 2480;
  return sharp(Buffer.from(svg))
    .resize(
      outputWidth,
      Math.round(
        outputWidth * (input.paper === "a5" ? 210 / 148 : height / width),
      ),
    )
    .withMetadata({ density: 300 })
    .png()
    .toBuffer();
}

export async function posterPdf(png, paper = "a4") {
  const doc = await PDFDocument.create();
  doc.setTitle("Affiche animal · SPA");
  doc.setCreator("Anipic · Gaerisson");
  const size = paper === "a5" ? [419.5276, 595.2756] : [595.2756, 841.8898],
    p = doc.addPage(size),
    img = await doc.embedPng(png);
  p.drawImage(img, { x: 0, y: 0, width: size[0], height: size[1] });
  return Buffer.from(await doc.save());
}
export async function registerCommunication(app, { db, c, authorized }) {
  let active = 0;
  const acquire = () => {
    if (active >= 2)
      throw fail(
        "Deux exports sont déjà en préparation. Réessayez dans un instant.",
        429,
      );
    active++;
  };
  async function selection(animalId, photoId) {
    const animal = db
      .prepare("SELECT * FROM animals WHERE id=?")
      .get(UUID.parse(animalId));
    if (!animal) throw fail("Animal introuvable.", 404);
    if (photoId === "spa")
      return {
        animal,
        photo: { buffer: await sourcePhotoBuffer(db, c, animal.id, 1280) },
      };
    const photo = db
      .prepare(
        "SELECT * FROM photos WHERE id=? AND animal_id=? AND archived_at IS NULL",
      )
      .get(UUID.parse(photoId), animal.id);
    if (!photo) throw fail("Choisissez une photo locale de cet animal.", 404);
    return { animal, photo };
  }
  app.post(
    "/api/posters/batch",
    {
      preHandler: authorized(["admin", "editor", "agent", "viewer"]),
      config: { rateLimit: { max: 4, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const v = z
        .object({
          animalIds: z.array(UUID).min(1).max(20),
          template: z
            .enum(["spa", "editorial", "glass", "contrast", "custom"])
            .default("spa"),
        })
        .strict()
        .parse(req.body);
      acquire();
      try {
        const doc = await PDFDocument.create();
        doc.setTitle("Affiches de box · SPA");
        doc.setCreator("AniPic · Gaerisson");
        let bytes = 0;
        for (const id of [...new Set(v.animalIds)]) {
          const animal = db.prepare("SELECT * FROM animals WHERE id=?").get(id);
          if (!animal) throw fail("Animal introuvable.", 404);
          let photo = db
            .prepare(
              "SELECT * FROM photos WHERE animal_id=? AND archived_at IS NULL ORDER BY id=? DESC,created_at DESC LIMIT 1",
            )
            .get(id, animal.cover_id || "");
          if (!photo) {
            photo = { buffer: await sourcePhotoBuffer(db, c, id, 1280) };
          }
          const opts = communicationOptions.parse({
            photoId: photo.id || id,
            template: v.template,
            texts: settings(db).textDefaults,
            customLayout: settings(db).posterLayout,
          });
          const png = await posterImage(
            c,
            animal,
            photo,
            opts,
            settings(db).refugeName,
          );
          bytes += png.length;
          if (bytes > 80 * 1024 ** 2)
            throw fail(
              "Export trop volumineux. Sélectionnez moins d’animaux.",
              413,
            );
          const embedded = await doc.embedPng(png),
            page = doc.addPage([595.2756, 841.8898]);
          page.drawImage(embedded, {
            x: 0,
            y: 0,
            width: 595.2756,
            height: 841.8898,
          });
        }
        audit(db, req.user, "box_posters_exported", {
          animals: v.animalIds.length,
        });
        return reply
          .header(
            "Content-Disposition",
            'attachment; filename="affiches-box-SPA.pdf"',
          )
          .type("application/pdf")
          .send(Buffer.from(await doc.save()));
      } finally {
        active--;
      }
    },
  );
  app.post(
    "/api/animals/:id/poster",
    {
      preHandler: authorized(["admin", "editor", "agent", "viewer"]),
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const input = communicationOptions.parse({
          texts: settings(db).textDefaults,
          customLayout: settings(db).posterLayout,
          ...req.body,
        }),
        { animal, photo } = await selection(req.params.id, input.photoId);
      acquire();
      try {
        const png = await posterImage(
          c,
          animal,
          photo,
          input,
          settings(db).refugeName,
        );
        const pdf = input.format === "pdf";
        reply.header(
          "Content-Disposition",
          `attachment; filename="affiche-${animal.id.slice(0, 8)}.${pdf ? "pdf" : "png"}"`,
        );
        return reply
          .type(pdf ? "application/pdf" : "image/png")
          .send(pdf ? await posterPdf(png, input.paper) : png);
      } finally {
        active--;
      }
    },
  );
  app.post(
    "/api/animals/:id/communication-pack",
    {
      preHandler: authorized(),
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const input = z
        .object({
          photoIds: z
            .array(z.union([UUID, z.literal("spa")]))
            .min(1)
            .max(8)
            .refine((v) => new Set(v).size === v.length),
          accent: z.string().regex(/^#[a-fA-F0-9]{6}$/),
          includePoster: z.boolean().default(true),
          template: communicationOptions.shape.template,
        })
        .parse(req.body);
      const { animal } = await selection(req.params.id, input.photoIds[0]);
      const photos = await Promise.all(
        input.photoIds.map(
          async (value) => (await selection(animal.id, value)).photo,
        ),
      );
      acquire();
      try {
        const zip = new yazl.ZipFile(),
          buffers = [];
        let total = 0;
        const add = (buf, name) => {
          total += buf.length;
          if (total > 100 * 1024 ** 2)
            throw fail("Pack trop volumineux. Sélectionnez moins de photos.");
          buffers.push([buf, name]);
        };
        for (let i = 0; i < photos.length; i++)
          add(
            await exportPhoto(c, photos[i], {
              format: "jpeg",
              size: "medium",
              layout: "fit",
            }),
            `photos-web/${String(i + 1).padStart(2, "0")}.jpg`,
          );
        for (const format of ["portrait", "story"])
          add(
            await presentationCard(c, animal, photos[0], {
              format,
              style: "glass",
              accent: input.accent,
              refuge: settings(db).refugeName,
            }),
            `visuel-${format === "portrait" ? "facebook" : "story"}.jpg`,
          );
        if (input.includePoster) {
          const opts = communicationOptions.parse({
            photoId: photos[0].id || "spa",
            accent: input.accent,
            template: input.template,
          });
          add(
            await posterPdf(
              await posterImage(
                c,
                animal,
                photos[0],
                opts,
                settings(db).refugeName,
              ),
            ),
            "affiche-A4.pdf",
          );
        }
        add(Buffer.from(localPost(animal)), "presentation.txt");
        add(
          Buffer.from(
            `Pack préparé avec Anipic.\nAnimal : ${animal.name}\nIdentifiant : ${animal.source_id || animal.id}\nFiche SPA : ${animal.source_url || "non fournie"}\nInformations : SPA. Photos locales : vérifier les droits avant diffusion.\nLe téléchargement ne marque pas l’animal comme publié.\n`,
          ),
          "LIRE-MOI.txt",
        );
        for (const [buf, name] of buffers) zip.addBuffer(buf, name);
        zip.end();
        audit(db, req.user, "communication_pack_exported", {
          animalId: animal.id,
          photos: photos.length,
        });
        reply.header(
          "Content-Disposition",
          `attachment; filename="communication-${animal.id.slice(0, 8)}.zip"`,
        );
        return reply.type("application/zip").send(zip.outputStream);
      } finally {
        active--;
      }
    },
  );
}
