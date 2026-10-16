import { test } from "node:test";
import assert from "node:assert/strict";
import { sourceStatus } from "../server/source-status.mjs";
import { normalizeSnapshot } from "../server/source.mjs";
import { collectSpa } from "../server/spa-collector.mjs";
test("source statuses accept explicit SPA labels and do not treat string false as a reservation", () => {
  assert.equal(sourceStatus({ statut: "Réservée" }), "reserved");
  assert.equal(sourceStatus({ status: "ADOPTÉ" }), "adopted");
  assert.equal(sourceStatus({ is_reserved: "oui" }), "reserved");
  assert.equal(sourceStatus({ reserved: "false" }), "available");
  assert.equal(
    sourceStatus({ post_title: "Nala (Réservée)", status: "publish" }),
    "reserved",
  );
  assert.equal(
    sourceStatus({ name: "Nala (Réservée)", statut: "Disponible" }),
    "available",
  );
  assert.equal(sourceStatus({ name: "Réserve" }), "available");
  assert.equal(
    sourceStatus({ reserved: 0, status: "Disponible" }),
    "available",
  );
  assert.equal(
    sourceStatus({ status: "publish", statut: "Réservé" }),
    "reserved",
  );
  assert.equal(sourceStatus({ reserved: true, status: "adopted" }), "adopted");
  assert.throws(
    () => sourceStatus({ status: "source_missing" }),
    /Statut animal source inconnu/,
  );
});
test("historical imports preserve homonyms and take status from SPA detail records", () => {
  const result = normalizeSnapshot({
    dog_list: {
      first: { id: 10, name: "Nala", details: { statut: "Réservé" } },
      second: { id: 11, name: "Nala", status: "Adopté" },
      third: { id: 12, name: "Milo", reserved: "false" },
    },
  });
  assert.deepEqual(
    result.animals.map((a) => [a.sourceId, a.status]),
    [
      ["spa:10", "reserved"],
      ["spa:11", "adopted"],
      ["spa:12", "available"],
    ],
  );
  assert.equal(result.complete, false);
});
test("SPA paginated adapter retains explicit reserved status across stable passes", async () => {
  const result = await collectSpa({
    config: { sourceSpecies: ["dog"], sourceAttempts: 2 },
    checkRobots: async () => {},
    delay: async () => {},
    fetchText: async () =>
      JSON.stringify({
        max_num_pages: 1,
        total: 1,
        animals: [
          {
            ID: 10,
            name: "Nala",
            establishment_slug: "refuge-spa-de-moree-jean-leriche",
            statut: "Réservé",
          },
        ],
      }),
  });
  assert.equal(result.animals[0].status, "reserved");
  assert.equal(result.complete, true);
});
