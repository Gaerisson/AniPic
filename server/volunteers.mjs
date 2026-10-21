import { z } from "zod";
import { id, now, audit, transaction } from "./db.mjs";
import { agendaDate } from "./agenda.mjs";
import { shiftKinds } from "../shared/volunteers.mjs";
import { parisDate } from "../shared/agenda.mjs";
import { notice } from "./notifications.mjs";
const roles = ["admin", "agent", "editor", "volunteer", "viewer"],
  managers = ["admin", "agent"];
const fail = (message, statusCode = 400) =>
  Object.assign(Error(message), { statusCode });
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const shift = z
  .object({
    title: z.string().trim().min(2).max(100),
    date: agendaDate,
    start: clock,
    end: clock,
    kind: z.enum(Object.keys(shiftKinds)),
    location: z.string().trim().max(120).default(""),
    description: z.string().trim().max(1000).default(""),
    capacity: z.number().int().min(0).max(100).default(0),
  })
  .strict()
  .refine((v) => v.end > v.start, "La fin doit être après le début.");
export function volunteerDays(db, from, to, userId) {
  const shifts = db
    .prepare(
      "SELECT * FROM volunteer_shifts WHERE day BETWEEN ? AND ? AND deleted_at IS NULL ORDER BY day,json_extract(config,'$.start'),id",
    )
    .all(from, to)
    .map((row) => ({
      ...JSON.parse(row.config),
      id: row.id,
      revision: row.revision,
      participants: db
        .prepare(
          "SELECT p.user_id,u.name,p.state,p.note,p.updated_at FROM volunteer_signups p JOIN users u ON u.id=p.user_id WHERE p.shift_id=? AND u.active=1 ORDER BY p.updated_at",
        )
        .all(row.id),
      mine:
        db
          .prepare(
            "SELECT state FROM volunteer_signups WHERE shift_id=? AND user_id=?",
          )
          .get(row.id, userId)?.state || null,
    }));
  const availability = db
    .prepare(
      "SELECT a.*,u.name FROM volunteer_availability a JOIN users u ON u.id=a.user_id WHERE a.day BETWEEN ? AND ? AND u.active=1 ORDER BY a.day,u.name",
    )
    .all(from, to)
    .map((a) => ({
      userId: a.user_id,
      name: a.name,
      date: a.day,
      ...JSON.parse(a.config),
      mine: a.user_id === userId,
    }));
  const dates = [
    ...new Set([
      ...shifts.map((s) => s.date),
      ...availability.map((a) => a.date),
    ]),
  ].sort();
  return {
    shifts,
    availability,
    days: dates.map((date) => {
      const today = shifts.filter((s) => s.date === date),
        present = new Map();
      for (const s of today)
        for (const p of s.participants.filter((p) => p.state === "yes")) {
          const entry = present.get(p.user_id) || {
            id: p.user_id,
            name: p.name,
            tasks: [],
          };
          entry.tasks.push(`${s.title} · ${s.start}–${s.end}`);
          present.set(p.user_id, entry);
        }
      for (const a of availability.filter(
        (a) => a.date === date && a.available,
      )) {
        const e = present.get(a.userId) || {
          id: a.userId,
          name: a.name,
          tasks: [],
        };
        e.tasks.push(`${a.task || "Disponible"} · ${a.start}–${a.end}`);
        present.set(a.userId, e);
      }
      return {
        date,
        people: [...present.values()],
        confirmed: present.size,
        openPlaces: today.reduce(
          (n, s) =>
            n +
            Math.max(
              0,
              s.capacity -
                s.participants.filter((p) => p.state === "yes").length,
            ),
          0,
        ),
      };
    }),
  };
}
export async function registerVolunteers(app, { db, authorized }) {
  const read = { preHandler: authorized(roles) },
    manage = { preHandler: authorized(managers) };
  app.get("/api/volunteers", read, async (req) => {
    const q = z
        .object({
          from: agendaDate.default(parisDate()),
          to: agendaDate.optional(),
        })
        .parse(req.query),
      to = q.to || q.from;
    if (to < q.from || Date.parse(to) - Date.parse(q.from) > 93 * 86400000)
      throw fail("Choisissez une période de 93 jours maximum.");
    return volunteerDays(db, q.from, to, req.user.id);
  });
  app.post("/api/volunteers/shifts", manage, async (req) => {
    const { repeatWeeks, ...body } = z
        .object({ repeatWeeks: z.number().int().min(1).max(12).default(1) })
        .passthrough()
        .parse(req.body),
      v = shift.parse(body),
      created = [];
    transaction(db, () => {
      for (let i = 0; i < repeatWeeks; i++) {
        const day = new Date(v.date + "T12:00:00Z");
        day.setUTCDate(day.getUTCDate() + i * 7);
        const d = day.toISOString().slice(0, 10),
          key = id();
        db.prepare(
          "INSERT INTO volunteer_shifts VALUES (?,?,?,1,?,?,?,NULL)",
        ).run(
          key,
          d,
          JSON.stringify({ ...v, date: d }),
          req.user.id,
          now(),
          now(),
        );
        created.push(key);
      }
      audit(db, req.user, "volunteer_shifts_created", {
        count: created.length,
        title: v.title,
      });
    });
    return { ok: true, ids: created };
  });
  app.put("/api/volunteers/shifts/:id", manage, async (req) => {
    const key = z.string().uuid().parse(req.params.id),
      { revision, ...body } = req.body || {},
      v = shift.parse(body);
    z.number().int().positive().parse(revision);
    if (
      !db
        .prepare(
          "UPDATE volunteer_shifts SET day=?,config=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND deleted_at IS NULL",
        )
        .run(v.date, JSON.stringify(v), now(), key, revision).changes
    )
      throw fail("Créneau modifié. Actualisez avant de réessayer.", 409);
    for (const p of db
      .prepare(
        "SELECT user_id FROM volunteer_signups WHERE shift_id=? AND state!='no'",
      )
      .all(key))
      notice(db, {
        id: "shift:" + key + ":" + (revision + 1) + ":" + p.user_id,
        kind: "planning",
        userId: p.user_id,
        title: "Votre créneau a été modifié",
        body: v.title + " · " + v.date,
        url: "/?app=android#volunteers",
      });
    return { ok: true };
  });
  app.delete("/api/volunteers/shifts/:id", manage, async (req) => {
    const key = z.string().uuid().parse(req.params.id),
      v = z.object({ revision: z.number().int().positive() }).parse(req.body);
    if (
      !db
        .prepare(
          "UPDATE volunteer_shifts SET deleted_at=?,revision=revision+1 WHERE id=? AND revision=? AND deleted_at IS NULL",
        )
        .run(now(), key, v.revision).changes
    )
      throw fail("Créneau modifié ou déjà retiré.", 409);
    audit(db, req.user, "volunteer_shift_cancelled", { id: key });
    const info = JSON.parse(
      db.prepare("SELECT config FROM volunteer_shifts WHERE id=?").get(key)
        .config,
    );
    for (const p of db
      .prepare(
        "SELECT user_id FROM volunteer_signups WHERE shift_id=? AND state!='no'",
      )
      .all(key))
      notice(db, {
        id: "cancel:" + key + ":" + p.user_id,
        kind: "planning",
        userId: p.user_id,
        title: "Créneau annulé",
        body: info.title + " · " + info.date,
        url: "/?app=android#volunteers",
      });
    return { ok: true };
  });
  app.put("/api/volunteers/shifts/:id/participation", read, async (req) => {
    const key = z.string().uuid().parse(req.params.id),
      v = z
        .object({
          state: z.enum(["yes", "no", "maybe", "waitlist"]),
          note: z.string().trim().max(300).default(""),
          userId: z.string().uuid().optional(),
        })
        .strict()
        .parse(req.body),
      target = v.userId || req.user.id;
    if (target !== req.user.id && !managers.includes(req.user.role))
      throw fail("Vous ne pouvez modifier que votre inscription.", 403);
    return transaction(db, () => {
      const row = db
        .prepare(
          "SELECT * FROM volunteer_shifts WHERE id=? AND deleted_at IS NULL",
        )
        .get(key);
      if (!row) throw fail("Créneau introuvable.", 404);
      if (
        !db.prepare("SELECT id FROM users WHERE id=? AND active=1").get(target)
      )
        throw fail("Compte inactif.", 404);
      const cfg = JSON.parse(row.config),
        old = db
          .prepare(
            "SELECT state FROM volunteer_signups WHERE shift_id=? AND user_id=?",
          )
          .get(key, target)?.state;
      if (
        v.state === "yes" &&
        old !== "yes" &&
        cfg.capacity &&
        db
          .prepare(
            "SELECT COUNT(*) n FROM volunteer_signups p JOIN users u ON u.id=p.user_id WHERE shift_id=? AND state='yes' AND u.active=1",
          )
          .get(key).n >= cfg.capacity
      )
        throw fail(
          "Créneau complet. Inscrivez-vous sur la liste d’attente.",
          409,
        );
      db.prepare(
        "INSERT INTO volunteer_signups VALUES (?,?,?,?,?) ON CONFLICT(shift_id,user_id) DO UPDATE SET state=excluded.state,note=excluded.note,updated_at=excluded.updated_at",
      ).run(key, target, v.state, v.note, now());
      audit(db, req.user, "volunteer_participation", {
        shiftId: key,
        userId: target,
        state: v.state,
      });
      return { ok: true };
    });
  });
  app.put("/api/volunteers/availability/:date", read, async (req) => {
    const date = agendaDate.parse(req.params.date),
      v = z
        .object({
          available: z.boolean(),
          start: clock,
          end: clock,
          task: z.string().trim().max(100).default(""),
          note: z.string().trim().max(300).default(""),
        })
        .strict()
        .refine((v) => v.end > v.start, "La fin doit être après le début.")
        .parse(req.body);
    db.prepare(
      "INSERT INTO volunteer_availability VALUES (?,?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET config=excluded.config,updated_at=excluded.updated_at",
    ).run(req.user.id, date, JSON.stringify(v), now());
    return { ok: true };
  });
  app.get("/api/volunteers/export", manage, async (req, reply) => {
    const day = agendaDate.parse(req.query.date),
      data = volunteerDays(db, day, day, req.user.id),
      cell = (x) =>
        '"' +
        String(x)
          .replace(/^[=+@-]/, "'")
          .replaceAll('"', '""') +
        '"';
    return reply
      .type("text/csv; charset=utf-8")
      .header(
        "Content-Disposition",
        'attachment; filename="presences-' + day + '.csv"',
      )
      .send(
        "\uFEFF" +
          [
            ["Date", "Bénévole", "Tâches"],
            ...(data.days[0]?.people || []).map((p) => [
              day,
              p.name,
              p.tasks.join(" / "),
            ]),
          ]
            .map((r) => r.map(cell).join(";"))
            .join("\r\n"),
      );
  });
}
