import webpush from "web-push";
import { z } from "zod";
import { id, now, settings } from "./db.mjs";
import { modulesConfig } from "./modules.mjs";
const roles = ["admin", "agent", "editor", "volunteer", "viewer"];
export const notificationDefaults = {
  arrivals: false,
  adoptions: false,
  photos: false,
  planning: false,
};
const preferences = z
  .object({
    arrivals: z.boolean(),
    adoptions: z.boolean(),
    photos: z.boolean(),
    planning: z.boolean(),
  })
  .strict();
const prefs = (db, user) => ({
  ...notificationDefaults,
  ...JSON.parse(
    db
      .prepare("SELECT config FROM notification_preferences WHERE user_id=?")
      .get(user)?.config || "{}",
  ),
});
export function validPushEndpoint(value) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      ([
        "fcm.googleapis.com",
        "updates.push.services.mozilla.com",
        "web.push.apple.com",
      ].includes(u.hostname) ||
        /^[a-z0-9-]+\.notify\.windows\.com$/.test(u.hostname))
    );
  } catch {
    return false;
  }
}
export function notice(db, event) {
  const inserted = db
    .prepare(
      "INSERT OR IGNORE INTO notification_events VALUES (?,?,?,?,?,?,?,?)",
    )
    .run(
      event.id || id(),
      event.kind,
      event.animalId || null,
      event.userId || null,
      event.title.slice(0, 120),
      event.body.slice(0, 300),
      event.url,
      now(),
    );
  if (!inserted.changes) return;
  const key =
    event.id ||
    db
      .prepare("SELECT id FROM notification_events ORDER BY rowid DESC LIMIT 1")
      .get().id;
  for (const s of db
    .prepare("SELECT id,user_id FROM notification_subscriptions")
    .all())
    if (
      (!event.userId || event.userId === s.user_id) &&
      prefs(db, s.user_id)[event.kind]
    )
      db.prepare(
        "INSERT OR IGNORE INTO notification_queue VALUES (?,?,0,?,'pending')",
      ).run(key, s.id, now());
}
function vapid(db) {
  let value = db
    .prepare("SELECT value FROM app_secrets WHERE name='vapid'")
    .get()?.value;
  if (!value) {
    value = JSON.stringify(webpush.generateVAPIDKeys());
    db.prepare("INSERT INTO app_secrets VALUES (?,?)").run("vapid", value);
  }
  return JSON.parse(value);
}
export function collectNotifications(db) {
  const cursorName = "notification_cursor";
  let cursor = db
    .prepare("SELECT value FROM app_secrets WHERE name=?")
    .get(cursorName);
  const current = {
    feed: db.prepare("SELECT COALESCE(MAX(seq),0) n FROM feed_events").get().n,
    photo: db.prepare("SELECT COALESCE(MAX(rowid),0) n FROM photos").get().n,
  };
  if (!cursor) {
    db.prepare("INSERT INTO app_secrets VALUES (?,?)").run(
      cursorName,
      JSON.stringify(current),
    );
    return;
  }
  cursor = JSON.parse(cursor.value);
  for (const e of db
    .prepare(
      "SELECT * FROM feed_events WHERE seq>? AND kind IN ('added','adopted') ORDER BY seq",
    )
    .all(cursor.feed))
    notice(db, {
      id: "feed:" + e.id,
      kind: e.kind === "added" ? "arrivals" : "adoptions",
      animalId: e.animal_id,
      title:
        e.kind === "added" ? "Un nouvel arrivant" : "Une adoption au refuge",
      body: e.name,
      url: "/?app=android#feed",
    });
  for (const p of db
    .prepare(
      "SELECT p.animal_id,a.name,MAX(p.rowid) seq,COUNT(*) n FROM photos p JOIN animals a ON a.id=p.animal_id WHERE p.rowid>? AND p.hidden=0 AND p.deleted_at IS NULL AND p.archived_at IS NULL AND a.archived_at IS NULL GROUP BY p.animal_id",
    )
    .all(cursor.photo))
    notice(db, {
      id: "photos:" + p.animal_id + ":" + p.seq,
      kind: "photos",
      animalId: p.animal_id,
      title: "Nouveaux portraits",
      body: p.name + " · " + p.n + " photo(s)",
      url: "/?app=android#mobilePhotos",
    });
  db.prepare("UPDATE app_secrets SET value=? WHERE name=?").run(
    JSON.stringify(current),
    cursorName,
  );
}
export async function deliverNotifications(db, c) {
  const keys = vapid(db);
  for (const row of db
    .prepare(
      "SELECT q.*,s.subscription,s.user_id,s.token_hash,e.kind,e.animal_id,e.title,e.body,e.url FROM notification_queue q JOIN notification_subscriptions s ON s.id=q.subscription_id JOIN notification_events e ON e.id=q.event_id WHERE q.state='pending' AND q.next_at<=? LIMIT 10",
    )
    .all(now())) {
    const valid = db
      .prepare(
        "SELECT 1 FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1",
      )
      .get(row.token_hash, now());
    const privateAnimal =
      row.animal_id &&
      db
        .prepare("SELECT 1 FROM settings WHERE key='animalTrash:'||?")
        .get(row.animal_id);
    const hiddenPhoto =
      row.kind === "photos" &&
      !db
        .prepare(
          "SELECT 1 FROM photos WHERE animal_id=? AND hidden=0 AND deleted_at IS NULL AND archived_at IS NULL AND rowid=?",
        )
        .get(row.animal_id, Number(row.event_id.split(":").at(-1)));
    if (
      !valid ||
      privateAnimal ||
      hiddenPhoto ||
      (row.kind === "planning" && modulesConfig(db).planning === false) ||
      !prefs(db, row.user_id)[row.kind]
    ) {
      db.prepare(
        "UPDATE notification_queue SET state='cancelled' WHERE event_id=? AND subscription_id=?",
      ).run(row.event_id, row.subscription_id);
      continue;
    }
    try {
      await (c.pushSender || webpush.sendNotification)(
        JSON.parse(row.subscription),
        JSON.stringify({
          id: row.event_id,
          title: row.title,
          body: row.body,
          url: row.url,
        }),
        {
          vapidDetails: {
            subject: "https://anipic.gaerisson.fr/android",
            ...keys,
          },
          TTL: 3600,
          timeout: 8000,
        },
      );
      db.prepare(
        "UPDATE notification_queue SET state='sent' WHERE event_id=? AND subscription_id=?",
      ).run(row.event_id, row.subscription_id);
      db.prepare(
        "UPDATE notification_subscriptions SET last_success=?,last_error=NULL WHERE id=?",
      ).run(now(), row.subscription_id);
    } catch (e) {
      if ([404, 410].includes(e.statusCode))
        db.prepare("DELETE FROM notification_subscriptions WHERE id=?").run(
          row.subscription_id,
        );
      else {
        db.prepare(
          "UPDATE notification_queue SET attempts=attempts+1,next_at=?,state=? WHERE event_id=? AND subscription_id=?",
        ).run(
          new Date(Date.now() + 60000 * 2 ** row.attempts).toISOString(),
          row.attempts >= 2 ? "failed" : "pending",
          row.event_id,
          row.subscription_id,
        );
        db.prepare(
          "UPDATE notification_subscriptions SET last_error=? WHERE id=?",
        ).run("PUSH_DELIVERY_FAILED", row.subscription_id);
      }
    }
  }
}
export async function registerNotifications(app, { db, c, authorized }) {
  const access = { preHandler: authorized(roles) },
    keys = vapid(db);
  collectNotifications(db);
  app.get("/api/notifications/preferences", access, async (req) => ({
    preferences: prefs(db, req.user.id),
    publicKey: keys.publicKey,
    subscriptions: db
      .prepare(
        "SELECT id,created_at,last_success,last_error FROM notification_subscriptions WHERE user_id=?",
      )
      .all(req.user.id),
  }));
  app.put("/api/notifications/preferences", access, async (req) => {
    const v = preferences.parse(req.body);
    db.prepare(
      "INSERT INTO notification_preferences VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET config=excluded.config",
    ).run(req.user.id, JSON.stringify(v));
    return { ok: true };
  });
  app.get("/api/notifications", access, async (req) => {
    collectNotifications(db);
    const p = prefs(db, req.user.id);
    return {
      events: db
        .prepare(
          "SELECT id,kind,title,body,url,created_at FROM notification_events WHERE user_id IS NULL OR user_id=? ORDER BY created_at DESC LIMIT 50",
        )
        .all(req.user.id)
        .filter((e) => p[e.kind]),
    };
  });
  app.post("/api/notifications/subscriptions", access, async (req) => {
    const v = z
      .object({
        endpoint: z
          .url()
          .max(2000)
          .refine(validPushEndpoint, "Service de notification refusé."),
        expirationTime: z.number().nullable().optional(),
        keys: z
          .object({
            p256dh: z.string().regex(/^[\w-]{80,100}$/),
            auth: z.string().regex(/^[\w-]{20,30}$/),
          })
          .strict(),
      })
      .strict()
      .parse(req.body);
    const old = db
      .prepare(
        "SELECT id,user_id,token_hash FROM notification_subscriptions WHERE endpoint=?",
      )
      .get(v.endpoint);
    if (
      old &&
      (old.user_id !== req.user.id || old.token_hash !== req.user.token_hash)
    )
      return { ok: true, requiresResubscribe: true };
    if (
      !old &&
      db
        .prepare(
          "SELECT COUNT(*) n FROM notification_subscriptions WHERE user_id=?",
        )
        .get(req.user.id).n >= 5
    )
      throw Object.assign(
        Error("Cinq appareils maximum. Retirez un ancien appareil."),
        { statusCode: 409 },
      );
    db.prepare(
      "INSERT INTO notification_subscriptions VALUES (?,?,?,?,?,?,NULL,NULL) ON CONFLICT(endpoint) DO UPDATE SET subscription=excluded.subscription,token_hash=excluded.token_hash",
    ).run(
      id(),
      req.user.token_hash,
      req.user.id,
      v.endpoint,
      JSON.stringify(v),
      now(),
    );
    return { ok: true };
  });
  app.delete("/api/notifications/subscriptions/:id", access, async (req) => {
    db.prepare(
      "DELETE FROM notification_subscriptions WHERE id=? AND user_id=?",
    ).run(z.string().uuid().parse(req.params.id), req.user.id);
    return { ok: true };
  });
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      collectNotifications(db);
      await deliverNotifications(db, c);
      db.prepare("DELETE FROM notification_events WHERE created_at<?").run(
        new Date(Date.now() - 30 * 86400000).toISOString(),
      );
    } catch (e) {
      app.log.error(e, "Notifications indisponibles");
    } finally {
      running = false;
    }
  };
  if (c.scheduler !== false) {
    const timer = setInterval(tick, 60000);
    timer.unref();
    app.addHook("onClose", async () => clearInterval(timer));
  }
}
