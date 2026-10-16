import { promises as fs, createReadStream } from "node:fs";
import { DatabaseSync, backup } from "node:sqlite";
import path from "node:path";
import { createHash } from "node:crypto";
import * as tar from "tar";
import { id, now } from "./db.mjs";
import { assertStorage } from "./config.mjs";
export async function fileHash(filename) {
  const h = createHash("sha256");
  for await (const chunk of createReadStream(filename)) h.update(chunk);
  return h.digest("hex");
}
export async function createBackup(db, c) {
  assertStorage(c);
  const backupId = id();
  const date = now();
  const stage = await fs.mkdtemp(path.join(c.backupDir, ".stage-"));
  const filename = `anipic-${date.replace(/[:.]/g, "-")}-${backupId.slice(0, 8)}.tar.gz`;
  const destination = path.join(c.backupDir, filename);
  try {
    await backup(db, path.join(stage, "anipic.sqlite"));
    const snapshot = new DatabaseSync(path.join(stage, "anipic.sqlite"), {
      readOnly: true,
    });
    const blobs = snapshot
      .prepare("SELECT hash,size FROM blobs ORDER BY hash")
      .all();
    snapshot.close();
    const files = [
      {
        path: "anipic.sqlite",
        sha256: await fileHash(path.join(stage, "anipic.sqlite")),
        size: (await fs.stat(path.join(stage, "anipic.sqlite"))).size,
      },
    ];
    await fs.mkdir(path.join(stage, "media"));
    for (const blob of blobs) {
      const source = path.join(c.mediaDir, blob.hash);
      const out = path.join(stage, "media", blob.hash);
      // NAS originals and NAS backups share blocks where hardlinks are supported.
      try {
        await fs.link(source, out);
      } catch {
        await fs.copyFile(source, out);
      }
      if ((await fileHash(out)) !== blob.hash)
        throw new Error(`Original endommagé : ${blob.hash}`);
      files.push({
        path: `media/${blob.hash}`,
        sha256: blob.hash,
        size: blob.size,
      });
    }
    await fs.writeFile(
      path.join(stage, "manifest.json"),
      JSON.stringify({ schemaVersion: 1, createdAt: date, files }, null, 2),
    );
    await tar.c(
      {
        gzip: true,
        cwd: stage,
        file: destination + ".part",
        portable: true,
        noMtime: true,
      },
      ["manifest.json", ...files.map((f) => f.path)],
    );
    await fs.rename(destination + ".part", destination);
    const checksum = await fileHash(destination);
    const size = (await fs.stat(destination)).size;
    db.prepare("INSERT INTO backups VALUES (?,?,?,?,?)").run(
      backupId,
      filename,
      size,
      checksum,
      date,
    );
    return { id: backupId, filename, size, checksum };
  } finally {
    await fs.rm(stage, { recursive: true, force: true });
    await fs.unlink(destination + ".part").catch(() => {});
  }
}
export async function pruneBackups(db, c, keep) {
  const rows = db
    .prepare("SELECT * FROM backups ORDER BY created_at DESC")
    .all();
  for (const row of rows.slice(keep)) {
    await fs.unlink(path.join(c.backupDir, row.filename)).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
    db.prepare("DELETE FROM backups WHERE id=?").run(row.id);
  }
}
export async function restoreBackup(archive, destination) {
  try {
    await fs.access(destination);
    throw new Error(
      "La destination doit être nouvelle. La restauration ne remplace jamais des données existantes.",
    );
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  let expanded = 0,
    count = 0;
  const seen = new Set();
  await new Promise((resolve, reject) => {
    const input = createReadStream(archive);
    const parser = new tar.Parser({
      strict: true,
      maxDecompressionRatio: 10000,
    });
    parser.on("entry", (entry) => {
      const p = entry.path;
      if (
        !["File", "OldFile"].includes(entry.type) ||
        !(
          p === "manifest.json" ||
          p === "anipic.sqlite" ||
          /^media\/[a-f0-9]{64}$/.test(p)
        ) ||
        seen.has(p)
      ) {
        parser.abort(new Error("Entrée de sauvegarde non sûre."));
        return;
      }
      seen.add(p);
      expanded += entry.size;
      count++;
      if (expanded > 200 * 1024 ** 3 || count > 100000) {
        parser.abort(new Error("Sauvegarde hors budget."));
        return;
      }
      entry.resume();
    });
    parser.on("error", (error) => {
      input.destroy();
      reject(error);
    });
    input.on("error", reject);
    parser.on("end", resolve);
    input.pipe(parser);
  });
  const stage = await fs.mkdtemp(
    path.join(path.dirname(destination), ".restore-"),
  );
  try {
    await tar.x({
      file: archive,
      cwd: stage,
      strict: true,
      preservePaths: false,
      filter: (entry, stat) =>
        seen.has(entry) && ["File", "OldFile"].includes(stat.type),
    });
    const manifest = JSON.parse(
      await fs.readFile(path.join(stage, "manifest.json"), "utf8"),
    );
    if (
      manifest.schemaVersion !== 1 ||
      !Array.isArray(manifest.files) ||
      manifest.files.length !== seen.size - 1
    )
      throw new Error("Manifest invalide.");
    const verified = new Set();
    for (const file of manifest.files) {
      if (
        !seen.has(file.path) ||
        verified.has(file.path) ||
        file.path === "manifest.json"
      )
        throw new Error("Manifest incohérent.");
      const p = path.join(stage, file.path);
      if (
        (await fs.stat(p)).size !== file.size ||
        (await fileHash(p)) !== file.sha256
      )
        throw new Error(`Somme SHA-256 incorrecte : ${file.path}`);
      verified.add(file.path);
    }
    const restored = new DatabaseSync(path.join(stage, "anipic.sqlite"));
    if (
      restored.prepare("PRAGMA integrity_check").get().integrity_check !== "ok"
    )
      throw new Error("SQLite corrompu.");
    // Backups contain password hashes, but never restore active sessions.
    restored.exec("DELETE FROM sessions; DELETE FROM backups;");
    if (
      restored
        .prepare("SELECT 1 FROM sqlite_master WHERE name='site_passes'")
        .get()
    )
      restored.exec("DELETE FROM site_passes;");
    // A restored refresh token may have been rotated since this backup. Reconnect explicitly.
    for (const table of ["canva_oauth", "canva_connections"])
      if (
        restored
          .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
          .get(table)
      )
        restored.exec(`DELETE FROM ${table};`);
    restored.close();
    await fs.mkdir(path.join(stage, "data"));
    await fs.rename(
      path.join(stage, "anipic.sqlite"),
      path.join(stage, "data", "anipic.sqlite"),
    );
    await fs.rename(stage, destination);
    return { files: verified.size, destination };
  } catch (e) {
    await fs.rm(stage, { recursive: true, force: true });
    throw e;
  }
}
