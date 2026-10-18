import path from "node:path";
import { existsSync } from "node:fs";
import { z } from "zod";
import serveStatic from "@fastify/static";
import { root } from "./config.mjs";
import { publicAsset } from "./public-assets.mjs";

export const androidDownloadSchema = z
  .object({
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    versionCode: z.number().int().positive(),
    packageId: z.literal("fr.gaerisson.anipic"),
    siteUrl: z.literal("https://anipic.gaerisson.fr"),
    filename: z.string().regex(/^AniPic-\d+\.\d+\.\d+\.apk$/),
    bytes: z
      .number()
      .int()
      .positive()
      .max(32 * 1024 * 1024),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    certificateSha256: z.string().regex(/^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/),
  })
  .strict();

export async function registerAndroidDownload(app) {
  const meta = androidDownloadSchema.parse(
    JSON.parse(await publicAsset("android-download.json")),
  );
  if (meta.filename !== `AniPic-${meta.version}.apk`)
    throw Error("Version du téléchargement Android incohérente.");
  const html = (await publicAsset("android-install.html")).toString("utf8");
  const values = {
    APK_VERSION: meta.version,
    APK_SIZE:
      (meta.bytes / 1000000).toLocaleString("fr-FR", {
        maximumFractionDigits: 1,
      }) + " Mo",
    APK_SHA256: meta.sha256,
    APK_CERTIFICATE: meta.certificateSha256,
    APK_URL: `/downloads/${meta.filename}`,
  };
  const rendered = html.replace(
    /__([A-Z_0-9]+)__/g,
    (token, key) => values[key] ?? token,
  );
  for (const url of ["/android", "/android/", "/android-install.html"]) {
    app.get(url, async (_req, reply) =>
      reply
        .type("text/html; charset=utf-8")
        .header("Cache-Control", "no-cache")
        .send(rendered),
    );
  }
  app.get("/android-download.json", async (_req, reply) =>
    reply.header("Cache-Control", "no-cache").send(meta),
  );
  await app.register(serveStatic, {
    root: [
      path.join(root, "dist/downloads"),
      path.join(root, "public/downloads"),
    ].filter(existsSync),
    prefix: "/downloads/",
    decorateReply: false,
    index: false,
    list: false,
    dotfiles: "deny",
    maxAge: "1y",
    immutable: true,
    allowedPath: (name) =>
      [meta.filename, meta.filename + ".sha256"].includes(
        name.replace(/^\//, ""),
      ),
    setHeaders: (res, file) => {
      if (file.endsWith(".apk")) {
        res.header("Content-Type", "application/vnd.android.package-archive");
        res.header(
          "Content-Disposition",
          `attachment; filename="${meta.filename}"`,
        );
      } else res.header("Content-Type", "text/plain; charset=utf-8");
    },
  });
}
