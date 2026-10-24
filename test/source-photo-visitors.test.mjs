import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { fixture, animal, login, audienceConsent } from "./helpers.mjs";
import { id, saveSettings } from "../server/db.mjs";
import { legalConfig } from "../server/privacy.mjs";

test("a transient SPA photo failure returns uncached JSON and a retry can load the image", async (t) => {
  let fail = true,
    calls = 0;
  const image = await sharp({
    create: { width: 180, height: 240, channels: 3, background: "orange" },
  })
    .jpeg()
    .toBuffer();
  const { app, db } = await fixture(t, {
    spaPhotoFetcher: async () => {
      calls++;
      if (fail) throw new Error("Upstream timeout");
      return image;
    },
  });
  const a = animal(db);
  db.prepare("UPDATE animals SET source_metadata=? WHERE id=?").run(
    JSON.stringify({
      thumbnail:
        "https://www.la-spa.fr/app/app/uploads/animals/42/portrait.jpg",
    }),
    a,
  );
  const url = `/api/animals/${a}/source-photo?w=320`;
  const failed = await app.inject({ url });
  assert.equal(failed.statusCode, 503, failed.body);
  assert.match(failed.headers["content-type"], /application\/json/);
  assert.equal(failed.headers["cache-control"], "no-store");
  assert.equal(failed.headers["retry-after"], "2");
  assert.match(failed.json().error, /temporairement indisponible/);
  fail = false;
  const recovered = await app.inject({ url });
  assert.equal(recovered.statusCode, 200, recovered.body);
  assert.equal((await sharp(recovered.rawPayload).metadata()).format, "webp");
  assert.match(recovered.headers["cache-control"], /max-age=1800/);
  assert.equal((await app.inject({ url })).statusCode, 200);
  assert.equal(calls, 2);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos").get().n, 0);
});

test("logging in immediately after an anonymous visit records the account without double counting retries", async (t) => {
  const { app, db } = await fixture(t),
    admin = await login(app);
  const consented = await audienceConsent(app, admin.headers);
  const anonymous = {
    ...consented,
    cookie: consented.cookie
      .split("; ")
      .filter((c) => !c.startsWith("anipic_session="))
      .join("; "),
  };
  const payload = { session: id(), path: "#gallery" };
  for (const headers of [anonymous, consented, consented]) {
    const r = await app.inject({
      method: "POST",
      url: "/api/visit",
      headers,
      payload,
    });
    assert.equal(r.statusCode, 200, r.body);
  }
  const data = (
    await app.inject({ url: "/api/admin/visitors", headers: admin.headers })
  ).json();
  assert.equal(data.summary.pageviews, 2);
  assert.equal(data.summary.sessions, 1);
  assert.equal(data.summary.accounts, 1);
  assert.equal(data.rows.filter((r) => r.account === "admin").length, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM visits").get().n, 2);
});

test("the visitor dashboard explains consent, disabled collection and GPC without changing them", async (t) => {
  const { app, db } = await fixture(t),
    admin = await login(app);
  const dashboard = async (headers) => {
    const r = await app.inject({ url: "/api/admin/visitors", headers });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.headers["cache-control"], "no-store");
    return r.json();
  };
  assert.deepEqual((await dashboard(admin.headers)).collection, {
    enabled: false,
    consent: "undecided",
    globalPrivacyControl: false,
  });
  const consented = await audienceConsent(app, admin.headers);
  assert.deepEqual((await dashboard(consented)).collection, {
    enabled: true,
    consent: "accepted",
    globalPrivacyControl: false,
  });
  assert.equal(
    (await dashboard({ ...consented, "sec-gpc": "1" })).collection
      .globalPrivacyControl,
    true,
  );
  assert.equal(
    (await dashboard(admin.headers)).collection.consent,
    "undecided",
  );
  saveSettings(db, { legal: { ...legalConfig(db), visitorRetentionDays: 7 } });
  assert.equal((await dashboard(consented)).retentionDays, 7);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM visits").get().n, 0);
});
