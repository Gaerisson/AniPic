import { z } from "zod";
import { createHash } from "node:crypto";
import { now, settings, transaction } from "./db.mjs";
import { publicAnimalMetadata, publicCompatibility } from "./animal-facts.mjs";
const parsed = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
export function historyFacts(a) {
  return {
    name: a.name,
    species: a.species,
    sex: a.sex,
    birth_date: a.birth_date,
    description: a.description,
    breed: a.breed,
    status: a.status,
    source_url: a.source_url,
    compatibility: publicCompatibility(parsed(a.compatibility, {})),
    tags: parsed(a.tags, []),
    source_metadata: publicAnimalMetadata(parsed(a.source_metadata, {})),
  };
}
function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, stable(v[k])]),
    );
  return v ?? null;
}
export function recordAnimalChanges(
  db,
  before,
  after,
  at = now(),
  kind = before ? "updated" : "added",
) {
  const previous = before ? historyFacts(before) : {};
  for (const [field, value] of Object.entries(historyFacts(after))) {
    const a = JSON.stringify(stable(previous[field])),
      b = JSON.stringify(stable(value));
    if (a === b) continue;
    db.prepare(
      "INSERT INTO animal_changes(animal_id,kind,field,before_value,after_value,observed_at) VALUES (?,?,?,?,?,?)",
    ).run(after.id, kind, field, before ? a : null, b, at);
  }
}
export async function registerHistory(app, { db, authorized }) {
  const key = "historyBaselineV29";
  if (!db.prepare("SELECT 1 FROM settings WHERE key=?").get(key))
    transaction(db, () => {
      const at = now();
      for (const a of db
        .prepare("SELECT * FROM animals WHERE source_id IS NOT NULL")
        .all())
        recordAnimalChanges(db, null, a, at, "baseline");
      db.prepare("INSERT INTO settings VALUES (?,?)").run(
        key,
        JSON.stringify(at),
      );
    });
  async function read(req, reply, internal = false) {
    if (!internal && !settings(db).publicHistoryEnabled)
      return reply.code(404).send({ error: "Historique public désactivé." });
    const q = z
      .object({
        animalId: z.string().uuid().optional(),
        sourceId: z.string().max(150).optional(),
        field: z.enum(Object.keys(historyFacts({}))).optional(),
        since: z.iso.datetime().optional(),
        after: z.coerce.number().int().min(0).default(0),
        limit: z.coerce.number().int().min(1).max(100).default(40),
        baseline: z.enum(["0", "1"]).default("0"),
      })
      .parse(req.query);
    const where = ["c.seq > ?"],
      args = [q.after];
    if (!internal) where.push("a.source_id IS NOT NULL");
    if (q.baseline === "0") where.push("c.kind != 'baseline'");
    for (const [value, sql] of [
      [q.animalId, "c.animal_id=?"],
      [q.sourceId, "a.source_id=?"],
      [q.field, "c.field=?"],
      [q.since, "c.observed_at>=?"],
    ])
      if (value) {
        where.push(sql);
        args.push(value);
      }
    const rows = db
      .prepare(
        `SELECT c.*,a.name,a.species,a.source_id,a.source_url FROM animal_changes c JOIN animals a ON a.id=c.animal_id WHERE ${where.join(" AND ")} ORDER BY c.seq LIMIT ?`,
      )
      .all(...args, q.limit + 1);
    const more = rows.length > q.limit;
    const items = rows
      .slice(0, q.limit)
      .map(({ before_value, after_value, ...r }) => ({
        ...r,
        before: parsed(before_value, null),
        after: parsed(after_value, null),
      }));
    const body = {
      schemaVersion: 1,
      items,
      next: more ? items.at(-1).seq : null,
      trackingSince: parsed(
        db.prepare("SELECT value FROM settings WHERE key=?").get(key)?.value,
        null,
      ),
    };
    if (!internal) {
      reply
        .header("Access-Control-Allow-Origin", "*")
        .header("Cross-Origin-Resource-Policy", "cross-origin");
      const etag =
        '"' +
        createHash("sha256")
          .update(JSON.stringify(body))
          .digest("hex")
          .slice(0, 24) +
        '"';
      reply.header("ETag", etag).header("Cache-Control", "public, max-age=30");
      if (req.headers["if-none-match"] === etag) return reply.code(304).send();
    }
    return body;
  }
  app.get(
    "/api/public/changes",
    {
      preHandler: pageAccessGuard(db, "activity"),
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
    },
    (req, reply) => read(req, reply),
  );
  app.get(
    "/api/changes",
    {
      preHandler: authorized([
        "admin",
        "editor",
        "agent",
        "volunteer",
        "viewer",
      ]),
    },
    (req, reply) => read(req, reply, true),
  );
}
import { pageAccessGuard } from "./page-access.mjs";
