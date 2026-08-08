// Omkar Caterers — minimal service worker (needed so browsers offer "Install App")
// This app needs internet to work (it syncs live via Firebase), so we do NOT cache
// or serve pages offline — we only register the service worker to satisfy PWA install rules.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', () => {
  // Intentionally no caching — always go to network, since orders must be live/real-time.
});
