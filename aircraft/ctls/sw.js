const CACHE_NAME = 'ctls-flight-tools-v3.0.5';
const CORE_ASSETS = [
  './', './index.html', './manifest.json', './assets/WSP_5686-web.webp',
  './CTLS-common/css/header.css', './CTLS-common/js/flight-plan-store.js',
  './CTLS-common/js/tool-draft-store.js', './CTLS-common/js/form-accessibility.js',
  './CTLS-common/js/shell-switch.js', './CTLS-common/js/pwa-register.js',
  './CTLS-WB/index.html', './CTLS-WB/css/style.css', './CTLS-WB/manifest.json',
  './CTLS-WB/icons/icon.svg', './CTLS-WB/icons/icon-192.png', './CTLS-WB/icons/icon-512.png',
  './CTLS-FUEL/index.html', './CTLS-FUEL/css/style.css', './CTLS-FUEL/js/script.js',
  './CTLS-FUEL/data/pohData.js', './CTLS-FUEL/manifest.json', './CTLS-FUEL/icons/icon.svg',
  './CTLS-FUEL/icons/icon-192.png', './CTLS-FUEL/icons/icon-512.png',
  './CTLS-TOL/index.html', './CTLS-TOL/css/style.css', './CTLS-TOL/js/script.js',
  './CTLS-TOL/manifest.json', './CTLS-TOL/icons/icon.svg',
  './CTLS-TOL/icons/icon-192.png', './CTLS-TOL/icons/icon-512.png',
  './CTLS-CHECK/index.html', './CTLS-CHECK/css/style.css', './CTLS-CHECK/js/app.js',
  './CTLS-CHECK/data/checklistData.js', './CTLS-CHECK/manifest.json', './CTLS-CHECK/icons/icon.svg'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html'))));
});
