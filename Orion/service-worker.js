// Orion — service worker
// Mette in cache solo il "guscio" dell'app (HTML/manifest/icone), così l'app si apre
// all'istante e anche offline. Le notizie invece passano sempre dalla rete: non le
// mettiamo in cache qui, altrimenti rischi di vedere titoli vecchi.

const CACHE_NAME = 'orion-shell-v3'; // v3: le icone si sono spostate in icons/, versione nuova per non tenere in cache i vecchi percorsi
const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
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

// ---------------------------------------------------------------------------
// Notifiche push: arrivano anche ad app chiusa. 'push' le mostra,
// 'notificationclick' apre (o porta in primo piano) Orion sull'articolo.
// ---------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let data = { title: 'Orion', body: 'Nuova notizia disponibile', url: '' };
  try { data = event.data.json(); } catch { /* payload non-JSON: usa i valori di default */ }

  // percorso assoluto: alcuni sistemi non risolvono bene un percorso relativo
  // quando devono mostrare l'icona nella notifica (che non è "nella pagina")
  const iconUrl = new URL('icons/icon-192.png', self.registration.scope).href;

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: iconUrl,
      badge: iconUrl,
      data: { articleUrl: data.url || '' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // apre Orion stessa (non il sito esterno), con l'articolo pronto da aprire dentro l'app
  const articleUrl = event.notification.data?.articleUrl || '';
  const targetUrl = './index.html' + (articleUrl ? '?open=' + encodeURIComponent(articleUrl) : '');
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if ('focus' in w) { w.navigate(targetUrl); return w.focus(); }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
