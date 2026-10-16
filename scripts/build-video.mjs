import { bundle } from "@remotion/bundler";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
await bundle({
  entryPoint: path.join(root, "video", "Root.jsx"),
  outDir: path.join(root, "video-bundle"),
  enableCaching: false,
  publicDir: path.join(root, "public"),
  onProgress: () => {},
});
console.log("Composition Remotion compilée dans video-bundle/.");
