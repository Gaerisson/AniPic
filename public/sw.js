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
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let p;
      try {
        p = event.data.json();
      } catch {
        return;
      }
      let url;
      try {
        url = new URL(p.url, self.location.origin);
        if (url.origin !== self.location.origin || url.pathname !== "/") return;
      } catch {
        return;
      }
      await self.registration.showNotification(
        String(p.title || "AniPic").slice(0, 120),
        {
          body: String(p.body || "").slice(0, 300),
          icon: "/app-icon-192.png",
          badge: "/app-icon-192.png",
          tag: String(p.id || "anipic").slice(0, 160),
          data: { url: url.href },
        },
      );
    })(),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const url = new URL(
        event.notification.data?.url || "/",
        self.location.origin,
      );
      if (url.origin !== self.location.origin || url.pathname !== "/") return;
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.navigate(url.href);
          return client.focus();
        }
      }
      return self.clients.openWindow(url.href);
    })(),
  );
});
