import path from "node:path";
import sharp from "sharp";
import { z } from "zod";
import { id } from "./db.mjs";
import { publicSpaImage } from "./animal-facts.mjs";
import { sourcePhotoBuffer } from "./source-photo.mjs";

// Small local descriptors: no upload to an AI service, model or model download.
// Centre-weighting limits (but cannot eliminate) similarities in backgrounds.
export async function visualDescriptor(input) {
  const pixels = await sharp(input, { limitInputPixels: 40e6 })
    .rotate()
    .flatten({ background: "#fff" })
    .toColourspace("srgb")
    .resize(48, 48, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer();
  const histogram = new Array(64).fill(0),
    grid = new Array(144).fill(0);
  let weightSum = 0;
  for (let y = 0; y < 48; y++)
    for (let x = 0; x < 48; x++) {
      const i = (y * 48 + x) * 3;
      const r = pixels[i] / 255,
        g = pixels[i + 1] / 255,
        b = pixels[i + 2] / 255;
      const weight =
        0.15 + Math.exp(-((x - 23.5) ** 2 + (y - 23.5) ** 2) / 240);
      // Trilinear bins avoid jumps when JPEG compression changes a channel
      // slightly around a bin boundary.
      const channels = [r, g, b].map((v) => {
        const scaled = v * 3,
          low = Math.floor(scaled),
          fraction = scaled - low;
        return [
          [low, 1 - fraction],
          [Math.min(3, low + 1), fraction],
        ];
      });
      for (const [ri, rw] of channels[0])
        for (const [gi, gw] of channels[1])
          for (const [bi, bw] of channels[2])
            histogram[ri * 16 + gi * 4 + bi] += weight * rw * gw * bw;
      weightSum += weight;
      grid[Math.floor(y / 4) * 12 + Math.floor(x / 4)] +=
        (r * 0.299 + g * 0.587 + b * 0.114) / 16;
    }
  const mean = grid.reduce((a, b) => a + b, 0) / grid.length;
  const deviation = Math.sqrt(
    grid.reduce((n, x) => n + (x - mean) ** 2, 0) / grid.length,
  );
  return {
    histogram: histogram.map((v) => v / weightSum),
    grid: grid.map((v) => (v - mean) / Math.max(0.08, deviation)),
    deviation,
  };
}
export function visualSimilarity(a, b) {
  const color = a.histogram.reduce(
    (n, v, i) => n + Math.sqrt(v * b.histogram[i]),
    0,
  );
  const contrast = Math.exp(
    -a.grid.reduce((n, v, i) => n + Math.abs(v - b.grid[i]), 0) / a.grid.length,
  );
  return Math.min(1, color * 0.78 + contrast * 0.22);
}
const fail = (text, statusCode = 400) =>
  Object.assign(Error(text), { statusCode });
const uuid = z.string().uuid();
export async function registerAssignmentSuggestions(
  app,
  { db, c, authorized },
) {
  const jobs = new Map(),
    descriptors = new Map();
  let closing = false;
  async function descriptor(key, load) {
    const hit = descriptors.get(key);
    if (hit && hit.expires > Date.now()) return hit.promise;
    if (descriptors.size >= 1000)
      descriptors.delete(descriptors.keys().next().value);
    const promise = Promise.resolve().then(load).then(visualDescriptor);
    descriptors.set(key, { promise, expires: Date.now() + 6 * 3600_000 });
    promise.catch(() => descriptors.delete(key));
    return promise;
  }
  function view(job) {
    return {
      id: job.id,
      state: job.state,
      checked: job.checked,
      total: job.total,
      unavailable: job.unavailable,
      partial: job.partial,
      sampledPhotos: job.sampledPhotos,
      selectedPhotos: job.selectedPhotos,
      items: [...job.results.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, 6),
      error: job.error,
    };
  }
  async function analyze(job, samples, candidates) {
    try {
      const inputs = [];
      for (const p of samples) {
        try {
          inputs.push(
            await descriptor("local:" + p.hash, () =>
              path.join(c.mediaDir, p.hash),
            ),
          );
        } catch {
          job.unavailable++;
        }
      }
      if (!inputs.length)
        throw fail(
          "Les photos sélectionnées sont illisibles ou le stockage est indisponible.",
        );
      let index = 0;
      async function worker() {
        while (!closing && !job.cancelled && index < candidates.length) {
          if (Date.now() > job.deadline) {
            job.partial = true;
            break;
          }
          const a = candidates[index++];
          let best = null;
          const refs = [
            ...a.locals.map((p) => ({
              key: "local:" + p.hash,
              source: "local",
              photoId: p.id,
              load: () => path.join(c.mediaDir, p.hash),
            })),
          ];
          if (a.spa)
            refs.push({
              key: "spa:" + a.spa,
              source: "spa",
              photoId: null,
              load: () => sourcePhotoBuffer(db, c, a.id, 320),
            });
          const publish = () => {
            if (best && best.score >= 0.48)
              job.results.set(a.id, {
                id: a.id,
                name: a.name,
                species: a.species,
                source_id: a.source_id,
                cover_id: a.cover_id,
                hasSpaPhoto: !!a.spa,
                ...best,
                reason:
                  best.score >= 0.85
                    ? "Couleurs et contraste très proches"
                    : "Couleurs et contraste à comparer",
              });
          };
          for (const ref of refs) {
            if (closing || job.cancelled) break;
            if (Date.now() > job.deadline) {
              job.partial = true;
              break;
            }
            try {
              const value = await descriptor(ref.key, ref.load);
              const score =
                inputs.reduce(
                  (n, sample) => n + visualSimilarity(sample, value),
                  0,
                ) / inputs.length;
              if (!best || score > best.score)
                best = {
                  score,
                  source: ref.source,
                  referencePhotoId: ref.photoId,
                };
              publish();
            } catch {
              job.unavailable++;
            }
          }
          job.checked++;
        }
      }
      await Promise.all([worker(), worker(), worker()]);
      job.state = job.cancelled ? "cancelled" : "done";
    } catch (e) {
      job.state = "error";
      job.error = e.statusCode
        ? e.message
        : "Comparaison indisponible. Vous pouvez toujours rechercher l’animal par son nom.";
    }
    job.finishedAt = Date.now();
  }
  app.addHook("onClose", async () => {
    closing = true;
    for (const j of jobs.values()) j.cancelled = true;
    await Promise.allSettled([...jobs.values()].map((j) => j.promise));
    jobs.clear();
    descriptors.clear();
  });
  app.post(
    "/api/photos/assignment/suggestions",
    {
      preHandler: authorized(),
      config: { rateLimit: { max: 12, timeWindow: "1 minute" } },
    },
    async (req) => {
      const input = z
        .object({
          photoIds: z
            .array(uuid)
            .min(1)
            .max(200)
            .refine((v) => new Set(v).size === v.length),
          mode: z.enum(["inbox", "reassign"]).default("inbox"),
          sourceAnimalId: uuid.optional(),
          species: z.enum(["all", "dog", "cat", "other"]).default("all"),
        })
        .strict()
        .parse(req.body);
      const rows = input.photoIds.map((value) =>
        input.mode === "inbox"
          ? db
              .prepare(
                "SELECT hash FROM inbox_photos WHERE id=? AND archived_at IS NULL",
              )
              .get(value)
          : db
              .prepare(
                "SELECT hash,animal_id FROM photos WHERE id=? AND deleted_at IS NULL",
              )
              .get(value),
      );
      if (
        rows.some(
          (p) =>
            !p ||
            (input.mode === "reassign" && p.animal_id !== input.sourceAnimalId),
        )
      )
        throw fail(
          "La sélection a changé. Actualisez les photos avant de comparer.",
          409,
        );
      for (const [key, j] of jobs)
        if (j.finishedAt && Date.now() - j.finishedAt > 10 * 60000)
          jobs.delete(key);
      if (
        [...jobs.values()].some(
          (j) => j.owner === req.user.id && j.state === "running",
        )
      )
        throw fail(
          "Une comparaison est déjà en cours. Patientez quelques instants.",
          409,
        );
      if ([...jobs.values()].filter((j) => j.state === "running").length >= 2)
        throw fail(
          "Les comparaisons sont occupées. Réessayez dans un instant.",
          429,
        );
      while (jobs.size >= 50) {
        const old = [...jobs].find(([, j]) => j.state !== "running");
        if (!old) break;
        jobs.delete(old[0]);
      }
      const all = db
        .prepare(
          "SELECT id,name,species,source_id,source_metadata,cover_id FROM animals WHERE archived_at IS NULL AND departed_at IS NULL ORDER BY name,id",
        )
        .all()
        .filter(
          (a) =>
            a.id !== input.sourceAnimalId &&
            (input.species === "all" || a.species === input.species),
        );
      const localRows = db
        .prepare(
          "SELECT p.id,p.animal_id,p.hash FROM photos p JOIN animals a ON a.id=p.animal_id WHERE p.deleted_at IS NULL AND p.archived_at IS NULL AND a.archived_at IS NULL AND a.departed_at IS NULL ORDER BY p.id=a.cover_id DESC,p.created_at DESC,p.id",
        )
        .all();
      const localByAnimal = new Map();
      for (const p of localRows) {
        const list = localByAnimal.get(p.animal_id) || [];
        if (list.length < 2) list.push(p);
        localByAnimal.set(p.animal_id, list);
      }
      const candidates = all
        .map((a) => ({
          ...a,
          locals: localByAnimal.get(a.id) || [],
          spa: publicSpaImage(JSON.parse(a.source_metadata || "{}").thumbnail),
        }))
        .filter((a) => a.locals.length || a.spa)
        .sort((a, b) => Number(!!b.locals.length) - Number(!!a.locals.length));
      const samples = [
        ...new Set(
          Array.from({ length: Math.min(4, rows.length) }, (_, i) =>
            Math.floor((i * rows.length) / Math.min(4, rows.length)),
          ),
        ),
      ].map((i) => rows[i]);
      const job = {
        id: id(),
        owner: req.user.id,
        state: "running",
        checked: 0,
        total: candidates.length,
        unavailable: 0,
        partial: candidates.length > 2000,
        sampledPhotos: samples.length,
        selectedPhotos: rows.length,
        results: new Map(),
        deadline: Date.now() + 60_000,
      };
      jobs.set(job.id, job);
      job.promise = analyze(job, samples, candidates.slice(0, 2000));
      return view(job);
    },
  );
  const ownedJob = (req) => {
    const job = jobs.get(uuid.parse(req.params.id));
    if (
      !job ||
      job.owner !== req.user.id ||
      (job.finishedAt && Date.now() - job.finishedAt > 10 * 60000)
    )
      throw fail("Comparaison introuvable ou expirée.", 404);
    return job;
  };
  app.get(
    "/api/photos/assignment/suggestions/:id",
    { preHandler: authorized() },
    async (req) => view(ownedJob(req)),
  );
  app.delete(
    "/api/photos/assignment/suggestions/:id",
    { preHandler: authorized() },
    async (req) => {
      const job = ownedJob(req);
      job.cancelled = true;
      return { ok: true };
    },
  );
}
