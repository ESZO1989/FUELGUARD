// Service worker de la app del chofer: guarda la interfaz para abrirla sin conexión.
// Las llamadas a /api/ siempre van a la red; la app encola lo que no pudo enviar.
const CACHE = 'fg-chofer-v1';
const SHELL = ['/chofer/', '/chofer/index.html', '/chofer/app.js', '/chofer/styles.css', '/chofer/manifest.webmanifest', '/chofer/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;   // red directa
  if (!url.pathname.startsWith('/chofer')) return;
  // Red primero (para recibir actualizaciones), caché si no hay conexión.
  e.respondWith(fetch(e.request).then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('/chofer/index.html'))));
});
