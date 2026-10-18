import {
  collectorConfig,
  collectInventory,
  guardInventory,
} from "./source-collect.mjs";
import { collectorIO } from "./source-request.mjs";
import * as cheerio from "cheerio";
import { inventoryComparison } from "./source-presence.mjs";
function safeURL(value) {
  const url = new URL(value);
  for (const key of url.searchParams.keys())
    if (!["api", "establishment", "species", "paged", "seed"].includes(key))
      url.searchParams.set(key, "…");
  return url.href;
}
export async function diagnoseSource(db, input, dependencies = {}) {
  const cfg = collectorConfig(input),
    started = Date.now(),
    checks = [];
  let apiRequested = false;
  const deps = {
    ...dependencies,
    deadline: started + cfg.sourceMaxDurationSeconds * 1000,
    onCheck: (c) => {
      if (
        cfg.sourceMode === "spa" &&
        c.stage === "http" &&
        new URL(c.url).pathname === new URL(cfg.spaApiUrl).pathname
      )
        apiRequested = true;
      if (checks.length < 24) checks.push({ ...c, url: safeURL(c.url) });
    },
  };
  const io = collectorIO(cfg, deps);
  deps.io = io;
  const report = {
    testedAt: new Date().toISOString(),
    mode: cfg.sourceMode,
    status: "unconfigured",
    checks,
    requests: 0,
    animalsFound: 0,
    applied: false,
    configuration: {
      attempts: cfg.sourceAttempts,
      species: cfg.sourceSpecies,
      maxRequests: cfg.sourceMaxRequests,
      maxPages: cfg.sourceMaxPages,
      timeoutSeconds: cfg.sourceTimeoutSeconds,
      delayMs: cfg.sourceDelayMs,
      maxDurationSeconds: cfg.sourceMaxDurationSeconds,
      refugeSlug: cfg.spaRefugeSlug,
      scope: cfg.sourceScope,
      robotsPolicy: cfg.sourceRobotsPolicy,
    },
    message: "",
    nextSteps: [],
    preview: [],
  };
  if (cfg.sourceMode === "spa") {
    try {
      const text = await io.read(cfg.spaRefugeUrl),
        $ = cheerio.load(text);
      const animalLinks = new Set(
        $('a[href*="/animal/"]')
          .map((i, e) => $(e).attr("href"))
          .get(),
      ).size;
      report.publicPage = {
        url: cfg.spaRefugeUrl,
        bytes: Buffer.byteLength(text),
        title: $("title").text().slice(0, 150),
        animalLinks,
        javascriptApp: !!$("#root").length || /static\/js\//.test(text),
      };
      checks.push({
        stage: "page",
        url: cfg.spaRefugeUrl,
        status: animalLinks ? "ok" : "warning",
        message: `${animalLinks} lien(s) animal dans le HTML serveur${report.publicPage.javascriptApp ? " · application JavaScript" : ""}. Cette page d’accueil ne prouve pas un inventaire complet.`,
      });
    } catch (e) {
      report.publicPageError = e.message;
    }
  }
  try {
    const collected = await collectInventory(cfg, deps);
    report.animalsFound = collected.animals.length;
    report.stable = collected.stable;
    report.counts = collected.counts;
    report.validAttempts = collected.validAttempts;
    report.expectedCount = collected.expectedCount;
    const checked = guardInventory(db, collected, cfg);
    report.status = checked.complete ? "complete" : "partial";
    report.animalsKept = checked.animals.length;
    report.archiveSafe = checked.absenceSafe;
    report.protection = checked.protection;
    if (checked.complete && checked.absenceSafe)
      report.sourceIds = checked.animals.map((a) => a.sourceId);
    report.reconciliation = inventoryComparison(db, checked);
    report.synchronizationRequired =
      report.reconciliation.missing.length > 0 ||
      report.reconciliation.new.length > 0;
    report.preview = checked.animals
      .slice(0, 8)
      .map((a) => ({ sourceId: a.sourceId, name: a.name, species: a.species }));
    report.message = checked.complete
      ? "Inventaire complet et stable reçu. Le test n’a modifié aucune fiche."
      : "Des fiches sont récupérables, mais l’inventaire complet n’est pas confirmé. Aucun archivage autorisé.";
    report.failures = collected.failures || [];
  } catch (e) {
    report.status =
      e.code === "ROBOTS_DENIED"
        ? "blocked"
        : e.code === "UNCONFIGURED"
          ? "unconfigured"
          : "error";
    report.stopReason = e.code || "SOURCE_ERROR";
    report.message =
      e.code === "ROBOTS_DENIED"
        ? apiRequested
          ? "Anipic a arrêté la collecte sur une route exclue par robots.txt. Votre navigateur peut afficher le site normalement."
          : "Anipic a arrêté la collecte avant d’interroger cette API : son chemin est exclu par robots.txt. Votre navigateur peut afficher le site normalement."
        : e.message;
    if (e.code === "ROBOTS_DENIED")
      report.nextSteps.push(
        "Choisir « API publique SPA · lecture directe » pour interroger cette route, ou raccorder un export JSON du refuge.",
      );
    if (cfg.sourceMode === "spa" || e.code === "JS_REQUIRED")
      report.nextSteps.push(
        "Le navigateur exécute le JavaScript et charge les fiches ensuite. Le collecteur reçoit la page HTML initiale puis applique les règles de collecte automatisée.",
      );
    checks.push({
      stage: "inventory",
      status: "error",
      message:
        e.code === "ROBOTS_DENIED"
          ? apiRequested
            ? "Collecte interrompue sur une route exclue par robots.txt. Aucune fiche modifiée."
            : "Collecte arrêtée avant la requête d’inventaire. Aucune fiche modifiée."
          : e.message,
    });
  }
  if (cfg.sourceMode === "spa") report.apiRequested = apiRequested;
  report.durationMs = Date.now() - started;
  report.requests = io.requests();
  return report;
}
