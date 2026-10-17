import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const report = path.join(root, "release-validation.json");
try {
  unlinkSync(report);
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
if (Number(process.versions.node.split(".")[0]) !== 24)
  throw Error("Validation release : Node.js 24 requis.");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const steps = [
  [npm, ["ci"]],
  [npm, ["test"]],
  [npm, ["run", "build"]],
  [npm, ["run", "video:build"]],
  [process.execPath, ["scripts/check-deploy-config.mjs"]],
  ["docker", ["build", "--pull", "-t", "anipic:release-check", "."]],
  [
    "docker",
    [
      "run",
      "--rm",
      "--tmpfs",
      "/tmp:size=768m",
      "--entrypoint",
      "node",
      "anipic:release-check",
      "scripts/docker-smoke.mjs",
    ],
  ],
];
const env = {
  ...process.env,
  ONNXRUNTIME_NODE_INSTALL: "skip",
  ANIPIC_MEDIA_PATH: "/mnt/anipic/photos",
  ANIPIC_BACKUP_PATH: "/mnt/anipic/backups",
  ANIPIC_C8_PATH: "/mnt/anipic/C8",
  ANIPIC_IMPORT_PATH: "/mnt/anipic/Import",
};
for (const [cmd, args] of steps) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    env,
    shell: process.platform === "win32" && cmd === npm,
  });
  if (r.error || r.status !== 0) {
    console.error(
      "Validation incomplète : aucune attestation de release créée.",
      r.error?.message || "",
    );
    process.exit(1);
  }
}
writeFileSync(
  report,
  JSON.stringify(
    {
      validatedAt: new Date().toISOString(),
      node: process.version,
      steps: steps.map((s) => s.flat().join(" ")),
    },
    null,
    2,
  ),
);
console.log("Contrôles complets réussis. Aucun volume existant utilisé.");
