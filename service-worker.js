// Orion — service worker
// Mette in cache solo il "guscio" dell'app (HTML/manifest/icone), così l'app si apre
// all'istante e anche offline. Le notizie invece passano sempre dalla rete: non le
// mettiamo in cache qui, altrimenti rischi di vedere titoli vecchi.

const CACHE_NAME = 'orion-shell-v2';
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

  // la pagina HTML (index.html): rete PRIMA di tutto, per non restare mai
  // bloccati su una versione vecchia dopo un aggiornamento. La cache è solo
  // il paracadute per quando non c'è connessione.
  const isHTML = event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  if (isHTML) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // il resto (icone/manifest, che cambiano di rado): cache prima, rete come ripiego
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
