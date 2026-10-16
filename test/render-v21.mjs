import { fixture, login, animal } from "./helpers.mjs";
import { ingest } from "../server/storage.mjs";
import { renderFilm, mediaMetadata } from "../server/video.mjs";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const clean = [];
const { app, db, c } = await fixture({ after: (fn) => clean.push(fn) });
try {
  await login(app);
  const a = animal(db, "Nala");
  const p = await ingest(
    db,
    c,
    a,
    createReadStream(new URL("../demo/images/nala.jpg", import.meta.url)),
    "nala.jpg",
  );
  const film = {
    title: "Rencontrez Nala",
    brandLabel: "Refuge de Morée",
    ctaText: "Contactez le refuge",
    outro: "Une rencontre vous attend",
    look: "minimal",
    aspect: "portrait",
    resolution: "720",
    motion: "lively",
    transition: "wipe",
    introSeconds: 0,
    outroSeconds: 1.5,
    showLogo: false,
    clips: [
      {
        kind: "photo",
        ref: p.id,
        seconds: 2.5,
        fit: "cover",
        focusX: 35,
        focusY: 40,
      },
    ],
  };
  const result = await renderFilm(db, c, film);
  const source = path.join(c.mediaDir, result.hash);
  const meta = await mediaMetadata(source, "video");
  assert.equal(meta.width, 720);
  assert.equal(meta.height, 1280);
  assert.equal(meta.duration, 4);
  await fs.copyFile(
    source,
    new URL("../../anipic-story-animal-demo.mp4", import.meta.url),
  );
  console.log("Animal story render verified : " + JSON.stringify(meta));
} finally {
  for (const fn of clean) await fn();
}
