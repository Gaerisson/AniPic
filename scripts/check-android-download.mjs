import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import yauzl from "yauzl";
import { androidDownloadSchema } from "../server/android-download.mjs";

export async function checkAndroidDownload(
  base = new URL("../", import.meta.url),
) {
  const meta = androidDownloadSchema.parse(
    JSON.parse(await readFile(new URL("public/android-download.json", base))),
  );
  assert.equal(meta.filename, `AniPic-${meta.version}.apk`);
  const data = await readFile(
    new URL(`public/downloads/${meta.filename}`, base),
  );
  assert.equal(data.length, meta.bytes, "Taille de l’APK incohérente.");
  assert.equal(
    createHash("sha256").update(data).digest("hex"),
    meta.sha256,
    "Empreinte de l’APK incohérente.",
  );
  const sum = await readFile(
    new URL(`public/downloads/${meta.filename}.sha256`, base),
    "utf8",
  );
  assert.equal(sum.trim(), `${meta.sha256}  ${meta.filename}`);
  const association = JSON.parse(
    await readFile(new URL("public/android-assetlinks.json", base)),
  );
  assert.ok(
    association.some(
      (item) =>
        item.target?.package_name === meta.packageId &&
        item.target.sha256_cert_fingerprints.includes(meta.certificateSha256),
    ),
    "Certificat différent du domaine.",
  );
  const native = JSON.parse(
    await readFile(new URL("android/twa-manifest.json", base)),
  );
  assert.equal(native.appVersion, meta.version);
  assert.equal(native.appVersionCode, meta.versionCode);
  assert.equal(native.host, new URL(meta.siteUrl).host);
  const names = await new Promise((resolve, reject) => {
    yauzl.fromBuffer(data, { lazyEntries: true }, (error, zip) => {
      if (error) return reject(error);
      const found = new Set();
      zip.on("error", reject);
      zip.on("entry", (entry) => {
        found.add(entry.fileName);
        zip.readEntry();
      });
      zip.on("end", () => resolve(found));
      zip.readEntry();
    });
  });
  assert.ok(
    names.has("AndroidManifest.xml") && names.has("classes.dex"),
    "Le téléchargement n’est pas une APK Android.",
  );
  assert.ok(
    data.includes(Buffer.from("APK Sig Block 42")),
    "Bloc de signature APK manquant.",
  );
  // Cryptographic verification is performed with apksigner in Android CI;
  // this portable check protects the shipped bytes and metadata from divergence.
  return meta;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const meta = await checkAndroidDownload();
  console.log(
    `APK publique vérifiée : ${meta.filename} · ${meta.bytes} octets · SHA-256 ${meta.sha256}`,
  );
}
