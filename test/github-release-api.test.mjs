import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createReleaseApi,
  findRelease,
} from "../scripts/github-release-api.mjs";

const context = { repository: "Gaerisson/AniPic", token: "fixture-token" };

test("release API recovers an expired socket with a fresh connection and bounded backoff", async () => {
  const calls = [],
    delays = [];
  const api = createReleaseApi({
    ...context,
    sleep: async (ms) => delays.push(ms),
    fetcher: async (url, options) => {
      calls.push({ url, options });
      if (calls.length === 1) throw TypeError("fetch failed: socket closed");
      return Response.json({ id: 42 });
    },
  });
  assert.deepEqual(await api("releases/42"), { id: 42 });
  assert.equal(calls.length, 2);
  assert.deepEqual(delays, [1000]);
  assert.ok(calls.every((c) => c.options.headers.Connection === "close"));
  assert.equal(
    calls[0].url,
    "https://api.github.com/repos/Gaerisson/AniPic/releases/42",
  );
});

test("release publication PATCH retries transient responses with the identical payload", async () => {
  const payloads = [],
    delays = [];
  const api = createReleaseApi({
    ...context,
    sleep: async (ms) => delays.push(ms),
    fetcher: async (_, options) => {
      payloads.push(options.body);
      if (payloads.length === 1)
        return new Response("busy", {
          status: 503,
          headers: { "retry-after": "2" },
        });
      return Response.json({ draft: false });
    },
  });
  assert.deepEqual(
    await api("releases/42", {
      method: "PATCH",
      body: { draft: false, make_latest: "true" },
    }),
    { draft: false },
  );
  assert.equal(payloads[0], payloads[1]);
  assert.deepEqual(delays, [2000]);
});

test("release API never retries a creation POST or permission denial", async () => {
  for (const scenario of [
    "post-socket",
    "post-503",
    "forbidden",
    "rate-limit",
  ]) {
    let calls = 0;
    const api = createReleaseApi({
      ...context,
      sleep: async () => assert.fail("Unexpected retry"),
      fetcher: async () => {
        calls++;
        if (scenario === "post-socket") throw TypeError("socket closed");
        return new Response("rejected", {
          status:
            scenario === "post-503"
              ? 503
              : scenario === "rate-limit"
                ? 429
                : 403,
          headers: { "retry-after": "60" },
        });
      },
    });
    await assert.rejects(
      api("releases", {
        method: scenario.startsWith("post-") ? "POST" : "GET",
        body: scenario.startsWith("post-") ? { draft: true } : undefined,
      }),
    );
    assert.equal(calls, 1, scenario);
  }
});

test("release API stops after three network failures and retries interrupted JSON bodies", async () => {
  let failures = 0;
  const delays = [];
  const unavailable = createReleaseApi({
    ...context,
    sleep: async (ms) => delays.push(ms),
    fetcher: async () => {
      failures++;
      throw TypeError("socket closed");
    },
  });
  await assert.rejects(unavailable("releases/42"), /connexion interrompue/);
  assert.equal(failures, 3);
  assert.deepEqual(delays, [1000, 2000]);
  let reads = 0;
  const partial = createReleaseApi({
    ...context,
    sleep: async () => {},
    fetcher: async () => {
      reads++;
      return reads === 1
        ? new Response('{"draft":')
        : Response.json({ draft: false });
    },
  });
  assert.deepEqual(await partial("releases/42"), { draft: false });
  assert.equal(reads, 2);
});

test("release lookup resumes an unpublished draft and paginates older releases", async () => {
  const routes = [];
  const draft = {
    id: 42,
    tag_name: "v3.13.0",
    draft: true,
    assets: [{ name: "existing.zip" }],
  };
  const found = await findRelease(async (route) => {
    routes.push(route);
    if (route.startsWith("releases/tags/")) return null;
    if (route.endsWith("page=1"))
      return Array.from({ length: 100 }, (_, n) => ({ tag_name: `v0.0.${n}` }));
    return [draft];
  }, "v3.13.0");
  assert.equal(found, draft);
  assert.deepEqual(routes, [
    "releases/tags/v3.13.0",
    "releases?per_page=100&page=1",
    "releases?per_page=100&page=2",
  ]);
});

test("release lookup keeps a published release and rejects ambiguous drafts", async () => {
  const published = { id: 42, tag_name: "v3.13.0", draft: false };
  assert.equal(await findRelease(async () => published, "v3.13.0"), published);
  await assert.rejects(
    findRelease(
      async (route) =>
        route.startsWith("releases/tags/")
          ? null
          : [published, { ...published, id: 43, draft: true }],
      "v3.13.0",
    ),
    /Plusieurs brouillons/,
  );
  assert.equal(
    await findRelease(
      async (route) => (route.startsWith("releases/tags/") ? null : []),
      "v3.13.0",
    ),
    null,
  );
});
