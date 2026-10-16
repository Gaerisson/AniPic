import { settings } from "./db.mjs";
import { accessForPage } from "../shared/page-access.mjs";
export function pageAccessGuard(db, page) {
  return async (req, reply) => {
    if (!req.user && accessForPage(page, settings(db).pageAccess) === "team")
      return reply
        .code(401)
        .send({ error: "Connectez-vous pour consulter cette page." });
  };
}
