import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FPS,
  CROSSFADE,
  filmDuration,
  filmTimeline,
  moveFilmClip,
} from "../video/timing.mjs";
const sources = [
  { id: "a", kind: "photo", seconds: 4 },
  { id: "b", kind: "video", seconds: 2, trim: 3 },
  { id: "c", kind: "spa", seconds: 5 },
];

test("manual films retain every clip, their durations and crossfades", () => {
  const film = { clips: sources, introSeconds: 2, outroSeconds: 1 };
  const timeline = filmTimeline(film);
  assert.equal(timeline.duration, (2 + 1 + 4 + 2 + 5) * FPS - 2 * CROSSFADE);
  assert.deepEqual(
    timeline.scenes.map((s) => s.from),
    [48, 132, 168],
  );
  assert.equal(timeline.auto, false);
});

test("automatic timing covers the entire voice with exact frames, varied shots and unchanged source media", () => {
  const film = {
    clips: sources,
    introSeconds: 2,
    outroSeconds: 2,
    voiceover: { start: 1.25, duration: 37.34 },
  };
  const before = structuredClone(film),
    timeline = filmTimeline(film);
  assert.equal(timeline.duration, Math.ceil(38.59 * FPS));
  assert.ok(timeline.repeated > 0);
  assert.deepEqual(film, before);
  assert.equal(
    timeline.scenes.at(-1).from +
      timeline.scenes.at(-1).duration +
      timeline.outro,
    timeline.duration,
  );
  for (const scene of timeline.scenes) {
    assert.ok(scene.duration > scene.overlap);
    assert.ok(scene.duration <= (scene.clip.kind === "video" ? 2 : 6) * FPS);
    if (scene.clip.kind === "video") assert.equal(scene.clip.trim, 3);
  }
  assert.deepEqual(filmTimeline(film), timeline);
});

test("short voices shorten the opening and closing, and report sources omitted from the actual montage", () => {
  const film = {
    clips: sources,
    introSeconds: 8,
    outroSeconds: 8,
    voiceover: { start: 0, duration: 0.2 },
  };
  const timeline = filmTimeline(film);
  assert.equal(timeline.duration, 5);
  assert.equal(timeline.omitted, 2);
  assert.equal(timeline.scenes.length, 1);
  assert.equal(
    timeline.scenes[0].from + timeline.scenes[0].duration + timeline.outro,
    5,
  );
});

test("video-only films can revisit excerpts without reading beyond the trimmed source", () => {
  const film = {
    clips: [{ kind: "video", seconds: 1, trim: 9 }],
    introSeconds: 0,
    outroSeconds: 0,
    voiceover: { start: 2, duration: 19.03 },
  };
  const timeline = filmTimeline(film);
  assert.ok(timeline.repeated > 0);
  assert.ok(
    timeline.scenes.every((s) => s.duration <= FPS && s.clip.trim === 9),
  );
  assert.equal(
    timeline.scenes.at(-1).from + timeline.scenes.at(-1).duration,
    Math.ceil(21.03 * FPS),
  );
});

test("voice changes, offsets and manual opt-out recompute timing without cumulative drift", () => {
  for (const count of [1, 3, 12, 100])
    for (const duration of [0.04, 0.3, 1, 2.53, 7, 61.1, 598]) {
      const film = {
        clips: Array.from({ length: count }, (_, i) => ({
          ...sources[i % 3],
          seconds: 1 + (i % 12),
        })),
        voiceover: { start: 1, duration },
      };
      const timeline = filmTimeline(film);
      assert.equal(
        timeline.scenes.at(-1).from +
          timeline.scenes.at(-1).duration +
          timeline.outro,
        Math.ceil((duration + 1) * FPS),
      );
      assert.ok(
        timeline.scenes.every(
          (s) =>
            Number.isInteger(s.from) &&
            Number.isInteger(s.duration) &&
            s.duration > 0,
        ),
      );
      assert.equal(
        filmTimeline({ ...film, narrationMode: "manual" }).auto,
        false,
      );
    }
  assert.equal(
    filmDuration({ clips: sources, voiceover: { duration: NaN } }),
    filmDuration({ clips: sources }),
  );
});

test("annual mosaic timeline matches its portrait phase and final statistics", () => {
  const film = {
    template: "year",
    annualStyle: "mosaic",
    clips: sources.filter((c) => c.kind !== "video"),
    voiceover: { start: 0, duration: 20 },
  };
  const timeline = filmTimeline(film);
  assert.equal(timeline.intro, 0);
  assert.equal(timeline.outro, 480 - Math.floor(480 * 0.68));
  assert.equal(
    timeline.scenes.at(-1).from +
      timeline.scenes.at(-1).duration +
      timeline.outro,
    timeline.duration,
  );
  assert.equal(timeline.repeated, 0);
});

test("timeline drag and keyboard moves preserve source identity and reject out-of-range targets", () => {
  const moved = moveFilmClip(sources, 0, 2);
  assert.deepEqual(
    moved.map((c) => c.id),
    ["b", "c", "a"],
  );
  assert.equal(moved[2], sources[0]);
  assert.equal(moveFilmClip(sources, 0, -1), sources);
  assert.equal(moveFilmClip(sources, 2, 3), sources);
  assert.deepEqual(
    sources.map((c) => c.id),
    ["a", "b", "c"],
  );
});
