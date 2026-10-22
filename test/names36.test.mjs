import {localTakenNames} from "../server/name-catalogue.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, login, animal } from "./helpers.mjs";
import {
  nameKey,
  nameKeys,
  collectNameCatalogue,
  validCatalogue,
} from "../server/name-catalogue.mjs";
const snapshot = (names = [], age = 0) => ({
  complete: true,
  names,
  animals: names.length,
  checkedAt: new Date(Date.now() - age).toISOString(),
});
const page = (names, total = names.length, pages = 1) =>
  JSON.stringify({
    total,
    nb_pages: pages,
    results: names.map(([ID, name]) => ({ ID, name })),
  });
const finished = async (app) => {
  for (let i = 0; i < 80; i++) {
    const r = await app.inject("/api/tools/names");
    if (!r.json().national.running) return r.json();
    await new Promise((r) => setImmediate(r));
  }
  throw Error("Catalogue did not finish");
};
test("name keys ignore accent, case, spacing and punctuation", () => {
  assert.equal(nameKey(" É-glan tine "), nameKey("éGLANTINE"));
  assert.equal(nameKey("Cœur"), nameKey("COEUR"));
  for (const raw of [
    "ATHÉNA PAA22428",
    "Athéna (Réservée)",
    "Athéna [FIV+]",
    "ATHENA 24",
    "Petite Athéna",
  ])
    assert.ok(nameKeys(raw).includes(nameKey("Athéna")), raw);
  assert.equal(validCatalogue(snapshot(["Orion"])), true);
  assert.equal(validCatalogue({ ...snapshot(), complete: false }), false);
  assert.equal(validCatalogue({ ...snapshot(), checkedAt: "bad" }), false);
  assert.equal(
    validCatalogue({
      ...snapshot(),
      checkedAt: new Date(Date.now() + 3600_000).toISOString(),
    }),
    false,
  );
});
test("national catalogue validates every page and total; names can repeat for different animals", async () => {
  const seen = [],
    progress = [];
  const value = await collectNameCatalogue({
    delay: async () => {},
    onProgress: (p) => progress.push(p),
    fetchText: async (url) => {
      const u = new URL(url);
      seen.push(u);
      return u.searchParams.get("paged") === "1"
        ? page(
            [
              [1, "ORION"],
              [2, "Vega"],
            ],
            3,
            2,
          )
        : page([[3, "ORION"]], 3, 2);
    },
  });
  assert.equal(value.animals, 3);
  assert.deepEqual(value.names, ["ORION", "Vega"]);
  assert.equal(seen.length, 2);
  assert.equal(seen[0].origin, "https://www.la-spa.fr");
  assert.equal(seen[0].searchParams.has("establishment"), false);
  assert.deepEqual(
    progress.map((p) => p.page),
    [1, 2],
  );
});
test("partial, changing, repeated or unbounded national pages are rejected", async () => {
  for (const responses of [
    [page([[1, "Orion"]], 2, 1)],
    [page([[1, "Orion"]], 2, 2), page([[1, "Orion"]], 2, 2)],
    [page([[1, "Orion"]], 2, 2), page([[2, "Vega"]], 3, 2)],
    [page([[1, "Orion"]], 20000, 999)],
    [JSON.stringify({ results: [{ ID: 1 }], total: 1, nb_pages: 1 })],
    [page([], 0, 0)],
  ]) {
    let i = 0;
    await assert.rejects(
      collectNameCatalogue({
        delay: async () => {},
        fetchText: async () => responses[i++],
      }),
    );
  }
  await assert.rejects(collectNameCatalogue({ cancelled: () => true }));
});
test("active local and national names are excluded; archived/adopted/old names may be reused", async (t) => {
  const { app, db } = await fixture(t, {
    nameCatalogueSnapshot: snapshot([" O-rion "]),
  });
  const active = animal(db, "VÉGA"),
    archived = animal(db, "Atlas"),
    adopted = animal(db, "Cosmo");
  db.prepare("UPDATE animals SET archived_at=? WHERE id=?").run(
    new Date().toISOString(),
    archived,
  );
  db.prepare("UPDATE animals SET status='adopted' WHERE id=?").run(adopted);
  db.prepare(
    "INSERT INTO animal_changes(animal_id,kind,field,before_value,after_value,observed_at) VALUES (?,'updated','name',?,?,?)",
  ).run(
    active,
    JSON.stringify("Apollo"),
    JSON.stringify("VÉGA"),
    new Date().toISOString(),
  );
  const r = await app.inject("/api/tools/names?theme=cosmos&count=24");
  assert.equal(r.statusCode, 200, r.body);
  const names = r.json().names;
  assert.ok(!names.includes("Orion"));
  assert.ok(!names.includes("Vega"));
  for (const name of ["Atlas", "Cosmo", "Apollo"])
    assert.equal(localTakenNames(db).has(nameKey(name)),false,name);
  assert.equal(r.json().excludesDeparted, false);
});
test("validated catalogue remains usable while stale; failed refresh preserves its exclusions", async (t) => {
  let requests = 0;
  const { app, db } = await fixture(t, {
    nameCatalogueSnapshot: snapshot(["Atlas"], 48 * 3600_000),
    nameCatalogueFetcher: async () => {
      requests++;
      throw Error("SPA indisponible");
    },
  });
  let r = await app.inject("/api/tools/names?theme=cosmos");
  assert.ok(r.json().names.length>0);
  assert.ok(!r.json().names.includes("Atlas"));
  assert.equal(r.json().national.fresh,false);
  assert.equal(requests, 0);
  const auth = await login(app, "agent");
  r = await app.inject({
    method: "POST",
    url: "/api/tools/names/refresh",
    headers: auth.headers,
  });
  assert.equal(r.statusCode, 200, r.body);
  const data = await finished(app);
  assert.ok(data.names.length>0);
  assert.ok(!data.names.includes("Atlas"));
  assert.equal(data.national.ready, true);
  assert.match(data.national.error, /SPA indisponible/);
  assert.equal(
    db
      .prepare("SELECT value FROM settings WHERE key='spaNameCatalogueV1'")
      .get(),
    undefined,
  );
  assert.equal(requests, 1);
});
test("refresh is shared, replaces old national names, persists only complete data and changes no animals", async (t) => {
  let resolveFirst,
    requests = 0;
  const { app, db } = await fixture(t, {
    nameCatalogueSnapshot: snapshot(["Orion"]),
    nameCatalogueDelay: async () => {},
    nameCatalogueFetcher: async () => {
      requests++;
      await new Promise((r) => {
        resolveFirst = r;
      });
      return page([[1, "Atlas"]]);
    },
  });
  animal(db, "Local");
  const auth = await login(app, "agent");
  for (let i = 0; i < 2; i++) {
    const r = await app.inject({
      method: "POST",
      url: "/api/tools/names/refresh",
      headers: auth.headers,
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().running, true);
  }
  assert.equal(requests, 1);
  resolveFirst();
  await finished(app);
  const r = await app.inject("/api/tools/names?theme=cosmos&count=24");
  assert.ok(r.json().names.length > 0);
  assert.ok(!r.json().names.includes("Atlas"));
  const saved = JSON.parse(
    db
      .prepare("SELECT value FROM settings WHERE key='spaNameCatalogueV1'")
      .get().value,
  );
  assert.deepEqual(saved.names, ["Atlas"]);
  assert.equal(saved.complete, true);
  assert.equal(db.prepare("SELECT count(*) AS n FROM animals").get().n, 1);
});
test("national refresh requires team session and CSRF, rejects viewer and expired session", async (t) => {
  let requests = 0;
  const { app, db } = await fixture(t, {
    nameCatalogueSnapshot: snapshot(),
    nameCatalogueFetcher: async () => {
      requests++;
      return page([[1, "Atlas"]]);
    },
  });
  let r = await app.inject({ method: "POST", url: "/api/tools/names/refresh" });
  assert.equal(r.statusCode, 401);
  r = await app.inject("/api/tools/names/catalogue");
  assert.equal(r.statusCode, 401);
  const viewer = await login(app, "viewer");
  r = await app.inject({
    method: "POST",
    url: "/api/tools/names/refresh",
    headers: viewer.headers,
  });
  assert.equal(r.statusCode, 403);
  const agent = await login(app, "agent");
  r = await app.inject({
    method: "POST",
    url: "/api/tools/names/refresh",
    headers: { cookie: agent.headers.cookie },
  });
  assert.equal(r.statusCode, 403);
  db.prepare("UPDATE sessions SET expires_at='2000-01-01T00:00:00.000Z'").run();
  r = await app.inject({
    method: "POST",
    url: "/api/tools/names/refresh",
    headers: agent.headers,
    remoteAddress: "127.0.0.2",
  });
  assert.equal(r.statusCode, 401);
  assert.equal(requests, 0);
});
