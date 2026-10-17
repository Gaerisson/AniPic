import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { root } from "./config.mjs";
import { settings } from "./db.mjs";
const cache = new Map();
async function body(response, max) {
  if (!response.ok) throw Error("GitHub indisponible");
  const chunks = [];
  let size = 0;
  for await (const part of response.body) {
    size += part.length;
    if (size > max) throw Error("Réponse trop volumineuse");
    chunks.push(part);
  }
  return Buffer.concat(chunks);
}
export async function registerAuthorAvatar(app, { db }) {
  app.get("/api/author/avatar", async (req, reply) => {
    const name = "Gaerisson";
    if (!/^[a-zA-Z0-9-]{1,39}$/.test(name || "")) return reply.code(404).send();
    let entry = cache.get(name);
    if (!entry || Date.now() - entry.at > 300000) {
      try {
        const profile = JSON.parse(
          (
            await body(
              await fetch(`https://api.github.com/users/${name}`, {
                headers: {
                  "User-Agent": "AniPic/3.2",
                  Accept: "application/vnd.github+json",
                },
                redirect: "error",
                signal: AbortSignal.timeout(4000),
              }),
              65536,
            )
          ).toString(),
        );
        const url = new URL(profile.avatar_url);
        if (
          url.hostname !== "avatars.githubusercontent.com" ||
          url.protocol !== "https:" ||
          !/^\/u\/\d+$/.test(url.pathname)
        )
          throw Error("Avatar non valide");
        url.search = "?s=256&v=4";
        const data = await body(
          await fetch(url, {
            redirect: "error",
            signal: AbortSignal.timeout(4000),
          }),
          2 * 1024 ** 2,
        );
        entry = {
          at: Date.now(),
          data: await sharp(data, { limitInputPixels: 4e6 })
            .resize(256, 256, { fit: "cover" })
            .webp({ quality: 90 })
            .toBuffer(),
        };
        cache.set(name, entry);
      } catch {
        entry ||= {
          at: Date.now() - 270000,
          data: await sharp(
            await fs
              .readFile(path.join(root, "dist/gaerisson-avatar.png"))
              .catch(() =>
                fs.readFile(path.join(root, "public/gaerisson-avatar.png")),
              ),
          )
            .webp({ quality: 90 })
            .toBuffer(),
        };
        cache.set(name, entry);
      }
    }
    return reply
      .header("Cache-Control", "public,max-age=300")
      .type("image/webp")
      .send(entry.data);
  });
}
