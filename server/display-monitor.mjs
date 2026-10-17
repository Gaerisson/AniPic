import { z } from "zod";
import { createHash, timingSafeEqual } from "node:crypto";
import { id, now, settings, audit, transaction } from "./db.mjs";
import { hashToken } from "./auth.mjs";
import { displayManagerRoles } from "../shared/page-access.mjs";
import {
  displayIssueLabels,
  displayStateLabels,
  displayScreenHealth,
  displayHeartbeatMs,
  displayOfflineMs,
} from "../shared/display-monitor.mjs";
import { agendaItems } from "./agenda.mjs";
import { parisDate } from "../shared/agenda.mjs";
const fail = (message, statusCode) =>
  Object.assign(new Error(message), { statusCode });
export function displayRevision(db, cfg = settings(db), at = new Date()) {
  const from = parisDate(at),
    end = new Date(from + "T12:00:00Z");
  end.setUTCDate(end.getUTCDate() + 90);
  const keys = [
    "displayEnabled",
    "displaySeconds",
    "displayHiddenIds",
    "displaySpaPhotos",
    "displayReserved",
    "displayQr",
    "displayProgram",
    "refugeName",
    "textDefaults",
    "seasonMessages",
  ];
  return createHash("sha256")
    .update(
      JSON.stringify({
        date: from,
        settings: Object.fromEntries(keys.map((k) => [k, cfg[k]])),
        agenda: agendaItems(db, from, end.toISOString().slice(0, 10), {
          channel: "tv",
          limit: 6,
        }).items.map((e) => [e.id, e.revision]),
      }),
    )
    .digest("hex");
}
export const screenReport = z
  .object({
    id: z.string().uuid(),
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    state: z.enum(Object.keys(displayStateLabels)),
    visible: z.boolean(),
    fullscreen: z.boolean(),
    persistent: z.boolean(),
    width: z.number().int().min(0).max(32000),
    height: z.number().int().min(0).max(32000),
    revision: z.union([z.literal(""), z.string().regex(/^[a-f0-9]{64}$/)]),
    syncAgeMs: z
      .number()
      .int()
      .min(0)
      .max(7 * 86400000)
      .nullable(),
    progressAgeMs: z
      .number()
      .int()
      .min(0)
      .max(7 * 86400000),
    scene: z
      .object({
        key: z.string().max(150),
        title: z.string().max(120),
        type: z.enum([
          "animal",
          "logo",
          "stats",
          "message",
          "video",
          "hours",
          "spa",
          "wallpaper",
        ]),
        position: z.number().min(0).max(86400),
        duration: z.number().min(0).max(86400),
      })
      .strict()
      .nullable(),
    issues: z
      .array(z.enum(Object.keys(displayIssueLabels)))
      .max(7)
      .transform((v) => [...new Set(v)]),
  })
  .strict();
function addEvent(db, screenId, kind, codes, stamp) {
  db.prepare("INSERT INTO display_screen_events VALUES (?,?,?,?,?)").run(
    id(),
    screenId,
    kind,
    JSON.stringify(codes),
    stamp,
  );
  db.prepare(
    "DELETE FROM display_screen_events WHERE screen_id=? AND id NOT IN (SELECT id FROM display_screen_events WHERE screen_id=? ORDER BY occurred_at DESC,rowid DESC LIMIT 50)",
  ).run(screenId, screenId);
}
export async function registerDisplayMonitor(app, { db, c, authorized }) {
  const access = { preHandler: authorized(displayManagerRoles) };
  app.post(
    "/api/public/display/heartbeat",
    {
      bodyLimit: 6000,
      config: { rateLimit: { max: 120, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      if (
        (req.headers.origin && req.headers.origin !== c.origin) ||
        req.headers["sec-fetch-site"] === "cross-site"
      )
        throw fail("Origine de requête refusée.", 403);
      const { id: key, token, ...status } = screenReport.parse(req.body),
        stamp = now(),
        existing = db
          .prepare("SELECT * FROM display_screens WHERE id=?")
          .get(key);
      if (existing) {
        if (
          !timingSafeEqual(
            Buffer.from(existing.token_hash, "hex"),
            Buffer.from(hashToken(token), "hex"),
          )
        )
          throw fail("Identité d’écran invalide.", 403);
        if (existing.revoked_at)
          throw fail("Le suivi de cet écran a été retiré.", 410);
      } else {
        const cutoff = new Date(Date.now() - 3600000).toISOString();
        if (
          db
            .prepare(
              "SELECT COUNT(*) n FROM display_screens WHERE revoked_at IS NULL",
            )
            .get().n >= 100 ||
          db
            .prepare(
              "SELECT COUNT(*) n FROM display_screens WHERE ip=? AND created_at>? ",
            )
            .get(req.ip, cutoff).n >= 10
        )
          throw fail(
            "Trop de nouveaux écrans. Réessayez plus tard ou retirez les anciens écrans du suivi.",
            429,
          );
      }
      const prior = existing ? JSON.parse(existing.status) : null,
        health = displayScreenHealth(status, stamp, status.revision),
        codes = [...health.issues].sort(),
        before = prior
          ? [
              ...displayScreenHealth(prior, existing.last_seen, prior.revision)
                .issues,
            ].sort()
          : [];
      transaction(db, () => {
        if (!existing) {
          db.prepare(
            "INSERT INTO display_screens(id,token_hash,name,ip,user_agent,status,created_at,last_seen,revision) VALUES (?,?,?,?,?,?,?,?,1)",
          ).run(
            key,
            hashToken(token),
            `Écran ${key.slice(0, 6).toUpperCase()}`,
            req.ip,
            String(req.headers["user-agent"] || "").slice(0, 250),
            JSON.stringify(status),
            stamp,
            stamp,
          );
          addEvent(db, key, "connected", [], stamp);
        } else {
          db.prepare(
            "UPDATE display_screens SET ip=?,user_agent=?,status=?,last_seen=? WHERE id=?",
          ).run(
            req.ip,
            String(req.headers["user-agent"] || "").slice(0, 250),
            JSON.stringify(status),
            stamp,
            key,
          );
          if (
            Date.parse(stamp) - Date.parse(existing.last_seen) >
            displayOfflineMs
          )
            addEvent(db, key, "connected", [], stamp);
        }
        if (JSON.stringify(codes) !== JSON.stringify(before)) {
          if (codes.length) addEvent(db, key, "error", codes, stamp);
          else if (before.length) addEvent(db, key, "recovered", before, stamp);
        }
      });
      reply.header("Cache-Control", "no-store");
      return {
        id: key,
        name: existing?.name || `Écran ${key.slice(0, 6).toUpperCase()}`,
        intervalMs: displayHeartbeatMs,
      };
    },
  );
  app.get("/api/admin/display/screens", access, async () => {
    const revision = displayRevision(db),
      at = Date.now();
    const screens = db
      .prepare(
        "SELECT id,name,ip,user_agent,status,created_at,last_seen,revision FROM display_screens WHERE revoked_at IS NULL ORDER BY last_seen DESC",
      )
      .all()
      .map((r) => {
        const status = JSON.parse(r.status),
          health = displayScreenHealth(status, r.last_seen, revision, at);
        return {
          id: r.id,
          name: r.name,
          ip: r.ip,
          browser: r.user_agent,
          createdAt: r.created_at,
          lastSeen: r.last_seen,
          revision: r.revision,
          status,
          ...health,
          lastSyncAt:
            status.syncAgeMs === null
              ? null
              : new Date(
                  Date.parse(r.last_seen) - status.syncAgeMs,
                ).toISOString(),
          events: db
            .prepare(
              "SELECT kind,codes,occurred_at FROM display_screen_events WHERE screen_id=? ORDER BY occurred_at DESC,rowid DESC LIMIT 8",
            )
            .all(r.id)
            .map((e) => ({ ...e, codes: JSON.parse(e.codes) })),
        };
      });
    return {
      screens,
      serverTime: new Date(at).toISOString(),
      offlineAfterMs: displayOfflineMs,
      heartbeatMs: displayHeartbeatMs,
    };
  });
  app.patch("/api/admin/display/screens/:id", access, async (req) => {
    const key = z.string().uuid().parse(req.params.id),
      o = z
        .object({
          name: z.string().trim().min(1).max(80),
          revision: z.number().int().positive(),
        })
        .strict()
        .parse(req.body);
    if (
      !db
        .prepare(
          "UPDATE display_screens SET name=?,revision=revision+1 WHERE id=? AND revision=? AND revoked_at IS NULL",
        )
        .run(o.name, key, o.revision).changes
    )
      throw fail(
        "Cet écran a été modifié ou retiré. Actualisez le suivi.",
        409,
      );
    audit(db, req.user, "display_screen_named", { id: key, name: o.name });
    return { ok: true };
  });
  app.delete("/api/admin/display/screens/:id", access, async (req) => {
    const key = z.string().uuid().parse(req.params.id),
      o = z
        .object({ revision: z.number().int().positive() })
        .strict()
        .parse(req.body);
    if (
      !db
        .prepare(
          "UPDATE display_screens SET revoked_at=?,revision=revision+1 WHERE id=? AND revision=? AND revoked_at IS NULL",
        )
        .run(now(), key, o.revision).changes
    )
      throw fail(
        "Cet écran a été modifié ou retiré. Actualisez le suivi.",
        409,
      );
    audit(db, req.user, "display_screen_removed", { id: key });
    return { ok: true };
  });
}
