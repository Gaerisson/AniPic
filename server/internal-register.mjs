import { z } from "zod";
import { id, now, audit, transaction } from "./db.mjs";
import { parseRegisterImport } from "./register-import.mjs";
const date = z
  .string()
  .refine(
    (s) =>
      !s ||
      (/^\d{4}-\d{2}-\d{2}$/.test(s) &&
        Number.isFinite(Date.parse(s)) &&
        new Date(s).toISOString().slice(0, 10) === s),
    "Date de révision invalide.",
  );
const Row = z
  .object({
    name: z.string().trim().min(1).max(160),
    contact: z.string().trim().max(200).default(""),
    reason: z.string().trim().max(2000).default(""),
    instructions: z.string().trim().max(1000).default(""),
    review_date: date.default(""),
  })
  .strict();
export async function registerInternalRegister(app, { db, authorized }) {
  const guard = authorized(["admin", "agent"]);
  const safeReply = (reply) =>
    reply
      .header("Cache-Control", "private, no-store")
      .header("Pragma", "no-cache");
  app.get(
    "/api/internal-register",
    { preHandler: guard },
    async (req, reply) => {
      safeReply(reply);
      const q = z
        .object({
          q: z.string().max(100).default(""),
          deleted: z.enum(["0", "1"]).default("0"),
          page: z.coerce.number().int().min(1).max(1000).default(1),
        })
        .parse(req.query);
      const term = "%" + q.q.replace(/[\\%_]/g, "\\$&") + "%";
      const where = `deleted_at IS ${q.deleted === "1" ? "NOT " : ""}NULL AND (name LIKE ? ESCAPE '\\' OR contact LIKE ? ESCAPE '\\' OR reason LIKE ? ESCAPE '\\')`;
      const total = db
        .prepare("SELECT COUNT(*) n FROM internal_register WHERE " + where)
        .get(term, term, term).n;
      const items = db
        .prepare(
          "SELECT * FROM internal_register WHERE " +
            where +
            " ORDER BY updated_at DESC,id LIMIT 50 OFFSET ?",
        )
        .all(term, term, term, (q.page - 1) * 50);
      return { items, total, pages: Math.ceil(total / 50), page: q.page };
    },
  );
  function insert(row, user) {
    const record = id(),
      created = now();
    db.prepare(
      "INSERT INTO internal_register(id,name,contact,reason,instructions,review_date,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run(
      record,
      row.name,
      row.contact,
      row.reason,
      row.instructions,
      row.review_date,
      user.id,
      created,
      created,
    );
    return record;
  }
  app.post(
    "/api/internal-register",
    { preHandler: guard },
    async (req, reply) => {
      const row = Row.parse(req.body),
        record = insert(row, req.user);
      audit(db, req.user, "register_created", { id: record });
      return safeReply(reply).code(201).send({ id: record });
    },
  );
  app.patch(
    "/api/internal-register/:id",
    { preHandler: guard },
    async (req, reply) => {
      const record = z.string().uuid().parse(req.params.id),
        current = db
          .prepare("SELECT * FROM internal_register WHERE id=?")
          .get(record);
      if (!current)
        return reply.code(404).send({ error: "Entrée introuvable." });
      if (
        !req.headers["x-anipic-version"] ||
        req.headers["x-anipic-version"] !== current.updated_at
      )
        return reply.code(409).send({
          error: "Cette entrée a changé. Actualisez avant de l’enregistrer.",
        });
      const changes = Row.partial()
          .extend({ deleted: z.boolean().optional() })
          .strict()
          .parse(req.body),
        row = { ...current, ...changes };
      const updated = new Date(
        Math.max(Date.now(), Date.parse(current.updated_at) + 1),
      ).toISOString();
      db.prepare(
        "UPDATE internal_register SET name=?,contact=?,reason=?,instructions=?,review_date=?,updated_at=?,deleted_at=? WHERE id=?",
      ).run(
        row.name,
        row.contact,
        row.reason,
        row.instructions,
        row.review_date,
        updated,
        changes.deleted === undefined
          ? current.deleted_at
          : changes.deleted
            ? updated
            : null,
        record,
      );
      audit(
        db,
        req.user,
        changes.deleted ? "register_removed" : "register_updated",
        { id: record },
      );
      return safeReply(reply).send({ ok: true, updatedAt: updated });
    },
  );
  app.post(
    "/api/internal-register/import-preview",
    {
      preHandler: guard,
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      safeReply(reply);
      const file = await req.file({
        limits: { files: 1, fileSize: 8 * 1024 ** 2 },
      });
      if (!file)
        return reply
          .code(400)
          .send({ error: "Choisissez un fichier Excel ou CSV." });
      const buffer = await file.toBuffer();
      return parseRegisterImport(buffer, file.filename);
    },
  );
  app.post(
    "/api/internal-register/import",
    { preHandler: guard, bodyLimit: 4 * 1024 ** 2 },
    async (req, reply) => {
      const { rows } = z
        .object({ rows: z.array(Row).min(1).max(1000) })
        .strict()
        .parse(req.body);
      const result = transaction(db, () => {
        const existing = new Set(
          db
            .prepare(
              "SELECT name,contact FROM internal_register WHERE deleted_at IS NULL",
            )
            .all()
            .map(
              (r) =>
                `${r.name.trim().toLocaleLowerCase("fr")}\0${r.contact.trim().toLocaleLowerCase("fr")}`,
            ),
        );
        let imported = 0,
          skipped = 0;
        for (const row of rows) {
          const key = `${row.name.trim().toLocaleLowerCase("fr")}\0${row.contact.trim().toLocaleLowerCase("fr")}`;
          if (existing.has(key)) {
            skipped++;
            continue;
          }
          insert(row, req.user);
          existing.add(key);
          imported++;
        }
        return { imported, skipped };
      });
      audit(db, req.user, "register_imported", result);
      return safeReply(reply).send(result);
    },
  );
}
