import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import sharp from "sharp";
import { fixture, login } from "./helpers.mjs";
import { mobileAppLayout, mobileDestinations } from "../shared/mobile-app.mjs";
import { accessForPage } from "../shared/page-access.mjs";
import { publicAsset } from "../server/public-assets.mjs";

test("mobile launch mode is explicit, retains ordinary web navigation and maps adoption privacy to the existing feed rule", () => {
  assert.equal(mobileAppLayout(), false);
  assert.equal(mobileAppLayout({ search: "?app=android" }), true);
  assert.equal(mobileAppLayout({ standalone: true }), true);
  assert.equal(mobileAppLayout({ remembered: true }), true);
  assert.equal(
    mobileAppLayout({ search: "?app=web", remembered: true, standalone: true }),
    false,
  );
  assert.deepEqual(
    mobileDestinations.map((x) => x.page),
    ["mobile", "feed", "mobilePhotos", "collections", "broadcasts"],
  );
  assert.equal(accessForPage("mobileAdoptions", { activity: "team" }), "team");
  assert.equal(
    accessForPage("mobileAdoptions", { activity: "public" }),
    "public",
  );
});
test("installable manifest has working icons, scoped shortcuts and an opaque maskable asset", async () => {
  const manifest = JSON.parse(await publicAsset("manifest.webmanifest"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.start_url, "/?app=android#mobile");
  assert.ok(manifest.shortcuts.some((s) => s.url.endsWith("#broadcasts")));
  for (const icon of manifest.icons) {
    const size = Number(icon.sizes.split("x")[0]),
      b = await publicAsset(icon.src.slice(1)),
      m = await sharp(b).metadata();
    assert.equal(m.width, size);
    assert.equal(m.height, size);
    if (icon.purpose === "maskable")
      assert.equal((await sharp(b).stats()).isOpaque, true);
  }
});
test("mobile public metadata stays installable with global PIN without exposing protected APIs", async (t) => {
  const { app } = await fixture(t),
    admin = await login(app);
  const enabled = await app.inject({
    method: "PUT",
    url: "/api/admin/site-access",
    headers: admin.headers,
    payload: { enabled: true, pin: "714269", networks: [], agentId: "" },
  });
  assert.equal(enabled.statusCode, 200, enabled.body);
  const manifest = await app.inject({ url: "/manifest.webmanifest" });
  assert.equal(manifest.statusCode, 200);
  assert.match(manifest.headers["content-type"], /application\/manifest\+json/);
  assert.equal(manifest.headers["cache-control"], "no-cache");
  const sw = await app.inject({ url: "/sw.js" });
  assert.equal(sw.statusCode, 200);
  assert.equal(sw.headers["service-worker-allowed"], "/");
  assert.equal(sw.headers["cache-control"], "no-cache");
  assert.ok(!sw.body.includes("__ANIPIC_VERSION__"));
  assert.match(sw.body, /anipic-mobile-shell-\d+\.\d+\.\d+/);
  for (const url of [
    "/api/animals",
    "/api/feed",
    "/api/adoption-reviews",
    "/api/broadcasts",
  ]) {
    const r = await app.inject({ url });
    assert.equal(r.statusCode, 401, url);
    assert.equal(r.json().code, "SITE_PIN_REQUIRED");
  }
  const association = await app.inject({ url: "/.well-known/assetlinks.json" });
  assert.equal(association.statusCode, 200);
  assert.match(association.headers["content-type"], /application\/json/);
  const target = association.json()[0].target;
  assert.equal(target.package_name, "fr.gaerisson.anipic");
  assert.match(
    target.sha256_cert_fingerprints[0],
    /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/,
  );
  assert.equal(JSON.stringify(association.json()).includes("password"), false);
});

async function worker() {
  const handlers = new Map(),
    stored = [],
    deleted = [],
    fetched = [];
  let offline = false;
  const context = {
    URL,
    Response,
    self: {
      location: { origin: "https://anipic.example" },
      addEventListener: (name, fn) => handlers.set(name, fn),
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    caches: {
      open: async () => ({ addAll: async (paths) => stored.push(...paths) }),
      keys: async () => ["anipic-mobile-shell-v0", "another-application-cache"],
      delete: async (key) => deleted.push(key),
      match: async (path) =>
        new Response(
          path === "/offline.html" ? "offline public screen" : "public icon",
        ),
    },
    fetch: async (req) => {
      fetched.push(req);
      if (offline) throw Error("network down");
      return new Response("online document");
    },
  };
  vm.runInNewContext(
    await readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    context,
  );
  return {
    handlers,
    stored,
    deleted,
    fetched,
    offline: () => {
      offline = true;
    },
  };
}
test("service worker only caches the public disconnected screen and icon, leaves every authenticated request untouched", async () => {
  const w = await worker();
  let pending;
  w.handlers.get("install")({ waitUntil: (p) => (pending = p) });
  await pending;
  assert.deepEqual(w.stored, [
    "/offline.html",
    "/anipic-icon.svg",
    "/offline-retry.js",
  ]);
  for (const path of [
    "/api/session",
    "/api/animals",
    "/api/adoption-reviews",
    "/api/broadcasts/one/stream",
    "/media/private.jpg",
    "/api/auth/google/callback?code=secret&state=private",
    "/assets/main.js",
  ]) {
    w.handlers.get("fetch")({
      request: {
        url: "https://anipic.example" + path,
        method: "GET",
        mode: "navigate",
      },
      respondWith: () => assert.fail("Private request intercepted: " + path),
    });
  }
  w.handlers.get("fetch")({
    request: {
      url: "https://anipic.example/",
      method: "POST",
      mode: "navigate",
    },
    respondWith: () => assert.fail("Write intercepted"),
  });
  w.handlers.get("fetch")({
    request: {
      url: "https://accounts.google.com/",
      method: "GET",
      mode: "navigate",
    },
    respondWith: () => assert.fail("OAuth origin intercepted"),
  });
  assert.equal(w.fetched.length, 0);
});
test("offline fallback is generic, online navigation stays network-first and cache cleanup preserves other apps", async () => {
  const w = await worker(),
    request = {
      url: "https://anipic.example/?app=android",
      method: "GET",
      mode: "navigate",
    };
  let response;
  w.handlers.get("fetch")({ request, respondWith: (p) => (response = p) });
  assert.equal(await (await response).text(), "online document");
  assert.equal(w.fetched[0], request);
  w.offline();
  w.handlers.get("fetch")({ request, respondWith: (p) => (response = p) });
  assert.equal(await (await response).text(), "offline public screen");
  w.handlers.get("activate")({ waitUntil: (p) => (response = p) });
  await response;
  assert.deepEqual(w.deleted, ["anipic-mobile-shell-v0"]);
});
