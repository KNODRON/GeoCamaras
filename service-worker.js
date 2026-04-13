const CACHE_NAME = "georegistro-v2.1.0";

const APP_ASSETS = [
  "./",
  "./index.html",
  "./login.html",
  "./operador.html",
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
  "./listado.html",
  "./style-listado.css",
  "./js/listado.js",
];

// INSTALAR
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS))
  );
  self.skipWaiting();
});

// ACTIVAR
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

// FETCH
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const isNavigationRequest = event.request.mode === "navigate";

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        if (isNavigationRequest) {
          return caches.match("./operador.html");
        }

        return caches.match("./index.html");
      })
  );
});
