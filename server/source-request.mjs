import { boundedFetch, respectRobots } from "./source.mjs";
export function collectorIO(cfg, deps = {}) {
  const fetchText = deps.fetchText || boundedFetch,
    checkRobots = deps.checkRobots || respectRobots;
  const delay = deps.delay || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const started = Date.now(),
    deadline = Math.min(
      deps.deadline || Infinity,
      started + cfg.sourceMaxDurationSeconds * 1000,
    );
  let requests = 0;
  const remaining = () => {
    const left = deadline - Date.now();
    if (left <= 0)
      throw Object.assign(new Error("Durée maximale de collecte atteinte."), {
        code: "BUDGET",
      });
    return Math.min(left, cfg.sourceTimeoutSeconds * 1000);
  };
  const check = async (url) => {
    const target = new URL(url);
    if (
      cfg.sourceMode === "spa" &&
      cfg.sourceRobotsPolicy === "spa_public_api" &&
      target.origin === "https://www.la-spa.fr" &&
      target.pathname === "/app/wp-json/spa/v1/animals/search/"
    ) {
      deps.onCheck?.({
        stage: "robots",
        url,
        status: "info",
        message:
          "Mode API publique choisi : requête JSON directe, limitée au refuge et au budget configuré.",
      });
      return;
    }
    try {
      await checkRobots(url, { timeoutMs: remaining() });
      deps.onCheck?.({
        stage: "robots",
        url,
        status: "ok",
        message: "Route autorisée par robots.txt.",
      });
    } catch (e) {
      deps.onCheck?.({
        stage: "robots",
        url,
        status: "error",
        message: e.message,
      });
      throw e;
    }
  };
  const read = async (url) => {
    if (requests >= cfg.sourceMaxRequests)
      throw Object.assign(new Error("Budget de requêtes atteint."), {
        code: "BUDGET",
      });
    if (requests) {
      if (deadline - Date.now() <= cfg.sourceDelayMs)
        throw Object.assign(new Error("Durée maximale de collecte atteinte."), {
          code: "BUDGET",
        });
      await delay(cfg.sourceDelayMs);
    }
    await check(url);
    requests++;
    try {
      const text = await fetchText(url, cfg.sourceMaxResponseMB * 1024 ** 2, {
        timeoutMs: remaining(),
      });
      deps.onCheck?.({
        stage: "http",
        url,
        status: "ok",
        message: `Réponse reçue · ${Buffer.byteLength(text)} octets.`,
      });
      return text;
    } catch (e) {
      deps.onCheck?.({
        stage: "http",
        url,
        status: "error",
        message: e.message,
      });
      throw e;
    }
  };
  return {
    read,
    check,
    requests: () => requests,
    elapsed: () => Date.now() - started,
  };
}
