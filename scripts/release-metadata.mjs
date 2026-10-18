import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function releaseMetadata(pkg, lock, env) {
  const version = pkg.version;
  assert.match(version, /^\d+\.\d+\.\d+$/, "Version stable x.y.z requise.");
  assert.equal(lock.version, version, "Version du lockfile incohérente.");
  assert.equal(
    lock.packages?.[""]?.version,
    version,
    "Version racine du lockfile incohérente.",
  );
  if (env.GITHUB_REF?.startsWith("refs/tags/"))
    assert.equal(
      env.GITHUB_REF,
      `refs/tags/v${version}`,
      "Le tag doit correspondre au manifeste.",
    );
  const repository = env.GITHUB_REPOSITORY;
  assert.match(repository, /^[\w.-]+\/[\w.-]+$/, "Dépôt GitHub manquant.");
  assert.match(env.GITHUB_SHA, /^[a-f\d]{40}$/i, "Commit GitHub manquant.");
  return {
    version,
    tag: `v${version}`,
    image: `ghcr.io/${repository.toLowerCase()}`,
    sha: env.GITHUB_SHA,
    repository,
  };
}

export function readReleaseMetadata(env = process.env) {
  return releaseMetadata(
    JSON.parse(readFileSync(new URL("../package.json", import.meta.url))),
    JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url))),
    env,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const info = readReleaseMetadata();
  readFileSync(new URL(`../RELEASE_${info.tag}.md`, import.meta.url));
  for (const [key, value] of Object.entries(info))
    console.log(`${key}=${value}`);
}
