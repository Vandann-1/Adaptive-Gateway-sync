/*
 * service-worker.js - Progressive Offline Service Worker
 * Intercepts network requests and serves cached pages & assets when offline.
 */

const CACHE_NAME = 'learning-hub-cache-v1';

// Essential static shell assets to pre-cache on install
const PRECACHE_ASSETS = [
    '/',
    '/dashboard',
    '/offline',
    '/static/css/style.css',
    '/static/js/app.js',
    '/static/js/offline.js',
    '/static/js/sync.js'
];

self.addEventListener('install', (event) => {
    // Pre-cache application shell
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS).catch((err) => {
                console.warn('Pre-caching warning (non-fatal):', err);
            });
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    // Clean up old caches if any
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;

    // We only intercept GET requests (POST sync requests handled in sync.js)
    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);

    // Network-First with Cache-Fallback strategy for HTML pages and API lesson requests
    event.respondWith(
        fetch(request)
            .then((networkResponse) => {
                // If valid response, clone and cache it for future offline use
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(async () => {
                // Network failed or offline - attempt to serve from browser Cache API
                const cachedResponse = await caches.match(request);
                if (cachedResponse) {
                    return cachedResponse;
                }

                // If requesting an HTML navigation that isn't cached, fall back to offline page
                if (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) {
                    const offlineFallback = await caches.match('/offline');
                    if (offlineFallback) {
                        return offlineFallback;
                    }
                }

                // Return a basic offline JSON response for API calls if not in cache
                if (url.pathname.startsWith('/api/')) {
                    return new Response(
                        JSON.stringify({
                            success: false,
                            offline: true,
                            error: 'You are currently offline and this data is not cached.'
                        }),
                        {
                            status: 503,
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                }

                return new Response('Offline: Content unavailable without network connection.', {
                    status: 503,
                    headers: { 'Content-Type': 'text/plain' }
                });
            })
    );
});
