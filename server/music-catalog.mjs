import { z } from "zod";
import { Readable } from "node:stream";
import { boundedFetch } from "./source.mjs";
import { ingestAsset } from "./video.mjs";
import { audit } from "./db.mjs";
const clean = (v) =>
  String(v || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
const licenseURL = (license) => {
  const cc = /^CC (BY(?:-SA)?) ([1-4]\.0)$/i.exec(license);
  return cc
    ? `https://creativecommons.org/licenses/${cc[1].toLowerCase()}/${cc[2]}/`
    : /CC0/i.test(license)
      ? "https://creativecommons.org/publicdomain/zero/1.0/"
      : "https://creativecommons.org/publicdomain/mark/1.0/";
};
export function parseMusicPages(pages = {}) {
  if (!pages || typeof pages !== "object") return [];
  return Object.values(pages).flatMap((page) => {
    const info = page?.imageinfo?.[0],
      meta = info?.extmetadata || {},
      license = clean(meta.LicenseShortName?.value),
      author = clean(meta.Artist?.value),
      url = info?.url || "";
    if (
      !info ||
      !Number.isSafeInteger(page.pageid) ||
      page.pageid <= 0 ||
      typeof page.title !== "string" ||
      !["audio/mpeg", "audio/wav", "audio/x-wav"].includes(info.mime) ||
      !/^https:\/\/upload\.wikimedia\.org\//.test(url) ||
      !/^(CC0|Public domain|CC BY(?:-SA)? [1-4]\.0)$/i.test(license) ||
      !Number.isSafeInteger(info.size) ||
      info.size <= 0 ||
      info.size > 25 * 1024 ** 2
    )
      return [];
    return [
      {
        id: page.pageid,
        title: clean(page.title.replace(/^File:/, "")),
        author,
        license,
        url,
        source: `https://commons.wikimedia.org/?curid=${page.pageid}`,
        size: info.size,
      },
    ];
  });
}
export async function registerMusic(app, { db, c, authorized }) {
  const cache = new Map(),
    fetcher =
      c.musicFetcher ||
      ((url, limit, options) =>
        boundedFetch(url, limit, {
          ...options,
          allowedHosts: ["commons.wikimedia.org", "upload.wikimedia.org"],
          userAgent:
            "Anipic/2.8 (+https://github.com/Gaerisson/; refuge photo studio)",
        }));
  app.get(
    "/api/video/music/search",
    {
      preHandler: authorized(["admin", "editor", "agent", "viewer"]),
      config: { rateLimit: { max: 12, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const q = z.string().trim().min(1).max(80).parse(req.query.q),
        url = new URL("https://commons.wikimedia.org/w/api.php");
      url.search = new URLSearchParams({
        action: "query",
        format: "json",
        generator: "search",
        gsrnamespace: "6",
        gsrlimit: "18",
        gsrsearch: `filetype:audio filemime:audio/mpeg ${q.replace(/["|{}<>]/g, "")}`,
        prop: "imageinfo",
        iiprop: "url|mime|size|extmetadata",
        iiextmetadatafilter: "Artist|LicenseShortName",
      }).toString();
      let data;
      try {
        const raw = await fetcher(url.href, 2 * 1024 ** 2, {
          timeoutMs: 10000,
        });
        data = JSON.parse(raw);
        if (data.error) throw new Error("catalogue indisponible");
      } catch {
        return reply.code(502).send({
          error:
            "Le catalogue musical ne répond pas. Réessayez ou utilisez les liens des bibliothèques ci-dessous.",
        });
      }
      const tracks = parseMusicPages(data.query?.pages);
      for (const track of tracks)
        cache.set(track.id, { ...track, expires: Date.now() + 600000 });
      for (const [id, t] of cache)
        if (t.expires < Date.now() || cache.size > 300) cache.delete(id);
      return { tracks, provider: "Wikimedia Commons" };
    },
  );
  app.post(
    "/api/video/music/import",
    {
      preHandler: authorized(),
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const key = z.number().int().positive().parse(req.body.pageId),
        track = cache.get(key);
      if (!track || track.expires < Date.now())
        return reply
          .code(409)
          .send({ error: "Relancez la recherche pour importer ce morceau." });
      const raw = await fetcher(track.url, 25 * 1024 ** 2, {
          timeoutMs: 30000,
          binary: true,
        }),
        result = await ingestAsset(
          db,
          c,
          Readable.from(raw),
          track.title,
          "audio",
          req.user.id,
        );
      db.prepare("INSERT OR REPLACE INTO music_credits VALUES (?,?,?,?,?)").run(
        result.id,
        track.title,
        track.author,
        track.license,
        track.source,
      );
      audit(db, req.user, "music_imported", {
        assetId: result.id,
        license: track.license,
        source: track.source,
      });
      return reply.code(201).send({ ...result, credit: track });
    },
  );
  app.get(
    "/api/video/projects/:id/credits",
    { preHandler: authorized(["admin", "editor", "agent", "viewer"]) },
    async (req, reply) => {
      const project = db
        .prepare(
          "SELECT config FROM video_projects WHERE id=? AND deleted_at IS NULL",
        )
        .get(z.string().uuid().parse(req.params.id));
      if (!project)
        return reply.code(404).send({ error: "Projet introuvable." });
      const cfg = JSON.parse(project.config),
        credit =
          cfg.music &&
          db
            .prepare("SELECT * FROM music_credits WHERE asset_id=?")
            .get(cfg.music.assetId);
      return reply
        .header(
          "Content-Disposition",
          'attachment; filename="credits-musique.txt"',
        )
        .type("text/plain; charset=utf-8")
        .send(
          credit
            ? `${credit.title}\n${credit.author}\nLicence : ${credit.license}\n${licenseURL(credit.license)}\nSource : ${credit.source}\nAdaptation : intégration à un montage vidéo (coupe, boucle et fondus).\n`
            : "Aucune musique issue du catalogue dans ce projet.",
        );
    },
  );
}
