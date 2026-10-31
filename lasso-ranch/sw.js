// Offline support: pages and JS/CSS are network-first (so updates show up) and fall back to the cache;
// everything else is cache-first. Bump VERSION to drop old caches.
const VERSION = 'v2';
const CACHE = 'lasso-ranch-' + VERSION;
const PRECACHE = [
  './',
  './style.css',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './src/art.js',
  './src/audio.js',
  './src/data.js',
  './src/main.js',
  './src/render.js',
  './src/save.js',
  './src/screens.js',
  './src/sim.js',
  './src/strings.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('lasso-ranch-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const fresh = req.mode === 'navigate' || /\.(js|css)$/.test(url.pathname);
  if (fresh) {
    event.respondWith(
      fetch(req, req.mode === 'navigate' ? undefined : { cache: 'no-cache' })
        .then((res) => {
          if (res.ok) { const copy = res.clone(); event.waitUntil(caches.open(CACHE).then((cache) => cache.put(req, copy))); }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true })
          .then((hit) => hit || (req.mode === 'navigate' ? caches.match('./') : Response.error())))
    );
    return;
  }

  event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
