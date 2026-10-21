import { z } from "zod";
import { randomBytes } from "node:crypto";
import { signerFactory } from "@fastify/cookie";
import { settings, saveSettings, audit, now, id } from "./db.mjs";
export const privacyVersion = "2026-10-21";
const cookieName = "anipic_privacy";
const seconds = 180 * 86400;
export const legalSchema = z
  .object({
    operatorName: z.string().trim().max(200).default(""),
    operatorAddress: z.string().trim().max(500).default(""),
    contactEmail: z.union([z.literal(""), z.email()]).default(""),
    publicationDirector: z.string().trim().max(200).default(""),
    hostName: z.string().trim().max(200).default(""),
    hostAddress: z.string().trim().max(500).default(""),
    hostContact: z.string().trim().max(200).default(""),
    dpoEmail: z.union([z.literal(""), z.email()]).default(""),
    analyticsEnabled: z.boolean().default(false),
    visitorRetentionDays: z.number().int().min(1).max(30).default(30),
    securityRetentionDays: z.number().int().min(1).max(90).default(30),
    aiPrivacyUrl: z
      .union([z.literal(""), z.url().refine((v) => v.startsWith("https://"))])
      .default(""),
    internationalTransfers: z.string().trim().max(2000).default(""),
  })
  .strict();
export const legalConfig = (db) => legalSchema.parse(settings(db).legal || {});
export function privacyCleanup(db) {
  const l = legalConfig(db);
  db.prepare("DELETE FROM visits WHERE created_at<?").run(
    new Date(Date.now() - l.visitorRetentionDays * 86400000).toISOString(),
  );
  db.prepare("DELETE FROM access_log WHERE created_at<?").run(
    new Date(Date.now() - l.securityRetentionDays * 86400000).toISOString(),
  );
  db.prepare("DELETE FROM privacy_consents WHERE expires_at<?").run(now());
}
export async function registerPrivacy(app, { db, c, authorized }) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS privacy_consents(id TEXT PRIMARY KEY,analytics INTEGER NOT NULL,version TEXT NOT NULL,created_at TEXT NOT NULL,expires_at TEXT NOT NULL)",
  );
  let secret = db
    .prepare("SELECT value FROM app_secrets WHERE name='consent_signing'")
    .get()?.value;
  if (!secret) {
    secret = randomBytes(32).toString("base64url");
    db.prepare("INSERT INTO app_secrets VALUES (?,?)").run(
      "consent_signing",
      secret,
    );
  }
  // Cookie signing is explicitly scoped here; the authentication cookies remain opaque tokens.
  const signer = signerFactory(secret);
  app.get("/api/privacy", async (req) => ({
    version: privacyVersion,
    legal: legalConfig(db),
    consent: read(req),
    complete: complete(legalConfig(db)),
  }));
  function read(req) {
    try {
      const raw = req.cookies[cookieName];
      if (!raw) return { decided: false, analytics: false };
      const unsigned = signer.unsign(raw);
      if (!unsigned.valid) return { decided: false, analytics: false };
      const v = JSON.parse(unsigned.value);
      return v.version === privacyVersion &&
        v.at <= Date.now() + 60000 &&
        v.at > Date.now() - seconds * 1000
        ? { decided: true, analytics: v.analytics === true, version: v.version }
        : { decided: false, analytics: false };
    } catch {
      return { decided: false, analytics: false };
    }
  }
  app.decorate("audienceConsent", read);
  app.post(
    "/api/privacy/consent",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req, reply) => {
      if (req.headers.origin !== c.origin)
        return reply.code(403).send({ error: "Origine refusée." });
      const v = z
          .object({
            analytics: z.boolean(),
            version: z.literal(privacyVersion),
          })
          .strict()
          .parse(req.body),
        choice = {
          version: privacyVersion,
          analytics: v.analytics && legalConfig(db).analyticsEnabled,
          at: Date.now(),
          receipt: id(),
        };
      db.prepare("INSERT INTO privacy_consents VALUES (?,?,?,?,?)").run(
        choice.receipt,
        Number(choice.analytics),
        privacyVersion,
        new Date(choice.at).toISOString(),
        new Date(choice.at + seconds * 1000).toISOString(),
      );
      const signed = signer.sign(JSON.stringify(choice));
      reply.setCookie(cookieName, signed, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: c.secureCookie,
        maxAge: seconds,
      });
      return {
        ok: true,
        consent: {
          decided: true,
          analytics: choice.analytics,
          version: privacyVersion,
        },
      };
    },
  );
  app.get(
    "/api/admin/legal",
    { preHandler: authorized(["admin"]) },
    async () => ({
      legal: legalConfig(db),
      complete: complete(legalConfig(db)),
    }),
  );
  app.put(
    "/api/admin/legal",
    { preHandler: authorized(["admin"]) },
    async (req) => {
      const legal = legalSchema.parse(req.body);
      saveSettings(db, { legal });
      privacyCleanup(db);
      audit(db, req.user, "legal_settings_updated", {
        analyticsEnabled: legal.analyticsEnabled,
      });
      return { ok: true, complete: complete(legal) };
    },
  );
  app.get(
    "/api/account/data",
    {
      preHandler: authorized([
        "admin",
        "agent",
        "editor",
        "volunteer",
        "viewer",
      ]),
    },
    async (req) => ({
      generatedAt: now(),
      account: db
        .prepare("SELECT id,name,role,created_at FROM users WHERE id=?")
        .get(req.user.id),
      devices: db
        .prepare(
          "SELECT id,created_at,last_seen,ip,user_agent FROM session_devices d JOIN sessions s ON s.token_hash=d.token_hash WHERE s.user_id=?",
        )
        .all(req.user.id),
      availability: db
        .prepare(
          "SELECT day,config FROM volunteer_availability WHERE user_id=?",
        )
        .all(req.user.id),
      participations: db
        .prepare(
          "SELECT shift_id,state,note,updated_at FROM volunteer_signups WHERE user_id=?",
        )
        .all(req.user.id),
      notificationPreferences:
        db
          .prepare(
            "SELECT config FROM notification_preferences WHERE user_id=?",
          )
          .get(req.user.id) || null,
    }),
  );
  privacyCleanup(db);
  if (c.scheduler !== false) {
    const timer = setInterval(() => privacyCleanup(db), 3600000);
    timer.unref();
    app.addHook("onClose", async () => clearInterval(timer));
  }
}
function complete(l) {
  return !!(
    l.operatorName &&
    l.operatorAddress &&
    l.contactEmail &&
    l.publicationDirector &&
    l.hostName &&
    l.hostAddress &&
    l.hostContact
  );
}
