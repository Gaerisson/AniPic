import { z } from "zod";
import sharp from "sharp";
import { timingSafeEqual } from "node:crypto";
import { id, now, audit, transaction } from "./db.mjs";
import { hashToken } from "./auth.mjs";
const schema = z
  .object({
    orientation: z
      .enum(["inherit", "landscape", "portrait"])
      .default("inherit"),
    photoSeconds: z.number().int().min(0).max(30).default(0),
    stats: z.enum(["inherit", "on", "off"]).default("inherit"),
    showQr: z.enum(["inherit", "on", "off"]).default("inherit"),
    species: z
      .array(z.enum(["dog", "cat", "other"]))
      .min(1)
      .max(3)
      .default(["dog", "cat", "other"]),
    refreshSeconds: z.number().int().min(15).max(300).default(60),
    autoReconnect: z.boolean().default(true),
    captureEnabled: z.boolean().default(true),
  })
  .strict();
export const displayConfig = (db, key) =>
  schema.parse(
    JSON.parse(
      db.prepare("SELECT config FROM display_config WHERE screen_id=?").get(key)
        ?.config || "{}",
    ),
  );
export function pendingDisplayCommands(db, key) {
  return db
    .prepare(
      "SELECT id,kind FROM display_commands WHERE screen_id=? AND ack_at IS NULL AND created_at>? ORDER BY created_at LIMIT 2",
    )
    .all(key, new Date(Date.now() - 120000).toISOString());
}
function screen(db, key, token) {
  const row = db
    .prepare("SELECT token_hash,revoked_at FROM display_screens WHERE id=?")
    .get(key);
  return (
    row &&
    !row.revoked_at &&
    timingSafeEqual(
      Buffer.from(row.token_hash, "hex"),
      Buffer.from(hashToken(token), "hex"),
    )
  );
}
export async function registerDisplayControls(app, { db, c, authorized }) {
  const access = { preHandler: authorized(["admin", "agent"]) };
  const validKey = (req) => {
    const key = z.string().uuid().parse(req.params.id);
    if (
      !db
        .prepare(
          "SELECT 1 FROM display_screens WHERE id=? AND revoked_at IS NULL",
        )
        .get(key)
    )
      throw Object.assign(Error("Écran introuvable."), { statusCode: 404 });
    return key;
  };
  app.get("/api/admin/display/screens/:id/config", access, async (req) => ({
    config: displayConfig(db, validKey(req)),
  }));
  app.put("/api/admin/display/screens/:id/config", access, async (req) => {
    const key = validKey(req),
      v = schema.parse(req.body);
    db.prepare(
      "INSERT INTO display_config VALUES (?,?) ON CONFLICT(screen_id) DO UPDATE SET config=excluded.config",
    ).run(key, JSON.stringify(v));
    audit(db, req.user, "display_screen_configured", { id: key, config: v });
    return { ok: true };
  });
  app.post(
    "/api/admin/display/screens/:id/command",
    { ...access, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req) => {
      const key = validKey(req),
        v = z
          .object({ kind: z.enum(["snapshot", "refresh"]) })
          .strict()
          .parse(req.body);
      if (v.kind === "snapshot" && !displayConfig(db, key).captureEnabled)
        throw Object.assign(
          Error("Les captures sont désactivées pour cet écran."),
          { statusCode: 409 },
        );
      const command = id();
      db.prepare(
        "DELETE FROM display_commands WHERE screen_id=? AND (ack_at IS NOT NULL OR created_at<? OR kind=?)",
      ).run(key, new Date(Date.now() - 120000).toISOString(), v.kind);
      db.prepare("INSERT INTO display_commands VALUES (?,?,?,?,NULL)").run(
        command,
        key,
        v.kind,
        now(),
      );
      return { ok: true, id: command };
    },
  );
  app.get(
    "/api/admin/display/screens/:id/snapshot",
    access,
    async (req, reply) => {
      const row = db
        .prepare(
          "SELECT image,created_at FROM display_snapshots WHERE screen_id=?",
        )
        .get(validKey(req));
      if (!row)
        return reply
          .code(404)
          .send({
            error:
              "Aucune capture reçue. Demandez une capture de l’écran connecté.",
          });
      return reply
        .header("Cache-Control", "no-store")
        .header("X-Captured-At", row.created_at)
        .type("image/jpeg")
        .send(Buffer.from(row.image));
    },
  );
  app.post(
    "/api/public/display/command-result",
    {
      bodyLimit: 750000,
      config: { rateLimit: { max: 6, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      if (req.headers.origin && req.headers.origin !== c.origin)
        return reply.code(403).send({ error: "Origine refusée." });
      const v = z
        .object({
          id: z.string().uuid(),
          token: z.string().regex(/^[\w-]{43}$/),
          command: z.string().uuid(),
          image: z.string().max(700000).optional(),
        })
        .strict()
        .parse(req.body);
      if (!screen(db, v.id, v.token))
        return reply.code(403).send({ error: "Identité d’écran invalide." });
      const cmd = db
        .prepare(
          "SELECT * FROM display_commands WHERE id=? AND screen_id=? AND ack_at IS NULL AND created_at>?",
        )
        .get(v.command, v.id, new Date(Date.now() - 120000).toISOString());
      if (!cmd)
        return reply
          .code(409)
          .send({ error: "Commande expirée ou déjà traitée." });
      let image;
      if (v.image) {
        if (
          cmd.kind !== "snapshot" ||
          !displayConfig(db, v.id).captureEnabled ||
          !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v.image)
        )
          return reply.code(400).send({ error: "Capture refusée." });
        const raw = Buffer.from(v.image.split(",")[1], "base64");
        const m = await sharp(raw, { limitInputPixels: 4000000 }).metadata();
        if (m.format !== "jpeg")
          return reply.code(400).send({ error: "Format refusé." });
        image = await sharp(raw, { limitInputPixels: 4000000 })
          .resize({
            width: 1280,
            height: 1280,
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 75 })
          .toBuffer();
      }
      transaction(db, () => {
        if (image)
          db.prepare(
            "INSERT INTO display_snapshots VALUES (?,?,?) ON CONFLICT(screen_id) DO UPDATE SET image=excluded.image,created_at=excluded.created_at",
          ).run(v.id, image, now());
        db.prepare("UPDATE display_commands SET ack_at=? WHERE id=?").run(
          now(),
          v.command,
        );
      });
      return { ok: true };
    },
  );
  db.prepare("DELETE FROM display_snapshots WHERE created_at<?").run(
    new Date(Date.now() - 86400000).toISOString(),
  );
}
