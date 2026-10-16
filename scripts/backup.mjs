import { config } from "../server/config.mjs";
import { openDb } from "../server/db.mjs";
import { createBackup } from "../server/backup.mjs";
const db = openDb(config());
try {
  console.log(JSON.stringify(await createBackup(db, config()), null, 2));
} finally {
  db.close();
}
