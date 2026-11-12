/* Rocket's Starship Garage — static asset cache.
   Game saves stay in the page's localStorage and are never touched here. */
const CACHE = "rockets-starship-garage-v3";

const PRECACHE = [
  "index.html",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
  "icon-maskable-192.png",
  "icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const scope = self.registration.scope;
      await Promise.all(
        PRECACHE.map(async (path) => {
          const url = new URL(path, scope).href;
          const response = await fetch(url, { cache: "reload" });
          if (!response.ok) throw new Error("precache failed for " + path);
          await cache.put(url, response);
        })
      );
      const index = await cache.match(new URL("index.html", scope).href);
      if (index) {
        await cache.put(new URL("./", scope).href, index.clone());
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(respond(event));
});

async function respond(event) {
  const request = event.request;
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });

  const update = fetch(request)
    .then((response) => {
      if (
        response &&
        response.ok &&
        new URL(request.url).origin === self.location.origin
      ) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(update.then(() => undefined));
    return cached;
  }

  const fresh = await update;
  if (fresh) return fresh;

  if (request.mode === "navigate") {
    const scope = self.registration.scope;
    const fallback =
      (await cache.match(new URL("index.html", scope).href)) ||
      (await cache.match(new URL("./", scope).href));
    if (fallback) return fallback;
  }

  return new Response("Offline", {
    status: 503,
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
  });
}
