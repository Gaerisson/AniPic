#!/usr/bin/env node
import { promises as fs, constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const decode = (s) =>
  s.replace(/\\([0-7]{3})/g, (_, n) => String.fromCharCode(parseInt(n, 8)));
export function mountEntries(info) {
  return info
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [left, right] = line.split(" - "),
        fields = left.split(" "),
        tail = (right || "").split(" ");
      return {
        id: fields[0],
        target: decode(fields[4] || ""),
        type: tail[0],
        source: decode(tail[1] || ""),
      };
    });
}
const inside = (root, candidate) =>
  candidate === root ||
  (!path.relative(root, candidate).startsWith("..") &&
    !path.isAbsolute(path.relative(root, candidate)));
export async function prepareStorage(
  {
    mount,
    root = path.join(mount, "anipic"),
    check = false,
    c8 = false,
    imports = false,
  },
  io = { fs, mountInfo: () => fs.readFile("/proc/self/mountinfo", "utf8") },
) {
  if (!path.isAbsolute(mount) || !path.isAbsolute(root))
    throw Error("Utilisez des chemins absolus.");
  const expected = await io.fs.realpath(mount);
  const location = (name) =>
    io.anchor ? path.join(io.anchor, path.relative(expected, name)) : name;
  if (expected !== path.resolve(mount))
    throw Error("Le point de montage ne doit pas être un lien symbolique.");
  const verify = async (candidate) => {
    const entries = mountEntries(await io.mountInfo());
    const owner = entries
      .filter((m) => inside(m.target, candidate))
      .sort((a, b) => b.target.length - a.target.length)[0];
    if (
      !owner ||
      owner.target !== expected ||
      !["nfs", "nfs4", "cifs", "smb3"].includes(owner.type) ||
      (io.anchorMountId && owner.id !== (await io.anchorMountId()))
    )
      throw Error(
        `NAS absent ou montage différent : ${expected}. Aucune initialisation locale autorisée.`,
      );
    return owner.id;
  };
  const mountId = await verify(expected);
  const guard = async (candidate) => {
    if (!inside(expected, path.resolve(candidate)) || candidate === expected)
      throw Error(
        "Le dossier de stockage doit être situé sous le montage NAS.",
      );
    if ((await verify(candidate)) !== mountId)
      throw Error("Le montage NAS a changé pendant la préparation.");
    let cursor = expected;
    for (const segment of path.relative(expected, candidate).split(path.sep)) {
      cursor = path.join(cursor, segment);
      const st = await io.fs.lstat(location(cursor)).catch((e) => {
        if (e.code === "ENOENT") return null;
        throw e;
      });
      if (st && (!st.isDirectory() || st.isSymbolicLink()))
        throw Error(`Dossier ou lien non autorisé : ${cursor}`);
      if (!st) {
        if (check)
          throw Error(
            `Dossier manquant : ${cursor}. Lancez la préparation sans --check.`,
          );
        if ((await verify(cursor)) !== mountId) throw Error("NAS déconnecté.");
        await io.fs.mkdir(location(cursor), { mode: 0o750 });
      }
    }
  };
  const directories = [
    ["ANIPIC_MEDIA_PATH", "photos"],
    ["ANIPIC_BACKUP_PATH", "backups"],
    ...(c8 ? [["ANIPIC_C8_PATH", "C8"]] : []),
    ...(imports ? [["ANIPIC_IMPORT_PATH", "Import"]] : []),
  ];
  const result = {};
  for (const [key, name] of directories) {
    const directory = path.join(path.resolve(root), name);
    await guard(directory);
    await io.fs.access(
      location(directory),
      constants.R_OK | constants.W_OK | constants.X_OK,
    );
    if (!check) {
      // Exclusive write proves effective UID/GID access without changing existing files.
      const probe = path.join(
        directory,
        `.anipic-check-${process.pid}-${crypto.randomUUID()}`,
      );
      const handle = await io.fs.open(location(probe), "wx", 0o600);
      await handle.close();
      await io.fs.unlink(location(probe));
      if ((await verify(directory)) !== mountId)
        throw Error("NAS déconnecté avant création du marqueur.");
      const marker = path.join(directory, ".anipic-volume");
      const old = await io.fs.lstat(location(marker)).catch((e) => {
        if (e.code === "ENOENT") return null;
        throw e;
      });
      if (old && (!old.isFile() || old.isSymbolicLink()))
        throw Error(`Marqueur non régulier : ${marker}`);
      if (!old) {
        const file = await io.fs.open(location(marker), "wx", 0o640);
        await file.close();
      }
    } else
      await io.fs.access(
        location(path.join(directory, ".anipic-volume")),
        constants.R_OK,
      );
    result[key] = directory;
  }
  return result;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.platform !== "linux")
      throw Error(
        "Préparation à exécuter sur l’hôte Linux du moteur Docker, pas sur le PC ni dans Portainer.",
      );
    const args = process.argv.slice(2),
      option = (key, fallback) => {
        const i = args.indexOf(key);
        return i < 0 ? fallback : args[i + 1];
      };
    if (!option("--mount"))
      throw Error(
        "Usage : sudo node scripts/prepare-storage.mjs --mount /mnt/nas --root /mnt/nas/anipic --uid 1000 --gid 1000 [--with-c8] [--with-import] [--check]",
      );
    const uid = Number(option("--uid", "1000")),
      gid = Number(option("--gid", "1000"));
    if (![uid, gid].every((v) => Number.isInteger(v) && v > 0))
      throw Error("UID/GID numériques non root requis.");
    if (process.getuid() === 0) {
      process.setgroups([]);
      process.setgid(gid);
      process.setuid(uid);
    }
    if (process.getuid() !== uid || process.getgid() !== gid)
      throw Error(
        "Exécutez avec sudo ou avec le même UID/GID que le conteneur.",
      );
    // Keep a handle on the verified filesystem. Even a lazy unmount cannot redirect
    // these writes into the now-uncovered local mountpoint.
    const anchor = await fs.open(option("--mount"), "r");
    let paths;
    try {
      paths = await prepareStorage(
        {
          mount: option("--mount"),
          root: option("--root"),
          check: args.includes("--check"),
          c8: args.includes("--with-c8"),
          imports: args.includes("--with-import"),
        },
        {
          fs,
          mountInfo: () => fs.readFile("/proc/self/mountinfo", "utf8"),
          anchor: `/proc/self/fd/${anchor.fd}`,
          anchorMountId: async () =>
            (await fs.readFile(`/proc/self/fdinfo/${anchor.fd}`, "utf8")).match(
              /^mnt_id:\s*(\d+)/m,
            )?.[1] || "unavailable",
        },
      );
    } finally {
      await anchor.close();
    }
    console.log(
      "Stockage vérifié avec les droits du service. Variables à reporter dans Compose / Portainer :",
    );
    for (const [key, value] of Object.entries(paths))
      console.log(`${key}=${value}`);
  } catch (e) {
    console.error(`Préparation refusée : ${e.message}`);
    process.exitCode = 1;
  }
}
