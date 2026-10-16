import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import sharp from "sharp";
import { fixture, login } from "./helpers.mjs";
import { createBackup, restoreBackup } from "../server/backup.mjs";
const endpoint = "/api/admin/assistant/avatar";
const upload = (app, headers, buffer, extra = Buffer.alloc(0)) => {
  const boundary = "anipic-avatar-fixture";
  return app.inject({
    method: "POST",
    url: endpoint,
    headers: {
      ...headers,
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="avatar.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      buffer,
      extra,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
};
const image = () =>
  sharp({
    create: { width: 1000, height: 700, channels: 4, background: "#f28045aa" },
  })
    .png()
    .withMetadata({ orientation: 6 })
    .toBuffer();

test("assistant avatar changes require an administrator and CSRF protection", async (t) => {
  const { app } = await fixture(t);
  for (const method of ["POST", "DELETE"]) {
    assert.equal((await app.inject({ method, url: endpoint })).statusCode, 401);
  }
  for (const role of ["agent", "editor", "viewer"]) {
    const { headers } = await login(app, role);
    for (const method of ["POST", "DELETE"])
      assert.equal(
        (await app.inject({ method, url: endpoint, headers })).statusCode,
        403,
      );
  }
  const { headers } = await login(app);
  for (const method of ["POST", "DELETE"]) {
    assert.equal(
      (
        await app.inject({
          method,
          url: endpoint,
          headers: { cookie: headers.cookie },
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await app.inject({
          method,
          url: endpoint,
          headers: { ...headers, origin: "https://foreign.example" },
        })
      ).statusCode,
      403,
    );
  }
});

test("avatar is normalized, public, backed up, protected from settings injection and reset without photo files", async (t) => {
  const { app, db, c, base } = await fixture(t),
    { headers } = await login(app);
  assert.equal(
    (await app.inject({ url: "/api/overview" })).json().assistantAvatarUrl,
    null,
  );
  assert.equal(
    (await app.inject({ url: "/api/assistant/avatar" })).statusCode,
    404,
  );
  const saved = await upload(app, headers, await image());
  assert.equal(saved.statusCode, 201, saved.body);
  const { url } = saved.json(),
    picture = await app.inject({ url }),
    metadata = await sharp(picture.rawPayload).metadata();
  assert.equal(picture.statusCode, 200);
  assert.match(picture.headers["content-type"], /image\/webp/);
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 512);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.orientation, undefined);
  assert.equal(metadata.hasAlpha, true);
  assert.equal(
    (await app.inject({ url: "/api/overview" })).json().assistantAvatarUrl,
    url,
  );
  const current = (
    await app.inject({ url: "/api/admin/settings", headers })
  ).json();
  assert.equal(current.assistantAvatarImage, undefined);
  const forged = await app.inject({
    method: "PUT",
    url: "/api/admin/settings",
    headers,
    payload: {
      ...current,
      assistantAvatarImage: { hash: "forged", data: "PHN2Zy8+" },
    },
  });
  assert.equal(forged.statusCode, 200, forged.body);
  assert.equal(forged.json().assistantAvatarImage, undefined);
  assert.ok((await app.inject({ url })).rawPayload.equals(picture.rawPayload));
  for (const table of ["photos", "inbox_photos", "blobs"])
    assert.equal(db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n, 0);
  const backup = await createBackup(db, c),
    destination = path.join(base, "avatar-restore");
  await restoreBackup(path.join(c.backupDir, backup.filename), destination);
  const restored = new DatabaseSync(
    path.join(destination, "data", "anipic.sqlite"),
    {
      readOnly: true,
    },
  );
  try {
    const value = JSON.parse(
      restored
        .prepare("SELECT value FROM settings WHERE key='assistantAvatarImage'")
        .get().value,
    );
    assert.ok(Buffer.from(value.data, "base64").equals(picture.rawPayload));
  } finally {
    restored.close();
  }
  assert.equal(
    (await app.inject({ method: "DELETE", url: endpoint, headers })).json().url,
    null,
  );
  assert.equal((await app.inject({ url })).statusCode, 404);
  assert.equal(
    (await app.inject({ url: "/api/overview" })).json().assistantAvatarUrl,
    null,
  );
});

test("invalid, oversized and multiple avatar files cannot replace the current image", async (t) => {
  const { app } = await fixture(t),
    { headers } = await login(app),
    good = await image(),
    saved = await upload(app, headers, good),
    url = saved.json().url,
    before = (await app.inject({ url })).rawPayload;
  for (const buffer of [
    Buffer.from(
      "<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'/>",
    ),
    Buffer.from("not an image"),
    await sharp({
      create: { width: 5000, height: 5000, channels: 3, background: "#fff" },
    })
      .png()
      .toBuffer(),
  ])
    assert.equal((await upload(app, headers, buffer)).statusCode, 400);
  assert.equal(
    (await upload(app, headers, Buffer.alloc(5 * 1024 ** 2 + 1))).statusCode,
    413,
  );
  const extra = Buffer.concat([
    Buffer.from(
      '\r\n--anipic-avatar-fixture\r\nContent-Disposition: form-data; name="extra"; filename="second.png"\r\nContent-Type: image/png\r\n\r\n',
    ),
    good,
  ]);
  assert.equal((await upload(app, headers, good, extra)).statusCode, 413);
  assert.ok((await app.inject({ url })).rawPayload.equals(before));
});
