import { z } from "zod";
import { randomBytes } from "node:crypto";
import { settings, saveSettings, audit, now } from "./db.mjs";
import {
  hashPassword,
  verifyPassword,
  hashToken,
  createSession,
  getSession,
} from "./auth.mjs";
import {
  matchesNetwork,
  validateNetwork,
  accountAllowsIP,
} from "./ip-access.mjs";
const fail = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });
export function siteGateRequired(db, req) {
  const cfg = settings(db);
  return (
    !!cfg.accessPinEnabled &&
    !req.user &&
    !db
      .prepare("SELECT 1 FROM site_passes WHERE token_hash=? AND expires_at>?")
      .get(hashToken(String(req.cookies.anipic_gate || "")), now())
  );
}
export function siteAccessHook(db, c) {
  return async (req, reply) => {
    // Strict cookies are withheld on the first cross-site OAuth navigation.
    // Recover only this GET callback from a short-lived, path-scoped Lax cookie.
    // The route still checks role, one-time state, exact session and PKCE.
    if (
      !req.user &&
      req.method === "GET" &&
      req.url.split("?")[0] === "/api/canva/callback"
    ) {
      const returning = getSession(db, req.cookies.anipic_canva_return);
      if (
        returning &&
        accountAllowsIP(db, returning.id, req.ip) &&
        db
          .prepare(
            "SELECT 1 FROM canva_oauth WHERE session_hash=? AND user_id=? AND expires_at>?",
          )
          .get(returning.token_hash, returning.id, now())
      )
        req.user = returning;
    }
    const cfg = settings(db),
      sid = req.user?.token_hash;
    if (sid) {
      const binding = db
        .prepare("SELECT network FROM ip_sessions WHERE token_hash=?")
        .get(sid);
      if (binding && !matchesNetwork(req.ip, binding.network)) req.user = null;
    }
    if (!req.user && !req.cookies.anipic_manual) {
      const network = (cfg.refugeNetworks || []).find((n) =>
        matchesNetwork(req.ip, n),
      );
      const user =
        network && cfg.refugeAgentId
          ? db
              .prepare(
                "SELECT id FROM users WHERE id=? AND role='agent' AND active=1",
              )
              .get(cfg.refugeAgentId)
          : null;
      if (user && accountAllowsIP(db, user.id, req.ip)) {
        const session = createSession(db, user.id);
        db.prepare("INSERT INTO ip_sessions VALUES (?,?)").run(
          hashToken(session.token),
          network,
        );
        reply.setCookie("anipic_session", session.token, {
          path: "/",
          httpOnly: true,
          sameSite: "strict",
          secure: c.secureCookie,
          maxAge: 43200,
        });
        req.cookies.anipic_session = session.token;
        req.user = getSession(db, session.token);
      }
    }
    if (
      siteGateRequired(db, req) &&
      /^(?:\/api\/|\/media\/|\/feed\.xml)/.test(req.url) &&
      !/^\/api\/(?:health|session|gate(?:\/|$)|login(?:\?|$)|demo-session(?:\?|$))/.test(
        req.url,
      )
    )
      return reply
        .code(401)
        .send({ error: "Code d’accès nécessaire.", code: "SITE_PIN_REQUIRED" });
  };
}
export async function registerSiteAccess(app, { db, c, authorized }) {
  app.post(
    "/api/gate/unlock",
    { config: { rateLimit: { max: 6, timeWindow: "15 minutes" } } },
    async (req, reply) => {
      if (req.headers.origin && req.headers.origin !== c.origin)
        throw fail("Origine refusée.", 403);
      const { pin } = z
          .object({ pin: z.string().regex(/^\d{6,12}$/) })
          .strict()
          .parse(req.body),
        cfg = settings(db);
      if (
        !cfg.accessPinEnabled ||
        !cfg.accessPinHash ||
        !(await verifyPassword(pin, cfg.accessPinHash))
      )
        throw fail("Code incorrect.", 401);
      const token = randomBytes(32).toString("base64url");
      db.prepare("INSERT INTO site_passes VALUES (?,?)").run(
        hashToken(token),
        new Date(Date.now() + 30 * 86400000).toISOString(),
      );
      reply.setCookie("anipic_gate", token, {
        httpOnly: true,
        path: "/",
        sameSite: "strict",
        secure: c.secureCookie,
        maxAge: 30 * 86400,
      });
      return { ok: true };
    },
  );
  app.get(
    "/api/admin/site-access",
    { preHandler: authorized(["admin"]) },
    async () => {
      const v = settings(db);
      return {
        enabled: !!v.accessPinEnabled,
        configured: !!v.accessPinHash,
        networks: v.refugeNetworks || [],
        agentId: v.refugeAgentId || "",
        agents: db
          .prepare(
            "SELECT id,name FROM users WHERE role='agent' AND active=1 ORDER BY name",
          )
          .all(),
      };
    },
  );
  app.put(
    "/api/admin/site-access",
    { preHandler: authorized(["admin"]) },
    async (req) => {
      const v = z
        .object({
          enabled: z.boolean(),
          pin: z
            .string()
            .regex(/^(?:|\d{6,12})$/)
            .default(""),
          networks: z.array(z.string().max(80)).max(30),
          agentId: z.union([z.literal(""), z.string().uuid()]),
        })
        .strict()
        .parse(req.body);
      const previous = settings(db),
        networks = v.networks.map(validateNetwork);
      if (v.enabled && !v.pin && !previous.accessPinHash)
        throw fail("Définissez d’abord un code de 6 à 12 chiffres.");
      if (networks.length && !v.agentId)
        throw fail("Choisissez le compte agent du refuge.");
      if (
        v.agentId &&
        !db
          .prepare(
            "SELECT id FROM users WHERE id=? AND role='agent' AND active=1",
          )
          .get(v.agentId)
      )
        throw fail("Choisissez un compte agent actif.");
      const changed =
        previous.refugeAgentId !== v.agentId ||
        JSON.stringify(previous.refugeNetworks || []) !==
          JSON.stringify(networks);
      if (changed)
        db.exec(
          "DELETE FROM sessions WHERE token_hash IN (SELECT token_hash FROM ip_sessions)",
        );
      if (v.pin || v.enabled !== !!previous.accessPinEnabled)
        db.exec("DELETE FROM site_passes");
      saveSettings(db, {
        accessPinEnabled: v.enabled,
        refugeNetworks: networks,
        refugeAgentId: v.agentId,
        ...(v.pin ? { accessPinHash: await hashPassword(v.pin) } : {}),
      });
      audit(db, req.user, "site_access_updated", {
        enabled: v.enabled,
        networks: networks.length,
      });
      return { ok: true };
    },
  );
  app.post("/api/account/manual", async (req, reply) => {
    if (req.headers.origin && req.headers.origin !== c.origin)
      throw fail("Origine refusée.", 403);
    reply.setCookie("anipic_manual", "1", {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: c.secureCookie,
      maxAge: 86400,
    });
    reply.clearCookie("anipic_session", { path: "/" });
    return { ok: true };
  });
}
