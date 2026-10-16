import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import sharp from "sharp";
import { fixture, login, animal } from "./helpers.mjs";
import { id, now, openDb } from "../server/db.mjs";
import { ingest } from "../server/storage.mjs";
import { normalizeSnapshot, applySnapshot } from "../server/source.mjs";
import { Film, resolveFilm } from "../server/video.mjs";
import { filmDuration } from "../video/timing.mjs";
const image = () =>
  sharp({
    create: { width: 600, height: 800, channels: 3, background: "#467455" },
  })
    .jpeg()
    .toBuffer();
test("v6 role migration preserves sessions and task account references", async (t) => {
  const { app, db, c } = await fixture(t);
  const { headers, user } = await login(app, "editor");
  const a = animal(db);
  db.prepare("INSERT INTO shoot_tasks VALUES (?,?,?,?,?,?,?,?,?,?)").run(
    id(),
    a,
    "Portrait",
    "notes",
    "normal",
    "todo",
    user.id,
    user.id,
    now(),
    now(),
  );
  db.exec("DROP TABLE animal_status_events; PRAGMA user_version=5;");
  const upgraded = openDb(c);
  assert.equal(upgraded.prepare("PRAGMA user_version").get().user_version, 14);
  assert.deepEqual(upgraded.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(upgraded.prepare("SELECT COUNT(*) n FROM sessions").get().n, 1);
  assert.equal(
    upgraded.prepare("SELECT assigned_to FROM shoot_tasks").get().assigned_to,
    user.id,
  );
  upgraded.close();
  const reopened = openDb(c);
  assert.equal(reopened.prepare("PRAGMA user_version").get().user_version, 14);
  reopened.close();
  assert.equal(
    (await app.inject({ url: "/api/session", headers })).json().user.role,
    "editor",
  );
  await login(app, "agent");
});
test("agents can plan and create albums without admin access or animal-fact editing", async (t) => {
  const { app, db } = await fixture(t);
  const { headers } = await login(app, "agent");
  const a = animal(db);
  const task = await app.inject({
    method: "POST",
    url: "/api/tasks",
    headers,
    payload: { animalId: a, title: "Priorité photo" },
  });
  assert.equal(task.statusCode, 201, task.body);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/collections",
        headers,
        payload: { name: "Agents" },
      })
    ).statusCode,
    201,
  );
  assert.equal(
    (await app.inject({ url: "/api/admin/connections", headers })).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "PATCH",
        url: "/api/animals/" + a,
        headers,
        payload: { name: "Autre" },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (await app.inject({ url: "/api/stats", headers })).statusCode,
    200,
  );
});
test("statistics only count observed SPA adoption statuses and never infer them from archives", async (t) => {
  const { app, db } = await fixture(t);
  const { headers } = await login(app);
  const a = animal(db, "Archived"),
    b = animal(db, "Missing");
  db.prepare(
    "UPDATE animals SET archived_at=?,status='source_missing' WHERE id IN (?,?)",
  ).run(now(), a, b);
  const snapshot = (status) =>
    normalizeSnapshot({
      schemaVersion: 1,
      animals: [
        { sourceId: "spa:confirmed", name: "Confirmé", species: "cat", status },
      ],
      scope: "test",
      complete: false,
    });
  applySnapshot(db, snapshot("available"));
  applySnapshot(db, snapshot("adopted"));
  applySnapshot(db, snapshot("adopted"));
  const r = await app.inject({
    url: "/api/stats?year=" + new Date().getFullYear(),
    headers,
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().annual.adopted, 1);
  assert.equal(r.json().current.unconfirmed, 2);
  assert.equal(r.json().species.find((s) => s.species === "cat").adopted, 1);
  assert.equal((await app.inject({ url: "/api/stats" })).statusCode, 401);
});
test("year filters respect active-photo visibility and archive date; additional sorts are validated", async (t) => {
  const { app, db, c } = await fixture(t);
  const { headers } = await login(app);
  const a = animal(db, "Old"),
    b = animal(db, "Private");
  const p = await ingest(db, c, a, Readable.from(await image()), "old.jpg"),
    q = await ingest(
      db,
      c,
      b,
      Readable.from(await image()),
      "private.jpg",
      true,
    );
  db.prepare("UPDATE photos SET created_at=? WHERE id IN (?,?)").run(
    "2020-06-10T12:00:00Z",
    p.id,
    q.id,
  );
  assert.equal(
    (await app.inject({ url: "/api/animals?year=2020" })).json().total,
    1,
  );
  assert.equal(
    (await app.inject({ url: "/api/animals?year=2020", headers })).json().total,
    2,
  );
  db.prepare("UPDATE animals SET archived_at=? WHERE id=?").run(
    "2022-01-01T12:00:00Z",
    a,
  );
  assert.equal(
    (
      await app.inject({ url: "/api/animals?archive=1&year=2022&sort=archive" })
    ).json().items[0].id,
    a,
  );
  for (const sort of ["name_desc", "oldest", "arrival", "few_photos"])
    assert.equal(
      (await app.inject({ url: "/api/animals?sort=" + sort })).statusCode,
      200,
    );
  assert.equal(
    (await app.inject({ url: "/api/animals?sort=arbitrary-sql" })).statusCode,
    400,
  );
});
test("interface defaults are public but connection configuration and credential presence are admin-only", async (t) => {
  const { app } = await fixture(t);
  const { headers } = await login(app);
  const cfg = (
    await app.inject({ url: "/api/admin/settings", headers })
  ).json();
  const r = await app.inject({
    method: "PUT",
    url: "/api/admin/settings",
    headers,
    payload: {
      ...cfg,
      tiltIntensity: 0,
      reflectionIntensity: 0,
      showWeather: false,
      geminiModel: "configured-model",
      tokenharborModel: "provider/model",
    },
  });
  assert.equal(r.statusCode, 200, r.body);
  const overview = (await app.inject({ url: "/api/overview" })).json();
  assert.equal(overview.interface.tiltIntensity, 0);
  assert.equal(overview.interface.showWeather, false);
  assert.equal(overview.interface.geminiModel, undefined);
  const admin = (
    await app.inject({ url: "/api/admin/connections", headers })
  ).json();
  assert.equal(admin.gemini.model, "configured-model");
  assert.equal(admin.gemini.key, undefined);
  assert.equal(admin.tokenharbor.model, "provider/model");
  assert.equal(
    (await app.inject({ url: "/api/admin/connections" })).statusCode,
    401,
  );
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: "/api/admin/settings",
        headers,
        payload: { ...cfg, tiltIntensity: 101 },
      })
    ).statusCode,
    400,
  );
});
test("configurable publication exports use exact dimensions and reject foreign photos and unsafe colors", async (t) => {
  const { app, db, c } = await fixture(t);
  const { headers } = await login(app);
  const a = animal(db, "Maya < & long name"),
    b = animal(db, "Other");
  const p = await ingest(
    db,
    c,
    a,
    Readable.from(await image()),
    "portrait.jpg",
  );
  const q = await ingest(db, c, b, Readable.from(await image()), "other.jpg");
  for (const [format, height] of [
    ["portrait", 1350],
    ["square", 1080],
    ["story", 1920],
  ]) {
    const r = await app.inject({
      url: `/api/animals/${a}/presentation?photoId=${p.id}&format=${format}&style=minimal&accent=%23ff9933&cta=Bonjour%20%26%20bienvenue&inline=1`,
      headers,
    });
    assert.equal(r.statusCode, 200, r.body.slice(0, 100));
    const m = await sharp(r.rawPayload).metadata();
    assert.equal(m.width, 1080);
    assert.equal(m.height, height);
    assert.match(r.headers["content-disposition"], /^inline/);
  }
  const preview = await app.inject({
    url: `/api/animals/${a}/presentation?photoId=${p.id}&preview=1&inline=1`,
    headers,
  });
  assert.equal(preview.statusCode, 200, preview.body.slice(0, 100));
  const previewMeta = await sharp(preview.rawPayload).metadata();
  assert.equal(previewMeta.width, 540);
  assert.equal(previewMeta.height, 675);
  assert.equal(
    (
      await app.inject({
        url: `/api/animals/${a}/presentation?photoId=${q.id}`,
        headers,
      })
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await app.inject({
        url: `/api/animals/${a}/presentation?accent=unsafe`,
        headers,
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (await app.inject({ url: `/api/animals/${a}/presentation` })).statusCode,
    401,
  );
});
test("story presets and optional intro/outro resolve immutable SPA facts with bounded focal points", async (t) => {
  const { db, c } = await fixture(t);
  const a = animal(db, "SPA Name");
  const p = await ingest(db, c, a, Readable.from(await image()), "a.jpg");
  const film = {
    title: "Story",
    look: "story",
    aspect: "portrait",
    introSeconds: 0,
    outroSeconds: 0,
    showLogo: false,
    brandLabel: "Refuge",
    clips: [
      {
        kind: "photo",
        ref: p.id,
        seconds: 3,
        title: "Cannot overwrite SPA name",
        focusX: 30,
        focusY: 70,
      },
    ],
  };
  const parsed = Film.parse(film);
  assert.equal(filmDuration(parsed), 72);
  const resolved = resolveFilm(db, c, film, () => "/media/private");
  assert.equal(resolved.clips[0].title, "SPA Name");
  assert.equal(resolved.clips[0].focusX, 30);
  assert.equal(resolved.brandLabel, "Refuge");
  assert.throws(() =>
    Film.parse({ ...film, clips: [{ ...film.clips[0], focusY: 101 }] }),
  );
});
