import { normalizeSnapshot, mergeSnapshots } from "./source.mjs";
import { collectorIO } from "./source-request.mjs";
import { collectorConfig } from "./source-collect.mjs";
import { sourceStatus } from "./source-status.mjs";
const refuge = "refuge-spa-de-moree-jean-leriche";
const species = [
  ["dog", "chien"],
  ["cat", "chat"],
  ["nac", "nac"],
];
export function parseSpaPage(response, kind, refugeSlug = refuge) {
  const list = response?.animals ?? response?.results;
  const pages = Number(response?.max_num_pages ?? response?.nb_pages);
  if (
    !Array.isArray(list) ||
    !Number.isInteger(pages) ||
    (pages < 1 &&
      !(pages === 0 && list.length === 0 && response.total === 0)) ||
    pages > 50
  )
    throw Object.assign(
      new Error(
        "Structure SPA inconnue ou pagination hors budget. Aucun inventaire appliqué.",
      ),
      { code: "INVALID_SPA" },
    );
  const records = list.map((value) => {
    if (!value || typeof value !== "object")
      throw Object.assign(new Error("Fiche SPA invalide."), {
        code: "INVALID_SPA",
      });
    const id = value.ID ?? value.id;
    const establishment = [
      value.establishment_slug,
      value.establishment_link,
      value.establishment_name,
      typeof value.establishment === "string" ? value.establishment : null,
      value.establishment?.slug,
    ]
      .filter(Boolean)
      .join(" ");
    if (
      id == null ||
      !establishment
        .split(/\s+/)
        .some(
          (v) =>
            v === refugeSlug ||
            v === `https://www.la-spa.fr/etablissement/${refugeSlug}/`,
        )
    )
      throw Object.assign(
        new Error(
          "Le flux ne confirme pas l’ID ou le refuge de chaque animal. Arrêt plutôt qu’une collecte nationale.",
        ),
        { code: "INVALID_SPA" },
      );
    return {
      ...value,
      id,
      name: value.post_title ?? value.name,
      url: value.full_url ?? value.link ?? value.permalink ?? value.url,
      race: value.races_label ?? value.breed ?? value.race,
      sexe: value.sex ?? value.gender ?? value.sexe,
      date_naissance: value.birthdate ?? value.date_naissance,
      description: value.excerpt ?? value.description,
      thumbnail: value.thumbnail ?? value.image,
      entente: value.entente ?? {},
      reserved: value.reserved === true,
      status: sourceStatus(value),
    };
  });
  const total = response.total ?? response.found_posts ?? response.total_count;
  return {
    records,
    pages: Math.max(1, pages),
    kind,
    total:
      Number.isInteger(total) && total >= 0 && total <= 5000 ? total : null,
  };
}
export async function collectSpa(options = {}) {
  const cfg = collectorConfig({
    ...options.config,
    ...(options.attempts ? { sourceAttempts: options.attempts } : {}),
  });
  const io = options.io || collectorIO(cfg, options),
    snapshots = [],
    counts = [],
    failures = [];
  for (let attempt = 0; attempt < cfg.sourceAttempts; attempt++) {
    const passLists = { dog_list: {}, cat_list: {}, nac_list: {} };
    let expected = 0,
      hasTotals = true;
    try {
      for (const [kind, slug] of species.filter(([kind]) =>
        cfg.sourceSpecies.includes(kind === "nac" ? "other" : kind),
      )) {
        let pages = 1,
          firstTotal = null;
        for (let page = 1; page <= pages; page++) {
          const url = new URL(cfg.spaApiUrl);
          url.search = new URLSearchParams({
            api: "1",
            establishment: cfg.spaRefugeSlug,
            species: slug,
            paged: String(page),
            seed: String(attempt + 1),
          }).toString();
          const parsed = parseSpaPage(
            JSON.parse(await io.read(url.href)),
            kind,
            cfg.spaRefugeSlug,
          );
          if (parsed.pages > cfg.sourceMaxPages)
            throw Object.assign(
              new Error(
                "Pagination SPA supérieure au budget configuré. Aucun inventaire appliqué.",
              ),
              { code: "BUDGET" },
            );
          if (
            page > 1 &&
            (parsed.pages !== pages || parsed.total !== firstTotal)
          )
            throw new Error(
              "Pagination modifiée pendant la collecte. Réessayer plus tard.",
            );
          if (page === 1) {
            firstTotal = parsed.total;
            if (firstTotal == null) hasTotals = false;
            else expected += firstTotal;
          }
          pages = parsed.pages;
          for (const record of parsed.records) {
            if (
              Object.entries(passLists).some(
                ([key, list]) =>
                  key !== kind + "_list" && Object.hasOwn(list, record.id),
              )
            )
              throw Object.assign(
                Error(
                  "Un identifiant SPA apparaît dans plusieurs espèces. Inventaire refusé.",
                ),
                { code: "INVALID_SPA" },
              );
            passLists[kind + "_list"][record.id] = record;
          }
        }
        const received = Object.keys(passLists[kind + "_list"]).length;
        if (firstTotal !== null && received !== firstTotal) {
          hasTotals = false;
          failures.push(
            `Inventaire ${slug} incomplet : ${received} fiches uniques reçues, ${firstTotal} annoncées.`,
          );
        }
      }
    } catch (e) {
      if (["ROBOTS_DENIED", "BUDGET", "INVALID_SPA"].includes(e.code)) throw e;
      failures.push(e.message);
      hasTotals = false;
    }
    const count = Object.values(passLists).reduce(
      (n, list) => n + Object.keys(list).length,
      0,
    );
    counts.push(count);
    if (!count) {
      failures.push("Un passage SPA n’a retourné aucun animal.");
      continue;
    }
    const snapshot = normalizeSnapshot(passLists);
    snapshots.push({
      ...snapshot,
      scope: cfg.sourceScope,
      fetchedAt: new Date().toISOString(),
      complete: hasTotals && expected === count,
      expectedCount: hasTotals ? expected : null,
    });
  }
  if (!snapshots.length)
    throw new Error(failures[0] || "Aucun inventaire SPA valide.");
  const merged = mergeSnapshots(snapshots);
  if (failures.length) merged.complete = false;
  return {
    ...merged,
    requests: io.requests(),
    attempts: cfg.sourceAttempts,
    validAttempts: snapshots.length,
    counts,
    failures,
    durationMs: io.elapsed(),
  };
}
