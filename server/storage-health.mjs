import { promises as fs, constants } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
export async function storageHealth(c, { writeProbe = false } = {}) {
  const rows = [
    ["media", "Photos", c.mediaDir, true],
    ["backup", "Sauvegardes", c.backupDir, true],
    ["c8", "C8", c.broadcastDir, false],
    ["import", "Import", c.importDir, false],
  ];
  return Promise.all(
    rows.map(async ([key, label, directory, writable]) => {
      if (!directory) return { key, label, configured: false, ok: null };
      let readable = false,
        writeable = false,
        marker = false;
      try {
        const stat = await fs.stat(directory);
        if (!stat.isDirectory())
          throw Error("Le chemin ne désigne pas un dossier.");
        if (writable && c.requireMarker) {
          const m = await fs.lstat(path.join(directory, ".anipic-volume"));
          if (!m.isFile() || m.isSymbolicLink())
            throw Error("Marqueur NAS invalide.");
          marker = true;
        }
        await fs.access(directory, constants.R_OK | constants.X_OK);
        readable = true;
        if (writable) {
          await fs.access(directory, constants.W_OK);
          writeable = true;
          if (writeProbe) {
            const probe = path.join(
              directory,
              `.anipic-health-${randomUUID()}`,
            );
            const handle = await fs.open(probe, "wx", 0o600);
            await handle.close();
            await fs.unlink(probe);
          }
        } else {
          const dir = await fs.opendir(directory);
          await dir.close();
        }
        return {
          key,
          label,
          path: directory,
          configured: true,
          ok: true,
          readable,
          writable: writeable,
          marker,
          mode: writable ? "lecture/écriture" : "lecture seule",
        };
      } catch (e) {
        return {
          key,
          label,
          path: directory,
          configured: true,
          ok: false,
          readable,
          writable: writeable,
          marker,
          error: ["ENOENT", "ESTALE", "EIO", "ETIMEDOUT"].includes(e.code)
            ? "NAS ou dossier absent/inaccessible. Vérifiez le montage sur l’hôte Docker."
            : e.code === "EACCES"
              ? "Permissions insuffisantes pour l’UID/GID du service."
              : e.message,
        };
      }
    }),
  );
}
export async function registerStorageHealth(app, { c, authorized }) {
  app.get(
    "/api/admin/storage/health",
    { preHandler: authorized(["admin"]) },
    () => storageHealth(c),
  );
  app.post(
    "/api/admin/storage/check",
    { preHandler: authorized(["admin"]) },
    () => storageHealth(c, { writeProbe: true }),
  );
}
