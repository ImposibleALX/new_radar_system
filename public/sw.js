const CACHE_VERSION = "sensor-sandbox-v6";
const INDEX_FALLBACK = "./index.html";
const APP_SHELL = [INDEX_FALLBACK];

function isCacheable(response) {
  return !!response && (response.status === 200 || response.status === 0);
}

function cloneForCache(response) {
  if (!response || response.bodyUsed) return null;
  try {
    return response.clone();
  } catch (error) {
    console.warn("[SW] Skipping cache clone for response:", error);
    return null;
  }
}

async function putInCache(cacheKey, response) {
  if (!isCacheable(response)) return;
  const clone = cloneForCache(response);
  if (!clone) return;
  const cache = await caches.open(CACHE_VERSION);
  await cache.put(cacheKey, clone);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          event.waitUntil(putInCache(INDEX_FALLBACK, response));
          return response;
        } catch (_error) {
          const cached = await caches.match(INDEX_FALLBACK);
          return cached || new Response("Offline", { status: 503, statusText: "Offline" });
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cached = await cache.match(request);

      const networkFetch = fetch(request)
        .then((response) => {
          event.waitUntil(putInCache(request, response));
          return response;
        })
        .catch(() => undefined);

      if (cached) {
        event.waitUntil(networkFetch.then(() => undefined).catch(() => undefined));
        return cached;
      }

      const networkResponse = await networkFetch;
      if (networkResponse) return networkResponse;
      return new Response("Not Found", { status: 404, statusText: "Not Found" });
    })()
  );
});
