import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { Readable } from "node:stream";
import sharp from "sharp";
import { fixture, login, animal } from "./helpers.mjs";
import { id, saveSettings } from "../server/db.mjs";
import { geoLocation, geoReader, localIP } from "../server/geoip.mjs";
import { seasonalTheme, messageContent } from "../shared/content-defaults.mjs";
import { showTimeline } from "../shared/signage.mjs";
import { photoDateLabel } from "../shared/photo-freshness.mjs";
import { parseShow } from "../server/signage-schema.mjs";
import { ingest } from "../server/storage.mjs";
import {
  photoFingerprint,
  fingerprintDistance,
  compareSourcePhoto,
  cachedSourceMatch,
} from "../server/source-match.mjs";
import { PDFDocument } from "pdf-lib";
import { buildDisplay } from "../server/refuge-display.mjs";
const cookies = (r) =>
  []
    .concat(r.headers["set-cookie"] || [])
    .map((x) => x.split(";")[0])
    .join("; ");
const sample = () =>
  sharp(
    Buffer.from(
      '<svg width="600" height="800" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"><stop stop-color="#a47733"/><stop offset="1" stop-color="#384d9d"/></linearGradient></defs><rect width="600" height="800" fill="url(#g)"/><ellipse cx="310" cy="370" rx="170" ry="210" fill="#d6b98f"/><circle cx="260" cy="310" r="27" fill="#252227"/><circle cx="375" cy="320" r="20" fill="#151a1e"/><path d="M250 475q70 80 140-10" fill="none" stroke="#2a2020" stroke-width="20"/></svg>',
    ),
  )
    .jpeg()
    .toBuffer();
async function portrait(db, c, a) {
  return ingest(db, c, a, Readable.from([await sample()]), "portrait.jpg");
}

test("site PIN protects data and media; credentials can bypass it and changing the PIN revokes browser passes", async (t) => {
  const { app, db } = await fixture(t),
    admin = await login(app),
    payload = { enabled: true, pin: "582104", networks: [], agentId: "" };
  let r = await app.inject({
    url: "/api/admin/site-access",
    method: "PUT",
    headers: admin.headers,
    payload,
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(
    (await app.inject({ url: "/api/session" })).json().gateRequired,
    true,
  );
  for (const url of [
    "/api/overview",
    "/api/animals",
    "/media/" + id(),
    "/api/public/display",
    "/feed.xml",
  ])
    assert.equal((await app.inject({ url })).statusCode, 401, url);
  assert.equal(
    (await app.inject({ url: "/api/overview", headers: admin.headers }))
      .statusCode,
    200,
  );
  assert.equal(
    (
      await app.inject({
        url: "/api/gate/unlock",
        method: "POST",
        payload: { pin: "000000" },
      })
    ).statusCode,
    401,
  );
  assert.equal(
    (
      await app.inject({
        url: "/api/gate/unlock",
        method: "POST",
        headers: { origin: "https://other.invalid" },
        payload: { pin: "582104" },
      })
    ).statusCode,
    403,
  );
  r = await app.inject({
    url: "/api/gate/unlock",
    method: "POST",
    payload: { pin: "582104" },
  });
  assert.equal(r.statusCode, 200, r.body);
  const headers = { cookie: cookies(r) };
  assert.equal(
    (await app.inject({ url: "/api/overview", headers })).statusCode,
    200,
  );
  assert.equal(
    (await app.inject({ url: "/api/admin/users", headers })).statusCode,
    401,
  );
  for (const url of ["/api/admin/settings", "/api/admin/settings/export"]) {
    const body = (await app.inject({ url, headers: admin.headers })).body;
    assert.equal(body.includes("accessPinHash"), false);
    assert.equal(body.includes("582104"), false);
  }
  r = await app.inject({
    url: "/api/admin/site-access",
    method: "PUT",
    headers: admin.headers,
    payload: { ...payload, pin: "697213" },
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(
    (await app.inject({ url: "/api/overview", headers })).statusCode,
    401,
  );
  assert.equal(db.prepare("SELECT COUNT(*) n FROM site_passes").get().n, 0);
});
test("refuge IP signs into an agent only, binds that session to its network and permits manual account switching", async (t) => {
  const { app } = await fixture(t),
    admin = await login(app),
    agent = await login(app, "agent", "Refuge"),
    payload = {
      enabled: false,
      pin: "",
      networks: ["203.0.113.20"],
      agentId: agent.user.id,
    };
  assert.equal(
    (
      await app.inject({
        url: "/api/admin/site-access",
        method: "PUT",
        headers: admin.headers,
        payload: { ...payload, agentId: admin.user.id },
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await app.inject({
        url: "/api/admin/site-access",
        method: "PUT",
        headers: admin.headers,
        payload,
      })
    ).statusCode,
    200,
  );
  let r = await app.inject({
    url: "/api/session",
    remoteAddress: "203.0.113.20",
  });
  assert.equal(r.json().user.role, "agent");
  const cookie = cookies(r);
  assert.equal(
    (
      await app.inject({
        url: "/api/session",
        headers: { cookie },
        remoteAddress: "203.0.113.21",
      })
    ).json().user,
    null,
  );
  assert.equal(
    (
      await app.inject({
        url: "/api/session",
        headers: { "x-forwarded-for": "203.0.113.20" },
        remoteAddress: "203.0.113.21",
      })
    ).json().user,
    null,
  );
  r = await app.inject({
    url: "/api/account/manual",
    method: "POST",
    headers: { cookie },
    remoteAddress: "203.0.113.20",
  });
  assert.equal(r.statusCode, 200);
  assert.equal(
    (
      await app.inject({
        url: "/api/session",
        headers: { cookie: "anipic_manual=1" },
        remoteAddress: "203.0.113.20",
      })
    ).json().user,
    null,
  );
});
test("PIN endpoint rate limits wrong attempts", async (t) => {
  const { app, db } = await fixture(t);
  saveSettings(db, { accessPinEnabled: true });
  for (let i = 0; i < 6; i++)
    await app.inject({
      url: "/api/gate/unlock",
      method: "POST",
      payload: { pin: "123456" },
    });
  assert.equal(
    (
      await app.inject({
        url: "/api/gate/unlock",
        method: "POST",
        payload: { pin: "123456" },
      })
    ).statusCode,
    429,
  );
});
test("GeoIP uses its local MMDB, resolves flags and never invents a location for private IPs", async (t) => {
  const { app, c } = await fixture(t);
  const d = await geoLocation(c, "8.8.8.8");
  assert.equal(d.country, "US");
  assert.equal(d.city, "Mountain View");
  assert.equal((await geoReader(c)).updatedAt.slice(0, 4), "2026");
  for (const ip of ["::1", "192.168.1.5", "fc00::11", "172.20.5.1"]) {
    assert.equal(localIP(ip), true);
    assert.equal((await geoLocation(c, ip)).country, null);
  }
  assert.equal((await app.inject({ url: "/api/flags/fr" })).statusCode, 200);
  assert.equal((await app.inject({ url: "/api/flags/zz" })).statusCode, 404);
});
test("automatic seasons include Easter and custom messages do not alter SPA facts", () => {
  assert.equal(seasonalTheme("2026-04-05"), "easter");
  assert.equal(seasonalTheme("2026-10-31"), "halloween");
  assert.equal(seasonalTheme("2026-12-22"), "christmas");
  assert.equal(seasonalTheme("2026-05-15"), "classic");
  assert.equal(
    messageContent({ theme: "auto" }, { calendarDate: "2026-04-05" }).title,
    "Joyeuses Pâques",
  );
  assert.equal(
    messageContent({ type: "hours" }, { textDefaults: { hours: "14 h–17 h" } })
      .body,
    "14 h–17 h",
  );
});
test("deleting TV scenes omits them from output and the empty track remains playable", () => {
  const show = {
    program: parseShow({ introSeconds: 5, excludedScenes: ["intro"] }),
    items: [],
  };
  const tl = showTimeline(show);
  assert.equal(tl.frames > 0, true);
  assert.equal(tl.scenes[0].key, "empty");
  assert.equal(
    showTimeline({
      ...show,
      program: parseShow({
        inserts: [{ id: id(), type: "hours", seconds: 8, afterAnimal: 0 }],
      }),
    }).scenes.some((s) => s.type === "hours"),
    true,
  );
});
test("TV selection rotates through eligible animals and can be fixed for export", async (t) => {
  const { app, db, c } = await fixture(t);
  for (let i = 0; i < 3; i++) await portrait(db, c, animal(db, "Chien " + i));
  saveSettings(db, {
    displayEnabled: true,
    displayProgram: parseShow({ maxAnimals: 1, rotationMinutes: 5 }),
  });
  const a = await buildDisplay(
      db,
      {},
      { at: new Date("2026-01-01T00:00:00Z") },
    ),
    b = await buildDisplay(db, {}, { at: new Date("2026-01-01T00:05:00Z") });
  assert.notEqual(a.items[0].id, b.items[0].id);
  assert.equal(a.rotation.total, 3);
  assert.ok(a.rotation.nextAt);
});
test("planning undo detects intervening edits and preserves the other member's change", async (t) => {
  const { app, db } = await fixture(t),
    admin = await login(app),
    a = animal(db);
  const r = await app.inject({
      url: "/api/tasks",
      method: "POST",
      headers: admin.headers,
      payload: { animalId: a, title: "Portrait" },
    }),
    task = db.prepare("SELECT * FROM shoot_tasks WHERE id=?").get(r.json().id);
  const first = await app.inject({
    url: "/api/tasks/" + task.id,
    method: "PATCH",
    headers: { ...admin.headers, "x-anipic-version": task.updated_at },
    payload: { state: "progress" },
  });
  assert.equal(first.statusCode, 200);
  const second = await app.inject({
    url: "/api/tasks/" + task.id,
    method: "PATCH",
    headers: { ...admin.headers, "x-anipic-version": task.updated_at },
    payload: { state: "done" },
  });
  assert.equal(second.statusCode, 409);
  assert.equal(
    db.prepare("SELECT state FROM shoot_tasks WHERE id=?").get(task.id).state,
    "progress",
  );
});
test("photo fingerprint comparison tolerates recompression and caches only the current source/local signature", async (t) => {
  const { app, db, c } = await fixture(t),
    a = animal(db),
    image = await sample();
  await portrait(db, c, a);
  db.prepare("UPDATE animals SET source_metadata=? WHERE id=?").run(
    JSON.stringify({
      thumbnail: "https://www.la-spa.fr/app/uploads/animals/42/test.jpg",
    }),
    a,
  );
  c.spaPhotoFetcher = async () =>
    sharp(image).resize(320, 427).jpeg({ quality: 60 }).toBuffer();
  const row = db
      .prepare("SELECT id,source_metadata FROM animals WHERE id=?")
      .get(a),
    r = await compareSourcePhoto(db, c, row);
  assert.equal(r.status, "probable_match", JSON.stringify(r));
  assert.equal(cachedSourceMatch(db, row).status, "probable_match");
  const fp = await photoFingerprint(image),
    other = await photoFingerprint(
      await sharp(image).jpeg({ quality: 40 }).toBuffer(),
    );
  assert.ok(fingerprintDistance(fp, other) < 10);
  const alpha = await photoFingerprint(
    await sharp(image).ensureAlpha().png().toBuffer(),
  );
  assert.ok(fingerprintDistance(fp, alpha) <= 6);
  const changed = {
    ...row,
    source_metadata: JSON.stringify({
      thumbnail: "https://www.la-spa.fr/app/uploads/animals/42/new.jpg",
    }),
  };
  assert.equal(cachedSourceMatch(db, changed), null);
  db.prepare("UPDATE animals SET source_metadata=? WHERE id=?").run(
    changed.source_metadata,
    a,
  );
  c.spaPhotoFetcher = async () =>
    sharp({
      create: { width: 320, height: 427, channels: 3, background: "#fff" },
    })
      .jpeg()
      .toBuffer();
  assert.equal(
    (await compareSourcePhoto(db, c, changed)).status,
    "unavailable",
  );
});

test("photo dates follow the Paris calendar, including DST and year boundaries", () => {
  assert.equal(
    photoDateLabel("2026-10-16T22:10:00Z", new Date("2026-10-16T22:30:00Z")),
    "Aujourd’hui",
  );
  assert.equal(
    photoDateLabel("2026-03-29T10:00:00Z", new Date("2026-03-29T22:30:00Z")),
    "Hier",
  );
  assert.equal(
    photoDateLabel("2026-12-31T18:00:00Z", new Date("2027-01-01T10:00:00Z")),
    "Hier",
  );
  assert.match(
    photoDateLabel("2025-10-01T10:00:00Z", new Date("2026-10-16T12:00:00Z")),
    /2025/,
  );
  assert.equal(photoDateLabel("invalid"), null);
});
test("batch posters generate a multi-page A4 PDF and remain private", async (t) => {
  const { app, db, c } = await fixture(t),
    admin = await login(app),
    ids = [animal(db, "Nala"), animal(db, "Maya")];
  for (const a of ids) await portrait(db, c, a);
  let r = await app.inject({
    url: "/api/posters/batch",
    method: "POST",
    payload: { animalIds: ids },
  });
  assert.equal(r.statusCode, 401);
  r = await app.inject({
    url: "/api/posters/batch",
    method: "POST",
    headers: admin.headers,
    payload: { animalIds: ids, template: "custom" },
  });
  assert.equal(r.statusCode, 200, r.body.slice(0, 300));
  const pdf = await PDFDocument.load(r.rawPayload);
  assert.equal(pdf.getPageCount(), 2);
  assert.equal(Math.round(pdf.getPage(0).getWidth()), 595);
});
