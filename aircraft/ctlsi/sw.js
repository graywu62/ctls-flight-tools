const CACHE_NAME = 'ctlsi-flight-tools-v2.0.2';
const CORE_ASSETS = [
  './', './index.html', './manifest.json', './assets/WSP_5686-web.webp',
  './CTLSi-common/css/header.css', './CTLSi-common/js/flight-plan-store.js',
  './CTLSi-common/js/tool-draft-store.js', './CTLSi-common/js/form-accessibility.js',
  './CTLSi-common/js/shell-switch.js', './CTLSi-common/js/pwa-register.js',
  './CTLSi-WB/index.html', './CTLSi-WB/css/style.css', './CTLSi-WB/manifest.json',
  './CTLSi-WB/icons/icon.svg', './CTLSi-WB/icons/icon-192.png', './CTLSi-WB/icons/icon-512.png',
  './CTLSi-FUEL/index.html', './CTLSi-FUEL/css/style.css', './CTLSi-FUEL/js/script.js',
  './CTLSi-FUEL/data/pohData.js', './CTLSi-FUEL/manifest.json', './CTLSi-FUEL/icons/icon.svg',
  './CTLSi-FUEL/icons/icon-192.png', './CTLSi-FUEL/icons/icon-512.png',
  './CTLSi-TOL/index.html', './CTLSi-TOL/css/style.css', './CTLSi-TOL/js/script.js',
  './CTLSi-TOL/manifest.json', './CTLSi-TOL/icons/icon.svg',
  './CTLSi-TOL/icons/icon-192.png', './CTLSi-TOL/icons/icon-512.png'
  ,'./CTLSi-CHECK/index.html', './CTLSi-CHECK/css/style.css', './CTLSi-CHECK/js/app.js'
  ,'./CTLSi-CHECK/data/checklistData.js', './CTLSi-CHECK/manifest.json', './CTLSi-CHECK/icons/icon.svg'
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
