import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  assertSafeBindSource,
  assertNormalizedBind,
} from "./deploy-config.mjs";

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
const version = JSON.parse(
  readFileSync(path.join(root, "package.json")),
).version;
assert.equal(
  /org\.opencontainers\.image\.version="([^"]+)"/.exec(
    readFileSync(path.join(root, "Dockerfile"), "utf8"),
  )?.[1],
  version,
  "Le label de version Docker doit correspondre au manifeste.",
);
function check(files, mode) {
  const fromSource = mode === "source";
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
    fromSource ? "build" : mode === "registry" ? "always" : "never",
    "Une image AniPic locale ne doit pas être recherchée dans un registre.",
  );
  assert.equal(
    service.image,
    mode === "registry"
      ? `ghcr.io/gaerisson/anipic:${version}`
      : `anipic:${version}`,
    "L’image doit correspondre à la version du manifeste.",
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
    assertSafeBindSource(
      readFileSync(path.join(root, files[0]), "utf8"),
      target,
    );
    assertNormalizedBind(mount(target), target, source);
  }
  if (files.includes("compose.c8.yml")) {
    assert.equal(mount("/broadcasts").read_only, true);
    assert.equal(mount("/imports").read_only, true);
    for (const [file, target, source] of [
      ["compose.c8.yml", "/broadcasts", env.ANIPIC_C8_PATH],
      ["compose.import.yml", "/imports", env.ANIPIC_IMPORT_PATH],
    ]) {
      assertSafeBindSource(readFileSync(path.join(root, file), "utf8"), target);
      assertNormalizedBind(mount(target), target, source);
    }
  }
  console.log(
    `${files.join(" + ")} : politique d’image, volumes et protections vérifiés.`,
  );
}
for (const [file, mode] of [
  ["compose.yml", "source"],
  ["portainer-stack.yml", "local"],
  ["portainer-ghcr.yml", "registry"],
]) {
  check([file], mode);
  check([file, "compose.c8.yml", "compose.import.yml"], mode);
}
