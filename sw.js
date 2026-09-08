const CACHE_NAME = 'ct-flight-tools-hub-v1.0.0';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './aircraft-selector.js',
  './pwa-register.js',
  './assets/aircraft-ctls-line.png',
  './assets/aircraft-ctlsi-line.png',
  './aircraft/ctls/CTLS-WB/icons/icon-192.png',
  './aircraft/ctls/CTLS-WB/icons/icon-512.png',
  './aircraft/ctls/CTLS-WB/icons/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('ct-flight-tools-hub-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response && response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html'))));
});
