import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { randomUUID } from "node:crypto";
export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export function openDb(c) {
  const db = new DatabaseSync(path.join(c.dbDir, "anipic.sqlite"));
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
  );
  const version = db.prepare("PRAGMA user_version").get().user_version;
  if (version > 14) throw new Error("Base créée par une version plus récente.");
  if (version === 0)
    db.exec(`
    BEGIN;
    CREATE TABLE users(id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','editor','viewer')), created_at TEXT NOT NULL);
    CREATE TABLE sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf TEXT NOT NULL, expires_at TEXT NOT NULL);
    CREATE TABLE animals(id TEXT PRIMARY KEY, name TEXT NOT NULL, species TEXT NOT NULL CHECK(species IN ('dog','cat','other')), sex TEXT NOT NULL DEFAULT 'unknown', birth_date TEXT, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'available', archived_at TEXT, cover_id TEXT, source_id TEXT UNIQUE, source_url TEXT, source_seen_at TEXT, missing_count INTEGER NOT NULL DEFAULT 0, tags TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE blobs(hash TEXT PRIMARY KEY, size INTEGER NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, mime TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE photos(id TEXT PRIMARY KEY, animal_id TEXT NOT NULL REFERENCES animals(id), hash TEXT NOT NULL REFERENCES blobs(hash), filename TEXT NOT NULL, caption TEXT NOT NULL DEFAULT '', hidden INTEGER NOT NULL DEFAULT 0, archived_at TEXT, created_at TEXT NOT NULL);
    CREATE INDEX photo_animal ON photos(animal_id, archived_at, hidden);
    CREATE INDEX animal_status ON animals(archived_at, species, name);
    CREATE TABLE collections(id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
    CREATE TABLE collection_photos(collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE, photo_id TEXT NOT NULL REFERENCES photos(id), PRIMARY KEY(collection_id, photo_id));
    CREATE TABLE favorites(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, animal_id TEXT NOT NULL REFERENCES animals(id), PRIMARY KEY(user_id, animal_id));
    CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE audit(id TEXT PRIMARY KEY, user_id TEXT, action TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE jobs(id TEXT PRIMARY KEY, kind TEXT NOT NULL, state TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, finished_at TEXT);
    CREATE TABLE backups(id TEXT PRIMARY KEY, filename TEXT NOT NULL, size INTEGER NOT NULL, checksum TEXT NOT NULL, created_at TEXT NOT NULL);
    PRAGMA user_version=1;
    COMMIT;
  `);
  if (version < 2)
    db.exec(`BEGIN;
    ALTER TABLE animals ADD COLUMN source_scope TEXT;
    ALTER TABLE animals ADD COLUMN breed TEXT NOT NULL DEFAULT '';
    ALTER TABLE animals ADD COLUMN compatibility TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE animals ADD COLUMN source_metadata TEXT NOT NULL DEFAULT '{}';
    PRAGMA user_version=2; COMMIT;`);
  if (version < 3)
    db.exec(
      "BEGIN; ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1; PRAGMA user_version=3; COMMIT;",
    );
  if (version < 4)
    db.exec(`BEGIN;
    ALTER TABLE animals ADD COLUMN departed_at TEXT;
    UPDATE animals SET departed_at=archived_at WHERE archived_at IS NOT NULL;
    CREATE TABLE photo_likes(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, photo_id TEXT NOT NULL REFERENCES photos(id), created_at TEXT NOT NULL, PRIMARY KEY(user_id,photo_id));
    CREATE TABLE shoot_tasks(id TEXT PRIMARY KEY, animal_id TEXT NOT NULL REFERENCES animals(id), title TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', priority TEXT NOT NULL CHECK(priority IN ('low','normal','high','urgent')), state TEXT NOT NULL CHECK(state IN ('todo','progress','done')), created_by TEXT REFERENCES users(id), assigned_to TEXT REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE INDEX task_state ON shoot_tasks(state,priority,updated_at);
    CREATE TABLE feed_events(seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, animal_id TEXT NOT NULL, name TEXT NOT NULL, species TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE ip_rules(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, network TEXT NOT NULL, label TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, UNIQUE(user_id,network));
    CREATE TABLE access_log(id TEXT PRIMARY KEY, user_id TEXT, ip TEXT NOT NULL, method TEXT NOT NULL, path TEXT NOT NULL, status INTEGER NOT NULL, user_agent TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE INDEX access_recent ON access_log(created_at,ip);
    CREATE TABLE video_assets(id TEXT PRIMARY KEY, hash TEXT NOT NULL REFERENCES blobs(hash), filename TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('video','audio')), duration REAL NOT NULL, created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);
    CREATE TABLE video_projects(id TEXT PRIMARY KEY, title TEXT NOT NULL, config TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE video_renders(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES video_projects(id), job_id TEXT, state TEXT NOT NULL, hash TEXT REFERENCES blobs(hash), error TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, finished_at TEXT);
    PRAGMA user_version=4; COMMIT;`);
  if (version < 5)
    db.exec(`BEGIN;
    ALTER TABLE collections ADD COLUMN parent_id TEXT REFERENCES collections(id);
    ALTER TABLE collections ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
    CREATE INDEX album_parent ON collections(parent_id);
    CREATE TABLE album_photos(id TEXT PRIMARY KEY, collection_id TEXT NOT NULL REFERENCES collections(id), hash TEXT NOT NULL REFERENCES blobs(hash), filename TEXT NOT NULL, caption TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, UNIQUE(collection_id,hash));
    PRAGMA user_version=5; COMMIT;`);
  if (version < 6) {
    // Rebuild the CHECK constraint without renaming the original table: all foreign keys keep users as their target.
    db.exec(`PRAGMA foreign_keys=OFF; BEGIN;
      CREATE TABLE users_v6(id TEXT PRIMARY KEY,name TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','editor','agent','viewer')),created_at TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);
      INSERT INTO users_v6 SELECT id,name,password,role,created_at,active FROM users;
      DROP TABLE users; ALTER TABLE users_v6 RENAME TO users;
      CREATE TABLE animal_status_events(id TEXT PRIMARY KEY,animal_id TEXT NOT NULL REFERENCES animals(id),status TEXT NOT NULL,observed_at TEXT);
      CREATE INDEX status_event_year ON animal_status_events(status,observed_at);
      INSERT INTO animal_status_events SELECT id,id,'adopted',NULL FROM animals WHERE status='adopted';
      PRAGMA user_version=6; COMMIT; PRAGMA foreign_keys=ON;`);
    if (db.prepare("PRAGMA foreign_key_check").all().length)
      throw new Error("Migration : référence de compte invalide.");
  }
  if (version < 7)
    db.exec(`BEGIN;
    CREATE TABLE IF NOT EXISTS inbox_photos(id TEXT PRIMARY KEY,hash TEXT UNIQUE NOT NULL REFERENCES blobs(hash),filename TEXT NOT NULL,folder TEXT NOT NULL DEFAULT '',created_by TEXT REFERENCES users(id),created_at TEXT NOT NULL,archived_at TEXT);
    CREATE INDEX IF NOT EXISTS inbox_folder ON inbox_photos(archived_at,folder,created_at);
    CREATE TABLE IF NOT EXISTS import_receipts(source_key TEXT PRIMARY KEY,size INTEGER NOT NULL,mtime_ms REAL NOT NULL,hash TEXT NOT NULL,imported_at TEXT NOT NULL);
    PRAGMA user_version=7; COMMIT;`);
  if (version < 8)
    db.exec(`BEGIN;
    CREATE TABLE IF NOT EXISTS canva_connections(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,tokens TEXT NOT NULL,connected_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS canva_oauth(state_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,session_hash TEXT NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,verifier TEXT NOT NULL,animal_id TEXT REFERENCES animals(id),expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS canva_projects(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,animal_id TEXT NOT NULL REFERENCES animals(id),title TEXT NOT NULL,format TEXT NOT NULL,photo_count INTEGER NOT NULL,state TEXT NOT NULL,remote_job TEXT,designs TEXT NOT NULL DEFAULT '[]',error TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,checked_at TEXT);
    CREATE INDEX IF NOT EXISTS canva_projects_owner ON canva_projects(user_id,animal_id,created_at);
    PRAGMA user_version=8; COMMIT;`);
  if (version < 9)
    transaction(db, () => {
      for (const table of ["video_projects", "video_renders"])
        if (
          !db
            .prepare(`PRAGMA table_info(${table})`)
            .all()
            .some((c) => c.name === "deleted_at")
        )
          db.exec(`ALTER TABLE ${table} ADD COLUMN deleted_at TEXT`);
      db.exec(`CREATE TABLE IF NOT EXISTS team_messages(id TEXT PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,target_user TEXT REFERENCES users(id),target_role TEXT,created_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,expires_at TEXT,deleted_at TEXT);
    CREATE TABLE IF NOT EXISTS message_receipts(message_id TEXT NOT NULL REFERENCES team_messages(id),user_id TEXT NOT NULL REFERENCES users(id),read_at TEXT NOT NULL,PRIMARY KEY(message_id,user_id));
    CREATE TABLE IF NOT EXISTS music_credits(asset_id TEXT PRIMARY KEY REFERENCES video_assets(id),title TEXT NOT NULL,author TEXT NOT NULL,license TEXT NOT NULL,source TEXT NOT NULL);
    PRAGMA user_version=9;`);
    });
  if (version < 10)
    db.exec(`BEGIN;
      CREATE TABLE IF NOT EXISTS photo_comments(id TEXT PRIMARY KEY,photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),body TEXT NOT NULL,x REAL,y REAL,resolved INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS comments_photo ON photo_comments(photo_id,created_at);
      CREATE TABLE IF NOT EXISTS animal_publications(animal_id TEXT PRIMARY KEY REFERENCES animals(id),user_id TEXT NOT NULL REFERENCES users(id),published_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS import_folders(folder TEXT PRIMARY KEY,animal_id TEXT NOT NULL REFERENCES animals(id),updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS animal_changes(seq INTEGER PRIMARY KEY AUTOINCREMENT,animal_id TEXT NOT NULL REFERENCES animals(id),kind TEXT NOT NULL,field TEXT NOT NULL,before_value TEXT,after_value TEXT,observed_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS changes_animal ON animal_changes(animal_id,seq);
      CREATE TABLE IF NOT EXISTS image_fingerprints(hash TEXT PRIMARY KEY REFERENCES blobs(hash),fingerprint TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS duplicate_ignored(pair TEXT PRIMARY KEY,created_at TEXT NOT NULL);
      PRAGMA user_version=10; COMMIT;`);
  if (version < 11)
    db.exec(`BEGIN;
      CREATE TABLE IF NOT EXISTS animal_videos(id TEXT PRIMARY KEY,animal_id TEXT NOT NULL REFERENCES animals(id),asset_id TEXT NOT NULL REFERENCES video_assets(id),caption TEXT NOT NULL DEFAULT '',show_on_tv INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,UNIQUE(animal_id,asset_id));
      CREATE INDEX IF NOT EXISTS animal_video_idx ON animal_videos(animal_id,show_on_tv);
      CREATE TABLE IF NOT EXISTS media_tags(kind TEXT NOT NULL CHECK(kind IN ('photo','video')),media_id TEXT NOT NULL,tag TEXT NOT NULL,PRIMARY KEY(kind,media_id,tag));
      CREATE INDEX IF NOT EXISTS media_tag_search ON media_tags(tag,kind);
      CREATE TABLE IF NOT EXISTS motion_exports(id TEXT PRIMARY KEY,title TEXT NOT NULL,config TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),job_id TEXT,state TEXT NOT NULL,hash TEXT REFERENCES blobs(hash),error TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,finished_at TEXT);
      PRAGMA user_version=11; COMMIT;`);
  if (version < 12)
    db.exec(`BEGIN;
      CREATE TABLE IF NOT EXISTS visits(id TEXT PRIMARY KEY,session_hash TEXT NOT NULL,ip TEXT NOT NULL,country TEXT,path TEXT NOT NULL,user_agent TEXT NOT NULL,user_id TEXT,created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS visits_recent ON visits(created_at,session_hash);
      PRAGMA user_version=12; COMMIT;`);
  if (version < 13)
    db.exec(`BEGIN;
    CREATE TABLE IF NOT EXISTS site_passes(token_hash TEXT PRIMARY KEY,expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ip_sessions(token_hash TEXT PRIMARY KEY REFERENCES sessions(token_hash) ON DELETE CASCADE,network TEXT NOT NULL);
    PRAGMA user_version=13; COMMIT;`);
  if (version < 14)
    db.exec(
      `BEGIN;CREATE TABLE IF NOT EXISTS source_photo_matches(animal_id TEXT PRIMARY KEY REFERENCES animals(id) ON DELETE CASCADE,signature TEXT NOT NULL,result TEXT NOT NULL,checked_at TEXT NOT NULL);PRAGMA user_version=14;COMMIT;`,
    );
  db.prepare("DELETE FROM site_passes WHERE expires_at < ?").run(now());
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now());
  db.prepare("DELETE FROM canva_oauth WHERE expires_at < ?").run(now());
  return db;
}
export function transaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
import { sourceDefaults, interfaceDefaults } from "./preferences-schema.mjs";
export const defaults = {
  importAutoEnabled: false,
  importIntervalMinutes: 5,
  importStableSeconds: 10,
  publicHistoryEnabled: true,
  displayEnabled: false,
  displaySeconds: 9,
  displayHiddenIds: [],
  displaySpaPhotos: false,
  displayReserved: false,
  displayQr: true,
  ...sourceDefaults,
  ...interfaceDefaults,
  refugeName: "Refuge de Morée",
  authorGithubUrl: "https://github.com/Gaerisson/",
  subtitle: "Une photo peut tout changer.",
  cacheMB: 512,
  thumbQuality: 78,
  syncIntervalHours: 0,
  missingThreshold: 3,
  sourceMode: "disabled",
  sourceUrl: "",
  archiveMissing: false,
  backupIntervalHours: 24,
  backupKeep: 7,
  themeDefault: "night",
  accentColor: "#f4ab70",
  compactUI: true,
  tiltIntensity: 25,
  reflectionIntensity: 15,
  glowIntensity: 65,
  showCarousel: true,
  showWeather: true,
  showClock: true,
  carouselSeconds: 6,
  cardsPerPage: 24,
  geminiModel: "",
  tokenharborModel: "",
};
export function settings(db) {
  return {
    ...defaults,
    ...Object.fromEntries(
      db
        .prepare("SELECT key,value FROM settings")
        .all()
        .map((r) => [r.key, JSON.parse(r.value)]),
    ),
  };
}
export function saveSettings(db, values) {
  transaction(db, () => {
    for (const [key, value] of Object.entries(values))
      db.prepare(
        "INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      ).run(key, JSON.stringify(value));
  });
}
export function audit(db, user, action, detail = {}) {
  db.prepare("INSERT INTO audit VALUES (?,?,?,?,?)").run(
    id(),
    user?.id ?? null,
    action,
    JSON.stringify(detail),
    now(),
  );
}
export function feedEvent(db, animal, kind) {
  db.prepare(
    "INSERT INTO feed_events(id,animal_id,name,species,kind,status,created_at) VALUES (?,?,?,?,?,?,?)",
  ).run(
    id(),
    animal.id,
    animal.name,
    animal.species,
    kind,
    animal.status || "available",
    now(),
  );
}
