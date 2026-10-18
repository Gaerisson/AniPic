import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { promises as fs } from "node:fs";
import sharp from "sharp";
import { fixture, login, animal } from "./helpers.mjs";
import { ingest } from "../server/storage.mjs";
import { now } from "../server/db.mjs";
import {
  visualDescriptor,
  visualSimilarity,
} from "../server/assignment-suggestions.mjs";
const portrait = (coat = "#ad793c", background = "#384a51") =>
  sharp(
    Buffer.from(
      `<svg width="400" height="500" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="500" fill="${background}"/><ellipse cx="200" cy="280" rx="122" ry="180" fill="${coat}"/><path d="M95 205L80 30 190 140M210 140L320 30 305 205" fill="${coat}"/><circle cx="150" cy="215" r="16"/><circle cx="250" cy="215" r="16"/><ellipse cx="200" cy="300" rx="20" ry="14" fill="#222"/></svg>`,
    ),
  )
    .jpeg()
    .toBuffer();
async function add(db, c, owner, buffer) {
  return ingest(
    db,
    c,
    owner,
    Readable.from(buffer),
    "portrait.jpg",
    false,
    null,
    owner ? null : { folder: "" },
  );
}
const post = (app, h, body) =>
  app.inject({
    method: "POST",
    url: "/api/photos/assignment/suggestions",
    headers: h,
    payload: body,
  });
async function finish(app, headers, job) {
  for (let i = 0; i < 300; i++) {
    const r = await app.inject({
      url: `/api/photos/assignment/suggestions/${job.id}`,
      headers,
    });
    assert.equal(r.statusCode, 200, r.body);
    if (r.json().state !== "running") return r.json();
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.fail("Analysis did not complete");
}
test("local visual descriptor ranks matching colour/contrast above different coats and survives resizing", async () => {
  const bytes = await portrait(),
    original = await visualDescriptor(bytes);
  const resized = await visualDescriptor(
    await sharp(bytes).resize(200, 250).jpeg({ quality: 70 }).toBuffer(),
  );
  const different = await visualDescriptor(
    await portrait("#eeeeee", "#d8d6cc"),
  );
  assert.ok(visualSimilarity(original, resized) > 0.94);
  assert.ok(
    visualSimilarity(original, resized) >
      visualSimilarity(original, different) + 0.25,
  );
  await assert.rejects(visualDescriptor(Buffer.from("invalid image")));
});
test("assignment suggestions compare local and SPA portraits progressively, respect roles/ownership and never change attribution", async (t) => {
  const jpeg = await portrait();
  let downloads = 0,
    release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const { app, db, c } = await fixture(t, {
    spaPhotoFetcher: async (url) => {
      downloads++;
      if (url.includes("failure")) throw Error("SPA unavailable");
      await gate;
      return jpeg;
    },
  });
  t.after(() => release());
  const admin = await login(app),
    other = await login(app, "agent"),
    viewer = await login(app, "viewer");
  const local = animal(db, "Caramel"),
    spa = animal(db, "Roux"),
    broken = animal(db, "SPA indisponible"),
    departed = animal(db, "Parti"),
    archived = animal(db, "Archive"),
    empty = animal(db, "Sans photo");
  await add(db, c, local, jpeg);
  await add(db, c, departed, jpeg);
  await add(db, c, archived, jpeg);
  db.prepare("UPDATE animals SET departed_at=? WHERE id=?").run(
    now(),
    departed,
  );
  db.prepare("UPDATE animals SET archived_at=? WHERE id=?").run(
    now(),
    archived,
  );
  for (const [a, filename] of [
    [spa, "portrait"],
    [broken, "failure"],
  ])
    db.prepare("UPDATE animals SET source_metadata=? WHERE id=?").run(
      JSON.stringify({
        thumbnail: `https://www.la-spa.fr/app/uploads/animals/${a}-${filename}.jpg`,
      }),
      a,
    );
  const inbox = await add(db, c, null, jpeg),
    before = db.prepare("SELECT * FROM inbox_photos").all(),
    originals = await fs.readdir(c.mediaDir);
  const payload = { photoIds: [inbox.id] };
  assert.equal((await post(app, {}, payload)).statusCode, 401);
  assert.equal((await post(app, viewer.headers, payload)).statusCode, 403);
  assert.equal(
    (await post(app, { ...admin.headers, "x-csrf-token": "wrong" }, payload))
      .statusCode,
    403,
  );
  const start = await post(app, admin.headers, payload);
  assert.equal(start.statusCode, 200, start.body);
  const job = start.json();
  assert.equal(job.total, 3);
  assert.equal(
    (
      await app.inject({
        url: `/api/photos/assignment/suggestions/${job.id}`,
        headers: other.headers,
      })
    ).statusCode,
    404,
  );
  assert.equal((await post(app, admin.headers, payload)).statusCode, 409);
  await new Promise((r) => setTimeout(r, 40));
  const progress = (
    await app.inject({
      url: `/api/photos/assignment/suggestions/${job.id}`,
      headers: admin.headers,
    })
  ).json();
  assert.equal(progress.state, "running");
  assert.ok(progress.items.some((a) => a.id === local));
  release();
  const done = await finish(app, admin.headers, job);
  assert.equal(done.state, "done");
  assert.equal(done.checked, 3);
  assert.equal(done.unavailable, 1);
  assert.equal(done.items.find((a) => a.id === local).source, "local");
  assert.equal(done.items.find((a) => a.id === spa).source, "spa");
  assert.ok(
    !done.items.some((a) => [departed, archived, empty].includes(a.id)),
  );
  assert.ok(!JSON.stringify(done).includes("histogram"));
  assert.deepEqual(db.prepare("SELECT * FROM inbox_photos").all(), before);
  assert.deepEqual(await fs.readdir(c.mediaDir), originals);
  const again = await post(app, admin.headers, payload);
  await finish(app, admin.headers, again.json());
  assert.equal(
    downloads,
    3,
    "successful SPA descriptor cached; failed image can retry",
  );
});
test("reassignment suggestions exclude the current animal, reject stale/wrong selections and allow cancelling", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    a = animal(db),
    b = animal(db, "B"),
    bytes = await portrait();
  const p = await add(db, c, a, bytes);
  await add(db, c, b, bytes);
  const payload = { mode: "reassign", sourceAnimalId: a, photoIds: [p.id] };
  assert.equal(
    (await post(app, admin.headers, { ...payload, sourceAnimalId: b }))
      .statusCode,
    409,
  );
  assert.equal(
    (await post(app, admin.headers, { ...payload, photoIds: [p.id, p.id] }))
      .statusCode,
    400,
  );
  const start = await post(app, admin.headers, payload),
    done = await finish(app, admin.headers, start.json());
  assert.equal(done.total, 1);
  assert.deepEqual(
    done.items.map((a) => a.id),
    [b],
  );
  const cancelled = await app.inject({
    method: "DELETE",
    url: `/api/photos/assignment/suggestions/${done.id}`,
    headers: admin.headers,
  });
  assert.equal(cancelled.statusCode, 200);
  assert.equal(
    db.prepare("SELECT animal_id FROM photos WHERE id=?").get(p.id).animal_id,
    a,
  );
});
