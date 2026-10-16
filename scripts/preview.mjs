import path from "node:path";
import { existsSync } from "node:fs";
import { config, root } from "../server/config.mjs";
import { openDb } from "../server/db.mjs";
import { createApp } from "../server/app.mjs";
import { seed } from "./seed.mjs";

if (!existsSync(path.join(root, "dist", "index.html")))
  throw new Error("Compilez d’abord l’interface avec npm run build.");
if (!existsSync(path.join(root, "demo", "images", "nala.jpg")))
  throw new Error(
    "Les photos de démonstration sont absentes. Utilisez le projet source complet pour cet aperçu.",
  );
const base = path.join(root, ".demo");
const options = {
  dbDir: path.join(base, "db"),
  mediaDir: path.join(base, "media"),
  cacheDir: path.join(base, "cache"),
  backupDir: path.join(base, "backups"),
  demo: true,
  requireMarker: false,
  secureCookie: false,
  trustProxy: false,
  host: "127.0.0.1",
  port: 3036,
  origin: "http://localhost:3036",
  scheduler: false,
};
const c = config(options);
const db = openDb(c);
try {
  if (!db.prepare("SELECT id FROM animals LIMIT 1").get()) await seed(db, c);
} finally {
  db.close();
}
const app = await createApp(options);
await app.listen({ host: options.host, port: options.port });
console.log(
  "Démonstration Anipic : http://localhost:3036 — Ctrl+C pour arrêter.",
);
let closing = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    if (closing) return;
    closing = true;
    await app.close();
    process.exit(0);
  });
