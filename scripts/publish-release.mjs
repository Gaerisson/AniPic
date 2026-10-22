// Runs only in the gated GitHub Actions publication job, using its short-lived token.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  appendFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { readReleaseMetadata } from "./release-metadata.mjs";
import { createReleaseApi, findRelease } from "./github-release-api.mjs";

const info = readReleaseMetadata();
assert.equal(
  process.env.GITHUB_ACTIONS,
  "true",
  "Publication réservée à la CI contrôlée.",
);
assert.ok(process.env.GH_TOKEN, "Jeton de publication manquant.");
const run = (command, args, capture = false) =>
  execFileSync(command, args, {
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
    windowsHide: true,
  });
const api = createReleaseApi({
  repository: info.repository,
  token: process.env.GH_TOKEN,
});
const tagged = await api(`git/ref/tags/${info.tag}`, { absent: true });
if (tagged) {
  let object = tagged.object;
  for (let depth = 0; object.type === "tag" && depth < 5; depth++)
    object = (await api(`git/tags/${object.sha}`)).object;
  assert.equal(object.type, "commit");
  assert.equal(
    object.sha,
    info.sha,
    "Le tag existe sur un autre commit : aucun remplacement autorisé.",
  );
}
let release = await findRelease(api, info.tag);
if (release && !release.draft) {
  assert.ok(tagged, "Release existante sans tag vérifiable.");
  console.log(`Release déjà publiée pour ce commit : ${release.html_url}`);
  process.exit(0);
}
if (release)
  assert.equal(
    release.target_commitish,
    info.sha,
    "Brouillon associé à un autre commit.",
  );
const labels = JSON.parse(
  run(
    "docker",
    ["image", "inspect", "anipic:ci", "--format", "{{json .Config.Labels}}"],
    true,
  ),
);
assert.equal(labels["org.opencontainers.image.version"], info.version);
assert.equal(
  labels["org.opencontainers.image.revision"],
  info.sha,
  "L’image doit être celle contrôlée par le job Docker.",
);
const previous = await api("releases/latest", { absent: true });
const numeric = (tag) =>
  /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag)?.slice(1).map(Number);
const old = numeric(previous?.tag_name),
  current = numeric(info.tag);
const newest =
  !old ||
  current.some(
    (v, i) => v > old[i] && current.slice(0, i).every((n, j) => n === old[j]),
  ) ||
  current.every((n, i) => n === old[i]);
const notes = readFileSync(`RELEASE_${info.tag}.md`, "utf8").replace(
  /\]\((?!https?:|#)([^)]+)\)/g,
  (_, target) =>
    `](https://github.com/${info.repository}/blob/${info.sha}/${target})`,
);
const title = notes.split(/\r?\n/)[0].replace(/^#\s+/, "");
if (!release)
  release = await api("releases", {
    method: "POST",
    body: {
      tag_name: info.tag,
      target_commitish: info.sha,
      name: title,
      body: notes,
      draft: true,
    },
  });
// Publish the tested image, never a second build. Failed pushes leave a draft release.
for (const tag of [
  info.version,
  `sha-${info.sha}`,
  ...(newest ? ["latest"] : []),
]) {
  const reference = `${info.image}:${tag}`;
  run("docker", ["tag", "anipic:ci", reference]);
  run("docker", ["push", reference]);
}
const digests = JSON.parse(
  run(
    "docker",
    [
      "image",
      "inspect",
      `${info.image}:${info.version}`,
      "--format",
      "{{json .RepoDigests}}",
    ],
    true,
  ),
);
const digest = digests.find((value) =>
  value.startsWith(info.image + "@sha256:"),
);
assert.ok(digest, "Digest du registre absent : release non publiée.");
mkdirSync("release-artifacts", { recursive: true });
const archive = `release-artifacts/anipic-${info.tag}.zip`;
run("git", [
  "archive",
  "--format=zip",
  "--prefix=anipic/",
  `--output=${archive}`,
  info.sha,
]);
const hash = createHash("sha256").update(readFileSync(archive)).digest("hex");
writeFileSync(
  `release-artifacts/anipic-${info.tag}.sha256`,
  `${hash}  anipic-${info.tag}.zip\n`,
);
writeFileSync(
  "release-artifacts/image-digest.txt",
  `${digest}\nCommit : ${info.sha}\nPlateforme : linux/amd64\n`,
);
run("gh", [
  "release",
  "upload",
  info.tag,
  archive,
  `release-artifacts/anipic-${info.tag}.sha256`,
  "release-artifacts/image-digest.txt",
  "--repo",
  info.repository,
  "--clobber",
]);
release = await api(`releases/${release.id}`, {
  method: "PATCH",
  body: {
    draft: false,
    make_latest: String(newest),
    body: `${notes}\n\nImage Docker (linux/amd64) : \`${info.image}:${info.version}\`\n\nDigest : \`${digest}\`\n\nCommit contrôlé : \`${info.sha}\`. Tests, builds frontend/vidéo, construction Docker et rendu MP4 de contrôle réussis dans GitHub Actions. Le déploiement sur votre NAS et votre TV reste à vérifier.\n`,
  },
});
console.log(`Release publiée : ${release.html_url}`);
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## AniPic ${info.version}\n\n[Release](${release.html_url})\n\nImage : \`${info.image}:${info.version}\`\n\n\`${digest}\`\n\nPremier envoi GHCR : vérifier la visibilité publique du package avant un pull anonyme dans Portainer.\n`,
  );
