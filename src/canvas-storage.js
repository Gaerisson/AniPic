// IndexedDB keeps images out of localStorage and isolates drafts by account.
function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("anipic-canvas", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function canvasDraft(key, value) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(
        "drafts",
        value === undefined ? "readonly" : "readwrite",
      );
      const store = tx.objectStore("drafts");
      const request =
        value === undefined ? store.get(key) : store.put(value, key);
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(tx.error || Error("Brouillon local indisponible."));
    });
  } finally {
    db.close();
  }
}
