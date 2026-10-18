import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fixture, login } from "./helpers.mjs";
import { checkAndroidDownload } from "../scripts/check-android-download.mjs";

test("public installer ships a real signed APK with matching metadata, checksum, package and domain certificate", async () => {
  const meta = await checkAndroidDownload();
  assert.equal(meta.packageId, "fr.gaerisson.anipic");
});
test("installer and resumable signed download work with global PIN; no route grants access to refuge data", async (t) => {
  const { app } = await fixture(t),
    admin = await login(app);
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: "/api/admin/site-access",
        headers: admin.headers,
        payload: { enabled: true, pin: "714269", networks: [], agentId: "" },
      })
    ).statusCode,
    200,
  );
  const meta = (await app.inject({ url: "/android-download.json" })).json();
  for (const url of ["/android", "/android/", "/android-install.html"]) {
    const page = await app.inject({ url });
    assert.equal(page.statusCode, 200, page.body);
    assert.match(page.headers["content-type"], /text\/html/);
    assert.ok(!page.body.includes("__APK_"));
    assert.ok(page.body.includes(`/downloads/${meta.filename}`));
    assert.ok(page.body.includes(meta.sha256));
    assert.equal(page.headers["set-cookie"], undefined);
  }
  const download = await app.inject({ url: `/downloads/${meta.filename}` });
  assert.equal(download.statusCode, 200, download.body.slice(0, 100));
  assert.match(
    download.headers["content-type"],
    /application\/vnd.android.package-archive/,
  );
  assert.equal(
    download.headers["content-disposition"],
    `attachment; filename="${meta.filename}"`,
  );
  assert.equal(Number(download.headers["content-length"]), meta.bytes);
  assert.equal(
    createHash("sha256").update(download.rawPayload).digest("hex"),
    meta.sha256,
  );
  assert.equal(download.headers["set-cookie"], undefined);
  const head = await app.inject({
    method: "HEAD",
    url: `/downloads/${meta.filename}`,
  });
  assert.equal(head.statusCode, 200);
  assert.equal(head.rawPayload.length, 0);
  const partial = await app.inject({
    url: `/downloads/${meta.filename}`,
    headers: { range: "bytes=0-31" },
  });
  assert.equal(partial.statusCode, 206);
  assert.equal(partial.rawPayload.length, 32);
  assert.ok(partial.rawPayload.equals(download.rawPayload.subarray(0, 32)));
  const sum = await app.inject({ url: `/downloads/${meta.filename}.sha256` });
  assert.equal(sum.statusCode, 200);
  assert.equal(sum.body.trim(), `${meta.sha256}  ${meta.filename}`);
  assert.equal(
    (await app.inject({ url: "/api/animals" })).json().code,
    "SITE_PIN_REQUIRED",
  );
  assert.equal(
    (await app.inject({ url: "/api/adoption-reviews" })).statusCode,
    401,
  );
  for (const file of [
    "signing.json",
    "anipic-release.jks",
    "AniPic-0.0.0.apk",
  ]) {
    assert.equal(
      (await app.inject({ url: "/downloads/" + file })).statusCode,
      404,
    );
  }
});
