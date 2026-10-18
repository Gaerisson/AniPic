import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertSafeBindSource,
  assertNormalizedBind,
} from "../scripts/deploy-config.mjs";
import { releaseMetadata } from "../scripts/release-metadata.mjs";

test("NAS guards accept Compose v2/v5 JSON without accepting unsafe source mounts", () => {
  const source = `services:\n  anipic:\n    volumes:\n      - type: bind\n        source: /nas/photos\n        target: /media\n        bind:\n          create_host_path: false\n      - type: bind\n        source: /nas/backups\n        target: /backups\n        bind:\n          create_host_path: false\n`;
  assertSafeBindSource(source, "/media");
  assertSafeBindSource(source.replaceAll("\n", "\r\n"), "/backups");
  const mount = { type: "bind", source: "/nas/photos" };
  for (const bind of [undefined, {}, { create_host_path: false }]) {
    assertNormalizedBind({ ...mount, bind }, "/media", "/nas/photos");
  }
  assert.throws(() =>
    assertNormalizedBind(
      { ...mount, bind: { create_host_path: true } },
      "/media",
      "/nas/photos",
    ),
  );
  assert.throws(() => assertNormalizedBind(mount, "/media", "/wrong/photos"));
  assert.throws(() =>
    assertNormalizedBind({ ...mount, type: "volume" }, "/media", "/nas/photos"),
  );
  assert.throws(() =>
    assertSafeBindSource(
      source.replace("create_host_path: false", "create_host_path: true"),
      "/media",
    ),
  );
  assert.throws(() =>
    assertSafeBindSource(
      source.replace("        bind:\n          create_host_path: false\n", ""),
      "/media",
    ),
  );
  assert.throws(() => assertSafeBindSource(source, "/missing"));
});

test("release rejects mismatched tags and locks, and produces lowercase GHCR references", () => {
  const pkg = { version: "3.10.0" },
    lock = { version: "3.10.0", packages: { "": { version: "3.10.0" } } };
  const env = {
    GITHUB_REPOSITORY: "Gaerisson/AniPic",
    GITHUB_SHA: "a".repeat(40),
    GITHUB_REF: "refs/tags/v3.10.0",
  };
  assert.equal(
    releaseMetadata(pkg, lock, env).image,
    "ghcr.io/gaerisson/anipic",
  );
  assert.throws(() =>
    releaseMetadata(pkg, lock, { ...env, GITHUB_REF: "refs/tags/v3.6.0" }),
  );
  assert.throws(() => releaseMetadata(pkg, { ...lock, version: "3.6.0" }, env));
  assert.throws(() =>
    releaseMetadata(
      pkg,
      { ...lock, packages: { "": { version: "3.6.0" } } },
      env,
    ),
  );
  assert.throws(() =>
    releaseMetadata(pkg, lock, { ...env, GITHUB_SHA: "main" }),
  );
  assert.throws(() =>
    releaseMetadata(pkg, lock, { ...env, GITHUB_REPOSITORY: "invalid" }),
  );
});
