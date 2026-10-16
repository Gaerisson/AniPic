import * as cheerio from "cheerio";
import { normalizeSnapshot, mergeSnapshots } from "./source.mjs";
import { sourceDefaults, sourceFields } from "./preferences-schema.mjs";
import { z } from "zod";
import { collectorIO } from "./source-request.mjs";
export function collectorConfig(cfg) {
  return {
    ...cfg,
    ...z.object(sourceFields).parse({ ...sourceDefaults, ...cfg }),
  };
}
export function parseInventoryHTML(text) {
  const $ = cheerio.load(text);
  const inventory = $(
    'script[type="application/ld+json"],script[type="application/json"]',
  )
    .map((i, e) => {
      try {
        return JSON.parse($(e).text());
      } catch {
        return null;
      }
    })
    .get()
    .find((v) => v?.schemaVersion === 1 && Array.isArray(v.animals));
  if (inventory) return normalizeSnapshot(inventory);
  const cards = $('[id^="animal-"]').length;
  const jsApp =
    $("#root").length || /enable JavaScript|static\/js\/|webpack/i.test(text);
  throw Object.assign(
    new Error(
      jsApp
        ? "La page est une application JavaScript : le HTML reçu ne contient pas l’inventaire des animaux."
        : cards
          ? `La page ne fournit que ${cards} cartes, sans contrat d’inventaire complet ni données de fiche vérifiables.`
          : "Aucun inventaire JSON structuré dans cette page HTML.",
    ),
    { code: jsApp ? "JS_REQUIRED" : "NO_INVENTORY" },
  );
}
export async function collectInventory(input, deps = {}) {
  const cfg = collectorConfig(input);
  if (cfg.sourceMode === "spa") {
    const { collectSpa } = await import("./spa-collector.mjs");
    return collectSpa({ ...deps, config: cfg });
  }
  if (cfg.sourceMode === "disabled" || !cfg.sourceUrl)
    throw Object.assign(
      new Error("Choisissez un connecteur et une URL de source."),
      { code: "UNCONFIGURED" },
    );
  const io = deps.io || collectorIO(cfg, deps),
    snapshots = [],
    failures = [];
  for (let attempt = 0; attempt < cfg.sourceAttempts; attempt++) {
    try {
      const text = await io.read(cfg.sourceUrl);
      const snapshot =
        cfg.sourceMode === "html"
          ? parseInventoryHTML(text)
          : normalizeSnapshot(JSON.parse(text));
      snapshots.push(snapshot);
    } catch (e) {
      failures.push(e.message);
      if (
        ["ROBOTS_DENIED", "JS_REQUIRED", "NO_INVENTORY", "BUDGET"].includes(
          e.code,
        )
      ) {
        if (!snapshots.length) throw e;
        break;
      }
    }
  }
  if (!snapshots.length)
    throw new Error(failures[0] || "Aucun inventaire valide.");
  const merged = mergeSnapshots(snapshots);
  if (failures.length) merged.complete = false;
  return {
    ...merged,
    attempts: cfg.sourceAttempts,
    validAttempts: snapshots.length,
    counts: snapshots.map((s) => s.animals.length),
    failures,
    requests: io.requests(),
    durationMs: io.elapsed(),
  };
}
export function guardInventory(db, input, cfg) {
  const species = new Set(cfg.sourceSpecies);
  const animals = input.animals.filter(
    (a) =>
      species.has(a.species) &&
      (cfg.sourceImportReserved || a.status !== "reserved"),
  );
  if (animals.length < cfg.sourceMinAnimals)
    throw new Error(
      `Seulement ${animals.length} animal(aux) retenu(s) : minimum configuré ${cfg.sourceMinAnimals}. Aucun inventaire appliqué.`,
    );
  if (!cfg.sourceAllowPartial && !input.complete)
    throw new Error(
      "Inventaire partiel refusé par votre configuration. Aucune fiche modifiée.",
    );
  const existing = db
    .prepare(
      "SELECT species,status FROM animals WHERE source_scope=? AND archived_at IS NULL",
    )
    .all(input.scope)
    .filter(
      (a) =>
        species.has(a.species) &&
        (cfg.sourceImportReserved || a.status !== "reserved"),
    ).length;
  const drop = existing
    ? Math.max(0, ((existing - animals.length) / existing) * 100)
    : 0;
  const scopedFilter =
    cfg.sourceSpecies.length !== 3 || !cfg.sourceImportReserved;
  const stale =
    !input.fetchedAt ||
    Math.abs(Date.now() - Date.parse(input.fetchedAt)) >
      cfg.sourceStaleHours * 3600_000;
  // A filtered inventory must never mark animals outside that filter as absent.
  const absenceSafe =
    input.complete &&
    !scopedFilter &&
    !stale &&
    drop <= cfg.sourceMaxDropPercent;
  return {
    ...input,
    animals,
    absenceSafe,
    dropPercent: Math.round(drop * 10) / 10,
    protection: scopedFilter
      ? "Inventaire filtré : archivage automatique suspendu."
      : stale
        ? "Inventaire ancien ou non daté : archivage suspendu."
        : drop > cfg.sourceMaxDropPercent
          ? `Baisse de ${Math.round(drop)} % : archivage suspendu (seuil ${cfg.sourceMaxDropPercent} %).`
          : !input.complete
            ? "Inventaire partiel : archivage suspendu."
            : "Inventaire complet et contrôlé.",
  };
}
