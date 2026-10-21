import { z } from "zod";
import {
  moduleCatalog,
  defaultModules,
  apiModule,
} from "../shared/modules.mjs";
import { settings, saveSettings, audit } from "./db.mjs";
export const modulesConfig = (db) => ({
  ...defaultModules,
  ...settings(db).enabledModules,
});
export function moduleHook(db) {
  return async (req, reply) => {
    const key = apiModule(req.url);
    if (key && modulesConfig(db)[key] === false)
      return reply
        .code(503)
        .send({
          error: "Ce module est désactivé par l’administration.",
          code: "MODULE_DISABLED",
          module: key,
        });
  };
}
export async function registerModules(app, { db, authorized }) {
  const schema = z
    .object(Object.fromEntries(moduleCatalog.map((m) => [m.id, z.boolean()])))
    .strict();
  app.get("/api/modules", async () => ({
    modules: modulesConfig(db),
    publicPosters: settings(db).publicPosters !== false,
  }));
  app.get(
    "/api/admin/modules",
    { preHandler: authorized(["admin"]) },
    async () => ({
      modules: modulesConfig(db),
      publicPosters: settings(db).publicPosters !== false,
    }),
  );
  app.put(
    "/api/admin/modules",
    { preHandler: authorized(["admin"]) },
    async (req) => {
      const v = z
        .object({ modules: schema, publicPosters: z.boolean() })
        .strict()
        .parse(req.body);
      saveSettings(db, {
        enabledModules: v.modules,
        publicPosters: v.publicPosters,
      });
      audit(db, req.user, "modules_updated", v);
      return { ok: true, ...v };
    },
  );
}
