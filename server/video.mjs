import { animalQrAddress, qrData } from "./qr.mjs";
import path from "node:path";
import {
  promises as fs,
  createReadStream,
  createWriteStream,
  existsSync,
} from "node:fs";
import { createServer } from "node:http";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { createHash, randomBytes } from "node:crypto";
import { Input, FilePathSource, MP4, WEBM, MP3, WAVE } from "mediabunny";
import { z } from "zod";
import { id, now, audit, transaction } from "./db.mjs";
import { root, assertStorage } from "./config.mjs";
import { fileHash } from "./backup.mjs";
import { dimensions, filmDuration, FPS } from "../video/timing.mjs";
import { compatibilityLabels } from "../video/facts.mjs";
import { validateCues } from "../shared/subtitles.mjs";
const UUID = z.string().uuid();
const fail = (text, code = 400) =>
  Object.assign(new Error(text), { statusCode: code });
export const Film = z
  .object({
    title: z.string().trim().min(1).max(120),
    subtitle: z.string().max(160).default(""),
    outro: z.string().max(120).default(""),
    template: z.enum(["presentation", "year"]).default("presentation"),
    annualStyle: z.enum(["mosaic", "slideshow"]).default("slideshow"),
    aspect: z.enum(["landscape", "portrait", "square"]).default("landscape"),
    resolution: z.enum(["720", "1080"]).default("720"),
    look: z
      .enum(["editorial", "cinema", "story", "minimal"])
      .default("editorial"),
    transition: z.enum(["fade", "slide", "wipe"]).default("fade"),
    motion: z.enum(["gentle", "lively", "off"]).default("gentle"),
    showQr: z.boolean().default(true),
    showFacts: z.boolean().default(true),
    accentColor: z
      .string()
      .regex(/^#[a-fA-F0-9]{6}$/)
      .default("#f4ab70"),
    brandLabel: z.string().max(100).default("Refuge de Morée"),
    ctaText: z
      .string()
      .max(100)
      .default("Contactez le refuge pour une rencontre"),
    outroSubtitle: z.string().max(180).default(""),
    narrationText: z.string().max(2000).default(""),
    subtitles: z
      .object({
        enabled: z.boolean().default(false),
        style: z.enum(["box", "shadow"]).default("box"),
        position: z.enum(["bottom", "middle"]).default("bottom"),
        source: z
          .enum(["manual", "estimated", "mistral", "srt"])
          .default("manual"),
        cues: z
          .array(
            z.object({
              start: z.number().min(0).max(600),
              end: z.number().min(0).max(600),
              text: z.string().trim().min(1).max(300),
            }),
          )
          .max(500)
          .default([]),
      })
      .default({
        enabled: false,
        style: "box",
        position: "bottom",
        source: "manual",
        cues: [],
      }),
    showLogo: z.boolean().default(true),
    showProgress: z.boolean().default(true),
    introSeconds: z.number().min(0).max(8).default(2),
    outroSeconds: z.number().min(0).max(8).default(2),
    year: z.number().int().min(2000).max(2100).optional(),
    music: z
      .object({ assetId: UUID, volume: z.number().min(0).max(1).default(0.25) })
      .nullable()
      .default(null),
    voiceover: z
      .object({
        assetId: UUID,
        volume: z.number().min(0).max(1).default(1),
        start: z.number().min(0).max(599).default(0),
      })
      .nullable()
      .default(null),
    clips: z
      .array(
        z.object({
          id: UUID.optional(),
          kind: z.enum(["photo", "video"]),
          ref: UUID,
          seconds: z.number().min(1).max(12),
          trim: z.number().min(0).max(300).default(0),
          title: z.string().max(100).default(""),
          subtitle: z.string().max(100).default(""),
          caption: z.string().max(220).default(""),
          fit: z.enum(["cover", "contain"]).default("cover"),
          muted: z.boolean().default(true),
          focusX: z.number().min(0).max(100).default(50),
          focusY: z.number().min(0).max(100).default(50),
        }),
      )
      .min(1)
      .max(100),
  })
  .refine((value) => {
    try {
      validateCues(value.subtitles.cues, filmDuration(value) / FPS);
      return true;
    } catch {
      return false;
    }
  }, "Vérifiez les sous-titres : durées, chevauchements et durée du montage.")
  .refine(
    (value) => filmDuration(value) <= FPS * 600,
    "Film limité à 10 minutes.",
  )
  .refine(
    (value) =>
      value.template !== "year" ||
      value.annualStyle !== "mosaic" ||
      value.clips.every((clip) => clip.kind === "photo"),
    "La mosaïque SPA utilise uniquement des photos. Choisissez le diaporama pour des clips vidéo.",
  );
export async function mediaMetadata(filename, kind) {
  const input = new Input({
    source: new FilePathSource(filename, { maxCacheSize: 8 * 1024 ** 2 }),
    formats: [MP4, WEBM, MP3, WAVE],
  });
  let timer;
  try {
    const metadata = await Promise.race([
      (async () => {
        const duration = await input.computeDuration();
        const video = await input.getPrimaryVideoTrack();
        const audio = await input.getPrimaryAudioTrack();
        const width = video ? await video.getDisplayWidth() : 0,
          height = video ? await video.getDisplayHeight() : 0;
        if (
          !Number.isFinite(duration) ||
          duration <= 0 ||
          duration > 600 ||
          (kind === "video" && !video) ||
          (kind === "audio" && !audio) ||
          width > 4096 ||
          height > 4096 ||
          width * height > 12_000_000
        )
          throw fail(
            "Média non pris en charge : 10 minutes maximum, vidéo jusqu’à 4096 px / 12 mégapixels.",
          );
        const format = await input.getFormat();
        const mime =
          kind === "audio"
            ? format === MP3
              ? "audio/mpeg"
              : format === WAVE
                ? "audio/wav"
                : format === WEBM
                  ? "audio/webm"
                  : "audio/mp4"
            : format === WEBM
              ? "video/webm"
              : "video/mp4";
        return { duration, width, height, mime };
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(fail("Lecture des métadonnées trop lente.")),
          10000,
        );
      }),
    ]);
    return metadata;
  } catch (error) {
    if (error.statusCode) throw error;
    throw fail(
      "Fichier média illisible ou format non pris en charge. Utilisez MP4, WebM, MP3 ou WAV.",
    );
  } finally {
    clearTimeout(timer);
    input.dispose();
  }
}
export async function ingestAsset(db, c, readable, filename, kind, userId) {
  assertStorage(c);
  if (!["audio", "video"].includes(kind)) throw fail("Type de média invalide.");
  const tmp = path.join(c.mediaDir, ".asset-" + id());
  const hash = createHash("sha256");
  let bytes = 0;
  try {
    await pipeline(
      readable,
      new Transform({
        transform(chunk, encoding, cb) {
          bytes += chunk.length;
          if (bytes > 100 * 1024 ** 2)
            return cb(fail("Média limité à 100 Mo.", 413));
          hash.update(chunk);
          cb(null, chunk);
        },
      }),
      createWriteStream(tmp, { flags: "wx", mode: 0o600 }),
    );
    if (readable.truncated) throw fail("Média limité à 100 Mo.", 413);
    const meta = await mediaMetadata(tmp, kind);
    const digest = hash.digest("hex");
    const target = path.join(c.mediaDir, digest);
    try {
      await fs.link(tmp, target);
    } catch (e) {
      if (e.code !== "EEXIST")
        await fs.copyFile(tmp, target, 1).catch((error) => {
          if (error.code !== "EEXIST") throw error;
        });
    }
    const assetId = id();
    transaction(db, () => {
      db.prepare("INSERT OR IGNORE INTO blobs VALUES (?,?,?,?,?,?)").run(
        digest,
        bytes,
        meta.width,
        meta.height,
        meta.mime,
        now(),
      );
      db.prepare("INSERT INTO video_assets VALUES (?,?,?,?,?,?,?)").run(
        assetId,
        digest,
        path
          .basename(filename)
          .replace(/[\x00-\x1f]/g, "")
          .slice(0, 180),
        kind,
        meta.duration,
        userId,
        now(),
      );
    });
    return { id: assetId, kind, ...meta, size: bytes };
  } finally {
    await fs.unlink(tmp).catch(() => {});
  }
}
export function resolveFilm(db, c, input, assetURL) {
  const film = Film.parse(input);
  const clips = film.clips.map((clip) => {
    if (clip.kind === "photo") {
      const photo = db
        .prepare(
          "SELECT p.*,b.mime,a.name,a.species,a.sex,a.breed,a.birth_date,a.status,a.compatibility,a.tags,a.source_metadata,a.source_url FROM photos p JOIN animals a ON a.id=p.animal_id JOIN blobs b ON b.hash=p.hash WHERE p.id=?",
        )
        .get(clip.ref);
      if (!photo) throw fail("Une photo du montage est introuvable.");
      const sex =
        photo.sex === "female" ? "Femelle" : photo.sex === "male" ? "Mâle" : "";
      const age = photo.birth_date
        ? `${Math.max(0, Math.floor((Date.now() - Date.parse(photo.birth_date)) / 31557600000))} ans`
        : "";
      return {
        ...clip,
        id: clip.id || id(),
        animalId: photo.animal_id,
        qr: film.showQr ? qrData(animalQrAddress(photo).url) : null,
        qrLabel: animalQrAddress(photo).label,
        species: photo.species,
        title: photo.name,
        facts: [
          photo.breed ||
            { dog: "Chien", cat: "Chat", other: "NAC" }[photo.species],
          sex,
          age,
          JSON.parse(photo.source_metadata).size || "",
        ]
          .filter(Boolean)
          .join(" · "),
        src: assetURL("photo", photo.id, photo.hash, photo.mime),
        mime: photo.mime,
        ententes: compatibilityLabels(JSON.parse(photo.compatibility))
          .slice(0, 3)
          .map((v) => v.text)
          .join(" · "),
        sos: JSON.parse(photo.tags).some((tag) => /sos/i.test(tag)),
      };
    }
    const asset = db
      .prepare(
        "SELECT v.*,b.mime FROM video_assets v JOIN blobs b ON b.hash=v.hash WHERE v.id=? AND v.kind='video'",
      )
      .get(clip.ref);
    if (!asset) throw fail("Un clip vidéo est introuvable.");
    if (clip.trim + clip.seconds > asset.duration + 0.05)
      throw fail("Le point d’entrée et la durée dépassent le clip importé.");
    return {
      ...clip,
      id: clip.id || id(),
      src: assetURL("asset", asset.id, asset.hash, asset.mime),
      mime: asset.mime,
    };
  });
  let music = null;
  if (film.music) {
    const asset = db
      .prepare(
        "SELECT v.*,b.mime FROM video_assets v JOIN blobs b ON b.hash=v.hash WHERE v.id=? AND kind='audio'",
      )
      .get(film.music.assetId);
    if (!asset) throw fail("La musique est introuvable.");
    music = {
      ...film.music,
      src: assetURL("asset", asset.id, asset.hash, asset.mime),
    };
  }
  let voiceover = null;
  if (film.voiceover) {
    const asset = db
      .prepare(
        "SELECT v.*,b.mime FROM video_assets v JOIN blobs b ON b.hash=v.hash WHERE v.id=? AND kind='audio'",
      )
      .get(film.voiceover.assetId);
    if (!asset) throw fail("La voix off est introuvable.");
    if (film.voiceover.start >= filmDuration(film) / FPS)
      throw fail("La voix off commence après la fin du montage.");
    voiceover = {
      ...film.voiceover,
      duration: asset.duration,
      src: assetURL("asset", asset.id, asset.hash, asset.mime),
    };
  }
  const unique = [
    ...new Map(
      clips.filter((c) => c.animalId).map((c) => [c.animalId, c]),
    ).values(),
  ];
  const yearStats =
    film.template === "year"
      ? {
          adopted: db
            .prepare(
              "SELECT COUNT(DISTINCT animal_id) n FROM animal_status_events WHERE status='adopted' AND substr(observed_at,1,4)=?",
            )
            .get(String(film.year || new Date().getFullYear())).n,
          portraits: unique.length,
          dogs: unique.filter((c) => c.species === "dog").length,
          cats: unique.filter((c) => c.species === "cat").length,
        }
      : null;
  return {
    ...film,
    year: film.year || new Date().getFullYear(),
    clips,
    music,
    voiceover,
    yearStats,
  };
}
async function assetServer(c) {
  const token = randomBytes(24).toString("hex");
  const files = new Map();
  const server = createServer(async (req, res) => {
    try {
      const file = files.get(req.url);
      if (!file || !["GET", "HEAD"].includes(req.method)) {
        res.writeHead(404);
        res.end();
        return;
      }
      const size = (await fs.stat(file.path)).size;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", file.mime);
      res.setHeader("Accept-Ranges", "bytes");
      let start = 0,
        end = size - 1;
      const range = req.headers.range;
      if (range) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!m) throw new Error("Range");
        if (m[1]) {
          start = Number(m[1]);
          end = m[2] ? Math.min(Number(m[2]), end) : end;
        } else if (m[2]) start = Math.max(0, size - Number(m[2]));
        if (start > end || start >= size) throw new Error("Range");
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Content-Length": end - start + 1,
        });
      } else res.writeHead(200, { "Content-Length": size });
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      const stream = createReadStream(file.path, { start, end });
      stream.on("error", () => res.destroy());
      stream.pipe(res);
    } catch {
      res.writeHead(416);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  return {
    url(kind, assetId, hash, mime) {
      const key = `/${token}/${kind}/${assetId}`;
      files.set(key, {
        path: path.join(c.mediaDir, hash),
        mime: mime || "application/octet-stream",
      });
      return `http://127.0.0.1:${port}${key}`;
    },
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  };
}
export function renderFilm(db, c, input, options = {}) {
  return renderComposition(
    db,
    c,
    "AnimalFilm",
    async (assets) => ({ film: resolveFilm(db, c, input, assets) }),
    options,
  );
}
export async function renderComposition(
  db,
  c,
  compositionId,
  resolveProps,
  { onProgress = () => {}, frameRange, scale = 1, cancelSignal } = {},
) {
  assertStorage(c);
  const bundlePath = path.join(root, "video-bundle");
  if (!existsSync(path.join(bundlePath, "index.html")))
    throw fail("Compilez le studio avec npm run video:build.", 503);
  const configured = process.env.VIDEO_BROWSER_PATH;
  const browserPath =
    configured ||
    (await fs
      .readFile(path.join(root, "browser-path.txt"), "utf8")
      .catch(() => null));
  if (!browserPath || !existsSync(browserPath.trim()))
    throw fail(
      "Installez le navigateur de rendu avec npm run video:browser, puis réessayez.",
      503,
    );
  const { selectComposition, renderMedia } = await import("@remotion/renderer");
  const assets = await assetServer(c);
  const temp = path.join(c.mediaDir, ".render-" + id() + ".mp4");
  try {
    const inputProps = await resolveProps(assets.url);
    const composition = await selectComposition({
      serveUrl: bundlePath,
      id: compositionId,
      inputProps,
      browserExecutable: browserPath.trim(),
      logLevel: "warn",
    });
    await renderMedia({
      composition,
      serveUrl: bundlePath,
      inputProps,
      codec: "h264",
      outputLocation: temp,
      browserExecutable: browserPath.trim(),
      concurrency: 1,
      disallowParallelEncoding: true,
      offthreadVideoCacheSizeInBytes: 64 * 1024 ** 2,
      mediaCacheSizeInBytes: 64 * 1024 ** 2,
      videoBitrate: "4M",
      audioBitrate: "128k",
      pixelFormat: "yuv420p",
      chromiumOptions: { enableMultiProcessOnLinux: true },
      logLevel: "warn",
      onProgress,
      frameRange,
      scale,
      cancelSignal,
    });
    const hash = await fileHash(temp);
    const size = (await fs.stat(temp)).size;
    const target = path.join(c.mediaDir, hash);
    try {
      await fs.link(temp, target);
    } catch (e) {
      if (e.code !== "EEXIST")
        await fs.copyFile(temp, target, 1).catch((error) => {
          if (error.code !== "EEXIST") throw error;
        });
    }
    db.prepare("INSERT OR IGNORE INTO blobs VALUES (?,?,?,?,?,?)").run(
      hash,
      size,
      Math.round(composition.width * scale),
      Math.round(composition.height * scale),
      "video/mp4",
      now(),
    );
    return {
      hash,
      size,
      duration: frameRange
        ? (frameRange[1] - frameRange[0] + 1) / FPS
        : composition.durationInFrames / composition.fps,
      width: Math.round(composition.width * scale),
      height: Math.round(composition.height * scale),
    };
  } finally {
    await assets.close();
    await fs.unlink(temp).catch(() => {});
  }
}
export async function rangeReply(req, reply, file, mime) {
  const size = (await fs.stat(file)).size;
  const range = req.headers.range;
  reply.type(mime).header("Accept-Ranges", "bytes");
  if (!range) return reply.send(createReadStream(file));
  const m = /^bytes=(\d*)-(\d*)$/.exec(range);
  let start = 0,
    end = size - 1;
  if (!m)
    return reply.code(416).header("Content-Range", `bytes */${size}`).send();
  if (m[1]) {
    start = Number(m[1]);
    end = m[2] ? Math.min(Number(m[2]), end) : end;
  } else if (m[2]) start = Math.max(0, size - Number(m[2]));
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start > end ||
    start >= size
  )
    return reply.code(416).header("Content-Range", `bytes */${size}`).send();
  return reply
    .code(206)
    .header("Content-Range", `bytes ${start}-${end}/${size}`)
    .header("Content-Length", end - start + 1)
    .send(createReadStream(file, { start, end }));
}
export async function registerVideo(app, { db, c, authorized, job }) {
  const all = ["admin", "editor", "agent", "viewer"];
  const preview = (input) =>
    resolveFilm(db, c, input, (kind, assetId) =>
      kind === "photo"
        ? `/media/${assetId}?w=1280`
        : `/api/video/assets/${assetId}/file`,
    );
  db.prepare(
    "UPDATE video_renders SET state='failed',error='Rendu interrompu. Relancez le projet.',finished_at=? WHERE state='running'",
  ).run(now());
  app.get("/api/video/status", { preHandler: authorized(all) }, async () => ({
    enabled: process.env.VIDEO_RENDER_ENABLED !== "false",
    browser: !!(
      process.env.VIDEO_BROWSER_PATH ||
      existsSync(path.join(root, "browser-path.txt"))
    ),
    bundle: existsSync(path.join(root, "video-bundle", "index.html")),
    maxAssetMB: 100,
    maxDurationSeconds: 600,
  }));
  app.get("/api/video/assets", { preHandler: authorized(all) }, async () =>
    db
      .prepare(
        "SELECT v.*,b.size,b.width,b.height,b.mime FROM video_assets v JOIN blobs b ON b.hash=v.hash ORDER BY v.created_at DESC LIMIT 300",
      )
      .all(),
  );
  app.post(
    "/api/video/assets",
    { preHandler: authorized() },
    async (req, reply) => {
      const kind = z.enum(["video", "audio"]).parse(req.query.kind);
      const part = await req.file({
        limits: { fileSize: 100 * 1024 ** 2, files: 1, fields: 0 },
      });
      if (!part) throw fail("Fichier absent.");
      const result = await ingestAsset(
        db,
        c,
        part.file,
        part.filename,
        kind,
        req.user.id,
      );
      audit(db, req.user, "video_asset_added", { id: result.id, kind });
      return reply.code(201).send(result);
    },
  );
  app.get(
    "/api/video/assets/:id/file",
    { preHandler: authorized(all) },
    async (req, reply) => {
      const asset = db
        .prepare(
          "SELECT v.*,b.mime FROM video_assets v JOIN blobs b ON b.hash=v.hash WHERE v.id=?",
        )
        .get(UUID.parse(req.params.id));
      if (!asset) throw fail("Média introuvable.", 404);
      return rangeReply(
        req,
        reply,
        path.join(c.mediaDir, asset.hash),
        asset.mime,
      );
    },
  );
  app.get("/api/video/projects", { preHandler: authorized(all) }, async () =>
    db
      .prepare(
        "SELECT id,title,created_at,updated_at FROM video_projects WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 100",
      )
      .all(),
  );
  app.get(
    "/api/video/projects/:id",
    { preHandler: authorized(all) },
    async (req) => {
      const project = db
        .prepare(
          "SELECT * FROM video_projects WHERE id=? AND deleted_at IS NULL",
        )
        .get(UUID.parse(req.params.id));
      if (!project) throw fail("Projet introuvable.", 404);
      return { ...project, config: JSON.parse(project.config) };
    },
  );
  app.post(
    "/api/video/projects",
    { preHandler: authorized() },
    async (req, reply) => {
      const input = Film.parse(req.body);
      preview(input);
      const projectId = id();
      db.prepare(
        "INSERT INTO video_projects(id,title,config,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?)",
      ).run(
        projectId,
        input.title,
        JSON.stringify(input),
        req.user.id,
        now(),
        now(),
      );
      audit(db, req.user, "video_project_saved", { id: projectId });
      return reply.code(201).send({ id: projectId });
    },
  );
  app.put(
    "/api/video/projects/:id",
    { preHandler: authorized() },
    async (req) => {
      const input = Film.parse(req.body);
      preview(input);
      const projectId = UUID.parse(req.params.id);
      const result = db
        .prepare(
          "UPDATE video_projects SET title=?,config=?,updated_at=? WHERE id=? AND deleted_at IS NULL",
        )
        .run(input.title, JSON.stringify(input), now(), projectId);
      if (!result.changes) throw fail("Projet introuvable.", 404);
      audit(db, req.user, "video_project_saved", { id: projectId });
      return { id: projectId };
    },
  );
  app.post("/api/video/preview", { preHandler: authorized(all) }, async (req) =>
    preview(req.body),
  );
  app.get("/api/video/renders", { preHandler: authorized(all) }, async () =>
    db
      .prepare(
        "SELECT r.*,p.title,b.size,j.detail progress FROM video_renders r JOIN video_projects p ON p.id=r.project_id LEFT JOIN blobs b ON b.hash=r.hash LEFT JOIN jobs j ON j.id=r.job_id WHERE r.deleted_at IS NULL AND p.deleted_at IS NULL ORDER BY r.created_at DESC LIMIT 50",
      )
      .all(),
  );
  const cancellations = new Map();
  app.post(
    "/api/video/projects/:id/render",
    {
      preHandler: authorized(),
      config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
    },
    async (req) => {
      if (process.env.VIDEO_RENDER_ENABLED === "false")
        throw fail("Le rendu vidéo est désactivé sur ce serveur.", 503);
      const project = db
        .prepare(
          "SELECT * FROM video_projects WHERE id=? AND deleted_at IS NULL",
        )
        .get(UUID.parse(req.params.id));
      if (!project) throw fail("Projet introuvable.", 404);
      const input = Film.parse(JSON.parse(project.config));
      preview(input);
      const { makeCancelSignal } = await import("@remotion/renderer");
      const cancel = makeCancelSignal();
      const renderId = id();
      let jobId;
      const result = await job("video_render", req.user, async () => {
        const timeout = setTimeout(cancel.cancel, 30 * 60_000);
        cancellations.set(renderId, cancel.cancel);
        try {
          db.prepare(
            "INSERT INTO video_renders(id,project_id,job_id,state,created_at) VALUES (?,?,?,?,?)",
          ).run(renderId, project.id, jobId, "running", now());
          let last = 0;
          const output = await renderFilm(db, c, input, {
            cancelSignal: cancel.cancelSignal,
            onProgress: (value) => {
              if (Date.now() - last > 1000) {
                last = Date.now();
                db.prepare("UPDATE jobs SET detail=? WHERE id=?").run(
                  JSON.stringify({
                    progress: Math.round(value.progress * 100),
                    renderedFrames: value.renderedFrames,
                  }),
                  jobId,
                );
              }
            },
          });
          db.prepare(
            "UPDATE video_renders SET state='done',hash=?,finished_at=? WHERE id=?",
          ).run(output.hash, now(), renderId);
          return { ...output, renderId };
        } catch (error) {
          db.prepare(
            "UPDATE video_renders SET state='failed',error=?,finished_at=? WHERE id=?",
          ).run(error.message.slice(0, 500), now(), renderId);
          throw error;
        } finally {
          clearTimeout(timeout);
          cancellations.delete(renderId);
        }
      });
      jobId = result.id;
      return { ...result, renderId };
    },
  );
  app.post(
    "/api/video/renders/:id/cancel",
    { preHandler: authorized() },
    async (req) => {
      cancellations.get(UUID.parse(req.params.id))?.();
      return { ok: true };
    },
  );
  app.get(
    "/api/video/renders/:id/download",
    { preHandler: authorized(all) },
    async (req, reply) => {
      const render = db
        .prepare(
          "SELECT r.*,p.title FROM video_renders r JOIN video_projects p ON p.id=r.project_id WHERE r.id=? AND r.state='done' AND r.deleted_at IS NULL AND p.deleted_at IS NULL",
        )
        .get(UUID.parse(req.params.id));
      if (!render) throw fail("Vidéo terminée introuvable.", 404);
      reply.header(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(render.title + ".mp4")}`,
      );
      return rangeReply(
        req,
        reply,
        path.join(c.mediaDir, render.hash),
        "video/mp4",
      );
    },
  );
  app.addHook("preClose", async () => {
    for (const cancel of cancellations.values()) cancel();
  });
}
