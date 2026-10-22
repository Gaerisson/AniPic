import { z } from "zod";
import { id, now, audit } from "./db.mjs";
const team = ["admin", "agent", "editor", "volunteer", "viewer"];
export function pollView(db, row, userId, clock = Date.now()) {
  const config = JSON.parse(row.config),
    votes = db
      .prepare("SELECT user_id,choices FROM team_poll_votes WHERE poll_id=?")
      .all(row.id);
  return {
    id: row.id,
    ...config,
    createdAt: row.created_at,
    closedAt: row.closed_at,
    state:
      row.closed_at || Date.parse(config.closesAt) <= clock
        ? "closed"
        : Date.parse(config.opensAt) > clock
          ? "scheduled"
          : "open",
    participants: votes.length,
    results: config.options.map((option, i) => ({
      option,
      count: votes.filter((v) => JSON.parse(v.choices).includes(i)).length,
    })),
    mine: JSON.parse(votes.find((v) => v.user_id === userId)?.choices || "[]"),
  };
}
export async function registerTeamPolls(app, { db, authorized }) {
  const access = { preHandler: authorized(team) },
    manager = { preHandler: authorized(["admin", "agent"]) };
  app.get("/api/team-polls", access, async (req) => ({
    polls: db
      .prepare("SELECT * FROM team_polls ORDER BY created_at DESC LIMIT 100")
      .all()
      .map((r) => pollView(db, r, req.user.id)),
  }));
  app.post("/api/team-polls", manager, async (req) => {
    const v = z
      .object({
        question: z.string().trim().min(3).max(240),
        kind: z
          .enum(["mission", "presence", "name", "general"])
          .default("general"),
        options: z.array(z.string().trim().min(1).max(90)).min(2).max(12),
        multiple: z.boolean().default(false),
        opensAt: z.string().datetime().optional(),
        closesAt: z.string().datetime().optional(),
      })
      .strict()
      .parse(req.body);
    if (
      new Set(v.options.map((x) => x.toLocaleLowerCase("fr"))).size !==
      v.options.length
    )
      throw Object.assign(Error("Chaque réponse doit être différente."), {
        statusCode: 400,
      });
    v.opensAt = v.opensAt || now();
    v.closesAt =
      v.closesAt ||
      new Date(Date.parse(v.opensAt) + 7 * 86400000).toISOString();
    if (
      Date.parse(v.closesAt) <= Date.parse(v.opensAt) ||
      Date.parse(v.closesAt) < Date.now()
    )
      throw Object.assign(
        Error("La clôture doit suivre l’ouverture du sondage."),
        { statusCode: 400 },
      );
    const key = id();
    db.prepare("INSERT INTO team_polls VALUES (?,?,?,?,NULL)").run(
      key,
      JSON.stringify(v),
      req.user.id,
      now(),
    );
    audit(db, req.user, "team_poll_created", { id: key, kind: v.kind });
    return {
      poll: pollView(
        db,
        db.prepare("SELECT * FROM team_polls WHERE id=?").get(key),
        req.user.id,
      ),
    };
  });
  app.post("/api/team-polls/:id/vote", access, async (req) => {
    const key = z.string().uuid().parse(req.params.id),
      v = z
        .object({ choices: z.array(z.number().int().min(0).max(11)).max(12) })
        .strict()
        .parse(req.body);
    const row = db.prepare("SELECT * FROM team_polls WHERE id=?").get(key);
    if (!row)
      throw Object.assign(Error("Sondage introuvable."), { statusCode: 404 });
    const poll = pollView(db, row, req.user.id);
    if (poll.state !== "open")
      throw Object.assign(Error("Ce sondage n’est pas ouvert."), {
        statusCode: 409,
      });
    const choices = [...new Set(v.choices)];
    if (
      choices.some((i) => i >= poll.options.length) ||
      (!poll.multiple && choices.length > 1)
    )
      throw Object.assign(Error("Réponse invalide."), { statusCode: 400 });
    if (choices.length)
      db.prepare(
        "INSERT INTO team_poll_votes VALUES (?,?,?,?) ON CONFLICT(poll_id,user_id) DO UPDATE SET choices=excluded.choices,updated_at=excluded.updated_at",
      ).run(key, req.user.id, JSON.stringify(choices), now());
    else
      db.prepare(
        "DELETE FROM team_poll_votes WHERE poll_id=? AND user_id=?",
      ).run(key, req.user.id);
    return { poll: pollView(db, row, req.user.id) };
  });
  app.post("/api/team-polls/:id/close", manager, async (req) => {
    const key = z.string().uuid().parse(req.params.id);
    if (
      !db
        .prepare(
          "UPDATE team_polls SET closed_at=COALESCE(closed_at,?) WHERE id=?",
        )
        .run(now(), key).changes
    )
      throw Object.assign(Error("Sondage introuvable."), { statusCode: 404 });
    audit(db, req.user, "team_poll_closed", { id: key });
    return { ok: true };
  });
}
