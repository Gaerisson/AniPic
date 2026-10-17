import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import sharp from "sharp";
import yauzl from "yauzl";
import { PDFDocument } from "pdf-lib";
import { fixture, login, animal } from "./helpers.mjs";
import { ingest } from "../server/storage.mjs";

async function unzip(buffer) {
  const zip = await new Promise((resolve, reject) =>
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (e, z) =>
      e ? reject(e) : resolve(z),
    ),
  );
  const files = new Map();
  await new Promise((resolve, reject) => {
    zip.on("error", reject);
    zip.on("end", resolve);
    zip.on("entry", (entry) =>
      zip.openReadStream(entry, (e, stream) => {
        if (e) return reject(e);
        const chunks = [];
        stream.on("data", (b) => chunks.push(b));
        stream.on("error", reject);
        stream.on("end", () => {
          files.set(entry.fileName, Buffer.concat(chunks));
          zip.readEntry();
        });
      }),
    );
    zip.readEntry();
  });
  return files;
}
async function wait(app, headers, id) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const r = await app.inject({ url: `/api/posters/exports/${id}`, headers });
    assert.equal(r.statusCode, 200, r.body);
    const job = r.json();
    if (job.state !== "running") return job;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw Error("Export did not finish");
}
test("68 posters complete in a private downloadable ZIP with seven bounded PDFs and recoverable progress", async (t) => {
  const jpeg = await sharp({
    create: { width: 320, height: 450, channels: 3, background: "#e08544" },
  })
    .jpeg()
    .toBuffer();
  let count = 0;
  const { app, db } = await fixture(t, {
      posterJobRenderer: async () => {
        count++;
        await new Promise((r) => setImmediate(r));
        return jpeg;
      },
    }),
    u = await login(app, "volunteer"),
    other = await login(app, "agent");
  const ids = Array.from({ length: 68 }, (_, i) =>
    animal(db, "Animal " + (i + 1)),
  );
  const start = await app.inject({
    method: "POST",
    url: "/api/posters/exports",
    headers: u.headers,
    payload: { animalIds: ids },
  });
  assert.equal(start.statusCode, 202, start.body);
  const id = start.json().id;
  assert.equal(
    (
      await app.inject({
        url: `/api/posters/exports/${id}`,
        headers: other.headers,
      })
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await app.inject({
        url: `/api/posters/exports/${id}/file`,
        headers: u.headers,
      })
    ).statusCode,
    409,
  );
  const result = await wait(app, u.headers, id);
  assert.equal(result.state, "done");
  assert.equal(result.done, 68);
  assert.equal(result.errors.length, 0);
  assert.equal(result.pdfs, 7);
  assert.equal(count, 68);
  const response = await app.inject({
    url: result.download,
    headers: u.headers,
  });
  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"], /application\/zip/);
  const files = await unzip(response.rawPayload);
  let pages = 0;
  for (const [name, bytes] of files) {
    assert.match(name, /\.pdf$/);
    const pdf = await PDFDocument.load(bytes);
    assert.ok(pdf.getPageCount() <= 10);
    pages += pdf.getPageCount();
  }
  assert.equal(pages, 68);
  assert.equal(files.size, 7);
  assert.equal((await app.inject({ url: result.download })).statusCode, 401);
});
test("poster job reports individual photo failures, retains successful pages and refuses requests without CSRF", async (t) => {
  const jpeg = await sharp({
    create: { width: 100, height: 140, channels: 3, background: "#888888" },
  })
    .jpeg()
    .toBuffer();
  let failed;
  const { app, db } = await fixture(t, {
      posterJobRenderer: async (id) => {
        if (id === failed) throw Error("SPA offline");
        return jpeg;
      },
    }),
    u = await login(app);
  const ids = Array.from({ length: 3 }, (_, i) => animal(db, "Profil " + i));
  failed = ids[1];
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/posters/exports",
        headers: { cookie: u.headers.cookie },
        payload: { animalIds: ids },
      })
    ).statusCode,
    403,
  );
  const start = await app.inject({
      method: "POST",
      url: "/api/posters/exports",
      headers: u.headers,
      payload: { animalIds: ids },
    }),
    result = await wait(app, u.headers, start.json().id);
  assert.equal(result.state, "done");
  assert.equal(result.done, 3);
  assert.equal(result.errors[0].animalId, failed);
  const files = await unzip(
    (await app.inject({ url: result.download, headers: u.headers })).rawPayload,
  );
  assert.equal(
    (await PDFDocument.load(files.get("affiches-box-01.pdf"))).getPageCount(),
    2,
  );
  assert.match(files.get("FICHES-EN-ERREUR.txt").toString(), /Profil 1/);
});
test("real poster batch embeds print-quality JPEG rather than enormous lossless page intermediates", async (t) => {
  const { app, db, c } = await fixture(t),
    u = await login(app),
    id = animal(db);
  const photo = await sharp({
    create: { width: 800, height: 900, channels: 3, background: "#bb6722" },
  })
    .jpeg()
    .toBuffer();
  await ingest(db, c, id, Readable.from(photo), "portrait.jpg");
  const r = await app.inject({
    method: "POST",
    url: "/api/posters/batch",
    headers: u.headers,
    payload: { animalIds: [id], template: "spa" },
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.ok(r.rawPayload.length < 2 * 1024 * 1024);
  assert.equal((await PDFDocument.load(r.rawPayload)).getPageCount(), 1);
});
