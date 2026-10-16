import { ensureBrowser } from "@remotion/renderer";
import { writeFile, cp, mkdir } from "node:fs/promises";
import path from "node:path";
const status = await ensureBrowser({ logLevel: "warn" });
if (!("path" in status)) throw new Error("Navigateur de rendu indisponible.");
let executable = status.path;
if (process.env.VIDEO_BROWSER_INSTALL_DIR) {
  const destination = path.resolve(process.env.VIDEO_BROWSER_INSTALL_DIR);
  await mkdir(destination, { recursive: true });
  await cp(path.dirname(status.path), destination, { recursive: true });
  executable = path.join(destination, path.basename(status.path));
}
await writeFile(
  path.join(import.meta.dirname, "..", "browser-path.txt"),
  executable,
);
console.log("Navigateur Remotion prêt.");
