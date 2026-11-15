import { test } from "node:test";
import assert from "node:assert/strict";
import * as audience from "../shared/audience.mjs";

test("an opposition saved in another tab wins over stale loaded audience settings", () => {
  const loaded = {
    enabled: true,
    optedOut: false,
    globalPrivacyControl: false,
  };
  assert.equal(audience.audienceAllowed(loaded, "anipic_audience_off=0"), true);
  assert.equal(
    audience.audienceAllowed(loaded, "theme=night; anipic_audience_off=1"),
    false,
  );
  assert.equal(
    audience.audienceAllowed({ ...loaded, optedOut: true }, ""),
    false,
  );
  assert.equal(audience.audienceAllowed(loaded, "", true), false);
  assert.equal(
    audience.audienceAllowed({ ...loaded, enabled: false }, ""),
    false,
  );
});

test("sync tracking releases a missing job without inventing success and follows running sync only", async () => {
  const module = await import("../shared/sync-job-state.mjs").catch(() => null);
  assert.equal(
    typeof module?.syncJobState,
    "function",
    "sync tracking state helper is available",
  );
  const derive = module.syncJobState;
  assert.equal(derive([], null).state, "idle");
  assert.equal(
    derive([{ id: "other", kind: "backup", state: "running" }], "gone").state,
    "missing",
  );
  const done = { id: "done", kind: "sync", state: "done" };
  assert.deepEqual(derive([done], "done"), { state: "finished", job: done });
  const running = { id: "now", kind: "sync", state: "running" };
  assert.deepEqual(derive([done, running], "done"), {
    state: "running",
    job: running,
  });
});
