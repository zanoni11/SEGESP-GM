/* ============================================================
   SEGESP-GM — Service worker
   Guarda em cache só os arquivos do próprio site. Chamadas ao
   Supabase e a CDNs (outra origem) passam direto, sem cache.
   Ao publicar uma versão nova, troque o nome do CACHE.
   ============================================================ */
const CACHE = 'segesp-gm-2026.10.20d';
const ARQUIVOS = [
  './',
  './index.html',
  './supabase.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];
const CAMINHOS = new Set(ARQUIVOS.map(a => new URL(a, self.location).pathname));

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys()
    .then(nomes => Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

// Rede primeiro (para receber atualizações); cache só quando estiver sem internet
self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !CAMINHOS.has(url.pathname)) return;
  ev.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
