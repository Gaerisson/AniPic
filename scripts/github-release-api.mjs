import assert from "node:assert/strict";

// Publishing blocks the event loop while Docker uploads its layers. Closing
// each short API connection avoids reusing a socket that expired meanwhile.
// GET and PATCH can be repeated safely. A creation POST must be reconciled by
// looking up the existing draft on the next run, never repeated blindly.
export function createReleaseApi({
  repository,
  token,
  fetcher = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  assert.match(repository, /^[\w.-]+\/[\w.-]+$/);
  assert.ok(token, "Jeton GitHub manquant.");
  return async function api(
    route,
    { method = "GET", body, absent = false } = {},
  ) {
    assert.ok(!route.startsWith("/") && !route.includes(".."));
    const repeatable = method === "GET" || method === "PATCH";
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try {
        response = await fetcher(
          `https://api.github.com/repos/${repository}/${route}`,
          {
            method,
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
              "Content-Type": "application/json",
              Connection: "close",
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
            signal: AbortSignal.timeout(30000),
          },
        );
      } catch (cause) {
        if (!repeatable || attempt === 2)
          throw Error(`GitHub ${method} ${route} : connexion interrompue.`, {
            cause,
          });
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      if (absent && response.status === 404) return null;
      if (!response.ok) {
        const seconds = Number(response.headers.get("retry-after"));
        const temporary = [408, 429, 500, 502, 503, 504].includes(
          response.status,
        );
        if (repeatable && temporary && attempt < 2 && seconds <= 10) {
          await response.body?.cancel();
          await sleep(Math.max(1000 * 2 ** attempt, seconds * 1000));
          continue;
        }
        throw Error(`GitHub ${method} ${route} : HTTP ${response.status}.`);
      }
      try {
        return await response.json();
      } catch (cause) {
        if (!repeatable || attempt === 2)
          throw Error(`GitHub ${method} ${route} : réponse interrompue.`, {
            cause,
          });
        await sleep(1000 * 2 ** attempt);
      }
    }
  };
}

export async function findRelease(api, tag) {
  const published = await api(`releases/tags/${tag}`, { absent: true });
  if (published) return published;
  // GitHub's tag endpoint does not return unpublished drafts. Include them
  // explicitly so a resumed workflow retains its assets and release ID.
  for (let page = 1; ; page++) {
    const releases = await api(`releases?per_page=100&page=${page}`);
    assert.ok(Array.isArray(releases), "Liste des releases invalide.");
    const matching = releases.filter((release) => release.tag_name === tag);
    assert.ok(
      matching.length < 2,
      "Plusieurs brouillons pour ce tag : vérifier avant de publier.",
    );
    if (matching.length) return matching[0];
    if (releases.length < 100) return null;
  }
}
