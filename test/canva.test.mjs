import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import path from "node:path";
import yauzl from "yauzl";
import sharp from "sharp";
import { fixture, login, animal } from "./helpers.mjs";
import { ingest } from "../server/storage.mjs";
import {
  canvaConfiguration,
  sealCanva,
  unsealCanva,
  safeCanvaUrl,
} from "../server/canva.mjs";
import { presentationPlan } from "../server/canva-presentation.mjs";
import { saveSettings } from "../server/db.mjs";
import { createBackup, restoreBackup } from "../server/backup.mjs";
import { DatabaseSync } from "node:sqlite";
import { createSession } from "../server/auth.mjs";
const config = {
  canvaClientId: "OC-test",
  canvaClientSecret: "secret-never-in-browser",
  canvaEncryptionKey: Buffer.alloc(32, 18).toString("base64"),
};
const json = (body) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
const tokens = (suffix = "a") => ({
  access_token: "access-" + suffix,
  refresh_token: "refresh-" + suffix,
  token_type: "Bearer",
  scope: "design:content:write design:meta:read",
  expires_in: 14400,
});
async function photo(db, c, a, color = "#467455", hidden = false) {
  const image = await sharp({
    create: { width: 800, height: 1200, channels: 3, background: color },
  })
    .jpeg()
    .withExif({ IFD0: { Artist: "Private EXIF author" } })
    .toBuffer();
  return ingest(db, c, a, Readable.from(image), "portrait.jpg", hidden);
}
async function zipContents(buffer) {
  const zip = await new Promise((resolve, reject) =>
      yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zip) =>
        err ? reject(err) : resolve(zip),
      ),
    ),
    files = new Map();
  await new Promise((resolve, reject) => {
    zip.on("error", reject);
    zip.on("end", resolve);
    zip.on("entry", (e) =>
      zip.openReadStream(e, (err, stream) => {
        if (err) return reject(err);
        const chunks = [];
        stream.on("data", (b) => chunks.push(b));
        stream.on("error", reject);
        stream.on("end", () => {
          files.set(e.fileName, Buffer.concat(chunks));
          zip.readEntry();
        });
      }),
    );
    zip.readEntry();
  });
  return files;
}
test("Canva configuration, encrypted tokens and strict edit URL validation", () => {
  assert.equal(
    canvaConfiguration({ ...config, origin: "http://localhost:3000" })
      .configured,
    true,
  );
  assert.equal(
    canvaConfiguration({ ...config, origin: "http://192.168.1.2" }).configured,
    false,
  );
  assert.equal(
    canvaConfiguration({
      ...config,
      origin: "https://anipic.test",
      canvaRedirectUri: "https://attacker.test/api/canva/callback",
    }).configured,
    false,
  );
  assert.equal(
    canvaConfiguration({
      ...config,
      origin: "https://anipic.test",
      canvaEncryptionKey: "x",
    }).configured,
    false,
  );
  const sealed = sealCanva(config, "alice", tokens());
  assert.equal(sealed.includes("access-a"), false);
  assert.deepEqual(unsealCanva(config, "alice", sealed), tokens());
  assert.throws(() => unsealCanva(config, "bob", sealed));
  assert.throws(() =>
    unsealCanva({ ...config, canvaClientId: "other" }, "alice", sealed),
  );
  for (const url of [
    "javascript:alert(1)",
    "https://www.canva.com.evil.test/edit",
    "https://user@www.canva.com/edit",
    "http://www.canva.com/edit",
    "https://www.canva.com:8443/edit",
  ])
    assert.equal(safeCanvaUrl(url), null);
  assert.equal(
    safeCanvaUrl("https://www.canva.com/design/DA-test/edit"),
    "https://www.canva.com/design/DA-test/edit",
  );
});
test("Canva OAuth uses one-time, session-bound PKCE and never exposes tokens", async (t) => {
  const calls = [],
    logs = [],
    { app, db } = await fixture(t, {
      ...config,
      logger: { level: "info", stream: { write: (chunk) => logs.push(chunk) } },
      canvaFetcher: async (url, init) => {
        calls.push({ url, init });
        return json(tokens());
      },
    }),
    a = animal(db),
    alice = await login(app, "agent"),
    bob = await login(app, "editor");
  assert.equal(
    (await app.inject({ url: "/api/canva/status" })).statusCode,
    401,
  );
  const viewer = await login(app, "viewer");
  assert.equal(
    (await app.inject({ url: "/api/canva/status", headers: viewer.headers }))
      .statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/canva/connect",
        headers: { cookie: alice.headers.cookie },
        payload: {},
      })
    ).statusCode,
    403,
  );
  const start = await app.inject({
    method: "POST",
    url: "/api/canva/connect",
    headers: alice.headers,
    payload: { animalId: a },
  });
  assert.equal(start.statusCode, 200, start.body);
  const u = new URL(start.json().url),
    state = u.searchParams.get("state");
  assert.equal(u.origin, "https://www.canva.com");
  assert.equal(u.searchParams.get("code_challenge_method"), "s256");
  assert.equal(
    u.searchParams.get("scope"),
    "design:content:write design:meta:read",
  );
  const stored = db.prepare("SELECT * FROM canva_oauth").get(),
    verifier = unsealCanva(config, stored.state_hash, stored.verifier);
  assert.equal(
    u.searchParams.get("code_challenge"),
    createHash("sha256").update(verifier).digest("base64url"),
  );
  const callback = `/api/canva/callback?state=${state}&code=authorization-example`;
  const otherSession = createSession(db, alice.user.id);
  assert.equal(
    (
      await app.inject({
        url: callback,
        headers: { cookie: "anipic_session=" + otherSession.token },
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (await app.inject({ url: callback, headers: bob.headers })).statusCode,
    400,
  );
  assert.equal(calls.length, 0);
  const done = await app.inject({ url: callback, headers: alice.headers });
  assert.equal(done.statusCode, 302, done.body);
  assert.equal(done.headers.location, `/?canva=connected#canva/${a}`);
  assert.equal(calls.length, 1);
  assert.equal(logs.join("").includes("authorization-example"), false);
  assert.equal(logs.join("").includes(state), false);
  assert.equal(calls[0].url, "https://api.canva.com/rest/v1/oauth/token");
  const body = new URLSearchParams(calls[0].init.body);
  assert.equal(body.get("code_verifier"), verifier);
  assert.equal(calls[0].init.redirect, "error");
  assert.match(calls[0].init.headers.Authorization, /^Basic /);
  const encrypted = db
    .prepare("SELECT tokens FROM canva_connections")
    .get().tokens;
  assert.equal(encrypted.includes("access-a"), false);
  assert.equal(
    (await app.inject({ url: callback, headers: alice.headers })).statusCode,
    400,
  );
  assert.equal(calls.length, 1);
  const status = await app.inject({
    url: "/api/canva/status",
    headers: alice.headers,
  });
  assert.equal(status.json().connected, true);
  assert.equal(status.body.includes("secret-never"), false);
  assert.equal(status.body.includes("access-a"), false);
  assert.equal(
    (
      await app.inject({ url: "/api/canva/status", headers: bob.headers })
    ).json().connected,
    false,
  );
  const expired = await app.inject({
    method: "POST",
    url: "/api/canva/connect",
    headers: alice.headers,
    payload: {},
  });
  db.prepare("UPDATE canva_oauth SET expires_at='2000-01-01'").run();
  assert.equal(
    (
      await app.inject({
        url:
          "/api/canva/callback?code=x&state=" +
          new URL(expired.json().url).searchParams.get("state"),
        headers: alice.headers,
      })
    ).statusCode,
    400,
  );
});
test("pre-design exports real editable text and separate photos, validates animal IDs and strips EXIF", async (t) => {
  const { app, db, c } = await fixture(t),
    { headers } = await login(app, "agent"),
    a = animal(db, "Nala & compagnie"),
    b = animal(db, "Nala & compagnie"),
    p = await photo(db, c, a),
    q = await photo(db, c, b, "#b48c77");
  db.prepare(
    "UPDATE animals SET description='<b>Une histoire SPA.</b>',compatibility=? WHERE id=?",
  ).run(JSON.stringify({ chats: true, chiens: false }), a);
  const body = { animalId: a, photoIds: [p.id], format: "story" };
  const plan = await app.inject({
    method: "POST",
    url: "/api/canva/plan",
    headers,
    payload: body,
  });
  assert.equal(plan.statusCode, 200, plan.body);
  assert.equal(plan.json().pages[0].width, 1080);
  assert.equal(plan.json().pages[0].height, 1920);
  assert.match(plan.json().facts.compatibility, /OK Chats/);
  assert.equal(plan.body.includes("<b>"), false);
  assert.equal(plan.body.includes(p.hash), false);
  const download = await app.inject({
    method: "POST",
    url: "/api/canva/presentation",
    headers,
    payload: body,
  });
  assert.equal(download.statusCode, 200, download.body.slice(0, 100));
  assert.match(download.headers["content-type"], /presentationml/);
  const files = await zipContents(download.rawPayload),
    slides = [...files].filter(([name]) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(name),
    ),
    images = [...files].filter(([name]) => /^ppt\/media\/.*\.jpeg$/.test(name));
  assert.equal(slides.length, 3);
  assert.ok(images.length > 0);
  assert.match(slides[0][1].toString(), /Nala &amp; compagnie/);
  assert.match(slides[0][1].toString(), /<p:pic>/);
  assert.match(slides[0][1].toString(), /<a:srcRect/);
  assert.equal(
    slides.some(([, data]) => data.toString().includes("Anipic")),
    false,
  );
  for (const [, image] of images) {
    const metadata = await sharp(image).metadata();
    assert.equal(metadata.exif, undefined);
    assert.ok(metadata.width <= 1920);
  }
  for (const bad of [
    { ...body, photoIds: [q.id] },
    { ...body, photoIds: [p.id, p.id] },
    { ...body, description: "Injected facts" },
  ])
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/canva/plan",
          headers,
          payload: bad,
        })
      ).statusCode,
      400,
    );
  saveSettings(db, {
    statusAppearance: {
      available: { label: "À rencontrer", color: "#ffff00" },
    },
  });
  assert.equal(presentationPlan(db, body).facts.statusLabel, "À rencontrer");
  for (const format of ["portrait", "presentation"]) {
    const p = presentationPlan(db, { ...body, format });
    for (const page of p.pages)
      for (const item of page.items)
        assert.ok(
          item.x >= 0 &&
            item.y >= 0 &&
            item.x + item.width <= page.width + 1 &&
            item.y + item.height <= page.height + 1,
          `${format}: ${page.label}`,
        );
  }
});
test("Canva imports are private per account, preserve selected hidden photos, poll and refresh edit URLs", async (t) => {
  const calls = [],
    { app, db, c } = await fixture(t, {
      ...config,
      canvaFetcher: async (url, init) => {
        calls.push({ url, init });
        if (url.endsWith("/imports"))
          return json({ job: { id: "import-123", status: "in_progress" } });
        if (url.includes("/imports/"))
          return json({
            job: {
              id: "import-123",
              status: "success",
              result: { designs: [{ id: "DA-test", title: "Nala" }] },
            },
          });
        if (url.includes("/designs/"))
          return json({
            design: {
              id: "DA-test",
              urls: { edit_url: "https://www.canva.com/design/DA-test/edit" },
            },
          });
        return json({});
      },
    }),
    alice = await login(app, "agent"),
    bob = await login(app, "editor"),
    a = animal(db),
    p = await photo(db, c, a, "#467455", true),
    unused = await photo(db, c, a, "#221155", true);
  db.prepare("INSERT INTO canva_connections VALUES (?,?,?)").run(
    alice.user.id,
    sealCanva(config, alice.user.id, {
      ...tokens(),
      expires_at: Date.now() + 3600000,
    }),
    new Date().toISOString(),
  );
  const project = await app.inject({
    method: "POST",
    url: "/api/canva/projects",
    headers: alice.headers,
    payload: { animalId: a, photoIds: [p.id] },
  });
  assert.equal(project.statusCode, 201, project.body);
  assert.equal(project.json().photoCount, 1);
  assert.equal(calls.length, 1);
  const meta = JSON.parse(calls[0].init.headers["Import-Metadata"]);
  assert.match(meta.mime_type, /presentationml/);
  assert.equal(calls[0].init.headers.Authorization, "Bearer access-a");
  const files = await zipContents(calls[0].init.body);
  assert.ok([...files].some(([n]) => n.startsWith("ppt/media/")));
  for (const [name, data] of files)
    if (/^ppt\/media\/.*\.jpeg$/.test(name)) {
      const { channels } = await sharp(data).stats();
      assert.ok(
        channels[1].mean > channels[2].mean,
        "the unselected purple photo must not be sent",
      );
    }
  assert.equal(
    (
      await app.inject({
        url: "/api/canva/projects?animalId=" + a,
        headers: bob.headers,
      })
    ).json().items.length,
    0,
  );
  assert.equal(
    (
      await app.inject({
        url: "/api/canva/projects/" + project.json().id,
        headers: bob.headers,
      })
    ).statusCode,
    404,
  );
  db.prepare("UPDATE canva_projects SET checked_at='2000-01-01'").run();
  const done = await app.inject({
    url: "/api/canva/projects/" + project.json().id,
    headers: alice.headers,
  });
  assert.equal(done.json().state, "success", done.body);
  assert.equal(done.json().designs[0].id, "DA-test");
  assert.equal(done.body.includes("Bearer"), false);
  const edit = await app.inject({
    url: `/api/canva/projects/${project.json().id}/edit/DA-test`,
    headers: alice.headers,
  });
  assert.equal(edit.statusCode, 302, edit.body);
  assert.equal(
    edit.headers.location,
    "https://www.canva.com/design/DA-test/edit",
  );
  assert.equal(
    (
      await app.inject({
        url: `/api/canva/projects/${project.json().id}/edit/DA-other`,
        headers: alice.headers,
      })
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await app.inject({
        url: `/api/canva/projects/${project.json().id}/edit/DA-test`,
        headers: bob.headers,
      })
    ).statusCode,
    404,
  );
  assert.equal(
    db.prepare("SELECT hidden FROM photos WHERE id=?").get(p.id).hidden,
    1,
  );
  assert.ok(unused.id);
});
test("parallel Canva operations rotate an expired refresh token once and disconnection removes pending authorization", async (t) => {
  let refreshed = 0,
    revoked = 0;
  const { app, db } = await fixture(t, {
      ...config,
      canvaFetcher: async (url, init) => {
        if (url.endsWith("/oauth/token")) {
          refreshed++;
          assert.equal(
            new URLSearchParams(init.body).get("refresh_token"),
            "refresh-a",
          );
          return json(tokens("b"));
        }
        if (url.endsWith("/oauth/revoke")) {
          revoked++;
          assert.equal(
            new URLSearchParams(init.body).get("token"),
            "refresh-b",
          );
          return new Response(null, { status: 200 });
        }
        return json({
          design: {
            id: "DA-test",
            urls: { edit_url: "https://www.canva.com/design/DA-test/edit" },
          },
        });
      },
    }),
    { user, headers } = await login(app, "agent"),
    a = animal(db);
  db.prepare("INSERT INTO canva_connections VALUES (?,?,?)").run(
    user.id,
    sealCanva(config, user.id, { ...tokens(), expires_at: 0 }),
    new Date().toISOString(),
  );
  const projectId = crypto.randomUUID();
  db.prepare(
    "INSERT INTO canva_projects(id,user_id,animal_id,title,format,photo_count,state,designs,created_at) VALUES (?,?,?,'Nala','story',1,'success',?,?)",
  ).run(
    projectId,
    user.id,
    a,
    JSON.stringify([{ id: "DA-test" }]),
    new Date().toISOString(),
  );
  const responses = await Promise.all(
    [1, 2].map(() =>
      app.inject({
        method: "POST",
        url: `/api/canva/projects/${projectId}/open`,
        headers,
        payload: { designId: "DA-test" },
      }),
    ),
  );
  for (const r of responses) assert.equal(r.statusCode, 200, r.body);
  assert.equal(refreshed, 1);
  await app.inject({
    method: "POST",
    url: "/api/canva/connect",
    headers,
    payload: {},
  });
  const disconnected = await app.inject({
    method: "DELETE",
    url: "/api/canva/connection",
    headers,
  });
  assert.equal(disconnected.json().revoked, true);
  assert.equal(revoked, 1);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM canva_connections").get().n,
    0,
  );
  assert.equal(db.prepare("SELECT COUNT(*) n FROM canva_oauth").get().n, 0);
});
test("restoring a backup preserves Canva history but never revives OAuth tokens or sessions", async (t) => {
  const { db, c, base, app } = await fixture(t, config),
    { user, headers } = await login(app, "agent");
  db.prepare("INSERT INTO canva_connections VALUES (?,?,?)").run(
    user.id,
    sealCanva(config, user.id, tokens()),
    new Date().toISOString(),
  );
  await app.inject({
    method: "POST",
    url: "/api/canva/connect",
    headers,
    payload: {},
  });
  const a = animal(db);
  db.prepare(
    "INSERT INTO canva_projects(id,user_id,animal_id,title,format,photo_count,state,designs,created_at) VALUES (?,?,?,'Nala','story',1,'success',?,?)",
  ).run(
    crypto.randomUUID(),
    user.id,
    a,
    JSON.stringify([{ id: "DA-saved" }]),
    new Date().toISOString(),
  );
  const backup = await createBackup(db, c),
    target = path.join(base, "restored-canva");
  await restoreBackup(path.join(c.backupDir, backup.filename), target);
  const restored = new DatabaseSync(
    path.join(target, "data", "anipic.sqlite"),
    { readOnly: true },
  );
  try {
    assert.equal(
      restored.prepare("SELECT designs FROM canva_projects").get().designs,
      JSON.stringify([{ id: "DA-saved" }]),
    );
    for (const table of ["sessions", "canva_connections", "canva_oauth"])
      assert.equal(
        restored.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,
        0,
      );
  } finally {
    restored.close();
  }
});
test("Canva cancellation and incomplete consent cannot create a connection", async (t) => {
  let requests = 0;
  const { app, db } = await fixture(t, {
      ...config,
      canvaFetcher: async () => {
        requests++;
        return json({ ...tokens(), scope: "design:content:write" });
      },
    }),
    { headers } = await login(app, "agent");
  const begin = async () =>
    new URL(
      (
        await app.inject({
          method: "POST",
          url: "/api/canva/connect",
          headers,
          payload: {},
        })
      ).json().url,
    ).searchParams.get("state");
  const denied = await app.inject({
    url: `/api/canva/callback?state=${await begin()}&error=access_denied`,
    headers,
  });
  assert.equal(denied.headers.location, "/?canva=denied#api");
  assert.equal(requests, 0);
  const incomplete = await app.inject({
    url: `/api/canva/callback?state=${await begin()}&code=example`,
    headers,
  });
  assert.equal(incomplete.headers.location, "/?canva=failed#api");
  assert.equal(requests, 1);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM canva_connections").get().n,
    0,
  );
});
test("an uncertain Canva import is not retried and unsafe edit URLs never redirect", async (t) => {
  let requests = 0;
  const { app, db, c } = await fixture(t, {
      ...config,
      canvaFetcher: async (url) => {
        requests++;
        if (url.endsWith("/imports"))
          throw new Error("transport failed with sensitive detail");
        return json({
          design: {
            id: "DA-test",
            urls: { edit_url: "https://attacker.test/steal" },
          },
        });
      },
    }),
    { user, headers } = await login(app, "agent"),
    a = animal(db),
    p = await photo(db, c, a);
  db.prepare("INSERT INTO canva_connections VALUES (?,?,?)").run(
    user.id,
    sealCanva(config, user.id, {
      ...tokens(),
      expires_at: Date.now() + 3600000,
    }),
    new Date().toISOString(),
  );
  const r = await app.inject({
    method: "POST",
    url: "/api/canva/projects",
    headers,
    payload: { animalId: a, photoIds: [p.id] },
  });
  assert.equal(r.statusCode, 408, r.body);
  assert.equal(requests, 1);
  assert.equal(r.body.includes("sensitive detail"), false);
  const project = db.prepare("SELECT * FROM canva_projects").get();
  assert.equal(project.state, "interrupted");
  db.prepare(
    "UPDATE canva_projects SET state='success',designs=? WHERE id=?",
  ).run(JSON.stringify([{ id: "DA-test" }]), project.id);
  const edit = await app.inject({
    url: `/api/canva/projects/${project.id}/edit/DA-test`,
    headers,
  });
  assert.equal(edit.statusCode, 400);
  assert.equal(edit.headers.location, undefined);
});
