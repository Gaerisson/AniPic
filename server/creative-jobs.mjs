import { z } from "zod";
import { id } from "./db.mjs";
import { creativeError } from "./creative-sources.mjs";

// Bounded, private, short-lived previews. A restart explicitly invalidates them.
export function creativeJobs(app, authorized) {
  const jobs = new Map(),
    pending = new Set();
  let closing = false;
  const read = (req) => {
    const row = jobs.get(z.string().uuid().parse(req.params.id));
    if (!row || (row.owner !== req.user.id && req.user.role !== "admin"))
      throw creativeError(
        "Préparation introuvable. Relancez-la si le serveur a redémarré.",
        404,
      );
    if (Date.now() > row.expires) {
      jobs.delete(row.id);
      throw creativeError("Cet aperçu a expiré. Relancez sa préparation.", 410);
    }
    return row;
  };
  const view = (j) => ({
    id: j.id,
    kind: j.kind,
    state: j.state,
    done: j.done,
    total: j.total,
    stage: j.stage,
    progress: j.progress,
    error: j.error,
    result: j.state === "done" ? j.result : undefined,
    errors: j.errors,
  });
  app.get(
    "/api/creative/jobs/:id",
    {
      preHandler: authorized([
        "admin",
        "editor",
        "agent",
        "volunteer",
        "viewer",
      ]),
    },
    async (req) => view(read(req)),
  );
  const start = (user, kind, total, run) => {
    for (const [key, j] of jobs)
      if (Date.now() > j.expires && j.state !== "running") jobs.delete(key);
    if (
      closing ||
      pending.size >= 3 ||
      [...jobs.values()].some(
        (j) => j.owner === user.id && j.state === "running",
      )
    )
      throw creativeError(
        "Une préparation est déjà en cours. Attendez sa fin.",
        429,
      );
    if (jobs.size >= 8) {
      const old = [...jobs.values()].find((j) => j.state !== "running");
      if (old) jobs.delete(old.id);
      else
        throw creativeError(
          "L’atelier est occupé. Réessayez dans un instant.",
          429,
        );
    }
    const j = {
      id: id(),
      owner: user.id,
      kind,
      total,
      done: 0,
      state: "running",
      stage: "Préparation…",
      errors: [],
      expires: Date.now() + 3600_000,
    };
    jobs.set(j.id, j);
    const task = new Promise((r) => setImmediate(r)).then(async () => {
      try {
        await run(j);
        j.state = "done";
        j.stage = "Prêt";
      } catch (e) {
        j.state = "failed";
        j.error =
          e.statusCode && e.statusCode < 500
            ? e.message
            : "La préparation a échoué. Vérifiez les photos et réessayez.";
        app.log.warn(
          { creativeJob: j.id, kind, error: String(e.message).slice(0, 300) },
          "Préparation interrompue",
        );
      } finally {
        j.expires = Date.now() + 3600_000;
        // Bound preview memory independently of the model's temporary inference memory.
        let bytes = [...jobs.values()].reduce(
          (n, r) =>
            n +
            (r.binary?.length || 0) +
            (r.pages || []).reduce((s, p) => s + p.length, 0) +
            Object.values(r.assets || {}).reduce((s, b) => s + b.length, 0),
          0,
        );
        for (const [key, row] of jobs) {
          if (bytes <= 96 * 1024 ** 2) break;
          if (key === j.id || row.state === "running") continue;
          bytes -=
            (row.binary?.length || 0) +
            (row.pages || []).reduce((s, p) => s + p.length, 0) +
            Object.values(row.assets || {}).reduce((s, b) => s + b.length, 0);
          jobs.delete(key);
        }
      }
    });
    pending.add(task);
    task.finally(() => pending.delete(task));
    return view(j);
  };
  app.addHook("preClose", async () => {
    closing = true;
    await Promise.allSettled([...pending]);
    jobs.clear();
  });
  return { start, read };
}
