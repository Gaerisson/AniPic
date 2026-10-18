// Deliberately no API, authenticated page, photo, video, token or cookie cache.
const CACHE = "anipic-mobile-shell-__ANIPIC_VERSION__";
const PUBLIC_FILES = ["/offline.html", "/anipic-icon.svg", "/offline-retry.js"];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PUBLIC_FILES))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("anipic-mobile-shell-") && key !== CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin)
    return;
  if (PUBLIC_FILES.includes(url.pathname) && !url.search) {
    event.respondWith(
      fetch(event.request).catch(
        async () => (await caches.match(url.pathname)) || Response.error(),
      ),
    );
    return;
  }
  if (event.request.mode !== "navigate" || url.pathname !== "/") return;
  event.respondWith(
    fetch(event.request).catch(
      async () => (await caches.match("/offline.html")) || Response.error(),
    ),
  );
});
