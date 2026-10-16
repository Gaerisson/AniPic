import { promises as fs } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { createRequire } from "node:module";
import { Reader } from "mmdb-lib";
import { normalizedIP, matchesNetwork } from "./ip-access.mjs";
const require = createRequire(import.meta.url),
  readers = new Map();
export const localIP = (ip) =>
  [
    "127.0.0.0/8",
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16",
    "169.254.0.0/16",
    "100.64.0.0/10",
    "::1/128",
    "fc00::/7",
    "fe80::/10",
    "0.0.0.0/8",
  ].some((n) => matchesNetwork(ip, n));
export async function geoReader(c) {
  const file = c.geoipDbPath || path.join(c.dbDir, "geoip.mmdb");
  const stat = await fs.stat(file).catch(() => null),
    key = stat ? file + stat.mtimeMs : "bundled";
  if (!readers.has(key))
    readers.set(
      key,
      (async () => {
        let bytes = await fs.readFile(
          stat
            ? file
            : require.resolve("dbip-city-lite/dbip-city-lite.mmdb.gz"),
        );
        if (bytes[0] === 31 && bytes[1] === 139)
          bytes = gunzipSync(bytes, { maxOutputLength: 350 * 1024 ** 2 });
        const reader = new Reader(bytes);
        return {
          reader,
          updatedAt: new Date(reader.metadata.buildEpoch).toISOString(),
          source: stat ? "custom" : "DB-IP City Lite",
        };
      })(),
    );
  return readers.get(key);
}
export async function geoLocation(c, ip) {
  ip = normalizedIP(ip);
  if (!ip || localIP(ip))
    return {
      local: true,
      country: null,
      city: "",
      region: "",
      continent: "",
      ipVersion: ip?.includes(":") ? 6 : 4,
    };
  try {
    const { reader } = await geoReader(c),
      r = reader.get(ip);
    return {
      local: false,
      country: r?.country?.iso_code || null,
      city: r?.city?.names?.fr || r?.city?.names?.en || "",
      region:
        r?.subdivisions?.[0]?.names?.fr ||
        r?.subdivisions?.[0]?.names?.en ||
        r?.subdivisions?.names?.en ||
        "",
      continent: r?.continent?.names?.fr || r?.continent?.names?.en || "",
      timezone: r?.location?.time_zone || "",
      ipVersion: ip.includes(":") ? 6 : 4,
    };
  } catch {
    return {
      local: false,
      country: null,
      city: "",
      region: "",
      unavailable: true,
      ipVersion: ip.includes(":") ? 6 : 4,
    };
  }
}
export async function registerGeoIP(app, { c, authorized }) {
  app.get("/api/flags/:country", async (req, reply) => {
    const code = String(req.params.country).toLowerCase();
    if (!/^[a-z]{2}$/.test(code)) return reply.code(404).send();
    const file = (() => {
      try {
        return require.resolve("flag-icons/flags/4x3/" + code + ".svg");
      } catch {
        return null;
      }
    })();
    if (!file) return reply.code(404).send();
    return reply
      .header("Cache-Control", "public,max-age=604800")
      .type("image/svg+xml")
      .send(await fs.readFile(file));
  });
  app.get(
    "/api/admin/geoip",
    { preHandler: authorized(["admin"]) },
    async () => {
      const d = await geoReader(c);
      return { source: d.source, updatedAt: d.updatedAt, local: true };
    },
  );
  app.post(
    "/api/admin/geoip",
    { preHandler: authorized(["admin"]) },
    async (req, reply) => {
      const part = await req.file({
        limits: { fileSize: 150 * 1024 ** 2, files: 1 },
      });
      if (!part)
        return reply.code(400).send({ error: "Choisissez une base MMDB." });
      let data = await part.toBuffer();
      if (part.file.truncated)
        return reply.code(413).send({ error: "Base trop volumineuse." });
      if (data[0] === 31 && data[1] === 139)
        data = gunzipSync(data, { maxOutputLength: 350 * 1024 ** 2 });
      const reader = new Reader(data);
      if (!reader.metadata.databaseType)
        return reply.code(400).send({ error: "Base MMDB invalide." });
      const target = c.geoipDbPath || path.join(c.dbDir, "geoip.mmdb");
      await fs.writeFile(target + ".tmp", data, { mode: 0o600 });
      await fs.rename(target + ".tmp", target);
      readers.clear();
      return { ok: true };
    },
  );
}
