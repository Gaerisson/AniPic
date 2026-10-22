export function upgrade314(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS canvas_projects(id TEXT PRIMARY KEY,title TEXT NOT NULL,document TEXT NOT NULL,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,shared INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS canvas_project_owner ON canvas_projects(owner_id,updated_at);
    CREATE TABLE IF NOT EXISTS source_deletions(fingerprint TEXT PRIMARY KEY,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS erased_animal_statistics(year INTEGER PRIMARY KEY,adoptions INTEGER NOT NULL DEFAULT 0);
    PRAGMA user_version=24;
  `);
}
