import { displayHeartbeatMs } from "../shared/display-monitor.mjs";
const storageKey = "anipic-tv-screen-v1";
function newIdentity(cryptoAPI) {
  const bytes = cryptoAPI.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map((n) => n.toString(16).padStart(2, "0")).join("");
  const id = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
  const token = btoa(
    String.fromCharCode(...cryptoAPI.getRandomValues(new Uint8Array(32))),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return { id, token };
}
export function displayIdentity({
  local,
  session,
  cryptoAPI = globalThis.crypto,
  reset = false,
} = {}) {
  for (const [store, persistent] of [
    [local, true],
    [session, false],
  ]) {
    try {
      if (!store) continue;
      const saved = reset
        ? null
        : JSON.parse(store.getItem(storageKey) || "null");
      if (
        saved &&
        /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(saved.id) &&
        /^[A-Za-z0-9_-]{43}$/.test(saved.token)
      )
        return { ...saved, persistent };
      const identity = newIdentity(cryptoAPI);
      store.setItem(storageKey, JSON.stringify(identity));
      return { ...identity, persistent };
    } catch {}
  }
  return { ...newIdentity(cryptoAPI), persistent: false };
}
export function playbackTelemetry(clock = () => performance.now()) {
  let syncedAt = null,
    fetchError = false,
    progressAt = clock(),
    cursor = null;
  let player = { state: "starting", revision: "", scene: null, issues: [] };
  return {
    sync() {
      syncedAt = clock();
      fetchError = false;
    },
    failed() {
      fetchError = true;
    },
    player(next) {
      if (next.cursor !== cursor || next.state !== "playing")
        progressAt = clock();
      cursor = next.cursor;
      player = { ...player, ...next };
    },
    snapshot(environment) {
      const age = (since) =>
        Math.min(7 * 86400000, Math.max(0, Math.round(clock() - since)));
      return {
        ...environment,
        state: player.state,
        revision: player.revision || "",
        scene: player.scene,
        syncAgeMs: syncedAt === null ? null : age(syncedAt),
        progressAgeMs: age(progressAt),
        issues: [
          ...new Set([
            ...(player.issues || []),
            ...(fetchError ? ["programme_fetch"] : []),
          ]),
        ],
      };
    },
  };
}
export async function postDisplayHeartbeat(
  identity,
  status,
  { fetcher = globalThis.fetch, keepalive = false } = {},
) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetcher("/api/public/display/heartbeat", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
      keepalive,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: identity.id,
        token: identity.token,
        ...status,
        persistent: identity.persistent,
      }),
    });
    const data = await response.json();
    if (!response.ok)
      throw Object.assign(new Error(data.error || "Suivi TV indisponible."), {
        status: response.status,
      });
    return data;
  } finally {
    clearTimeout(timer);
  }
}
export { displayHeartbeatMs };
