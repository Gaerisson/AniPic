import { test } from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import { fixture, login } from "./helpers.mjs";
import { createBackup, pruneBackups, removeBackup } from "../server/backup.mjs";
import {
  collectorConfig,
  collectInventory,
} from "../server/source-collect.mjs";
import { localWritingIssues } from "../shared/writing-corrections.mjs";
import { leadCompatibilityEmojis } from "../shared/writing-format.mjs";
import {
  canvasTemplates,
  canvasTemplateDocument,
} from "../shared/canvas-templates.mjs";
import {
  canvasFormats,
  validateCanvasDocument,
} from "../shared/canvas-document.mjs";

test("French word boundaries do not invent repetitions inside sécurité émotionnelle; punctuation spacing is ignored", () => {
  for (const input of [
    "sécurité émotionnelle",
    "Sa sécurité émotionnelle est importante.",
    "Un été épatant",
    "Il est arrivé , puis reparti .",
    "É épatant",
    "le\nle",
  ])
    assert.deepEqual(localWritingIssues(input), [], input);
  for (const input of ["le le refuge", "été été", "à à tester", "ÉTÉ été"]) {
    const issues = localWritingIssues(input);
    assert.equal(issues.length, 1, input);
    assert.match(issues[0].message, /Mot répété/);
    assert.equal(input.slice(issues[0].from, issues[0].to), issues[0].before);
  }
});

test("compatibility emojis lead their headings without changing a qualified answer or duplicating existing icons", () => {
  const value =
    "Entente chat : Oui si habitué 🐱\nEntente chien : Non 🐶\n👶 Entente enfant : À tester\nAutre information : reste identique";
  const expected =
    "🐱 Entente chat : Oui si habitué\n🐶 Entente chien : Non\n👶 Entente enfant : À tester\nAutre information : reste identique";
  assert.equal(leadCompatibilityEmojis(value), expected);
  assert.equal(leadCompatibilityEmojis(expected), expected);
});

test("every banner template produces a portable valid Canvas document in every export format", () => {
  assert.ok(canvasTemplates.length >= 9);
  for (const [type] of canvasTemplates)
    for (const format of canvasFormats) {
      const doc = canvasTemplateDocument(type, {
        ...format,
        refuge: "Refuge de Morée",
      });
      assert.doesNotThrow(
        () => validateCanvasDocument(doc),
        type + ":" + format.id,
      );
      assert.equal(
        doc.scene.objects.filter((o) => o.type === "Image").length,
        1,
      );
      assert.equal(doc.scene.objects.at(-1).src, "/spa-logo.png");
      assert.ok(
        doc.scene.objects.every(
          (o) =>
            o.originX === "left" &&
            o.originY === "top" &&
            o.ratioLocked === true,
        ),
      );
      if (type === "duo") {
        assert.equal(
          doc.scene.objects.filter((o) => /^Repère photo [12]$/.test(o.name))
            .length,
          2,
        );
        assert.ok(
          doc.scene.objects.some(
            (o) =>
              o.text === "Refuge de Morée" &&
              !o.name.startsWith("Repère photo"),
          ),
        );
      }
    }
});

const snapshot = () =>
  JSON.stringify({
    schemaVersion: 1,
    fetchedAt: new Date().toISOString(),
    complete: true,
    expectedCount: 1,
    animals: [{ sourceId: "spa:1", name: "Nala", species: "dog" }],
  });
test("transient DNS errors retry the same page within the request budget and a fully checked inventory remains complete", async () => {
  let reads = 0;
  const delays = [],
    events = [];
  const cfg = collectorConfig({
    sourceMode: "json",
    sourceUrl: "https://example.org/animals",
    sourceAttempts: 2,
    sourceDelayMs: 1000,
  });
  const result = await collectInventory(cfg, {
    checkRobots: async () => {},
    delay: async (ms) => delays.push(ms),
    onCheck: (e) => events.push(e),
    fetchText: async () => {
      if (++reads === 1)
        throw Object.assign(Error("getaddrinfo EAI_AGAIN example.org"), {
          code: "EAI_AGAIN",
        });
      return snapshot();
    },
  });
  assert.equal(result.complete, true);
  assert.equal(result.validAttempts, 2);
  assert.deepEqual(result.counts, [1, 1]);
  assert.deepEqual(result.failures, []);
  assert.equal(result.requests, 3);
  assert.ok(delays.includes(500));
  assert.ok(events.some((e) => e.stage === "retry"));
});

test("persistent DNS errors, HTTP errors and exhausted request budgets never become reliable inventories", async () => {
  let reads = 0;
  const cfg = collectorConfig({
    sourceMode: "json",
    sourceUrl: "https://example.org/animals",
    sourceAttempts: 2,
    sourceDelayMs: 1000,
  });
  const io = {
    checkRobots: async () => {},
    delay: async () => {},
    fetchText: async () => {
      reads++;
      throw Object.assign(Error("EAI_AGAIN"), { code: "EAI_AGAIN" });
    },
  };
  await assert.rejects(() => collectInventory(cfg, io), /EAI_AGAIN/);
  assert.equal(reads, 6);
  reads = 0;
  await assert.rejects(
    () => collectInventory({ ...cfg, sourceMaxRequests: 1 }, io),
    /Budget/,
  );
  assert.equal(reads, 1);
  reads = 0;
  await assert.rejects(
    () =>
      collectInventory(cfg, {
        ...io,
        fetchText: async () => {
          reads++;
          throw Error("Source HTTP 503");
        },
      }),
    /503/,
  );
  assert.equal(reads, 2);
});

test("backup age retention preserves the newest restore point and protected originals; manual removal deletes only its own archive", async (t) => {
  const { db, c } = await fixture(t);
  const old = await createBackup(db, c),
    protectedBackup = await createBackup(db, c),
    recent = await createBackup(db, c);
  const expired = new Date(Date.now() - 30 * 86400000).toISOString();
  db.prepare("UPDATE backups SET created_at=? WHERE id IN (?,?)").run(
    expired,
    old.id,
    protectedBackup.id,
  );
  db.prepare("INSERT INTO settings VALUES (?,?)").run(
    "protectedBackup:" + protectedBackup.id,
    "true",
  );
  const result = await pruneBackups(db, c, 30, 7);
  assert.equal(result.removed, 1);
  await assert.rejects(() => access(path.join(c.backupDir, old.filename)), {
    code: "ENOENT",
  });
  await access(path.join(c.backupDir, protectedBackup.filename));
  await access(path.join(c.backupDir, recent.filename));
  await assert.rejects(
    () => removeBackup(db, c, protectedBackup.id),
    (e) => e.statusCode === 409,
  );
  db.prepare("UPDATE backups SET created_at=? WHERE id=?").run(
    expired,
    recent.id,
  );
  assert.equal((await pruneBackups(db, c, 1, 1)).removed, 0);
  await removeBackup(db, c, recent.id);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM backups").get().n, 1);
  await access(path.join(c.backupDir, protectedBackup.filename));
  assert.equal(
    db.prepare("PRAGMA integrity_check").get().integrity_check,
    "ok",
  );
});

test("backup deletion requires admin and CSRF; missing NAS or unsafe filenames preserve records and files", async (t) => {
  const { app, db, c } = await fixture(t),
    a = await login(app),
    agent = await login(app, "agent");
  const backup = await createBackup(db, c),
    url = "/api/admin/backups/" + backup.id;
  for (const [headers, status] of [
    [{}, 401],
    [agent.headers, 403],
    [{ ...a.headers, "x-csrf-token": "wrong" }, 403],
  ])
    assert.equal(
      (await app.inject({ method: "DELETE", url, headers })).statusCode,
      status,
    );
  await assert.rejects(() =>
    removeBackup(
      db,
      {
        ...c,
        requireMarker: true,
        backupDir: path.join(c.backupDir, "nas-offline"),
      },
      backup.id,
    ),
  );
  await access(path.join(c.backupDir, backup.filename));
  assert.ok(db.prepare("SELECT 1 FROM backups WHERE id=?").get(backup.id));
  db.prepare("UPDATE backups SET filename='../unsafe.tar.gz' WHERE id=?").run(
    backup.id,
  );
  await assert.rejects(() => removeBackup(db, c, backup.id), /Chemin/);
  db.prepare("UPDATE backups SET filename=? WHERE id=?").run(
    backup.filename,
    backup.id,
  );
  assert.equal(
    (await app.inject({ method: "DELETE", url, headers: a.headers }))
      .statusCode,
    200,
  );
  await assert.rejects(() => access(path.join(c.backupDir, backup.filename)), {
    code: "ENOENT",
  });
  const saved = await app.inject({
    method: "PUT",
    url: "/api/admin/settings",
    headers: a.headers,
    payload: { backupRetentionDays: 21 },
  });
  assert.equal(saved.statusCode, 200, saved.body);
  assert.equal(saved.json().backupRetentionDays, 21);
});

test("local writing proposals put the subject emoji before the heading and preserve it through persistence", async (t) => {
  const { app, db } = await fixture(t),
    a = await login(app, "agent");
  const result = await app.inject({
    method: "POST",
    url: "/api/writing/generate",
    headers: a.headers,
    payload: {
      name: "Nala",
      mode: "create",
      provider: "local",
      original: "Entente chat : Oui si habitué 🐱\nEntente chien : Non 🐶",
      emojis: true,
    },
  });
  assert.equal(result.statusCode, 200, result.body);
  assert.match(result.json().proposal, /🐱 Entente chat : Oui si habitué/);
  assert.match(result.json().proposal, /🐶 Entente chien : Non/);
  assert.equal(
    db
      .prepare("SELECT proposal FROM writing_drafts WHERE id=?")
      .get(result.json().id).proposal,
    result.json().proposal,
  );
});
