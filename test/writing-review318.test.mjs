import { test } from "node:test";
import assert from "node:assert/strict";
import * as writing from "../shared/writing-corrections.mjs";

// These sessions drive the same correction actions as the editor: a refusal
// must survive another edit, and applying pending suggestions must keep facts
// that the volunteer has entered since generation.
test("an ignored correction stays ignored when an earlier application shifts it", () => {
  let review = writing.createWritingReview(
    "Un  chien très  calme.",
    "Un chien très calme.",
  );
  const [first, second] = review.issues;
  review = writing.resolveWritingCorrection(review, second.id, "ignore");
  review = writing.resolveWritingCorrection(review, first.id, "apply");
  assert.equal(review.text, "Un chien très  calme.");
  assert.equal(
    review.issues.find((issue) => issue.id === second.id).status,
    "ignored",
  );
  assert.equal(
    review.issues.filter((issue) => issue.status === "pending").length,
    0,
  );
  assert.equal(
    writing.applyWritingCorrections(review).text,
    "Un chien très  calme.",
  );
});

test("apply all keeps manual additions and only changes remaining suggestions", () => {
  let review = writing.createWritingReview(
    "Un  chien très  calme.",
    "Un chien très calme.",
  );
  const ignored = review.issues[1].id;
  review = writing.resolveWritingCorrection(review, ignored, "ignore");
  review = writing.updateWritingReview(
    review,
    "Un  chien très  calme. À rencontrer au refuge.",
  );
  review = writing.applyWritingCorrections(review);
  assert.equal(review.text, "Un chien très  calme. À rencontrer au refuge.");
  assert.equal(
    review.issues.find((issue) => issue.id === ignored).status,
    "ignored",
  );
});

test("an edit touching a suggestion invalidates it instead of undoing the volunteer's words", () => {
  let review = writing.createWritingReview(
    "Un chien acceuil au refuge.",
    "Un chien accueil au refuge.",
  );
  review = writing.updateWritingReview(review, "Un chien accueilli au refuge.");
  assert.equal(review.issues[0].status, "invalidated");
  assert.equal(
    writing.applyWritingCorrections(review).text,
    "Un chien accueilli au refuge.",
  );
});

test("manual insertion before a correction remaps its position and preserves Unicode", () => {
  let review = writing.createWritingReview(
    "Été : un  chien.",
    "Été : un chien.",
  );
  const stableId = review.issues[0].id;
  review = writing.updateWritingReview(review, "🐾 Été : un  chien.");
  assert.equal(review.issues[0].id, stableId);
  review = writing.applyWritingCorrections(review);
  assert.equal(review.text, "🐾 Été : un chien.");
});

test("apply all supports additions, removals and paragraph changes without restoring old text", () => {
  let review = writing.createWritingReview(
    "Bonjour!\n\nUn chien calme. Fin.",
    "Bonjour !\n\nUn chien calme et doux.",
  );
  review = writing.updateWritingReview(
    review,
    "Bonjour!\n\nUn chien calme. Fin.\n\nÀ vérifier avec l’équipe.",
  );
  review = writing.applyWritingCorrections(review);
  assert.equal(
    review.text,
    "Bonjour !\n\nUn chien calme et doux.\n\nÀ vérifier avec l’équipe.",
  );
});

test("local checks also retain refusals across edits and discover newly typed repetitions", () => {
  let review = writing.createWritingReview("Un  chien très  calme.", null);
  const ignored = review.issues[1].id;
  review = writing.resolveWritingCorrection(review, ignored, "ignore");
  review = writing.resolveWritingCorrection(
    review,
    review.issues[0].id,
    "apply",
  );
  review = writing.updateWritingReview(
    review,
    "Un chien très  calme. Le le refuge.",
  );
  assert.equal(
    review.issues.find((issue) => issue.id === ignored).status,
    "ignored",
  );
  const pending = review.issues.filter((issue) => issue.status === "pending");
  assert.equal(pending.length, 1);
  assert.equal(pending[0].before, "Le le");
});

test("typing at a suggested insertion invalidates it without overwriting the insertion", () => {
  let review = writing.createWritingReview("Bonjour!", "Bonjour !");
  review = writing.updateWritingReview(review, "Bonjour🐾!");
  assert.equal(review.issues[0].status, "invalidated");
  assert.equal(writing.applyWritingCorrections(review).text, "Bonjour🐾!");
});
