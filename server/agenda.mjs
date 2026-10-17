import { z } from "zod";
import { id, now, audit } from "./db.mjs";
import { creators, creativeError } from "./creative-sources.mjs";
import { agendaCategories } from "../shared/agenda.mjs";
export const agendaDate = z
  .string()
  .regex(/^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/)
  .refine((value) => {
    const d = new Date(value + "T12:00:00Z");
    return Number.isFinite(+d) && d.toISOString().slice(0, 10) === value;
  }, "Date inexistante.");
export const agendaInput = z
  .object({
    title: z.string().trim().min(1).max(100),
    date: agendaDate,
    endDate: agendaDate.optional(),
    time: z
      .union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)])
      .default(""),
    category: z.enum(Object.keys(agendaCategories)).default("event"),
    location: z.string().trim().max(120).default(""),
    description: z.string().trim().max(500).default(""),
    keyEvent: z.boolean().default(true),
    shareGazette: z.boolean().default(true),
    showOnTV: z.boolean().default(false),
    status: z.enum(["scheduled", "cancelled"]).default("scheduled"),
  })
  .strict()
  .superRefine((o, ctx) => {
    if (o.endDate && o.endDate < o.date)
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "La fin précède le début.",
      });
  });
export function agendaItems(
  db,
  from,
  to,
  { channel = "team", limit = 500 } = {},
) {
  const rows = db
    .prepare(
      "SELECT e.*,u.name AS author FROM agenda_events e LEFT JOIN users u ON u.id=e.updated_by WHERE e.deleted_at IS NULL AND e.event_date<=? AND e.end_date>=? ORDER BY e.event_date, e.id",
    )
    .all(to, from);
  const filtered = rows
    .map((r) => ({
      ...JSON.parse(r.config),
      id: r.id,
      revision: r.revision,
      updatedAt: r.updated_at,
      author: r.author || "Équipe",
    }))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.time.localeCompare(b.time) ||
        a.title.localeCompare(b.title),
    )
    .filter(
      (e) =>
        channel === "team" ||
        (e.status === "scheduled" &&
          e[channel === "tv" ? "showOnTV" : "shareGazette"]),
    );
  return {
    items: filtered.slice(0, limit),
    total: filtered.length,
    truncated: filtered.length > limit,
  };
}
export async function registerAgenda(app, { db, authorized }) {
  const readers = {
      preHandler: authorized([
        "admin",
        "editor",
        "agent",
        "volunteer",
        "viewer",
      ]),
    },
    writers = { preHandler: authorized(creators) };
  app.get("/api/agenda", readers, async (req) => {
    const q = z
      .object({ from: agendaDate, to: agendaDate })
      .strict()
      .parse(req.query);
    if ((new Date(q.to) - new Date(q.from)) / 864e5 > 370 || q.to < q.from)
      throw creativeError("Choisissez une période de 370 jours maximum.", 422);
    return agendaItems(db, q.from, q.to);
  });
  app.post("/api/agenda", writers, async (req, reply) => {
    const o = agendaInput.parse(req.body),
      key = id(),
      stamp = now();
    db.prepare(
      "INSERT INTO agenda_events(id,event_date,end_date,config,revision,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,1,?,?,?,?)",
    ).run(
      key,
      o.date,
      o.endDate || o.date,
      JSON.stringify(o),
      req.user.id,
      req.user.id,
      stamp,
      stamp,
    );
    audit(db, req.user, "agenda_created", { id: key, title: o.title });
    return reply.code(201).send({ id: key, revision: 1 });
  });
  app.put("/api/agenda/:id", writers, async (req) => {
    const key = z.string().uuid().parse(req.params.id),
      { revision, ...body } = z
        .object({ revision: z.number().int().positive() })
        .passthrough()
        .parse(req.body),
      o = agendaInput.parse(body);
    const r = db
      .prepare(
        "UPDATE agenda_events SET event_date=?,end_date=?,config=?,revision=revision+1,updated_by=?,updated_at=? WHERE id=? AND revision=? AND deleted_at IS NULL",
      )
      .run(
        o.date,
        o.endDate || o.date,
        JSON.stringify(o),
        req.user.id,
        now(),
        key,
        revision,
      );
    if (!r.changes)
      throw creativeError(
        "Cet événement a été modifié ou retiré par l’équipe. Actualisez l’agenda.",
        409,
      );
    audit(db, req.user, "agenda_updated", { id: key, title: o.title });
    return { id: key, revision: revision + 1 };
  });
  app.delete("/api/agenda/:id", writers, async (req) => {
    const key = z.string().uuid().parse(req.params.id),
      { revision } = z
        .object({ revision: z.number().int().positive() })
        .strict()
        .parse(req.body);
    const r = db
      .prepare(
        "UPDATE agenda_events SET deleted_at=?,revision=revision+1,updated_by=?,updated_at=? WHERE id=? AND revision=? AND deleted_at IS NULL",
      )
      .run(now(), req.user.id, now(), key, revision);
    if (!r.changes)
      throw creativeError(
        "Cet événement a été modifié ou retiré. Actualisez l’agenda.",
        409,
      );
    audit(db, req.user, "agenda_removed", { id: key });
    return { ok: true };
  });
}
