import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { z } from "zod";
import sharp from "sharp";
import { id, now, audit, settings } from "./db.mjs";
import { hashToken } from "./auth.mjs";
import { derivative } from "./storage.mjs";
import { sourcePhotoBuffer } from "./source-photo.mjs";
import { publicAnimalMetadata } from "./animal-facts.mjs";
import { isAnimalTrashed } from "./trash.mjs";
import { publicAlbum } from "./albums.mjs";

const roles = ["admin", "editor", "agent", "volunteer"];
const targetSchema = z
  .object({ kind: z.enum(["animal", "photo"]), targetId: z.string().uuid() })
  .strict();
const escape = (value = "") =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const missing = () =>
  Object.assign(
    new Error(
      "Cet élément ne peut pas être partagé : il est privé, supprimé ou indisponible.",
    ),
    { statusCode: 404 },
  );
const css = `:root{color-scheme:light;font-family:system-ui,sans-serif;color:#24231f;background:#f6f3ed}*{box-sizing:border-box}body{margin:0}main{max-width:1020px;margin:auto;padding:28px 20px 48px}.brand{font-size:24px;font-weight:850;margin-bottom:32px}.brand span{color:#b7521b}.app-entry{margin:0 0 28px}.open-app{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:11px 18px;border-radius:999px;background:#a94e1c;color:white;font-size:15px;font-weight:700;text-decoration:none}.open-app:hover{background:#873d15}.open-app:focus-visible{outline:3px solid #24231f;outline-offset:4px}.tag{font-size:13px;color:#6b533e;letter-spacing:.03em}h1{font-size:clamp(30px,6vw,54px);line-height:1.1;margin:12px 0 20px}h1:after{content:'.';color:#bd5d25}p{line-height:1.7;white-space:pre-line;overflow-wrap:anywhere}.facts{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0}.facts span{border:1px solid #ddd3c4;border-radius:20px;padding:8px 14px;font-size:14px}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:18px;margin:28px 0}figure{margin:0;padding:12px;background:white;border-radius:20px;box-shadow:0 8px 30px #3021120c}figure:first-child{grid-column:1/-1}img{display:block;width:100%;max-height:72vh;object-fit:contain;border-radius:12px;background:#f2eee8}figcaption{padding:12px 4px 2px;line-height:1.5;overflow-wrap:anywhere}a{color:#914317;text-underline-offset:3px}.download{display:inline-block;margin:12px 4px 4px}footer{margin-top:36px;border-top:1px solid #ddd3c4;padding-top:18px;color:#756c62;font-size:13px}.notice{background:white;border-radius:20px;padding:24px}@media(max-width:440px){main{padding:20px 16px}.brand{margin-bottom:24px}}`;

function headers(reply) {
  return reply
    .header("Cache-Control", "no-store")
    .header("Referrer-Policy", "no-referrer")
    .header("X-Robots-Tag", "noindex, nofollow, noarchive")
    .header(
      "Content-Security-Policy",
      "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
}
function page(title, body, image = "", url = "") {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><title>${escape(title)} · AniPic</title><meta property="og:title" content="${escape(title)}"><meta property="og:type" content="website">${image ? `<meta property="og:image" content="${escape(image)}">` : ""}${url ? `<meta property="og:url" content="${escape(url)}">` : ""}<style>${css}</style></head><body><main><div class="brand">AniPic<span>.</span></div>${body}</main></body></html>`;
}

async function sendPhoto(reply, data, download) {
  if (download === "1") {
    const jpeg = await sharp(data)
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 90 })
      .toBuffer();
    return reply
      .header("Content-Disposition", 'attachment; filename="portrait.jpg"')
      .type("image/jpeg")
      .send(jpeg);
  }
  return reply.type("image/webp").send(data);
}

export async function registerPublicShares(app, { db, c, authorized }) {
  db.exec(`CREATE TABLE IF NOT EXISTS public_shares(
    id TEXT PRIMARY KEY,token_hash TEXT UNIQUE NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('animal','photo')),
    target_id TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,expires_at TEXT NOT NULL,revoked_at TEXT);
    CREATE INDEX IF NOT EXISTS public_share_target ON public_shares(kind,target_id,created_at);`);
  const animal = (animalId) => {
    const row = db.prepare("SELECT * FROM animals WHERE id=?").get(animalId);
    if (!row || isAnimalTrashed(db, row.id)) throw missing();
    return row;
  };
  const photo = (photoId, animalId = null) => {
    const row = db
      .prepare(
        "SELECT p.* FROM photos p WHERE p.id=? AND p.hidden=0 AND p.deleted_at IS NULL AND p.archived_at IS NULL",
      )
      .get(photoId);
    if (row) {
      if (animalId && row.animal_id !== animalId) throw missing();
      animal(row.animal_id);
      return row;
    }
    if (animalId) throw missing();
    const albumPhoto = db
      .prepare(
        "SELECT p.*,c.name album_name FROM album_photos p JOIN collections c ON c.id=p.collection_id WHERE p.id=? AND p.deleted_at IS NULL",
      )
      .get(photoId);
    if (!albumPhoto || !publicAlbum(db, albumPhoto.collection_id))
      throw missing();
    return albumPhoto;
  };
  const target = (kind, targetId) =>
    kind === "animal" ? animal(targetId) : photo(targetId);
  const find = (token) => {
    if (!/^[\w-]{43}$/.test(token)) throw missing();
    const row = db
      .prepare(
        "SELECT s.* FROM public_shares s JOIN users u ON u.id=s.created_by WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.active=1 AND u.role IN ('admin','editor','agent','volunteer')",
      )
      .get(hashToken(token), now());
    if (!row) throw missing();
    target(row.kind, row.target_id);
    return row;
  };
  const publicPath = (token) => `/s/${token}`;
  const list = (kind, targetId, user) =>
    db
      .prepare(
        "SELECT id,created_at,expires_at FROM public_shares WHERE kind=? AND target_id=? AND revoked_at IS NULL AND expires_at>? AND (created_by=? OR ?='admin') ORDER BY created_at DESC LIMIT 100",
      )
      .all(kind, targetId, now(), user.id, user.role);
  app.get("/api/shares", { preHandler: authorized(roles) }, async (req) => {
    const v = targetSchema.parse(req.query);
    let shareable = true;
    try {
      target(v.kind, v.targetId);
    } catch {
      shareable = false;
    }
    return { items: list(v.kind, v.targetId, req.user), shareable };
  });
  app.post(
    "/api/shares",
    {
      preHandler: authorized(roles),
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (req) => {
      const v = targetSchema.parse(req.body);
      target(v.kind, v.targetId);
      const count = db
        .prepare(
          "SELECT COUNT(*) n FROM public_shares WHERE kind=? AND target_id=? AND created_by=? AND revoked_at IS NULL AND expires_at>?",
        )
        .get(v.kind, v.targetId, req.user.id, now()).n;
      if (count >= 20)
        throw Object.assign(
          new Error("Désactivez un ancien lien avant d’en créer un nouveau."),
          { statusCode: 429 },
        );
      const token = randomBytes(32).toString("base64url"),
        shareId = id(),
        createdAt = now(),
        expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
      db.prepare("INSERT INTO public_shares VALUES (?,?,?,?,?,?,?,NULL)").run(
        shareId,
        hashToken(token),
        v.kind,
        v.targetId,
        req.user.id,
        createdAt,
        expiresAt,
      );
      audit(db, req.user, "public_share_created", { shareId, ...v, expiresAt });
      return {
        id: shareId,
        url: new URL(publicPath(token), c.origin).href,
        created_at: createdAt,
        expires_at: expiresAt,
      };
    },
  );
  app.delete(
    "/api/shares/:id",
    { preHandler: authorized(roles) },
    async (req, reply) => {
      const shareId = z.string().uuid().parse(req.params.id);
      const row = db
        .prepare(
          "SELECT id FROM public_shares WHERE id=? AND (created_by=? OR ?='admin')",
        )
        .get(shareId, req.user.id, req.user.role);
      if (!row) return reply.code(404).send({ error: "Lien introuvable." });
      db.prepare("UPDATE public_shares SET revoked_at=? WHERE id=?").run(
        now(),
        shareId,
      );
      audit(db, req.user, "public_share_revoked", { shareId });
      return { ok: true };
    },
  );

  app.get("/s/:token", async (req, reply) => {
    headers(reply);
    try {
      const share = find(req.params.token),
        p = share.kind === "photo" ? photo(share.target_id) : null;
      const a = p?.collection_id
          ? { name: p.album_name }
          : animal(p?.animal_id || share.target_id),
        metadata = publicAnimalMetadata(JSON.parse(a.source_metadata || "{}"));
      const base = publicPath(req.params.token),
        refuge = settings(db).refugeName;
      const photos = p
        ? [p]
        : db
            .prepare(
              "SELECT id,caption FROM photos WHERE animal_id=? AND hidden=0 AND deleted_at IS NULL AND archived_at IS NULL ORDER BY id=? DESC,created_at DESC LIMIT 60",
            )
            .all(a.id, a.cover_id || "");
      const images = photos.map((item) => ({
        src: `${base}/photo/${item.id}`,
        caption: item.caption || `Portrait de ${a.name}`,
      }));
      if (!images.length && metadata.thumbnail)
        images.push({
          src: `${base}/source-photo`,
          caption: `Photo du site SPA · ${a.name}`,
        });
      const facts = p
        ? []
        : [
            { dog: "Chien", cat: "Chat", other: "NAC" }[a.species],
            a.breed,
            { female: "Femelle", male: "Mâle" }[a.sex],
            metadata.ageLabel,
          ];
      const gallery = images
        .map(
          (item, i) =>
            `<figure><a href="${escape(item.src)}" aria-label="Ouvrir la photo de ${escape(a.name)}"><img src="${escape(item.src)}" alt="${escape(item.caption)}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}></a><figcaption>${escape(item.caption)}</figcaption><a class="download" href="${escape(item.src)}?download=1" download="portrait.jpg">Télécharger la photo (JPG)</a></figure>`,
        )
        .join("");
      const source = (() => {
        try {
          const u = new URL(a.source_url);
          return u.protocol === "https:" &&
            ["www.la-spa.fr", "la-spa.fr"].includes(u.hostname)
            ? u.href
            : "";
        } catch {
          return "";
        }
      })();
      const until = new Date(share.expires_at).toLocaleDateString("fr-FR", {
        timeZone: "Europe/Paris",
      });
      const appLink = p?.collection_id
        ? '<p class="app-entry"><a class="open-app" href="/#collections">Ouvrir AniPic</a></p>'
        : `<p class="app-entry"><a class="open-app" href="/#animal/${encodeURIComponent(a.id)}">Ouvrir la fiche dans AniPic</a></p>`;
      const body = `${appLink}<div class="tag">${escape(refuge)} · ${p ? "Photo partagée" : "Fiche partagée"}</div><h1>${escape(a.name)}</h1>${
        p
          ? ""
          : `<div class="facts">${facts
              .filter(Boolean)
              .map((f) => `<span>${escape(f)}</span>`)
              .join("")}</div><p>${escape(a.description)}</p>`
      }<div class="gallery">${gallery || '<p class="notice">Aucune photo publique disponible pour le moment.</p>'}</div>${!p && source ? `<p><a href="${escape(source)}" target="_blank" rel="noopener noreferrer">Voir la fiche sur le site de la SPA</a></p>` : ""}<footer>Partagé par l’équipe du refuge · accessible sans compte ni code PIN jusqu’au ${escape(until)}. Ce lien peut être désactivé par l’équipe.</footer>`;
      return reply
        .type("text/html; charset=utf-8")
        .send(
          page(
            a.name,
            body,
            images[0] ? new URL(images[0].src, c.origin).href : "",
            new URL(base, c.origin).href,
          ),
        );
    } catch {
      return reply
        .code(404)
        .type("text/html; charset=utf-8")
        .send(
          page(
            "Lien indisponible",
            "<h1>Lien indisponible</h1><p>Ce lien a expiré, a été désactivé ou son contenu n’est plus disponible. Demandez un nouveau lien à l’équipe du refuge.</p>",
          ),
        );
    }
  });
  app.get("/s/:token/photo/:id", async (req, reply) => {
    headers(reply);
    try {
      const share = find(req.params.token),
        photoId = z.string().uuid().parse(req.params.id);
      if (share.kind === "photo" && share.target_id !== photoId)
        throw missing();
      const p = photo(
          photoId,
          share.kind === "animal" ? share.target_id : null,
        ),
        cfg = settings(db);
      const file = await derivative(
        c,
        p,
        1280,
        cfg.thumbQuality,
        cfg.cacheMB * 1024 ** 2,
      );
      const data = await fs.readFile(file);
      return await sendPhoto(reply, data, req.query.download);
    } catch {
      return reply.code(404).send({ error: "Photo partagée indisponible." });
    }
  });
  app.get("/s/:token/source-photo", async (req, reply) => {
    headers(reply);
    let share;
    try {
      share = find(req.params.token);
      if (share.kind !== "animal") throw missing();
    } catch {
      return reply.code(404).send({ error: "Photo partagée indisponible." });
    }
    try {
      const data = await sourcePhotoBuffer(db, c, share.target_id, 1280);
      return await sendPhoto(reply, data, req.query.download);
    } catch {
      return reply
        .code(503)
        .header("Retry-After", "2")
        .send({ error: "Photo SPA temporairement indisponible." });
    }
  });
}
