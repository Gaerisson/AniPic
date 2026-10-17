import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { prepareStorage } from "../scripts/prepare-storage.mjs";
import { config } from "../server/config.mjs";
import { storageHealth } from "../server/storage-health.mjs";
test("NAS preparation: simulated remote mount, idempotence, no overwrite, absent mount, permissions and disconnected NAS", async (t) => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "anipic-nas-"));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const mount = await fs.realpath(base),
    root = path.join(mount, "anipic"),
    info = `20 1 0:3 / ${mount.replaceAll(" ", "\\040")} rw - nfs4 nas:/photos rw`;
  const io = { fs, mountInfo: async () => info };
  await assert.rejects(
    prepareStorage(
      { mount, root },
      {
        fs,
        mountInfo: async () =>
          `1 0 0:1 / ${path.parse(mount).root} rw - ext4 /dev/disk rw`,
      },
    ),
    /NAS absent/,
  );
  assert.equal(await fs.stat(root).catch(() => null), null);
  const result = await prepareStorage(
    { mount, root, c8: true, imports: true },
    io,
  );
  assert.equal(Object.keys(result).length, 4);
  const marker = path.join(result.ANIPIC_MEDIA_PATH, ".anipic-volume");
  await fs.writeFile(marker, "existing-marker");
  await fs.writeFile(
    path.join(result.ANIPIC_MEDIA_PATH, "existing.jpg"),
    "keep",
  );
  await prepareStorage({ mount, root, c8: true, imports: true }, io);
  assert.equal(await fs.readFile(marker, "utf8"), "existing-marker");
  await prepareStorage(
    { mount, root, check: true, c8: true, imports: true },
    io,
  );
  await assert.rejects(
    prepareStorage(
      { mount, root: path.join(path.dirname(mount), "outside") },
      io,
    ),
    /situé sous/,
  );
  const deniedFs = {
    ...fs,
    access: async () => {
      throw Object.assign(Error("denied"), { code: "EACCES" });
    },
  };
  await assert.rejects(
    prepareStorage(
      { mount, root: path.join(mount, "denied") },
      { fs: deniedFs, mountInfo: async () => info },
    ),
    { code: "EACCES" },
  );
  assert.equal(
    await fs
      .stat(path.join(mount, "denied", "photos", ".anipic-volume"))
      .catch(() => null),
    null,
  );
  let count = 0;
  await assert.rejects(
    prepareStorage(
      { mount, root: path.join(mount, "disconnected") },
      { fs, mountInfo: async () => (++count < 3 ? info : "") },
    ),
    /NAS|montage/,
  );
  assert.equal(
    await fs
      .stat(path.join(mount, "disconnected", "photos", ".anipic-volume"))
      .catch(() => null),
    null,
  );
  assert.equal(
    await fs.readFile(
      path.join(result.ANIPIC_MEDIA_PATH, "existing.jpg"),
      "utf8",
    ),
    "keep",
  );
});
test("production refuses missing markers before any directory creation; storage health reports C8/Import and read-only failures", async (t) => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "anipic-health-"));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const c = {
    dbDir: path.join(base, "db"),
    cacheDir: path.join(base, "cache"),
    mediaDir: path.join(base, "absent", "photos"),
    backupDir: path.join(base, "absent", "backups"),
    requireMarker: true,
  };
  assert.throws(() => config(c), /Volume de stockage absent/);
  assert.equal(
    await fs.stat(path.join(base, "absent")).catch(() => null),
    null,
  );
  for (const dir of [c.mediaDir, c.backupDir]) {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, ".anipic-volume"), "");
  }
  const rows = await storageHealth(
    { ...c, broadcastDir: path.join(base, "missing-c8"), importDir: base },
    { writeProbe: true },
  );
  assert.equal(rows[0].ok, true);
  assert.equal(rows[1].ok, true);
  assert.equal(rows[2].ok, false);
  assert.equal(rows[3].ok, true);
  await fs.unlink(path.join(c.mediaDir, ".anipic-volume"));
  assert.equal((await storageHealth(c, { writeProbe: true }))[0].ok, false);
  assert.equal((await fs.readdir(c.mediaDir)).length, 0);
});
