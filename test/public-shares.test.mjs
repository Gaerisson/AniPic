import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import sharp from "sharp";
import * as cheerio from "cheerio";
import { fixture, login, animal } from "./helpers.mjs";
import { ingest } from "../server/storage.mjs";
import { hashToken } from "../server/auth.mjs";
import { id, saveSettings } from "../server/db.mjs";
import { createApp } from "../server/app.mjs";

const create = async (app, headers, kind, targetId) => {
  const r = await app.inject({
    method: "POST",
    url: "/api/shares",
    headers,
    payload: { kind, targetId },
  });
  assert.equal(r.statusCode, 200, r.body);
  return { ...r.json(), path: new URL(r.json().url).pathname };
};
async function image(db, c, a, hidden = false, caption = "Portrait public") {
  const data = await sharp({
    create: { width: 2200, height: 1500, channels: 3, background: "#bd7841" },
  })
    .withExif({
      IFD0: { Artist: "Photographe confidentiel", ImageDescription: id() },
    })
    .jpeg()
    .toBuffer();
  const p = await ingest(db, c, a, Readable.from(data), "original.jpg", hidden);
  db.prepare("UPDATE photos SET caption=? WHERE id=?").run(caption, p.id);
  return { ...p, original: data };
}

test("public links require a permitted account, CSRF and same origin; PIN-only and viewer browsers cannot create them", async (t) => {
  const { app, db } = await fixture(t),
    a = animal(db),
    admin = await login(app),
    viewer = await login(app, "viewer"),
    volunteer = await login(app, "volunteer");
  const payload = { kind: "animal", targetId: a };
  for (const [headers, status] of [
    [{}, 401],
    [viewer.headers, 403],
    [{ cookie: admin.headers.cookie }, 403],
    [{ ...admin.headers, origin: "https://evil.invalid" }, 403],
  ]) {
    const r = await app.inject({
      method: "POST",
      url: "/api/shares",
      headers,
      payload,
    });
    assert.equal(r.statusCode, status, r.body);
  }
  await create(app, volunteer.headers, "animal", a);
  for (const body of [
    { kind: "animal", targetId: "invalid" },
    { ...payload, token: "chosen-token" },
    { kind: "collection", targetId: a },
  ]) {
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/shares",
          headers: admin.headers,
          payload: body,
        })
      ).statusCode,
      400,
    );
  }
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/shares",
        headers: admin.headers,
        payload: { ...payload, targetId: id() },
      })
    ).statusCode,
    404,
  );
  saveSettings(db, { accessPinEnabled: true });
  db.prepare("INSERT INTO site_passes VALUES (?,?)").run(
    hashToken("share-pin-fixture"),
    "",
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/shares",
        headers: { cookie: "anipic_gate=share-pin-fixture" },
        payload,
      })
    ).statusCode,
    401,
  );
});

test("an animal link opens without PIN but discloses only its public card and photos, with escaped HTML and private cache headers", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    a = animal(db, '<img src=x onerror="alert(1)">');
  const p = await image(db, c, a),
    hidden = await image(db, c, a, true, "PRIVATE CAPTION"),
    other = animal(db, "OTHER ANIMAL"),
    otherPhoto = await image(db, c, other);
  db.prepare(
    "UPDATE animals SET description=?,source_metadata=?,source_url=? WHERE id=?",
  ).run(
    "</p><script>alert(1)</script>",
    JSON.stringify({
      thumbnail: "",
      secret: "PRIVATE METADATA",
      ageLabel: "3 ans",
    }),
    "https://evil.invalid/tracker",
    a,
  );
  const share = await create(app, admin.headers, "animal", a);
  saveSettings(db, { accessPinEnabled: true });
  const response = await app.inject({ url: share.path });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.headers["set-cookie"], undefined);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(response.headers["referrer-policy"], "no-referrer");
  assert.match(response.headers["x-robots-tag"], /noindex/);
  assert.match(
    response.headers["content-security-policy"],
    /default-src 'none'/,
  );
  const $ = cheerio.load(response.body);
  assert.equal($("script").length, 0);
  assert.equal($("h1").text(), '<img src=x onerror="alert(1)">');
  assert.equal($("figure img").length, 1);
  assert.equal($("figure img").attr("src"), `${share.path}/photo/${p.id}`);
  assert.equal(
    $("a")
      .filter((_, el) => $(el).text() === "Ouvrir la fiche dans AniPic")
      .attr("href"),
    `/#animal/${a}`,
  );
  assert.equal($("a.download").attr("download"), "portrait.jpg");
  const downloaded = await app.inject({ url: $("a.download").attr("href") });
  assert.match(downloaded.headers["content-type"], /image\/jpeg/);
  assert.match(
    downloaded.headers["content-disposition"],
    /attachment; filename="portrait.jpg"/,
  );
  const jpeg = await sharp(downloaded.rawPayload).metadata();
  assert.equal(jpeg.format, "jpeg");
  assert.equal(jpeg.exif, undefined);
  assert.equal(jpeg.width, 1280);
  for (const secret of [
    "PRIVATE METADATA",
    "PRIVATE CAPTION",
    "evil.invalid",
    hidden.id,
    otherPhoto.id,
    "OTHER ANIMAL",
  ])
    assert.ok(!response.body.includes(secret), secret);
  const media = await app.inject({
    url: `${share.path}/photo/${p.id}?original=1&full=1`,
  });
  assert.equal(media.statusCode, 200, media.body);
  const info = await sharp(media.rawPayload).metadata();
  assert.equal(info.format, "webp");
  assert.equal(info.width, 1280);
  assert.equal(info.exif, undefined);
  assert.notDeepEqual(media.rawPayload, p.original);
  for (const url of [
    `${share.path}/photo/${hidden.id}`,
    `${share.path}/photo/${otherPhoto.id}`,
    `/api/animals/${other}`,
    `/media/${p.id}?original=1`,
    `/api/animals/${a}?share=${share.path.split("/").at(-1)}`,
  ]) {
    assert.ok([401, 404].includes((await app.inject({ url })).statusCode), url);
  }
});

test("photo links cannot expose siblings, originals or SPA endpoints and stop when the photo becomes private, archived or deleted", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    a = animal(db),
    p = await image(db, c, a),
    sibling = await image(db, c, a, false, "Second photo");
  const share = await create(app, admin.headers, "photo", p.id),
    media = `${share.path}/photo/${p.id}`;
  const page = await app.inject({ url: share.path });
  const $ = cheerio.load(page.body);
  assert.equal($("figure img").length, 1);
  assert.equal(
    $("a")
      .filter((_, el) => $(el).text() === "Ouvrir la fiche dans AniPic")
      .attr("href"),
    `/#animal/${a}`,
  );
  const download = await app.inject({ url: $("a.download").attr("href") });
  assert.equal(download.statusCode, 200);
  assert.match(download.headers["content-type"], /image\/jpeg/);
  assert.equal((await sharp(download.rawPayload).metadata()).format, "jpeg");
  assert.equal(download.headers["cache-control"], "no-store");
  assert.equal(download.headers["set-cookie"], undefined);
  assert.ok(!page.body.includes(sibling.id));
  assert.equal(
    (await app.inject({ url: `${share.path}/photo/${sibling.id}` })).statusCode,
    404,
  );
  assert.equal(
    (await app.inject({ url: `${share.path}/photo/${sibling.id}?download=1` }))
      .statusCode,
    404,
  );
  assert.equal(
    (await app.inject({ url: `${share.path}/source-photo` })).statusCode,
    404,
  );
  for (const column of ["hidden", "archived_at", "deleted_at"]) {
    db.prepare(`UPDATE photos SET ${column}=? WHERE id=?`).run(
      column === "hidden" ? 1 : new Date().toISOString(),
      p.id,
    );
    assert.equal(
      (await app.inject({ url: share.path })).statusCode,
      404,
      column,
    );
    assert.equal((await app.inject({ url: media })).statusCode, 404, column);
    assert.equal(
      (await app.inject({ url: `${media}?download=1` })).statusCode,
      404,
      column,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/shares",
          headers: admin.headers,
          payload: { kind: "photo", targetId: p.id },
        })
      ).statusCode,
      404,
      column,
    );
    db.prepare(`UPDATE photos SET ${column}=? WHERE id=?`).run(
      column === "hidden" ? 0 : null,
      p.id,
    );
  }
  assert.equal((await app.inject({ url: media })).statusCode, 200);
  assert.equal(
    (
      await app.inject({
        method: "DELETE",
        url: `/api/shares/${share.id}`,
        headers: admin.headers,
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (await app.inject({ url: `${media}?download=1` })).statusCode,
    404,
  );
});

test("tokens are hashed at rest, lists and account exports omit tokens; only the creator or an admin can revoke", async (t) => {
  const { app, db } = await fixture(t),
    owner = await login(app, "volunteer", "Owner"),
    other = await login(app, "volunteer", "Other"),
    admin = await login(app),
    a = animal(db);
  const share = await create(app, owner.headers, "animal", a),
    token = share.path.split("/").at(-1);
  assert.match(token, /^[\w-]{43}$/);
  const row = db
    .prepare("SELECT * FROM public_shares WHERE id=?")
    .get(share.id);
  assert.equal(row.token_hash, hashToken(token));
  assert.ok(!JSON.stringify(row).includes(token));
  assert.ok(
    !JSON.stringify(
      db
        .prepare("SELECT detail FROM audit WHERE action='public_share_created'")
        .all(),
    ).includes(token),
  );
  const query = `/api/shares?kind=animal&targetId=${a}`;
  const listed = (
    await app.inject({ url: query, headers: owner.headers })
  ).json();
  assert.equal(listed.items[0].id, share.id);
  assert.ok(!JSON.stringify(listed).includes(token));
  assert.equal(
    (await app.inject({ url: query, headers: other.headers })).json().items
      .length,
    0,
  );
  assert.equal(
    (await app.inject({ url: query, headers: admin.headers })).json().items
      .length,
    1,
  );
  const account = (
    await app.inject({ url: "/api/account/data", headers: owner.headers })
  ).json();
  assert.equal(account.publicShares[0].id, share.id);
  assert.ok(!JSON.stringify(account.publicShares).includes(token));
  const remove = (headers) =>
    app.inject({ method: "DELETE", url: `/api/shares/${share.id}`, headers });
  assert.equal((await remove(other.headers)).statusCode, 404);
  assert.equal(
    (await remove({ cookie: owner.headers.cookie })).statusCode,
    403,
  );
  assert.equal((await remove(admin.headers)).statusCode, 200);
  const expired = await app.inject({
    url: share.path,
    headers: { "if-none-match": '"old-image"' },
  });
  assert.equal(expired.statusCode, 404);
  assert.equal(expired.headers["cache-control"], "no-store");
  assert.equal(
    (await app.inject({ url: query, headers: owner.headers })).json().items
      .length,
    0,
  );
});

test("expiration, creator removal and the animal trash block existing pages and media even when cached before", async (t) => {
  const { app, db, c } = await fixture(t),
    owner = await login(app),
    a = animal(db),
    p = await image(db, c, a);
  const share = await create(app, owner.headers, "animal", a),
    media = `${share.path}/photo/${p.id}`;
  assert.equal((await app.inject({ url: media })).statusCode, 200);
  const blocked = async () => {
    for (const url of [
      share.path,
      media,
      `${media}?download=1`,
      `${share.path}/source-photo`,
      `${share.path}/source-photo?download=1`,
    ])
      assert.equal((await app.inject({ url })).statusCode, 404, url);
  };
  db.prepare("UPDATE public_shares SET expires_at=? WHERE id=?").run(
    "2020-01-01T00:00:00.000Z",
    share.id,
  );
  await blocked();
  db.prepare("UPDATE public_shares SET expires_at=? WHERE id=?").run(
    share.expires_at,
    share.id,
  );
  db.prepare("UPDATE users SET active=0 WHERE id=?").run(owner.user.id);
  await blocked();
  db.prepare("UPDATE users SET active=1,role='viewer' WHERE id=?").run(
    owner.user.id,
  );
  await blocked();
  db.prepare("UPDATE users SET role='admin' WHERE id=?").run(owner.user.id);
  saveSettings(db, { [`animalTrash:${a}`]: { animalId: a } });
  await blocked();
  assert.equal((await app.inject({ url: "/s/invalid" })).statusCode, 404);
});

test("a shared SPA card loads its reference image without opening the regular API and handles upstream failure as uncached JSON", async (t) => {
  let fail = false;
  const source = await sharp({
    create: { width: 80, height: 100, channels: 3, background: "orange" },
  })
    .jpeg()
    .toBuffer();
  const { app, db } = await fixture(t, {
    spaPhotoFetcher: async () => {
      if (fail) throw Error("Upstream failure");
      return source;
    },
  });
  const owner = await login(app),
    a = animal(db);
  const metadata = (name) =>
    JSON.stringify({
      thumbnail: `https://www.la-spa.fr/app/app/uploads/animals/42/${name}.jpg`,
    });
  db.prepare("UPDATE animals SET source_metadata=? WHERE id=?").run(
    metadata("portrait"),
    a,
  );
  const share = await create(app, owner.headers, "animal", a);
  saveSettings(db, { accessPinEnabled: true });
  const html = await app.inject({ url: share.path });
  assert.match(html.body, new RegExp(`${share.path}/source-photo`));
  const downloaded = await app.inject({
    url: `${share.path}/source-photo?download=1`,
  });
  assert.match(downloaded.headers["content-type"], /image\/jpeg/);
  assert.equal((await sharp(downloaded.rawPayload).metadata()).format, "jpeg");
  assert.equal(
    (await app.inject({ url: `${share.path}/source-photo` })).statusCode,
    200,
  );
  assert.match(
    downloaded.headers["content-disposition"],
    /attachment; filename="portrait.jpg"/,
  );
  assert.equal(downloaded.headers["cache-control"], "no-store");
  assert.equal(downloaded.headers["set-cookie"], undefined);
  assert.equal(
    (await app.inject({ url: `/api/animals/${a}/source-photo` })).statusCode,
    401,
  );
  db.prepare("UPDATE animals SET source_metadata=? WHERE id=?").run(
    metadata("new-image"),
    a,
  );
  fail = true;
  const error = await app.inject({ url: `${share.path}/source-photo` });
  assert.equal(error.statusCode, 503, error.body);
  assert.match(error.headers["content-type"], /application\/json/);
  assert.equal(error.headers["cache-control"], "no-store");
  const failedDownload = await app.inject({
    url: `${share.path}/source-photo?download=1`,
  });
  assert.equal(failedDownload.statusCode, 503, failedDownload.body);
  assert.match(failedDownload.headers["content-type"], /application\/json/);
  assert.equal(failedDownload.headers["content-disposition"], undefined);
});

test("opening a share does not create a network login, a site pass or a device cookie", async (t) => {
  const { app, db } = await fixture(t),
    owner = await login(app),
    agent = await login(app, "agent"),
    a = animal(db);
  const share = await create(app, owner.headers, "animal", a);
  saveSettings(db, {
    accessPinEnabled: true,
    refugeNetworks: ["127.0.0.1/32"],
    refugeAgentId: agent.user.id,
  });
  const before = db.prepare("SELECT COUNT(*) n FROM sessions").get().n;
  for (const url of [share.path, "/s/invalid"]) {
    const r = await app.inject({ url });
    assert.equal(r.headers["set-cookie"], undefined);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM sessions").get().n, before);
  }
});

test("an album photo can be shared only while its entire album ancestry is public", async (t) => {
  const { app, db, c } = await fixture(t),
    owner = await login(app);
  const parent = (
    await app.inject({
      method: "POST",
      url: "/api/collections",
      headers: owner.headers,
      payload: { name: "Album parent" },
    })
  ).json().id;
  const child = (
    await app.inject({
      method: "POST",
      url: "/api/collections",
      headers: owner.headers,
      payload: { name: "Album enfant", parentId: parent },
    })
  ).json().id;
  const data = await sharp({
    create: {
      width: 160,
      height: 240,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer();
  const p = await ingest(
    db,
    c,
    null,
    Readable.from(data),
    "photo.png",
    true,
    child,
  );
  const publish = async (albumId, value) => {
    const r = await app.inject({
      method: "PATCH",
      url: `/api/collections/${albumId}`,
      headers: owner.headers,
      payload: { isPublic: value },
    });
    assert.equal(r.statusCode, 200, r.body);
  };
  await publish(child, true);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/shares",
        headers: owner.headers,
        payload: { kind: "photo", targetId: p.id },
      })
    ).statusCode,
    404,
  );
  await publish(parent, true);
  const share = await create(app, owner.headers, "photo", p.id),
    media = `${share.path}/photo/${p.id}`;
  saveSettings(db, { accessPinEnabled: true });
  const page = await app.inject({ url: share.path });
  assert.equal(page.statusCode, 200);
  const $ = cheerio.load(page.body);
  assert.equal(
    $("a")
      .filter((_, el) => $(el).text() === "Ouvrir AniPic")
      .attr("href"),
    "/#collections",
  );
  const downloaded = await app.inject({ url: $("a.download").attr("href") });
  assert.equal(downloaded.statusCode, 200);
  assert.match(downloaded.headers["content-type"], /image\/jpeg/);
  assert.equal((await sharp(downloaded.rawPayload).metadata()).format, "jpeg");
  const pixel = await sharp(downloaded.rawPayload)
    .resize(1, 1)
    .raw()
    .toBuffer();
  assert.deepEqual([...pixel], [255, 255, 255]);
  assert.equal((await app.inject({ url: media })).statusCode, 200);
  assert.equal(
    (await app.inject({ url: `/api/album-media/${p.id}` })).statusCode,
    401,
  );
  await publish(parent, false);
  for (const url of [share.path, media, `${media}?download=1`])
    assert.equal((await app.inject({ url })).statusCode, 404);
});

test("a share survives an application restart without storing a raw token", async (t) => {
  const { app, db, c } = await fixture(t),
    owner = await login(app),
    a = animal(db),
    share = await create(app, owner.headers, "animal", a);
  await app.close();
  const reopened = await createApp(c);
  try {
    assert.equal((await reopened.inject({ url: share.path })).statusCode, 200);
  } finally {
    await reopened.close();
  }
});
