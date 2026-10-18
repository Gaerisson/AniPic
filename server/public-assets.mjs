import path from "node:path";
import { promises as fs } from "node:fs";
import { root } from "./config.mjs";

// Production images contain dist/, development checkouts also contain public/.
export async function publicAsset(name, base = root) {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name))
    throw Error("Nom de ressource invalide.");
  for (const folder of ["dist", "public"]) {
    try {
      return await fs.readFile(path.join(base, folder, name));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  throw Object.assign(
    Error(
      `Ressource ${name} absente du déploiement. Recompilez l’image AniPic complète.`,
    ),
    {
      code: "ASSET_MISSING",
      statusCode: 503,
    },
  );
}
