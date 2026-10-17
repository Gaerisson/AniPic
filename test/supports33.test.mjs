import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { fixture, login, animal } from "./helpers.mjs";
import {
  publicCompatibility,
  compatibilityFromText,
} from "../server/animal-facts.mjs";
import { normalizeCompatibility } from "../shared/compatibility-text.mjs";
import { compatibilityLabels } from "../video/facts.mjs";
test("SPA picture can produce a single box poster, a social visual and video preview without a local original", async (t) => {
  const image = await sharp({
    create: { width: 600, height: 800, channels: 3, background: "#bc7439" },
  })
    .jpeg()
    .toBuffer();
  const { app, db } = await fixture(t, { spaPhotoFetcher: async () => image }),
    admin = await login(app),
    id = animal(db);
  db.prepare("UPDATE animals SET source_metadata=? WHERE id=?").run(
    JSON.stringify({
      thumbnail: "https://www.la-spa.fr/app/uploads/animals/fixture.jpg",
    }),
    id,
  );
  const poster = await app.inject({
    method: "POST",
    url: `/api/animals/${id}/poster`,
    headers: admin.headers,
    payload: { photoId: "spa", format: "png" },
  });
  assert.equal(poster.statusCode, 200, poster.body.slice(0, 120));
  assert.equal((await sharp(poster.rawPayload).metadata()).width, 2480);
  const social = await app.inject({
    url: `/api/animals/${id}/presentation?photoId=spa&preview=1`,
    headers: admin.headers,
  });
  assert.equal(social.statusCode, 200);
  assert.equal((await sharp(social.rawPayload).metadata()).width, 540);
  const preview = await app.inject({
    method: "POST",
    url: "/api/video/preview",
    headers: admin.headers,
    payload: {
      title: "Référence SPA",
      clips: [{ kind: "spa", ref: id, seconds: 3 }],
    },
  });
  assert.equal(preview.statusCode, 200, preview.body);
  assert.equal(preview.json().clips[0].sourcePhoto, true);
  assert.match(preview.json().clips[0].src, /source-photo/);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM blobs").get().n, 0);
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: `/api/animals/${id}/poster`,
        payload: { photoId: "spa" },
      })
    ).statusCode,
    401,
  );
});
test("labelled compatibilities do not absorb the following subject and preserve qualified children guidance", () => {
  const raw =
    "Entente Chats : Oui - Entente chien : oui - Entente enfant : Nous éviterons les enfants en bas âge. Tous les membres doivent être présents.";
  const parsed = compatibilityFromText(raw);
  assert.equal(parsed.chat, "Oui");
  assert.equal(parsed.chien, "oui");
  assert.match(parsed.enfant, /bas âge/);
  assert.equal(Object.keys(parsed).length, 3);
  const old = {
    chat: "Oui - Entente chien : oui - Entente enfant : Nous éviterons les enfants en bas âge.",
  };
  assert.equal(normalizeCompatibility(old).chat, "Oui");
  assert.equal(compatibilityLabels(old).length, 3);
  assert.deepEqual(compatibilityFromText("Sociable mais pas encore testé"), {});
  assert.deepEqual(
    compatibilityFromText(
      "Entente chat ; oui - Entente chien : ..... - Entente enfant ; oui . Tous les membres du foyer doivent être présents",
    ),
    { chat: "oui", enfant: "oui ." },
  );
  assert.equal(
    publicCompatibility(
      { chat: "Oui - Entente chien" },
      "Entente chat : Oui - Entente chien ; ........ Entente enfant : Oui si habitué aux chats",
    ).chat,
    "Oui",
  );
});
test("admin journal records errors without request secrets; archives expose species/year folders", async (t) => {
  const { app, db } = await fixture(t),
    admin = await login(app),
    viewer = await login(app, "viewer"),
    id = animal(db);
  db.prepare(
    "UPDATE animals SET archived_at='2024-03-01T12:00:00Z',departed_at='2024-03-01T12:00:00Z' WHERE id=?",
  ).run(id);
  assert.deepEqual((await app.inject({ url: "/api/archive/folders" })).json(), [
    { species: "dog", year: 2024, count: 1 },
  ]);
  await app.inject({
    method: "POST",
    url: `/api/animals/${id}/poster?secret=never-log-me`,
    headers: admin.headers,
    payload: { photoId: "bad-secret-data" },
  });
  const journal = await app.inject({
    url: "/api/admin/journal?kind=errors",
    headers: admin.headers,
  });
  assert.equal(journal.statusCode, 200);
  assert.equal(journal.body.includes("never-log-me"), false);
  assert.equal(journal.body.includes("bad-secret-data"), false);
  assert.ok(journal.json().some((r) => r.status === 400));
  assert.equal(
    (await app.inject({ url: "/api/admin/journal", headers: viewer.headers }))
      .statusCode,
    403,
  );
});
