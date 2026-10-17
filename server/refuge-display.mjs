import { hasAnimalInfo } from "../shared/animal-info.mjs";
import { displayManagerRoles } from "../shared/page-access.mjs";
import { textDefaults, seasonDefaults } from "../shared/content-defaults.mjs";
import { z } from "zod";
import QRCode from "qrcode";
import path from "node:path";
import { rangeReply } from "./video.mjs";
import { settings, saveSettings, audit } from "./db.mjs";
import { publicAnimalMetadata, publicCompatibility } from "./animal-facts.mjs";
import { sourceLink } from "./communication.mjs";
import { parseShow } from "./signage-schema.mjs";
import { matchingTag } from "./animal-media.mjs";
import { showTimeline, scheduleOpen } from "../shared/signage.mjs";
import { agendaItems } from "./agenda.mjs";
import { parisDate, agendaDateLabel } from "../shared/agenda.mjs";
import { displayRevision, registerDisplayMonitor } from "./display-monitor.mjs";
const input = z.object({
  displayEnabled: z.boolean(),
  displaySeconds: z.number().int().min(5).max(60),
  displayHiddenIds: z.array(z.string().uuid()).max(2000),
  displaySpaPhotos: z.boolean(),
  displayReserved: z.boolean(),
  displayQr: z.boolean(),
  publicHistoryEnabled: z.boolean(),
});
const keys = Object.keys(input.shape),
  qrCache = new Map();
export async function buildDisplay(
  db,
  override = {},
  { force = false, assetURL, exporting = false, at = new Date() } = {},
) {
  const cfg = { ...settings(db), ...override },
    program = parseShow({ showQr: cfg.displayQr, ...cfg.displayProgram }),
    items = [];
  if (!cfg.displayEnabled && !force)
    return {
      enabled: false,
      items,
      seconds: cfg.displaySeconds,
      program,
      revision: displayRevision(db, cfg, at),
    };
  // Only events explicitly approved for the public TV leave the team agenda.
  if (program.mode !== "wallpaper") {
    const from = parisDate(at),
      until = new Date(from + "T12:00:00Z");
    until.setUTCDate(until.getUTCDate() + 90);
    const upcoming = agendaItems(db, from, until.toISOString().slice(0, 10), {
      channel: "tv",
      limit: 6,
    }).items;
    program.inserts = [
      ...program.inserts,
      ...upcoming
        .filter((e) => !program.inserts.some((b) => b.id === e.id))
        .map((e, i) => ({
          id: e.id,
          type: "message",
          afterAnimal: (i + 1) * 4,
          seconds: 10,
          title: e.title,
          body: [
            agendaDateLabel(e.date) +
              (e.endDate && e.endDate !== e.date
                ? ` au ${agendaDateLabel(e.endDate)}`
                : "") +
              (e.time ? ` · ${e.time}` : ""),
            e.location,
            e.description,
          ]
            .filter(Boolean)
            .join("\n")
            .slice(0, 350),
          theme: "auto",
          agenda: true,
        })),
    ];
  }
  const excluded = new Set(cfg.displayHiddenIds);
  const animals = db
    .prepare(
      "SELECT * FROM animals WHERE archived_at IS NULL AND status NOT IN ('adopted','source_missing') ORDER BY name COLLATE NOCASE LIMIT 2000",
    )
    .all();
  for (const a of animals) {
    if (
      excluded.has(a.id) ||
      (!cfg.displayReserved && a.status === "reserved") ||
      !program.species.includes(a.species)
    )
      continue;
    const photos = db
      .prepare(
        "SELECT p.id,p.hash,b.mime FROM photos p JOIN blobs b ON b.hash=p.hash WHERE animal_id=? AND hidden=0 AND deleted_at IS NULL AND archived_at IS NULL ORDER BY p.id=? DESC,p.created_at DESC LIMIT 100",
      )
      .all(a.id, a.cover_id || "")
      .filter((p) => matchingTag(db, "photo", p.id, program.tags))
      .slice(0, program.photosPerAnimal);
    const meta = publicAnimalMetadata(JSON.parse(a.source_metadata || "{}"));
    const media = photos.map((p) => ({
      kind: "photo",
      id: p.id,
      src: assetURL
        ? assetURL("photo", p.id, p.hash, p.mime)
        : `/media/${p.id}?w=1280`,
    }));
    if (
      !media.length &&
      cfg.displaySpaPhotos &&
      meta.thumbnail &&
      !program.tags.length
    )
      media.push({
        kind: "photo",
        source: true,
        src: `/api/animals/${a.id}/source-photo?w=1280`,
      });
    if (program.includeVideos && program.mode !== "wallpaper")
      for (const v of db
        .prepare(
          "SELECT av.id,v.id asset_id,v.hash,v.duration,b.mime FROM animal_videos av JOIN video_assets v ON v.id=av.asset_id JOIN blobs b ON b.hash=v.hash WHERE av.animal_id=? AND av.show_on_tv=1 ORDER BY av.created_at LIMIT 10",
        )
        .all(a.id)) {
        if (matchingTag(db, "video", v.asset_id, program.tags)) {
          media.push({
            kind: "video",
            id: v.id,
            duration: v.duration,
            src: assetURL
              ? assetURL("video", v.id, v.hash, v.mime)
              : force
                ? `/api/video/assets/${v.asset_id}/file`
                : `/api/public/animal-videos/${v.id}/file`,
          });
          break;
        }
      }
    if (!media.length) continue;
    const link = program.showQr ? sourceLink(a) || cfg.spaRefugeUrl : "";
    if (link && !qrCache.has(link)) {
      if (qrCache.size >= 500) qrCache.clear();
      qrCache.set(
        link,
        await QRCode.toDataURL(link, {
          width: 240,
          margin: 2,
          errorCorrectionLevel: "M",
        }),
      );
    }
    items.push({
      id: a.id,
      name: a.name,
      species: a.species,
      sex: a.sex,
      breed: hasAnimalInfo(a.breed) ? a.breed : "",
      description: a.description.slice(0, 600),
      status: a.status,
      sos: JSON.parse(a.tags || "[]").some((t) => /^sos(?:\s|$)/i.test(t)),
      age: meta.ageLabel || "",
      compatibility: publicCompatibility(
        JSON.parse(a.compatibility || "{}"),
        a.description,
      ),
      photo: media.find((m) => m.kind === "photo")?.src,
      media,
      sourcePhoto: !!media[0].source,
      sourceUrl: link,
      qr: link ? qrCache.get(link) : null,
      qrLabel: sourceLink(a) ? "Fiche SPA" : "Page du refuge",
    });
  }
  const present = db
    .prepare(
      "SELECT species,COUNT(*) n FROM animals WHERE archived_at IS NULL AND status NOT IN ('adopted','source_missing') GROUP BY species",
    )
    .all();
  const stats = {
    year: program.year,
    adoptions: db
      .prepare(
        "SELECT COUNT(DISTINCT animal_id) n FROM animal_status_events WHERE status='adopted' AND observed_at>=? AND observed_at<?",
      )
      .get(`${program.year}-01-01`, `${program.year + 1}-01-01`).n,
    dogs: 0,
    cats: 0,
    other: 0,
  };
  for (const r of present)
    stats[{ dog: "dogs", cat: "cats", other: "other" }[r.species]] = r.n;
  const eligible = program.species.flatMap((species) =>
    items.filter((a) => a.species === species),
  );
  const offset =
    program.rotationMinutes && !exporting
      ? (Math.floor(at.getTime() / (program.rotationMinutes * 60000)) *
          program.maxAnimals) %
        Math.max(1, eligible.length)
      : 0;
  const selected = [
    ...eligible.slice(offset),
    ...eligible.slice(0, offset),
  ].slice(0, program.maxAnimals);
  const show = {
    revision: displayRevision(db, cfg, at),
    calendarDate: new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(at),
    textDefaults: { ...textDefaults, ...cfg.textDefaults },
    seasonMessages: { ...seasonDefaults, ...cfg.seasonMessages },
    rotation: {
      minutes: program.rotationMinutes,
      total: eligible.length,
      nextAt: program.rotationMinutes
        ? new Date(
            (Math.floor(at.getTime() / (program.rotationMinutes * 60000)) + 1) *
              program.rotationMinutes *
              60000,
          ).toISOString()
        : null,
    },
    enabled: !!cfg.displayEnabled,
    items: selected,
    program,
    stats,
    seconds: cfg.displaySeconds,
    refugeName: cfg.refugeName,
    accent: "#eb651c",
    scheduleOpen: scheduleOpen(program),
    insertMedia: {},
  };
  for (const block of program.inserts) {
    if (block.type !== "video" || !block.assetId) continue;
    const v = db
      .prepare(
        "SELECT v.*,b.mime FROM video_assets v JOIN blobs b ON b.hash=v.hash WHERE v.id=? AND v.kind='video'",
      )
      .get(block.assetId);
    if (!v) continue;
    show.insertMedia[v.id] = {
      kind: "video",
      duration: v.duration,
      src: assetURL
        ? assetURL("video", v.id, v.hash, v.mime)
        : force
          ? `/api/video/assets/${v.id}/file`
          : `/api/public/display/videos/${v.id}`,
    };
  }
  show.duration = showTimeline(show).frames / 24;
  return show;
}
export async function registerDisplay(app, { db, c, authorized }) {
  await registerDisplayMonitor(app, { db, c, authorized });
  app.get(
    "/api/admin/display",
    { preHandler: authorized(displayManagerRoles) },
    async () => {
      const cfg = settings(db);
      return {
        ...Object.fromEntries(keys.map((k) => [k, cfg[k]])),
        displayProgram: parseShow({
          showQr: cfg.displayQr,
          ...cfg.displayProgram,
        }),
      };
    },
  );
  app.put(
    "/api/admin/display",
    { preHandler: authorized(displayManagerRoles) },
    async (req) => {
      const values = (
        req.user.role === "admin"
          ? input
          : input.omit({ publicHistoryEnabled: true })
      ).parse(req.body);
      if (req.body.displayProgram)
        values.displayProgram = parseShow(req.body.displayProgram);
      if (values.displayProgram)
        values.displayQr = values.displayProgram.showQr;
      for (const block of values.displayProgram?.inserts || [])
        if (
          block.type === "video" &&
          !db
            .prepare("SELECT id FROM video_assets WHERE id=? AND kind='video'")
            .get(block.assetId || "")
        )
          return replyMissingVideo();
      saveSettings(db, values);
      audit(db, req.user, "display_configured", values);
      return { ok: true };
    },
  );
  app.post(
    "/api/admin/display/preview",
    { preHandler: authorized(displayManagerRoles) },
    async (req) => {
      const values = input.parse(req.body);
      values.displayProgram = parseShow(req.body.displayProgram);
      return buildDisplay(db, values, { force: true });
    },
  );
  app.get("/api/public/display", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    return buildDisplay(db);
  });
  app.get("/api/public/display/videos/:id", async (req, reply) => {
    const cfg = settings(db),
      assetId = z.string().uuid().parse(req.params.id),
      program = parseShow(cfg.displayProgram || {});
    const allowed =
      cfg.displayEnabled &&
      program.mode !== "wallpaper" &&
      program.inserts.some(
        (b) =>
          b.type === "video" &&
          b.assetId === assetId &&
          !program.excludedScenes.includes(`insert:${b.id}`),
      );
    const asset =
      allowed &&
      db
        .prepare(
          "SELECT v.hash,b.mime FROM video_assets v JOIN blobs b ON b.hash=v.hash WHERE v.id=? AND v.kind='video'",
        )
        .get(assetId);
    if (!asset) return reply.code(404).send({ error: "Vidéo non diffusée." });
    return rangeReply(
      req,
      reply,
      path.join(c.mediaDir, asset.hash),
      asset.mime,
    );
  });
}
function replyMissingVideo() {
  throw Object.assign(
    new Error("Sélectionnez une vidéo du studio pour chaque séquence vidéo."),
    { statusCode: 400 },
  );
}
