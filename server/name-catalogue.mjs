import { boundedFetch } from "./source.mjs";
import { promises as fs } from "node:fs";
import { now } from "./db.mjs";

const endpoint = "https://www.la-spa.fr/app/wp-json/spa/v1/animals/search/";
const key = "spaNameCatalogueV1";
const freshMs = 24 * 3600_000;
const parisParts = (clock) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(clock))
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
export function nightlyNamesDue(lastAttempt, clock = Date.now()) {
  const p = parisParts(clock),
    today = `${p.year}-${p.month}-${p.day}`;
  if (Number(p.hour) * 60 + Number(p.minute) < 195) return false;
  if (!lastAttempt || !Number.isFinite(Date.parse(lastAttempt))) return true;
  const last = parisParts(Date.parse(lastAttempt)),
    day = `${last.year}-${last.month}-${last.day}`;
  return (
    day < today ||
    (day === today && Number(last.hour) * 60 + Number(last.minute) < 195)
  );
}
export function nameKey(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("fr")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^\p{L}\p{N}]/gu, "");
}
export function nameKeys(value) {
  // Public titles often append a shelter ID or “(réservé)” to the actual name.
  const clean = String(value ?? "")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\b[A-Z]{2,6}\d{2,}\b/gi, " ")
    .replace(/\s+\d+\s*$/, " ")
    .trim();
  const stop = new Set([
    "dit",
    "dite",
    "de",
    "des",
    "les",
    "pour",
    "avec",
    "nommer",
    "sans",
    "nom",
  ]);
  return [
    ...new Set([
      nameKey(value),
      nameKey(clean),
      ...clean
        .split(/[\s_\-]+/)
        .filter((word) => word.length >= 3 && !stop.has(nameKey(word)))
        .map(nameKey),
    ]),
  ].filter(Boolean);
}
export function validCatalogue(value) {
  return (
    value?.complete === true &&
    Number.isFinite(Date.parse(value.checkedAt)) &&
    Date.parse(value.checkedAt) <= Date.now() + 60_000 &&
    Array.isArray(value.names) &&
    value.names.length <= 100_000 &&
    value.names.every(
      (n) => typeof n === "string" && n.length > 0 && n.length <= 100,
    )
  );
}

// Separate read-only national catalogue: it never imports animals or triggers archiving.
export async function collectNameCatalogue({
  fetchText = boundedFetch,
  delay = (ms) => new Promise((r) => setTimeout(r, ms)),
  onProgress = () => {},
  cancelled = () => false,
} = {}) {
  const started = Date.now(),
    ids = new Set(),
    names = new Set();
  let pages = 1,
    total = null;
  for (let page = 1; page <= pages; page++) {
    if (cancelled() || Date.now() - started > 360_000)
      throw new Error(
        "Vérification nationale interrompue ou trop longue. Aucun prénom non vérifié proposé.",
      );
    if (page > 1) await delay(550);
    const url = new URL(endpoint);
    url.search = new URLSearchParams({
      api: "1",
      paged: String(page),
      seed: "1",
    }).toString();
    const response = JSON.parse(
      await fetchText(url.href, 5 * 1024 ** 2, {
        timeoutMs: Math.min(
          12_000,
          Math.max(1, 360_000 - (Date.now() - started)),
        ),
        allowedHosts: ["www.la-spa.fr"],
      }),
    );
    const list = response.results ?? response.animals;
    const count = response.total;
    const max = Number(response.nb_pages ?? response.max_num_pages);
    if (
      !Array.isArray(list) ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > 20_000 ||
      !Number.isInteger(max) ||
      max < 1 ||
      max > 350 ||
      !list.length ||
      list.length > 500 ||
      (page > 1 && (max !== pages || count !== total))
    )
      throw new Error(
        "Catalogue SPA incomplet ou modifié pendant la lecture. Réessayez plus tard.",
      );
    pages = max;
    total = count;
    for (const item of list) {
      const id = item?.ID ?? item?.id,
        name = item?.name ?? item?.post_title;
      if (
        !["number", "string"].includes(typeof id) ||
        !String(id) ||
        typeof name !== "string" ||
        !nameKey(name) ||
        name.length > 100 ||
        ids.has(String(id))
      )
        throw new Error(
          "Pagination SPA incohérente : un nom ou un identifiant n’est pas vérifiable.",
        );
      ids.add(String(id));
      names.add(name.trim());
    }
    onProgress({ page, pages, animals: ids.size, total });
  }
  if (ids.size !== total)
    throw new Error(
      "Catalogue national partiel : aucun résultat déclaré vérifié.",
    );
  return {
    complete: true,
    checkedAt: now(),
    animals: total,
    source: endpoint,
    names: [...names].sort((a, b) => a.localeCompare(b, "fr")),
  };
}

export async function nameCatalogueService(app, db, c) {
  let catalogue = c.nameCatalogueSnapshot,
    pending = null,
    error = "",
    progress = null,
    closed = false,
    nextAttempt = 0;
  if (!catalogue) {
    try {
      catalogue = JSON.parse(
        db.prepare("SELECT value FROM settings WHERE key=?").get(key)?.value,
      );
    } catch {
      /* A corrupt cache is never treated as verified. */
    }
  }
  if (!c.nameCatalogueSnapshot) {
    try {
      const bundled = JSON.parse(
        await fs.readFile(
          new URL("../shared/spa-names.json", import.meta.url),
          "utf8",
        ),
      );
      if (
        validCatalogue(bundled) &&
        (!validCatalogue(catalogue) ||
          Date.parse(bundled.checkedAt) > Date.parse(catalogue.checkedAt))
      )
        catalogue = bundled;
    } catch {
      /* Keep the last validated persistent catalogue if the bundle is absent. */
    }
  }
  if (!validCatalogue(catalogue)) catalogue = null;
  let lastAttempt;
  try {
    lastAttempt = JSON.parse(
      db
        .prepare(
          "SELECT value FROM settings WHERE key='nameCatalogueAttempt313'",
        )
        .get()?.value || "null",
    );
  } catch {}
  nextAttempt = lastAttempt ? Date.parse(lastAttempt) + 3600000 : 0;
  if (!lastAttempt) lastAttempt = catalogue?.checkedAt;
  const status = () => ({
    ready: !!catalogue,
    fresh:
      !!catalogue && Date.now() - Date.parse(catalogue.checkedAt) < freshMs,
    schedule: "03:15 · Europe/Paris",
    checkedAt: catalogue?.checkedAt ?? null,
    names: catalogue?.names.length ?? 0,
    animals: catalogue?.animals ?? 0,
    running: !!pending,
    progress,
    error,
    retryAt:
      nextAttempt > Date.now() ? new Date(nextAttempt).toISOString() : null,
  });
  const start = () => {
    if (pending || Date.now() < nextAttempt) return status();
    error = "";
    progress = null;
    nextAttempt = Date.now() + 3600_000;
    lastAttempt = now();
    db.prepare(
      "INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    ).run("nameCatalogueAttempt313", JSON.stringify(lastAttempt));
    pending = collectNameCatalogue({
      fetchText: c.nameCatalogueFetcher,
      delay: c.nameCatalogueDelay,
      onProgress: (p) => {
        progress = p;
      },
      cancelled: () => closed,
    })
      .then((value) => {
        if (closed) return;
        if (!validCatalogue(value))
          throw new Error("Catalogue de prénoms hors limites.");
        db.prepare(
          "INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        ).run(key, JSON.stringify(value));
        catalogue = value;
      })
      .catch((e) => {
        if (!closed) {
          error = e.message;
          app.log.warn({ err: e }, "Catalogue des prénoms SPA indisponible");
        }
      })
      .finally(() => {
        pending = null;
      });
    return status();
  };
  let timer;
  if (c.scheduler !== false && !c.nameCatalogueSnapshot)
    app.addHook("onReady", async () => {
      const tick = () => {
        if (
          !pending &&
          Date.now() >= nextAttempt &&
          (!catalogue || nightlyNamesDue(lastAttempt))
        )
          start();
      };
      tick();
      timer = setInterval(tick, 60000);
      timer.unref();
    });
  app.addHook("onClose", async () => {
    closed = true;
    clearInterval(timer);
    await pending;
  });
  return { status, start, names: () => catalogue?.names ?? [] };
}

export function localTakenNames(db) {
  const taken = new Set(
    db
      .prepare(
        "SELECT name FROM animals WHERE archived_at IS NULL AND status <> 'adopted'",
      )
      .all()
      .flatMap((a) => nameKeys(a.name)),
  );
  return taken;
}
