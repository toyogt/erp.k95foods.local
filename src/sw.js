// Toyo Kombucha ERP — Service Worker
const CACHE_NAME = 'toyo-kombucha-v5';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

// Install: cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches + force takeover
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k))) // Delete ALL old caches, including current version's old caches
    ).then(() => clients.claim())
  );
  self.clients.matchAll().then(clients => {
    clients.forEach(client => client.navigate(client.url));
  });
});

// Fetch: network-first for navigation, cache-first for static assets
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // API / backend calls — always network only, never cache
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/functions')) {
    return;
  }

  // Navigation requests — serve index.html from cache if offline (SPA fallback)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // JS/CSS assets — network-first to prevent stale bundle issues
  if (url.pathname.match(/\.(js|css|mjs)$/)) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Other static assets — cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});