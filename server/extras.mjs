import {
  nameCatalogueService,
  localTakenNames,
  nameKey,
  nameKeys,
} from "./name-catalogue.mjs";
import { themedNames, nameThemes } from "../shared/name-themes.mjs";
import { registerAuthorAvatar } from "./author-avatar.mjs";
import { registerSourceMatches } from "./source-match.mjs";
import { registerGeoIP } from "./geoip.mjs";
import { z } from "zod";
import path from "node:path";
import { createReadStream, createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { id, now, audit, settings, transaction } from "./db.mjs";
import { assertStorage, root } from "./config.mjs";
import { exportPhoto, albumZip, presentationCard } from "./exports.mjs";
import { validateNetwork, matchesNetwork } from "./ip-access.mjs";
import { forecast } from "./weather.mjs";
import { localPost, aiPost } from "./social.mjs";
import { sourcePhotoBuffer } from "./source-photo.mjs";
import { registerVisitors } from "./visitors.mjs";
import { pageAccessGuard } from "./page-access.mjs";
import { registerAudioSettings } from "./audio-settings.mjs";
import { registerInsights } from "./insights.mjs";
import { registerVideo } from "./video.mjs";
import { registerAlbums } from "./albums.mjs";
import { registerBroadcasts } from "./broadcasts.mjs";
import { registerInbox } from "./inbox.mjs";
import { registerShootSheet } from "./shoot-sheet.mjs";
import { registerCanva } from "./canva.mjs";
import { registerSourcePhoto } from "./source-photo.mjs";
import { registerTeamAI } from "./team-ai.mjs";
import { registerPhotoEdits } from "./photo-edits.mjs";
import { registerAssistantAvatar } from "./assistant-avatar.mjs";
import { photoPriority } from "../shared/photo-priority.mjs";
import { registerMessages } from "./team-messages.mjs";
import { registerVideoManagement } from "./video-management.mjs";
import { registerMusic } from "./music-catalog.mjs";
import { publicAnimalMetadata } from "./animal-facts.mjs";
import { registerHistory } from "./animal-history.mjs";
import { registerPhotoCollaboration } from "./photo-collaboration.mjs";
import { registerCommunication } from "./communication.mjs";
import { registerAnimalMedia } from "./animal-media.mjs";
import { registerMotion } from "./motion.mjs";
import { registerDisplay } from "./refuge-display.mjs";
import { registerSimilar } from "./similar-photos.mjs";
import { registerTranscription } from "./transcription.mjs";
const UUID = z.string().uuid();
const all = ["admin", "editor", "agent", "viewer"];
const fail = (message, code = 404) =>
  Object.assign(new Error(message), { statusCode: code });
const xml = (value) =>
  String(value ?? "").replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
export async function registerExtras(app, { db, c, authorized, job }) {
  await registerVisitors(app, { db, c, authorized });
  await registerAuthorAvatar(app, { db });
  await registerSourceMatches(app, { db, c, authorized });
  await registerGeoIP(app, { c, authorized });
  await registerAudioSettings(app, { db, c, authorized });
  await registerHistory(app, { db, authorized });
  await registerPhotoCollaboration(app, { db, authorized });
  await registerCommunication(app, { db, c, authorized });
  await registerDisplay(app, { db, c, authorized });
  await registerAnimalMedia(app, { db, c, authorized });
  await registerMotion(app, { db, c, authorized, job });
  await registerSimilar(app, { db, c, authorized, job });
  await registerTranscription(app, { db, c, authorized });
  await registerInsights(app, { db, c, authorized });
  await registerAlbums(app, { db, c, authorized });
  await registerBroadcasts(app, { db, c });
  await registerInbox(app, { db, c, authorized });
  await registerShootSheet(app, { db, authorized });
  await registerCanva(app, { db, c, authorized });
  await registerSourcePhoto(app, { db, c });
  await registerTeamAI(app, { db, c, authorized });
  await registerPhotoEdits(app, { db, c, authorized });
  await registerAssistantAvatar(app, { db, authorized });
  await registerMessages(app, { db, authorized });
  await registerVideoManagement(app, { db, authorized });
  await registerMusic(app, { db, c, authorized });
  const findAnimal = (value) => {
    const a = db
      .prepare("SELECT * FROM animals WHERE id=?")
      .get(UUID.parse(value));
    if (!a) throw fail("Animal introuvable.");
    return a;
  };
  const findPhoto = (value, user) => {
    const p = db
      .prepare(
        "SELECT p.*,b.mime,b.width,b.height,b.size FROM photos p JOIN blobs b ON b.hash=p.hash WHERE p.id=?",
      )
      .get(UUID.parse(value));
    if (!p || (p.hidden && !user)) throw fail("Photo introuvable.");
    return p;
  };
  app.get(
    "/api/photos/:id/download",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const photo = findPhoto(req.params.id, req.user);
      const options = z
        .object({
          format: z.enum(["original", "jpeg", "png", "webp"]).default("jpeg"),
          size: z
            .enum(["small", "medium", "large", "social"])
            .default("medium"),
          layout: z.enum(["fit", "square", "portrait"]).default("fit"),
        })
        .parse(req.query);
      if (options.format === "original" && !req.user)
        throw fail("Connectez-vous pour télécharger un original.", 401);
      const filename =
        options.format === "original"
          ? photo.filename
          : path.basename(photo.filename, path.extname(photo.filename)) +
            `-${options.size}.${options.format === "jpeg" ? "jpg" : options.format}`;
      reply.header(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      );
      audit(db, req.user, "photo_downloaded", {
        photoId: photo.id,
        format: options.format,
        size: options.size,
      });
      return options.format === "original"
        ? reply
            .type(photo.mime)
            .send(createReadStream(path.join(c.mediaDir, photo.hash)))
        : reply
            .type("image/" + options.format)
            .send(await exportPhoto(c, photo, options));
    },
  );
  app.get(
    "/api/animals/:id/download",
    {
      preHandler: authorized(all),
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const animal = findAnimal(req.params.id);
      const photos = db
        .prepare(
          "SELECT * FROM photos WHERE animal_id=? ORDER BY created_at,id",
        )
        .all(animal.id);
      if (!photos.length) throw fail("Cet album ne contient pas de photo.");
      reply.header(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(animal.name + "-" + animal.id.slice(0, 8) + ".zip")}`,
      );
      audit(db, req.user, "album_downloaded", {
        animalId: animal.id,
        count: photos.length,
      });
      return reply.type("application/zip").send(albumZip(c, animal, photos));
    },
  );
  app.get(
    "/api/animals/:id/presentation",
    { preHandler: authorized(all) },
    async (req, reply) => {
      const animal = findAnimal(req.params.id);
      let photo =
        req.query.photoId === "spa"
          ? null
          : req.query.photoId
            ? findPhoto(req.query.photoId, req.user)
            : db
                .prepare(
                  "SELECT * FROM photos WHERE animal_id=? ORDER BY hidden,archived_at IS NOT NULL,created_at DESC LIMIT 1",
                )
                .get(animal.id);
      if (!photo)
        photo = {
          buffer: await sourcePhotoBuffer(db, c, animal.id, 1280),
          animal_id: animal.id,
        };
      if (photo.animal_id !== animal.id)
        throw fail("Choisissez une photo de cet animal.");
      reply.header(
        "Content-Disposition",
        `${req.query.inline === "1" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(animal.name + "-presentation.jpg")}`,
      );
      return reply
        .type("image/jpeg")
        .send(await presentationCard(c, animal, photo, req.query));
    },
  );
  app.post(
    "/api/photos/:id/like",
    { preHandler: authorized(all) },
    async (req) => {
      const photo = findPhoto(req.params.id, req.user);
      const { liked } = z.object({ liked: z.boolean() }).parse(req.body);
      if (liked)
        db.prepare("INSERT OR IGNORE INTO photo_likes VALUES (?,?,?)").run(
          req.user.id,
          photo.id,
          now(),
        );
      else
        db.prepare(
          "DELETE FROM photo_likes WHERE user_id=? AND photo_id=?",
        ).run(req.user.id, photo.id);
      return {
        likes: db
          .prepare("SELECT COUNT(*) n FROM photo_likes WHERE photo_id=?")
          .get(photo.id).n,
        liked,
      };
    },
  );
  app.get("/api/tasks", { preHandler: authorized(all) }, async () =>
    db
      .prepare(
        "SELECT t.*,a.name animal_name,a.species,a.cover_id,a.source_metadata,u.name author,v.name assignee FROM shoot_tasks t JOIN animals a ON a.id=t.animal_id LEFT JOIN users u ON u.id=t.created_by LEFT JOIN users v ON v.id=t.assigned_to WHERE NOT EXISTS(SELECT 1 FROM task_deletions d WHERE d.task_id=t.id) AND (a.archived_at IS NULL OR t.state='done') ORDER BY t.state='done',CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,t.created_at DESC LIMIT 500",
      )
      .all()
      .map((t) => ({
        ...t,
        source_metadata: publicAnimalMetadata(
          JSON.parse(t.source_metadata || "{}"),
        ),
      })),
  );
  const Task = z.object({
    animalId: UUID,
    title: z.string().trim().min(1).max(120),
    note: z.string().max(2000).default(""),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    state: z.enum(["todo", "progress", "done"]).default("todo"),
    assignedTo: UUID.nullable().default(null),
  });
  app.post("/api/tasks", { preHandler: authorized() }, async (req, reply) => {
    const t = Task.parse(req.body);
    const animal = findAnimal(t.animalId);
    if (
      t.assignedTo &&
      !db
        .prepare("SELECT id FROM users WHERE id=? AND active=1")
        .get(t.assignedTo)
    )
      throw fail("Membre introuvable.");
    const taskId = id();
    db.prepare("INSERT INTO shoot_tasks VALUES (?,?,?,?,?,?,?,?,?,?)").run(
      taskId,
      t.animalId,
      t.title,
      t.note,
      t.priority ?? photoPriority(animal, settings(db).photoRules).priority,
      t.state,
      req.user.id,
      t.assignedTo,
      now(),
      now(),
    );
    audit(db, req.user, "task_created", { id: taskId, animalId: t.animalId });
    return reply.code(201).send({ id: taskId });
  });
  app.patch("/api/tasks/:id", { preHandler: authorized() }, async (req) => {
    const taskId = UUID.parse(req.params.id);
    const t = db.prepare("SELECT * FROM shoot_tasks WHERE id=?").get(taskId);
    if (!t) throw fail("Demande introuvable.");
    if (
      req.headers["x-anipic-version"] &&
      req.headers["x-anipic-version"] !== t.updated_at
    )
      throw fail(
        "Cette demande a été modifiée par un autre membre. Actualisez le planning.",
        409,
      );
    const parsed = Task.omit({ animalId: true })
      .partial()
      .extend({ deleted: z.boolean().optional() })
      .parse(req.body);
    const update = Object.fromEntries(
      Object.entries(parsed).filter(([key]) => Object.hasOwn(req.body, key)),
    );
    if (
      update.assignedTo &&
      !db
        .prepare("SELECT id FROM users WHERE id=? AND active=1")
        .get(update.assignedTo)
    )
      throw fail("Membre introuvable.");
    transaction(db, () => {
      if (parsed.deleted !== undefined) {
        if (parsed.deleted)
          db.prepare("INSERT OR REPLACE INTO task_deletions VALUES (?,?)").run(
            taskId,
            now(),
          );
        else
          db.prepare("DELETE FROM task_deletions WHERE task_id=?").run(taskId);
      }
      db.prepare(
        "UPDATE shoot_tasks SET title=?,note=?,priority=?,state=?,assigned_to=?,updated_at=? WHERE id=?",
      ).run(
        update.title ?? t.title,
        update.note ?? t.note,
        update.priority ?? t.priority,
        update.state ?? t.state,
        update.assignedTo === undefined ? t.assigned_to : update.assignedTo,
        new Date(
          Math.max(Date.now(), Date.parse(t.updated_at) + 1),
        ).toISOString(),
        taskId,
      );
    });
    audit(
      db,
      req.user,
      parsed.deleted === true
        ? "task_removed"
        : parsed.deleted === false
          ? "task_restored"
          : "task_updated",
      { id: taskId, state: update.state },
    );
    return {
      ok: true,
      updatedAt: db
        .prepare("SELECT updated_at FROM shoot_tasks WHERE id=?")
        .get(taskId).updated_at,
    };
  });
  app.get(
    "/api/feed",
    { preHandler: pageAccessGuard(db, "activity") },
    async (req) => {
      const q = z
        .object({
          after: z.coerce.number().int().min(0).default(0),
          before: z.coerce.number().int().min(1).optional(),
          latest: z.enum(["0", "1"]).default("0"),
          kind: z
            .enum(["all", "added", "removed", "restored", "adopted"])
            .default("all"),
          limit: z.coerce.number().int().min(1).max(500).default(100),
        })
        .parse(req.query);
      const events = db
        .prepare(
          `SELECT e.*,a.source_metadata,a.breed,a.sex,a.source_id,substr(a.description,1,180) description,(SELECT COUNT(*) FROM photos p WHERE p.animal_id=e.animal_id AND ${req.user ? "1=1" : "p.hidden=0"}) photo_count,(SELECT p.id FROM photos p WHERE p.animal_id=e.animal_id AND (?=1 OR p.hidden=0) ORDER BY p.archived_at IS NOT NULL,p.created_at DESC LIMIT 1) photo_id FROM feed_events e LEFT JOIN animals a ON a.id=e.animal_id WHERE ${q.latest === "1" ? "e.seq<?" : "e.seq>?"} AND (?='all' OR (?='adopted' AND e.status='adopted') OR (?!='adopted' AND e.kind=?)) ORDER BY e.seq ${q.latest === "1" ? "DESC" : "ASC"} LIMIT ?`,
        )
        .all(
          req.user ? 1 : 0,
          q.latest === "1" ? q.before || Number.MAX_SAFE_INTEGER : q.after,
          q.kind,
          q.kind,
          q.kind,
          q.kind,
          q.limit,
        );
      return {
        events: events.map(({ source_metadata, ...event }) => ({
          ...event,
          source_metadata: {
            ageLabel: publicAnimalMetadata(JSON.parse(source_metadata || "{}"))
              .ageLabel,
            thumbnail: publicAnimalMetadata(JSON.parse(source_metadata || "{}"))
              .thumbnail,
          },
        })),
        lastSeq: events.at(-1)?.seq ?? q.after,
        before: events.at(-1)?.seq ?? null,
        hasMore: events.length === q.limit,
      };
    },
  );
  app.get(
    "/feed.xml",
    { preHandler: pageAccessGuard(db, "activity") },
    async (req, reply) => {
      const rows = db
        .prepare("SELECT * FROM feed_events ORDER BY seq DESC LIMIT 100")
        .all();
      const label = {
        added: "Nouvel animal",
        removed: "Départ ou archivage",
        restored: "Animal réapparu",
      };
      const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xml(settings(db).refugeName)} · Anipic</title><link>${xml(c.origin)}</link><description>Ajouts, départs et restaurations enregistrés. Une absence de source ne prouve pas une adoption.</description><language>fr-fr</language>${rows.map((e) => `<item><title>${xml(label[e.kind] || e.kind)} : ${xml(e.name)}</title><link>${xml(c.origin + "/#animal/" + e.animal_id)}</link><guid isPermaLink="false">${xml(e.id)}</guid><pubDate>${new Date(e.created_at).toUTCString()}</pubDate><description>${xml(e.name + " · " + e.status)}</description></item>`).join("")}</channel></rss>`;
      return reply
        .type("application/rss+xml; charset=utf-8")
        .header("Cache-Control", "public, max-age=120")
        .send(rss);
    },
  );
  app.get("/api/weather", async () => forecast(c.weatherFetcher));
  const nameCatalogue = await nameCatalogueService(app, db, c);
  app.get(
    "/api/tools/names/catalogue",
    { preHandler: authorized(["admin", "editor", "agent"]) },
    async () => nameCatalogue.status(),
  );
  app.post(
    "/api/tools/names/refresh",
    {
      preHandler: authorized(["admin", "editor", "agent"]),
      config: { rateLimit: { max: 3, timeWindow: "1 minute" } },
    },
    async () => nameCatalogue.start(),
  );
  app.get("/api/tools/names", async (req) => {
    const q = z
      .object({
        sex: z.enum(["female", "male", "any"]).default("any"),
        letter: z
          .string()
          .regex(/^[A-Za-zÀ-ÿ]?$/)
          .default(""),
        theme: z.enum(Object.keys(nameThemes)).default("all"),
        count: z.coerce.number().int().min(1).max(24).default(12),
      })
      .parse(req.query);
    const female = [
      "Alba",
      "Alma",
      "Athéna",
      "Azura",
      "Bella",
      "Biscotte",
      "Brume",
      "Callie",
      "Câline",
      "Choupette",
      "Dahlia",
      "Daisy",
      "Dune",
      "Eden",
      "Églantine",
      "Elsa",
      "Fleur",
      "Frimousse",
      "Gaïa",
      "Griotte",
      "Havane",
      "Hazel",
      "Iris",
      "Isis",
      "Jade",
      "June",
      "Kira",
      "Kiwi",
      "Lila",
      "Luna",
      "Maya",
      "Moka",
      "Nala",
      "Nova",
      "Opale",
      "Olympe",
      "Perle",
      "Plume",
      "Praline",
      "Queen",
      "Quetsche",
      "Rose",
      "Ruby",
      "Sakura",
      "Suki",
      "Talia",
      "Tess",
      "Uma",
      "Utopia",
      "Vega",
      "Violette",
      "Willow",
      "Wendy",
      "Xena",
      "Xia",
      "Yumi",
      "Yara",
      "Zelda",
      "Zora",
    ];
    const male = [
      "Aiko",
      "Apollo",
      "Atlas",
      "Bambou",
      "Baltic",
      "Bowie",
      "Charlie",
      "Charly",
      "Cookie",
      "Django",
      "Dobby",
      "Eliott",
      "Émile",
      "Félix",
      "Flocon",
      "Gatsby",
      "Gizmo",
      "Hector",
      "Hugo",
      "Indy",
      "Iago",
      "Jazz",
      "Jules",
      "Koda",
      "Kumo",
      "Léo",
      "Loki",
      "Milo",
      "Moka",
      "Nougat",
      "Nino",
      "Oscar",
      "Orion",
      "Paco",
      "Pixel",
      "Quartz",
      "Quincy",
      "Rio",
      "Romy",
      "Simba",
      "Sacha",
      "Tao",
      "Tango",
      "Ulysse",
      "Uno",
      "Vasco",
      "Vito",
      "Watson",
      "Woody",
      "Xavi",
      "Xenon",
      "Yoshi",
      "Yuki",
      "Ziggy",
      "Zorro",
    ];
    const taken = localTakenNames(db);
    for (const name of nameCatalogue.names())
      for (const key of nameKeys(name)) taken.add(key);
    const national = nameCatalogue.status();
    const choices = (
      q.theme !== "all"
        ? themedNames(q.theme, q.sex)
        : q.sex === "female"
          ? female
          : q.sex === "male"
            ? male
            : [...new Set([...female, ...male])]
    ).filter(
      (name) =>
        national.ready &&
        !taken.has(nameKey(name)) &&
        (!q.letter ||
          name
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .startsWith(
              q.letter
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase(),
            )),
    );
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    return {
      names: choices.slice(0, q.count),
      avoidsExisting: true,
      national,
      excludesDeparted: false,
      theme: q.theme,
      themes: nameThemes,
    };
  });
  app.get("/api/social/status", { preHandler: authorized() }, async () => ({
    gemini: !!process.env.GEMINI_API_KEY,
    tokenharbor:
      !!process.env.TOKENHARBOR_API_KEY &&
      !!(settings(db).tokenharborModel || process.env.TOKENHARBOR_MODEL),
  }));
  app.post(
    "/api/animals/:id/post",
    {
      preHandler: authorized(),
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async (req) => {
      const animal = findAnimal(req.params.id);
      const { provider, tone } = z
        .object({
          provider: z.enum(["local", "gemini", "tokenharbor"]).default("local"),
          tone: z.enum(["warm", "short"]).default("warm"),
        })
        .parse(req.body);
      const text =
        provider === "local"
          ? localPost(animal, tone)
          : await aiPost(animal, provider, tone, c.aiFetcher, settings(db));
      audit(db, req.user, "post_draft", { animalId: animal.id, provider });
      return { text, provider, draft: true };
    },
  );
  app.get(
    "/api/admin/ip-rules",
    { preHandler: authorized(["admin"]) },
    async (req) => ({
      ip: req.ip,
      trustProxy: c.trustProxy,
      rules: db
        .prepare(
          "SELECT r.*,u.name,u.role FROM ip_rules r JOIN users u ON u.id=r.user_id ORDER BY r.created_at DESC",
        )
        .all(),
    }),
  );
  app.post(
    "/api/admin/ip-rules",
    { preHandler: authorized(["admin"]) },
    async (req, reply) => {
      const input = z
        .object({
          userId: UUID,
          network: z.string().max(100),
          label: z.string().max(100).default(""),
        })
        .parse(req.body);
      const network = validateNetwork(input.network);
      if (
        !db
          .prepare("SELECT id FROM users WHERE id=? AND active=1")
          .get(input.userId)
      )
        throw fail("Compte actif introuvable.");
      if (input.userId === req.user.id && !matchesNetwork(req.ip, network))
        throw fail(
          "Votre propre règle doit autoriser votre IP actuelle pour éviter un blocage.",
          400,
        );
      if (
        db
          .prepare("SELECT id FROM ip_rules WHERE user_id=? AND network=?")
          .get(input.userId, network)
      )
        throw fail("Cette règle existe déjà.", 409);
      const ruleId = id();
      db.prepare("INSERT INTO ip_rules VALUES (?,?,?,?,?)").run(
        ruleId,
        input.userId,
        network,
        input.label,
        now(),
      );
      db.prepare("DELETE FROM sessions WHERE user_id=? AND user_id<>?").run(
        input.userId,
        req.user.id,
      );
      audit(db, req.user, "ip_rule_added", {
        id: ruleId,
        userId: input.userId,
        network,
      });
      return reply.code(201).send({ id: ruleId });
    },
  );
  app.delete(
    "/api/admin/ip-rules/:id",
    { preHandler: authorized(["admin"]) },
    async (req) => {
      const ruleId = UUID.parse(req.params.id);
      db.prepare("DELETE FROM ip_rules WHERE id=?").run(ruleId);
      audit(db, req.user, "ip_rule_removed", { id: ruleId });
      return { ok: true };
    },
  );
  app.get(
    "/api/admin/access-log",
    { preHandler: authorized(["admin"]) },
    async (req) => {
      const q = z
        .object({
          ip: z.string().max(64).default(""),
          limit: z.coerce.number().int().min(1).max(500).default(150),
        })
        .parse(req.query);
      const rows = db
        .prepare(
          "SELECT l.*,u.name FROM access_log l LEFT JOIN users u ON u.id=l.user_id WHERE (?='' OR ip=?) ORDER BY created_at DESC LIMIT ?",
        )
        .all(q.ip, q.ip, q.limit);
      return {
        rows,
        ips: db
          .prepare(
            "SELECT ip,COUNT(*) requests,MAX(created_at) last_seen,SUM(status>=400) errors FROM access_log GROUP BY ip ORDER BY last_seen DESC LIMIT 100",
          )
          .all(),
      };
    },
  );
  app.post(
    "/api/admin/import-legacy",
    {
      preHandler: authorized(["admin"]),
      config: { rateLimit: { max: 3, timeWindow: "1 hour" } },
    },
    async (req) => {
      assertStorage(c);
      const stage = await fs.mkdtemp(path.join(c.backupDir, ".import-"));
      const archive = path.join(stage, "legacy.zip");
      let mapping = {};
      let found = false;
      try {
        for await (const part of req.parts({
          limits: {
            fileSize: 1024 ** 3,
            files: 1,
            fields: 1,
            fieldSize: 2 * 1024 ** 2,
          },
        })) {
          if (part.type === "field" && part.fieldname === "mapping")
            mapping = z
              .record(z.string().max(500), z.string().min(1).max(200))
              .parse(JSON.parse(part.value));
          else if (part.type === "file") {
            if (found || !part.filename.toLowerCase().endsWith(".zip"))
              throw fail("Une archive ZIP est requise.", 400);
            found = true;
            let bytes = 0;
            await pipeline(
              part.file,
              new Transform({
                transform(chunk, e, cb) {
                  bytes += chunk.length;
                  cb(
                    bytes > 1024 ** 3
                      ? fail("Archive limitée à 1 Go.", 413)
                      : null,
                    chunk,
                  );
                },
              }),
              createWriteStream(archive, { flags: "wx" }),
            );
            if (part.file.truncated) throw fail("Archive limitée à 1 Go.", 413);
          }
        }
        if (!found) throw fail("Archive ZIP absente.", 400);
        const mapFile = path.join(stage, "mapping.json");
        await fs.writeFile(mapFile, JSON.stringify(mapping));
        return await job("legacy_import", req.user, async () => {
          try {
            return await new Promise((resolve, reject) => {
              const child = spawn(
                process.execPath,
                [
                  path.join(root, "scripts/import-legacy.mjs"),
                  "--zip",
                  archive,
                  "--mapping",
                  mapFile,
                  "--commit",
                  "--archive",
                ],
                {
                  shell: false,
                  windowsHide: true,
                  env: {
                    ...process.env,
                    DB_DIR: c.dbDir,
                    MEDIA_DIR: c.mediaDir,
                    CACHE_DIR: c.cacheDir,
                    BACKUP_DIR: c.backupDir,
                  },
                },
              );
              let output = "",
                error = "";
              const timeout = setTimeout(() => {
                child.kill();
                reject(
                  new Error(
                    "Import interrompu après 30 minutes; les photos déjà importées sont conservées.",
                  ),
                );
              }, 30 * 60_000);
              child.stdout.on("data", (data) => {
                output += data;
                if (output.length > 1000000) {
                  child.kill();
                  reject(new Error("Journal d’import trop volumineux."));
                }
              });
              child.stderr.on(
                "data",
                (data) => (error = (error + data).slice(-3000)),
              );
              child.on("error", (e) => {
                clearTimeout(timeout);
                reject(e);
              });
              child.on("close", (code) => {
                clearTimeout(timeout);
                if (code)
                  reject(
                    new Error(
                      error ||
                        "Import interrompu. Les photos déjà importées sont conservées.",
                    ),
                  );
                else
                  try {
                    resolve(JSON.parse(output));
                  } catch {
                    reject(new Error("Résultat d’import invalide."));
                  }
              });
            });
          } finally {
            await fs.rm(stage, { recursive: true, force: true });
          }
        });
      } catch (error) {
        await fs.rm(stage, { recursive: true, force: true });
        throw error;
      }
    },
  );
  await registerVideo(app, { db, c, authorized, job, findAnimal, findPhoto });
}
