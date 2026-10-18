import { z } from "zod";
import { publicAnimalMetadata } from "./animal-facts.mjs";
import { adoptionOrigin } from "./source-adoption.mjs";
import {
  mergeGazetteMovements,
  gazettePortraits,
  gazetteSummary,
} from "../shared/gazette-content.mjs";
import { gazetteAgenda, monthRange } from "../shared/agenda.mjs";
import { agendaItems } from "./agenda.mjs";
import { creativeError, animalReference } from "./creative-sources.mjs";
const UUID = z.string().uuid();
export const calendarDate = z
  .string()
  .regex(/^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/)
  .refine((value) => {
    const d = new Date(value + "T12:00:00Z");
    return Number.isFinite(+d) && d.toISOString().slice(0, 10) === value;
  }, "Date inexistante.");
export const gazetteOptions = z
  .object({
    month: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),
    title: z.string().trim().min(1).max(65).default("La gazette du refuge"),
    introduction: z
      .string()
      .trim()
      .max(1200)
      .default("Des regards, des rencontres et des nouvelles à partager."),
    events: z.string().trim().max(2400).default(""),
    teamNote: z.string().trim().max(1800).default(""),
    signature: z.string().trim().max(100).default("L’équipe du refuge"),
    template: z.enum(["spa", "editorial", "glass"]).default("spa"),
    autoSummary: z.boolean().default(false),
    autoPortraits: z.boolean().default(false),
    portraitLimit: z.number().int().min(1).max(24).default(12),
    excludedAnimals: z.array(UUID).max(2000).default([]),
    includeAgenda: z.boolean().default(false),
    excludedAgenda: z.array(UUID).max(500).default([]),
    animals: z
      .array(
        z
          .object({ id: UUID, source: z.enum(["auto", "spa"]).default("auto") })
          .strict(),
      )
      .max(24)
      .default([]),
    includeArrivals: z.boolean().default(true),
    includeAdoptions: z.boolean().default(true),
    movements: z
      .array(
        z
          .object({
            animalId: UUID,
            kind: z.enum(["arrival", "adoption"]),
            date: calendarDate,
            source: z.enum(["auto", "spa"]).default("auto"),
            note: z.string().trim().max(350).default(""),
          })
          .strict(),
      )
      .max(300)
      .default([]),
    excludedMovements: z
      .array(z.string().regex(/^(arrival|adoption):[a-f0-9-]{36}$/i))
      .max(600)
      .default([]),
    keyDates: z
      .array(
        z
          .object({
            id: UUID,
            date: calendarDate,
            time: z
              .union([
                z.literal(""),
                z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
              ])
              .default(""),
            title: z.string().trim().min(1).max(100),
            category: z
              .enum(["open_day", "collection", "event", "appointment", "other"])
              .default("event"),
            location: z.string().trim().max(120).default(""),
            description: z.string().trim().max(500).default(""),
          })
          .strict(),
      )
      .max(40)
      .default([]),
  })
  .strict()
  .superRefine((o, ctx) => {
    o.movements.forEach((m, i) => {
      if (!m.date.startsWith(o.month + "-"))
        ctx.addIssue({
          code: "custom",
          path: ["movements", i, "date"],
          message: "Choisissez une date dans le mois de cette gazette.",
        });
    });
  });
export function gazetteAnimalBrief(db, a) {
  const ref = animalReference(db, a);
  return {
    id: a.id,
    animalId: a.id,
    name: a.name,
    species: a.species,
    archived: !!a.archived_at,
    status: a.status,
    updatedAt: a.updated_at || "",
    cover_id: ref.kind === "local" ? ref.id : null,
    preview:
      ref.kind === "local"
        ? `/media/${ref.id}?w=320`
        : publicAnimalMetadata(JSON.parse(a.source_metadata || "{}")).thumbnail
          ? `/api/animals/${a.id}/source-photo?w=320`
          : "",
  };
}
export function gazetteMonth(db, month) {
  const from = `${month}-01T00:00:00.000Z`,
    end = new Date(from);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const to = end.toISOString();
  const animals = db
    .prepare(
      "SELECT id,name,species,status,archived_at,source_metadata,cover_id,created_at,updated_at FROM animals ORDER BY name",
    )
    .all();
  const brief = (a) => gazetteAnimalBrief(db, a);
  const added = [],
    arrivals = [];
  for (const a of animals) {
    const arrivalDate = publicAnimalMetadata(
      JSON.parse(a.source_metadata || "{}"),
    ).arrivalDate;
    if (a.created_at >= from && a.created_at < to)
      added.push({
        ...brief(a),
        recordedDate: a.created_at.slice(0, 10),
        arrivalDate: arrivalDate || "",
      });
    if (arrivalDate?.startsWith(month + "-"))
      arrivals.push({
        ...brief(a),
        kind: "arrival",
        date: arrivalDate,
        origin: "spa",
      });
  }
  const adopted = db
    .prepare(
      "SELECT a.id,a.name,a.species,a.status,a.archived_at,a.source_metadata,a.cover_id,MIN(e.observed_at) AS adoption_date FROM animal_status_events e JOIN animals a ON a.id=e.animal_id WHERE e.status='adopted' AND e.observed_at>=? AND e.observed_at<? AND NOT EXISTS (SELECT 1 FROM animal_status_events older WHERE older.animal_id=e.animal_id AND older.status='adopted' AND (older.observed_at IS NULL OR older.observed_at<e.observed_at)) GROUP BY a.id ORDER BY adoption_date,a.name",
    )
    .all(from, to)
    .map((a) => ({
      ...brief(a),
      kind: "adoption",
      adoption_origin: adoptionOrigin(db, a.id),
      date: a.adoption_date.slice(0, 10),
      origin: "history",
    }));
  const current = animals.filter(
    (a) => !a.archived_at && ["available", "reserved"].includes(a.status),
  );
  const range = monthRange(month, 2);
  return {
    added,
    arrivals,
    adopted,
    present: current.length,
    month,
    candidates: current
      .sort(
        (a, b) =>
          b.created_at.localeCompare(a.created_at) ||
          a.name.localeCompare(b.name),
      )
      .map(brief),
    agenda: agendaItems(db, range.from, range.to, { channel: "gazette" }).items,
  };
}
export function resolveGazetteContent(db, input) {
  const options = gazetteOptions.parse(input),
    snapshot = gazetteMonth(db, options.month);
  const movements = mergeGazetteMovements(options, snapshot).map((m) => {
    const a = db
      .prepare("SELECT id,name,species FROM animals WHERE id=?")
      .get(m.animalId);
    if (!a)
      throw creativeError(
        "Un animal des arrivées ou adoptions n’existe plus. Retirez cette ligne de l’édition.",
        422,
      );
    return { ...m, name: a.name, species: a.species };
  });
  if (movements.length > 300)
    throw creativeError(
      "Cette édition dépasse 300 mouvements. Masquez une partie des lignes avant la génération.",
      422,
    );
  const keyDates = gazetteAgenda(options, snapshot.agenda);
  if (keyDates.length > 40)
    throw creativeError(
      "Plus de 40 dates clés. Masquez certains événements de l’agenda pour cette édition.",
      422,
    );
  return {
    options,
    snapshot,
    movements,
    arrivals: movements.filter((m) => m.kind === "arrival"),
    adopted: movements.filter((m) => m.kind === "adoption"),
    portraits: gazettePortraits(options, snapshot, movements),
    keyDates,
    summary: options.autoSummary
      ? gazetteSummary(options, snapshot, movements, keyDates)
      : options.introduction,
  };
}
