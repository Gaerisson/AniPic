import { request } from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import robotsParser from "robots-parser";
import * as cheerio from "cheerio";
import { z } from "zod";
import { recordAnimalChanges } from "./animal-history.mjs";
import { sourceStatus } from "./source-status.mjs";
import { savePresence, readPresence } from "./source-presence.mjs";
import { inferAdoption, reconcileAdoption } from "./source-adoption.mjs";
import {
  publicAnimalMetadata,
  publicCompatibility,
  compatibilityFromText,
} from "./animal-facts.mjs";
import {
  id,
  now,
  transaction,
  settings,
  saveSettings,
  feedEvent,
} from "./db.mjs";
const robotCache = new Map();
const UA = "Anipic/1.0 (refuge photo archive; respectful bounded collector)";
function publicIP(ip) {
  if (isIP(ip) !== 4) return false; // Fail closed for IPv6; no mapped/private bypass.
  const [a, b] = ip.split(".").map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 192 && b === 0)
  );
}
function sourceURL(value, allowedHosts) {
  const url = new URL(value);
  const allowed =
    allowedHosts ||
    (
      process.env.SOURCE_ALLOWED_HOSTS ||
      "www.la-spa.fr,la-spa.fr,api-spa.gaerisson-softs.fr,srv.gaerisson-softs.fr"
    )
      .split(",")
      .map((s) => s.trim());
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !allowed.includes(url.hostname)
  )
    throw new Error(
      "Source HTTPS sur un domaine explicitement autorisé requise.",
    );
  return url;
}
export async function boundedFetch(
  value,
  limit = 5 * 1024 ** 2,
  { timeoutMs = 15000, binary = false, allowedHosts, userAgent = UA } = {},
) {
  const url = sourceURL(value, allowedHosts);
  const duration = Math.max(1, Math.min(30000, timeoutMs)),
    started = Date.now();
  let dnsTimer;
  const addresses = await Promise.race([
    lookup(url.hostname, { all: true }),
    new Promise((_, reject) => {
      dnsTimer = setTimeout(
        () => reject(new Error("Résolution de source trop lente.")),
        duration,
      );
    }),
  ]).finally(() => clearTimeout(dnsTimer));
  const target = addresses.find((a) => publicIP(a.address));
  if (
    !target ||
    addresses.some((a) => isIP(a.address) === 4 && !publicIP(a.address))
  )
    throw new Error("Adresse de source privée ou non prise en charge.");
  return new Promise((resolve, reject) => {
    let timer;
    const fail = (e) => {
      clearTimeout(timer);
      reject(e);
    };
    const req = request(
      url,
      {
        headers: {
          "User-Agent": userAgent,
          Accept: "application/json,text/html,text/plain",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        timeout: Math.max(1, Math.min(30000, timeoutMs)),
        lookup: (hostname, options, cb) => {
          if (options.all) cb(null, [{ address: target.address, family: 4 }]);
          else cb(null, target.address, 4);
        },
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          res.resume();
          let destination = "URL invalide";
          try {
            const targetURL = new URL(res.headers.location || url.href, url);
            targetURL.username = "";
            targetURL.password = "";
            targetURL.search = "";
            destination = targetURL.href.slice(0, 500);
          } catch {
            /* Invalid redirects are rejected without following them. */
          }
          fail(
            new Error(
              `Source redirigée vers ${destination}. Configurez son URL canonique; aucun inventaire appliqué.`,
            ),
          );
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          fail(new Error(`Source HTTP ${res.statusCode}; aucun archivage.`));
          return;
        }
        let size = 0;
        const chunks = [];
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > limit) res.destroy(new Error("Source trop volumineuse."));
          else chunks.push(chunk);
        });
        res.on("end", () => {
          clearTimeout(timer);
          resolve(
            binary
              ? Buffer.concat(chunks)
              : Buffer.concat(chunks).toString("utf8"),
          );
        });
        res.on("error", fail);
      },
    );
    req.on("timeout", () => req.destroy(new Error("Source trop lente.")));
    req.on("error", fail);
    timer = setTimeout(
      () => req.destroy(new Error("Durée totale de la requête dépassée.")),
      Math.max(1, duration - (Date.now() - started)),
    );
    req.end();
  });
}
export async function respectRobots(value, { timeoutMs = 15000 } = {}) {
  const url = sourceURL(value);
  const robotsURL = new URL("/robots.txt", url).href;
  let cached = robotCache.get(robotsURL);
  if (!cached || Date.now() - cached.time > 86400_000) {
    const body = await boundedFetch(robotsURL, 512 * 1024, { timeoutMs });
    cached = { time: Date.now(), parser: robotsParser(robotsURL, body) };
    robotCache.set(robotsURL, cached);
  }
  if (cached.parser.isAllowed(url.href, UA) === false)
    throw Object.assign(
      new Error(
        "Anipic n’interroge pas cette route : elle est exclue par robots.txt. La consultation dans un navigateur reste possible.",
      ),
      { code: "ROBOTS_DENIED" },
    );
}
const Animal = z.object({
  sourceId: z.string().min(1).max(200),
  name: z.string().min(1).max(100),
  species: z.enum(["dog", "cat", "other"]),
  sex: z.enum(["male", "female", "unknown"]).default("unknown"),
  description: z.string().max(15000).default(""),
  sourceUrl: z
    .string()
    .url()
    .refine((value) => {
      const url = new URL(value);
      return (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    }, "URL HTTP(S) sans identifiants requise.")
    .optional()
    .nullable(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  tags: z.array(z.string().max(40)).max(20).default([]),
  breed: z.string().max(150).default(""),
  compatibility: z.record(z.string().max(40), z.string().max(100)).default({}),
  metadata: z.record(z.string(), z.unknown()).default({}),
  status: z.enum(["available", "reserved", "adopted"]).default("available"),
});
const Snapshot = z.object({
  schemaVersion: z.literal(1),
  scope: z
    .string()
    .regex(/^[a-zA-Z0-9:_-]{1,150}$/)
    .default("spa:moree"),
  fetchedAt: z.iso.datetime().optional(),
  complete: z.boolean().default(false),
  expectedCount: z.number().int().min(0).max(5000).optional().nullable(),
  animals: z.array(Animal).min(1).max(5000),
});
function validateSnapshot(value) {
  const record = (v) => v && typeof v === "object" && !Array.isArray(v);
  const result = Snapshot.parse({
    ...value,
    animals: Array.isArray(value?.animals)
      ? value.animals.map((a) =>
          !record(a)
            ? a
            : {
                ...a,
                compatibility:
                  a.compatibility === undefined || record(a.compatibility)
                    ? publicCompatibility(a.compatibility)
                    : a.compatibility,
                metadata:
                  a.metadata === undefined
                    ? publicAnimalMetadata(a)
                    : record(a.metadata)
                      ? { ...publicAnimalMetadata(a), ...a.metadata }
                      : a.metadata,
              },
        )
      : value?.animals,
  });
  if (
    result.complete &&
    (!result.fetchedAt || result.expectedCount !== result.animals.length)
  )
    throw new Error(
      "Un inventaire complet doit déclarer fetchedAt et expectedCount exacts.",
    );
  if (
    new Set(result.animals.map((a) => a.sourceId)).size !==
    result.animals.length
  )
    throw new Error("Identifiants source dupliqués.");
  return result;
}
function canonicalURL(value) {
  if (!value) return null;
  try {
    const url = new URL(value, "https://www.la-spa.fr");
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    url.hash = "";
    url.search = "";
    return url.href;
  } catch {
    return null;
  }
}
function birthDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso =
    text.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ||
    (match ? `${match[3]}-${match[2]}-${match[1]}` : null);
  if (
    iso &&
    Number.isFinite(+new Date(iso)) &&
    new Date(iso).toISOString().slice(0, 10) === iso
  )
    return iso;
  return null;
}
function plain(value) {
  if (value && typeof value === "object")
    value = value.rendered ?? value.name ?? "";
  return cheerio
    .load("<body>" + String(value || "") + "</body>")("body")
    .text()
    .replace(/\s+/g, " ")
    .trim();
}
export function normalizeSnapshot(input) {
  if (input?.schemaVersion === 1) return validateSnapshot(input);
  // Historical GPIC source: V1 dog_list + details, V2 global/detail, species list.
  const base = input?.global || input;
  const animals = [];
  for (const [key, species] of [
    ["dog", "dog"],
    ["cat", "cat"],
    ["nac", "other"],
  ])
    for (const [oldKey, value] of Object.entries(
      base?.[key + "_list"] || base?.[key] || {},
    )) {
      const extra = input?.detail?.[key + "_list"]?.[oldKey] || {};
      const v = { ...extra, ...value, ...value?.details };
      const name = plain(value.name || value.nom || v.name);
      if (!name) continue;
      const rawId = value.id ?? value.ID ?? v.id ?? v.ID;
      const sourceUrl = canonicalURL(value.url || v.url);
      // A name-keyed export cannot reconstruct already overwritten duplicates.
      if (rawId == null && !sourceUrl)
        throw new Error(
          `La fiche « ${name} » n’a ni ID ni URL canonique. Fournissez une correspondance; le prénom ne peut pas servir d’identité.`,
        );
      const sourceId =
        rawId != null ? `spa:${String(rawId)}` : `spa-url:${sourceUrl}`;
      const tags = [];
      if ([true, 1, "1", "true", "oui"].includes(value.sos))
        tags.push("SOS adoption");
      animals.push({
        sourceId,
        name,
        species,
        description: plain(v.description),
        sex: /fem|^f$/i.test(v.sexe || v.gender || "")
          ? "female"
          : /m[aâ]le|^m$/i.test(v.sexe || v.gender || "")
            ? "male"
            : "unknown",
        sourceUrl,
        birthDate: birthDate(v.date_naissance || v.birthdate),
        breed: plain(v.race || v.breed),
        compatibility: Object.keys(
          publicCompatibility(v.entente || v.compatibility),
        ).length
          ? publicCompatibility(v.entente || v.compatibility)
          : compatibilityFromText(
              v.description_entente || v.description || v.excerpt,
            ),
        tags,
        status: sourceStatus(v),
        metadata: {
          ...publicAnimalMetadata(v),
          legacyKey: oldKey,
          size: plain(v.taille || v.size || ""),
          thumbnail: value.thumbnail || value.img || value.image || "",
          descriptionEntente: plain(
            v.description_entente || v.descriptionEntente,
          ),
          descriptionBase: plain(v.description_base || v.descriptionBase),
        },
      });
    }
  return validateSnapshot({
    schemaVersion: 1,
    scope: "spa:moree",
    complete: false,
    animals,
  });
}
export function applySnapshot(db, snapshot) {
  const cfg = settings(db);
  const date = now();
  let created = 0,
    updated = 0,
    changed = 0,
    unchanged = 0,
    absent = 0,
    autoAdopted = 0,
    autoAdoptionsReversed = 0;
  let reconciliation = null;
  const historyKey = `complete:${snapshot.scope}`;
  const previous = db
    .prepare("SELECT value FROM settings WHERE key=?")
    .get(historyKey);
  const history = previous ? JSON.parse(previous.value) : {};
  const last = history.at ? Date.parse(history.at) : 0;
  const fetched = Date.parse(snapshot.fetchedAt || "");
  if (fetched > Date.now() + 5 * 60000)
    throw Object.assign(
      Error(
        "La date de cet inventaire est dans le futur. Aucune fiche modifiée.",
      ),
      { statusCode: 409 },
    );
  const lastInventory = readPresence(db, snapshot.scope);
  if (
    Number.isFinite(fetched) &&
    lastInventory &&
    fetched < Date.parse(lastInventory.fetchedAt)
  )
    throw Object.assign(
      Error(
        "Cet inventaire est plus ancien que le dernier inventaire appliqué. Aucune fiche modifiée.",
      ),
      { statusCode: 409 },
    );
  const seenAt = Number.isFinite(fetched) ? snapshot.fetchedAt : date;
  const countAbsences =
    snapshot.complete &&
    Date.now() - last >= cfg.sourceAbsenceIntervalHours * 3600_000 &&
    fetched > (Date.parse(history.fetchedAt || "") || 0) &&
    Math.abs(Date.now() - fetched) < cfg.sourceStaleHours * 3600_000 &&
    snapshot.absenceSafe !== false;
  transaction(db, () => {
    for (const a of snapshot.animals) {
      const old =
        db.prepare("SELECT * FROM animals WHERE source_id=?").get(a.sourceId) ||
        (a.sourceUrl && a.sourceId.startsWith("spa:")
          ? db
              .prepare(
                "SELECT * FROM animals WHERE source_url=? AND source_scope=? AND source_id LIKE 'spa-url:%'",
              )
              .get(a.sourceUrl, snapshot.scope)
          : null);
      if (old) {
        if (
          db
            .prepare("SELECT 1 FROM settings WHERE key=?")
            .get("animalTrash:" + old.id)
        )
          continue;
        const reopened = reconcileAdoption(db, old, a.status);
        if (reopened) {
          db.prepare(
            "UPDATE animals SET archived_at=NULL,departed_at=NULL WHERE id=?",
          ).run(old.id);
          autoAdoptionsReversed++;
        }
        db.prepare(
          "UPDATE animals SET name=?,species=?,sex=?,birth_date=?,description=?,source_url=?,source_seen_at=?,missing_count=0,updated_at=?,source_scope=?,breed=?,compatibility=?,source_metadata=?,tags=?,archived_at=CASE WHEN status='source_missing' THEN NULL ELSE archived_at END,departed_at=CASE WHEN status='source_missing' THEN NULL ELSE departed_at END,status=? WHERE id=?",
        ).run(
          a.name,
          a.species,
          a.sex,
          a.birthDate ?? null,
          a.description,
          a.sourceUrl ?? null,
          seenAt,
          date,
          snapshot.scope,
          a.breed,
          JSON.stringify(a.compatibility),
          JSON.stringify(a.metadata),
          JSON.stringify(a.tags),
          a.status,
          old.id,
        );
        updated++;
        const differs =
          old.name !== a.name ||
          old.species !== a.species ||
          old.sex !== a.sex ||
          old.birth_date !== (a.birthDate ?? null) ||
          old.description !== a.description ||
          old.source_url !== (a.sourceUrl ?? null) ||
          old.breed !== a.breed ||
          old.status !== a.status ||
          old.compatibility !== JSON.stringify(a.compatibility) ||
          old.source_metadata !== JSON.stringify(a.metadata) ||
          old.tags !== JSON.stringify(a.tags);
        if (!differs)
          db.prepare("UPDATE animals SET updated_at=? WHERE id=?").run(
            old.updated_at,
            old.id,
          );
        if (differs) changed++;
        else unchanged++;
        if ((old.status === "source_missing" || reopened) && old.archived_at)
          feedEvent(db, { ...old, status: a.status }, "restored");
      } else {
        db.prepare(
          "INSERT INTO animals(id,name,species,sex,birth_date,description,source_id,source_url,source_seen_at,tags,created_at,updated_at,source_scope,breed,compatibility,source_metadata,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ).run(
          id(),
          a.name,
          a.species,
          a.sex,
          a.birthDate ?? null,
          a.description,
          a.sourceId,
          a.sourceUrl ?? null,
          seenAt,
          JSON.stringify(a.tags),
          date,
          date,
          snapshot.scope,
          a.breed,
          JSON.stringify(a.compatibility),
          JSON.stringify(a.metadata),
          a.status,
        );
        created++;
        feedEvent(
          db,
          db.prepare("SELECT * FROM animals WHERE source_id=?").get(a.sourceId),
          "added",
        );
      }
      if (!old || old.status !== a.status) {
        const current = db
          .prepare("SELECT id FROM animals WHERE source_id=?")
          .get(old ? old.source_id : a.sourceId);
        if (current)
          db.prepare("INSERT INTO animal_status_events VALUES (?,?,?,?)").run(
            id(),
            current.id,
            a.status,
            date,
          );
      }
      if (old && old.source_id !== a.sourceId)
        db.prepare("UPDATE animals SET source_id=? WHERE id=?").run(
          a.sourceId,
          old.id,
        );
      const currentRow = db
        .prepare("SELECT * FROM animals WHERE source_id=?")
        .get(a.sourceId);
      if (currentRow) recordAnimalChanges(db, old, currentRow, date);
    }
    if (
      snapshot.complete &&
      snapshot.absenceSafe !== false &&
      Math.abs(Date.now() - fetched) < cfg.sourceStaleHours * 3600_000
    )
      reconciliation = savePresence(db, snapshot, date);
    if (countAbsences) {
      const seen = new Set(snapshot.animals.map((a) => a.sourceId));
      for (const a of db
        .prepare(
          "SELECT id,source_id,missing_count FROM animals WHERE source_scope=? AND status NOT IN ('adopted','deceased','transferred') AND (archived_at IS NULL OR (? AND status='source_missing')) AND NOT EXISTS(SELECT 1 FROM settings s WHERE s.key='animalTrash:'||animals.id)",
        )
        .all(
          snapshot.scope,
          Number(cfg.archiveMissing && cfg.sourceMissingOutcome === "adopted"),
        )) {
        if (seen.has(a.source_id)) continue;
        const count = a.missing_count + 1;
        db.prepare("UPDATE animals SET missing_count=? WHERE id=?").run(
          count,
          a.id,
        );
        if (cfg.archiveMissing && count >= cfg.missingThreshold) {
          const before = db
            .prepare("SELECT * FROM animals WHERE id=?")
            .get(a.id);
          const outcome =
            cfg.sourceMissingOutcome === "adopted"
              ? "adopted"
              : "source_missing";
          db.prepare(
            "UPDATE animals SET archived_at=COALESCE(archived_at,?),departed_at=COALESCE(departed_at,?),status=?,updated_at=? WHERE id=?",
          ).run(date, date, outcome, date, a.id);
          if (outcome === "adopted") {
            inferAdoption(db, before, snapshot, cfg, date, count);
            autoAdopted++;
          }
          recordAnimalChanges(
            db,
            before,
            db.prepare("SELECT * FROM animals WHERE id=?").get(a.id),
            date,
            "missing",
          );
          feedEvent(
            db,
            db.prepare("SELECT * FROM animals WHERE id=?").get(a.id),
            "removed",
          );
          absent++;
        }
      }
      db.prepare(
        "INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      ).run(
        historyKey,
        JSON.stringify({ at: date, fetchedAt: snapshot.fetchedAt }),
      );
    }
  });
  return {
    created,
    updated,
    changed,
    unchanged,
    archived: absent,
    autoAdopted,
    autoAdoptionsReversed,
    complete: snapshot.complete,
    absenceCheck: countAbsences,
    photosImported: 0,
    missingFromSource:
      reconciliation?.missing.filter((a) =>
        db
          .prepare("SELECT 1 FROM animals WHERE id=? AND archived_at IS NULL")
          .get(a.id),
      ).length ?? null,
    reconciliation,
    archiveMissingEnabled: cfg.archiveMissing,
    sourceMissingOutcome: cfg.sourceMissingOutcome,
    absenceProtection:
      !snapshot.complete || snapshot.absenceSafe === false
        ? snapshot.protection ||
          "Inventaire incomplet ou non sûr : absences non confirmées."
        : !countAbsences
          ? "Présence actualisée ; prochaine confirmation d’archivage après le délai configuré."
          : !cfg.archiveMissing
            ? "Présence actualisée ; archivage automatique désactivé."
            : "Absences comptées selon le seuil configuré.",
    note: "Les photos locales sont conservées. Le flux JSON importe les fiches; ajouter les photos par lot.",
  };
}
export function mergeSnapshots(snapshots) {
  if (!snapshots.length) throw new Error("Aucun inventaire valide.");
  const first = snapshots[0];
  if (snapshots.some((s) => s.scope !== first.scope))
    throw new Error("La source a changé de périmètre entre les essais.");
  const union = new Map();
  for (const snapshot of snapshots)
    for (const animal of snapshot.animals) union.set(animal.sourceId, animal);
  const signatures = snapshots.map((s) =>
    s.animals
      .map((a) => a.sourceId)
      .sort()
      .join("|"),
  );
  const stable =
    snapshots.length >= 2 && signatures.every((s) => s === signatures[0]);
  const complete =
    stable &&
    snapshots.every((s) => s.complete && s.expectedCount === union.size);
  return {
    ...snapshots.at(-1),
    animals: [...union.values()],
    complete,
    expectedCount: complete ? union.size : null,
    attempts: snapshots.length,
    stable,
  };
}
export async function synchronize(db, deps = {}) {
  const { collectInventory, collectorConfig, guardInventory } =
    await import("./source-collect.mjs");
  const cfg = collectorConfig(settings(db));
  const snapshot = guardInventory(db, await collectInventory(cfg, deps), cfg);
  return {
    ...applySnapshot(db, snapshot),
    attempts: snapshot.attempts,
    validAttempts: snapshot.validAttempts,
    stable: snapshot.stable,
    failures: snapshot.failures || [],
    requests: snapshot.requests,
    counts: snapshot.counts,
    protection: snapshot.protection,
    dropPercent: snapshot.dropPercent,
  };
}
