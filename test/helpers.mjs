import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createApp } from "../server/app.mjs";
import { createUser } from "../server/auth.mjs";
import { id, now, feedEvent } from "../server/db.mjs";
export async function fixture(t, overrides = {}) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "anipic-v2-"));
  const app = await createApp({
    dbDir: path.join(base, "db"),
    mediaDir: path.join(base, "media"),
    cacheDir: path.join(base, "cache"),
    backupDir: path.join(base, "backups"),
    origin: "http://localhost:3000",
    scheduler: false,
    ...overrides,
  });
  t.after(async () => {
    await app.close();
    await fs.rm(base, { recursive: true, force: true });
  });
  return { app, db: app.db, c: app.anipicConfig, base };
}
export async function login(app, role = "admin", name = role) {
  const user = await createUser(app.db, name, "fixture password 12345", role);
  const r = await app.inject({
    method: "POST",
    url: "/api/login",
    payload: { name, password: "fixture password 12345" },
  });
  if (r.statusCode !== 200) throw new Error(r.body);
  return {
    user,
    headers: {
      cookie: r.headers["set-cookie"].split(";")[0],
      "x-csrf-token": r.json().user.csrf,
      origin: "http://localhost:3000",
    },
  };
}
export function animal(db, name = "Nala") {
  const value = id();
  db.prepare(
    "INSERT INTO animals(id,name,species,description,source_id,created_at,updated_at) VALUES (?,?,'dog','Fiche SPA',?,?,?)",
  ).run(value, name, "spa:test-" + value, now(), now());
  feedEvent(db, { id: value, name, species: "dog" }, "added");
  return value;
}
export function wav(seconds = 2) {
  const rate = 22050,
    samples = Math.round(rate * seconds),
    b = Buffer.alloc(44 + samples * 2);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    b.writeInt16LE(
      Math.round(
        Math.sin((i / rate) * Math.PI * 2 * 220) *
          1500 *
          Math.min(1, i / 2200, (samples - i) / 2200),
      ),
      44 + i * 2,
    );
  return b;
}

export async function audienceConsent(app,headers){
 const {legalConfig,privacyVersion}=await import('../server/privacy.mjs');
 const {saveSettings}=await import('../server/db.mjs');
 saveSettings(app.db,{legal:{...legalConfig(app.db),analyticsEnabled:true}});
 const result=await app.inject({method:'POST',url:'/api/privacy/consent',headers,payload:{analytics:true,version:privacyVersion}});
 if(result.statusCode!==200)throw Error(result.body);
 return {...headers,cookie:headers.cookie+'; '+result.headers['set-cookie'].split(';')[0]};
}
