import { publicAsset } from "./public-assets.mjs";
import { appVersion } from "../shared/version.mjs";
import { registerAndroidDownload } from "./android-download.mjs";
export async function registerMobileWeb(app) {
  await registerAndroidDownload(app);
  // Public verification metadata only: no session, PIN pass or user data.
  app.get("/.well-known/assetlinks.json", async (_req, reply) =>
    reply
      .type("application/json")
      .header("Cache-Control", "public, max-age=300")
      .send(await publicAsset("android-assetlinks.json")),
  );
  app.get("/manifest.webmanifest", async (_req, reply) =>
    reply
      .type("application/manifest+json")
      .header("Cache-Control", "no-cache")
      .send(await publicAsset("manifest.webmanifest")),
  );
  app.get("/sw.js", async (_req, reply) =>
    reply
      .type("application/javascript")
      .header("Cache-Control", "no-cache")
      .header("Service-Worker-Allowed", "/")
      .send(
        (await publicAsset("sw.js"))
          .toString("utf8")
          .replaceAll("__ANIPIC_VERSION__", appVersion),
      ),
  );
}
