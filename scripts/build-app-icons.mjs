import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../public/", import.meta.url),
  svg = await readFile(new URL("anipic-icon.svg", root));
for (const size of [192, 512])
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(`app-icon-${size}.png`, root)));
const symbol = await sharp(svg).resize(320, 320).png().toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#121315" },
})
  .composite([{ input: symbol, left: 96, top: 96 }])
  .png()
  .toFile(fileURLToPath(new URL("app-icon-maskable.png", root)));
console.log("Icônes AniPic 192, 512 et maskable générées depuis le logo SVG.");
