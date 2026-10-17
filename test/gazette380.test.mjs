import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import sharp from "sharp";
import yauzl from "yauzl";
import { PDFDocument } from "pdf-lib";
import { fixture, login, animal } from "./helpers.mjs";
import { now, id } from "../server/db.mjs";
import { ingest } from "../server/storage.mjs";
import {
  gazetteMonth,
  resolveGazetteContent,
  gazetteOptions,
} from "../server/gazette-data.mjs";
import {
  gazetteDefaults,
  mergeGazetteMovements,
  canonicalGazette,
} from "../shared/gazette-content.mjs";
import {
  prepareGazetteFile,
  gazetteFileDescriptor,
  canShareGazette,
  shareGazette,
} from "../src/gazette-sharing.js";
function spa(db, aid, date = "") {
  db.prepare(
    "UPDATE animals SET source_metadata=?,created_at='2026-10-01T12:00:00.000Z' WHERE id=?",
  ).run(
    JSON.stringify({
      thumbnail: `https://www.la-spa.fr/app/uploads/animals/${aid}.jpg`,
      ...(date ? { arrivalDate: date } : {}),
    }),
    aid,
  );
}
async function wait(app, headers, id) {
  const end = Date.now() + 40000;
  while (Date.now() < end) {
    const r = await app.inject({ url: `/api/creative/jobs/${id}`, headers });
    assert.equal(r.statusCode, 200, r.body);
    const j = r.json();
    if (j.state !== "running") return j;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw Error("Gazette timeout");
}
async function zipEntries(buffer) {
  const zip = await new Promise((resolve, reject) =>
      yauzl.fromBuffer(buffer, { lazyEntries: true }, (e, z) =>
        e ? reject(e) : resolve(z),
      ),
    ),
    names = [];
  await new Promise((resolve, reject) => {
    zip.on("error", reject);
    zip.on("end", resolve);
    zip.on("entry", (e) => {
      names.push(e.fileName);
      zip.readEntry();
    });
    zip.readEntry();
  });
  return names;
}
test("gazette uses arrival facts instead of import dates, excludes archives from adoptions and keeps edition corrections isolated", async (t) => {
  const { db } = await fixture(t),
    a = animal(db, "Arrivé"),
    b = animal(db, "Import sans date"),
    c = animal(db, "Parti sans adoption"),
    d = animal(db, "Adopté");
  spa(db, a, "2026-10-03");
  spa(db, b);
  spa(db, c, "2026-09-20");
  spa(db, d);
  db.prepare(
    "UPDATE animals SET archived_at=?,status='source_missing' WHERE id=?",
  ).run(now(), c);
  db.prepare("INSERT INTO animal_status_events VALUES (?,?,?,?)").run(
    id(),
    d,
    "adopted",
    "2026-10-09T12:00:00.000Z",
  );
  const snapshot = gazetteMonth(db, "2026-10");
  assert.equal(snapshot.added.length, 4);
  assert.deepEqual(
    snapshot.arrivals.map((a) => a.name),
    ["Arrivé"],
  );
  assert.deepEqual(
    snapshot.adopted.map((a) => a.name),
    ["Adopté"],
  );
  const config = {
    ...gazetteDefaults("2026-10"),
    movements: [
      {
        animalId: a,
        kind: "arrival",
        date: "2026-10-04",
        note: "Bienvenue !",
        source: "spa",
      },
      {
        animalId: b,
        kind: "adoption",
        date: "2026-10-17",
        note: "Une belle rencontre",
        source: "auto",
      },
    ],
    excludedMovements: [`adoption:${d}`],
  };
  const result = resolveGazetteContent(db, config);
  assert.equal(result.arrivals.length, 1);
  assert.equal(result.adopted.length, 1);
  assert.equal(result.arrivals[0].date, "2026-10-04");
  assert.equal(result.adopted[0].name, "Import sans date");
  assert.equal(
    JSON.parse(
      db.prepare("SELECT source_metadata FROM animals WHERE id=?").get(a)
        .source_metadata,
    ).arrivalDate,
    "2026-10-03",
  );
  assert.equal(
    db.prepare("SELECT status FROM animals WHERE id=?").get(b).status,
    "available",
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM animal_status_events").get().n,
    1,
  );
  assert.equal(
    mergeGazetteMovements(
      {
        ...config,
        includeArrivals: false,
        includeAdoptions: false,
        movements: [],
      },
      snapshot,
    ).length,
    0,
  );
});
test("gazette dates reject impossible days and times; future agenda dates are allowed and drafts preserve movement exclusions", async (t) => {
  const { app, db } = await fixture(t),
    u = await login(app, "volunteer"),
    a = animal(db),
    draft = id();
  const valid = {
    ...gazetteDefaults("2026-10"),
    movements: [
      {
        animalId: a,
        kind: "arrival",
        date: "2026-10-03",
        note: "",
        source: "auto",
      },
    ],
    excludedMovements: [`arrival:${a}`],
    keyDates: [
      {
        id: id(),
        date: "2026-12-25",
        time: "14:30",
        title: "Noël au refuge",
        category: "event",
        location: "Morée",
        description: "Une journée à partager.",
      },
    ],
  };
  assert.ok(gazetteOptions.safeParse(valid).success);
  assert.equal(
    gazetteOptions.safeParse({
      ...valid,
      keyDates: [{ ...valid.keyDates[0], date: "2026-02-30" }],
    }).success,
    false,
  );
  assert.equal(
    gazetteOptions.safeParse({
      ...valid,
      keyDates: [{ ...valid.keyDates[0], time: "25:60" }],
    }).success,
    false,
  );
  assert.equal(
    gazetteOptions.safeParse({
      ...valid,
      movements: [{ ...valid.movements[0], date: "2026-11-02" }],
    }).success,
    false,
  );
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: `/api/creative/gazette/drafts/${draft}`,
        headers: u.headers,
        payload: valid,
      })
    ).statusCode,
    200,
  );
  const drafts = (
    await app.inject({
      url: "/api/creative/gazette/drafts",
      headers: u.headers,
    })
  ).json();
  assert.deepEqual(drafts[0].config.keyDates, valid.keyDates);
  assert.deepEqual(drafts[0].config.excludedMovements, valid.excludedMovements);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/creative/gazette",
        headers: { cookie: u.headers.cookie },
        payload: valid,
      })
    ).statusCode,
    403,
  );
});
test("complete gazette generates adoption and arrival pages, agenda, social PNG, JPEG and a protected ZIP even if a movement has no photo", async (t) => {
  const image = await sharp({
    create: { width: 640, height: 800, channels: 3, background: "#cc7e4e" },
  })
    .jpeg()
    .toBuffer();
  let requests = 0;
  const { app, db, c } = await fixture(t, {
      spaPhotoFetcher: async () => {
        requests++;
        return image;
      },
    }),
    u = await login(app, "volunteer"),
    other = await login(app, "agent"),
    arrivals = [];
  for (let n = 0; n < 7; n++) {
    const a = animal(db, "Arrivant " + n);
    spa(db, a, "2026-10-03");
    arrivals.push(a);
  }
  const missing = animal(db, "Sans portrait");
  db.prepare("UPDATE animals SET source_metadata=? WHERE id=?").run(
    JSON.stringify({ arrivalDate: "2026-10-04" }),
    missing,
  );
  const adopted = animal(db, "Famille trouvée");
  spa(db, adopted);
  db.prepare("INSERT INTO animal_status_events VALUES (?,?,?,?)").run(
    id(),
    adopted,
    "adopted",
    "2026-10-05T12:00:00.000Z",
  );
  const privatePhoto = await ingest(
    db,
    c,
    arrivals[0],
    Readable.from(image),
    "privee.jpg",
    true,
  );
  const config = {
    ...gazetteDefaults("2026-10"),
    title: "  Les nouvelles du refuge  ",
    keyDates: [
      {
        id: id(),
        date: "2026-10-31",
        time: "15:00",
        title: "Rencontres d’Halloween",
        category: "open_day",
        location: "Refuge de Morée",
        description: "Des promenades et de beaux portraits.",
      },
    ],
  };
  const start = await app.inject({
    method: "POST",
    url: "/api/creative/gazette",
    headers: u.headers,
    payload: config,
  });
  assert.equal(start.statusCode, 202, start.body);
  const job = await wait(app, u.headers, start.json().id);
  assert.equal(job.state, "done", JSON.stringify(job));
  assert.equal(job.result.arrivals, 8);
  assert.equal(
    JSON.stringify(canonicalGazette(config)),
    JSON.stringify(canonicalGazette(job.result.config)),
    "Server text trimming must not mark a freshly generated edition as modified",
  );
  assert.equal(job.result.adoptions, 1);
  assert.equal(job.result.keyDates, 1);
  assert.equal(job.errors.length, 1);
  assert.equal(job.errors[0].name, "Sans portrait");
  assert.equal(job.result.pages, 6);
  const base = `/api/creative/gazette/${job.id}`;
  const pdf = await app.inject({ url: base + "/file", headers: u.headers });
  assert.equal(pdf.statusCode, 200, pdf.body);
  assert.equal((await PDFDocument.load(pdf.rawPayload)).getPageCount(), 6);
  const social = await app.inject({
      url: base + "/social",
      headers: u.headers,
    }),
    meta = await sharp(social.rawPayload).metadata();
  assert.equal(social.statusCode, 200);
  assert.equal(meta.width, 1080);
  assert.equal(meta.height, 1350);
  assert.equal(meta.format, "png");
  const jpg = await app.inject({ url: base + "/image/0", headers: u.headers }),
    jp = await sharp(jpg.rawPayload).metadata();
  assert.equal(jp.format, "jpeg");
  assert.equal(jp.width, 1240);
  assert.equal(jp.height, 1754);
  const zip = await app.inject({ url: base + "/images", headers: u.headers });
  assert.equal(zip.statusCode, 200, zip.body);
  const files = await zipEntries(zip.rawPayload);
  assert.equal(files.filter((n) => n.endsWith(".jpg")).length, 6);
  assert.equal(files.filter((n) => n.endsWith(".png")).length, 1);
  for (const suffix of ["/file", "/social", "/images", "/image/0"]) {
    assert.equal((await app.inject({ url: base + suffix })).statusCode, 401);
    assert.equal(
      (await app.inject({ url: base + suffix, headers: other.headers }))
        .statusCode,
      404,
    );
  }
  assert.equal(
    (await app.inject({ url: base + "/image/99", headers: u.headers }))
      .statusCode,
    404,
  );
  assert.ok(requests >= 8);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos").get().n, 1);
  assert.equal(
    db.prepare("SELECT hidden FROM photos WHERE id=?").get(privatePhoto.id)
      .hidden,
    1,
  );
});
test("gazette catalogue includes archived animals and only public photo references for creators", async (t) => {
  const { app, db } = await fixture(t),
    u = await login(app, "volunteer"),
    reader = await login(app, "viewer"),
    aid = animal(db, "Ancien compagnon");
  spa(db, aid);
  db.prepare("UPDATE animals SET archived_at=? WHERE id=?").run(now(), aid);
  const r = await app.inject({
    url: "/api/creative/gazette/catalogue?q=Ancien",
    headers: u.headers,
  });
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().items[0].id, aid);
  assert.equal(r.json().items[0].archived, true);
  assert.ok(r.json().items[0].preview);
  assert.equal("description" in r.json().items[0], false);
  assert.equal(
    (
      await app.inject({
        url: "/api/creative/gazette/catalogue",
        headers: reader.headers,
      })
    ).statusCode,
    403,
  );
});
test("WhatsApp sharing prepares a real file before the click, uses native sharing and never substitutes a private server link", async () => {
  const job = { id: id(), result: { month: "2026-10" } },
    descriptor = gazetteFileDescriptor(job, "social");
  let fetched, shared;
  const file = await prepareGazetteFile(descriptor, {
    fetcher: async (url, options) => {
      fetched = { url, options };
      return new Response(
        new Blob(["example PNG bytes"], { type: "image/png" }),
      );
    },
  });
  assert.equal(file.name, "gazette-2026-10-reseaux.png");
  assert.equal(file.type, "image/png");
  assert.equal(fetched.options.credentials, "same-origin");
  const nav = {
    canShare: ({ files }) => files[0] === file,
    share: (data) => {
      shared = data;
      return Promise.resolve();
    },
  };
  assert.equal(canShareGazette(file, nav), true);
  await shareGazette(file, "La gazette du refuge", nav);
  assert.equal(shared.files[0], file);
  assert.equal(shared.text, "La gazette du refuge");
  assert.equal("url" in shared, false);
  assert.equal(canShareGazette(file, {}), false);
  assert.throws(() => shareGazette(file, "Texte", {}), /Téléchargez/);
  const cancel = {
    canShare: () => true,
    share: () =>
      Promise.reject(Object.assign(Error("Cancelled"), { name: "AbortError" })),
  };
  await assert.rejects(
    () => shareGazette(file, "Texte", cancel),
    (e) => e.name === "AbortError",
  );
  await assert.rejects(
    () =>
      prepareGazetteFile(descriptor, {
        fetcher: async () =>
          new Response(new Blob(["HTML"], { type: "text/html" })),
      }),
    /fichier attendu/,
  );
  assert.match(gazetteFileDescriptor(job, "pdf").url, /\/file$/);
  assert.match(gazetteFileDescriptor(job, "page", 3).url, /\/image\/3$/);
});
