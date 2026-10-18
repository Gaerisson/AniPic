import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { fixture, login, animal } from "./helpers.mjs";
import {
  inferAdoption,
  adoptionOrigin,
  reconcileAdoption,
  pendingAdoptionCount,
} from "../server/source-adoption.mjs";
import { settings, saveSettings, now } from "../server/db.mjs";
import { applySnapshot, normalizeSnapshot } from "../server/source.mjs";
import { refugeEvent } from "../shared/feed-event.mjs";
import { logoPosterLayout } from "../shared/logo-poster-layout.mjs";
import {
  groupPosterImage,
  groupPosterOptions,
} from "../server/group-posters.mjs";
import { publicAsset } from "../server/public-assets.mjs";
import { Readable } from "node:stream";
import { ingest } from "../server/storage.mjs";

function pending(db, name = "Maya") {
  const id = animal(db, name),
    row = db.prepare("SELECT * FROM animals WHERE id=?").get(id),
    at = now();
  inferAdoption(
    db,
    row,
    { scope: "spa:moree", fetchedAt: at },
    settings(db),
    at,
    2,
  );
  db.prepare(
    "UPDATE animals SET status='adopted',archived_at=?,departed_at=? WHERE id=?",
  ).run(at, at, id);
  return { id, at };
}
test("adoption review API requires agent/admin sessions and CSRF; public provenance contains no reviewer identity", async (t) => {
  const { app, db } = await fixture(t),
    a = pending(db);
  assert.equal(
    (await app.inject({ url: "/api/adoption-reviews" })).statusCode,
    401,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: `/api/adoption-reviews/${a.id}/confirm`,
        payload: { expectedAt: a.at },
      })
    ).statusCode,
    401,
  );
  for (const role of ["viewer", "editor", "volunteer"]) {
    const auth = await login(app, role);
    assert.equal(
      (
        await app.inject({
          url: "/api/adoption-reviews",
          headers: auth.headers,
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/api/adoption-reviews/${a.id}/confirm`,
          headers: auth.headers,
          payload: { expectedAt: a.at },
        })
      ).statusCode,
      403,
    );
  }
  const auth = await login(app, "agent");
  assert.equal(
    (await app.inject({ url: "/api/adoption-reviews", headers: auth.headers }))
      .statusCode,
    200,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: `/api/adoption-reviews/${a.id}/confirm`,
        headers: { cookie: auth.headers.cookie, origin: auth.headers.origin },
        payload: { expectedAt: a.at },
      })
    ).statusCode,
    403,
  );
  assert.equal(pendingAdoptionCount(db), 1);
});
test("agent confirmation is persistent and idempotent, updates counts/feed/origin, preserves media and never double-counts adoption", async (t) => {
  const { app, db } = await fixture(t),
    a = pending(db),
    auth = await login(app, "agent");
  const bytes = await sharp({
    create: { width: 24, height: 32, channels: 3, background: "orange" },
  })
    .jpeg()
    .toBuffer();
  await ingest(
    db,
    app.anipicConfig,
    a.id,
    Readable.from(bytes),
    "photo-privee.jpg",
    true,
  );
  const originalPhotos = db.prepare("SELECT * FROM photos").all(),
    originalBlobs = db.prepare("SELECT * FROM blobs").all();
  const before = db
    .prepare("SELECT * FROM animal_status_events WHERE status='adopted'")
    .all();
  let r = await app.inject({
    url: "/api/adoption-reviews",
    headers: auth.headers,
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().items[0].id, a.id);
  assert.equal(r.json().items[0].cover_id, null);
  assert.equal(
    (
      await app.inject({
        url: "/api/adoption-reviews?countOnly=1",
        headers: auth.headers,
      })
    ).json().total,
    1,
  );
  const request = {
    method: "POST",
    url: `/api/adoption-reviews/${a.id}/confirm`,
    headers: auth.headers,
    payload: { expectedAt: a.at },
  };
  r = await app.inject(request);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal((await app.inject(request)).json().alreadyConfirmed, true);
  assert.equal(pendingAdoptionCount(db), 0);
  assert.deepEqual(db.prepare("SELECT * FROM photos").all(), originalPhotos);
  assert.deepEqual(db.prepare("SELECT * FROM blobs").all(), originalBlobs);
  assert.deepEqual(
    db
      .prepare("SELECT * FROM animal_status_events WHERE status='adopted'")
      .all(),
    before,
  );
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) n FROM audit WHERE action='adoption_review_confirmed'",
      )
      .get().n,
    1,
  );
  const origin = adoptionOrigin(db, a.id);
  assert.equal(origin.kind, "team_confirmed");
  assert.ok(origin.reviewedAt);
  assert.equal(origin.userId, undefined);
  const feed = (await app.inject({ url: "/api/feed?latest=1" })).json().events;
  assert.equal(refugeEvent(feed[0]).label, "Adoption confirmée");
  assert.equal(
    (await app.inject({ url: "/api/overview", headers: auth.headers })).json()
      .stats.pendingAdoptions,
    0,
  );
  assert.equal(
    reconcileAdoption(
      db,
      db.prepare("SELECT * FROM animals WHERE id=?").get(a.id),
      "available",
    ),
    true,
  );
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) n FROM animal_status_events WHERE status='adopted'",
      )
      .get().n,
    0,
  );
  assert.equal(adoptionOrigin(db, a.id), null);
  const corrected = (await app.inject({ url: "/api/feed?latest=1" })).json()
    .events[0];
  assert.equal(corrected.adoption_origin.kind, "automatic_reversed");
  assert.equal(refugeEvent(corrected).type, "returned");
  assert.equal((await app.inject(request)).statusCode, 409);
});

test("review count covers all pending departures while the list remains paginated", async (t) => {
  const { app, db } = await fixture(t),
    auth = await login(app, "agent");
  for (let i = 0; i < 41; i++) pending(db, `Compagnon ${i}`);
  const first = (
    await app.inject({ url: "/api/adoption-reviews", headers: auth.headers })
  ).json();
  const second = (
    await app.inject({
      url: "/api/adoption-reviews?page=2",
      headers: auth.headers,
    })
  ).json();
  assert.equal(first.total, 41);
  assert.equal(first.pages, 2);
  assert.equal(first.items.length, 40);
  assert.equal(second.items.length, 1);
  assert.equal(
    new Set([...first.items, ...second.items].map((a) => a.id)).size,
    41,
  );
});
test("stale reviews, trash and manual adoptions cannot enter or be confirmed through the automatic queue", async (t) => {
  const { app, db } = await fixture(t),
    a = pending(db),
    auth = await login(app);
  const post = (payload) =>
    app.inject({
      method: "POST",
      url: `/api/adoption-reviews/${a.id}/confirm`,
      headers: auth.headers,
      payload,
    });
  assert.equal(
    (await post({ expectedAt: "2020-01-01T00:00:00.000Z" })).statusCode,
    409,
  );
  db.prepare("INSERT INTO settings VALUES (?,?)").run(
    "animalTrash:" + a.id,
    "{}",
  );
  assert.equal(pendingAdoptionCount(db), 0);
  assert.equal((await post({ expectedAt: a.at })).statusCode, 409);
  const manual = animal(db, "Adoption officielle");
  db.prepare(
    "UPDATE animals SET status='adopted',archived_at=? WHERE id=?",
  ).run(now(), manual);
  assert.equal(pendingAdoptionCount(db), 0);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: `/api/adoption-reviews/${manual}/confirm`,
        headers: auth.headers,
        payload: { expectedAt: a.at },
      })
    ).statusCode,
    409,
  );
});
test("real automatic archival populates review queue, source return removes it without any manual intervention", async (t) => {
  const { db } = await fixture(t);
  saveSettings(db, {
    archiveMissing: true,
    sourceMissingOutcome: "adopted",
    missingThreshold: 2,
    sourceAbsenceIntervalHours: 0.5,
  });
  let stamp = Date.now() - 5000;
  const snap = (ids) =>
    normalizeSnapshot({
      schemaVersion: 1,
      scope: "spa:moree",
      complete: true,
      expectedCount: ids.length,
      fetchedAt: new Date((stamp += 100)).toISOString(),
      animals: ids.map((id) => ({
        sourceId: "spa:" + id,
        name: id,
        species: "dog",
        status: "available",
      })),
    });
  const age = () => {
    const row = JSON.parse(
      db
        .prepare("SELECT value FROM settings WHERE key='complete:spa:moree'")
        .get().value,
    );
    row.at = new Date(Date.now() - 3600000).toISOString();
    db.prepare(
      "UPDATE settings SET value=? WHERE key='complete:spa:moree'",
    ).run(JSON.stringify(row));
  };
  applySnapshot(db, snap(["one", "two"]));
  age();
  applySnapshot(db, snap(["one"]));
  age();
  applySnapshot(db, snap(["one"]));
  assert.equal(pendingAdoptionCount(db), 1);
  applySnapshot(db, snap(["one", "two"]));
  assert.equal(pendingAdoptionCount(db), 0);
  assert.equal(
    db
      .prepare("SELECT archived_at FROM animals WHERE source_id='spa:two'")
      .get().archived_at,
    null,
  );
});
test("home feed uses distinct symbols and labels for arrivals, returns, pending adoption, confirmed adoption and other departures", () => {
  assert.deepEqual(refugeEvent({ kind: "added", status: "adopted" }), {
    type: "arrival",
    label: "Nouvel arrivant",
    symbol: "plus",
  });
  assert.equal(
    refugeEvent({ kind: "restored", status: "adopted" }).symbol,
    "return",
  );
  assert.equal(
    refugeEvent({ kind: "removed", status: "source_missing" }).symbol,
    "minus",
  );
  assert.equal(
    refugeEvent({
      kind: "removed",
      status: "adopted",
      adoption_origin: { kind: "automatic_absence" },
    }).type,
    "pending",
  );
  assert.equal(
    refugeEvent({
      kind: "adopted",
      status: "adopted",
      adoption_origin: { kind: "team_confirmed" },
    }).type,
    "adoption",
  );
});
test("logo poster packs every 1–60 selection once, without overlaps or clipped name strips; real preview and PDF export render", async (t) => {
  for (let n = 1; n <= 60; n++) {
    const slots = logoPosterLayout(n);
    assert.equal(slots.length, n);
    for (const [i, a] of slots.entries()) {
      assert.ok(
        a.x >= 100 &&
          a.y >= 355 &&
          a.x + a.w <= 1140.01 &&
          a.y + a.h <= 1505.01,
      );
      assert.ok(a.w > 100 && a.h > 40);
      for (const b of slots.slice(i + 1))
        assert.ok(
          a.x + a.w <= b.x + 0.01 ||
            b.x + b.w <= a.x + 0.01 ||
            a.y + a.h <= b.y + 0.01 ||
            b.y + b.h <= a.y + 0.01,
        );
    }
  }
  const buffer = await sharp({
    create: { width: 80, height: 100, channels: 3, background: "orange" },
  })
    .jpeg()
    .toBuffer();
  const ids = Array.from({ length: 12 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  }));
  const o = groupPosterOptions.parse({
    animals: ids,
    template: "logo-mosaic",
    names: false,
    qrUrl: "https://example.org/refuge",
  });
  const png = await groupPosterImage(
    {},
    ids.map((_, i) => ({
      name: i === 0 ? "O’MALLEY & <amis>" : "Animal " + i,
      buffer,
    })),
    o,
    await publicAsset("spa-logo.png"),
  );
  assert.equal((await sharp(png).metadata()).width, 868);
  const { app, db, c } = await fixture(t),
    a = animal(db, "Nala"),
    auth = await login(app, "agent");
  await ingest(db, c, a, Readable.from(buffer), "portrait.jpg");
  const r = await app.inject({
    method: "POST",
    url: "/api/group-posters",
    headers: auth.headers,
    payload: {
      animals: [{ id: a }],
      template: "logo-mosaic",
      format: "A4",
      output: "pdf",
    },
  });
  assert.equal(r.statusCode, 200, r.body.slice(0, 300));
  assert.match(r.headers["content-type"], /application\/pdf/);
  const pdf = await PDFDocument.load(r.rawPayload);
  assert.equal(pdf.getPageCount(), 1);
  assert.ok(Math.abs(pdf.getPage(0).getWidth() - 595.276) < 0.01);
});
