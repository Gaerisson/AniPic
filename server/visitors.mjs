import { geoLocation, geoReader } from "./geoip.mjs";
import { createHash } from "node:crypto";
import { z } from "zod";
import { id, now } from "./db.mjs";
import { normalizedIP, matchesNetwork } from "./ip-access.mjs";
import { legalConfig } from "./privacy.mjs";
const dayKey = (at) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
function midnight(day) {
  const target = Date.parse(day + "T00:00:00Z");
  let value = target;
  const format = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let i = 0; i < 3; i++)
    value +=
      target -
      Date.parse(format.format(new Date(value)).replace(" ", "T") + "Z");
  return new Date(value).toISOString();
}
export function browserInfo(ua = "") {
  return {
    browser: /Edg\//.test(ua)
      ? "Edge"
      : /OPR\//.test(ua)
        ? "Opera"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Autre",
    os: /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad/.test(ua)
        ? "iOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS/.test(ua)
            ? "macOS"
            : /Linux/.test(ua)
              ? "Linux"
              : "Autre",
    device: /bot|crawler|spider/i.test(ua)
      ? "Robot"
      : /Mobile|Android|iPhone/i.test(ua)
        ? "Mobile"
        : "Ordinateur / TV",
  };
}
export async function registerVisitors(app, { db, c, authorized }) {
  app.post(
    "/api/visit",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req, reply) => {
      if (req.headers.origin && req.headers.origin !== c.origin)
        return reply.code(403).send({ error: "Origine refusée." });
      if (
        !legalConfig(db).analyticsEnabled ||
        !app.audienceConsent(req).analytics ||
        req.headers["sec-gpc"] === "1"
      )
        return reply.code(204).send();
      const v = z
        .object({
          session: z.string().uuid(),
          path: z.string().regex(/^#[a-zA-Z]{1,30}$/),
        })
        .strict()
        .parse(req.body);
      const ip = normalizedIP(req.ip) || "unknown",
        sessionHash = createHash("sha256").update(v.session).digest("hex");
      if (
        db
          .prepare(
            "SELECT 1 FROM visits WHERE session_hash=? AND path=? AND user_id IS ? AND created_at>? LIMIT 1",
          )
          .get(
            sessionHash,
            v.path,
            req.user?.id || null,
            new Date(Date.now() - 15000).toISOString(),
          )
      )
        return { ok: true };
      const trusted =
        c.trustProxy &&
        Array.isArray(c.trustProxy) &&
        c.trustProxy.some((net) =>
          matchesNetwork(req.socket.remoteAddress, net),
        );
      const country =
        trusted && c.visitorCountryHeader
          ? String(
              req.headers[c.visitorCountryHeader.toLowerCase()] || "",
            ).toUpperCase()
          : "";
      db.prepare("INSERT INTO visits VALUES (?,?,?,?,?,?,?,?)").run(
        id(),
        sessionHash,
        ip,
        /^[A-Z]{2}$/.test(country) ? country : null,
        v.path,
        String(req.headers["user-agent"] || "").slice(0, 500),
        req.user?.id || null,
        now(),
      );
      db.prepare("DELETE FROM visits WHERE created_at<?").run(
        new Date(
          Date.now() - legalConfig(db).visitorRetentionDays * 86400000,
        ).toISOString(),
      );
      return { ok: true };
    },
  );
  app.get(
    "/api/admin/visitors",
    { preHandler: authorized(["admin"]) },
    async (req) => {
      const { days, query } = z
        .object({
          days: z.coerce.number().int().min(1).max(30).default(7),
          query: z.string().max(100).default(""),
        })
        .parse(req.query);
      const today = dayKey(new Date()),
        dayKeys = Array.from({ length: days }, (_, i) =>
          new Date(Date.parse(today + "T12:00:00Z") - (days - 1 - i) * 86400000)
            .toISOString()
            .slice(0, 10),
        ),
        since = midnight(dayKeys[0]);
      const rows = db
        .prepare(
          "SELECT v.*,u.name account FROM visits v LEFT JOIN users u ON u.id=v.user_id WHERE v.created_at>=? AND (?='' OR instr(v.ip,?)>0 OR instr(lower(COALESCE(u.name,'')),lower(?))>0 OR instr(lower(v.path),lower(?))>0) ORDER BY v.created_at DESC LIMIT 500",
        )
        .all(since, query, query, query, query);
      const summary = db
        .prepare(
          "SELECT COUNT(*) pageviews,COUNT(DISTINCT session_hash) sessions,COUNT(DISTINCT ip) addresses,COUNT(DISTINCT user_id) accounts FROM visits WHERE created_at>=?",
        )
        .get(since);
      const daily = dayKeys.map((day, i) => ({
        day,
        ...db
          .prepare(
            "SELECT COUNT(*) views,COUNT(DISTINCT session_hash) sessions FROM visits WHERE created_at>=? AND created_at<?",
          )
          .get(
            midnight(day),
            i + 1 < dayKeys.length
              ? midnight(dayKeys[i + 1])
              : new Date(
                  Date.parse(today + "T12:00:00Z") + 86400000,
                ).toISOString(),
          ),
      }));
      const agentCounts = db
        .prepare(
          "SELECT user_agent,COUNT(*) n FROM visits WHERE created_at>=? GROUP BY user_agent",
        )
        .all(since);
      const group = (field) => {
        const values = new Map();
        for (const r of agentCounts) {
          const name = browserInfo(r.user_agent)[field];
          values.set(name, (values.get(name) || 0) + r.n);
        }
        return [...values]
          .map(([name, views]) => ({ name, views }))
          .sort((a, b) => b.views - a.views);
      };
      const unusedCountries = db
        .prepare(
          "SELECT country name,COUNT(*) views FROM visits WHERE created_at>=? GROUP BY country ORDER BY views DESC LIMIT 8",
        )
        .all(since);
      const online = db
        .prepare(
          "SELECT COUNT(DISTINCT session_hash) n FROM visits WHERE created_at>=?",
        )
        .get(new Date(Date.now() - 300000).toISOString()).n;
      const pages = db
        .prepare(
          "SELECT path,COUNT(*) views FROM visits WHERE created_at>=? GROUP BY path ORDER BY views DESC LIMIT 10",
        )
        .all(since);
      const locations = new Map();
      const addressCounts = db
        .prepare(
          "SELECT ip,COUNT(*) views FROM visits WHERE created_at>=? GROUP BY ip",
        )
        .all(since);
      const countryCounts = new Map();
      for (const row of addressCounts) {
        const location = await geoLocation(c, row.ip);
        locations.set(row.ip, location);
        const key = location.country || null;
        countryCounts.set(key, (countryCounts.get(key) || 0) + row.views);
      }
      const countries = [...countryCounts]
        .map(([name, views]) => ({ name, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 8);
      const geo = await geoReader(c)
        .then((v) => ({ source: v.source, updatedAt: v.updatedAt }))
        .catch(() => null);
      const legal = legalConfig(db),
        consent = app.audienceConsent(req);
      return {
        collection: {
          enabled: legal.analyticsEnabled,
          consent: !consent.decided
            ? "undecided"
            : consent.analytics
              ? "accepted"
              : "refused",
          globalPrivacyControl: req.headers["sec-gpc"] === "1",
        },
        geoip: geo,
        summary: { ...summary, online },
        breakdowns: {
          browsers: group("browser"),
          devices: group("device"),
          countries,
        },
        generatedAt: now(),
        daily,
        pages,
        rows: rows.map((r) => ({
          ...r,
          location: locations.get(r.ip),
          country: r.country || locations.get(r.ip)?.country || null,
          session_hash: undefined,
          ...browserInfo(r.user_agent),
        })),
        retentionDays: legal.visitorRetentionDays,
        countrySource: geo
          ? "local"
          : c.visitorCountryHeader
            ? "proxy"
            : "unconfigured",
      };
    },
  );
}
