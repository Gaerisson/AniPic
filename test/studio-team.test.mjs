import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import sharp from "sharp";
import { fixture, login, animal, wav } from "./helpers.mjs";
import { id, now } from "../server/db.mjs";
import { ingest } from "../server/storage.mjs";
import { Film, resolveFilm } from "../server/video.mjs";
import { parseMusicPages } from "../server/music-catalog.mjs";
const image = () =>
  sharp({
    create: { width: 100, height: 120, channels: 3, background: "#db8758" },
  })
    .jpeg()
    .toBuffer();

test("team messages are admin-only to send, target the correct account/role, expire and have separate read receipts", async (t) => {
  const { app, db } = await fixture(t),
    admin = await login(app),
    agent = await login(app, "agent"),
    other = await login(app, "agent", "agent2"),
    viewer = await login(app, "viewer");
  const payload = {
    title: "Prochaine séance",
    body: "Un portrait de SILVER cette semaine.",
    targetUser: agent.user.id,
    days: 2,
  };
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/admin/messages",
        headers: agent.headers,
        payload,
      })
    ).statusCode,
    403,
  );
  assert.equal((await app.inject({ url: "/api/messages" })).statusCode, 401);
  const saved = await app.inject({
    method: "POST",
    url: "/api/admin/messages",
    headers: admin.headers,
    payload,
  });
  assert.equal(saved.statusCode, 201, saved.body);
  const key = saved.json().id;
  assert.equal(
    (await app.inject({ url: "/api/messages", headers: agent.headers })).json()
      .length,
    1,
  );
  for (const user of [other, viewer, admin])
    assert.equal(
      (await app.inject({ url: "/api/messages", headers: user.headers })).json()
        .length,
      0,
    );
  await app.inject({
    method: "POST",
    url: `/api/messages/${key}/read`,
    headers: other.headers,
  });
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM message_receipts").get().n,
    0,
  );
  await app.inject({
    method: "POST",
    url: `/api/messages/${key}/read`,
    headers: agent.headers,
  });
  assert.ok(
    (
      await app.inject({ url: "/api/messages", headers: agent.headers })
    ).json()[0].read_at,
  );
  await app.inject({
    method: "POST",
    url: "/api/admin/messages",
    headers: admin.headers,
    payload: {
      ...payload,
      title: "Aux agents",
      targetUser: null,
      targetRole: "agent",
    },
  });
  assert.equal(
    (await app.inject({ url: "/api/messages", headers: other.headers })).json()
      .length,
    1,
  );
  db.prepare("UPDATE team_messages SET expires_at='2000-01-01' WHERE id=?").run(
    key,
  );
  assert.equal(
    (await app.inject({ url: "/api/messages", headers: agent.headers })).json()
      .length,
    1,
  );
});

test("studio projects and exports move to a restorable trash, stop downloads and preserve source photos", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    viewer = await login(app, "viewer"),
    a = animal(db),
    photo = await ingest(
      db,
      c,
      a,
      Readable.from(await image()),
      "portrait.jpg",
    );
  const config = {
    title: "Bilan test",
    clips: [{ kind: "photo", ref: photo.id, seconds: 3 }],
  };
  const saved = await app.inject({
    method: "POST",
    url: "/api/video/projects",
    headers: admin.headers,
    payload: config,
  });
  assert.equal(saved.statusCode, 201, saved.body);
  const key = saved.json().id,
    render = id(),
    photoHash = db
      .prepare("SELECT hash FROM photos WHERE id=?")
      .get(photo.id).hash;
  db.prepare(
    "INSERT INTO video_renders(id,project_id,state,hash,created_at) VALUES (?,?, 'done',?,?)",
  ).run(render, key, photoHash, now());
  assert.equal(
    (
      await app.inject({
        method: "DELETE",
        url: `/api/video/projects/${key}`,
        headers: viewer.headers,
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "DELETE",
        url: `/api/video/projects/${key}`,
        headers: admin.headers,
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await app.inject({
        url: `/api/video/projects/${key}`,
        headers: admin.headers,
      })
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await app.inject({
        url: `/api/video/renders/${render}/download`,
        headers: admin.headers,
      })
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await app.inject({ url: "/api/video/renders", headers: admin.headers })
    ).json().length,
    0,
  );
  assert.equal(
    (
      await app.inject({ url: "/api/video/trash", headers: admin.headers })
    ).json().projects.length,
    1,
  );
  await app.inject({
    method: "POST",
    url: `/api/video/projects/${key}/restore`,
    headers: admin.headers,
  });
  assert.equal(
    (
      await app.inject({ url: "/api/video/renders", headers: admin.headers })
    ).json().length,
    1,
  );
  await app.inject({
    method: "DELETE",
    url: `/api/video/renders/${render}`,
    headers: admin.headers,
  });
  assert.equal(
    (
      await app.inject({
        url: `/api/video/renders/${render}/download`,
        headers: admin.headers,
      })
    ).statusCode,
    404,
  );
  await app.inject({
    method: "POST",
    url: `/api/video/renders/${render}/restore`,
    headers: admin.headers,
  });
  assert.equal(
    (
      await app.inject({
        url: `/api/video/renders/${render}/download`,
        headers: admin.headers,
      })
    ).statusCode,
    200,
  );
  db.prepare("UPDATE video_renders SET state='running' WHERE id=?").run(render);
  assert.equal(
    (
      await app.inject({
        method: "DELETE",
        url: `/api/video/projects/${key}`,
        headers: admin.headers,
      })
    ).statusCode,
    409,
  );
  assert.equal(
    db.prepare("SELECT hash FROM photos WHERE id=?").get(photo.id).hash,
    photoHash,
  );
});

test("annual selection includes observed adoptions, deduplicates portraits and derives statistics rather than trusting client counts", async (t) => {
  const { app, db, c } = await fixture(t),
    { headers } = await login(app),
    a = animal(db, "Nala"),
    b = animal(db, "Maya"),
    p = await ingest(db, c, a, Readable.from(await image()), "nala.jpg");
  db.prepare(
    "UPDATE animals SET archived_at='2026-10-16',departed_at='2026-10-16',status='adopted' WHERE id=?",
  ).run(a);
  db.prepare("INSERT INTO animal_status_events VALUES (?,?,?,?)").run(
    id(),
    a,
    "adopted",
    "2026-10-15T10:00:00Z",
  );
  db.prepare("INSERT INTO animal_status_events VALUES (?,?,?,?)").run(
    id(),
    b,
    "adopted",
    null,
  );
  const data = (
    await app.inject({ url: "/api/video/year/2026", headers })
  ).json();
  assert.equal(data.adopted, 1);
  assert.equal(data.animals.length, 1);
  const film = resolveFilm(
    db,
    c,
    {
      title: "Bilan",
      template: "year",
      annualStyle: "mosaic",
      year: 2026,
      yearStats: { adopted: 900 },
      clips: [
        { kind: "photo", ref: p.id, seconds: 3 },
        { kind: "photo", ref: p.id, seconds: 3 },
      ],
    },
    () => "/photo.jpg",
  );
  assert.equal(film.yearStats.adopted, 1);
  assert.equal(film.yearStats.portraits, 1);
  assert.equal(film.yearStats.dogs, 1);
  const videoInput = {
    title: "Ancien bilan",
    template: "year",
    clips: [{ kind: "video", ref: id(), seconds: 3 }],
  };
  assert.equal(Film.parse(videoInput).annualStyle, "slideshow");
  assert.equal(
    Film.safeParse({ ...videoInput, annualStyle: "mosaic" }).success,
    false,
  );
  db.prepare("UPDATE animals SET source_metadata=? WHERE id=?").run(
    JSON.stringify({
      thumbnail: "https://www.la-spa.fr/app/app/uploads/animals/42/test.jpg",
      privateEmail: "secret@example.test",
    }),
    b,
  );
  const sheet = (await app.inject({ url: "/api/shoot-sheet", headers }))
    .json()
    .items.find((x) => x.id === b);
  assert.ok(sheet.source_metadata.thumbnail);
  assert.equal(sheet.source_metadata.privateEmail, undefined);
});

test("music search/import only accepts supported public catalogue files and retains attribution", async (t) => {
  const page = {
    pageid: 42,
    title: "File:Piano.mp3",
    imageinfo: [
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/a/a1/Piano.mp3",
        mime: "audio/mpeg",
        size: 1000,
        extmetadata: {
          LicenseShortName: { value: "CC BY 4.0" },
          Artist: { value: "<b>Compositeur</b>" },
        },
      },
    ],
  };
  assert.equal(parseMusicPages({ 42: page })[0].author, "Compositeur");
  assert.deepEqual(parseMusicPages(null), []);
  assert.deepEqual(parseMusicPages({ 42: { ...page, title: null } }), []);
  assert.deepEqual(
    parseMusicPages({
      42: { ...page, imageinfo: [{ ...page.imageinfo[0], size: null }] },
    }),
    [],
  );
  assert.deepEqual(
    parseMusicPages({
      42: {
        ...page,
        imageinfo: [
          { ...page.imageinfo[0], url: "https://private.example/file.mp3" },
        ],
      },
    }),
    [],
  );
  assert.deepEqual(
    parseMusicPages({
      42: {
        ...page,
        imageinfo: [
          {
            ...page.imageinfo[0],
            extmetadata: { LicenseShortName: { value: "All rights reserved" } },
          },
        ],
      },
    }),
    [],
  );
  const { app, db } = await fixture(t, {
      musicFetcher: async (url, limit, options) =>
        options?.binary
          ? wav(2)
          : JSON.stringify({ query: { pages: { 42: page } } }),
    }),
    admin = await login(app),
    viewer = await login(app, "viewer");
  const result = await app.inject({
    url: "/api/video/music/search?q=piano",
    headers: viewer.headers,
  });
  assert.equal(result.statusCode, 200, result.body);
  assert.equal(result.json().tracks.length, 1);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/video/music/import",
        headers: viewer.headers,
        payload: { pageId: 42 },
      })
    ).statusCode,
    403,
  );
  const imported = await app.inject({
    method: "POST",
    url: "/api/video/music/import",
    headers: admin.headers,
    payload: { pageId: 42 },
  });
  assert.equal(imported.statusCode, 201, imported.body);
  assert.equal(
    db
      .prepare("SELECT license FROM music_credits WHERE asset_id=?")
      .get(imported.json().id).license,
    "CC BY 4.0",
  );
  const project = id();
  db.prepare(
    "INSERT INTO video_projects(id,title,config,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?)",
  ).run(
    project,
    "Crédits",
    JSON.stringify({ music: { assetId: imported.json().id } }),
    admin.user.id,
    now(),
    now(),
  );
  const credits = await app.inject({
    url: `/api/video/projects/${project}/credits`,
    headers: admin.headers,
  });
  assert.equal(credits.statusCode, 200);
  assert.match(credits.body, /Compositeur/);
  assert.match(
    credits.body,
    /https:\/\/creativecommons.org\/licenses\/by\/4.0\//,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/video/music/import",
        headers: admin.headers,
        payload: { pageId: 99 },
      })
    ).statusCode,
    409,
  );
});
