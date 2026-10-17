import { z } from "zod";
import path from "node:path";
import { promises as fs } from "node:fs";
import { sourcePhotoBuffer } from "./source-photo.mjs";
import { assertStorage } from "./config.mjs";

export const creators = ["admin", "editor", "agent", "volunteer"];
export const photoReference = z
  .object({
    kind: z.enum(["local", "spa", "inbox"]),
    id: z.string().uuid(),
  })
  .strict();
export const creativeError = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });
export async function creativeSource(
  db,
  c,
  reference,
  { publicOnly = false } = {},
) {
  const ref = photoReference.parse(reference);
  if (ref.kind === "spa") {
    const animal = db
      .prepare("SELECT id,name FROM animals WHERE id=?")
      .get(ref.id);
    if (!animal) throw creativeError("Animal introuvable.", 404);
    return {
      buffer: await sourcePhotoBuffer(db, c, ref.id, 1280),
      name: animal.name,
      ref,
      preview: `/api/animals/${ref.id}/source-photo?w=640`,
    };
  }
  assertStorage(c);
  const row =
    ref.kind === "local"
      ? db
          .prepare(
            `SELECT p.*,a.name FROM photos p JOIN animals a ON a.id=p.animal_id WHERE p.id=? AND p.deleted_at IS NULL AND p.archived_at IS NULL ${publicOnly ? "AND p.hidden=0" : ""}`,
          )
          .get(ref.id)
      : publicOnly
        ? null
        : db
            .prepare(
              "SELECT *,filename AS name FROM inbox_photos WHERE id=? AND archived_at IS NULL",
            )
            .get(ref.id);
  if (!row) throw creativeError("Photo indisponible ou privée.", 404);
  return {
    buffer: await fs.readFile(path.join(c.mediaDir, row.hash)),
    name: row.name,
    ref,
    preview:
      ref.kind === "local"
        ? `/media/${ref.id}?w=640`
        : `/api/inbox/${ref.id}/preview`,
  };
}
export function animalReference(db, animal, source = "auto") {
  const local =
    source !== "spa" &&
    db
      .prepare(
        "SELECT id FROM photos WHERE animal_id=? AND hidden=0 AND archived_at IS NULL AND deleted_at IS NULL ORDER BY id=? DESC,created_at DESC LIMIT 1",
      )
      .get(animal.id, animal.cover_id || "");
  return { kind: local ? "local" : "spa", id: local ? local.id : animal.id };
}
