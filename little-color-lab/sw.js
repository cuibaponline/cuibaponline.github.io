// Offline support: pages are network-first (so updates show up), everything else
// (three.js, fonts, icons) is cache-first. Bump VERSION to drop old caches.
const VERSION = 'v1';
const CACHE = 'little-color-lab-' + VERSION;
const PRECACHE = [
  './',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './color-dancing/',
  './colored-shadows/',
  './color-hunt/',
  './light-and-color/',
  './paint-mixing/',
  './rainbow-maker/',
  './rainbow-milk/',
  './walking-water/',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('little-color-lab-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
      }
      return res;
    }))
  );
});
