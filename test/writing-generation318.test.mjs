import { test } from "node:test";
import assert from "node:assert/strict";
import * as writing from "../shared/writing-generation.mjs";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
test("a late proposal cannot fill a different animal or finish its newer generation", async () => {
  const generation = writing.createWritingGeneration(),
    old = deferred(),
    next = deferred();
  let proposal = "",
    busy = false;
  const run = (request) =>
    generation.run({
      request: () => request.promise,
      onStart: () => {
        busy = true;
      },
      onResult: (value) => {
        proposal = value;
      },
      onError: (error) => {
        throw error;
      },
      onFinish: () => {
        busy = false;
      },
    });
  const first = run(old);
  generation.invalidate();
  const second = run(next);
  old.resolve("Ancienne fiche");
  await first;
  assert.equal(proposal, "");
  assert.equal(busy, true);
  next.resolve("Nouvelle fiche");
  await second;
  assert.equal(proposal, "Nouvelle fiche");
  assert.equal(busy, false);
});
test("a rejected old request stays silent and nested result loading checks its context", async () => {
  const generation = writing.createWritingGeneration(),
    old = deferred(),
    drafts = deferred();
  let error = "",
    history = [],
    busy = false;
  const first = generation.run({
    request: () => old.promise,
    onStart: () => {
      busy = true;
    },
    onResult: () => {},
    onError: (e) => {
      error = e.message;
    },
    onFinish: () => {
      busy = false;
    },
  });
  generation.invalidate();
  old.reject(Error("Ancien contexte"));
  await first;
  assert.equal(error, "");
  const current = generation.run({
    request: async () => "Proposition",
    onStart: () => {
      busy = true;
    },
    onResult: async (_, isCurrent) => {
      const items = await drafts.promise;
      if (isCurrent()) history = items;
    },
    onError: (e) => {
      error = e.message;
    },
    onFinish: () => {
      busy = false;
    },
  });
  await Promise.resolve();
  generation.invalidate();
  busy = false;
  drafts.resolve(["Ancien historique"]);
  await current;
  assert.deepEqual(history, []);
  assert.equal(error, "");
  assert.equal(busy, false);
});
