import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import sharp from "sharp";
import { fixture, login, animal } from "./helpers.mjs";
import { ingest } from "../server/storage.mjs";
import {
  photoDefaults,
  photoPresets,
  applyPhotoPreset,
  adjustPixels,
  applyPhotoOptics,
} from "../shared/photo-edit.mjs";

test("library retouch is admin-only on both source and save routes, keeps the original and records a private variant", async (t) => {
  const { app, db, c } = await fixture(t),
    a = animal(db),
    original = await sharp({
      create: { width: 40, height: 50, channels: 3, background: "#edb689" },
    })
      .jpeg()
      .toBuffer(),
    retouch = await sharp(original)
      .modulate({ brightness: 1.1 })
      .jpeg()
      .toBuffer(),
    photo = await ingest(db, c, a, Readable.from(original), "portrait.jpg"),
    before = db.prepare("SELECT * FROM photos WHERE id=?").get(photo.id);
  assert.equal(
    (await app.inject({ url: `/api/photos/${photo.id}/edit-source` }))
      .statusCode,
    401,
  );
  for (const role of ["agent", "editor", "viewer"]) {
    const { headers } = await login(app, role);
    assert.equal(
      (
        await app.inject({
          url: `/api/photos/${photo.id}/edit-source`,
          headers,
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/api/photos/${photo.id}/edits`,
          headers,
        })
      ).statusCode,
      403,
    );
  }
  const { headers, user } = await login(app);
  assert.equal(
    (
      await app.inject({ url: `/api/photos/${photo.id}/edit-source`, headers })
    ).rawPayload.equals(original),
    true,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: `/api/photos/${photo.id}/edits`,
        headers: { cookie: headers.cookie, origin: headers.origin },
      })
    ).statusCode,
    403,
  );
  const boundary = "photo-edit-fixture",
    payload = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="portrait-retouche.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
      ),
      retouch,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
  const save = await app.inject({
    method: "POST",
    url: `/api/photos/${photo.id}/edits`,
    headers: {
      ...headers,
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    payload,
  });
  assert.equal(save.statusCode, 201, save.body);
  const pending = db
    .prepare("SELECT * FROM inbox_photos WHERE id=?")
    .get(save.json().id);
  assert.equal(pending.folder, "Retouches");
  assert.equal(pending.created_by, user.id);
  assert.notEqual(pending.hash, before.hash);
  assert.deepEqual(
    db.prepare("SELECT * FROM photos WHERE id=?").get(photo.id),
    before,
  );
  const log = db
    .prepare("SELECT detail FROM audit WHERE action='photo_edited'")
    .get();
  assert.equal(JSON.parse(log.detail).sourcePhotoId, photo.id);
});

test("presets blend from neutral without changing geometry or mutating their source", () => {
  const edit = {
    ...photoDefaults,
    rotation: 90,
    mirror: true,
    crop: { x: 0.1, y: 0.2, w: 0.6, h: 0.7 },
  };
  for (const p of photoPresets) {
    const zero = applyPhotoPreset(edit, p.id, 0),
      full = applyPhotoPreset(edit, p.id, 100);
    assert.equal(zero.exposure, 0);
    assert.equal(zero.saturation, 100);
    assert.deepEqual(full.crop, edit.crop);
    assert.equal(full.rotation, 90);
    assert.equal(full.mirror, true);
    assert.ok(
      Object.values(full).every(
        (v) => typeof v !== "number" || Number.isFinite(v),
      ),
    );
  }
  const glamour = applyPhotoPreset(edit, "glamour", 50);
  assert.equal(glamour.glamour, 24);
  assert.equal(edit.glamour, 0);
  assert.equal(applyPhotoPreset(edit, "mono").saturation, 0);
});

test("advanced optics darken edges around the crop, retain the center and preserve alpha through glamour/detail", () => {
  const pixels = new Uint8ClampedArray(9 * 9 * 4);
  for (let i = 0; i < pixels.length; i += 4)
    pixels.set([180, 150, 120, i % 16 === 0 ? 75 : 255], i);
  const alpha = pixels.filter((_, i) => i % 4 === 3),
    result = applyPhotoOptics(pixels.slice(), null, 9, 9, {
      ...photoDefaults,
      vignette: 100,
    });
  assert.equal(result[(4 * 9 + 4) * 4], 180);
  assert.ok(result[0] < 180);
  const blurred = pixels.map((v, i) => (i % 4 === 3 ? v : Math.floor(v * 0.8)));
  const glow = applyPhotoOptics(pixels.slice(), blurred, 9, 9, {
    ...photoDefaults,
    glamour: 80,
    sharpness: 20,
  });
  assert.deepEqual(
    glow.filter((_, i) => i % 4 === 3),
    alpha,
  );
  assert.notEqual(glow[0], pixels[0]);
  const tinted = adjustPixels(pixels.slice(), {
    ...photoDefaults,
    tint: 30,
    vibrance: 20,
    fade: 10,
  });
  assert.deepEqual(
    tinted.filter((_, i) => i % 4 === 3),
    alpha,
  );
});
