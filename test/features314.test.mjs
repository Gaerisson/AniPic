import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import sharp from "sharp";
import { Rect, Shadow, Gradient } from "fabric";
import { fixture, login, animal } from "./helpers.mjs";
import { id, now, saveSettings, openDb } from "../server/db.mjs";
import { hashPassword } from "../server/auth.mjs";
import { ingest } from "../server/storage.mjs";
import { purgeTrash } from "../server/trash.mjs";
import { applySnapshot, normalizeSnapshot } from "../server/source.mjs";
import { savePresence } from "../server/source-presence.mjs";
import { sourceHealth } from "../server/source-health.mjs";
import { annualAdoptions } from "../server/annual-statistics.mjs";
import { resolveFilm, Film } from "../server/video.mjs";
import { aiResponseText, requestAiText } from "../server/ai-response.mjs";
import {
  validateCanvasDocument,
  canvasHistoryPush,
  canonicalCanvasDocument,
} from "../shared/canvas-document.mjs";
import {
  writingCorrections,
  localWritingIssues,
} from "../shared/writing-corrections.mjs";
import { instant, formatInstant } from "../shared/instant.mjs";
import {
  missingInterfaceAsset,
  reserveInterfaceRecovery,
} from "../shared/asset-recovery.mjs";
test("an outdated interface can recover once without entering a reload loop or relying on available browser storage", () => {
  const values = new Map(),
    storage = {
      getItem: (key) => values.get(key),
      setItem: (key, value) => values.set(key, value),
    };
  assert.equal(
    missingInterfaceAsset(
      Error("Failed to fetch dynamically imported module: /assets/old.js"),
    ),
    true,
  );
  assert.equal(missingInterfaceAsset(Error("Invalid animal data")), false);
  assert.equal(reserveInterfaceRecovery(storage, 1000000), true);
  assert.equal(reserveInterfaceRecovery(storage, 1000500), false);
  assert.equal(reserveInterfaceRecovery(storage, 1120001), true);
  assert.equal(
    reserveInterfaceRecovery({
      getItem() {
        throw Error("blocked");
      },
    }),
    false,
  );
});
const document = () => ({
  schema: 1,
  width: 1920,
  height: 720,
  scene: {
    version: "7.4.0",
    objects: [{ type: "Textbox", text: "Une rencontre", left: 50, top: 80 }],
  },
});
const call = (app, headers, method, url, payload) =>
  app.inject({ headers, method, url, payload });

test("Canvas projects enforce private ownership, sharing, role checks, CSRF and revision conflicts", async (t) => {
  const { app } = await fixture(t),
    author = await login(app, "volunteer"),
    other = await login(app, "agent"),
    viewer = await login(app, "viewer");
  const value = {
    title: "Bannière du refuge",
    document: document(),
    shared: false,
  };
  assert.equal(
    (await call(app, {}, "POST", "/api/canvas/projects", value)).statusCode,
    401,
  );
  assert.equal(
    (await call(app, viewer.headers, "POST", "/api/canvas/projects", value))
      .statusCode,
    403,
  );
  assert.equal(
    (
      await call(
        app,
        { ...author.headers, "x-csrf-token": "wrong" },
        "POST",
        "/api/canvas/projects",
        value,
      )
    ).statusCode,
    403,
  );
  const created = await call(
    app,
    author.headers,
    "POST",
    "/api/canvas/projects",
    value,
  );
  assert.equal(created.statusCode, 200, created.body);
  const url = "/api/canvas/projects/" + created.json().id;
  assert.equal(
    (await app.inject({ url, headers: other.headers })).statusCode,
    404,
  );
  assert.equal(
    (
      await app.inject({ url: "/api/canvas/projects", headers: other.headers })
    ).json().projects.length,
    0,
  );
  const update = await call(app, author.headers, "PUT", url, {
    ...value,
    shared: true,
    revision: 1,
  });
  assert.equal(update.statusCode, 200, update.body);
  assert.equal(
    (await call(app, author.headers, "PUT", url, { ...value, revision: 1 }))
      .statusCode,
    409,
  );
  assert.equal(
    (await app.inject({ url, headers: viewer.headers })).statusCode,
    200,
  );
  assert.equal(
    (await call(app, other.headers, "PUT", url, { ...value, revision: 2 }))
      .statusCode,
    403,
  );
  assert.equal((await call(app, other.headers, "DELETE", url)).statusCode, 403);
  assert.equal(
    (await call(app, author.headers, "DELETE", url)).statusCode,
    200,
  );
  assert.equal(
    (await app.inject({ url, headers: author.headers })).statusCode,
    404,
  );
});
test("Canvas validation rejects remote URLs, executable types, excessive sizes and prototype pollution; history is bounded", () => {
  assert.equal(validateCanvasDocument(document()).width, 1920);
  assert.throws(() =>
    validateCanvasDocument({
      ...document(),
      scene: { objects: [{ type: "ActiveSelection", objects: [] }] },
    }),
  );
  assert.throws(() =>
    validateCanvasDocument({
      ...document(),
      scene: {
        objects: Array.from({ length: 251 }, () => ({
          type: "Rect",
          width: 10,
          height: 10,
        })),
      },
    }),
  );
  const portable = canonicalCanvasDocument(
    {
      ...document(),
      scene: {
        objects: [{ type: "Image", src: "http://localhost:3038/spa-logo.png" }],
      },
    },
    "http://localhost:3038",
  );
  assert.equal(portable.scene.objects[0].src, "/spa-logo.png");
  assert.doesNotThrow(() => validateCanvasDocument(portable));
  assert.throws(() =>
    validateCanvasDocument(
      canonicalCanvasDocument(
        {
          ...document(),
          scene: {
            objects: [
              { type: "Image", src: "https://foreign.test/spa-logo.png" },
            ],
          },
        },
        "http://localhost:3038",
      ),
    ),
  );

  for (const src of [
    "https://external.test/tracker.png",
    "javascript:alert(1)",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "file:///etc/passwd",
  ])
    assert.throws(() =>
      validateCanvasDocument({
        ...document(),
        scene: { objects: [{ type: "Image", src }] },
      }),
    );
  assert.throws(() =>
    validateCanvasDocument({ ...document(), width: 8000, height: 8000 }),
  );
  assert.throws(() =>
    validateCanvasDocument({
      ...document(),
      scene: JSON.parse('{"objects":[],"__proto__":{"polluted":true}}'),
    }),
  );
  let h = [];
  for (let i = 0; i < 70; i++) h = canvasHistoryPush(h, String(i));
  assert.equal(h.length, 30);
  assert.equal(h.at(-1), "69");
});
test("Canvas accepts real Fabric shadows and gradients as properties while rejecting them as drawable layers", () => {
  const rectangle = new Rect({
    width: 300,
    height: 200,
    shadow: new Shadow({ blur: 20, color: "#0004" }),
    fill: new Gradient({
      type: "linear",
      coords: { x1: 0, y1: 0, x2: 300, y2: 200 },
      colorStops: [
        { offset: 0, color: "#fff" },
        { offset: 1, color: "#f47721" },
      ],
    }),
  }).toObject();
  assert.doesNotThrow(() =>
    validateCanvasDocument({ ...document(), scene: { objects: [rectangle] } }),
  );
  for (const type of ["shadow", "linear", "radial", "blur"]) {
    for (const objects of [[{ type }], [{ type: "Group", objects: [{ type }] }]])
      assert.throws(() =>
        validateCanvasDocument({ ...document(), scene: { objects } }),
      );
  }
});
test("AI adapters return only public text and retry empty or truncated output once with a bounded larger budget", async () => {
  assert.equal(
    aiResponseText(
      {
        output: [
          { type: "reasoning", content: [{ type: "text", text: "secret" }] },
          {
            type: "message",
            content: [{ type: "output_text", text: "🐾 Une rencontre." }],
          },
        ],
      },
      "openai",
    ),
    "🐾 Une rencontre.",
  );
  const requests = [];
  const fetcher = async (_, init) => {
    requests.push(JSON.parse(init.body));
    return new Response(
      JSON.stringify(
        requests.length === 1
          ? {
              choices: [
                {
                  message: { content: "", reasoning_content: "not public" },
                  finish_reason: "length",
                },
              ],
            }
          : {
              choices: [
                {
                  message: {
                    content: [
                      { type: "output_text", text: "Une belle histoire." },
                    ],
                  },
                  finish_reason: "stop",
                },
              ],
            },
      ),
    );
  };
  assert.equal(
    await requestAiText({
      url: "https://ai.test",
      body: { max_tokens: 4096 },
      fetcher,
      provider: "openai",
    }),
    "Une belle histoire.",
  );
  assert.equal(requests.length, 2);
  assert.equal(requests[1].max_tokens, 8192);
  let emptyCalls = 0;
  await assert.rejects(
    requestAiText({
      url: "https://ai.test",
      body: {},
      provider: "openai",
      fetcher: async () => {
        emptyCalls++;
        return new Response(
          '{"choices":[{"message":{"content":"","reasoning_content":"secret"}}]}',
        );
      },
    }),
    (e) => e.code === "AI_EMPTY_RESPONSE" && !e.message.includes("secret"),
  );
  assert.equal(emptyCalls, 2);
  let quotaCalls = 0;
  await assert.rejects(
    requestAiText({
      url: "https://ai.test",
      body: {},
      fetcher: async () => {
        quotaCalls++;
        return new Response("quota", { status: 429 });
      },
    }),
    (e) => e.code === "AI_PROVIDER_ERROR",
  );
  assert.equal(quotaCalls, 1);
});
test("text corrections retain exact Unicode offsets and punctuation replacements; legacy SQL timestamps are UTC", () => {
  const before = "🐾 Nala est tres gentille.\n\nElle joue.",
    after = "🐾 Nala est très gentille !\n\nElle joue.";
  let result = before;
  const changes = writingCorrections(before, after);
  for (const change of [...changes].reverse())
    result =
      result.slice(0, change.from) + change.after + result.slice(change.to);
  assert.equal(result, after);
  assert.ok(changes.length >= 2);
  assert.ok(localWritingIssues("Bonjour  le le refuge.....").length >= 2);
  assert.equal(
    instant("2026-10-22 16:49:00").toISOString(),
    "2026-10-22T16:49:00.000Z",
  );
  assert.match(formatInstant("2026-10-22 16:49:00"), /18:49/);
});
test("TV with PIN enabled serves only configured public portraits, without exposing hidden photos or private APIs", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    a = animal(db);
  const bytes = await sharp({
    create: { width: 80, height: 100, channels: 3, background: "#fa7944" },
  })
    .jpeg()
    .toBuffer();
  const p = await ingest(db, c, a, Readable.from(bytes), "portrait.jpg"),
    hidden = await ingest(db, c, a, Readable.from(bytes), "private.jpg", true);
  // The ingest deduplication is per hash; ensure the chosen public portrait remains public.
  db.prepare("UPDATE photos SET hidden=0 WHERE id=?").run(p.id);
  saveSettings(db, {
    displayEnabled: true,
    accessPinEnabled: true,
    accessPinHash: await hashPassword("582104"),
  });
  const show = await app.inject("/api/public/display");
  assert.equal(show.statusCode, 200, show.body);
  const publicPhoto = await app.inject("/api/public/display/photos/" + p.id);
  assert.equal(publicPhoto.statusCode, 200, publicPhoto.body);
  assert.equal(publicPhoto.headers["content-type"], "image/webp");
  for (const url of [
    "/api/overview",
    "/api/animals",
    "/media/" + p.id,
    "/api/admin/display/screens",
  ])
    assert.equal((await app.inject(url)).statusCode, 401, url);
  db.prepare("UPDATE photos SET hidden=1 WHERE id=?").run(p.id);
  assert.equal(
    (await app.inject("/api/public/display/photos/" + p.id)).statusCode,
    404,
  );
  db.prepare("UPDATE photos SET hidden=0 WHERE id=?").run(p.id);
  saveSettings(db, { displayHiddenIds: [a] });
  assert.equal(
    (await app.inject("/api/public/display/photos/" + p.id)).statusCode,
    404,
  );
  saveSettings(db, {
    displayHiddenIds: [],
    displayProgram: { tags: ["une-selection"] },
  });
  assert.equal(
    (await app.inject("/api/public/display/photos/" + p.id)).statusCode,
    404,
  );
  assert.equal(
    (
      await call(app, {}, "POST", "/api/public/display/poll", {
        id: id(),
        token: "wrong",
      })
    ).statusCode >= 400,
    true,
  );
});
test("permanent purge removes actual animal records and history, preserves anonymous annual totals and blocks reimport", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    a = animal(db, "Archive à effacer");
  db.prepare(
    "UPDATE animals SET source_scope='spa:moree',source_id='spa:314',archived_at=?,departed_at=?,status='adopted' WHERE id=?",
  ).run(now(), now(), a);
  db.prepare("INSERT INTO animal_status_events VALUES (?,?,?,?)").run(
    id(),
    a,
    "adopted",
    "2026-10-01T10:00:00Z",
  );
  db.prepare("INSERT INTO writing_drafts VALUES (?,?,?,?,?,?,?)").run(
    id(),
    a,
    admin.user.id,
    "Ancien texte",
    "Ancienne proposition",
    "create",
    now(),
  );
  assert.equal(annualAdoptions(db, 2026).count, 1);
  assert.equal(
    (await call(app, admin.headers, "POST", `/api/animals/${a}/trash`, {}))
      .statusCode,
    200,
  );
  const selection = (
    await app.inject({ url: "/api/video/year/2026", headers: admin.headers })
  ).json();
  assert.ok(!selection.animals.some((animal) => animal.id === a));
  const result = await purgeTrash(db, c, admin.user);
  assert.equal(result.animals, 1);
  for (const table of [
    "animals",
    "animal_changes",
    "feed_events",
    "writing_drafts",
  ])
    assert.equal(
      db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,
      0,
      table,
    );
  assert.equal(annualAdoptions(db, 2026).count, 1);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM source_deletions").get().n,
    1,
  );
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  applySnapshot(
    db,
    normalizeSnapshot({
      schemaVersion: 1,
      scope: "spa:moree",
      animals: [
        { sourceId: "spa:314", name: "Ne pas ressusciter", species: "dog" },
      ],
    }),
  );
  assert.equal(db.prepare("SELECT COUNT(*) n FROM animals").get().n, 0);
  savePresence(
    db,
    {
      scope: "spa:moree",
      complete: true,
      fetchedAt: now(),
      animals: [{ sourceId: "spa:314" }],
    },
    now(),
  );
  assert.equal(
    sourceHealth(db, { sourceMode: "spa", sourceScope: "spa:moree" }).newCount,
    0,
  );
  const reopened = openDb(c);
  assert.equal(reopened.prepare("PRAGMA user_version").get().user_version, 24);
  reopened.close();
});
test("SPA stills are accepted by annual mosaics in portrait; a video-specific adoption count overrides the annual count", async (t) => {
  const { db, c } = await fixture(t),
    a = animal(db);
  db.prepare("UPDATE animals SET source_metadata=? WHERE id=?").run(
    JSON.stringify({
      thumbnail: "https://www.la-spa.fr/app/uploads/animals/314/test.jpg",
    }),
    a,
  );
  const input = {
    title: "Bilan",
    template: "year",
    annualStyle: "mosaic",
    aspect: "portrait",
    year: 2026,
    annualAdoptionsOverride: 153,
    clips: [{ kind: "spa", ref: a, seconds: 3 }],
  };
  assert.equal(Film.safeParse(input).success, true);
  const film = resolveFilm(db, c, input, () => "/portrait.jpg");
  assert.equal(film.yearStats.adopted, 153);
  assert.equal(film.clips[0].sourcePhoto, true);
  assert.equal(
    Film.safeParse({ ...input, annualAdoptionsOverride: -1 }).success,
    false,
  );
});
