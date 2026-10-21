import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { settings, now, id, audit, transaction } from "./db.mjs";
import { hashToken, hashPassword, createSession } from "./auth.mjs";
import { accountAllowsIP } from "./ip-access.mjs";

const fail = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });
const secretFile = (c) => path.join(c.dbDir, ".google-oauth-secret");
export function googleConfiguration(db, c) {
  let stored = "";
  try {
    stored = readFileSync(secretFile(c), "utf8").trim();
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const s = settings(db),
    clientId = c.googleClientId || s.googleClientId || "",
    secret = c.googleClientSecret || stored,
    redirectUri = c.origin + "/api/auth/google/callback";
  let validOrigin = false;
  try {
    const u = new URL(c.origin);
    validOrigin =
      !u.username &&
      !u.password &&
      u.pathname === "/" &&
      !u.search &&
      !u.hash &&
      (u.protocol === "https:" ||
        (u.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)));
  } catch {}
  return {
    enabled: !!s.googleLoginEnabled,
    clientId,
    secret,
    redirectUri,
    validOrigin,
    configured: !!clientId && !!secret && validOrigin,
    secretSource: c.googleClientSecret
      ? "environment"
      : stored
        ? "interface"
        : "none",
  };
}
export async function registerGoogleAuth(app, { db, c, authorized }) {
  const cookieOptions = {
    path: "/api/auth/google",
    httpOnly: true,
    sameSite: "lax",
    secure: c.secureCookie || c.origin.startsWith("https://"),
    maxAge: 600,
  };
  const clientFor = (v) =>
    c.googleClientFactory
      ? c.googleClientFactory(v)
      : new OAuth2Client({
          clientId: v.clientId,
          clientSecret: v.secret,
          redirectUri: v.redirectUri,
          transporterOptions: { timeout: 15000, retry: false },
        });
  const view = () => {
    const { secret, ...v } = googleConfiguration(db, c);
    return { ...v, hasSecret: !!secret };
  };
  app.get("/api/auth/google/status", async () => {
    const v = googleConfiguration(db, c);
    return { available: v.enabled && v.configured };
  });
  app.get(
    "/api/admin/google-auth",
    { preHandler: authorized(["admin"]) },
    async () => view(),
  );
  app.put(
    "/api/admin/google-auth",
    { preHandler: authorized(["admin"]) },
    async (req) => {
      const v = z
        .object({
          enabled: z.boolean(),
          clientId: z
            .string()
            .trim()
            .max(300)
            .regex(/^(?:|[a-zA-Z0-9_.-]+\.apps\.googleusercontent\.com)$/),
          clientSecret: z
            .string()
            .trim()
            .max(1000)
            .regex(/^[\x21-\x7e]*$/)
            .optional(),
          removeSecret: z.boolean().default(false),
        })
        .strict()
        .parse(req.body);
      const old = googleConfiguration(db, c);
      if (
        v.enabled &&
        (!(c.googleClientId || v.clientId) ||
          !(
            c.googleClientSecret ||
            (v.removeSecret ? "" : v.clientSecret || old.secret)
          ) ||
          !old.validOrigin)
      )
        throw fail(
          "Renseignez le client Google, son secret et une APP_ORIGIN HTTPS valide (ou localhost pour les tests).",
        );
      if (v.clientSecret || v.removeSecret) {
        writeFileSync(
          secretFile(c) + ".tmp",
          v.removeSecret ? "" : v.clientSecret,
          { mode: 0o600 },
        );
        renameSync(secretFile(c) + ".tmp", secretFile(c));
      }
      transaction(db, () => {
        for (const [key, value] of Object.entries({
          googleLoginEnabled: v.enabled,
          googleClientId: v.clientId,
        }))
          db.prepare(
            "INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          ).run(key, JSON.stringify(value));
        db.exec("DELETE FROM google_oauth");
        if (!v.enabled)
          db.exec(
            "DELETE FROM sessions WHERE user_id IN (SELECT user_id FROM google_identities)",
          );
      });
      audit(db, req.user, "google_configured", { enabled: v.enabled });
      return view();
    },
  );
  app.post(
    "/api/auth/google/start",
    { config: { rateLimit: { max: 12, timeWindow: "15 minutes" } } },
    async (req, reply) => {
      if (
        req.headers.origin !== c.origin ||
        req.headers["sec-fetch-site"] === "cross-site"
      )
        throw fail("Origine refusée.", 403);
      const v = googleConfiguration(db, c);
      if (!v.enabled || !v.configured)
        throw fail("Connexion Google non configurée.", 503);
      const state = randomBytes(32).toString("base64url"),
        browser = randomBytes(32).toString("base64url"),
        nonce = randomBytes(32).toString("base64url"),
        verifier = randomBytes(48).toString("base64url");
      if (req.cookies.anipic_google?.length <= 100)
        db.prepare("DELETE FROM google_oauth WHERE browser_hash=?").run(
          hashToken(req.cookies.anipic_google),
        );
      db.prepare("DELETE FROM google_oauth WHERE expires_at<?").run(now());
      db.prepare("INSERT INTO google_oauth VALUES (?,?,?,?,?,?)").run(
        hashToken(state),
        hashToken(browser),
        verifier,
        hashToken(nonce),
        v.clientId,
        new Date(Date.now() + 600000).toISOString(),
      );
      if (req.user?.token_hash)
        db.prepare("DELETE FROM sessions WHERE token_hash=?").run(
          req.user.token_hash,
        );
      reply.clearCookie("anipic_session", { path: "/" });
      reply.setCookie("anipic_google", browser, cookieOptions);
      const url = clientFor(v).generateAuthUrl({
        scope: ["openid", "email", "profile"],
        state,
        nonce,
        prompt: "select_account",
        code_challenge: Buffer.from(hashToken(verifier), "hex").toString(
          "base64url",
        ),
        code_challenge_method: "S256",
      });
      return { url };
    },
  );
  app.get(
    "/api/auth/google/callback",
    { config: { rateLimit: { max: 20, timeWindow: "15 minutes" } } },
    async (req, reply) => {
      const result = (code) => reply.redirect("/?google=" + code + "#gallery");
      const q = z
        .object({
          state: z.string().min(20).max(200),
          code: z.string().min(1).max(4096).optional(),
          error: z.string().max(200).optional(),
        })
        .safeParse(req.query);
      const browser = req.cookies.anipic_google;
      if (!q.success || typeof browser !== "string" || browser.length > 100)
        return result("invalid");
      const state = db
        .prepare(
          "SELECT * FROM google_oauth WHERE state_hash=? AND browser_hash=? AND expires_at>?",
        )
        .get(hashToken(q.data.state), hashToken(browser), now());
      if (!state) return result("invalid");
      db.prepare("DELETE FROM google_oauth WHERE state_hash=?").run(
        state.state_hash,
      );
      reply.clearCookie("anipic_google", cookieOptions);
      const cfg = googleConfiguration(db, c);
      if (!cfg.enabled || !cfg.configured || cfg.clientId !== state.client_id)
        return result("unavailable");
      if (q.data.error || !q.data.code) return result("cancelled");
      let payload;
      try {
        const client = clientFor(cfg),
          { tokens } = await client.getToken({
            code: q.data.code,
            codeVerifier: state.verifier,
            redirect_uri: cfg.redirectUri,
          });
        if (!tokens.id_token) throw Error();
        payload = (
          await client.verifyIdToken({
            idToken: tokens.id_token,
            audience: cfg.clientId,
          })
        ).getPayload();
        if (
          !payload ||
          typeof payload.nonce !== "string" ||
          hashToken(payload.nonce) !== state.nonce_hash ||
          typeof payload.sub !== "string" ||
          !payload.sub ||
          payload.sub.length > 255 ||
          payload.email_verified !== true ||
          !z.string().email().max(254).safeParse(payload.email).success ||
          (payload.azp && payload.azp !== cfg.clientId)
        )
          throw Error();
      } catch {
        audit(db, null, "google_login_failed", {});
        return result("invalid");
      }
      let identity = db
        .prepare("SELECT * FROM google_identities WHERE subject=?")
        .get(payload.sub);
      if (!identity) {
        const password = await hashPassword(
          randomBytes(48).toString("base64url"),
        );
        transaction(db, () => {
          identity = db
            .prepare("SELECT * FROM google_identities WHERE subject=?")
            .get(payload.sub);
          if (identity) return;
          const userId = id(),
            label =
              String(payload.name || payload.email.split("@")[0])
                .replace(/[\x00-\x1f\x7f]/g, "")
                .trim()
                .slice(0, 70) || "Bénévole";
          let name = label;
          if (db.prepare("SELECT 1 FROM users WHERE name=?").get(name))
            name = label + " · " + userId.slice(0, 8);
          db.prepare(
            "INSERT INTO users(id,name,password,role,created_at,active) VALUES (?,?,?,'volunteer',?,0)",
          ).run(userId, name, password, now());
          db.prepare(
            "INSERT INTO google_identities(subject,user_id,email,display_name,status,requested_at) VALUES (?,?,?,?,'pending',?)",
          ).run(payload.sub, userId, payload.email, label, now());
          audit(db, { id: userId }, "volunteer_requested", {});
          identity = db
            .prepare("SELECT * FROM google_identities WHERE subject=?")
            .get(payload.sub);
        });
      }
      if (identity.status !== "approved") return result(identity.status);
      const user = db
        .prepare("SELECT id,active FROM users WHERE id=?")
        .get(identity.user_id);
      if (!user?.active || !accountAllowsIP(db, user.id, req.ip))
        return result("disabled");
      const session = createSession(db, user.id);
      reply.setCookie("anipic_session", session.token, {
        path: "/",
        httpOnly: true,
        sameSite: "strict",
        secure: c.secureCookie || c.origin.startsWith("https://"),
        maxAge: 90*86400,
      });
      reply.setCookie("anipic_manual", "1", {
        path: "/",
        httpOnly: true,
        sameSite: "strict",
        secure: c.secureCookie || c.origin.startsWith("https://"),
        maxAge: 86400,
      });
      audit(db, user, "google_login", {});
      return result("connected");
    },
  );
  app.post(
    "/api/admin/volunteers/:id/review",
    { preHandler: authorized(["admin"]) },
    async (req) => {
      const userId = z.string().uuid().parse(req.params.id),
        { decision } = z
          .object({ decision: z.enum(["approve", "reject"]) })
          .strict()
          .parse(req.body);
      const identity = db
        .prepare("SELECT * FROM google_identities WHERE user_id=?")
        .get(userId);
      if (!identity) throw fail("Demande introuvable.", 404);
      if (identity.status === "approved")
        throw fail(
          "Ce compte est déjà validé. Utilisez ses contrôles d’accès.",
          409,
        );
      transaction(db, () => {
        db.prepare(
          "UPDATE google_identities SET status=?,reviewed_at=?,reviewed_by=? WHERE user_id=?",
        ).run(
          decision === "approve" ? "approved" : "rejected",
          now(),
          req.user.id,
          userId,
        );
        db.prepare("UPDATE users SET active=?,role='volunteer' WHERE id=?").run(
          decision === "approve" ? 1 : 0,
          userId,
        );
        db.prepare("DELETE FROM sessions WHERE user_id=?").run(userId);
      });
      audit(
        db,
        req.user,
        "volunteer_" + (decision === "approve" ? "approved" : "rejected"),
        { id: userId },
      );
      return { ok: true };
    },
  );
}
