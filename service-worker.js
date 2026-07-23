// Orion — service worker
// Mette in cache solo il "guscio" dell'app (HTML/manifest/icone), così l'app si apre
// all'istante e anche offline. Le notizie invece passano sempre dalla rete: non le
// mettiamo in cache qui, altrimenti rischi di vedere titoli vecchi.

const CACHE_NAME = 'orion-shell-v1';
const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // le chiamate all'API del feed vanno sempre in rete (notizie sempre fresche)
  if (url.pathname.includes('/api/')) return;

  // il resto (guscio dell'app): prova la cache, altrimenti rete
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
