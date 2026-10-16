import { promises as fs } from "node:fs";
import path from "node:path";
import { pageAccessGuard } from "./page-access.mjs";
import { rangeReply } from "./video.mjs";
const fail = (message, code = 404) =>
  Object.assign(new Error(message), { statusCode: code });
const formats = new Set([".mp4", ".webm", ".m4v", ".mkv"]);
export async function broadcastFile(directory, value) {
  if (!directory) throw fail("Le dossier C8 n’est pas configuré.", 503);
  if (!/^[A-Za-z0-9_-]{1,1500}$/.test(value)) throw fail("Vidéo introuvable.");
  const relative = Buffer.from(value, "base64url").toString("utf8");
  if (!relative || relative.includes("\0") || path.isAbsolute(relative))
    throw fail("Vidéo introuvable.");
  const base = await fs.realpath(directory),
    candidate = path.resolve(base, relative),
    rel = path.relative(base, candidate);
  if (
    rel.startsWith("..") ||
    path.isAbsolute(rel) ||
    !formats.has(path.extname(candidate).toLowerCase())
  )
    throw fail("Vidéo introuvable.");
  const real = await fs.realpath(candidate).catch(() => null);
  if (
    !real ||
    path.relative(base, real).startsWith("..") ||
    path.isAbsolute(path.relative(base, real))
  )
    throw fail("Vidéo introuvable.");
  const stat = await fs.stat(real);
  if (!stat.isFile()) throw fail("Vidéo introuvable.");
  return { file: real, stat };
}
export async function registerBroadcasts(app, { db, c }) {
  let cached = null,
    updated = 0;
  app.get(
    "/api/broadcasts",
    { preHandler: pageAccessGuard(db, "broadcasts") },
    async () => {
      if (!c.broadcastDir)
        return { configured: false, available: false, videos: [] };
      if (cached && Date.now() - updated < 60_000) return cached;
      const videos = [];
      let budget = 0;
      try {
        const base = await fs.realpath(c.broadcastDir);
        const walk = async (dir, depth) => {
          if (depth > 4) return;
          for (const e of await fs.readdir(dir, { withFileTypes: true })) {
            if (++budget > 10_000 || videos.length >= 2000) return;
            if (e.name.startsWith(".") || e.isSymbolicLink()) continue;
            const file = path.join(dir, e.name),
              relative = path.relative(base, file);
            if (e.isDirectory()) await walk(file, depth + 1);
            else if (
              e.isFile() &&
              formats.has(path.extname(file).toLowerCase())
            ) {
              const stat = await fs.stat(file),
                ext = path.extname(file).toLowerCase();
              videos.push({
                id: Buffer.from(relative).toString("base64url"),
                title: path.parse(file).name.replace(/[_]/g, " "),
                folder:
                  path.dirname(relative) === "."
                    ? "Émissions"
                    : path.dirname(relative),
                size: stat.size,
                updatedAt: stat.mtime.toISOString(),
                format: ext.slice(1).toUpperCase(),
                playable: ext !== ".mkv",
              });
            }
          }
        };
        await walk(base, 0);
        cached = {
          configured: true,
          available: true,
          videos: videos.sort(
            (a, b) =>
              a.folder.localeCompare(b.folder, "fr") ||
              a.title.localeCompare(b.title, "fr"),
          ),
          limited: budget > 10_000 || videos.length >= 2000,
        };
        updated = Date.now();
        return cached;
      } catch {
        return {
          configured: true,
          available: false,
          videos: [],
          message:
            "Le dossier C8 est indisponible. Vérifiez son montage et les droits de lecture.",
        };
      }
    },
  );
  app.get(
    "/api/broadcasts/:id/file",
    { preHandler: pageAccessGuard(db, "broadcasts") },
    async (req, reply) => {
      const { file } = await broadcastFile(c.broadcastDir, req.params.id),
        ext = path.extname(file).toLowerCase();
      reply.header("Cache-Control", "private,no-store");
      return rangeReply(
        req,
        reply,
        file,
        ext === ".webm"
          ? "video/webm"
          : ext === ".mkv"
            ? "video/x-matroska"
            : "video/mp4",
      );
    },
  );
}
