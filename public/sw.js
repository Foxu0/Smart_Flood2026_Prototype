const CACHE_NAME = 'smartflood-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/PUBMAT3.png',
  '/rain-bg.png'
];

// ── Install Event: Cache App Shell ───────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installed — Caching App Shell...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// ── Activate Event: Clean Old Caches ─────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activated');
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch Event: Network-First Strategy with Cache Fallback ──────────────────
self.addEventListener('fetch', (event) => {
  // Skip non-GET or cross-origin requests like API/radar tiles for dynamic fetching
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache valid responses for offline availability
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // If network fails (offline), return cached version
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          // Fallback to cached index.html for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// ── Push Event: Background OS Notification Popup ─────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: '🌊 Smart Flood Alert', body: event.data.text() };
  }

  const options = {
    body: data.body || 'Flood threshold breached in Lower Antipolo.',
    icon: '/PUBMAT3.png',
    badge: '/PUBMAT3.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'smartflood-alert-' + (data.level || 'info'),
    renotify: true,
    data: { url: data.url || '/' },
    actions: [{ action: 'open', title: 'Open Portal' }]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '🌊 Smart Flood Alert', options)
  );
});

// ── Notification Click Event: Focus or Open Window ────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destinationUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(destinationUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(destinationUrl);
      }
    })
  );
});
