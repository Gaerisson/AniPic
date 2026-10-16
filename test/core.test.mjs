import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs, createReadStream } from "node:fs";
import path from "node:path";
import os from "node:os";
import { Readable } from "node:stream";
import { DatabaseSync } from "node:sqlite";
import sharp from "sharp";
import * as tar from "tar";
import { createApp } from "../server/app.mjs";
import { createUser } from "../server/auth.mjs";
import { id, now, saveSettings } from "../server/db.mjs";
import { ingest, sweepCache } from "../server/storage.mjs";
import { normalizeSnapshot, applySnapshot } from "../server/source.mjs";
import { createBackup, restoreBackup } from "../server/backup.mjs";
import { collectSpa } from "../server/spa-collector.mjs";
async function fixture(t) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "anipic-test-"));
  const app = await createApp({
    dbDir: path.join(base, "db"),
    mediaDir: path.join(base, "media"),
    cacheDir: path.join(base, "cache"),
    backupDir: path.join(base, "backups"),
    scheduler: false,
    origin: "http://localhost:3000",
  });
  t.after(async () => {
    await app.close();
    await fs.rm(base, { recursive: true, force: true });
  });
  return { app, db: app.db, c: app.anipicConfig, base };
}
async function login(app, role = "admin", name = "admin") {
  await createUser(app.db, name, "a secure test password 123", role);
  const result = await app.inject({
    method: "POST",
    url: "/api/login",
    payload: { name, password: "a secure test password 123" },
  });
  assert.equal(result.statusCode, 200);
  assert.match(result.headers["set-cookie"], /HttpOnly/);
  assert.match(result.headers["set-cookie"], /SameSite=Strict/);
  const session = result.json().user;
  return {
    cookie: result.headers["set-cookie"].split(";")[0],
    "x-csrf-token": session.csrf,
    origin: "http://localhost:3000",
  };
}
async function animal(app, headers, name = "Nala") {
  const animalId = id();
  app.db
    .prepare(
      "INSERT INTO animals(id,name,species,sex,description,source_id,created_at,updated_at) VALUES (?,?,'dog','female','Portrait',?,?,?)",
    )
    .run(animalId, name, "spa:test-" + animalId, now(), now());
  return animalId;
}
async function jpeg() {
  return sharp({
    create: { width: 240, height: 150, channels: 3, background: "#d29e72" },
  })
    .jpeg()
    .toBuffer();
}
test("anonymous writes, admin records and demo access are denied", async (t) => {
  const { app } = await fixture(t);
  assert.equal(
    (await app.inject({ url: "/api/admin/settings" })).statusCode,
    401,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/animals",
        payload: { name: "Nala", species: "dog" },
      })
    ).statusCode,
    401,
  );
  assert.equal(
    (await app.inject({ method: "POST", url: "/api/demo-session" })).statusCode,
    404,
  );
  assert.equal(
    (await app.inject({ url: "/api/session" })).json().needsSetup,
    true,
  );
});
test("roles, CSRF and origin checks protect state changes", async (t) => {
  const { app } = await fixture(t);
  const admin = await login(app);
  const editor = await login(app, "editor", "editor");
  const viewer = await login(app, "viewer", "viewer");
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/animals",
        headers: { cookie: admin.cookie },
        payload: { name: "Nala", species: "dog" },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/animals",
        headers: { ...admin, origin: "https://evil.example" },
        payload: { name: "Nala", species: "dog" },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (await app.inject({ url: "/api/admin/storage", headers: editor }))
      .statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/animals",
        headers: viewer,
        payload: { name: "Nala", species: "dog" },
      })
    ).statusCode,
    403,
  );
  await animal(app, editor);
});
test("same names have different identities; rename keeps references", async (t) => {
  const { app, db } = await fixture(t);
  const headers = await login(app);
  const one = await animal(app, headers);
  const two = await animal(app, headers);
  assert.notEqual(one, two);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM animals WHERE name='Nala'").get().n,
    2,
  );
  const response = await app.inject({
    method: "PATCH",
    url: "/api/animals/" + one,
    headers,
    payload: {
      name: "Luna",
      species: "cat",
      sex: "female",
      description: "Renamed",
    },
  });
  assert.equal(response.statusCode, 403);
  const sourceId = db
    .prepare("SELECT source_id FROM animals WHERE id=?")
    .get(one).source_id;
  applySnapshot(
    db,
    normalizeSnapshot({
      schemaVersion: 1,
      complete: false,
      scope: "test",
      animals: [
        {
          sourceId,
          name: "Luna",
          species: "cat",
          sex: "female",
          description: "Renamed by source",
        },
      ],
    }),
  );
  assert.equal(
    db.prepare("SELECT id FROM animals WHERE name=?").get("Luna").id,
    one,
  );
});
test("content deduplication, private originals and bounded previews", async (t) => {
  const { app, db, c } = await fixture(t);
  const headers = await login(app);
  const one = await animal(app, headers);
  const two = await animal(app, headers);
  const image = await jpeg();
  const first = await ingest(db, c, one, Readable.from(image), "one.jpg", true);
  const duplicate = await ingest(
    db,
    c,
    one,
    Readable.from(image),
    "copy.jpg",
    true,
  );
  const other = await ingest(db, c, two, Readable.from(image), "two.jpg");
  assert.equal(duplicate.duplicate, true);
  assert.equal(first.id, duplicate.id);
  assert.notEqual(first.id, other.id);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM blobs").get().n, 1);
  assert.equal(
    (await app.inject({ url: "/media/" + first.id })).statusCode,
    404,
  );
  assert.equal(
    (await app.inject({ url: "/media/" + other.id + "?original=1" }))
      .statusCode,
    401,
  );
  assert.equal(
    (await app.inject({ url: "/media/" + other.id + "?w=999999" })).statusCode,
    400,
  );
  const preview = await app.inject({ url: "/media/" + other.id + "?w=320" });
  assert.equal(preview.statusCode, 200, preview.body);
  assert.match(preview.headers["content-type"], /image\/webp/);
  assert.equal((await sharp(preview.rawPayload).metadata()).width, 240);
  assert.equal(
    (await app.inject({ url: "/media/" + first.id + "?original=1", headers }))
      .statusCode,
    200,
  );
  await sweepCache(c, 0, true);
  assert.equal((await fs.readdir(c.cacheDir)).length, 0);
  assert.equal(
    (await fs.readdir(c.mediaDir)).filter((s) => !s.startsWith(".")).length,
    1,
  );
});
test("invalid image and oversized stream leave no published photo", async (t) => {
  const { app, db, c } = await fixture(t);
  const headers = await login(app);
  const one = await animal(app, headers);
  await assert.rejects(() =>
    ingest(db, c, one, Readable.from(Buffer.from("<svg/>")), "image.svg"),
  );
  await assert.rejects(() =>
    ingest(
      db,
      { ...c, maxUploadBytes: 8 },
      one,
      Readable.from(awaitableBuffer()),
      "large.jpg",
    ),
  );
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos").get().n, 0);
  assert.deepEqual(await fs.readdir(c.mediaDir), []);
});
function awaitableBuffer() {
  return Buffer.alloc(100);
}
test("archiving is reversible and does not duplicate or remove originals", async (t) => {
  const { app, db, c } = await fixture(t);
  const headers = await login(app);
  const one = await animal(app, headers);
  const p = await ingest(db, c, one, Readable.from(await jpeg()), "one.jpg");
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/animals/" + one + "/archive",
        headers,
        payload: { archived: true },
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (await app.inject({ url: "/api/animals?archive=0" })).json().total,
    0,
  );
  assert.equal(
    (await app.inject({ url: "/api/animals?archive=1" })).json().total,
    1,
  );
  await app.inject({
    method: "POST",
    url: "/api/animals/" + one + "/archive",
    headers,
    payload: { archived: false },
  });
  assert.equal(
    (await app.inject({ url: "/api/animals?archive=0" })).json().total,
    1,
  );
  assert.equal(db.prepare("SELECT id FROM photos").get().id, p.id);
  assert.equal((await fs.readdir(c.mediaDir)).length, 1);
});
test("historical V2 uses SPA IDs, keeps same-name animals and descriptive fields", () => {
  const snapshot = normalizeSnapshot({
    global: {
      dog_list: {
        first: {
          id: 42,
          name: "Nala",
          url: "https://www.la-spa.fr/animal/nala/",
          race: "Golden",
          sexe: "Femelle",
          date_naissance: "15/04/2022",
          entente: { chat: "oui" },
        },
        second: { id: 43, name: "Nala", sexe: "Femelle" },
      },
    },
  });
  assert.equal(snapshot.animals.length, 2);
  assert.deepEqual(
    snapshot.animals.map((a) => a.sourceId),
    ["spa:42", "spa:43"],
  );
  assert.equal(snapshot.animals[0].birthDate, "2022-04-15");
  assert.equal(snapshot.animals[0].breed, "Golden");
  assert.equal(snapshot.animals[0].compatibility.chat, "oui");
  assert.equal(snapshot.complete, false);
  assert.throws(
    () => normalizeSnapshot({ dog_list: { nala: { name: "Nala" } } }),
    /ni ID ni URL/,
  );
  assert.throws(() => normalizeSnapshot({ nb_animaux_dog: "", refuge: "" }));
});
test("empty, duplicate-ID or inconsistent complete inventories are rejected", () => {
  assert.throws(() =>
    normalizeSnapshot({
      schemaVersion: 1,
      animals: [
        {
          sourceId: "42",
          name: "Nala",
          species: "dog",
          sourceUrl: "javascript:alert(1)",
        },
      ],
    }),
  );
  assert.throws(() =>
    normalizeSnapshot({
      schemaVersion: 1,
      animals: [],
      complete: true,
      expectedCount: 0,
      fetchedAt: now(),
    }),
  );
  assert.throws(
    () =>
      normalizeSnapshot({
        schemaVersion: 1,
        animals: [
          { sourceId: "42", name: "Nala", species: "dog" },
          { sourceId: "42", name: "Other", species: "cat" },
        ],
      }),
    /dupliqués/,
  );
  assert.throws(
    () =>
      normalizeSnapshot({
        schemaVersion: 1,
        complete: true,
        expectedCount: 3,
        fetchedAt: now(),
        animals: [{ sourceId: "42", name: "Nala", species: "dog" }],
      }),
    /expectedCount/,
  );
});
test("partial snapshots cannot archive and complete snapshots respect scope and spacing", async (t) => {
  const { db } = await fixture(t);
  saveSettings(db, { archiveMissing: true, missingThreshold: 2 });
  const make = (names, complete = false) =>
    normalizeSnapshot({
      schemaVersion: 1,
      scope: "spa:moree",
      fetchedAt: now(),
      complete,
      expectedCount: names.length,
      animals: names.map((sourceId) => ({
        sourceId,
        name: "Nala",
        species: "dog",
      })),
    });
  applySnapshot(db, make(["1", "2"]));
  applySnapshot(db, make(["1"]));
  assert.equal(
    db.prepare("SELECT missing_count FROM animals WHERE source_id=?").get("2")
      .missing_count,
    0,
  );
  const manual = id();
  db.prepare(
    "INSERT INTO animals(id,name,species,source_id,source_scope,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
  ).run(manual, "Nala", "dog", "legacy:folder", "legacy", now(), now());
  applySnapshot(db, make(["1"], true));
  assert.equal(
    db.prepare("SELECT missing_count FROM animals WHERE source_id=?").get("2")
      .missing_count,
    1,
  );
  applySnapshot(db, make(["1"], true));
  assert.equal(
    db.prepare("SELECT missing_count FROM animals WHERE source_id=?").get("2")
      .missing_count,
    1,
  );
  assert.equal(
    db.prepare("SELECT missing_count FROM animals WHERE id=?").get(manual)
      .missing_count,
    0,
  );
  assert.equal(
    db.prepare("SELECT archived_at FROM animals WHERE source_id=?").get("2")
      .archived_at,
    null,
  );
});
test("backup restores a coherent DB and original hashes into a new directory", async (t) => {
  const { app, db, c, base } = await fixture(t);
  const headers = await login(app);
  const one = await animal(app, headers);
  const p = await ingest(
    db,
    c,
    one,
    Readable.from(await jpeg()),
    "original.jpg",
  );
  const result = await createBackup(db, c);
  const dest = path.join(base, "restored");
  const restoration = await restoreBackup(
    path.join(c.backupDir, result.filename),
    dest,
  );
  assert.ok(restoration.files >= 2);
  const restored = new DatabaseSync(path.join(dest, "data", "anipic.sqlite"));
  assert.equal(restored.prepare("SELECT id FROM animals").get().id, one);
  assert.equal(restored.prepare("SELECT id FROM photos").get().id, p.id);
  assert.equal(restored.prepare("SELECT COUNT(*) n FROM sessions").get().n, 0);
  const hash = restored.prepare("SELECT hash FROM blobs").get().hash;
  restored.close();
  await fs.access(path.join(dest, "media", hash));
  await assert.rejects(
    () => restoreBackup(path.join(c.backupDir, result.filename), dest),
    /nouvelle/,
  );
});
test("restore rejects modified files and unexpected archive entries", async (t) => {
  const { base } = await fixture(t);
  const staging = path.join(base, "forged");
  await fs.mkdir(staging);
  await fs.writeFile(path.join(staging, "anipic.sqlite"), "bad");
  await fs.writeFile(
    path.join(staging, "manifest.json"),
    JSON.stringify({
      schemaVersion: 1,
      files: [{ path: "anipic.sqlite", size: 3, sha256: "wrong" }],
    }),
  );
  const archive = path.join(base, "forged.tar.gz");
  await tar.c({ file: archive, cwd: staging, gzip: true }, [
    "manifest.json",
    "anipic.sqlite",
  ]);
  await assert.rejects(
    () => restoreBackup(archive, path.join(base, "destination")),
    /SHA-256/,
  );
  await fs.writeFile(path.join(staging, "unexpected.txt"), "not allowed");
  const unsafe = path.join(base, "unsafe.tar.gz");
  await tar.c({ file: unsafe, cwd: staging, gzip: true }, ["unexpected.txt"]);
  await assert.rejects(
    () => restoreBackup(unsafe, path.join(base, "destination2")),
    /non sûre/,
  );
});
test("search escaping, collection references and favorite ownership", async (t) => {
  const { app, db, c } = await fixture(t);
  const admin = await login(app);
  const one = await animal(app, admin, "Nala %");
  const p = await ingest(db, c, one, Readable.from(await jpeg()), "one.jpg");
  const result = await app.inject({
    url: "/api/animals?q=" + encodeURIComponent("%"),
  });
  assert.equal(result.statusCode, 200, result.body);
  assert.equal(result.json().total, 1);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/collections",
        headers: admin,
        payload: { name: "Campaign", photoIds: [p.id] },
      })
    ).statusCode,
    201,
  );
  assert.equal(
    (await app.inject({ url: "/api/collections", headers: admin })).json()[0]
      .photos.length,
    1,
  );
  await app.inject({
    method: "POST",
    url: "/api/animals/" + one + "/favorite",
    headers: admin,
    payload: { favorite: true },
  });
  const viewer = await login(app, "viewer", "reader");
  assert.equal(
    (
      await app.inject({ url: "/api/animals?favorites=1", headers: viewer })
    ).json().total,
    0,
  );
  assert.equal(
    (
      await app.inject({ url: "/api/animals?favorites=1", headers: admin })
    ).json().total,
    1,
  );
});
test("SPA collector keys by ID, validates refuge and stops on robots denial", async () => {
  let requests = 0;
  const result = await collectSpa({
    attempts: 1,
    checkRobots: async () => {},
    delay: async () => {},
    fetchText: async (url) => {
      requests++;
      const species = new URL(url).searchParams.get("species");
      return JSON.stringify({
        max_num_pages: 1,
        animals: [
          {
            ID: species === "chien" ? 42 : species === "chat" ? 43 : 44,
            name: "Nala",
            establishment_slug: "refuge-spa-de-moree-jean-leriche",
            link: "https://www.la-spa.fr/animal/nala/",
          },
        ],
      });
    },
  });
  assert.equal(requests, 3);
  assert.equal(result.animals.length, 3);
  assert.deepEqual(
    result.animals.map((a) => a.sourceId),
    ["spa:42", "spa:43", "spa:44"],
  );
  assert.equal(result.complete, false);
  await assert.rejects(
    () =>
      collectSpa({
        checkRobots: async () => {
          throw new Error("robots denial");
        },
        fetchText: async () => {
          throw new Error("must not fetch");
        },
      }),
    /robots denial/,
  );
  await assert.rejects(
    () =>
      collectSpa({
        checkRobots: async () => {},
        fetchText: async () =>
          JSON.stringify({
            max_num_pages: 1,
            animals: [
              { ID: 42, name: "Nala", establishment_slug: "another-refuge" },
            ],
          }),
      }),
    /confirme/,
  );
});

test("account updates revoke sessions and preserve an active administrator", async (t) => {
  const { app, db } = await fixture(t);
  const admin = await login(app);
  const editor = await login(app, "editor", "photographer");
  const editorId = db
    .prepare("SELECT id FROM users WHERE name='photographer'")
    .get().id;
  const adminId = db
    .prepare("SELECT id FROM users WHERE name='admin'")
    .get().id;
  const update = (userId, payload) =>
    app.inject({
      method: "PATCH",
      url: `/api/admin/users/${userId}`,
      headers: admin,
      payload,
    });
  assert.equal((await update(adminId, { role: "viewer" })).statusCode, 400);
  assert.equal((await update(adminId, { active: false })).statusCode, 400);
  assert.equal((await update(editorId, { role: "viewer" })).statusCode, 200);
  assert.equal(
    (await app.inject({ url: "/api/session", headers: editor })).json().user,
    null,
  );
  const viewerLogin = await app.inject({
    method: "POST",
    url: "/api/login",
    payload: { name: "photographer", password: "a secure test password 123" },
  });
  assert.equal(viewerLogin.statusCode, 200);
  assert.equal(viewerLogin.json().user.role, "viewer");
  assert.equal((await update(editorId, { active: false })).statusCode, 200);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/login",
        payload: {
          name: "photographer",
          password: "a secure test password 123",
        },
      })
    ).statusCode,
    401,
  );
  assert.equal(
    (await app.inject({ url: "/api/admin/users", headers: admin })).statusCode,
    200,
  );
});

test("photo batches are atomic and preserve confidentiality", async (t) => {
  const { app, db, c } = await fixture(t);
  const admin = await login(app);
  const animalId = await animal(app, admin);
  const photo = await ingest(
    db,
    c,
    animalId,
    Readable.from(await jpeg()),
    "portrait.jpg",
  );
  const batch = (photoIds, operation) =>
    app.inject({
      method: "POST",
      url: "/api/photos/batch",
      headers: admin,
      payload: { photoIds, operation },
    });
  assert.equal((await batch([photo.id, id()], "hide")).statusCode, 404);
  assert.equal(
    db.prepare("SELECT hidden FROM photos WHERE id=?").get(photo.id).hidden,
    0,
  );
  assert.equal((await batch([photo.id], "hide")).statusCode, 200);
  assert.equal(
    (await app.inject({ url: `/media/${photo.id}?w=320` })).statusCode,
    404,
  );
  assert.equal((await batch([photo.id], "publish")).statusCode, 200);
  assert.equal(
    (await app.inject({ url: `/media/${photo.id}?w=320` })).statusCode,
    200,
  );
  assert.equal((await batch([photo.id], "archive")).statusCode, 200);
  assert.ok(
    db.prepare("SELECT archived_at FROM photos WHERE id=?").get(photo.id)
      .archived_at,
  );
  assert.equal((await batch([photo.id], "restore")).statusCode, 200);
  assert.equal(
    db.prepare("SELECT archived_at FROM photos WHERE id=?").get(photo.id)
      .archived_at,
    null,
  );
});

test("URL identities upgrade to SPA IDs without changing albums", async (t) => {
  const { db } = await fixture(t);
  const sourceUrl = "https://www.la-spa.fr/animal/nala-42/";
  applySnapshot(
    db,
    normalizeSnapshot({ dog_list: { Nala: { name: "Nala", url: sourceUrl } } }),
  );
  const before = db.prepare("SELECT id,source_id FROM animals").get();
  assert.ok(before.source_id.startsWith("spa-url:"));
  const upgraded = applySnapshot(
    db,
    normalizeSnapshot({
      dog_list: { Nala: { id: 42, name: "Nala renommée", url: sourceUrl } },
    }),
  );
  assert.equal(upgraded.updated, 1);
  assert.equal(upgraded.created, 0);
  const after = db.prepare("SELECT id,name,source_id FROM animals").get();
  assert.equal(after.id, before.id);
  assert.equal(after.source_id, "spa:42");
  assert.equal(after.name, "Nala renommée");
});

test("missing NAS markers prevent startup, writes and backups", async (t) => {
  const { app, db, c } = await fixture(t);
  const admin = await login(app);
  const animalId = await animal(app, admin);
  c.requireMarker = true;
  assert.equal((await app.inject({ url: "/api/health" })).statusCode, 503);
  await assert.rejects(
    () =>
      ingest(db, c, animalId, Readable.from(Buffer.from("x")), "portrait.jpg"),
    /marqueur/,
  );
  await assert.rejects(() => createBackup(db, c), /marqueur/);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos").get().n, 0);
  await assert.rejects(() => createApp({ ...c, scheduler: false }), /marqueur/);
  for (const directory of [c.mediaDir, c.backupDir])
    await fs.writeFile(path.join(directory, ".anipic-volume"), "");
  assert.equal((await app.inject({ url: "/api/health" })).statusCode, 200);
});

test("visitor favorites filter before pagination and validate identifiers", async (t) => {
  const { app, db } = await fixture(t);
  const ids = [];
  for (let i = 0; i < 70; i++) {
    const animalId = id();
    ids.push(animalId);
    db.prepare(
      "INSERT INTO animals(id,name,species,created_at,updated_at) VALUES (?,?,?,?,?)",
    ).run(
      animalId,
      `Animal ${String(i).padStart(2, "0")}`,
      "dog",
      now(),
      now(),
    );
  }
  const response = await app.inject({
    url: `/api/animals?ids=${ids[68]},${ids[69]}&limit=1&page=2&sort=name`,
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().total, 2);
  assert.equal(response.json().pages, 2);
  assert.equal(response.json().items[0].id, ids[69]);
  assert.equal(
    (await app.inject({ url: "/api/animals?ids=" })).json().total,
    0,
  );
  assert.equal(
    (await app.inject({ url: "/api/animals?ids=invalid" })).statusCode,
    400,
  );
});
