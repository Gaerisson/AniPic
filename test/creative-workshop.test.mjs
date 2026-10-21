import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { fixture, login, animal } from "./helpers.mjs";
import { ingest } from "../server/storage.mjs";
import { id, now, openDb } from "../server/db.mjs";
import { photoQuality } from "../server/photo-quality.mjs";
import { renderCutout } from "../server/photo-workshop.mjs";
import { gazetteMonth } from "../server/gazette.mjs";
import {
  animalReference,
  creativeSource,
} from "../server/creative-sources.mjs";

async function wait(app, headers, job) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const r = await app.inject({ url: `/api/creative/jobs/${job}`, headers });
    assert.equal(r.statusCode, 200, r.body);
    const j = r.json();
    if (j.state !== "running") return j;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw Error("Job timeout");
}
const portrait = () =>
  sharp({
    create: { width: 640, height: 800, channels: 3, background: "#d6a37b" },
  })
    .jpeg()
    .toBuffer();
function spa(db, aid, suffix = "sample") {
  db.prepare("UPDATE animals SET source_metadata=? WHERE id=?").run(
    JSON.stringify({
      thumbnail: `https://www.la-spa.fr/app/uploads/animals/${suffix}.jpg`,
    }),
    aid,
  );
}
test("technical photo review distinguishes detail, blur, shadows and clipped highlights", async () => {
  const w = 640,
    h = 640,
    data = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 3; c++)
        data[(y * w + x) * 3 + c] = ((x >> 3) + (y >> 3)) % 2 ? 215 : 40;
  const detailed = await sharp(data, {
    raw: { width: w, height: h, channels: 3 },
  })
    .png()
    .toBuffer();
  const blur = await sharp(detailed).blur(12).png().toBuffer();
  const a = await photoQuality(detailed),
    b = await photoQuality(blur);
  assert.ok(a.sharpness > b.sharpness * 5);
  assert.ok(a.score > b.score);
  const dark = await photoQuality(
    await sharp({
      create: { width: 640, height: 800, channels: 3, background: "#030303" },
    })
      .png()
      .toBuffer(),
  );
  const light = await photoQuality(
    await sharp({
      create: { width: 640, height: 800, channels: 3, background: "#fff" },
    })
      .png()
      .toBuffer(),
  );
  assert.ok(dark.warnings.includes("Image sombre"));
  assert.ok(light.warnings.includes("Hautes lumières à vérifier"));
});
test("review loads actual local and SPA bytes, saves human choices and reports unavailable references", async (t) => {
  const image = await portrait(),
    { app, db, c } = await fixture(t, { spaPhotoFetcher: async () => image }),
    u = await login(app, "volunteer"),
    other = await login(app, "agent"),
    aid = animal(db);
  spa(db, aid);
  const photo = await ingest(db, c, aid, Readable.from(image), "portrait.jpg"),
    missing = animal(db, "Sans photo");
  const headers = u.headers,
    refs = [
      { kind: "local", id: photo.id },
      { kind: "spa", id: aid },
      { kind: "spa", id: missing },
    ];
  const r = await app.inject({
    method: "POST",
    url: "/api/creative/review",
    headers,
    payload: { photos: refs },
  });
  assert.equal(r.statusCode, 202, r.body);
  const job = await wait(app, headers, r.json().id);
  assert.equal(job.state, "done", JSON.stringify(job));
  assert.equal(job.result.length, 2);
  assert.equal(job.errors.length, 1);
  assert.equal(job.done, 3);
  assert.equal(
    (
      await app.inject({
        url: `/api/creative/jobs/${job.id}`,
        headers: other.headers,
      })
    ).statusCode,
    404,
  );
  const reference = job.result.find((r) => r.ref.kind === "spa");
  const save = await app.inject({
    method: "PUT",
    url: `/api/creative/review?job=${job.id}`,
    headers,
    payload: {
      ref: reference.ref,
      signature: reference.signature,
      decision: "keep",
    },
  });
  assert.equal(save.statusCode, 200, save.body);
  assert.equal(
    db.prepare("SELECT decision FROM photo_reviews").get().decision,
    "keep",
  );
  const again = await app.inject({
      method: "POST",
      url: "/api/creative/review",
      headers,
      payload: { photos: [reference.ref] },
    }),
    reloaded = await wait(app, headers, again.json().id);
  assert.equal(reloaded.result[0].decision, "keep");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos").get().n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM blobs").get().n, 1);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/creative/review",
        headers: { cookie: headers.cookie },
        payload: { photos: refs },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/creative/cutouts",
        payload: refs[0],
      })
    ).statusCode,
    401,
  );
});
test("cutout preserves transparency, adjusts the actual mask and saves a copy without replacing the original", async (t) => {
  // An explicit synthetic mask tests orchestration; the real model is exercised separately.
  const mask = await sharp(
    Buffer.from(
      '<svg width="200" height="240" xmlns="http://www.w3.org/2000/svg"><ellipse cx="100" cy="120" rx="60" ry="100" fill="#d98a53"/></svg>',
    ),
  )
    .png()
    .toBuffer();
  const { app, db, c } = await fixture(t, {
      cutoutProcessor: async () => mask,
    }),
    u = await login(app, "volunteer"),
    aid = animal(db);
  const image = await portrait(),
    p = await ingest(db, c, aid, Readable.from(image), "source.jpg");
  const original = await fs.readFile(
    path.join(
      c.mediaDir,
      db.prepare("SELECT hash FROM photos WHERE id=?").get(p.id).hash,
    ),
  );
  const r = await app.inject({
    method: "POST",
    url: "/api/creative/cutouts",
    headers: u.headers,
    payload: { kind: "local", id: p.id },
  });
  assert.equal(r.statusCode, 202, r.body);
  const job = await wait(app, u.headers, r.json().id);
  assert.equal(job.state, "done", JSON.stringify(job));
  const render = await app.inject({
    method: "POST",
    url: `/api/creative/cutouts/${job.id}/render`,
    headers: u.headers,
    payload: { feather: 1, shrink: 1, background: "transparent" },
  });
  assert.equal(render.statusCode, 200, render.body);
  const stats = await sharp(render.rawPayload).stats();
  assert.equal(stats.channels[3].min, 0);
  assert.equal(stats.channels[3].max, 255);
  const opaque = await renderCutout(mask, { background: "#ffffff" });
  assert.equal((await sharp(opaque).metadata()).hasAlpha, false);
  const save = await app.inject({
    method: "POST",
    url: `/api/creative/cutouts/${job.id}/save`,
    headers: u.headers,
    payload: { background: "transparent" },
  });
  assert.equal(save.statusCode, 201, save.body);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos").get().n, 1);
  assert.equal(
    db.prepare("SELECT folder FROM inbox_photos").get().folder,
    "Détourages",
  );
  assert.deepEqual(
    await fs.readFile(
      path.join(
        c.mediaDir,
        db.prepare("SELECT hash FROM photos WHERE id=?").get(p.id).hash,
      ),
    ),
    original,
  );
});
test("box posters track installation, become stale after relevant changes and reject stale edits", async (t) => {
  const { app, db } = await fixture(t),
    u = await login(app, "agent"),
    v = await login(app, "viewer"),
    aid = animal(db);
  spa(db, aid);
  const r = await app.inject({
    method: "POST",
    url: "/api/creative/box-posters",
    headers: u.headers,
    payload: {
      animalId: aid,
      location: "Box 12",
      state: "installed",
      ref: { kind: "spa", id: aid },
    },
  });
  assert.equal(r.statusCode, 201, r.body);
  const list = async () => {
    const r = await app.inject({
      url: "/api/creative/box-posters",
      headers: u.headers,
    });
    assert.equal(r.statusCode, 200, r.body);
    return r.json()[0];
  };
  let row = await list();
  assert.equal(row.stale, false);
  assert.ok(row.installed_at);
  db.prepare("UPDATE animals SET updated_at=? WHERE id=?").run(now(), aid);
  assert.equal((await list()).stale, false);
  db.prepare(
    "UPDATE animals SET compatibility=?,status='reserved' WHERE id=?",
  ).run(JSON.stringify({ chiens: "Non, selon profil" }), aid);
  row = await list();
  assert.equal(row.stale, true);
  assert.ok(row.reasons.includes("Ententes"));
  assert.ok(row.reasons.includes("Statut ou archivage"));
  let update = await app.inject({
    method: "PATCH",
    url: `/api/creative/box-posters/${row.id}`,
    headers: u.headers,
    payload: { revision: row.updated_at, renew: true },
  });
  assert.equal(update.statusCode, 200, update.body);
  assert.equal((await list()).stale, false);
  update = await app.inject({
    method: "PATCH",
    url: `/api/creative/box-posters/${row.id}`,
    headers: u.headers,
    payload: { revision: row.updated_at, state: "removed" },
  });
  assert.equal(update.statusCode, 409);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/creative/box-posters",
        headers: v.headers,
        payload: { animalId: aid, location: "Box 2" },
      })
    ).statusCode,
    403,
  );
  const reopened = openDb(app.anipicConfig);
  assert.equal(
    reopened.prepare("SELECT COUNT(*) n FROM box_posters").get().n,
    1,
  );
  assert.equal(reopened.prepare("PRAGMA user_version").get().user_version, 22);
  reopened.close();
});
test("public gazette sources skip private photos and reject explicitly requested private originals", async (t) => {
  const image = await portrait(),
    { db, c } = await fixture(t, { spaPhotoFetcher: async () => image }),
    aid = animal(db);
  spa(db, aid, "private-fallback");
  const p = await ingest(db, c, aid, Readable.from(image), "privee.jpg", true);
  const a = db.prepare("SELECT * FROM animals WHERE id=?").get(aid),
    ref = animalReference(db, a);
  assert.equal(ref.kind, "spa");
  assert.equal(
    (await creativeSource(db, c, ref, { publicOnly: true })).ref.kind,
    "spa",
  );
  await assert.rejects(
    () =>
      creativeSource(db, c, { kind: "local", id: p.id }, { publicOnly: true }),
    /privée/,
  );
});
test("failed segmentation is visible, releases the worker slot and never creates an image", async (t) => {
  const image = await portrait(),
    { app, db } = await fixture(t, {
      spaPhotoFetcher: async () => image,
      cutoutProcessor: async () => {
        throw Error("Simulated out of memory");
      },
    }),
    u = await login(app),
    aid = animal(db);
  spa(db, aid, "failed-mask");
  for (let n = 0; n < 2; n++) {
    const r = await app.inject({
      method: "POST",
      url: "/api/creative/cutouts",
      headers: u.headers,
      payload: { kind: "spa", id: aid },
    });
    assert.equal(r.statusCode, 202, r.body);
    const job = await wait(app, u.headers, r.json().id);
    assert.equal(job.state, "failed");
    assert.ok(job.error);
    const render = await app.inject({
      method: "POST",
      url: `/api/creative/cutouts/${job.id}/render`,
      headers: u.headers,
      payload: {},
    });
    assert.equal(render.statusCode, 409);
  }
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM inbox_photos").get().n, 0);
});
test("low available memory refuses segmentation before loading the model", async (t) => {
  const { app, db } = await fixture(t, {
      cutoutAvailableMemory: () => 256 * 1024 ** 2,
    }),
    u = await login(app),
    aid = animal(db);
  spa(db, aid, "memory");
  const r = await app.inject({
    method: "POST",
    url: "/api/creative/cutouts",
    headers: u.headers,
    payload: { kind: "spa", id: aid },
  });
  assert.equal(r.statusCode, 422, r.body);
  assert.match(r.json().error, /Mémoire insuffisante/);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM inbox_photos").get().n, 0);
});
test("gazette counts recorded adoptions only, persists drafts and exports genuine PDF with SPA portraits", async (t) => {
  const image = await portrait(),
    { app, db } = await fixture(t, { spaPhotoFetcher: async () => image }),
    u = await login(app, "volunteer"),
    other = await login(app, "agent");
  const a = animal(db, "Nala"),
    b = animal(db, "Archivé"),
    d = animal(db, "Ancienne adoption");
  spa(db, a);
  spa(db, b, "second");
  db.prepare(
    "UPDATE animals SET created_at='2026-10-02T12:00:00.000Z' WHERE id=?",
  ).run(a);
  db.prepare(
    "UPDATE animals SET archived_at=?,status='source_missing' WHERE id=?",
  ).run(now(), b);
  db.prepare("INSERT INTO animal_status_events VALUES (?,?,?,?)").run(
    id(),
    a,
    "adopted",
    "2026-10-03T12:00:00.000Z",
  );
  db.prepare("INSERT INTO animal_status_events VALUES (?,?,?,?)").run(
    id(),
    a,
    "adopted",
    "2026-10-05T12:00:00.000Z",
  );
  db.prepare("INSERT INTO animal_status_events VALUES (?,?,?,NULL)").run(
    id(),
    d,
    "adopted",
  );
  db.prepare("INSERT INTO animal_status_events VALUES (?,?,?,?)").run(
    id(),
    d,
    "adopted",
    "2026-10-04T12:00:00.000Z",
  );
  const stats = gazetteMonth(db, "2026-10");
  assert.deepEqual(
    stats.adopted.map((a) => a.name),
    ["Nala"],
  );
  const config = {
      month: "2026-10",
      title: "Les nouvelles de Morée",
      events: "Portes ouvertes dimanche.\nUne collecte pour nos animaux.",
      animals: [
        { id: a, source: "spa" },
        { id: b, source: "spa" },
      ],
      template: "glass",
    },
    draft = id();
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: `/api/creative/gazette/drafts/${draft}`,
        headers: u.headers,
        payload: config,
      })
    ).statusCode,
    200,
  );
  const r = await app.inject({
    method: "POST",
    url: "/api/creative/gazette",
    headers: u.headers,
    payload: config,
  });
  assert.equal(r.statusCode, 202, r.body);
  const job = await wait(app, u.headers, r.json().id);
  assert.equal(job.state, "done", JSON.stringify(job));
  assert.equal(job.result.pages, 4);
  const file = await app.inject({
    url: `/api/creative/gazette/${job.id}/file`,
    headers: u.headers,
  });
  assert.equal(file.statusCode, 200, file.body);
  assert.equal((await PDFDocument.load(file.rawPayload)).getPageCount(), 4);
  assert.ok(file.rawPayload.length < 4e6);
  assert.equal(
    (
      await app.inject({
        url: `/api/creative/gazette/${job.id}/file`,
        headers: other.headers,
      })
    ).statusCode,
    404,
  );
  assert.equal(
    (await app.inject({ url: `/api/creative/gazette/${job.id}/file` }))
      .statusCode,
    401,
  );
  const preview = await app.inject({
    url: `/api/creative/gazette/${job.id}/page/0`,
    headers: u.headers,
  });
  assert.equal(preview.statusCode, 200);
  assert.equal((await sharp(preview.rawPayload).metadata()).width, 820);
  const missing = animal(db, "Portrait manquant"),
    bad = await app.inject({
      method: "POST",
      url: "/api/creative/gazette",
      headers: u.headers,
      payload: { ...config, animals: [{ id: missing, source: "spa" }] },
    }),
    failure = await wait(app, u.headers, bad.json().id);
  assert.equal(failure.state, "failed");
  assert.match(failure.error, /Portrait manquant/);
  const persisted = db
    .prepare("SELECT config FROM gazette_drafts WHERE id=?")
    .get(draft);
  assert.equal(JSON.parse(persisted.config).title, config.title);
});
