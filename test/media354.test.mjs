import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { Readable } from "node:stream";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as cheerio from "cheerio";
import sharp from "sharp";
import { createServer } from "vite";
import { fixture, login } from "./helpers.mjs";
import { ingest } from "../server/storage.mjs";
import { saveSettings } from "../server/db.mjs";
import { hashToken } from "../server/auth.mjs";

test("album inline original preserves full resolution and bytes without opening originals to public visitors or PIN-only browsers", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    viewer = await login(app, "viewer");
  const album = (
    await app.inject({
      method: "POST",
      url: "/api/collections",
      headers: admin.headers,
      payload: { name: "Original HD" },
    })
  ).json().id;
  const image = await sharp({
    create: { width: 2400, height: 1600, channels: 3, background: "#c67b42" },
  })
    .jpeg()
    .toBuffer();
  const photo = await ingest(
    db,
    c,
    null,
    Readable.from(image),
    "portrait.jpg",
    true,
    album,
  );
  const url = `/api/album-media/${photo.id}`;
  const preview = await app.inject({
    url: url + "?w=1280",
    headers: admin.headers,
  });
  assert.equal((await sharp(preview.rawPayload).metadata()).width, 1280);
  const full = await app.inject({
    url: url + "?full=1",
    headers: viewer.headers,
  });
  assert.equal(full.statusCode, 200, full.body);
  assert.match(full.headers["content-disposition"], /^inline;/);
  assert.match(full.headers["content-type"], /^image\/jpeg/);
  assert.deepEqual(full.rawPayload, image);
  assert.equal((await sharp(full.rawPayload).metadata()).width, 2400);
  assert.equal((await app.inject({ url: url + "?full=1" })).statusCode, 404);
  const download = await app.inject({
    url: url + "?original=1",
    headers: admin.headers,
  });
  assert.match(download.headers["content-disposition"], /^attachment;/);
  await app.inject({
    method: "PATCH",
    url: `/api/collections/${album}`,
    headers: admin.headers,
    payload: { isPublic: true },
  });
  assert.equal((await app.inject({ url })).statusCode, 200);
  assert.equal((await app.inject({ url: url + "?full=1" })).statusCode, 401);
  saveSettings(db, { accessPinEnabled: true });
  db.prepare("INSERT INTO site_passes VALUES (?,?)").run(
    hashToken("pin-only-test-browser"),
    "",
  );
  const gate = { cookie: "anipic_gate=pin-only-test-browser" };
  assert.equal((await app.inject({ url, headers: gate })).statusCode, 200);
  const refused = await app.inject({ url: url + "?full=1", headers: gate });
  assert.equal(refused.statusCode, 401);
  assert.notEqual(refused.json().code, "SITE_PIN_REQUIRED");
  assert.equal(
    (await app.inject({ url: url + "?full=1", headers: viewer.headers }))
      .statusCode,
    200,
  );
  db.prepare("UPDATE sessions SET expires_at='2000-01-01T00:00:00.000Z'").run();
  assert.equal(
    (
      await app.inject({
        url: url + "?full=1",
        headers: {
          ...gate,
          cookie: gate.cookie + "; " + viewer.headers.cookie,
        },
      })
    ).statusCode,
    401,
  );
});

test("TV render specifies its own foreground for every style and orientation, messages and statistics", async (t) => {
  const vite = await createServer({
    root: path.resolve(import.meta.dirname, ".."),
    configFile: false,
    esbuild: { jsx: "automatic" },
    optimizeDeps: { noDiscovery: true, include: [], entries: [] },
    server: { middlewareMode: true, hmr: false },
    logLevel: "error",
  });
  t.after(() => vite.close());
  const { SignageCanvas } = await vite.ssrLoadModule(
    "/shared/SignageCanvas.jsx",
  );
  const item = {
    id: "test-tom",
    name: "TOM",
    species: "dog",
    sex: "male",
    age: "9 ans",
    breed: "Labrador",
    status: "available",
    compatibility: {},
    description: "Un compagnon à rencontrer.",
    media: [{ kind: "photo", src: "/photo-test.jpg" }],
  };
  for (const orientation of ["landscape", "portrait"]) {
    for (const style of ["editorial", "glass", "cinema", "cards"]) {
      const show = {
        refugeName: "Refuge test",
        items: [item],
        program: {
          orientation,
          style,
          motion: "off",
          introSeconds: 0,
          statsEnabled: true,
          statsEvery: 1,
          logoEvery: 0,
        },
      };
      const html = renderToStaticMarkup(
        React.createElement(SignageCanvas, { show, frame: 1 }),
      );
      const $ = cheerio.load(html);
      assert.equal($("h1").text(), "TOM");
      const ink = style === "editorial" ? "#241f1b" : "#f9f6f2";
      assert.ok(
        $("h1")
          .attr("style")
          .includes("color:" + ink),
        style + orientation,
      );
      assert.ok(
        $("p")
          .filter((_, el) => $(el).text() === item.description)
          .attr("style")
          .includes("color:" + ink),
      );
      const stats = cheerio.load(
        renderToStaticMarkup(
          React.createElement(SignageCanvas, { show, frame: 145 }),
        ),
      );
      assert.match(stats("h1").attr("style"), /color:#f9f6f2/);
      assert.match(stats("strong").first().attr("style"), /color:#f9f6f2/);
    }
  }
  for (const type of ["message", "spa", "hours"]) {
    const show = {
      refugeName: "Refuge test",
      items: [],
      program: {
        motion: "off",
        introSeconds: 0,
        inserts: [
          {
            id: "notice",
            type,
            title: "Bienvenue au refuge",
            body: "Lundi : 14h–17h",
            theme: "christmas",
            seconds: 10,
            afterAnimal: 0,
          },
        ],
      },
    };
    const $ = cheerio.load(
      renderToStaticMarkup(
        React.createElement(SignageCanvas, { show, frame: 1 }),
      ),
    );
    assert.match($("h1").attr("style"), /color:#fff8f1/);
  }
});
