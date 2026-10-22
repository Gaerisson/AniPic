import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { fixture, animal } from "./helpers.mjs";
import { id, saveSettings } from "../server/db.mjs";
import { normalizeSnapshot, synchronize } from "../server/source.mjs";
import {
  publicCompatibility,
  compatibilityFromText,
} from "../server/animal-facts.mjs";
import { compatibilityState } from "../shared/compatibility-text.mjs";
import { sourceHealth } from "../server/source-health.mjs";
import { ingest } from "../server/storage.mjs";
import path from "node:path";

const longGuidance =
  "Oui si les enfants respectent son espace et les conseils du refuge. "
    .repeat(250)
    .trim();

test("long SPA compatibility guidance is preserved through structured, legacy and labelled normalization without a per-field cutoff", () => {
  assert.ok(longGuidance.length > 15000);
  const compatibility = { enfant: longGuidance, chat: "Oui", chien: "Non" };
  const base = {
    sourceId: "spa:20032",
    name: "Nala",
    species: "dog",
    compatibility,
  };
  const structured = normalizeSnapshot({ schemaVersion: 1, animals: [base] });
  assert.deepEqual(structured.animals[0].compatibility, compatibility);
  const legacy = normalizeSnapshot({
    dog_list: { 20032: { id: 20032, name: "Nala", entente: compatibility } },
  });
  assert.deepEqual(legacy.animals[0].compatibility, compatibility);
  const labelled = compatibilityFromText(
    `Entente enfant : ${longGuidance} - Entente chat : Oui - Entente chien : Non`,
  );
  assert.deepEqual(labelled, compatibility);
  const fallback = normalizeSnapshot({
    dog_list: {
      20032: {
        id: 20032,
        name: "Nala",
        description_entente: `Enfant : ${longGuidance}`,
      },
    },
  });
  assert.equal(fallback.animals[0].compatibility.enfant, longGuidance);
  assert.equal(
    fallback.animals[0].metadata.descriptionEntente,
    `Enfant : ${longGuidance}`,
  );
  assert.deepEqual(
    publicCompatibility(structured.animals[0].compatibility),
    compatibility,
  );
  assert.equal(compatibilityState(compatibility.enfant), "conditional");
  assert.equal(compatibilityState(compatibility.chat), "yes");
  assert.equal(compatibilityState(compatibility.chien), "no");
  assert.throws(() =>
    normalizeSnapshot({
      schemaVersion: 1,
      animals: [{ ...base, compatibility: ["Oui"] }],
    }),
  );
});

test("75-animal SPA synchronization accepts long child guidance, restores a reliable inventory and preserves photos and absence protections", async (t) => {
  const { app, db, c } = await fixture(t);
  const localId = animal(db, "Nala");
  db.prepare(
    "UPDATE animals SET source_id='spa:20032',source_scope='spa:moree' WHERE id=?",
  ).run(localId);
  const image = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "orange" },
  })
    .jpeg()
    .toBuffer();
  const photo = await ingest(
    db,
    c,
    localId,
    Readable.from(image),
    "portrait.jpg",
  );
  const photoBefore = db
    .prepare("SELECT * FROM photos WHERE id=?")
    .get(photo.id);
  saveSettings(db, {
    sourceMode: "spa",
    sourceAttempts: 3,
    archiveMissing: true,
    missingThreshold: 1,
  });
  const old = new Date(Date.now() - 10000).toISOString();
  db.prepare(
    "INSERT INTO jobs(id,kind,state,detail,created_at,finished_at) VALUES (?,?,?,?,?,?)",
  ).run(id(), "sync", "failed", "previous compatibility too_big", old, old);
  assert.equal(sourceHealth(db).state, "error");
  let partial = false,
    requests = 0;
  const transport = {
    checkRobots: async () => {},
    delay: async () => {},
    fetchText: async (url) => {
      requests++;
      const species = new URL(url).searchParams.get("species");
      const [start, count] =
        species === "chien"
          ? [20000, 33]
          : species === "chat"
            ? [30000, 41]
            : [40000, 1];
      const animals = Array.from({ length: count }, (_, index) => ({
        id: start + index,
        name: start + index === 20032 ? "Nala" : "Animal " + (start + index),
        establishment_slug: "refuge-spa-de-moree-jean-leriche",
        entente: {
          enfant: start + index === 20032 ? longGuidance : "À tester",
          chat: "Oui",
          chien: "Non",
        },
      })).filter((value) => !partial || value.id !== 20032);
      return JSON.stringify({ max_num_pages: 1, total: count, animals });
    },
  };
  const synced = await synchronize(db, transport);
  assert.equal(requests, 9);
  assert.equal(synced.complete, true);
  assert.equal(synced.failures.length, 0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM animals").get().n, 75);
  assert.equal(
    JSON.parse(
      db.prepare("SELECT compatibility FROM animals WHERE id=?").get(localId)
        .compatibility,
    ).enfant,
    longGuidance,
  );
  const publicAnimal = (
    await app.inject({ url: "/api/animals/" + localId })
  ).json();
  assert.equal(publicAnimal.compatibility.enfant, longGuidance);
  const health = sourceHealth(db);
  assert.equal(health.state, "ok");
  assert.equal(health.localCount, 75);
  assert.equal(health.sourceCount, 75);
  assert.deepEqual(
    db.prepare("SELECT * FROM photos WHERE id=?").get(photo.id),
    photoBefore,
  );
  assert.deepEqual(
    await readFile(path.join(c.mediaDir, photoBefore.hash)),
    image,
  );
  partial = true;
  const incomplete = await synchronize(db, transport);
  assert.equal(incomplete.complete, false);
  assert.equal(incomplete.absenceCheck, false);
  assert.equal(incomplete.archived, 0);
  const preserved = db
    .prepare("SELECT archived_at,missing_count FROM animals WHERE id=?")
    .get(localId);
  assert.equal(preserved.archived_at, null);
  assert.equal(preserved.missing_count, 0);
  assert.deepEqual(
    db.prepare("SELECT * FROM photos WHERE id=?").get(photo.id),
    photoBefore,
  );
});
