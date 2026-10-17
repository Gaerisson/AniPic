import { bundle } from "@remotion/bundler";
import path from "node:path";
import { promises as fs } from "node:fs";
const root = path.resolve(import.meta.dirname, "..");
const outDir = path.resolve(root, "video-bundle");
// Remotion copies public assets without removing files that disappeared since
// the preceding build. Only this generated directory may be cleaned.
if (path.dirname(outDir) !== root || path.basename(outDir) !== "video-bundle")
  throw new Error("Répertoire de compilation vidéo invalide.");
const existing = await fs.lstat(outDir).catch((error) => {
  if (error.code !== "ENOENT") throw error;
  return null;
});
if (existing?.isSymbolicLink())
  throw new Error("Le répertoire vidéo ne doit pas être un lien symbolique.");
await fs.rm(outDir, { recursive: true, force: true });
await bundle({
  entryPoint: path.join(root, "video", "Root.jsx"),
  outDir,
  enableCaching: false,
  publicDir: path.join(root, "public"),
  onProgress: () => {},
});
console.log("Composition Remotion compilée dans video-bundle/.");
