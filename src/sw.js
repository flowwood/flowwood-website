const VERSION = '__VERSION__';
const PRECACHE = '__PRECACHE__';
const CACHE = `fw-${VERSION}`;
const HASHED = /\.[0-9a-f]{10}\.[a-z0-9]+$/;

self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE))));

self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fw-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);

async function cacheFirst(e, cache) {
  const hit = await cache.match(e.request);
  if (hit) return hit;
  const r = await fetch(e.request);
  if (r.ok) cache.put(e.request, r.clone());
  return r;
}

async function staleWhileRevalidate(e, cache) {
  const cached = await cache.match(e.request, { ignoreSearch: true });
  const network = fetch(e.request).then((r) => {
    if (r.ok) cache.put(e.request, r.clone());
    return r;
  });
  if (cached) {
    e.waitUntil(network.catch(() => {}));
    return cached;
  }
  return network.catch(async () => (await cache.match('/404.html')) || Response.error());
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname === '/sw.js') return;
  e.respondWith(
    caches.open(CACHE).then((cache) => (HASHED.test(url.pathname) ? cacheFirst(e, cache) : staleWhileRevalidate(e, cache))),
  );
});
