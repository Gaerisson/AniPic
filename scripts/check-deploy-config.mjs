import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const binary = process.env.ANIPIC_COMPOSE_BIN || "docker";
const prefix = process.env.ANIPIC_COMPOSE_BIN ? [] : ["compose"];
const env = {
  ...process.env,
  ANIPIC_MEDIA_PATH: "/mnt/anipic/photos",
  ANIPIC_BACKUP_PATH: "/mnt/anipic/backups",
  ANIPIC_C8_PATH: "/mnt/anipic/C8",
  ANIPIC_IMPORT_PATH: "/mnt/anipic/Import",
};
function check(files, fromSource) {
  const config = JSON.parse(
    execFileSync(
      binary,
      [
        ...prefix,
        ...files.flatMap((file) => ["-f", file]),
        "config",
        "--format",
        "json",
      ],
      { cwd: root, env, encoding: "utf8", windowsHide: true, timeout: 30000 },
    ),
  );
  const service = config.services.anipic;
  assert.equal(
    service.pull_policy,
    fromSource ? "build" : "never",
    "Une image AniPic locale ne doit pas être recherchée dans un registre.",
  );
  assert.equal(
    Boolean(service.build),
    fromSource,
    "Le déploiement Git compile ses sources ; la stack locale attend une image construite.",
  );
  assert.equal(service.environment.REQUIRE_STORAGE_MARKER, "true");
  assert.equal(service.environment.DEMO_MODE, "false");
  const mount = (target) => service.volumes.find((v) => v.target === target);
  for (const [target, name] of [
    ["/data", "anipic_db"],
    ["/cache", "anipic_cache"],
  ]) {
    assert.equal(mount(target).type, "volume");
    assert.equal(mount(target).source, name);
  }
  for (const [target, source] of [
    ["/media", env.ANIPIC_MEDIA_PATH],
    ["/backups", env.ANIPIC_BACKUP_PATH],
  ]) {
    assert.equal(mount(target).type, "bind");
    assert.equal(mount(target).source, source);
    assert.equal(mount(target).bind.create_host_path, false);
  }
  if (files.includes("compose.c8.yml")) {
    assert.equal(mount("/broadcasts").read_only, true);
    assert.equal(mount("/imports").read_only, true);
  }
  console.log(
    `${files.join(" + ")} : politique d’image, volumes et protections vérifiés.`,
  );
}
check(["compose.yml"], true);
check(["compose.yml", "compose.c8.yml", "compose.import.yml"], true);
check(["portainer-stack.yml"], false);
