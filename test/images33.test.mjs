import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { fixture, login, animal } from "./helpers.mjs";
import { sourcePhotoBuffer } from "../server/source-photo.mjs";
import { prepareImages } from "../shared/load-images.mjs";
import { annualLayout } from "../shared/annual-layout.mjs";
test("SPA thumbnail and movie sizes share one download; failures can be retried", async (t) => {
  let calls = 0,
    fail = false;
  const jpeg = await sharp({
    create: { width: 1600, height: 1000, channels: 3, background: "#ad743c" },
  })
    .jpeg()
    .toBuffer();
  const { db, c } = await fixture(t, {
      spaPhotoFetcher: async () => {
        calls++;
        await new Promise((r) => setTimeout(r, 20));
        if (fail) throw Error("NAS/network unavailable");
        return jpeg;
      },
    }),
    id = animal(db);
  db.prepare("UPDATE animals SET source_metadata=? WHERE id=?").run(
    JSON.stringify({
      thumbnail: "https://www.la-spa.fr/app/uploads/animals/concurrent.jpg",
    }),
    id,
  );
  const buffers = await Promise.all(
    [320, 640, 1280, 320].map((w) => sourcePhotoBuffer(db, c, id, w)),
  );
  assert.equal(calls, 1);
  for (const [i, w] of [320, 640, 1280, 320].entries())
    assert.equal((await sharp(buffers[i]).metadata()).width, w);
  await sourcePhotoBuffer(db, c, id, 1280);
  assert.equal(calls, 1);
  db.prepare("UPDATE animals SET source_metadata=? WHERE id=?").run(
    JSON.stringify({
      thumbnail: "https://www.la-spa.fr/app/uploads/animals/retry.jpg",
    }),
    id,
  );
  fail = true;
  await assert.rejects(sourcePhotoBuffer(db, c, id, 640));
  fail = false;
  assert.ok((await sourcePhotoBuffer(db, c, id, 640)).length);
  assert.equal(calls, 3);
});
test("image barrier waits for late decoding, deduplicates and surfaces a failed image", async () => {
  const releases = new Map(),
    loaded = [],
    progress = [];
  const preparation = prepareImages(["fast", "slow", "fast", "bad"], {
    concurrency: 2,
    load: (src) =>
      new Promise((resolve, reject) => {
        loaded.push(src);
        releases.set(
          src,
          src === "bad" ? () => reject(Error("offline")) : resolve,
        );
      }),
    onProgress: (p) => progress.push(p),
  });
  assert.deepEqual(loaded, ["fast", "slow"]);
  releases.get("fast")();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(loaded, ["fast", "slow", "bad"]);
  let finished = false;
  preparation.then(() => {
    finished = true;
  });
  releases.get("bad")();
  await new Promise((r) => setImmediate(r));
  assert.equal(finished, false);
  releases.get("slow")();
  assert.deepEqual(await preparation, { done: 3, total: 3, failed: ["bad"] });
  assert.equal(progress.at(-1).done, 3);
});
test("annual photo rails do not intersect the main portrait in either orientation", () => {
  const overlap = (a, b) =>
    a.left < b.x + b.width &&
    a.left + a.width > b.x &&
    a.top < b.y + b.height &&
    a.top + a.height > b.y;
  for (const [w, h] of [
    [1920, 1080],
    [1080, 1920],
    [1280, 720],
    [720, 1280],
  ]) {
    const layout = annualLayout(w, h);
    assert.ok(layout.main.width > 0);
    for (const rail of layout.rails) {
      assert.equal(overlap(layout.main, rail), false);
      assert.ok(rail.gap > 0);
    }
  }
});
test("annual message and source photos survive project save and preview", async (t) => {
  const { app, db } = await fixture(t),
    admin = await login(app),
    id = animal(db);
  db.prepare("UPDATE animals SET source_metadata=? WHERE id=?").run(
    JSON.stringify({
      thumbnail: "https://www.la-spa.fr/app/uploads/animals/annual.jpg",
    }),
    id,
  );
  const film = {
    title: "2026",
    template: "year",
    annualMessage: "Bonne année 2027",
    annualMessageSubtitle: "Merci aux familles",
    annualSidePhotos: false,
    annualStats: false,
    clips: [{ kind: "spa", ref: id, seconds: 3 }],
  };
  const r = await app.inject({
    method: "POST",
    url: "/api/video/preview",
    headers: admin.headers,
    payload: film,
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().annualMessage, film.annualMessage);
  assert.equal(r.json().annualSidePhotos, false);
  assert.equal(r.json().clips[0].sourcePhoto, true);
});
