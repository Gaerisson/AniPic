import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { id, now } from "./db.mjs";
const scrypt = promisify(scryptCb);
export const hashToken = (token) =>
  createHash("sha256").update(token).digest("hex");
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 ** 2,
  });
  return `${salt}:${Buffer.from(key).toString("hex")}`;
}
export async function verifyPassword(password, stored) {
  const [salt, expected] = stored.split(":");
  const actual = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 ** 2,
  });
  const key = Buffer.from(expected, "hex");
  return key.length === actual.length && timingSafeEqual(actual, key);
}
export async function createUser(db, name, password, role = "admin") {
  const user = { id: id(), name, role };
  db.prepare(
    "INSERT INTO users(id,name,password,role,created_at) VALUES (?,?,?,?,?)",
  ).run(user.id, name, await hashPassword(password), role, now());
  return user;
}
export function createSession(db, userId) {
  const token = randomBytes(32).toString("base64url");
  const csrf = randomBytes(24).toString("base64url");
  db.prepare("INSERT INTO sessions VALUES (?,?,?,?)").run(
    hashToken(token),
    userId,
    csrf,
    new Date(Date.now() + 12 * 3600_000).toISOString(),
  );
  db.prepare("UPDATE users SET last_login_at=? WHERE id=?").run(now(), userId);
  return { token, csrf };
}
export function getSession(db, token) {
  if (!token || token.length > 100) return null;
  return (
    db
      .prepare(
        "SELECT u.id,u.name,u.role,s.csrf,s.token_hash,EXISTS(SELECT 1 FROM google_identities g WHERE g.user_id=u.id) googleAccount,(SELECT hash FROM user_avatars WHERE user_id=u.id) avatarHash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1 AND NOT EXISTS(SELECT 1 FROM google_identities g WHERE g.user_id=u.id AND g.status!='approved')",
      )
      .get(hashToken(token), now()) ?? null
  );
}
