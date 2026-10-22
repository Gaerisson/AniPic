export function upgrade313(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS display_live(screen_id TEXT PRIMARY KEY REFERENCES display_screens(id) ON DELETE CASCADE,interval_seconds INTEGER NOT NULL,expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS team_polls(id TEXT PRIMARY KEY,config TEXT NOT NULL,created_by TEXT REFERENCES users(id) ON DELETE SET NULL,created_at TEXT NOT NULL,closed_at TEXT);
    CREATE TABLE IF NOT EXISTS team_poll_votes(poll_id TEXT NOT NULL REFERENCES team_polls(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,choices TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(poll_id,user_id));
    PRAGMA user_version=23;
  `);
}
