import path from "node:path";
import {
  mkdirSync,
  existsSync,
  lstatSync,
  accessSync,
  constants,
} from "node:fs";
import { validateNetwork } from "./ip-access.mjs";
export const root = path.resolve(import.meta.dirname, "..");
export function config(overrides = {}) {
  const number = (name, fallback, min, max) => {
    const value = Number(process.env[name] ?? fallback);
    if (!Number.isFinite(value) || value < min || value > max)
      throw new Error(`${name} hors limites`);
    return value;
  };
  const c = {
    dbDir: path.resolve(process.env.DB_DIR || path.join(root, "data")),
    mediaDir: path.resolve(process.env.MEDIA_DIR || path.join(root, "media")),
    cacheDir: path.resolve(process.env.CACHE_DIR || path.join(root, "cache")),
    backupDir: path.resolve(
      process.env.BACKUP_DIR || path.join(root, "backups"),
    ),
    geoipDbPath: process.env.GEOIP_DB_PATH || "",
    broadcastDir: process.env.BROADCAST_DIR
      ? path.resolve(process.env.BROADCAST_DIR)
      : null,
    importDir: process.env.IMPORT_DIR
      ? path.resolve(process.env.IMPORT_DIR)
      : null,
    port: number("PORT", 3000, 1, 65535),
    host: process.env.HOST || "127.0.0.1",
    origin: process.env.APP_ORIGIN || "http://localhost:3000",
    canvaClientId: process.env.CANVA_CLIENT_ID || "",
    canvaClientSecret: process.env.CANVA_CLIENT_SECRET || "",
    canvaRedirectUri: process.env.CANVA_REDIRECT_URI || "",
    canvaEncryptionKey: process.env.CANVA_TOKEN_KEY || "",
    visitorCountryHeader: process.env.VISITOR_COUNTRY_HEADER || "",
    mistralApiKey: process.env.MISTRAL_API_KEY || "",
    mistralTtsModel: process.env.MISTRAL_TTS_MODEL || "voxtral-mini-tts-2603",
    mistralTtsVoiceId: process.env.MISTRAL_TTS_VOICE_ID || "",
    mistralSttModel: process.env.MISTRAL_STT_MODEL || "voxtral-mini-latest",
    ffmpegPath: process.env.FFMPEG_PATH || "",
    secureCookie: process.env.COOKIE_SECURE === "true",
    maxUploadBytes: number("MAX_UPLOAD_MB", 25, 1, 100) * 1024 ** 2,
    initialCacheBytes: number("CACHE_MB", 512, 16, 16384) * 1024 ** 2,
    trustProxy:
      process.env.TRUST_PROXY === "true"
        ? (process.env.PROXY_TRUSTED_IPS || "127.0.0.1,::1")
            .split(",")
            .map(validateNetwork)
        : false,
    demo: process.env.DEMO_MODE === "true",
    requireMarker: process.env.REQUIRE_STORAGE_MARKER === "true",
    ...overrides,
  };
  // A missing NAS must never cause local media/backup directories to be created.
  if (c.requireMarker) assertStorage(c);
  for (const p of [
    c.dbDir,
    c.cacheDir,
    ...(c.requireMarker ? [] : [c.mediaDir, c.backupDir]),
  ])
    mkdirSync(p, { recursive: true });
  assertStorage(c);
  return c;
}
export function assertStorage(c) {
  if (c.requireMarker)
    for (const directory of [c.mediaDir, c.backupDir])
      if (!existsSync(path.join(directory, ".anipic-volume")))
        throw new Error(
          "Volume de stockage absent : marqueur .anipic-volume introuvable. Vérifiez le montage NAS.",
        );
      else {
        const marker = lstatSync(path.join(directory, ".anipic-volume"));
        if (!marker.isFile() || marker.isSymbolicLink())
          throw new Error(
            "Marqueur de stockage invalide : fichier régulier requis.",
          );
        accessSync(directory, constants.R_OK | constants.W_OK | constants.X_OK);
      }
}
