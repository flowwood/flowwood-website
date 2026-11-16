const VERSION = '__VERSION__';
const PAGES = '__PAGES__';
const ASSETS = '__ASSETS__';
const PAGE_CACHE = `fw-pages-${VERSION}`;
const ASSET_CACHE = 'fw-assets';
const HASHED = /\.[0-9a-f]{10}\.[a-z0-9]+$/;
const SCOPE_PATH = new URL('./', location.href).pathname;
const UNCACHED = [`${SCOPE_PATH}admin/`, `${SCOPE_PATH}api/`];
const isMedia = (url) => url.startsWith(`${SCOPE_PATH}media/`);

async function precacheAssets() {
  const cache = await caches.open(ASSET_CACHE);
  const cached = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
  await cache.addAll(ASSETS.filter((u) => !isMedia(u) && !cached.has(u)));
}

async function pruneAssets() {
  const current = new Set(ASSETS);
  const cache = await caches.open(ASSET_CACHE);
  await Promise.all((await cache.keys()).filter((r) => !current.has(new URL(r.url).pathname)).map((r) => cache.delete(r)));
}

const dropOldPageCaches = async () => Promise.all((await caches.keys()).filter((k) => k.startsWith('fw-') && k !== PAGE_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k)));

self.addEventListener('install', (e) => e.waitUntil(Promise.all([caches.open(PAGE_CACHE).then((c) => c.addAll(PAGES)), precacheAssets()])));

self.addEventListener('activate', (e) => e.waitUntil(Promise.all([dropOldPageCaches(), pruneAssets()]).then(() => self.clients.claim())));

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
  return network.catch(async () => (await cache.match(`${SCOPE_PATH}404.html`)) || Response.error());
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname === location.pathname) return;
  if (UNCACHED.some((p) => url.pathname.startsWith(p))) return;
  const hashed = HASHED.test(url.pathname);
  e.respondWith(caches.open(hashed ? ASSET_CACHE : PAGE_CACHE).then((cache) => (hashed ? cacheFirst(e, cache) : staleWhileRevalidate(e, cache))));
});
