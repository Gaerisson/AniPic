import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { readReleaseMetadata } from "../scripts/release-metadata.mjs";

// Exercise the publisher itself in an isolated child. Network, Docker and gh
// are explicitly simulated; no credentials or production storage are used.
test("publication keeps a draft after a failed push, rejects conflicting tags and publishes only after uploads", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "anipic-release-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const context = {
    GITHUB_REPOSITORY: "Gaerisson/AniPic",
    GITHUB_SHA: "a".repeat(40),
  };
  const { tag, version } = readReleaseMetadata(context);
  await writeFile(
    path.join(root, `RELEASE_${tag}.md`),
    "# AniPic test\n\nRelease fixture.",
  );
  for (const scenario of ["push-failure", "conflicting-tag", "success"]) {
    const code = `
      import childProcess from 'node:child_process';
      import { syncBuiltinESMExports } from 'node:module';
      import { writeFileSync } from 'node:fs';
      const events = [], scenario = ${JSON.stringify(scenario)};
      childProcess.execFileSync = (command, args) => {
        events.push([command, ...args]);
        if (command === 'docker' && args[0] === 'push' && scenario === 'push-failure') throw Error('registry unavailable');
        if (command === 'docker' && args.includes('{{json .Config.Labels}}')) return JSON.stringify({
          'org.opencontainers.image.version': ${JSON.stringify(version)},
          'org.opencontainers.image.revision': 'a'.repeat(40)
        });
        if (command === 'docker' && args.includes('{{json .RepoDigests}}')) return JSON.stringify(['ghcr.io/gaerisson/anipic@sha256:'+'b'.repeat(64)]);
        if (command === 'git') writeFileSync(args.find(x=>x.startsWith('--output=')).slice(9), 'archive fixture');
        return '';
      };
      syncBuiltinESMExports();
      globalThis.fetch = async (url, options) => {
        const route = new URL(url).pathname.split('/AniPic/')[1], method = options.method;
        events.push(['api', method, route]);
        if (route.startsWith('git/ref/') && scenario === 'conflicting-tag') return Response.json({object:{type:'commit',sha:'c'.repeat(40)}});
        if (method === 'GET') return new Response('', {status:404});
        if (method === 'POST') return Response.json({id:42, draft:true, html_url:'https://github.com/Gaerisson/AniPic/releases/test'});
        if (method === 'PATCH') {
          events.push(['published',JSON.parse(options.body).draft]);
          return Response.json({html_url:'https://github.com/Gaerisson/AniPic/releases/test'});
        }
        throw Error('Unexpected API operation');
      };
      let error = '';
      try { await import(${JSON.stringify(new URL("../scripts/publish-release.mjs", import.meta.url).href)}); }
      catch (e) { error = e.message; }
      console.log(JSON.stringify({events,error}));
    `;
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "--eval", code],
      {
        cwd: root,
        env: {
          ...process.env,
          ...context,
          GITHUB_ACTIONS: "true",
          GH_TOKEN: "test-token",
          GITHUB_STEP_SUMMARY: "",
          GITHUB_REF: `refs/tags/${tag}`,
        },
        encoding: "utf8",
        windowsHide: true,
        timeout: 15000,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const { events, error } = JSON.parse(
      result.stdout.trim().split(/\r?\n/).at(-1),
    );
    const publish = events.findIndex((event) => event[0] === "published");
    const upload = events.findIndex((event) => event[0] === "gh");
    if (scenario === "success") {
      assert.equal(error, "");
      assert.ok(publish > upload && upload > 0);
      assert.equal(
        events.filter((event) => event[0] === "docker" && event[1] === "push")
          .length,
        3,
      );
      assert.deepEqual(events[publish], ["published", false]);
    } else {
      assert.ok(error);
      assert.equal(publish, -1);
      assert.equal(upload, -1);
      assert.equal(
        events.filter((event) => event[0] === "api" && event[1] === "POST")
          .length,
        scenario === "push-failure" ? 1 : 0,
      );
    }
  }
});
