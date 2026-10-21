export function upgrade312(db) {
  db.exec(`
 CREATE TABLE IF NOT EXISTS app_secrets(name TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS privacy_consents(id TEXT PRIMARY KEY,analytics INTEGER NOT NULL,version TEXT NOT NULL,created_at TEXT NOT NULL,expires_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS session_devices(token_hash TEXT PRIMARY KEY REFERENCES sessions(token_hash) ON DELETE CASCADE,id TEXT UNIQUE NOT NULL,created_at TEXT NOT NULL,last_seen TEXT NOT NULL,ip TEXT NOT NULL,user_agent TEXT NOT NULL,label TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS volunteer_shifts(id TEXT PRIMARY KEY,day TEXT NOT NULL,config TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,created_by TEXT REFERENCES users(id) ON DELETE SET NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,deleted_at TEXT);
 CREATE INDEX IF NOT EXISTS volunteer_shift_day ON volunteer_shifts(day) WHERE deleted_at IS NULL;
 CREATE TABLE IF NOT EXISTS volunteer_signups(shift_id TEXT NOT NULL REFERENCES volunteer_shifts(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,state TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL,PRIMARY KEY(shift_id,user_id));
 CREATE TABLE IF NOT EXISTS volunteer_availability(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,day TEXT NOT NULL,config TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(user_id,day));
 CREATE TABLE IF NOT EXISTS notification_preferences(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,config TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS notification_events(id TEXT PRIMARY KEY,kind TEXT NOT NULL,animal_id TEXT REFERENCES animals(id) ON DELETE CASCADE,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,title TEXT NOT NULL,body TEXT NOT NULL,url TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS notification_subscriptions(id TEXT PRIMARY KEY,token_hash TEXT NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,endpoint TEXT UNIQUE NOT NULL,subscription TEXT NOT NULL,created_at TEXT NOT NULL,last_success TEXT,last_error TEXT);
 CREATE TABLE IF NOT EXISTS notification_queue(event_id TEXT NOT NULL REFERENCES notification_events(id) ON DELETE CASCADE,subscription_id TEXT NOT NULL REFERENCES notification_subscriptions(id) ON DELETE CASCADE,attempts INTEGER NOT NULL DEFAULT 0,next_at TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',PRIMARY KEY(event_id,subscription_id));
 CREATE TABLE IF NOT EXISTS writing_drafts(id TEXT PRIMARY KEY,animal_id TEXT REFERENCES animals(id) ON DELETE SET NULL,user_id TEXT REFERENCES users(id) ON DELETE SET NULL,original TEXT NOT NULL,proposal TEXT NOT NULL,mode TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS display_config(screen_id TEXT PRIMARY KEY REFERENCES display_screens(id) ON DELETE CASCADE,config TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS display_commands(id TEXT PRIMARY KEY,screen_id TEXT NOT NULL REFERENCES display_screens(id) ON DELETE CASCADE,kind TEXT NOT NULL,created_at TEXT NOT NULL,ack_at TEXT);
 CREATE TABLE IF NOT EXISTS display_snapshots(screen_id TEXT PRIMARY KEY REFERENCES display_screens(id) ON DELETE CASCADE,image BLOB NOT NULL,created_at TEXT NOT NULL);
 PRAGMA user_version=22;`);
}
