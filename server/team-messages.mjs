import { z } from "zod";
import { id, now, audit } from "./db.mjs";
export async function registerMessages(app, { db, authorized }) {
  const roles = ["admin", "editor", "agent", "viewer"];
  const visible = (req) =>
    db
      .prepare(
        "SELECT m.*,r.read_at FROM team_messages m LEFT JOIN message_receipts r ON r.message_id=m.id AND r.user_id=? WHERE m.deleted_at IS NULL AND (m.expires_at IS NULL OR m.expires_at>?) AND (m.target_user=? OR (m.target_user IS NULL AND (m.target_role IS NULL OR m.target_role=?))) ORDER BY m.created_at DESC LIMIT 50",
      )
      .all(req.user.id, now(), req.user.id, req.user.role);
  app.get("/api/messages", { preHandler: authorized(roles) }, async (req) =>
    visible(req),
  );
  app.post(
    "/api/messages/:id/read",
    { preHandler: authorized(roles) },
    async (req) => {
      const messageId = z.string().uuid().parse(req.params.id);
      if (!visible(req).some((m) => m.id === messageId)) return { ok: true };
      db.prepare("INSERT OR IGNORE INTO message_receipts VALUES (?,?,?)").run(
        messageId,
        req.user.id,
        now(),
      );
      return { ok: true };
    },
  );
  app.get(
    "/api/admin/messages",
    { preHandler: authorized(["admin"]) },
    async () =>
      db
        .prepare(
          "SELECT m.*,u.name author,v.name recipient,(SELECT COUNT(*) FROM message_receipts r WHERE r.message_id=m.id) read_count FROM team_messages m LEFT JOIN users u ON u.id=m.created_by LEFT JOIN users v ON v.id=m.target_user WHERE m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 100",
        )
        .all(),
  );
  app.post(
    "/api/admin/messages",
    { preHandler: authorized(["admin"]) },
    async (req, reply) => {
      const input = z
        .object({
          title: z.string().trim().min(1).max(100),
          body: z.string().trim().min(1).max(2500),
          targetUser: z.string().uuid().nullable().default(null),
          targetRole: z.enum(roles).nullable().default("agent"),
          days: z.number().int().min(1).max(90).default(7),
        })
        .parse(req.body);
      if (
        input.targetUser &&
        !db
          .prepare("SELECT id FROM users WHERE id=? AND active=1")
          .get(input.targetUser)
      )
        return reply.code(400).send({ error: "Destinataire introuvable." });
      const messageId = id();
      db.prepare("INSERT INTO team_messages VALUES (?,?,?,?,?,?,?,?,NULL)").run(
        messageId,
        input.title,
        input.body,
        input.targetUser,
        input.targetUser ? null : input.targetRole,
        req.user.id,
        now(),
        new Date(Date.now() + input.days * 86400_000).toISOString(),
      );
      audit(db, req.user, "team_message_sent", { id: messageId });
      return reply.code(201).send({ id: messageId });
    },
  );
  app.delete(
    "/api/admin/messages/:id",
    { preHandler: authorized(["admin"]) },
    async (req) => {
      const messageId = z.string().uuid().parse(req.params.id);
      db.prepare("UPDATE team_messages SET deleted_at=? WHERE id=?").run(
        now(),
        messageId,
      );
      audit(db, req.user, "team_message_withdrawn", { id: messageId });
      return { ok: true };
    },
  );
}
