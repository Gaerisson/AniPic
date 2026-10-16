import { z } from "zod";
import { settings } from "./db.mjs";
import { photoPriority, priorityRank } from "../shared/photo-priority.mjs";
import { publicAnimalMetadata } from "./animal-facts.mjs";
export async function registerShootSheet(app, { db, authorized }) {
  app.get(
    "/api/shoot-sheet",
    { preHandler: authorized(["admin", "editor", "agent", "viewer"]) },
    async (req) => {
      const q = z
        .object({
          mode: z
            .enum(["all", "priorities", "missing", "custom"])
            .default("all"),
          species: z.enum(["all", "dog", "cat", "other"]).default("all"),
        })
        .parse(req.query);
      const animals = db
        .prepare(
          "SELECT a.*,(SELECT COUNT(*) FROM photos p WHERE p.animal_id=a.id AND p.archived_at IS NULL) photo_count FROM animals a WHERE a.archived_at IS NULL AND a.status!='adopted' ORDER BY a.name COLLATE NOCASE,a.id",
        )
        .all();
      const tasks = db
        .prepare(
          "SELECT t.*,u.name assignee FROM shoot_tasks t LEFT JOIN users u ON u.id=t.assigned_to WHERE t.state!='done' ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,created_at",
        )
        .all();
      const rank = priorityRank,
        rules = settings(db).photoRules;
      const items = animals
        .filter((a) => q.species === "all" || a.species === q.species)
        .map((a) => {
          const requests = tasks.filter((t) => t.animal_id === a.id);
          return {
            id: a.id,
            name: a.name,
            species: a.species,
            sex: a.sex,
            source_id: a.source_id,
            source_metadata: {
              thumbnail: publicAnimalMetadata(
                JSON.parse(a.source_metadata || "{}"),
              ).thumbnail,
            },
            cover_id: a.cover_id,
            photo_count: a.photo_count,
            requests: requests.map((t) => ({
              id: t.id,
              title: t.title,
              note: t.note,
              priority: t.priority,
              assignee: t.assignee,
            })),
            priority: requests[0]?.priority || photoPriority(a, rules).priority,
          };
        })
        .filter((a) =>
          q.mode === "custom"
            ? true
            : q.mode === "priorities"
              ? a.requests.length
              : q.mode === "missing"
                ? a.photo_count === 0
                : a.requests.length || a.photo_count === 0,
        )
        .sort(
          (a, b) =>
            rank[a.priority] - rank[b.priority] ||
            a.name.localeCompare(b.name, "fr") ||
            a.id.localeCompare(b.id),
        );
      return {
        refuge: settings(db).refugeName,
        generatedAt: new Date().toISOString(),
        total: items.length,
        items: items.slice(0, 500),
        truncated: items.length > 500,
      };
    },
  );
}
