const CACHE_VERSION = 'boo-p-webapp-v1';
const APP_SHELL = [
  './',
  './index.html',
  './app.html',
  './onboarding.html',
  './manifest.webmanifest',
  './css/animations.css',
  './css/base.css',
  './css/components.css',
  './css/landing.css',
  './css/mvp-v5.css',
  './css/screens.css',
  './css/tokens.css',
  './js/auth.js',
  './js/community-api.js',
  './js/landing.js',
  './js/mvp-app.js',
  './js/onboarding.js',
  './js/pwa.js',
  './js/speech.js',
  './js/store.js',
  './js/supabase-config.js',
  './assets/brand/closed-book-proposals/boo-p-closed-01-signet.png',
  './assets/community/boo-p-reading-moments-sprite-v1.png',
  './assets/icons/boo-p-apple-touch-icon.png',
  './assets/icons/boo-p-icon-192.png',
  './assets/icons/boo-p-icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request, { ignoreSearch: true })) || caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => {
      const network = fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(request, copy));
        }
        return response;
      });
      return cached || network;
    })
  );
});
