export const missingInterfaceAsset = (error) =>
  /failed to fetch dynamically imported module|importing a module script failed|chunkloaderror|loading chunk .+ failed/i.test(
    String(error?.message || error || ""),
  );
// Automatic recovery must never become a reload loop, including when storage
// is blocked or unavailable on a TV browser.
export function reserveInterfaceRecovery(storage, clock = Date.now()) {
  try {
    const previous = Number(storage.getItem("anipic-interface-recovery") || 0);
    if (previous > 0 && clock - previous < 120000) return false;
    storage.setItem("anipic-interface-recovery", String(clock));
    return true;
  } catch {
    return false;
  }
}
