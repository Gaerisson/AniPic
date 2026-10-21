import {
  compatibilityState,
  normalizeCompatibility,
} from "../shared/compatibility-text.mjs";
import { hasAnimalInfo } from "../shared/animal-info.mjs";
import { registerInternalRegister } from "./internal-register.mjs";
import { registerGroupPosters } from "./group-posters.mjs";
import { registerMobileWeb } from "./mobile-web.mjs";
import { registerCreativeWorkshop } from "./creative-workshop.mjs";
import { registerArchiveCompression } from "./archive-compression.mjs";
import { appVersion } from "../shared/version.mjs";
import { registerGoogleAuth } from "./google-auth.mjs";
import { mediaMaintenance } from "./media-maintenance.mjs";
import { createHash } from "node:crypto";
import { registerArchiveFolders } from "./archive-folders.mjs";
import { recordError, registerJournal } from "./journal.mjs";
import { registerStorageHealth } from "./storage-health.mjs";
import { registerTrash, isAnimalTrashed } from "./trash.mjs";
import { animalPresence, missingAnimalIds } from "./source-presence.mjs";
import { animalCsv } from "../shared/animal-csv.mjs";
import { sourceHealth } from "./source-health.mjs";
import {
  adoptionOrigin,
  pendingAdoptionCount,
  registerAdoptionReviews,
  reviewForAnimal,
  settleDueAdoptions,
} from "./source-adoption.mjs";
import { cachedSourceMatch } from "./source-match.mjs";
import {
  siteAccessHook,
  registerSiteAccess,
  siteGateRequired,
} from "./site-access.mjs";
import { audioConfig } from "./audio-settings.mjs";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { registerUserAvatars } from "./user-avatars.mjs";
import multipart from "@fastify/multipart";
import serveStatic from "@fastify/static";
import { z } from "zod";
import { createReadStream, existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { config, root, assertStorage } from "./config.mjs";
import {
  openDb,
  id,
  now,
  settings,
  saveSettings,
  audit,
  transaction,
  feedEvent,
} from "./db.mjs";
import {
  getSession,
  verifyPassword,
  createSession,
  createUser,
  hashPassword,
} from "./auth.mjs";
import { ingest, derivative, directoryBytes, sweepCache } from "./storage.mjs";
import { createBackup, pruneBackups } from "./backup.mjs";
import { normalizeSnapshot, applySnapshot, synchronize } from "./source.mjs";
import { registerExtras } from "./extras.mjs";
import { accountAllowsIP, normalizedIP } from "./ip-access.mjs";
import {
  sourceFields,
  interfaceFields,
  interfaceDefaults,
} from "./preferences-schema.mjs";
import { diagnoseSource } from "./source-diagnostics.mjs";
import { publicAnimalMetadata, publicCompatibility } from "./animal-facts.mjs";
import { assistantAvatarUrl, adminSettingsView } from "./assistant-avatar.mjs";
import { photoPriority, photoPrioritySql } from "../shared/photo-priority.mjs";
import { scheduledSyncDue } from "../shared/sync-schedule.mjs";
import { registerPrivacy, privacyCleanup } from "./privacy.mjs";
import { registerWriting } from "./writing.mjs";
import { registerNotifications } from "./notifications.mjs";
import { registerVolunteers } from "./volunteers.mjs";
import { registerModules, moduleHook, modulesConfig } from "./modules.mjs";
import {
  registerDevices,
  trackDevice,
  sessionLifetime,
} from "./account-devices.mjs";
const UUID = z.string().uuid();
const Settings = z.object({
  ...sourceFields,
  ...interfaceFields,
  refugeName: z.string().trim().min(1).max(100),
  authorGithubUrl: z
    .literal("https://github.com/Gaerisson/")
    .default("https://github.com/Gaerisson/"),
  subtitle: z.string().max(150),
  cacheMB: z.number().int().min(16).max(16384),
  thumbQuality: z.number().int().min(40).max(90),
  syncIntervalHours: z
    .number()
    .min(0)
    .max(168)
    .refine((v) => v === 0 || v >= 0.25, "Intervalle minimum : 15 minutes."),
  missingThreshold: z.number().int().min(2).max(10),
  sourceMode: z.enum(["disabled", "json", "html", "spa"]),
  sourceUrl: z.union([z.literal(""), z.string().url().max(500)]),
  archiveMissing: z.boolean(),
  backupIntervalHours: z.number().int().min(0).max(168),
  backupKeep: z.number().int().min(1).max(30),
  themeDefault: z.enum(["night", "amber", "sage", "spa"]).default("night"),
  accentColor: z
    .string()
    .regex(/^#[a-fA-F0-9]{6}$/)
    .default("#f4ab70"),
  compactUI: z.boolean().default(true),
  tiltIntensity: z.number().min(0).max(100).default(25),
  reflectionIntensity: z.number().min(0).max(100).default(15),
  glowIntensity: z.number().min(0).max(100).default(65),
  showCarousel: z.boolean().default(true),
  showWeather: z.boolean().default(true),
  showClock: z.boolean().default(true),
  carouselSeconds: z.number().min(3).max(20).default(6),
  cardsPerPage: z
    .union([
      z.literal(12),
      z.literal(24),
      z.literal(48),
      z.literal(96),
      z.literal(200),
    ])
    .default(24),
  geminiModel: z
    .string()
    .regex(/^[a-zA-Z0-9_.-]{0,100}$/)
    .default(""),
  tokenharborModel: z.string().max(150).default(""),
});
const publicSession = (s) =>
  s
    ? {
        id: s.id,
        name: s.name,
        role: s.role,
        authProvider: s.googleAccount ? "google" : "local",
        csrf: s.csrf,
        ...(s.avatarHash ? { avatarHash: s.avatarHash } : {}),
      }
    : null;
export async function createApp(overrides = {}) {
  const c = config(overrides);
  const db = openDb(c);
  const app = Fastify({
    logger: overrides.logger ?? false,
    trustProxy: c.trustProxy,
    routerOptions: { maxParamLength: 1600 },
    bodyLimit: 8 * 1024 ** 2,
  });
  if (!db.prepare("SELECT 1 FROM settings WHERE key='cacheMB'").get())
    saveSettings(db, { cacheMB: c.initialCacheBytes / 1024 ** 2 });
  db.prepare(
    "UPDATE jobs SET state='interrupted', detail='Processus interrompu; relancer manuellement.', finished_at=? WHERE state='running'",
  ).run(now());
  app.decorate("db", db);
  app.decorate("anipicConfig", c);
  await app.register(cookie);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:"],
        mediaSrc: ["'self'", "blob:"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: c.secureCookie ? [] : null,
      },
    },
  });
  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
    allowList: (req) => req.url === "/api/health",
  });
  await app.register(multipart, {
    limits: { fileSize: c.maxUploadBytes, files: 30, fields: 10, parts: 40 },
    throwFileSizeLimit: true,
  });
  app.addHook("onRequest", async (req, reply) => {
    req.user = getSession(db, req.cookies.anipic_session);
    if (req.user && !accountAllowsIP(db, req.user.id, req.ip)) req.user = null;
    if (req.url.startsWith("/api/") || req.url.startsWith("/media/"))
      reply.header("Cache-Control", "no-store");
  });
  app.addHook("onRequest", siteAccessHook(db, c));
  app.addHook("onRequest", moduleHook(db));
  app.addHook("onRequest", async (req, reply) =>
    trackDevice(db, c, req, reply),
  );
  app.addHook("preHandler", async (req, reply) => {
    if (mediaMaintenance(c) && !["GET", "HEAD", "OPTIONS"].includes(req.method))
      return reply.code(423).send({
        error:
          "Optimisation des archives en cours. Réessayez après la fin du traitement.",
      });
  });
  app.addHook("onResponse", async (req, reply) => {
    if (!req.url.startsWith("/api/") || req.url.startsWith("/api/health"))
      return;
    if(['/api/visit','/api/privacy','/api/privacy/consent'].includes(req.url.split('?')[0])&&reply.statusCode<400)return;
    if(req.method==='GET'&&!req.user&&reply.statusCode<400)return;
    db.prepare("INSERT INTO access_log VALUES (?,?,?,?,?,?,?,?)").run(
      id(),
      req.user?.id || null,
      normalizedIP(req.ip) || "unknown",
      req.method,
      req.url.split("?")[0].slice(0, 200),
      reply.statusCode,
      String(req.headers["user-agent"] || "").slice(0, 250),
      now(),
    );
    if (Math.random() < 0.01) privacyCleanup(db);
    if (Math.random() < 0.01)
      db.exec(
        "DELETE FROM access_log WHERE id IN (SELECT id FROM access_log ORDER BY created_at DESC LIMIT -1 OFFSET 10000)",
      );
  });
  const authorized =
    (roles = ["admin", "editor", "agent"]) =>
    async (req, reply) => {
      if (!req.user)
        return reply.code(401).send({ error: "Connexion nécessaire." });
      if (!roles.includes(req.user.role))
        return reply.code(403).send({ error: "Accès réservé." });
      if (!["GET", "HEAD"].includes(req.method)) {
        if (req.headers["x-csrf-token"] !== req.user.csrf)
          return reply
            .code(403)
            .send({ error: "Jeton de sécurité invalide. Reconnectez-vous." });
        const origin = req.headers.origin;
        if (origin && origin !== c.origin)
          return reply.code(403).send({ error: "Origine de requête refusée." });
      }
    };
  app.setErrorHandler((error, req, reply) => {
    const status = error instanceof z.ZodError ? 400 : error.statusCode || 500;
    try {
      recordError(db, req, error, status);
    } catch {
      /* Preserve original failure on a full/read-only DB. */
    }
    if (status >= 500) req.log.error(error);
    reply.code(status).send({
      error:
        error.publicMessage && /^AI_[A-Z_]+$/.test(error.code || "")
          ? error.publicMessage
          : status >= 500
            ? "Opération impossible. Vérifiez le journal du serveur."
            : error instanceof z.ZodError
              ? "Données invalides : " +
                error.issues
                  .map((i) => i.path.join(".") + " " + i.message)
                  .join("; ")
              : error.message,
    });
  });
  await registerSiteAccess(app, { db, c, authorized });
  await registerPrivacy(app, { db, c, authorized });
  await registerModules(app, { db, c, authorized });
  await registerDevices(app, { db, c, authorized });
  await registerNotifications(app, { db, c, authorized });
  await registerVolunteers(app, { db, c, authorized });
  await registerWriting(app, { db, c, authorized });
  await registerGoogleAuth(app, { db, c, authorized });
  await registerArchiveFolders(app, { db });
  await registerJournal(app, { db, authorized });
  await registerArchiveCompression(app, { db, c, authorized, job });
  await registerTrash(app, { db, c, authorized, job });
  await registerUserAvatars(app, { db, authorized });
  await registerStorageHealth(app, { c, authorized });
  app.get("/api/health", async (req, reply) => {
    try {
      assertStorage(c);
      return { ok: true, version: appVersion };
    } catch {
      return reply
        .code(503)
        .send({ ok: false, error: "Stockage NAS indisponible." });
    }
  });
  app.get("/api/session", async (req) => ({
    user: publicSession(req.user),
    needsSetup: !db.prepare("SELECT id FROM users LIMIT 1").get(),
    demo: c.demo,
    gateRequired: siteGateRequired(db, req),
  }));
  app.post("/api/demo-session", async (req, reply) => {
    const local = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
      req.socket.remoteAddress,
    );
    if (
      !c.demo ||
      !local ||
      !["127.0.0.1", "localhost"].includes(new URL(c.origin).hostname)
    )
      return reply.code(404).send({ error: "Route introuvable." });
    if (req.headers.origin && req.headers.origin !== c.origin)
      return reply.code(403).send({ error: "Origine refusée." });
    const user = db
      .prepare("SELECT id,name,role FROM users WHERE name='demo' AND active=1")
      .get();
    if (!user) return reply.code(404).send({ error: "Démo non initialisée." });
    const session = createSession(db, user.id);
    reply.setCookie("anipic_session", session.token, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: false,
      maxAge: sessionLifetime,
    });
    return { user: publicSession(getSession(db, session.token)) };
  });
  app.post(
    "/api/login",
    { config: { rateLimit: { max: 8, timeWindow: "15 minutes" } } },
    async (req, reply) => {
      if (req.headers.origin && req.headers.origin !== c.origin)
        return reply.code(403).send({ error: "Origine refusée." });
      const { name, password } = z
        .object({ name: z.string().max(100), password: z.string().max(200) })
        .parse(req.body);
      const user = db
        .prepare(
          "SELECT * FROM users WHERE name=? AND active=1 AND NOT EXISTS(SELECT 1 FROM google_identities g WHERE g.user_id=users.id)",
        )
        .get(name);
      // Always run the expensive hash comparison to reduce username enumeration.
      const fallback = "00000000000000000000000000000000:" + "00".repeat(64);
      const matches = await verifyPassword(
        password,
        user?.password || fallback,
      );
      if (!user || !matches || !accountAllowsIP(db, user.id, req.ip)) {
        audit(db, null, "login_failed", { ip: req.ip });
        return reply.code(401).send({ error: "Identifiants incorrects." });
      }
      const session = createSession(db, user.id);
      reply.setCookie("anipic_session", session.token, {
        path: "/",
        httpOnly: true,
        sameSite: "strict",
        secure: c.secureCookie,
        maxAge: sessionLifetime,
      });
      audit(db, user, "login");
      return { user: publicSession(getSession(db, session.token)) };
    },
  );
  app.post(
    "/api/logout",
    {
      preHandler: authorized([
        "admin",
        "editor",
        "agent",
        "volunteer",
        "viewer",
      ]),
    },
    async (req, reply) => {
      db.prepare("DELETE FROM sessions WHERE token_hash=?").run(
        req.user.token_hash,
      );
      reply.clearCookie("anipic_session", { path: "/" });
      return { ok: true };
    },
  );
  const photoCondition = (req) =>
    "p.deleted_at IS NULL AND (" + (req.user ? "1=1" : "p.hidden=0") + ")";
  function animalSummary(row, req) {
    const photos = db
      .prepare(
        `SELECT p.id,p.hidden,p.archived_at,p.filename FROM photos p WHERE p.animal_id=? AND ${photoCondition(req)} AND p.archived_at IS NULL ORDER BY p.created_at DESC`,
      )
      .all(row.id);
    const cover = photos.find((p) => p.id === row.cover_id) || photos[0];
    const priority = photoPriority(
      row,
      (req.photoRules ||= settings(db).photoRules),
    );
    return {
      ...row,
      adoption_origin: adoptionOrigin(db, row.id),
      ...(["admin", "agent"].includes(req.user?.role)
        ? { adoption_review: reviewForAnimal(db, row.id) }
        : {}),
      source_presence: animalPresence(
        db,
        row,
        (req.presenceCache ||= new Map()),
      ),
      ...(req.user
        ? {
            sourcePhotoMatch: cachedSourceMatch(db, row),
            photoWorkflow:
              db
                .prepare(
                  "SELECT state FROM shoot_tasks WHERE animal_id=? AND NOT EXISTS(SELECT 1 FROM task_deletions d WHERE d.task_id=shoot_tasks.id) AND state!='done' ORDER BY state='progress' DESC,updated_at DESC LIMIT 1",
                )
                .get(row.id)?.state || null,
            publication:
              db
                .prepare(
                  "SELECT published_at FROM animal_publications WHERE animal_id=?",
                )
                .get(row.id) || null,
          }
        : {}),
      photo_priority: priority.priority,
      photo_priority_reason: priority.reason,
      tags: JSON.parse(row.tags),
      compatibility: publicCompatibility(
        JSON.parse(row.compatibility),
        row.description,
      ),
      source_metadata: publicAnimalMetadata(JSON.parse(row.source_metadata)),
      photo_count: photos.length,
      ...(req.user
        ? {
            public_cover_id:
              (
                photos.find((p) => !p.hidden && p.id === row.cover_id) ||
                photos.find((p) => !p.hidden)
              )?.id || null,
            private_photo_count: photos.filter((p) => p.hidden).length,
          }
        : {}),
      breed: hasAnimalInfo(row.breed) ? row.breed : "",
      preview_ids: photos.slice(0, 6).map((p) => p.id),
      latest_photo_at: db
        .prepare(
          "SELECT MAX(created_at) date FROM photos p WHERE animal_id=? AND p.archived_at IS NULL AND " +
            photoCondition(req),
        )
        .get(row.id).date,
      cover_id: cover?.id || null,
      favorite: req.user
        ? Boolean(
            db
              .prepare(
                "SELECT 1 FROM favorites WHERE user_id=? AND animal_id=?",
              )
              .get(req.user.id, row.id),
          )
        : false,
    };
  }
  app.get("/api/photo-trash", { preHandler: authorized() }, async (req) => {
    const animalId = req.query.animalId ? UUID.parse(req.query.animalId) : "";
    return db
      .prepare(
        "SELECT p.id,p.filename,p.deleted_at,a.name FROM photos p JOIN animals a ON a.id=p.animal_id WHERE p.deleted_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM settings s WHERE s.key='animalTrash:'||a.id) AND (?='' OR p.animal_id=?) ORDER BY p.deleted_at DESC LIMIT 300",
      )
      .all(animalId, animalId);
  });
  app.get(
    "/api/source/health",
    {
      preHandler: authorized([
        "admin",
        "editor",
        "agent",
        "volunteer",
        "viewer",
      ]),
    },
    async () => sourceHealth(db),
  );
  app.get("/api/overview", async (req) => {
    const cfg = settings(db);
    const stats = db
      .prepare(
        `SELECT COUNT(*) total,SUM(species='dog') dogs,SUM(species='cat') cats,SUM(species='other') others,SUM(archived_at IS NOT NULL) archived FROM animals WHERE NOT EXISTS(SELECT 1 FROM settings s WHERE s.key='animalTrash:'||animals.id)`,
      )
      .get();
    const absentIds = JSON.stringify(missingAnimalIds(db));
    const coverageRows = db
      .prepare(
        `SELECT a.species, COUNT(*) total,
      SUM(EXISTS(SELECT 1 FROM photos p WHERE p.animal_id=a.id AND p.archived_at IS NULL AND ${photoCondition(req)})) photographed
      FROM animals a WHERE a.archived_at IS NULL AND a.status NOT IN ('adopted','source_missing','deceased','transferred')
      AND a.id NOT IN (SELECT value FROM json_each(?))
      AND NOT EXISTS(SELECT 1 FROM settings s WHERE s.key='animalTrash:'||a.id) GROUP BY a.species`,
      )
      .all(absentIds);
    const photoCoverage = ["dog", "cat", "other"].map((species) => {
      const row = coverageRows.find((r) => r.species === species) || {
        total: 0,
        photographed: 0,
      };
      return {
        species,
        ...row,
        remaining: row.total - row.photographed,
        percent: row.total
          ? Math.round((row.photographed / row.total) * 100)
          : 0,
      };
    });
    const photos = db
      .prepare(
        `SELECT COUNT(*) count FROM photos p WHERE ${photoCondition(req)} AND p.archived_at IS NULL`,
      )
      .get().count;
    const needPhotos = db
      .prepare(
        `SELECT COUNT(*) count FROM animals a WHERE archived_at IS NULL AND status!='adopted' AND NOT EXISTS (SELECT 1 FROM photos p WHERE p.animal_id=a.id AND p.archived_at IS NULL AND ${photoCondition(req)})`,
      )
      .get().count;
    return {
      refugeName: cfg.refugeName,
      authorGithubUrl: cfg.authorGithubUrl,
      assistantAvatarUrl: assistantAvatarUrl(db),
      subtitle: cfg.subtitle,
      ...(req.user ? { sourceSync: sourceHealth(db, cfg) } : {}),
      interface: Object.fromEntries(
        [
          "themeDefault",
          "accentColor",
          "compactUI",
          "tiltIntensity",
          "reflectionIntensity",
          "glowIntensity",
          "showCarousel",
          "showClock",
          "showWeather",
          "carouselSeconds",
          "cardsPerPage",
          ...Object.keys(interfaceDefaults),
        ].map((k) => [k, cfg[k]]),
      ),
      stats: {
        ...stats,
        photoCoverage,
        localPhotos: req.user
          ? db
              .prepare(
                "SELECT (SELECT COUNT(*) FROM photos WHERE deleted_at IS NULL)+(SELECT COUNT(*) FROM album_photos WHERE deleted_at IS NULL) n",
              )
              .get().n
          : photos,
        spaPhotoReferences: db
          .prepare(
            "SELECT COUNT(*) n FROM animals WHERE json_extract(source_metadata,'$.thumbnail') IS NOT NULL",
          )
          .get().n,
        photos,
        needPhotos,
        ...(["admin", "agent"].includes(req.user?.role)
          ? { pendingAdoptions: pendingAdoptionCount(db) }
          : {}),
        openTasks: req.user
          ? db
              .prepare(
                "SELECT COUNT(*) count FROM shoot_tasks t JOIN animals a ON a.id=t.animal_id WHERE t.state!='done' AND NOT EXISTS(SELECT 1 FROM task_deletions d WHERE d.task_id=t.id) AND a.archived_at IS NULL",
              )
              .get().count
          : 0,
      },
      demo: c.demo,
    };
  });
  db.function(
    "compatibility_state",
    { deterministic: true },
    (raw, subject, description) => {
      let values;
      try {
        values = publicCompatibility(
          JSON.parse(raw || "{}"),
          description || "",
        );
      } catch {
        return "unknown";
      }
      const aliases = {
        cats: /^(chats?|cats?)$/i,
        dogs: /^(chiens?|dogs?)$/i,
        children: /^(enfants?|children|kids?)$/i,
      };
      const value = Object.entries(values).find(([key]) =>
        aliases[subject]?.test(key),
      )?.[1];
      return compatibilityState(value);
    },
  );
  db.function("animal_sos", { deterministic: true }, (raw) => {
    try {
      return Number(
        JSON.parse(raw || "[]").some((t) =>
          /^sos(?:\s|$|[!:.–—-])/i.test(String(t).trim()),
        ),
      );
    } catch {
      return 0;
    }
  });
  app.get("/api/animals", async (req, reply) => {
    const q = z
      .object({
        q: z.string().max(100).default(""),
        species: z.enum(["all", "dog", "cat", "other"]).default("all"),
        status: z
          .enum(["all", "available", "reserved", "adopted", "source_missing"])
          .default("all"),
        photos: z.enum(["all", "with", "without"]).default("all"),
        publication: z.enum(["all", "yes", "no"]).default("all"),
        mediaTag: z.string().trim().max(40).default(""),
        sos: z.enum(["all", "yes", "no"]).default("all"),
        cats: z
          .enum(["all", "yes", "no", "conditional", "unknown"])
          .default("all"),
        dogs: z
          .enum(["all", "yes", "no", "conditional", "unknown"])
          .default("all"),
        children: z
          .enum(["all", "yes", "no", "conditional", "unknown"])
          .default("all"),
        archive: z.enum(["0", "1"]).default("0"),
        missing: z.enum(["0", "1"]).default("0"),
        recent: z.enum(["0", "1"]).default("0"),
        favorites: z.enum(["0", "1"]).default("0"),
        ids: z.string().max(7400).optional(),
        sort: z
          .enum([
            "recent",
            "oldest",
            "name",
            "name_desc",
            "photos",
            "few_photos",
            "photo_priority",
            "arrival",
            "archive",
          ])
          .default("recent"),
        page: z.coerce.number().int().min(1).max(10000).default(1),
        limit: z.coerce.number().int().min(1).max(200).default(24),
        format: z.enum(["json", "csv"]).default("json"),
        presence: z.enum(["current", "missing", "all"]).default("current"),
        year: z
          .string()
          .regex(/^\d{4}$/)
          .optional(),
      })
      .parse(req.query);
    const params = [];
    const where = [
      q.archive === "1" ? "a.archived_at IS NOT NULL" : "a.archived_at IS NULL",
      "NOT EXISTS(SELECT 1 FROM settings s WHERE s.key='animalTrash:'||a.id)",
    ];
    if (q.ids !== undefined) {
      const ids = z
        .array(UUID)
        .max(200)
        .parse(q.ids ? q.ids.split(",") : []);
      if (ids.length) {
        where.push(`a.id IN (${ids.map(() => "?").join(",")})`);
        params.push(...ids);
      } else where.push("0=1");
    }
    if (q.q) {
      where.push(
        "(a.name LIKE ? ESCAPE '\\' OR a.description LIKE ? ESCAPE '\\' OR a.tags LIKE ? ESCAPE '\\' OR a.source_id LIKE ? ESCAPE '\\' OR a.id LIKE ? ESCAPE '\\')",
      );
      const term = "%" + q.q.replace(/[\\%_]/g, "\\$&") + "%";
      params.push(term, term, term, term, term);
    }
    if (q.year) {
      where.push(
        q.archive === "1"
          ? "substr(COALESCE(a.departed_at,a.archived_at),1,4)=?"
          : `EXISTS(SELECT 1 FROM photos p WHERE p.animal_id=a.id AND p.archived_at IS NULL AND ${photoCondition(req)} AND substr(p.created_at,1,4)=?)`,
      );
      params.push(q.year);
    }
    if (q.species !== "all") {
      where.push("a.species=?");
      params.push(q.species);
    }
    if (q.mediaTag) {
      if (!req.user) return { items: [], total: 0, page: q.page, pages: 0 };
      where.push(
        `EXISTS(SELECT 1 FROM photos p JOIN media_tags mt ON mt.kind='photo' AND mt.media_id=p.id WHERE p.animal_id=a.id AND p.archived_at IS NULL AND ${photoCondition(req)} AND mt.tag=?)`,
      );
      params.push(q.mediaTag);
    }
    if (q.publication !== "all") {
      if (!req.user) return { items: [], total: 0, page: q.page, pages: 0 };
      where.push(
        `${q.publication === "no" ? "NOT " : ""}EXISTS(SELECT 1 FROM animal_publications ap WHERE ap.animal_id=a.id)`,
      );
    }
    if (q.status !== "all") {
      where.push("a.status=?");
      params.push(q.status);
    }
    if (q.photos !== "all") {
      where.push(
        `${q.photos === "without" ? "NOT " : ""}EXISTS(SELECT 1 FROM photos p WHERE p.animal_id=a.id AND p.archived_at IS NULL AND ${photoCondition(req)})`,
      );
    }
    if (q.recent === "1") {
      where.push(
        `EXISTS(SELECT 1 FROM photos p WHERE p.animal_id=a.id AND p.created_at>=? AND p.archived_at IS NULL AND ${photoCondition(req)})`,
      );
      params.push(new Date(Date.now() - 7 * 86400_000).toISOString());
    }
    if (q.missing === "1")
      where.push(
        `a.status!='adopted' AND NOT EXISTS(SELECT 1 FROM photos p WHERE p.animal_id=a.id AND p.archived_at IS NULL AND ${photoCondition(req)})`,
      );
    if (q.favorites === "1") {
      if (!req.user) return { items: [], total: 0, page: q.page, pages: 0 };
      where.push(
        "EXISTS(SELECT 1 FROM favorites f WHERE f.animal_id=a.id AND f.user_id=?)",
      );
      params.push(req.user.id);
    }
    if (q.sos !== "all") {
      where.push("animal_sos(a.tags)=?");
      params.push(q.sos === "yes" ? 1 : 0);
    }
    for (const subject of ["cats", "dogs", "children"]) {
      if (q[subject] !== "all") {
        where.push("compatibility_state(a.compatibility,?,a.description)=?");
        params.push(subject, q[subject]);
      }
    }
    const missingIds = missingAnimalIds(db);
    const missingClause = missingIds.length
      ? `a.id IN (${missingIds.map(() => "?").join(",")})`
      : "0=1";
    const sourceMissingTotal =
      q.archive === "0"
        ? db
            .prepare(
              `SELECT COUNT(*) n FROM animals a WHERE ${where.join(" AND ")} AND ${missingClause}`,
            )
            .get(...params, ...missingIds).n
        : 0;
    if (q.archive === "0" && q.presence !== "all") {
      where.push(
        q.presence === "missing" ? missingClause : `NOT (${missingClause})`,
      );
      params.push(...missingIds);
    }
    const clause = where.join(" AND ");
    const total = db
      .prepare(`SELECT COUNT(*) count FROM animals a WHERE ${clause}`)
      .get(...params).count;
    const latest = `COALESCE((SELECT MAX(p.created_at) FROM photos p WHERE p.animal_id=a.id AND p.archived_at IS NULL AND ${photoCondition(req)}),'')`;
    const count = `(SELECT COUNT(*) FROM photos p WHERE p.animal_id=a.id AND p.archived_at IS NULL AND ${photoCondition(req)})`;
    const order =
      {
        name: "a.name COLLATE NOCASE ASC",
        name_desc: "a.name COLLATE NOCASE DESC",
        photos: count + " DESC",
        few_photos: count + " ASC",
        photo_priority:
          photoPrioritySql(settings(db).photoRules) + ",a.created_at ASC",
        oldest: latest + "='' ASC," + latest + " ASC",
        arrival: "a.created_at DESC",
        archive: "COALESCE(a.departed_at,a.archived_at) DESC",
      }[q.sort] || latest + " DESC,a.created_at DESC";
    if (q.format === "csv" && !req.user)
      return reply
        .code(401)
        .send({ error: "Connectez-vous pour exporter la liste." });
    if (q.format === "csv" && total > 5000)
      return reply.code(413).send({
        error: "L’export est limité à 5 000 animaux. Précisez les filtres.",
      });
    const rows = db
      .prepare(
        `SELECT a.* FROM animals a WHERE ${clause} ORDER BY ${order},a.id LIMIT ? OFFSET ?`,
      )
      .all(
        ...params,
        q.format === "csv" ? 5000 : q.limit,
        q.format === "csv" ? 0 : (q.page - 1) * q.limit,
      );
    if (q.format === "csv")
      return reply
        .header(
          "Content-Disposition",
          'attachment; filename="anipic-animaux.csv"',
        )
        .type("text/csv; charset=utf-8")
        .send(animalCsv(rows.map((r) => animalSummary(r, req))));
    return {
      items: rows.map((r) => animalSummary(r, req)),
      total,
      page: q.page,
      pages: Math.ceil(total / q.limit),
      sourceMissingTotal,
      pageSize: q.limit,
    };
  });
  app.get("/api/animals/:id", async (req, reply) => {
    const row = db
      .prepare("SELECT * FROM animals WHERE id=?")
      .get(UUID.parse(req.params.id));
    if (!row || (isAnimalTrashed(db, row.id) && !req.user))
      return reply.code(404).send({ error: "Animal introuvable." });
    const photos = db
      .prepare(
        `SELECT p.*,b.size,b.width,b.height,(SELECT COUNT(*) FROM photo_likes l WHERE l.photo_id=p.id) likes,EXISTS(SELECT 1 FROM photo_likes l WHERE l.photo_id=p.id AND l.user_id=?) liked FROM photos p JOIN blobs b ON b.hash=p.hash WHERE p.animal_id=? AND ${photoCondition(req)} ORDER BY p.archived_at IS NOT NULL,p.created_at DESC`,
      )
      .all(req.user?.id || "", row.id);
    return { ...animalSummary(row, req), photos };
  });
  const sourceOnly = async (req, reply) =>
    reply.code(403).send({
      error:
        "Les informations des animaux proviennent uniquement de la SPA. Utilisez la synchronisation de la source.",
    });
  app.post("/api/animals", { preHandler: authorized() }, sourceOnly);
  app.patch("/api/animals/:id", { preHandler: authorized() }, sourceOnly);
  app.post(
    "/api/animals/:id/archive",
    { preHandler: authorized() },
    async (req, reply) => {
      const animalId = UUID.parse(req.params.id);
      const { archived } = z.object({ archived: z.boolean() }).parse(req.body);
      const old = db.prepare("SELECT * FROM animals WHERE id=?").get(animalId);
      if (isAnimalTrashed(db, animalId))
        return reply.code(409).send({
          error: "Restaurez d’abord la fiche depuis la corbeille des archives.",
        });
      const result = db
        .prepare(
          "UPDATE animals SET archived_at=?,departed_at=?,updated_at=? WHERE id=?",
        )
        .run(archived ? now() : null, archived ? now() : null, now(), animalId);
      if (!result.changes)
        return reply.code(404).send({ error: "Animal introuvable." });
      audit(db, req.user, archived ? "animal_archived" : "animal_restored", {
        id: animalId,
      });
      if (Boolean(old.archived_at) !== archived)
        feedEvent(db, old, archived ? "removed" : "restored");
      return { ok: true };
    },
  );
  app.post(
    "/api/animals/:id/favorite",
    {
      preHandler: authorized([
        "admin",
        "editor",
        "agent",
        "volunteer",
        "viewer",
      ]),
    },
    async (req) => {
      const animalId = UUID.parse(req.params.id);
      if (!db.prepare("SELECT id FROM animals WHERE id=?").get(animalId))
        throw Object.assign(new Error("Animal introuvable."), {
          statusCode: 404,
        });
      const { favorite } = z.object({ favorite: z.boolean() }).parse(req.body);
      if (favorite)
        db.prepare("INSERT OR IGNORE INTO favorites VALUES (?,?)").run(
          req.user.id,
          animalId,
        );
      else
        db.prepare("DELETE FROM favorites WHERE user_id=? AND animal_id=?").run(
          req.user.id,
          animalId,
        );
      return { ok: true };
    },
  );
  app.post(
    "/api/animals/:id/photos",
    { preHandler: authorized() },
    async (req, reply) => {
      const animalId = UUID.parse(req.params.id);
      if (!db.prepare("SELECT id FROM animals WHERE id=?").get(animalId))
        return reply.code(404).send({ error: "Animal introuvable." });
      const results = [];
      let failure;
      for await (const part of req.parts())
        if (part.type === "file") {
          if (failure) {
            part.file.resume();
            continue;
          }
          try {
            const result = await ingest(
              db,
              c,
              animalId,
              part.file,
              part.filename,
            );
            if (part.file.truncated)
              throw Object.assign(new Error("Photo trop volumineuse."), {
                statusCode: 413,
              });
            results.push(result);
          } catch (e) {
            part.file.resume();
            failure = e;
          }
        }
      if (failure) {
        audit(db, req.user, "upload_partial", {
          animalId,
          imported: results.length,
        });
        return reply
          .code(failure.statusCode || 400)
          .send({ error: failure.message, imported: results });
      }
      audit(db, req.user, "photos_uploaded", {
        animalId,
        count: results.length,
      });
      return { items: results };
    },
  );
  app.patch(
    "/api/photos/:id",
    { preHandler: authorized() },
    async (req, reply) => {
      const photoId = UUID.parse(req.params.id);
      const input = z
        .object({
          caption: z.string().max(300).optional(),
          hidden: z.boolean().optional(),
          archived: z.boolean().optional(),
          cover: z.boolean().optional(),
          deleted: z.boolean().optional(),
        })
        .parse(req.body);
      const photo = db.prepare("SELECT * FROM photos WHERE id=?").get(photoId);
      if (!photo) return reply.code(404).send({ error: "Photo introuvable." });
      const revision = (p) =>
        createHash("sha256")
          .update(
            JSON.stringify([
              p.animal_id,
              p.hash,
              p.filename,
              p.caption,
              p.hidden,
              p.archived_at,
              p.deleted_at,
            ]),
          )
          .digest("hex");
      if (
        req.headers["x-photo-version"] &&
        req.headers["x-photo-version"] !== revision(photo)
      )
        return reply.code(409).send({
          error:
            "Cette photo a été modifiée depuis. Actualisez avant d’annuler.",
        });
      transaction(db, () => {
        if (input.deleted !== undefined) {
          db.prepare("UPDATE photos SET deleted_at=? WHERE id=?").run(
            input.deleted ? now() : null,
            photoId,
          );
          if (input.deleted)
            db.prepare("UPDATE animals SET cover_id=NULL WHERE cover_id=?").run(
              photoId,
            );
        }
        if (input.deleted === false && isAnimalTrashed(db, photo.animal_id))
          throw Object.assign(
            Error(
              "Restaurez d’abord la fiche depuis la corbeille des archives.",
            ),
            { statusCode: 409 },
          );
        if (input.cover && (input.deleted || photo.deleted_at))
          throw Object.assign(
            Error("Restaurez la photo avant de la mettre en couverture."),
            { statusCode: 400 },
          );
        db.prepare(
          "UPDATE photos SET caption=?,hidden=?,archived_at=? WHERE id=?",
        ).run(
          input.caption ?? photo.caption,
          input.hidden == null ? photo.hidden : Number(input.hidden),
          input.archived == null
            ? photo.archived_at
            : input.archived
              ? now()
              : null,
          photoId,
        );
        if (input.cover)
          db.prepare("UPDATE animals SET cover_id=? WHERE id=?").run(
            photoId,
            photo.animal_id,
          );
      });
      audit(db, req.user, "photo_updated", { id: photoId, ...input });
      return {
        ok: true,
        revision: revision(
          db.prepare("SELECT * FROM photos WHERE id=?").get(photoId),
        ),
      };
    },
  );
  app.post("/api/photos/batch", { preHandler: authorized() }, async (req) => {
    const input = z
      .object({
        photoIds: z.array(UUID).min(1).max(300),
        operation: z.enum(["hide", "publish", "archive", "restore"]),
      })
      .parse(req.body);
    transaction(db, () => {
      for (const photoId of input.photoIds) {
        if (!db.prepare("SELECT id FROM photos WHERE id=?").get(photoId))
          throw Object.assign(new Error("Photo introuvable."), {
            statusCode: 404,
          });
        if (input.operation === "hide" || input.operation === "publish")
          db.prepare("UPDATE photos SET hidden=? WHERE id=?").run(
            Number(input.operation === "hide"),
            photoId,
          );
        else
          db.prepare("UPDATE photos SET archived_at=? WHERE id=?").run(
            input.operation === "archive" ? now() : null,
            photoId,
          );
      }
    });
    audit(db, req.user, "photos_batch", {
      count: input.photoIds.length,
      operation: input.operation,
    });
    return { updated: input.photoIds.length };
  });
  app.get("/media/:id", async (req, reply) => {
    const photoId = UUID.parse(req.params.id);
    const p = db
      .prepare(
        "SELECT p.*,b.mime,b.size,b.width,b.height FROM photos p JOIN blobs b ON b.hash=p.hash WHERE p.id=?",
      )
      .get(photoId);
    if (!p || ((p.hidden || p.deleted_at) && !req.user))
      return reply.code(404).send({ error: "Photo introuvable." });
    const original = req.query.original === "1" || req.query.full === "1";
    const width = Number(req.query.w || 640);
    if (!original && ![320, 640, 1280].includes(width))
      return reply.code(400).send({ error: "Taille non autorisée." });
    if (original) {
      if (!req.user)
        return reply
          .code(401)
          .send({ error: "Connectez-vous pour télécharger les originaux." });
      reply.header(
        "Content-Disposition",
        `${req.query.full === "1" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(p.filename)}`,
      );
      return reply
        .type(p.mime)
        .send(createReadStream(path.join(c.mediaDir, p.hash)));
    }
    const cfg = settings(db);
    const filename = await derivative(
      c,
      p,
      width,
      cfg.thumbQuality,
      cfg.cacheMB * 1024 ** 2,
    );
    const etag = `"${p.hash}-${width}-${cfg.thumbQuality}"`;
    reply
      .header("ETag", etag)
      .header("Cache-Control", "private, max-age=300")
      .type("image/webp");
    if (req.headers["if-none-match"] === etag) return reply.code(304).send();
    return reply.send(createReadStream(filename));
  });
  app.get(
    "/api/admin/settings",
    { preHandler: authorized(["admin"]) },
    async () => adminSettingsView(settings(db)),
  );
  app.get(
    "/api/admin/settings/export",
    { preHandler: authorized(["admin"]) },
    async (req, reply) => {
      const cfg = Settings.parse(settings(db));
      reply.header(
        "Content-Disposition",
        'attachment; filename="anipic-parametres.json"',
      );
      return {
        application: "Anipic",
        version: 1,
        exportedAt: now(),
        settings: cfg,
        displayProgram: settings(db).displayProgram || null,
        audio: {
          ttsModel: audioConfig(c, db).ttsModel,
          sttModel: audioConfig(c, db).sttModel,
          voiceId: audioConfig(c, db).voiceId,
        },
      };
    },
  );
  app.put(
    "/api/admin/settings",
    { preHandler: authorized(["admin"]) },
    async (req) => {
      const input = Settings.parse({ ...settings(db), ...req.body });
      saveSettings(db, input);
      audit(db, req.user, "settings_updated");
      await sweepCache(c, input.cacheMB * 1024 ** 2);
      return adminSettingsView(settings(db));
    },
  );
  app.get(
    "/api/admin/storage",
    { preHandler: authorized(["admin"]) },
    async () => {
      const blobs = db
        .prepare("SELECT COUNT(*) count,COALESCE(SUM(size),0) bytes FROM blobs")
        .get();
      const photos = db
        .prepare(
          "SELECT (SELECT COUNT(*) FROM photos)+(SELECT COUNT(*) FROM album_photos) count",
        )
        .get();
      const logical = db
        .prepare(
          "SELECT COALESCE(SUM(b.size),0) bytes FROM (SELECT hash FROM photos UNION ALL SELECT hash FROM album_photos UNION ALL SELECT hash FROM video_assets UNION ALL SELECT hash FROM video_renders WHERE hash IS NOT NULL) p JOIN blobs b ON p.hash=b.hash",
        )
        .get().bytes;
      const media = await directoryBytes(c.mediaDir);
      const cache = await directoryBytes(c.cacheDir);
      const backups = await directoryBytes(c.backupDir);
      const database = await directoryBytes(c.dbDir);
      const space = await fs.statfs(c.mediaDir).catch(() => null);
      return {
        originals: media,
        referencedOriginals: blobs.bytes,
        orphanBytes: Math.max(0, media - blobs.bytes),
        uniqueBlobs: blobs.count,
        photos: photos.count,
        cache,
        backups,
        database,
        savedByDedup: Math.max(0, logical - blobs.bytes),
        total: media + cache + backups + database,
        freeBytes: space ? Number(space.bavail) * Number(space.bsize) : null,
        diskTotalBytes: space
          ? Number(space.blocks) * Number(space.bsize)
          : null,
        diskUsedBytes: space
          ? Number(space.blocks - space.bfree) * Number(space.bsize)
          : null,
        cacheBudget: settings(db).cacheMB * 1024 ** 2,
      };
    },
  );
  app.post(
    "/api/admin/cache/clear",
    { preHandler: authorized(["admin"]) },
    async (req) => {
      const result = await sweepCache(c, 0, true);
      audit(db, req.user, "cache_cleared", result);
      return result;
    },
  );
  app.get("/api/admin/audit", { preHandler: authorized(["admin"]) }, async () =>
    db
      .prepare(
        "SELECT a.*,u.name user_name FROM audit a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 100",
      )
      .all(),
  );
  const running = new Set();
  async function job(kind, user, fn) {
    if (
      running.has(kind) ||
      running.has("archive_compress") ||
      running.has("trash_empty") ||
      (["archive_compress", "trash_empty"].includes(kind) && running.size)
    )
      throw Object.assign(new Error("Cette opération est déjà en cours."), {
        statusCode: 409,
      });
    const jobId = id();
    running.add(kind);
    db.prepare(
      "INSERT INTO jobs(id,kind,state,created_at) VALUES (?,?,?,?)",
    ).run(jobId, kind, "running", now());
    setImmediate(async () => {
      try {
        const result = await fn();
        db.prepare(
          "UPDATE jobs SET state=?,detail=?,finished_at=? WHERE id=?",
        ).run("done", JSON.stringify(result), now(), jobId);
        audit(db, user, kind, result);
      } catch (e) {
        db.prepare(
          "UPDATE jobs SET state=?,detail=?,finished_at=? WHERE id=?",
        ).run("failed", e.message, now(), jobId);
        audit(db, user, kind + "_failed", { message: e.message });
      } finally {
        running.delete(kind);
      }
    });
    return { id: jobId };
  }
  app.get("/api/admin/jobs", { preHandler: authorized(["admin"]) }, async () =>
    db.prepare("SELECT * FROM jobs ORDER BY created_at DESC LIMIT 30").all(),
  );
  app.post(
    "/api/admin/sync",
    { preHandler: authorized(["admin"]) },
    async (req) => job("sync", req.user, () => synchronize(db)),
  );
  app.get(
    "/api/admin/source/diagnostic",
    { preHandler: authorized(["admin"]) },
    async () => ({
      report: settings(db).sourceLastDiagnostic || null,
      job:
        db
          .prepare(
            "SELECT id,state,detail,created_at,finished_at FROM jobs WHERE kind='source_test' ORDER BY created_at DESC LIMIT 1",
          )
          .get() || null,
    }),
  );
  app.post(
    "/api/admin/source/test",
    { preHandler: authorized(["admin"]) },
    async (req) => {
      const candidate = Settings.parse({ ...settings(db), ...req.body });
      return job("source_test", req.user, async () => {
        const report = await diagnoseSource(
          db,
          candidate,
          overrides.sourceDependencies,
        );
        saveSettings(db, { sourceLastDiagnostic: report });
        return report;
      });
    },
  );
  app.post(
    "/api/admin/import-json",
    { preHandler: authorized(["admin"]) },
    async (req) => {
      const snapshot = normalizeSnapshot(req.body);
      const result = applySnapshot(db, snapshot);
      audit(db, req.user, "json_imported", result);
      return result;
    },
  );
  app.post(
    "/api/admin/import-preview",
    { preHandler: authorized(["admin"]) },
    async (req) => {
      const snapshot = normalizeSnapshot(req.body);
      const updated = snapshot.animals.filter((a) =>
        db.prepare("SELECT id FROM animals WHERE source_id=?").get(a.sourceId),
      ).length;
      return {
        total: snapshot.animals.length,
        created: snapshot.animals.length - updated,
        updated,
        complete: snapshot.complete,
        sample: snapshot.animals.slice(0, 5).map((a) => ({
          name: a.name,
          sourceId: a.sourceId,
          species: a.species,
        })),
        scope: snapshot.scope,
      };
    },
  );
  app.get(
    "/api/admin/activity",
    { preHandler: authorized(["admin"]) },
    async () =>
      db
        .prepare(
          "SELECT substr(created_at,1,10) day,COUNT(*) count FROM (SELECT created_at FROM photos WHERE deleted_at IS NULL UNION ALL SELECT created_at FROM album_photos WHERE deleted_at IS NULL) GROUP BY day ORDER BY day DESC LIMIT 14",
        )
        .all(),
  );
  app.get(
    "/api/admin/backups",
    { preHandler: authorized(["admin"]) },
    async () =>
      db
        .prepare(
          "SELECT b.*,(EXISTS(SELECT 1 FROM archive_compactions c WHERE c.backup_id=b.id) OR EXISTS(SELECT 1 FROM settings s WHERE s.key='protectedBackup:'||b.id)) protected FROM backups b ORDER BY b.created_at DESC",
        )
        .all(),
  );
  app.post(
    "/api/admin/backups",
    { preHandler: authorized(["admin"]) },
    async (req) =>
      job("backup", req.user, async () => {
        const result = await createBackup(db, c);
        await pruneBackups(db, c, settings(db).backupKeep);
        return result;
      }),
  );
  app.get(
    "/api/admin/backups/:id/download",
    { preHandler: authorized(["admin"]) },
    async (req, reply) => {
      const row = db
        .prepare("SELECT * FROM backups WHERE id=?")
        .get(UUID.parse(req.params.id));
      if (!row)
        return reply.code(404).send({ error: "Sauvegarde introuvable." });
      reply.header(
        "Content-Disposition",
        `attachment; filename="${row.filename}"`,
      );
      return reply
        .type("application/gzip")
        .send(createReadStream(path.join(c.backupDir, row.filename)));
    },
  );
  app.get("/api/admin/users", { preHandler: authorized(["admin"]) }, async () =>
    db
      .prepare(
        "SELECT u.id,u.name,u.role,u.created_at,u.active,u.last_login_at,(SELECT hash FROM user_avatars WHERE user_id=u.id) avatarHash,g.status google_status,g.email google_email,g.display_name google_name,g.requested_at FROM users u LEFT JOIN google_identities g ON g.user_id=u.id ORDER BY u.created_at",
      )
      .all(),
  );
  app.post(
    "/api/admin/users",
    { preHandler: authorized(["admin"]) },
    async (req, reply) => {
      const input = z
        .object({
          name: z.string().regex(/^[a-zA-Z0-9_.-]{3,40}$/),
          password: z.string().min(12).max(200),
          role: z.enum(["admin", "editor", "agent", "volunteer", "viewer"]),
        })
        .parse(req.body);
      if (db.prepare("SELECT id FROM users WHERE name=?").get(input.name))
        return reply.code(409).send({ error: "Identifiant déjà utilisé." });
      const result = await createUser(
        db,
        input.name,
        input.password,
        input.role,
      );
      audit(db, req.user, "user_created", {
        name: input.name,
        role: input.role,
      });
      return reply.code(201).send(result);
    },
  );
  app.patch(
    "/api/admin/users/:id",
    { preHandler: authorized(["admin"]) },
    async (req, reply) => {
      const userId = UUID.parse(req.params.id);
      const input = z
        .object({
          role: z
            .enum(["admin", "editor", "agent", "volunteer", "viewer"])
            .optional(),
          active: z.boolean().optional(),
        })
        .parse(req.body);
      const target = db.prepare("SELECT * FROM users WHERE id=?").get(userId);
      if (!target)
        return reply.code(404).send({ error: "Compte introuvable." });
      const google = db
        .prepare("SELECT status FROM google_identities WHERE user_id=?")
        .get(userId);
      if (
        google &&
        google.status !== "approved" &&
        (input.active || input.role)
      )
        return reply.code(409).send({
          error:
            "Validez d’abord la demande de ce bénévole avec le bouton de validation.",
        });
      const active =
        input.active == null ? target.active : Number(input.active);
      const role = input.role ?? target.role;
      if (userId === req.user.id && active === 0)
        return reply.code(400).send({
          error: "Vous ne pouvez pas désactiver votre propre compte.",
        });
      if (
        target.role === "admin" &&
        target.active &&
        (role !== "admin" || !active) &&
        db
          .prepare(
            "SELECT COUNT(*) n FROM users WHERE role='admin' AND active=1",
          )
          .get().n <= 1
      )
        return reply
          .code(400)
          .send({ error: "Conservez au moins un administrateur actif." });
      transaction(db, () => {
        db.prepare("UPDATE users SET role=?,active=? WHERE id=?").run(
          role,
          active,
          userId,
        );
        db.prepare("DELETE FROM sessions WHERE user_id=?").run(userId);
      });
      audit(db, req.user, "user_updated", { id: userId, role, active });
      return { ok: true };
    },
  );
  app.put(
    "/api/account/password",
    {
      preHandler: authorized([
        "admin",
        "editor",
        "agent",
        "volunteer",
        "viewer",
      ]),
    },
    async (req) => {
      const input = z
        .object({
          current: z.string().max(200),
          password: z.string().min(12).max(200),
        })
        .parse(req.body);
      const user = db
        .prepare("SELECT * FROM users WHERE id=?")
        .get(req.user.id);
      if (!(await verifyPassword(input.current, user.password)))
        throw Object.assign(new Error("Mot de passe actuel incorrect."), {
          statusCode: 400,
        });
      db.prepare("UPDATE users SET password=? WHERE id=?").run(
        await hashPassword(input.password),
        user.id,
      );
      db.prepare("DELETE FROM sessions WHERE user_id=? AND token_hash<>?").run(
        user.id,
        req.user.token_hash,
      );
      audit(db, req.user, "password_updated");
      return { ok: true };
    },
  );
  await registerExtras(app, { db, c, authorized, job });
  await registerInternalRegister(app, { db, authorized });
  await registerGroupPosters(app, { db, c, authorized });
  await registerAdoptionReviews(app, { db, authorized });
  await registerMobileWeb(app);
  await registerCreativeWorkshop(app, { db, c, authorized });
  if (existsSync(path.join(root, "dist", "index.html"))) {
    await app.register(serveStatic, {
      root: path.join(root, "dist"),
      prefix: "/",
      wildcard: true,
    });
    app.setNotFoundHandler((req, reply) => {
      if (
        req.method === "GET" &&
        !req.url.startsWith("/api/") &&
        !req.url.startsWith("/assets/") &&
        !req.url.startsWith("/downloads/") &&
        !req.url.startsWith("/media/")
      )
        return reply.sendFile("index.html");
      return reply.code(404).send({ error: "Route introuvable." });
    });
  }
  let timer;
  if (overrides.scheduler !== false)
    timer = setInterval(async () => {
      const cfg = settings(db);
      const last = db
        .prepare(
          "SELECT created_at FROM jobs WHERE kind='backup' ORDER BY created_at DESC LIMIT 1",
        )
        .get();
      if (
        cfg.backupIntervalHours > 0 &&
        (!last ||
          Date.now() - Date.parse(last.created_at) >
            cfg.backupIntervalHours * 3600_000)
      )
        await job("backup", null, async () => {
          const result = await createBackup(db, c);
          await pruneBackups(db, c, cfg.backupKeep);
          return result;
        }).catch(() => {});
      const sync = db
        .prepare(
          "SELECT state,detail,created_at,finished_at FROM jobs WHERE kind='sync' ORDER BY created_at DESC,rowid DESC LIMIT 8",
        )
        .all();
      if (scheduledSyncDue(cfg, sync))
        await job("sync", null, () => synchronize(db)).catch(() => {});
      try {
        transaction(db, () => settleDueAdoptions(db, settings(db)));
      } catch (error) {
        app.log.error(
          error,
          "Confirmation automatique des adoptions impossible",
        );
      }
    }, 60_000);
  timer?.unref();
  app.addHook("onClose", async () => {
    clearInterval(timer);
    while (running.size) await new Promise((r) => setTimeout(r, 100));
    db.close();
  });
  return app;
}
