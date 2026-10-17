// Compatibility entry point: use the current presentation, without the old GPIC scenes.
import { renderShowcase } from "./render-showcase.mjs";
const args = process.argv.slice(2);
const output = args[0] && !args[0].startsWith("--") ? args.shift() : null;
await renderShowcase([
  "--format",
  "portrait",
  ...(output ? ["--output-file", output] : []),
  ...args,
]);
