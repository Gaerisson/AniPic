import sharp from "sharp";
import { createHash } from "node:crypto";
import { audit, saveSettings } from "./db.mjs";

const key = "assistantAvatarImage";
const fail = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });
const read = (db) => {
  const row = db.prepare("SELECT value FROM settings WHERE key=?").get(key);
  return row ? JSON.parse(row.value) : null;
};
export function assistantAvatarUrl(db) {
  const image = read(db);
  return image ? `/api/assistant/avatar?v=${image.hash}` : null;
}
export function adminSettingsView(values) {
  const { [key]: image, accessPinHash, ...rest } = values;
  return rest;
}

export async function registerAssistantAvatar(app, { db, authorized }) {
  app.get("/api/assistant/avatar", async (req, reply) => {
    const image = read(db);
    if (!image) throw fail("Aucun avatar personnalisé.", 404);
    return reply.type("image/webp").send(Buffer.from(image.data, "base64"));
  });
  app.post(
    "/api/admin/assistant/avatar",
    {
      preHandler: authorized(["admin"]),
      config: { rateLimit: { max: 12, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      let input;
      for await (const part of req.parts({
        limits: { fileSize: 5 * 1024 ** 2, files: 1, fields: 0, parts: 1 },
      })) {
        input = await part.toBuffer();
      }
      if (!input?.length) throw fail("Choisissez une image.");
      let output;
      try {
        const image = sharp(input, { limitInputPixels: 20_000_000 }),
          metadata = await image.metadata();
        if (
          !["jpeg", "png", "webp", "avif", "heif"].includes(metadata.format) ||
          (metadata.pages || 1) > 1
        )
          throw Error("Unsupported image");
        output = await image
          .rotate()
          .resize(512, 512, { fit: "cover", position: "centre" })
          .webp({ quality: 85 })
          .toBuffer();
      } catch {
        throw fail(
          "Image invalide : utilisez un fichier JPG, PNG, WebP ou AVIF fixe de 20 mégapixels maximum.",
        );
      }
      // A single bounded image lives in SQLite, so replacement leaves no orphan
      // files and the existing consistent database backup includes the avatar.
      saveSettings(db, {
        [key]: {
          hash: createHash("sha256").update(output).digest("hex"),
          data: output.toString("base64"),
        },
      });
      audit(db, req.user, "assistant_avatar_updated");
      return reply.code(201).send({ url: assistantAvatarUrl(db) });
    },
  );
  app.delete(
    "/api/admin/assistant/avatar",
    { preHandler: authorized(["admin"]) },
    async (req) => {
      db.prepare("DELETE FROM settings WHERE key=?").run(key);
      audit(db, req.user, "assistant_avatar_reset");
      return { url: null };
    },
  );
}
