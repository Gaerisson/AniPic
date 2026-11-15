import { z } from "zod";
import { settings, saveSettings, audit } from "./db.mjs";
import { audiencePages, audienceRetentionDays } from "../shared/audience.mjs";
export const isAudienceRequest = (req) =>
  req.method === "POST" &&
  ["/api/audience/pageview", "/api/audience/preference"].includes(
    req.url.split("?")[0],
  );

export const audienceStatus = (db, req) => ({
  enabled: settings(db).anonymousAudienceEnabled !== false,
  optedOut: req.cookies?.anipic_audience_off === "1",
  globalPrivacyControl: req.headers["sec-gpc"] === "1",
  retentionDays: audienceRetentionDays,
});
const day = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
const cleanup = (db) =>
  db
    .prepare("DELETE FROM audience_daily WHERE day<?")
    .run(day(new Date(Date.now() - audienceRetentionDays * 86400000)));

export async function registerAudience(app, { db, c, authorized }) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS audience_daily(day TEXT NOT NULL,page TEXT NOT NULL,views INTEGER NOT NULL,PRIMARY KEY(day,page))",
  );
  cleanup(db);
  const sameOrigin = async (req, reply) => {
    if (
      req.headers.origin !== c.origin ||
      req.headers["sec-fetch-site"] === "cross-site"
    )
      return reply.code(403).send({ error: "Origine refusée." });
  };
  app.post(
    "/api/audience/pageview",
    {
      bodyLimit: 256,
      preHandler: sameOrigin,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const { page } = z
        .object({ page: z.enum(audiencePages) })
        .strict()
        .parse(req.body);
      const status = audienceStatus(db, req);
      if (status.enabled && !status.optedOut && !status.globalPrivacyControl) {
        db.prepare(
          "INSERT INTO audience_daily(day,page,views) VALUES (?,?,1) ON CONFLICT(day,page) DO UPDATE SET views=views+1",
        ).run(day(), page);
        cleanup(db);
      }
      return reply.code(204).send();
    },
  );
  app.post(
    "/api/audience/preference",
    { preHandler: sameOrigin },
    async (req, reply) => {
      const { optOut } = z
        .object({ optOut: z.boolean() })
        .strict()
        .parse(req.body);
      // A non-identifying, necessary preference; never a visitor identifier.
      reply.setCookie("anipic_audience_off", optOut ? "1" : "0", {
        path: "/",
        httpOnly: false,
        sameSite: "lax",
        secure: c.secureCookie,
        maxAge: 180 * 86400,
      });
      return { ok: true, optedOut: optOut };
    },
  );
  app.put(
    "/api/admin/audience",
    { preHandler: authorized(["admin"]) },
    async (req) => {
      const { enabled } = z
        .object({ enabled: z.boolean() })
        .strict()
        .parse(req.body);
      saveSettings(db, { anonymousAudienceEnabled: enabled });
      audit(db, req.user, "anonymous_audience_updated", { enabled });
      return { enabled };
    },
  );
  app.get(
    "/api/admin/audience",
    { preHandler: authorized(["admin"]) },
    async (req) => {
      const { days } = z
        .object({ days: z.coerce.number().int().min(1).max(90).default(7) })
        .parse(req.query);
      cleanup(db);
      const since = day(new Date(Date.now() - (days - 1) * 86400000));
      const rows = db
        .prepare(
          "SELECT day,page,views FROM audience_daily WHERE day>=? ORDER BY day",
        )
        .all(since);
      const totals = new Map(),
        dates = new Map();
      for (const r of rows) {
        totals.set(r.page, (totals.get(r.page) || 0) + r.views);
        dates.set(r.day, (dates.get(r.day) || 0) + r.views);
      }
      return {
        enabled: settings(db).anonymousAudienceEnabled !== false,
        retentionDays: audienceRetentionDays,
        total: rows.reduce((n, r) => n + r.views, 0),
        daily: [...dates].map(([day, views]) => ({ day, views })),
        pages: [...totals]
          .map(([page, views]) => ({ page, views }))
          .sort((a, b) => b.views - a.views),
        generatedAt: new Date().toISOString(),
      };
    },
  );
}
