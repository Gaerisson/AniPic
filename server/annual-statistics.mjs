import { z } from "zod";
import { settings, audit, now } from "./db.mjs";
export function annualAdoptions(db, year) {
  const observed = db
    .prepare(
      "SELECT COUNT(DISTINCT animal_id) n FROM animal_status_events WHERE status='adopted' AND observed_at>=? AND observed_at<?",
    )
    .get(`${year}-01-01`, `${year + 1}-01-01`).n;
  const saved = settings(db)[`annualAdoptions:${year}`];
  const mode = saved?.mode || "auto",
    value = Number.isInteger(saved?.value) ? saved.value : 0;
  return {
    year,
    observed,
    mode,
    value,
    count:
      mode === "total"
        ? value
        : mode === "complement"
          ? observed + value
          : observed,
    updatedAt: saved?.updatedAt || null,
  };
}
export async function registerAnnualStatistics(app, { db, authorized }) {
  const year = (req) =>
    z.coerce.number().int().min(2000).max(2100).parse(req.params.year);
  app.get(
    "/api/annual-statistics/:year",
    { preHandler: authorized() },
    async (req) => annualAdoptions(db, year(req)),
  );
  app.put(
    "/api/annual-statistics/:year",
    { preHandler: authorized(["admin", "agent"]) },
    async (req) => {
      const y = year(req),
        v = z
          .object({
            mode: z.enum(["auto", "total", "complement"]),
            value: z.number().int().min(0).max(1000000),
          })
          .strict()
          .parse(req.body);
      const before = annualAdoptions(db, y);
      db.prepare(
        "INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      ).run(`annualAdoptions:${y}`, JSON.stringify({ ...v, updatedAt: now() }));
      audit(db, req.user, "annual_statistics_updated", {
        year: y,
        before,
        after: v,
      });
      return annualAdoptions(db, y);
    },
  );
}
