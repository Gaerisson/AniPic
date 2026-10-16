import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import sharp from "sharp";
import { fixture, login, animal } from "./helpers.mjs";
import { settings, now } from "../server/db.mjs";
import { ingest } from "../server/storage.mjs";

test("status display settings persist publicly without changing SPA facts and reject unsafe values", async (t) => {
  const { app, db } = await fixture(t);
  const { headers } = await login(app);
  const a = animal(db);
  db.prepare("UPDATE animals SET status='reserved' WHERE id=?").run(a);
  const initial = (await app.inject({ url: "/api/overview" })).json();
  assert.equal(
    initial.interface.statusAppearance.available.label,
    "À l’adoption",
  );
  const appearance = structuredClone(initial.interface.statusAppearance);
  appearance.available = { label: "Au refuge 🐾", color: "#83b9ff" };
  appearance.reserved = { label: "Rencontre prévue", color: "#eeaa44" };
  const save = await app.inject({
    method: "PUT",
    url: "/api/admin/settings",
    headers,
    payload: { statusAppearance: appearance },
  });
  assert.equal(save.statusCode, 200, save.body);
  assert.deepEqual(settings(db).statusAppearance, appearance);
  assert.deepEqual(
    (await app.inject({ url: "/api/overview" })).json().interface
      .statusAppearance,
    appearance,
  );
  assert.equal(
    db.prepare("SELECT status FROM animals WHERE id=?").get(a).status,
    "reserved",
  );
  assert.equal(
    (await app.inject({ url: "/api/animals?status=reserved" })).json().items[0]
      .id,
    a,
  );
  assert.equal(
    (await app.inject({ url: "/api/animals?status=Rencontre%20pr%C3%A9vue" }))
      .statusCode,
    400,
  );
  for (const invalid of [
    { ...appearance, available: { label: "  ", color: "#112233" } },
    { ...appearance, available: { label: "x".repeat(33), color: "#112233" } },
    {
      ...appearance,
      available: { label: "Au refuge", color: "red;display:none" },
    },
    { ...appearance, invented: { label: "Adopté", color: "#112233" } },
  ]) {
    const response = await app.inject({
      method: "PUT",
      url: "/api/admin/settings",
      headers,
      payload: { statusAppearance: invalid },
    });
    assert.equal(response.statusCode, 400, response.body);
  }
  const agent = await login(app, "agent");
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: "/api/admin/settings",
        headers: agent.headers,
        payload: { statusAppearance: appearance },
      })
    ).statusCode,
    403,
  );
  assert.deepEqual(settings(db).statusAppearance, appearance);
});

test("status and photo filters combine with species, archive, year and pagination without leaking private photos", async (t) => {
  const { app, db, c } = await fixture(t);
  const { headers } = await login(app);
  const active = animal(db, "Portrait public"),
    reserved = animal(db, "Réservé privé"),
    cat = animal(db, "Chat réservé"),
    adopted = animal(db, "Adopté archivé"),
    empty = animal(db, "Sans portrait"),
    missing = animal(db, "Absent archivé");
  db.prepare("UPDATE animals SET status='reserved' WHERE id IN (?,?)").run(
    reserved,
    cat,
  );
  db.prepare("UPDATE animals SET species='cat' WHERE id=?").run(cat);
  db.prepare("UPDATE animals SET status=?,archived_at=? WHERE id=?").run(
    "adopted",
    "2023-04-10T12:00:00Z",
    adopted,
  );
  db.prepare("UPDATE animals SET status=?,archived_at=? WHERE id=?").run(
    "source_missing",
    now(),
    missing,
  );
  const photo = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#467455" },
  })
    .jpeg()
    .toBuffer();
  for (const a of [active, cat, adopted])
    await ingest(db, c, a, Readable.from(photo), "public.jpg");
  await ingest(db, c, reserved, Readable.from(photo), "private.jpg", true);
  const query = async (suffix, auth) => {
    const response = await app.inject({
      url: "/api/animals?" + suffix,
      headers: auth,
    });
    assert.equal(response.statusCode, 200, response.body);
    return response.json();
  };
  assert.deepEqual(
    (await query("status=reserved&species=dog&photos=without")).items.map(
      (a) => a.id,
    ),
    [reserved],
  );
  assert.equal(
    (await query("status=reserved&species=dog&photos=with")).total,
    0,
  );
  assert.deepEqual(
    (await query("status=reserved&species=dog&photos=with", headers)).items.map(
      (a) => a.id,
    ),
    [reserved],
  );
  assert.deepEqual(
    (await query("status=reserved&species=cat&photos=with")).items.map(
      (a) => a.id,
    ),
    [cat],
  );
  const first = await query("status=reserved&limit=1&page=1"),
    second = await query("status=reserved&limit=1&page=2");
  assert.equal(first.total, 2);
  assert.equal(first.pages, 2);
  assert.notEqual(first.items[0].id, second.items[0].id);
  assert.deepEqual(
    (await query("archive=1&status=adopted&year=2023&photos=with")).items.map(
      (a) => a.id,
    ),
    [adopted],
  );
  assert.deepEqual(
    (await query("archive=1&status=source_missing&photos=without")).items.map(
      (a) => a.id,
    ),
    [missing],
  );
  assert.equal(
    (await query("status=available&photos=without", headers)).items[0].id,
    empty,
  );
  db.prepare("UPDATE photos SET archived_at=? WHERE animal_id=?").run(
    now(),
    active,
  );
  assert.equal((await query("q=Portrait%20public&photos=without")).total, 1);
  for (const suffix of [
    "status=arbitrary-sql",
    "photos=private",
    "status=reserved%27%20OR%201=1",
  ])
    assert.equal(
      (await app.inject({ url: "/api/animals?" + suffix })).statusCode,
      400,
    );
});
