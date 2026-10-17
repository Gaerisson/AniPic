import { promises as fs, createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import { PDFDocument } from "pdf-lib";
import yazl from "yazl";
import { id, now, audit } from "./db.mjs";

const roles = ["admin", "editor", "agent", "viewer", "volunteer"];
const UUID = z.string().uuid();
const fail = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });
export async function registerPosterExports(
  app,
  { db, c, authorized, render },
) {
  const base = path.join(c.cacheDir, "poster-exports");
  let running = false;
  const tasks = new Set();
  const read = (req) => {
    const row = db
      .prepare("SELECT * FROM jobs WHERE id=? AND kind='poster_batch'")
      .get(UUID.parse(req.params.id));
    if (!row) throw fail("Export introuvable.", 404);
    let detail;
    try {
      detail = JSON.parse(row.detail);
    } catch {
      throw fail("Export interrompu. Relancez sa génération.", 410);
    }
    if (detail.owner !== req.user.id && req.user.role !== "admin")
      throw fail("Export introuvable.", 404);
    if (detail.expiresAt < now())
      throw fail("Cet export a expiré. Relancez sa génération.", 410);
    return { row, detail };
  };
  const view = ({ row, detail }) => ({
    id: row.id,
    state: row.state,
    total: detail.total,
    done: detail.done,
    current: detail.current,
    errors: detail.errors,
    pdfs: detail.pdfs,
    expiresAt: detail.expiresAt,
    download: detail.ready ? `/api/posters/exports/${row.id}/file` : null,
  });
  app.post(
    "/api/posters/exports",
    {
      preHandler: authorized(roles),
      config: { rateLimit: { max: 6, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const v = z
        .object({
          animalIds: z.array(UUID).min(1).max(500),
          template: z
            .enum(["spa", "editorial", "glass", "contrast", "custom"])
            .default("spa"),
        })
        .strict()
        .parse(req.body);
      if (running)
        throw fail(
          "Un export de fiches est déjà en cours. Attendez sa fin.",
          429,
        );
      running = true;
      try {
        const ids = [...new Set(v.animalIds)],
          jobId = id(),
          directory = path.join(base, jobId);
        await fs.mkdir(directory, { recursive: true });
        // Only remove our own expired, UUID-named temporary export directories.
        for (const entry of await fs.readdir(base, { withFileTypes: true })) {
          if (
            entry.isDirectory() &&
            UUID.safeParse(entry.name).success &&
            entry.name !== jobId
          ) {
            const target = path.join(base, entry.name),
              stat = await fs.stat(target);
            if (Date.now() - stat.mtimeMs > 86400_000)
              await fs.rm(target, { recursive: true, force: true });
          }
        }
        const detail = {
          owner: req.user.id,
          total: ids.length,
          done: 0,
          current: "Préparation…",
          errors: [],
          pdfs: 0,
          expiresAt: new Date(Date.now() + 86400_000).toISOString(),
          ready: false,
        };
        db.prepare(
          "INSERT INTO jobs(id,kind,state,detail,created_at) VALUES (?,'poster_batch','running',?,?)",
        ).run(jobId, JSON.stringify(detail), now());
        const update = (state = "running") =>
          db
            .prepare(
              "UPDATE jobs SET state=?,detail=?,finished_at=? WHERE id=?",
            )
            .run(
              state,
              JSON.stringify(detail),
              state === "running" ? null : now(),
              jobId,
            );
        const task = new Promise((resolve) => setImmediate(resolve)).then(
          async () => {
            try {
              let doc = await PDFDocument.create(),
                pages = 0;
              const files = [];
              const flush = async () => {
                if (!pages) return;
                doc.setTitle("Affiches de box · SPA");
                doc.setCreator("AniPic · Gaerisson");
                const filename = `affiches-box-${String(files.length + 1).padStart(2, "0")}.pdf`;
                await fs.writeFile(
                  path.join(directory, filename),
                  Buffer.from(await doc.save()),
                );
                files.push(filename);
                detail.pdfs = files.length;
                doc = await PDFDocument.create();
                pages = 0;
              };
              for (const animalId of ids) {
                const animal = db
                  .prepare("SELECT name FROM animals WHERE id=?")
                  .get(animalId);
                detail.current = animal?.name || "Animal introuvable";
                update();
                try {
                  const jpeg = await (c.posterJobRenderer || render)(
                    animalId,
                    v.template,
                  );
                  const image = await doc.embedJpg(jpeg),
                    page = doc.addPage([595.2756, 841.8898]);
                  page.drawImage(image, {
                    x: 0,
                    y: 0,
                    width: 595.2756,
                    height: 841.8898,
                  });
                  pages++;
                  if (pages === 10) await flush();
                } catch {
                  detail.errors.push({
                    animalId,
                    name: detail.current,
                    error:
                      "Photo inaccessible ou génération impossible. Réessayez pour cet animal.",
                  });
                }
                detail.done++;
                update();
              }
              await flush();
              if (!files.length)
                throw fail("Aucune fiche n’a pu être générée.");
              detail.current = "Assemblage du ZIP…";
              update();
              const zip = new yazl.ZipFile();
              for (const filename of files)
                zip.addFile(path.join(directory, filename), filename);
              if (detail.errors.length)
                zip.addBuffer(
                  Buffer.from(
                    detail.errors
                      .map((e) => `${e.name} (${e.animalId}) : ${e.error}`)
                      .join("\n"),
                  ),
                  "FICHES-EN-ERREUR.txt",
                );
              const saving = pipeline(
                zip.outputStream,
                createWriteStream(path.join(directory, "affiches.zip.tmp")),
              );
              zip.end();
              await saving;
              await fs.rename(
                path.join(directory, "affiches.zip.tmp"),
                path.join(directory, "affiches.zip"),
              );
              detail.ready = true;
              detail.current = "Export prêt";
              update("done");
              audit(db, req.user, "box_posters_exported", {
                animals: ids.length - detail.errors.length,
                failed: detail.errors.length,
                pdfs: files.length,
              });
            } catch {
              detail.current =
                "Export interrompu. Réessayez ; vérifiez l’accès aux photos et le stockage.";
              update("failed");
            } finally {
              running = false;
            }
          },
        );
        tasks.add(task);
        task.then(
          () => tasks.delete(task),
          () => tasks.delete(task),
        );
        return reply
          .code(202)
          .send(view({ row: { id: jobId, state: "running" }, detail }));
      } catch (error) {
        running = false;
        throw error;
      }
    },
  );
  app.get(
    "/api/posters/exports/:id",
    { preHandler: authorized(roles) },
    async (req) => view(read(req)),
  );
  app.get(
    "/api/posters/exports/:id/file",
    { preHandler: authorized(roles) },
    async (req, reply) => {
      const { detail } = read(req);
      if (!detail.ready) throw fail("Export pas encore prêt.", 409);
      const filename = path.join(base, req.params.id, "affiches.zip");
      try {
        await fs.access(filename);
      } catch {
        throw fail("Fichier temporaire expiré. Relancez l’export.", 410);
      }
      return reply
        .type("application/zip")
        .header(
          "Content-Disposition",
          'attachment; filename="affiches-box-SPA.zip"',
        )
        .send(createReadStream(filename));
    },
  );
  app.addHook("preClose", async () => {
    await Promise.allSettled(tasks);
  });
}
