import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { fixture, login } from "./helpers.mjs";
import { ingest } from "../server/storage.mjs";

test("inbox downloads require team access and return a real bounded JPEG attachment, including discarded photos", async (t) => {
  const { app, db, c } = await fixture(t);
  const agent = await login(app, "agent"),
    viewer = await login(app, "viewer");
  const source = await sharp({
    create: { width: 3400, height: 120, channels: 3, background: "#c47041" },
  })
    .png()
    .withMetadata()
    .toBuffer();
  const photo = await ingest(
    db,
    c,
    null,
    Readable.from(source),
    "Portrait été.png",
    false,
    null,
    { folder: "A trier" },
  );
  const url = `/api/inbox/${photo.id}/download`;
  assert.equal((await app.inject({ method: "POST", url })).statusCode, 401);
  assert.equal(
    (await app.inject({ method: "POST", url, headers: viewer.headers }))
      .statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url,
        headers: { ...agent.headers, "x-csrf-token": "wrong" },
      })
    ).statusCode,
    403,
  );
  for (const archived of [false, true]) {
    db.prepare("UPDATE inbox_photos SET archived_at=? WHERE id=?").run(
      archived ? new Date().toISOString() : null,
      photo.id,
    );
    const r = await app.inject({ method: "POST", url, headers: agent.headers });
    assert.equal(r.statusCode, 200, r.body.slice(0, 200));
    assert.match(r.headers["content-type"], /^image\/jpeg/);
    assert.match(r.headers["content-disposition"], /^attachment;/);
    assert.match(r.headers["content-disposition"], /\.jpg/);
    assert.match(r.headers["cache-control"], /no-store/);
    const metadata = await sharp(r.rawPayload).metadata();
    assert.equal(metadata.format, "jpeg");
    assert.equal(metadata.width, 3200);
    assert.equal(metadata.exif, undefined);
  }
  const missing = await app.inject({
    method: "POST",
    url: "/api/inbox/00000000-0000-4000-8000-000000000000/download",
    headers: agent.headers,
  });
  assert.equal(missing.statusCode, 404);
});

test("a missing inbox source returns an uncached JSON error without a false JPEG attachment", async (t) => {
  const { app, db, c } = await fixture(t);
  const agent = await login(app, "agent");
  const source = await sharp({
    create: { width: 80, height: 60, channels: 3, background: "#5c805b" },
  })
    .jpeg()
    .toBuffer();
  const photo = await ingest(
    db,
    c,
    null,
    Readable.from(source),
    "photo.jpg",
    false,
    null,
    { folder: "A trier" },
  );
  const row = db
    .prepare("SELECT hash FROM inbox_photos WHERE id=?")
    .get(photo.id);
  await fs.unlink(path.join(c.mediaDir, row.hash));
  const r = await app.inject({
    method: "POST",
    url: `/api/inbox/${photo.id}/download`,
    headers: agent.headers,
  });
  assert.equal(r.statusCode, 503);
  assert.match(r.headers["content-type"], /^application\/json/);
  assert.match(r.headers["cache-control"], /no-store/);
  assert.equal(r.headers["content-disposition"], undefined);
});
