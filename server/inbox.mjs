import { registerPhotoAssignments } from "./photo-assignment.mjs";
export { assignInbox } from "./photo-assignment.mjs";
import { z } from "zod";
import path from "node:path";
import { promises as fs, createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { ingest, derivative } from "./storage.mjs";
import { id, now, transaction, settings, saveSettings, audit } from "./db.mjs";
import { assertStorage } from "./config.mjs";
const UUID = z.string().uuid();
const fail = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });
const folderName = (value) =>
  String(value || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter((p) => p && p !== "." && p !== "..")
    .join("/")
    .replace(/[\x00-\x1f]/g, "")
    .slice(0, 400);

export async function scanImports(db, c, userId = null) {
  assertStorage(c);
  if (!c.importDir)
    throw fail("Configurez IMPORT_DIR pour utiliser le dossier de dépôt.");
  const base = await fs.realpath(c.importDir),
    result = {
      added: 0,
      duplicates: 0,
      skipped: 0,
      errors: [],
      more: false,
      limitReached: false,
    };
  let visited = 0,
    processed = 0;
  async function walk(directory, depth = 0) {
    if (depth > 6 || result.more || result.limitReached) return;
    const handle = await fs.opendir(directory);
    for await (const entry of handle) {
      if (++visited > 10000) {
        result.limitReached = true;
        break;
      }
      if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(full, depth + 1);
        if (result.more || result.limitReached) break;
        continue;
      }
      if (!entry.isFile() || !/\.(jpe?g|png|webp|avif)$/i.test(entry.name))
        continue;
      const resolved = await fs.realpath(full);
      if (!resolved.startsWith(base + path.sep)) continue;
      const stat = await fs.stat(resolved),
        relative = path.relative(base, resolved);
      if (
        stat.mtimeMs > Date.now() - settings(db).importStableSeconds * 1000 ||
        stat.size > c.maxUploadBytes
      ) {
        result.skipped++;
        continue;
      }
      const key = createHash("sha256")
        .update(base + "\0" + relative)
        .digest("hex");
      const receipt = db
        .prepare("SELECT * FROM import_receipts WHERE source_key=?")
        .get(key);
      if (
        receipt &&
        receipt.size === stat.size &&
        receipt.mtime_ms === stat.mtimeMs
      ) {
        result.skipped++;
        continue;
      }
      if (processed >= 100) {
        result.more = true;
        break;
      }
      processed++;
      try {
        const photo = await ingest(
          db,
          c,
          null,
          createReadStream(resolved),
          entry.name,
          false,
          null,
          {
            folder: folderName(
              path.dirname(relative) === "." ? "" : path.dirname(relative),
            ),
            userId,
          },
        );
        const blob = db
          .prepare("SELECT hash FROM inbox_photos WHERE id=?")
          .get(photo.id);
        db.prepare(
          "INSERT INTO import_receipts VALUES (?,?,?,?,?) ON CONFLICT(source_key) DO UPDATE SET size=excluded.size,mtime_ms=excluded.mtime_ms,hash=excluded.hash,imported_at=excluded.imported_at",
        ).run(key, stat.size, stat.mtimeMs, blob.hash, now());
        result[photo.duplicate ? "duplicates" : "added"]++;
      } catch (e) {
        if (result.errors.length < 10)
          result.errors.push({
            file: folderName(relative),
            error: e.statusCode
              ? e.message
              : "Image illisible ou dossier indisponible.",
          });
      }
    }
  }
  await walk(base);
  return result;
}

export async function registerInbox(app, { db, c, authorized }) {
  await registerPhotoAssignments(app, { db, c, authorized });
  let scanning = false;
  let last = null,
    nextAt = 0,
    closing = false;
  async function scan(user) {
    if (scanning) throw fail("Une lecture du dossier est déjà en cours.", 409);
    scanning = true;
    try {
      const result = await scanImports(db, c, user?.id);
      last = { at: now(), ...result };
      saveSettings(db, { importLastScan: last });
      audit(db, user, "inbox_scanned", {
        added: result.added,
        duplicates: result.duplicates,
        automatic: !user,
      });
      return result;
    } catch (e) {
      last = {
        at: now(),
        error: e.statusCode ? e.message : "Dossier de dépôt indisponible.",
      };
      saveSettings(db, { importLastScan: last });
      throw e;
    } finally {
      scanning = false;
      nextAt = Date.now() + settings(db).importIntervalMinutes * 60000;
    }
  }
  const timer =
    c.scheduler === false
      ? null
      : setInterval(async () => {
          if (
            closing ||
            scanning ||
            !c.importDir ||
            !settings(db).importAutoEnabled ||
            Date.now() < nextAt
          )
            return;
          await scan(null).catch(() => {});
        }, 15000);
  timer?.unref();
  app.addHook("preClose", async () => {
    closing = true;
    clearInterval(timer);
    while (scanning) await new Promise((r) => setTimeout(r, 50));
  });
  app.get(
    "/api/inbox/automation",
    { preHandler: authorized(["admin"]) },
    async () => {
      const cfg = settings(db);
      return {
        configured: !!c.importDir,
        enabled: cfg.importAutoEnabled,
        intervalMinutes: cfg.importIntervalMinutes,
        stableSeconds: cfg.importStableSeconds,
        running: scanning,
        scheduler: c.scheduler !== false,
        last: last || cfg.importLastScan || null,
        nextAt: nextAt ? new Date(nextAt).toISOString() : null,
      };
    },
  );
  app.put(
    "/api/inbox/automation",
    { preHandler: authorized(["admin"]) },
    async (req) => {
      const input = z
        .object({
          enabled: z.boolean(),
          intervalMinutes: z.number().int().min(1).max(1440),
          stableSeconds: z.number().int().min(10).max(600),
        })
        .parse(req.body);
      saveSettings(db, {
        importAutoEnabled: input.enabled,
        importIntervalMinutes: input.intervalMinutes,
        importStableSeconds: input.stableSeconds,
      });
      nextAt = Date.now() + input.intervalMinutes * 60000;
      audit(db, req.user, "import_automation_configured", input);
      return { ok: true };
    },
  );
  app.post(
    "/api/inbox/suggestions",
    { preHandler: authorized() },
    async (req) => {
      const { photoIds } = z
        .object({ photoIds: z.array(UUID).min(1).max(200) })
        .parse(req.body);
      const folders = [
        ...new Set(
          photoIds
            .map(
              (value) =>
                db
                  .prepare(
                    "SELECT folder FROM inbox_photos WHERE id=? AND archived_at IS NULL",
                  )
                  .get(value)?.folder,
            )
            .filter(Boolean),
        ),
      ];
      const normalize = (v) =>
        String(v || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
      const animals = db
        .prepare(
          "SELECT id,name,species,sex,source_id,cover_id,source_metadata FROM animals WHERE archived_at IS NULL",
        )
        .all();
      const hints = folders.map((folder) => ({
        parts: folder.split("/").reverse().map(normalize),
        remembered: db
          .prepare("SELECT animal_id FROM import_folders WHERE folder=?")
          .get(folder)?.animal_id,
      }));
      const found = [];
      for (const a of animals) {
        let score = 0,
          reason = "";
        for (const { parts, remembered } of hints) {
          const source = String(a.source_id || "")
            .split(":")
            .at(-1);
          const scoreId =
            source &&
            source.length >= 3 &&
            parts.some((p) => p.split(" ").includes(normalize(source)));
          const scoreName = parts.some((p) => p === normalize(a.name));
          const s =
            remembered === a.id ? 100 : scoreId ? 90 : scoreName ? 60 : 0;
          if (s > score) {
            score = s;
            reason =
              s === 100
                ? "Dossier associé précédemment"
                : s === 90
                  ? "Identifiant dans le dossier"
                  : "Nom du dossier — vérifiez le portrait et l’ID";
          }
        }
        if (score)
          found.push({
            ...a,
            source_metadata: undefined,
            hasSpaPhoto: !!JSON.parse(a.source_metadata || "{}").thumbnail,
            score,
            reason,
          });
      }
      return {
        folders,
        items: found
          .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
          .slice(0, 20),
      };
    },
  );
  app.get("/api/inbox", { preHandler: authorized() }, async (req) => {
    const q = z
      .object({
        page: z.coerce.number().int().min(1).max(10000).default(1),
        folder: z.string().max(400).default(""),
        q: z.string().max(100).default(""),
        archived: z.enum(["0", "1"]).default("0"),
      })
      .parse(req.query);
    const clauses = [
        q.archived === "1"
          ? "p.archived_at IS NOT NULL"
          : "p.archived_at IS NULL",
      ],
      args = [];
    if (q.folder) {
      clauses.push("p.folder=?");
      args.push(q.folder);
    }
    if (q.q) {
      clauses.push(
        "(p.filename LIKE ? ESCAPE '\\' OR p.folder LIKE ? ESCAPE '\\')",
      );
      const term = "%" + q.q.replace(/[\\%_]/g, "\\$&") + "%";
      args.push(term, term);
    }
    const where = clauses.join(" AND "),
      total = db
        .prepare(`SELECT COUNT(*) n FROM inbox_photos p WHERE ${where}`)
        .get(...args).n;
    const items = db
      .prepare(
        `SELECT p.*,b.width,b.height,b.size FROM inbox_photos p JOIN blobs b ON b.hash=p.hash WHERE ${where} ORDER BY p.folder,p.created_at,p.id LIMIT 60 OFFSET ?`,
      )
      .all(...args, (q.page - 1) * 60)
      .map(({ hash, ...photo }) => photo);
    return {
      items,
      total,
      page: q.page,
      pages: Math.ceil(total / 60),
      folders: db
        .prepare(
          `SELECT folder,COUNT(*) count FROM inbox_photos WHERE archived_at IS ${q.archived === "1" ? "NOT " : ""}NULL GROUP BY folder ORDER BY folder`,
        )
        .all(),
      importFolderConfigured: !!c.importDir,
    };
  });
  app.post(
    "/api/inbox/photos",
    {
      preHandler: authorized(),
      config: { rateLimit: { max: 600, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const folder = folderName(
        z.string().max(500).default("").parse(req.query.folder),
      );
      const file = await req.file();
      if (!file) throw fail("Choisissez une photo.");
      const result = await ingest(
        db,
        c,
        null,
        file.file,
        file.filename,
        false,
        null,
        { folder, userId: req.user.id },
      );
      audit(db, req.user, "inbox_uploaded", {
        id: result.id,
        duplicate: result.duplicate,
      });
      return reply.code(201).send(result);
    },
  );
  app.get(
    "/api/inbox/:id/preview",
    { preHandler: authorized() },
    async (req, reply) => {
      const photo = db
        .prepare(
          "SELECT b.* FROM inbox_photos p JOIN blobs b ON b.hash=p.hash WHERE p.id=?",
        )
        .get(UUID.parse(req.params.id));
      if (!photo) throw fail("Photo introuvable.", 404);
      const width = z.coerce
        .number()
        .int()
        .min(160)
        .max(1600)
        .default(640)
        .parse(req.query.width);
      const cfg = settings(db),
        file = await derivative(
          c,
          photo,
          width,
          cfg.thumbQuality,
          cfg.cacheMB * 1024 ** 2,
        );
      return reply.type("image/webp").send(createReadStream(file));
    },
  );
  app.post("/api/inbox/archive", { preHandler: authorized() }, async (req) => {
    const input = z
      .object({
        photoIds: z.array(UUID).min(1).max(200),
        archived: z.boolean(),
      })
      .parse(req.body);
    transaction(db, () => {
      for (const value of input.photoIds) {
        if (!db.prepare("SELECT id FROM inbox_photos WHERE id=?").get(value))
          throw fail("Photo introuvable.", 404);
        db.prepare("UPDATE inbox_photos SET archived_at=? WHERE id=?").run(
          input.archived ? now() : null,
          value,
        );
      }
    });
    audit(db, req.user, input.archived ? "inbox_archived" : "inbox_restored", {
      count: input.photoIds.length,
    });
    return { count: input.photoIds.length };
  });
  app.post(
    "/api/inbox/scan",
    {
      preHandler: authorized(),
      config: { rateLimit: { max: 3, timeWindow: "1 minute" } },
    },
    async (req) => {
      return scan(req.user);
    },
  );
}
