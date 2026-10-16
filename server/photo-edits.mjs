import { z } from "zod";
import { createReadStream } from "node:fs";
import path from "node:path";
import { ingest } from "./storage.mjs";
import { audit } from "./db.mjs";

export async function registerPhotoEdits(app, { db, c, authorized }) {
  const find = (value) => {
    const photo = db
      .prepare(
        "SELECT p.id,p.hash,p.filename,b.mime FROM photos p JOIN blobs b ON b.hash=p.hash WHERE p.id=?",
      )
      .get(z.string().uuid().parse(value));
    if (!photo)
      throw Object.assign(Error("Photo introuvable."), { statusCode: 404 });
    return photo;
  };
  app.get(
    "/api/photos/:id/edit-source",
    { preHandler: authorized(["admin"]) },
    async (req, reply) => {
      const photo = find(req.params.id);
      return reply
        .type(photo.mime)
        .send(createReadStream(path.join(c.mediaDir, photo.hash)));
    },
  );
  app.post(
    "/api/photos/:id/edits",
    {
      preHandler: authorized(["admin"]),
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const photo = find(req.params.id),
        file = await req.file();
      if (!file)
        throw Object.assign(Error("Choisissez une retouche."), {
          statusCode: 400,
        });
      const result = await ingest(
        db,
        c,
        null,
        file.file,
        file.filename,
        false,
        null,
        { folder: "Retouches", userId: req.user.id },
      );
      audit(db, req.user, "photo_edited", {
        sourcePhotoId: photo.id,
        inboxId: result.id,
        duplicate: result.duplicate,
      });
      return reply.code(201).send(result);
    },
  );
}
