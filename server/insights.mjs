import { audioConfig } from "./audio-settings.mjs";
import { z } from "zod";
import { settings } from "./db.mjs";
import { pageAccessGuard } from "./page-access.mjs";
export async function registerInsights(app, { db, c, authorized }) {
  app.get(
    "/api/stats",
    { preHandler: pageAccessGuard(db, "stats") },
    async (req) => {
      const year = z.coerce
        .number()
        .int()
        .min(1980)
        .max(2100)
        .default(new Date().getFullYear())
        .parse(req.query.year);
      const current = db
        .prepare(
          `SELECT COUNT(*) total,SUM(archived_at IS NULL AND status!='adopted') present,SUM(status='adopted') adopted,SUM(status='reserved' AND archived_at IS NULL) reserved,SUM(archived_at IS NOT NULL) archived,SUM(status='source_missing') unconfirmed FROM animals`,
        )
        .get();
      const species = db
        .prepare(
          `SELECT species,COUNT(*) total,SUM(archived_at IS NULL AND status!='adopted') present,SUM(status='adopted') adopted FROM animals GROUP BY species`,
        )
        .all();
      const added = db
        .prepare(
          "SELECT substr(created_at,6,2) month,COUNT(*) n FROM animals WHERE substr(created_at,1,4)=? GROUP BY month",
        )
        .all(String(year));
      const adopted = db
        .prepare(
          "SELECT substr(observed_at,6,2) month,COUNT(DISTINCT animal_id) n FROM animal_status_events WHERE status='adopted' AND substr(observed_at,1,4)=? GROUP BY month",
        )
        .all(String(year));
      const archived = db
        .prepare(
          "SELECT substr(archived_at,6,2) month,COUNT(*) n FROM animals WHERE substr(archived_at,1,4)=? GROUP BY month",
        )
        .all(String(year));
      const monthly = Array.from({ length: 12 }, (_, i) => {
        const m = String(i + 1).padStart(2, "0");
        return {
          month: i + 1,
          added: added.find((x) => x.month === m)?.n || 0,
          adopted: adopted.find((x) => x.month === m)?.n || 0,
          archived: archived.find((x) => x.month === m)?.n || 0,
        };
      });
      const years = db
        .prepare(
          `SELECT DISTINCT y FROM (SELECT substr(created_at,1,4) y FROM animals UNION SELECT substr(archived_at,1,4) FROM animals UNION SELECT substr(observed_at,1,4) FROM animal_status_events) WHERE y IS NOT NULL ORDER BY y DESC`,
        )
        .all()
        .map((x) => Number(x.y));
      const noPhoto = db
        .prepare(
          `SELECT COUNT(*) n FROM animals a WHERE archived_at IS NULL AND status!='adopted' AND NOT EXISTS(SELECT 1 FROM photos p WHERE p.animal_id=a.id AND p.archived_at IS NULL)`,
        )
        .get().n;
      const coverage = db
        .prepare(
          `SELECT COUNT(*) n FROM animals a WHERE archived_at IS NULL AND status!='adopted' AND EXISTS(SELECT 1 FROM photos p WHERE p.animal_id=a.id AND p.archived_at IS NULL)`,
        )
        .get().n;
      return {
        year,
        years,
        current,
        species,
        monthly,
        annual: {
          added: monthly.reduce((s, x) => s + x.added, 0),
          adopted: db
            .prepare(
              "SELECT COUNT(DISTINCT animal_id) n FROM animal_status_events WHERE status='adopted' AND substr(observed_at,1,4)=?",
            )
            .get(String(year)).n,
          archived: monthly.reduce((s, x) => s + x.archived, 0),
        },
        noPhoto,
        coverage,
        unknownAdoptionDates: db
          .prepare(
            "SELECT COUNT(*) n FROM animal_status_events WHERE status='adopted' AND observed_at IS NULL",
          )
          .get().n,
        adoptionDateBasis:
          "Date de première observation du statut adopté dans la source SPA. Un archivage ou une absence du site ne vaut pas adoption.",
      };
    },
  );
  app.get(
    "/api/admin/connections",
    { preHandler: authorized(["admin"]) },
    async () => {
      const cfg = settings(db);
      return {
        source: { mode: cfg.sourceMode, url: cfg.sourceUrl },
        gemini: {
          configured: !!process.env.GEMINI_API_KEY,
          model:
            cfg.geminiModel ||
            process.env.GEMINI_MODEL ||
            "gemini-3.5-flash-lite",
        },
        tokenharbor: {
          configured: !!process.env.TOKENHARBOR_API_KEY,
          model: cfg.tokenharborModel || process.env.TOKENHARBOR_MODEL || "",
          baseUrl: "https://tokenharbor.ai/v1",
        },
        broadcasts: { configured: !!c.broadcastDir },
        mistral: {
          configured: !!audioConfig(c, db).key,
          model: audioConfig(c, db).ttsModel,
          voiceId: audioConfig(c, db).voiceId,
        },
        imports: { configured: !!c.importDir },
        endpoints: [
          { path: "/api/animals", access: "Photos et fiches publiées" },
          { path: "/api/feed", access: "Événements publics paginés" },
          {
            path: "/api/public/changes",
            access: "Historique des faits SPA · activable par l’administration",
          },
          {
            path: "/api/public/display",
            access: "Sélection de l’écran public · désactivée par défaut",
          },
          { path: "/feed.xml", access: "Flux RSS public" },
          { path: "/api/stats", access: "Compte équipe requis" },
        ],
      };
    },
  );
}
