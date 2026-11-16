import path from "node:path";
import { promises as fs } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { settings, saveSettings, audit, now } from "./db.mjs";
import { assertStorage } from "./config.mjs";
import { beginMediaWrite } from "./media-maintenance.mjs";

const running = new WeakMap();
const initialized = new WeakSet();
const inside = (base, file) => {
  const relative = path.relative(base, file);
  return (
    relative !== "" &&
    !path.isAbsolute(relative) &&
    relative !== ".." &&
    !relative.startsWith(".." + path.sep)
  );
};
const sameFile = (a, b) =>
  a.dev === b.dev &&
  a.ino === b.ino &&
  a.size === b.size &&
  a.mtimeMs === b.mtimeMs;
const processed = (db, hash) =>
  settings(db).enabledModules?.inbox !== false &&
  !db
    .prepare("SELECT 1 FROM inbox_photos WHERE hash=? AND archived_at IS NULL")
    .get(hash) &&
  !!(
    db.prepare("SELECT 1 FROM photos WHERE hash=? LIMIT 1").get(hash) ||
    db
      .prepare(
        "SELECT 1 FROM inbox_photos WHERE hash=? AND archived_at IS NOT NULL",
      )
      .get(hash)
  );

async function guardedPath(base, relative) {
  const parts = String(relative).replace(/\\/g, "/").split("/");
  if (
    !parts.length ||
    parts.some((part) => !part || part === "." || part === "..") ||
    /^[a-z]:/i.test(relative)
  )
    throw Error("Chemin de dépôt invalide.");
  const full = path.resolve(base, ...parts);
  if (!inside(base, full)) throw Error("Chemin hors du dossier de dépôt.");
  let parent = base;
  for (const part of parts.slice(0, -1)) {
    parent = path.join(parent, part);
    const stat = await fs.lstat(parent);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw Error("Dossier remplacé ou lien symbolique : fichier conservé.");
  }
  if ((await fs.realpath(path.dirname(full))) !== path.dirname(full))
    throw Error("Dossier remplacé : fichier conservé.");
  return full;
}

async function verifiedFile(file, expected, limit) {
  const before = await fs.lstat(file);
  if (!before.isFile() || before.isSymbolicLink() || before.size > limit)
    throw Error("Original remplacé ou invalide : fichier conservé.");
  const handle = await fs.open(file, "r");
  try {
    if (!sameFile(before, await handle.stat()))
      throw Error("Original modifié : fichier conservé.");
    const hash = createHash("sha256");
    let size = 0;
    for await (const chunk of handle.createReadStream({ autoClose: false })) {
      size += chunk.length;
      if (size > limit) throw Error("Original modifié : fichier conservé.");
      hash.update(chunk);
    }
    const after = await handle.stat();
    if (
      hash.digest("hex") !== expected ||
      !sameFile(before, after) ||
      !sameFile(after, await fs.lstat(file))
    )
      throw Error("Contenu modifié : fichier conservé.");
    return after;
  } finally {
    await handle.close();
  }
}

function initialize(db) {
  if (initialized.has(db)) return;
  db.exec(`CREATE TABLE IF NOT EXISTS import_cleanup_pending(
    id TEXT PRIMARY KEY,root TEXT NOT NULL,relative_path TEXT NOT NULL,
    quarantine_name TEXT NOT NULL,hash TEXT NOT NULL,size INTEGER NOT NULL,
    mtime_ms REAL NOT NULL,created_at TEXT NOT NULL);`);
  initialized.add(db);
}

export function cleanupProcessedImports(db, c, hashes = null, user = null) {
  const previous = running.get(db);
  const task = (previous ? previous.catch(() => {}) : Promise.resolve()).then(
    () => cleanup(db, c, hashes, user),
  );
  running.set(db, task);
  return task.finally(() => {
    if (running.get(db) === task) running.delete(db);
  });
}

async function cleanup(db, c, hashes, user) {
  const result = { deleted: 0, modified: 0, errors: [], remaining: false };
  if (!c.importDir || settings(db).enabledModules?.inbox === false)
    return result;
  const wanted = hashes ? new Set(hashes) : null;
  let release;
  const issue = (file, error) => {
    if (result.errors.length < 8)
      result.errors.push({
        file,
        error: ["EACCES", "EPERM", "EROFS"].includes(error.code)
          ? "Dossier de dépôt en lecture seule ou permissions insuffisantes : copie source conservée."
          : error.message,
      });
  };
  try {
    assertStorage(c);
    release = beginMediaWrite(c);
    initialize(db);
    const base = await fs.realpath(c.importDir);
    if (base === path.parse(base).root)
      throw Error("Le dossier de dépôt doit être un dossier dédié.");
    for (const directory of [c.mediaDir, c.dbDir, c.backupDir, c.cacheDir]) {
      const other = await fs.realpath(directory);
      if (base === other || inside(base, other) || inside(other, base))
        throw Error("Le dépôt doit être séparé des dossiers internes AniPic.");
    }
    const copy = async (hash) => {
      if (
        !/^[a-f0-9]{64}$/.test(hash) ||
        !db.prepare("SELECT 1 FROM blobs WHERE hash=?").get(hash)
      )
        throw Error("Copie AniPic absente : source conservée.");
      const media = await fs.realpath(c.mediaDir);
      const file = await guardedPath(media, hash);
      try {
        return await verifiedFile(file, hash, c.maxUploadBytes);
      } catch {
        throw Error("Copie AniPic absente ou endommagée : source conservée.");
      }
    };
    const clear = (job) =>
      db.prepare("DELETE FROM import_cleanup_pending WHERE id=?").run(job.id);
    const paths = async (job) => {
      if (!/^\.anipic-processed-[a-f0-9-]{36}$/.test(job.quarantine_name))
        throw Error("Reprise de nettoyage invalide.");
      const source = await guardedPath(base, job.relative_path);
      const holding = await guardedPath(
        base,
        path.posix.join(
          path.posix.dirname(job.relative_path),
          job.quarantine_name,
        ),
      );
      return { source, holding };
    };
    const restore = async (job, source, holding) => {
      // An exclusive hard link restores without ever overwriting a newer export.
      const stat = await fs.lstat(holding);
      if (!stat.isFile() || stat.isSymbolicLink())
        throw Error(`Fichier remplacé conservé sous ${job.quarantine_name}.`);
      try {
        await fs.link(holding, source);
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        const existing = await fs.lstat(source),
          captured = await fs.lstat(holding);
        if (
          !existing.isFile() ||
          existing.isSymbolicLink() ||
          !sameFile(existing, captured)
        )
          throw Error(
            `Un export plus récent existe. Fichier conservé sous ${job.quarantine_name}.`,
          );
        // A previous attempt may have restored this exact hard link before interruption.
      }
      await paths(job);
      if (!sameFile(await fs.lstat(source), await fs.lstat(holding)))
        throw Error(
          `Un export plus récent existe. Fichier conservé sous ${job.quarantine_name}.`,
        );
      await fs.unlink(holding);
      clear(job);
    };
    const finish = async (job) => {
      const { source, holding } = await paths(job);
      let captured;
      try {
        captured = await fs.lstat(holding);
      } catch (error) {
        if (error.code === "ENOENT") {
          clear(job);
          return;
        }
        throw error;
      }
      let verified;
      try {
        if (
          !processed(db, job.hash) ||
          captured.size !== job.size ||
          captured.mtimeMs !== job.mtime_ms
        )
          throw Error("Fichier modifié ou photo de nouveau à trier.");
        await copy(job.hash);
        await paths(job);
        verified = await verifiedFile(holding, job.hash, c.maxUploadBytes);
        if (
          !processed(db, job.hash) ||
          !sameFile(verified, await fs.lstat(holding))
        )
          throw Error("Photo ou fichier modifié pendant le nettoyage.");
      } catch (error) {
        await restore(job, source, holding);
        result.modified++;
        issue(job.relative_path, error);
        return;
      }
      await fs.unlink(holding);
      clear(job);
      result.deleted++;
    };
    let attempted = 0;
    for (const job of db
      .prepare(
        "SELECT * FROM import_cleanup_pending WHERE root=? ORDER BY created_at LIMIT 201",
      )
      .all(base)) {
      if (attempted++ >= 200) {
        result.remaining = true;
        break;
      }
      try {
        await finish(job);
      } catch (error) {
        issue(job.relative_path, error);
      }
    }
    let visited = 0;
    async function walk(directory, depth = 0) {
      if (depth > 6 || result.remaining) return;
      const dir = await fs.opendir(directory);
      for await (const entry of dir) {
        if (++visited > 10000) {
          result.remaining = true;
          break;
        }
        if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          await walk(full, depth + 1);
          continue;
        }
        if (!entry.isFile() || !/\.(jpe?g|png|webp|avif)$/i.test(entry.name))
          continue;
        const relative = path.relative(base, full).split(path.sep).join("/");
        const key = createHash("sha256")
          .update(base + "\0" + path.relative(base, full))
          .digest("hex");
        const receipt = db
          .prepare("SELECT * FROM import_receipts WHERE source_key=?")
          .get(key);
        if (
          !receipt ||
          (wanted && !wanted.has(receipt.hash)) ||
          !processed(db, receipt.hash)
        )
          continue;
        if (attempted++ >= 200) {
          result.remaining = true;
          break;
        }
        try {
          const source = await guardedPath(base, relative);
          const stat = await fs.lstat(source);
          if (stat.size !== receipt.size || stat.mtimeMs !== receipt.mtime_ms) {
            result.modified++;
            continue;
          }
          const checked = await verifiedFile(
            source,
            receipt.hash,
            c.maxUploadBytes,
          );
          await copy(receipt.hash);
          if (
            !processed(db, receipt.hash) ||
            !sameFile(checked, await fs.lstat(source))
          ) {
            result.modified++;
            continue;
          }
          const job = {
            id: randomUUID(),
            root: base,
            relative_path: relative,
            quarantine_name: `.anipic-processed-${randomUUID()}`,
            hash: receipt.hash,
            size: receipt.size,
            mtime_ms: receipt.mtime_ms,
          };
          db.prepare(
            "INSERT INTO import_cleanup_pending VALUES (?,?,?,?,?,?,?,?)",
          ).run(
            job.id,
            base,
            relative,
            job.quarantine_name,
            job.hash,
            job.size,
            job.mtime_ms,
            now(),
          );
          const { holding } = await paths(job);
          try {
            await fs.rename(source, holding);
          } catch (error) {
            if (!(await fs.lstat(holding).catch(() => null))) clear(job);
            throw error;
          }
          await finish(job);
        } catch (error) {
          issue(relative, error);
        }
      }
    }
    if (!result.remaining) await walk(base);
    result.pending = db
      .prepare("SELECT COUNT(*) n FROM import_cleanup_pending WHERE root=?")
      .get(base).n;
  } catch (error) {
    issue("", error);
  } finally {
    release?.();
  }
  try {
    saveSettings(db, { importCleanupLast: { at: now(), ...result } });
    if (result.deleted || result.errors.length)
      audit(db, user, "import_sources_cleaned", {
        deleted: result.deleted,
        modified: result.modified,
        errors: result.errors.length,
        pending: result.pending || 0,
      });
  } catch {
    /* A successfully committed assignment must remain successful. */
  }
  return result;
}
