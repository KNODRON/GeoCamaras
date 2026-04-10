const CACHE_NAME = "georegistro-v2.0.0";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./login.html",
  "./operador.html",
  "./admin.html",
  "./style-admin.css",
  "./style-operador.css",
  "./style-login.css",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./js/auth.js",
  "./js/firebase-config.js",
  "./js/guards.js",
  "./js/admin.js",
  "./js/operador.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return networkResponse;
      })
      .catch(() => caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || caches.match("./index.html");
      }))
  );
});
