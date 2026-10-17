import sharp from "sharp";
import { createHash } from "node:crypto";
import { z } from "zod";
import { audit } from "./db.mjs";
export async function registerUserAvatars(app, { db, authorized }) {
  const all = ["admin", "editor", "agent", "volunteer", "viewer"];
  function target(req) {
    const uid = z.string().uuid().parse(req.params.id);
    if (uid !== req.user.id && req.user.role !== "admin")
      throw Object.assign(
        new Error("Vous pouvez modifier votre propre avatar."),
        { statusCode: 403 },
      );
    if (!db.prepare("SELECT id FROM users WHERE id=?").get(uid))
      throw Object.assign(new Error("Compte introuvable."), {
        statusCode: 404,
      });
    return uid;
  }
  app.get(
    "/api/users/:id/avatar",
    { preHandler: authorized(all) },
    async (req, reply) => {
      const row = db
        .prepare("SELECT hash,image FROM user_avatars WHERE user_id=?")
        .get(z.string().uuid().parse(req.params.id));
      if (!row) return reply.code(404).send({ error: "Avatar non défini." });
      return reply
        .header("Cache-Control", "private,no-cache")
        .header("ETag", `"${row.hash}"`)
        .type("image/webp")
        .send(Buffer.from(row.image));
    },
  );
  app.post(
    "/api/users/:id/avatar",
    { preHandler: authorized(all) },
    async (req) => {
      const uid = target(req),
        part = await req.file({
          limits: { files: 1, fields: 0, fileSize: 5 * 1024 ** 2 },
        });
      if (!part)
        throw Object.assign(new Error("Choisissez une image."), {
          statusCode: 400,
        });
      const input = await part.toBuffer();
      if (part.file.truncated)
        throw Object.assign(new Error("Avatar limité à 5 Mo."), {
          statusCode: 413,
        });
      let image;
      try {
        const meta = await sharp(input, {
          limitInputPixels: 20_000_000,
        }).metadata();
        if (
          !["jpeg", "png", "webp", "avif"].includes(meta.format) ||
          (meta.pages || 1) > 1
        )
          throw Error();
        image = await sharp(input, { limitInputPixels: 20_000_000 })
          .rotate()
          .resize(256, 256, { fit: "cover" })
          .webp({ quality: 88 })
          .toBuffer();
      } catch {
        throw Object.assign(
          new Error("Choisissez une image JPEG, PNG, WebP ou AVIF statique."),
          { statusCode: 400 },
        );
      }
      const hash = createHash("sha256").update(image).digest("hex");
      db.prepare("INSERT OR REPLACE INTO user_avatars VALUES (?,?,?)").run(
        uid,
        hash,
        image,
      );
      audit(db, req.user, "user_avatar_updated", { userId: uid });
      return { hash };
    },
  );
  app.delete(
    "/api/users/:id/avatar",
    { preHandler: authorized(all) },
    async (req) => {
      const uid = target(req);
      db.prepare("DELETE FROM user_avatars WHERE user_id=?").run(uid);
      audit(db, req.user, "user_avatar_reset", { userId: uid });
      return { ok: true };
    },
  );
}
