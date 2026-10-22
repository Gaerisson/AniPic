import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { fixture, login, animal } from "./helpers.mjs";
import { id, now, openDb, saveSettings } from "../server/db.mjs";
import { agendaItems } from "../server/agenda.mjs";
import {
  gazetteDefaults,
  gazettePortraits,
  gazetteSummary,
} from "../shared/gazette-content.mjs";
import {
  gazetteMonth,
  resolveGazetteContent,
} from "../server/gazette-data.mjs";
import { monthRange } from "../shared/agenda.mjs";
import { buildDisplay } from "../server/refuge-display.mjs";
import { showTimeline } from "../shared/signage.mjs";
const event = (extra = {}) => ({
  title: "Portes ouvertes",
  date: "2026-10-25",
  time: "14:30",
  category: "open_day",
  description: "Rencontrer les compagnons",
  ...extra,
});
const spa = (db, aid, date = "") =>
  db.prepare("UPDATE animals SET source_metadata=? WHERE id=?").run(
    JSON.stringify({
      thumbnail: `https://www.la-spa.fr/app/uploads/animals/${aid}.jpg`,
      ...(date ? { arrivalDate: date } : {}),
    }),
    aid,
  );
const send = (app, headers, method, url, payload) =>
  app.inject({ method, url, headers, payload });
test("shared agenda requires authentication, enforces roles and CSRF, validates dates and preserves concurrent edits", async (t) => {
  const { app, db } = await fixture(t),
    u = await login(app, "volunteer"),
    reader = await login(app, "viewer"),
    other = await login(app, "agent");
  const url = "/api/agenda?from=2026-10-01&to=2026-10-31";
  assert.equal((await app.inject({ url })).statusCode, 401);
  assert.equal(
    (await send(app, reader.headers, "POST", "/api/agenda", event()))
      .statusCode,
    403,
  );
  const { "x-csrf-token": csrf, ...noCsrf } = u.headers;
  assert.equal(
    (await send(app, noCsrf, "POST", "/api/agenda", event())).statusCode,
    403,
  );
  for (const bad of [
    { date: "2026-02-30" },
    { time: "24:00" },
    { endDate: "2026-10-01" },
    { showOnTV: "yes" },
    { category: "bogus" },
  ])
    assert.equal(
      (await send(app, u.headers, "POST", "/api/agenda", event(bad)))
        .statusCode,
      400,
    );
  const r = await send(
    app,
    u.headers,
    "POST",
    "/api/agenda",
    event({ endDate: "2026-11-02" }),
  );
  assert.equal(r.statusCode, 201, r.body);
  const key = r.json().id;
  let list = (await app.inject({ url, headers: reader.headers })).json();
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].author, "volunteer");
  assert.equal(
    (
      await app.inject({
        url: "/api/agenda?from=2026-11-01&to=2026-11-30",
        headers: u.headers,
      })
    ).json().items.length,
    1,
    "Multi-day events overlap both months",
  );
  assert.equal(
    (
      await app.inject({
        url: "/api/agenda?from=2026-11-01&to=2026-10-01",
        headers: u.headers,
      })
    ).statusCode,
    422,
  );
  assert.equal(
    (
      await send(app, other.headers, "PUT", `/api/agenda/${key}`, {
        ...event({ title: "Mise à jour équipe" }),
        revision: 1,
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await send(app, u.headers, "PUT", `/api/agenda/${key}`, {
        ...event({ title: "Ancienne saisie" }),
        revision: 1,
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await send(app, u.headers, "DELETE", `/api/agenda/${key}`, {
        revision: 1,
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await send(app, u.headers, "DELETE", `/api/agenda/${key}`, {
        revision: 2,
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (await app.inject({ url, headers: u.headers })).json().items.length,
    0,
  );
  assert.ok(
    db.prepare("SELECT deleted_at FROM agenda_events WHERE id=?").get(key)
      .deleted_at,
  );
  for (const time of ["17:00", "09:00", ""])
    assert.equal(
      (await send(app, u.headers, "POST", "/api/agenda", event({ time })))
        .statusCode,
      201,
    );
  assert.deepEqual(
    (await app.inject({ url, headers: u.headers }))
      .json()
      .items.map((e) => e.time),
    ["", "09:00", "17:00"],
  );
});
test("gazette and TV use only opted-in scheduled events, stay current after edits and omit team-only information", async (t) => {
  const { app, db } = await fixture(t),
    u = await login(app),
    from = "2026-10-01",
    to = "2026-11-30";
  for (const extra of [
    { title: "Interne uniquement", shareGazette: false, showOnTV: false },
    { title: "Collecte publique", shareGazette: true, showOnTV: true },
    {
      title: "Annulé",
      shareGazette: true,
      showOnTV: true,
      status: "cancelled",
    },
    { title: "Prochain mois", date: "2026-11-09", shareGazette: true },
    {
      title: "Trop loin",
      date: "2027-05-09",
      shareGazette: true,
      showOnTV: true,
    },
  ])
    assert.equal(
      (await send(app, u.headers, "POST", "/api/agenda", event(extra)))
        .statusCode,
      201,
    );
  assert.equal(agendaItems(db, from, to).items.length, 4);
  const options = gazetteDefaults("2026-10");
  let result = resolveGazetteContent(db, options);
  assert.deepEqual(
    result.keyDates.map((e) => e.title),
    ["Collecte publique", "Prochain mois"],
  );
  options.excludedAgenda = [result.keyDates[0].id];
  assert.deepEqual(
    resolveGazetteContent(db, options).keyDates.map((e) => e.title),
    ["Prochain mois"],
  );
  saveSettings(db, { displayEnabled: true });
  let show = await buildDisplay(
    db,
    {},
    { at: new Date("2026-10-18T12:00:00Z") },
  );
  assert.deepEqual(
    show.program.inserts.filter((e) => e.agenda).map((e) => e.title),
    ["Collecte publique"],
  );
  assert.equal(
    showTimeline(show).scenes.some(
      (s) => s.block?.title === "Collecte publique",
    ),
    true,
  );
  const published = agendaItems(db, from, to, { channel: "tv" }).items[0];
  const { id: key, revision, author, updatedAt, ...body } = published;
  assert.equal(
    (
      await send(app, u.headers, "PUT", `/api/agenda/${key}`, {
        ...body,
        title: "Nouvel intitulé",
        revision,
      })
    ).statusCode,
    200,
  );
  show = await buildDisplay(db, {}, { at: new Date("2026-10-18T12:00:00Z") });
  assert.equal(
    show.program.inserts.find((e) => e.agenda).title,
    "Nouvel intitulé",
  );
  assert.equal(
    (
      await buildDisplay(
        db,
        { displayProgram: { mode: "wallpaper" } },
        { force: true },
      )
    ).program.inserts.some((e) => e.agenda),
    false,
  );
});
test("automatic gazette selects current companions across species, summarizes verified movements and honours exclusions without manual additions", async (t) => {
  const { db } = await fixture(t),
    arrived = animal(db, "Arrivé"),
    adopted = animal(db, "Adopté"),
    archived = animal(db, "Archivé"),
    first = [];
  spa(db, arrived, "2026-10-03");
  spa(db, adopted);
  db.prepare("INSERT INTO animal_status_events VALUES (?,?,?,?)").run(
    id(),
    adopted,
    "adopted",
    "2026-10-15T12:00:00.000Z",
  );
  db.prepare(
    "UPDATE animals SET archived_at=?,status='source_missing' WHERE id=?",
  ).run(now(), archived);
  for (let i = 0; i < 18; i++) {
    const a = animal(db, `Compagnon ${i}`);
    spa(db, a);
    db.prepare("UPDATE animals SET species=? WHERE id=?").run(
      ["dog", "cat", "other"][i % 3],
      a,
    );
    first.push(a);
  }
  const options = gazetteDefaults("2026-10"),
    result = resolveGazetteContent(db, options);
  assert.equal(result.arrivals.length, 1);
  assert.equal(result.adopted.length, 1);
  assert.equal(result.portraits.length, 12);
  assert.ok(result.portraits.every((p) => p.automatic));
  const candidateSpecies = new Map(
    result.snapshot.candidates.map((a) => [a.id, a.species]),
  );
  assert.equal(
    new Set(result.portraits.map((p) => candidateSpecies.get(p.id))).size,
    3,
  );
  assert.ok(
    !result.portraits.some((a) => [archived, arrived, adopted].includes(a.id)),
  );
  assert.match(result.summary, /1 adoption enregistrée : Adopté/);
  assert.match(result.summary, /1 arrivée confirmée : Arrivé/);
  assert.match(result.summary, /actuellement présents/);
  const excluded = result.portraits[0].id;
  options.excludedAnimals = [excluded];
  options.excludedMovements = [`arrival:${arrived}`];
  const edited = resolveGazetteContent(db, options);
  assert.equal(edited.portraits.length, 12);
  assert.equal(
    edited.portraits.some((p) => p.id === excluded),
    false,
  );
  assert.equal(edited.arrivals.length, 0);
  assert.doesNotMatch(edited.summary, /arrivée confirmée/);
  const noMovements = gazetteSummary(options, { present: 0 }, []);
  assert.match(noMovements, /Aucun mouvement daté/);
  assert.doesNotMatch(noMovements, /adoption enregistrée/);
  assert.deepEqual(monthRange("2028-02"), {
    from: "2028-02-01",
    to: "2028-02-29",
  });
  assert.deepEqual(monthRange("2026-12", 2), {
    from: "2026-12-01",
    to: "2027-01-31",
  });
});
test("automatic gazette exports real PDF and images with source fallback and missing-photo placeholders", async (t) => {
  const image = await sharp({
    create: { width: 500, height: 700, channels: 3, background: "#ed7c31" },
  })
    .jpeg()
    .toBuffer();
  const { app, db } = await fixture(t, { spaPhotoFetcher: async () => image }),
    u = await login(app, "volunteer"),
    a = animal(db, "Portrait SPA"),
    b = animal(db, "Sans portrait");
  spa(db, a);
  const response = await send(
    app,
    u.headers,
    "POST",
    "/api/creative/gazette",
    gazetteDefaults("2026-10"),
  );
  assert.equal(response.statusCode, 202, response.body);
  const key = response.json().id;
  let job;
  for (let n = 0; n < 800; n++) {
    job = (
      await app.inject({ url: `/api/creative/jobs/${key}`, headers: u.headers })
    ).json();
    if (job.state !== "running") break;
    await new Promise((r) => setTimeout(r, 25));
  }
  assert.equal(job.state, "done", JSON.stringify(job));
  assert.equal(job.result.portraits, 2);
  assert.match(job.result.summary, /Aucun mouvement daté/);
  assert.equal(job.errors.length, 1);
  assert.equal(job.errors[0].name, "Sans portrait");
  const pdf = await app.inject({
    url: `/api/creative/gazette/${key}/file`,
    headers: u.headers,
  });
  assert.equal(pdf.statusCode, 200);
  assert.equal(pdf.rawPayload.subarray(0, 4).toString(), "%PDF");
  const social = await app.inject({
    url: `/api/creative/gazette/${key}/social`,
    headers: u.headers,
  });
  assert.equal((await sharp(social.rawPayload).metadata()).width, 1080);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos").get().n, 0);
});
test("migration from schema 19 adds only the agenda and preserves drafts, animals and authenticated sessions", async (t) => {
  const { app, db, c } = await fixture(t),
    u = await login(app),
    aid = animal(db),
    draft = id();
  db.prepare("INSERT INTO gazette_drafts VALUES (?,?,?,?,?)").run(
    draft,
    "Avant migration",
    JSON.stringify(gazetteDefaults("2026-10")),
    u.user.id,
    now(),
  );
  db.exec("DROP TABLE agenda_events;PRAGMA user_version=19;");
  const reopened = openDb(c);
  assert.equal(reopened.prepare("PRAGMA user_version").get().user_version, 23);
  assert.equal(
    reopened.prepare("SELECT id FROM animals WHERE id=?").get(aid).id,
    aid,
  );
  assert.equal(
    reopened.prepare("SELECT title FROM gazette_drafts WHERE id=?").get(draft)
      .title,
    "Avant migration",
  );
  assert.equal(reopened.prepare("SELECT COUNT(*) n FROM sessions").get().n, 1);
  assert.deepEqual(reopened.prepare("PRAGMA foreign_key_check").all(), []);
  reopened.close();
  assert.equal(
    (await app.inject({ url: "/api/session", headers: u.headers })).json().user
      .id,
    u.user.id,
  );
});
