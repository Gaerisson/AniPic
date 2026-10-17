import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import sharp from "sharp";
import { fixture, login } from "./helpers.mjs";
import { ingest } from "../server/storage.mjs";
test("album move cycles, private destination, rename/caption, trash/restore and read-only users", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    viewer = await login(app, "viewer");
  const create = async (name, parentId = null) =>
    (
      await app.inject({
        method: "POST",
        url: "/api/collections",
        headers: admin.headers,
        payload: { name, parentId },
      })
    ).json().id;
  const one = await create("Un"),
    two = await create("Deux"),
    child = await create("Enfant", one);
  const image = await sharp({
      create: { width: 40, height: 60, channels: 3, background: "#dd7a40" },
    })
      .jpeg()
      .toBuffer(),
    p = await ingest(db, c, null, Readable.from(image), "a.jpg", true, one);
  const patch = (body, headers = admin.headers) =>
    app.inject({
      method: "PATCH",
      url: `/api/collections/${one}/items/${p.id}`,
      headers,
      payload: body,
    });
  assert.equal(
    (
      await app.inject({
        method: "PATCH",
        url: "/api/collections/" + one,
        headers: admin.headers,
        payload: { parentId: child },
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (await patch({ filename: "nouveau.jpg", caption: "Souvenir" })).statusCode,
    200,
  );
  assert.equal(
    db.prepare("SELECT filename FROM album_photos WHERE id=?").get(p.id)
      .filename,
    "nouveau.jpg",
  );
  assert.equal((await patch({ filename: "../../bad" })).statusCode, 400);
  assert.equal(
    (await patch({ deleted: true }, viewer.headers)).statusCode,
    403,
  );
  assert.equal((await patch({ deleted: true })).statusCode, 200);
  assert.equal(
    (
      await app.inject({
        url: "/api/collections/" + one,
        headers: admin.headers,
      })
    ).json().photos.length,
    0,
  );
  assert.equal(
    (
      await app.inject({
        url: "/api/collections/" + one + "?trash=1",
        headers: admin.headers,
      })
    ).json().photos.length,
    1,
  );
  await patch({ deleted: false });
  await app.inject({
    method: "PATCH",
    url: "/api/collections/" + two,
    headers: admin.headers,
    payload: { isPublic: true },
  });
  assert.equal((await patch({ destinationId: two })).statusCode, 409);
  await app.inject({
    method: "PATCH",
    url: "/api/collections/" + two,
    headers: admin.headers,
    payload: { isPublic: false },
  });
  assert.equal((await patch({ destinationId: two })).statusCode, 200);
  assert.equal(
    db.prepare("SELECT collection_id FROM album_photos WHERE id=?").get(p.id)
      .collection_id,
    two,
  );
  assert.equal(
    (await app.inject({ url: `/api/album-media/${p.id}` })).statusCode,
    404,
  );
  assert.equal(
    (
      await app.inject({
        url: `/api/album-media/${p.id}`,
        headers: admin.headers,
      })
    ).statusCode,
    200,
  );
  assert.equal(db.prepare("SELECT COUNT(*) n FROM blobs").get().n, 1);
});
