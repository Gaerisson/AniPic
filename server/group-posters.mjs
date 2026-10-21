import { z } from "zod";
import sharp from "sharp";
import path from "node:path";
import { promises as fs } from "node:fs";
import { PDFDocument } from "pdf-lib";
import QRCode from "qrcode";
import { assertStorage } from "./config.mjs";
import { sourcePhotoBuffer } from "./source-photo.mjs";
import { settings, audit } from "./db.mjs";
import { publicAsset } from "./public-assets.mjs";
import { logoPosterImage } from "./logo-poster.mjs";
const UUID = z.string().uuid();
export const groupPosterOptions = z
  .object({
    animals: z
      .array(
        z
          .object({ id: UUID, source: z.enum(["auto", "spa"]).default("auto") })
          .strict(),
      )
      .min(1)
      .max(60),
    template: z
      .enum(["spa", "editorial", "glass", "polaroid", "logo-mosaic"])
      .default("spa"),
    format: z.enum(["A4", "A3", "A2"]).default("A3"),
    title: z.string().trim().min(1).max(90).default("Les regards du refuge"),
    subtitle: z
      .string()
      .trim()
      .max(180)
      .default("Ils attendent leur famille. Et si c’était vous ?"),
    footer: z
      .string()
      .trim()
      .max(180)
      .default("Venez les rencontrer au refuge"),
    accent: z
      .string()
      .regex(/^#[a-fA-F0-9]{6}$/)
      .default("#ee7029"),
    names: z.boolean().default(true),
    columns: z.number().int().min(0).max(6).default(0),
    qrUrl: z.union([z.literal(""), z.string().url().max(500)]).default(""),
    output: z.enum(["preview", "png", "pdf"]).default("preview"),
  })
  .strict();
const esc = (s) =>
  String(s ?? "").replace(
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
const image = (b, mime = "image/jpeg") =>
  `data:${mime};base64,${b.toString("base64")}`;
function lines(text, max) {
  const words = text.split(/\s+/),
    rows = [""];
  for (const w of words) {
    if ((rows.at(-1) + " " + w).length > max && rows.at(-1)) rows.push(w);
    else rows[rows.length - 1] += (rows.at(-1) ? " " : "") + w;
  }
  return rows;
}
export async function groupPosterImage(c, items, input, logoBuffer) {
  const o = groupPosterOptions.parse(input),
    w = 1240,
    h = 1754;
  if (o.template === "logo-mosaic")
    return logoPosterImage(
      items,
      o,
      logoBuffer,
      await publicAsset("spa-lettering.png"),
    );
  const dark = o.template === "editorial" || o.template === "glass",
    ink = dark ? "#fcfaf7" : "#24211f",
    muted = dark ? "#d0cbd4" : "#625a52";
  const cols = Math.max(
    o.columns ||
      (items.length <= 2
        ? items.length
        : items.length <= 6
          ? 2
          : items.length <= 15
            ? 3
            : items.length <= 28
              ? 4
              : items.length <= 45
                ? 5
                : 6),
    Math.ceil(items.length / 10),
  );
  const rows = Math.ceil(items.length / cols),
    gap = 20,
    pad = 64,
    top = 310,
    bottom = 158,
    cw = (w - pad * 2 - gap * (cols - 1)) / cols,
    ch = (h - top - bottom - gap * (rows - 1)) / rows;
  const images = [];
  for (const [i, item] of items.entries()) {
    const caption = o.names ? Math.min(52, ch * 0.23) : 0,
      inset = o.template === "polaroid" ? 12 : o.template === "glass" ? 8 : 0;
    const iw = cw - inset * 2,
      ih = ch - caption - inset * 2;
    const img = await sharp(item.buffer, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(
        Math.max(20, Math.ceil(iw * 2.4)),
        Math.max(20, Math.ceil(ih * 2.4)),
        { fit: "cover", position: "attention" },
      )
      .jpeg({ quality: 91 })
      .toBuffer();
    const rowCount = Math.min(cols, items.length - Math.floor(i / cols) * cols);
    const x = pad + ((cols - rowCount) / 2 + (i % cols)) * (cw + gap),
      y = top + Math.floor(i / cols) * (ch + gap),
      clip = `photo${i}`;
    const brush = o.template === "spa";
    const shape = brush
      ? `<path d="M0 3 L${iw * 0.35} 0 L${iw} 3 L${iw - 5} ${ih * 0.18} L${iw} ${ih * 0.21} L${iw - 3} ${ih * 0.45} L${iw} ${ih * 0.49} L${iw - 4} ${ih * 0.76} L${iw} ${ih * 0.8} L${iw - 2} ${ih} L${iw * 0.55} ${ih - 2} L0 ${ih} L4 ${ih * 0.72} L0 ${ih * 0.68} L4 ${ih * 0.4} L0 ${ih * 0.36}Z"/>`
      : `<rect width="${iw}" height="${ih}" rx="${o.template === "editorial" ? 4 : 14}"/>`;
    const rotation =
      o.template === "polaroid" ? [1.3, -1.1, 0.6, -0.8][i % 4] : 0;
    const nameSize = Math.min(
      24,
      Math.max(11, cw * 0.11),
      cw / (Math.max(1, item.name.length) * 0.58),
    );
    images.push(`<g transform="translate(${x},${y}) rotate(${rotation},${cw / 2},${ch / 2})">
      ${o.template === "glass" ? `<rect width="${cw}" height="${ch}" rx="22" fill="url(#glass)" stroke="#ffffff55"/><path d="M20 1H${cw - 20}" stroke="#ffffff88"/>` : o.template === "polaroid" ? `<rect width="${cw}" height="${ch}" rx="3" fill="#fffdf8" filter="url(#shadow)"/>` : ""}
      <g transform="translate(${inset},${inset})"><defs><clipPath id="${clip}">${shape}</clipPath></defs><image width="${iw}" height="${ih}" href="${image(img)}" clip-path="url(#${clip})" preserveAspectRatio="xMidYMid slice"/></g>
      ${o.names ? `<text x="${cw / 2}" y="${ch - caption * 0.37}" font-family="DejaVu Sans,Arial" font-size="${nameSize}" font-weight="bold" text-anchor="middle" fill="${o.template === "polaroid" ? "#24211f" : ink}">${esc(item.name)}</text>` : ""}</g>`);
  }
  let qr = "";
  if (o.qrUrl) {
    const b = await QRCode.toBuffer(o.qrUrl, {
      width: 240,
      margin: 2,
      color: { dark: "#181818", light: "#ffffff" },
    });
    qr = `<rect x="1055" y="1592" width="110" height="110" rx="12" fill="#fff"/><image x="1060" y="1597" width="100" height="100" href="${image(b, "image/png")}"/>`;
  }
  const titleLines = lines(o.title, 31).slice(0, 3),
    titleSize = Math.min(52, 132 / titleLines.length);
  const sub = lines(o.subtitle, 85).slice(0, 2),
    foot = lines(o.footer, o.qrUrl ? 70 : 92).slice(0, 2);
  const bg =
    o.template === "glass"
      ? `<rect width="1240" height="1754" fill="#17202d"/><ellipse cx="65" cy="140" rx="700" ry="700" fill="url(#glow)"/><ellipse cx="1150" cy="1300" rx="680" ry="700" fill="url(#blue)"/>`
      : o.template === "editorial"
        ? `<rect width="1240" height="1754" fill="#15191e"/><rect width="14" height="1754" fill="${o.accent}"/>`
        : `<rect width="1240" height="1754" fill="${o.template === "spa" ? "#fffaf3" : "#eee8df"}"/><path d="M64 42H1176" stroke="${o.accent}" stroke-width="7"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1240" height="1754" viewBox="0 0 1240 1754"><defs>
    <radialGradient id="glow"><stop stop-color="${o.accent}" stop-opacity=".65"/><stop offset="1" stop-color="${o.accent}" stop-opacity="0"/></radialGradient><radialGradient id="blue"><stop stop-color="#5a89d6" stop-opacity=".55"/><stop offset="1" stop-color="#5a89d6" stop-opacity="0"/></radialGradient>
    <linearGradient id="glass" x2="1" y2="1"><stop stop-color="#ffffff" stop-opacity=".19"/><stop offset="1" stop-color="#ffffff" stop-opacity=".04"/></linearGradient><filter id="shadow" x="-10%" y="-10%" width="125%" height="130%"><feDropShadow dx="0" dy="5" stdDeviation="6" flood-opacity=".15"/></filter></defs>${bg}
    <text x="64" y="83" fill="${dark ? "#ffd9b6" : o.accent}" font-size="14" letter-spacing="3" font-family="DejaVu Sans,Arial">UNE RENCONTRE PEUT TOUT CHANGER</text>
    ${titleLines.map((s, i) => `<text x="60" y="${137 + i * titleSize * 1.06}" fill="${ink}" font-family="DejaVu Sans,Arial" font-weight="bold" font-size="${Math.min(titleSize, 900 / Math.max(1, s.length * 0.6))}">${esc(s)}</text>`).join("")}
    ${sub.map((s, i) => `<text x="64" y="${251 + i * 25}" font-family="DejaVu Sans,Arial" font-size="20" fill="${muted}">${esc(s)}</text>`).join("")}
    <image x="1050" y="74" width="116" height="130" href="${image(logoBuffer, "image/png")}" preserveAspectRatio="xMidYMid meet"/>
    ${images.join("")}<path d="M64 1623H${o.qrUrl ? 1020 : 1176}" stroke="${o.accent}" stroke-width="3"/>
    ${foot.map((s, i) => `<text x="64" y="${1661 + i * 25}" font-family="DejaVu Sans,Arial" font-size="19" fill="${ink}">${esc(s)}</text>`).join("")}${qr}
    <text x="64" y="1721" font-size="12" font-family="DejaVu Sans,Arial" fill="${muted}">© Gaerisson · AniPic · ${items.length} portraits · ${esc(o.format)}</text></svg>`;
  const width =
    o.output === "preview" ? 868 : { A4: 2480, A3: 3508, A2: 4960 }[o.format];
  return sharp(Buffer.from(svg), {
    density: 72 * (width / 1240),
    limitInputPixels: 40_000_000,
  })
    .png()
    .toBuffer();
}
export async function registerGroupPosters(app, { db, c, authorized }) {
  let active = false;
  app.post(
    "/api/group-posters",
    {
      preHandler: async (req, reply) => {
        if (req.user)
          return authorized([
            "admin",
            "editor",
            "agent",
            "volunteer",
            "viewer",
          ])(req, reply);
        if (settings(db).publicPosters === false)
          return reply
            .code(403)
            .send({ error: "Affiches publiques désactivées." });
        if (req.headers.origin !== c.origin)
          return reply.code(403).send({ error: "Origine refusée." });
      },
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      bodyLimit: 100_000,
    },
    async (req, reply) => {
      const o = groupPosterOptions.parse(req.body);
      if (active)
        return reply.code(409).send({
          error:
            "Une affiche est déjà en préparation. Réessayez dans un instant.",
        });
      active = true;
      try {
        assertStorage(c);
        const pending = [],
          seen = new Set();
        for (const entry of o.animals) {
          if (seen.has(entry.id)) continue;
          seen.add(entry.id);
          const a = db
            .prepare("SELECT * FROM animals WHERE id=?")
            .get(entry.id);
          if (
            !a ||
            db
              .prepare("SELECT 1 FROM settings WHERE key='animalTrash:'||?")
              .get(a.id)
          )
            return reply
              .code(404)
              .send({ error: "Un animal sélectionné n’existe plus." });
          const photo =
            entry.source !== "spa"
              ? db
                  .prepare(
                    "SELECT p.hash FROM photos p WHERE animal_id=? AND hidden=0 AND deleted_at IS NULL AND archived_at IS NULL ORDER BY id=? DESC,created_at DESC LIMIT 1",
                  )
                  .get(a.id, a.cover_id || "")
              : null;
          pending.push({ a, photo });
        }
        // Three bounded workers reuse the shared SPA cache, preserving selection order.
        const items = new Array(pending.length);
        let cursor = 0,
          unavailable = "";
        await Promise.all(
          Array.from({ length: Math.min(3, pending.length) }, async () => {
            while (!unavailable && cursor < pending.length) {
              const index = cursor++,
                { a, photo } = pending[index];
              try {
                const buffer = photo
                  ? await fs.readFile(path.join(c.mediaDir, photo.hash))
                  : await sourcePhotoBuffer(db, c, a.id, 1280);
                items[index] = { name: a.name, buffer };
              } catch {
                unavailable ||= a.name;
              }
            }
          }),
        );
        if (unavailable)
          return reply.code(422).send({
            error: `Photo indisponible pour ${unavailable}. Choisissez une autre source ou retirez cet animal.`,
          });
        const png = await groupPosterImage(
          c,
          items,
          o,
          await publicAsset("spa-logo.png"),
        );
        reply.header("Cache-Control", "private, no-store");
        if (o.output === "preview") return reply.type("image/png").send(png);
        audit(db, req.user, "group_poster_exported", {
          count: items.length,
          template: o.template,
          format: o.format,
        });
        reply.header(
          "Content-Disposition",
          `attachment; filename="affiche-refuge-${o.template}-${o.format}.${o.output}"`,
        );
        if (o.output === "png") return reply.type("image/png").send(png);
        const pdf = await PDFDocument.create(),
          size = {
            A4: [595.276, 841.89],
            A3: [841.89, 1190.551],
            A2: [1190.551, 1683.78],
          }[o.format];
        pdf.setTitle(o.title);
        pdf.setAuthor("Gaerisson");
        pdf.setCreator("AniPic");
        const embedded = await pdf.embedPng(png),
          page = pdf.addPage(size);
        page.drawImage(embedded, {
          x: 0,
          y: 0,
          width: size[0],
          height: size[1],
        });
        return reply
          .type("application/pdf")
          .send(Buffer.from(await pdf.save()));
      } finally {
        active = false;
      }
    },
  );
}
