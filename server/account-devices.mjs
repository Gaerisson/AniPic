import { z } from "zod";
import { id, now, audit } from "./db.mjs";
import { hashToken } from "./auth.mjs";
const roles = ["admin", "agent", "editor", "volunteer", "viewer"];
export const sessionLifetime = 90 * 86400;
export function trackDevice(db, c, req, reply) {
  if (!req.user || !req.cookies.anipic_session) return;
  const hash = req.user.token_hash,
    at = now(),
    row = db
      .prepare("SELECT * FROM session_devices WHERE token_hash=?")
      .get(hash);
  if (!row)
    db.prepare("INSERT INTO session_devices VALUES (?,?,?,?,?,?,?)").run(
      hash,
      id(),
      at,
      at,
      req.ip,
      String(req.headers["user-agent"] || "").slice(0, 300),
      "",
    );
  else if (Date.now() - Date.parse(row.last_seen) > 60000)
    db.prepare(
      "UPDATE session_devices SET last_seen=?,ip=?,user_agent=? WHERE token_hash=?",
    ).run(
      at,
      req.ip,
      String(req.headers["user-agent"] || "").slice(0, 300),
      hash,
    );
  const session = db
    .prepare("SELECT expires_at FROM sessions WHERE token_hash=?")
    .get(hash);
  if (
    session &&
    Date.parse(session.expires_at) - Date.now() < 30 * 86400000 &&
    !db.prepare("SELECT 1 FROM ip_sessions WHERE token_hash=?").get(hash)
  ) {
    db.prepare("UPDATE sessions SET expires_at=? WHERE token_hash=?").run(
      new Date(Date.now() + sessionLifetime * 1000).toISOString(),
      hash,
    );
    reply.setCookie("anipic_session", req.cookies.anipic_session, {
      httpOnly: true,
      path: "/",
      sameSite: "strict",
      secure: c.secureCookie,
      maxAge: sessionLifetime,
    });
  }
}
export async function registerDevices(app, { db, authorized }) {
  const all = { preHandler: authorized(roles) };
  function account(req) {
    const target = req.query.userId
      ? z.string().uuid().parse(req.query.userId)
      : req.user.id;
    if (target !== req.user.id && req.user.role !== "admin")
      throw Object.assign(Error("Accès réservé à votre compte."), {
        statusCode: 403,
      });
    return target;
  }
  app.get("/api/account/devices", all, async (req) => {
    const target = account(req);
    return {
      userId: target,
      devices: db
        .prepare(
          "SELECT d.id,d.created_at,d.last_seen,d.ip,d.user_agent,d.label,s.expires_at,d.token_hash FROM session_devices d JOIN sessions s ON s.token_hash=d.token_hash WHERE s.user_id=? AND s.expires_at>? ORDER BY d.last_seen DESC",
        )
        .all(target, now())
        .map(({ token_hash, ...d }) => ({
          ...d,
          current: token_hash === req.user.token_hash,
        })),
      totalSessions: db
        .prepare(
          "SELECT COUNT(*) n FROM sessions WHERE user_id=? AND expires_at>?",
        )
        .get(target, now()).n,
    };
  });
  app.delete("/api/account/devices/:id", all, async (req) => {
    const target = account(req),
      key = z.string().uuid().parse(req.params.id),
      row = db
        .prepare(
          "SELECT d.token_hash FROM session_devices d JOIN sessions s ON s.token_hash=d.token_hash WHERE d.id=? AND s.user_id=?",
        )
        .get(key, target);
    if (!row)
      throw Object.assign(Error("Appareil introuvable."), { statusCode: 404 });
    db.prepare("DELETE FROM sessions WHERE token_hash=?").run(row.token_hash);
    audit(db, req.user, "device_revoked", { userId: target, deviceId: key });
    return { ok: true, current: row.token_hash === req.user.token_hash };
  });
  app.post("/api/account/disconnect", all, async (req) => {
    const target = account(req),
      v = z
        .object({ includeCurrent: z.boolean().default(false) })
        .parse(req.body || {});
    const result = db
      .prepare("DELETE FROM sessions WHERE user_id=? AND (? OR token_hash!=?)")
      .run(
        target,
        Number(v.includeCurrent || target !== req.user.id),
        req.user.token_hash,
      );
    audit(db, req.user, "account_sessions_revoked", {
      userId: target,
      count: result.changes,
    });
    return { ok: true, count: result.changes };
  });
}
