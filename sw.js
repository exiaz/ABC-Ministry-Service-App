const CACHE = 'abc-school-v8';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './data.js', './student-data.js', './birthdays.js', './birthday-ui.js', './xlsx-reader.js', './student-import.js', './dates.js', './group-config.js', './service-config.js', './scheduling.js', './service-ui.js', './reports.js', './mentor-config.js', './assignments.js', './assignment-ui.js', './xlsx.js', './icon.svg', './manifest.webmanifest', './assets/abc-movement-logo.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('abc-school-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && ASSETS.some(path => new URL(path, self.location).href === event.request.url)) {
      const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
    }
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || (event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
