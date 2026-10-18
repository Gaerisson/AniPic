import sharp from "sharp";
import QRCode from "qrcode";
import { logoPosterLayout } from "../shared/logo-poster-layout.mjs";
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
const data = (b, type = "image/png") =>
  `data:${type};base64,${b.toString("base64")}`;
function wrap(s, max) {
  const out = [""];
  for (const word of s.split(/\s+/)) {
    if ((out.at(-1) + " " + word).length > max && out.at(-1)) out.push(word);
    else out[out.length - 1] += (out.at(-1) ? " " : "") + word;
  }
  return out;
}
export async function logoPosterImage(items, o, logo, lettering) {
  const positions = logoPosterLayout(items.length),
    photos = [],
    labels = [];
  for (const [i, item] of items.entries()) {
    const s = positions[i],
      caption = Math.min(35, s.h * 0.27),
      photoH = s.h - caption;
    const b = await sharp(item.buffer, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(Math.ceil(s.w * 2.4), Math.ceil(photoH * 2.4), {
        fit: "cover",
        position: "attention",
      })
      .jpeg({ quality: 91 })
      .toBuffer();
    const size = Math.min(
      22,
      caption * 0.58,
      (s.w - 14) / Math.max(1, item.name.length * 0.61),
    );
    photos.push(
      `<defs><clipPath id="tile${i}"><rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="9"/></clipPath></defs><g clip-path="url(#tile${i})"><rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="#211c19"/><image x="${s.x}" y="${s.y}" width="${s.w}" height="${photoH}" href="${data(b, "image/jpeg")}" preserveAspectRatio="xMidYMid slice"/></g>`,
    );
    labels.push(
      `<rect x="${s.x}" y="${s.y + photoH}" width="${s.w}" height="${caption}" fill="#211c19" rx="5"/><text x="${s.x + s.w / 2}" y="${s.y + photoH + caption * 0.69}" font-size="${size}" text-anchor="middle" font-weight="bold" fill="#fffaf4">${esc(item.name)}</text>`,
    );
  }
  const title = wrap(o.title, 30).slice(0, 3),
    ts = Math.min(52, 124 / title.length);
  let qr = "";
  if (o.qrUrl) {
    const b = await QRCode.toBuffer(o.qrUrl, { width: 240, margin: 2 });
    qr = `<rect x="1051" y="1593" width="120" height="120" rx="12" fill="white"/><image x="1056" y="1598" width="110" height="110" href="${data(b)}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1754" viewBox="0 0 1240 1754"><defs><radialGradient id="paper"><stop stop-color="#fffaf2"/><stop offset="1" stop-color="#efe4d7"/></radialGradient><linearGradient id="orange" x2="0" y2="1"><stop stop-color="${o.accent}"/><stop offset="1" stop-color="#bd4e1c"/></linearGradient></defs><g font-family="DejaVu Sans,Arial">
    <rect width="1240" height="1754" fill="url(#paper)"/><path d="M64 44H1176" stroke="${o.accent}" stroke-width="5"/>
    <text x="64" y="88" font-size="14" letter-spacing="3" fill="#9e431d">ILS FONT BATTRE LE CŒUR DU REFUGE</text>
    ${title.map((t, i) => `<text x="61" y="${145 + i * ts * 1.05}" font-size="${Math.min(ts, 900 / Math.max(1, t.length * 0.62))}" font-weight="bold" fill="#241e1a">${esc(t)}</text>`).join("")}
    ${wrap(o.subtitle, 80)
      .slice(0, 2)
      .map(
        (t, i) =>
          `<text x="64" y="${263 + i * 26}" font-size="20" fill="#67594e">${esc(t)}</text>`,
      )
      .join("")}
    <image x="1045" y="77" width="124" height="137" href="${data(logo)}"/>
    <path d="M620 326L1170 616V1255L620 1544L70 1255V616Z" fill="url(#orange)"/>
    <path d="M620 342L1155 625V1246L620 1528L85 1246V625Z" fill="none" stroke="#fff4d9" stroke-opacity=".5" stroke-width="2"/>
    ${photos.join("")}
    <image x="100" y="355" width="1040" height="1150" href="${data(lettering)}" opacity=".22" preserveAspectRatio="none"/>
    ${labels.join("")}
    <text x="620" y="1580" text-anchor="middle" font-size="16" letter-spacing="2" fill="#8d4b2d">${items.length} REGARD${items.length > 1 ? "S" : ""} · AUTANT DE BELLES RENCONTRES</text>
    <path d="M64 1610H${o.qrUrl ? 1020 : 1176}" stroke="${o.accent}" stroke-width="2"/>
    ${wrap(o.footer, o.qrUrl ? 68 : 90)
      .slice(0, 2)
      .map(
        (t, i) =>
          `<text x="64" y="${1652 + i * 26}" font-size="19" fill="#302820">${esc(t)}</text>`,
      )
      .join("")}${qr}
    <text x="64" y="1723" font-size="12" fill="#75685b">© Gaerisson · AniPic · Mosaïque des regards · ${esc(o.format)}</text>
    </g></svg>`;
  const width =
    o.output === "preview" ? 868 : { A4: 2480, A3: 3508, A2: 4960 }[o.format];
  return sharp(Buffer.from(svg), {
    density: (72 * width) / 1240,
    limitInputPixels: 40_000_000,
  })
    .png()
    .toBuffer();
}
