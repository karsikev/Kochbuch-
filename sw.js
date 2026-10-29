const CACHE = 'zusammen-lecker-v1';
const ASSETS = ['./', './index.html', './style.css', './app.js', './firebase-config.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => { const u = new URL(e.request.url); if (u.origin !== self.location.origin || e.request.method !== 'GET') return; e.respondWith(fetch(e.request).then(response => { const clone = response.clone(); caches.open(CACHE).then(c => c.put(e.request, clone)); return response; }).catch(() => caches.match(e.request))); });
