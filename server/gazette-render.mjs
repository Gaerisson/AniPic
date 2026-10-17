import sharp from "sharp";
import { gazetteOptions } from "./gazette-data.mjs";
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
export function gazetteLines(value, width) {
  const rows = [];
  for (const paragraph of String(value || "").split(/\n/)) {
    let line = "";
    for (const part of paragraph.split(/\s+/))
      for (const word of part.match(new RegExp(`.{1,${width}}`, "gu")) || [
        "",
      ]) {
        if (line && (line + " " + word).length > width) {
          rows.push(line);
          line = word;
        } else line += (line ? " " : "") + word;
      }
    rows.push(line);
  }
  return rows;
}
const short = (value, max) =>
  value.length > max ? value.slice(0, max - 1) + "…" : value;
const dateLabel = (value) =>
  new Date(value + "T12:00:00Z").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
export const agendaLabels = {
  open_day: "Portes ouvertes",
  collection: "Collecte solidaire",
  event: "Événement",
  appointment: "Rendez-vous",
  other: "À noter",
};
function drawing(o, logo) {
  const dark = o.template === "glass",
    ink = dark ? "#fff8f3" : "#29221f",
    muted = dark ? "#dfd2ca" : "#6a5d55",
    background = dark
      ? "#211b27"
      : o.template === "editorial"
        ? "#fff8ee"
        : "#fffdfb",
    accent = dark ? "#ffae77" : "#cf501c",
    panel = dark ? "#3d2e40" : "#fff0e4";
  const text = (x, y, s, size = 24, fill = ink, weight = 400) =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}">${esc(s)}</text>`;
  const paragraph = (
    x,
    y,
    s,
    chars,
    max = 999,
    size = 24,
    fill = ink,
    weight = 400,
  ) =>
    gazetteLines(s, chars)
      .slice(0, max)
      .map((line, i) => text(x, y + i * size * 1.4, line, size, fill, weight))
      .join("");
  const rect = (x, y, w, h, fill = panel, r = 22) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
  const paw = (x, y) =>
    `<g transform="translate(${x} ${y})" fill="${accent}" opacity=".4"><ellipse cx="0" cy="16" rx="20" ry="15"/><ellipse cx="-23" cy="-7" rx="8" ry="12"/><ellipse cx="-8" cy="-20" rx="8" ry="12"/><ellipse cx="10" cy="-20" rx="8" ry="12"/><ellipse cx="25" cy="-5" rx="8" ry="12"/></g>`;
  const image = (p, x, y, w, h) =>
    p.jpeg
      ? `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><clipPath id="round"><rect width="${w}" height="${h}" rx="18"/></clipPath></defs><image width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#round)" href="data:image/jpeg;base64,${p.jpeg.toString("base64")}"/></svg>`
      : rect(x, y, w, h, dark ? "#302738" : "#f6e9de") +
        paw(x + w / 2, y + h / 2 - 10) +
        text(x + 22, y + h - 20, "Photo indisponible", 18, muted);
  const brand = (x, y, w = 116, h = 130) =>
    `<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${logo.toString("base64")}"/>`;
  return {
    dark,
    ink,
    muted,
    background,
    accent,
    panel,
    text,
    paragraph,
    rect,
    image,
    brand,
  };
}
async function pictures(portraits) {
  const cache = new Map(),
    result = [];
  for (const p of portraits) {
    let jpeg;
    if (p.buffer) {
      if (!cache.has(p.buffer))
        cache.set(
          p.buffer,
          await sharp(p.buffer)
            .rotate()
            .flatten({ background: "#fff" })
            .resize(1100, 850, { fit: "cover", position: "attention" })
            .jpeg({ quality: 88 })
            .toBuffer(),
        );
      jpeg = cache.get(p.buffer);
    }
    result.push({ ...p, jpeg });
  }
  return result;
}
export async function gazettePages(c, input, stats, portraits, refuge, logo) {
  const o = gazetteOptions.parse(input),
    d = drawing(o, logo),
    {
      text,
      paragraph,
      rect,
      image,
      brand,
      ink,
      muted,
      accent,
      background,
      dark,
    } = d,
    photos = await pictures(portraits),
    month = new Date(o.month + "-15T12:00:00Z").toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  const svgs = [],
    continuations = [];
  const push = (body) =>
    svgs.push(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1754">${rect(0, 0, 1240, 1754, background, 0)}${dark ? '<ellipse cx="-90" cy="180" rx="900" ry="600" fill="#56324c" opacity=".3"/>' : ""}<g font-family="Roboto,Arial,sans-serif">${text(70, 92, short(refuge.toUpperCase(), 70), 19, muted, 600)}${brand(1054, 55)}${body}<path d="M70 1640H1170" stroke="${dark ? "#70596c" : "#dbc9bb"}"/>${text(70, 1685, "Photos : équipe / SPA · AniPic © Gaerisson", 18, muted)}<text x="1170" y="1685" text-anchor="end" font-size="16" fill="${muted}">${esc(month)} · ${svgs.length + 1}</text></g></svg>`,
      ),
    );
  const shownArrivals = stats.arrivals || [],
    shownAdoptions = stats.adopted || [];
  const intro = gazetteLines(o.introduction, 77);
  if (intro.length > 7)
    continuations.push({ title: "L’édito · suite", lines: intro.slice(7) });
  let cover =
    text(70, 190, month.toUpperCase(), 23, accent, 700) +
    paragraph(70, 265, o.title, 36, 3, 48, ink, 700) +
    intro
      .slice(0, 7)
      .map((s, i) => text(70, 465 + i * 37, s, 26, muted))
      .join("");
  [
    [shownArrivals.length, "arrivée(s) dans cette édition"],
    [shownAdoptions.length, "adoption(s) dans cette édition"],
    [stats.present, "à rencontrer aujourd’hui"],
  ].forEach(([n, label], i) => {
    cover +=
      rect(70 + i * 375, 760, 350, 160) +
      text(95 + i * 375, 834, n, 54, accent, 700) +
      text(95 + i * 375, 881, label, 18, muted);
  });
  photos.slice(0, 4).forEach((p, i) => {
    const x = 70 + (i % 2) * 565,
      y = 960 + Math.floor(i / 2) * 310;
    cover +=
      image(p, x, y, 540, 235) +
      text(x + 12, y + 269, short(p.name, 35), 23, ink, 600);
  });
  if (!photos.length)
    cover += paragraph(
      70,
      1060,
      "Les rencontres et les nouvelles du mois, les dates à retenir et le mot de l’équipe.",
      65,
      5,
      34,
      muted,
    );
  push(cover);
  for (const [section, title, subtitle] of [
    [
      "adoption",
      "Ils ont trouvé leur famille",
      "Les adoptions datées de cette édition",
    ],
    ["arrival", "Bienvenue au refuge", "Les arrivées datées de cette édition"],
    [
      "spotlight",
      "Les regards du refuge",
      "Les portraits choisis par l’équipe",
    ],
  ]) {
    const items = photos.filter((p) => (p.section || "spotlight") === section);
    for (let offset = 0; offset < items.length; offset += 6) {
      let body =
        text(70, 215, title, 49, ink, 700) + text(70, 268, subtitle, 23, muted);
      const batch = items.slice(offset, offset + 6);
      batch.forEach((p, i) => {
        const date = p.date
          ? `${section === "adoption" ? "Adoption" : "Arrivée"} le ${dateLabel(p.date)}`
          : p.label || "";
        let x,
          y,
          photoX,
          photoY,
          photoW,
          photoH,
          textX,
          nameY,
          dateY,
          noteY,
          nameWidth,
          nameSize,
          noteWidth,
          noteSize,
          noteLimit;
        if (batch.length === 1) {
          x = 70;
          y = 320;
          body += rect(x, y, 1100, 1210);
          photoX = x + 16;
          photoY = y + 16;
          photoW = 1068;
          photoH = 750;
          textX = x + 28;
          nameY = y + 825;
          dateY = y + 940;
          noteY = y + 990;
          nameWidth = 46;
          nameSize = 40;
          noteWidth = 78;
          noteSize = 25;
          noteLimit = 6;
        } else if (batch.length === 2) {
          x = 70;
          y = 320 + i * 605;
          body += rect(x, y, 1100, 585);
          photoX = x + 16;
          photoY = y + 16;
          photoW = 490;
          photoH = 553;
          textX = x + 540;
          nameY = y + 90;
          dateY = y + 250;
          noteY = y + 310;
          nameWidth = 23;
          nameSize = 37;
          noteWidth = 42;
          noteSize = 23;
          noteLimit = 7;
        } else {
          const height = Math.floor(1260 / Math.ceil(batch.length / 2)) - 16;
          x = 70 + (i % 2) * 565;
          y = 320 + Math.floor(i / 2) * (height + 16);
          body += rect(x, y, 540, height);
          photoX = x + 16;
          photoY = y + 16;
          photoW = 508;
          photoH = height - 190;
          textX = x + 22;
          nameY = y + photoH + 56;
          dateY = y + photoH + 118;
          noteY = y + photoH + 154;
          nameWidth = 26;
          nameSize = gazetteLines(p.name, 26).length > 1 ? 28 : 34;
          noteWidth = 51;
          noteSize = 19;
          noteLimit = 2;
        }
        body +=
          image(p, photoX, photoY, photoW, photoH) +
          paragraph(
            textX,
            nameY,
            p.name,
            nameWidth,
            batch.length === 2 ? 3 : 2,
            nameSize,
            ink,
            700,
          ) +
          paragraph(
            textX,
            dateY,
            date,
            batch.length === 2 ? 40 : 64,
            1,
            batch.length <= 2 ? 24 : 20,
            accent,
            600,
          );
        const notes = gazetteLines(p.note || p.description || "", noteWidth);
        body += notes
          .slice(0, noteLimit)
          .map((line, j) =>
            text(textX, noteY + j * noteSize * 1.4, line, noteSize, muted),
          )
          .join("");
        if (p.note && notes.length > noteLimit)
          continuations.push({
            title: p.name + " · suite",
            lines: notes.slice(noteLimit),
          });
        if (p.jpeg)
          body +=
            rect(
              photoX + 12,
              photoY + photoH - 42,
              150,
              30,
              dark ? "#211b27" : "#fffdfb",
              10,
            ) +
            text(
              photoX + 24,
              photoY + photoH - 21,
              p.originLabel || "Photo équipe",
              15,
              ink,
            );
      });
      push(body);
    }
  }
  const dates = [...o.keyDates].sort(
    (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
  );
  for (let offset = 0; offset < dates.length; offset += 3) {
    let body =
      text(70, 215, "Les dates à retenir", 49, ink, 700) +
      text(70, 268, "On se retrouve au refuge", 23, muted);
    dates.slice(offset, offset + 3).forEach((event, i) => {
      const y = 315 + i * 425,
        parts = event.date.split("-"),
        m = new Date(event.date + "T12:00:00Z").toLocaleDateString("fr-FR", {
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        });
      body +=
        rect(70, y, 1100, 400) +
        rect(92, y + 24, 138, 140, dark ? "#61404c" : "#ffdbbe", 18) +
        text(118, y + 93, +parts[2], 56, accent, 700) +
        text(107, y + 135, m, 16, muted, 600) +
        text(
          258,
          y + 36,
          agendaLabels[event.category].toUpperCase(),
          17,
          accent,
          700,
        ) +
        paragraph(258, y + 82, event.title, 48, 2, 31, ink, 700);
      const lines = gazetteLines(event.description, 76);
      if (lines.length > 7)
        continuations.push({
          title: event.title + " · suite",
          lines: lines.slice(7),
        });
      body +=
        lines
          .slice(0, 7)
          .map((line, j) => text(258, y + 165 + j * 26, line, 20, muted))
          .join("") +
        paragraph(
          258,
          y + 373,
          [
            event.time ? `${event.time.replace(":", " h ")}` : "",
            event.location,
          ]
            .filter(Boolean)
            .join(" · "),
          78,
          1,
          19,
          accent,
          600,
        );
    });
    push(body);
  }
  const stories = [
    ...continuations,
    { title: "La vie du refuge", lines: gazetteLines(o.events, 82) },
    {
      title: "Le mot de l’équipe",
      lines: gazetteLines(
        o.teamNote ||
          "Merci aux bénévoles, aux équipes et aux familles qui prennent soin de nos animaux.",
        82,
      ),
    },
  ].filter((s) => s.lines.some(Boolean));
  let body = text(70, 215, "Les nouvelles de l’équipe", 48, ink, 700),
    y = 330;
  for (const story of stories) {
    if (y > 1430) {
      push(body);
      body = text(70, 215, "Les nouvelles · suite", 48, ink, 700);
      y = 330;
    }
    body += paragraph(70, y, story.title, 55, 2, 30, accent, 700);
    y += gazetteLines(story.title, 55).slice(0, 2).length * 42 + 18;
    for (const line of story.lines) {
      if (y > 1490) {
        push(body);
        body = text(70, 215, "Les nouvelles · suite", 48, ink, 700);
        y = 330;
      }
      body += text(70, y, line, 25, muted);
      y += 36;
    }
    y += 65;
  }
  body += paragraph(70, 1570, o.signature, 85, 2, 21, accent, 600);
  push(body);
  const pages = [];
  for (const svg of svgs) pages.push(await sharp(svg).png().toBuffer());
  return pages;
}
export async function gazetteSocial(input, stats, portraits, refuge, logo) {
  const o = gazetteOptions.parse(input),
    { text, paragraph, rect, image, brand, ink, muted, accent, background } =
      drawing(o, logo),
    photos = await pictures(portraits),
    month = new Date(o.month + "-15T12:00:00Z").toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  let body =
    text(64, 76, month.toUpperCase(), 22, accent, 700) +
    paragraph(64, 150, o.title, 32, 3, 46, ink, 700) +
    brand(922, 52, 92, 108);
  [
    [(stats.arrivals || []).length, "arrivées"],
    [(stats.adopted || []).length, "adoptions"],
    [stats.present, "à rencontrer"],
  ].forEach(([n, label], i) => {
    body +=
      rect(64 + i * 322, 350, 304, 116) +
      text(86 + i * 322, 404, n, 43, accent, 700) +
      text(86 + i * 322, 438, label, 20, muted);
  });
  photos.slice(0, 4).forEach((p, i) => {
    const x = 64 + (i % 2) * 488,
      y = 500 + Math.floor(i / 2) * 280;
    body +=
      image(p, x, y, 464, 190) +
      paragraph(x + 6, y + 226, p.name, 29, 2, 23, ink, 700);
  });
  if (!photos.length)
    body += paragraph(
      64,
      585,
      "Des nouvelles, des rencontres et des dates à partager. Retrouvez l’édition complète dans la gazette du refuge.",
      43,
      8,
      32,
      muted,
    );
  const dates = [...o.keyDates].sort(
    (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
  );
  if (dates.length) {
    body += text(64, 1100, "À NOTER DANS VOS AGENDAS", 18, accent, 700);
    dates
      .slice(0, 3)
      .forEach(
        (e, i) =>
          (body += text(
            64,
            1142 + i * 38,
            short(`${dateLabel(e.date)} · ${e.title}`, 66),
            23,
            ink,
            600,
          )),
      );
  } else
    body += paragraph(
      64,
      1120,
      short(o.signature, 100),
      64,
      2,
      24,
      accent,
      600,
    );
  body +=
    text(64, 1292, short(refuge, 65), 19, muted, 600) +
    text(64, 1322, "Photos : équipe / SPA · AniPic © Gaerisson", 15, muted);
  return sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350">${rect(0, 0, 1080, 1350, background, 0)}<g font-family="Roboto,Arial,sans-serif">${body}</g></svg>`,
    ),
  )
    .png()
    .toBuffer();
}
