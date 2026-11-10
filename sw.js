/* Nosso Sim · Service Worker V3.0
   - Rede primeiro, cache como reserva (mantém o comportamento da V2.1).
   - Instalação RESILIENTE: um arquivo opcional ausente (ex.: fotos privadas no deploy público) não derruba a instalação.
   - Nunca cacheia /api/ (backend opcional da Íris) nem respostas que não sejam 200 same-origin. */
const CACHE = 'nosso-sim-v3-0-iris';
const CORE = [
  './', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './iris/themes.css', './iris/iris.css', './seed/seed-casal.js',
  './iris/core/text.js', './iris/core/schema.js', './iris/core/risk.js', './iris/core/store.js', './iris/core/audit.js', './iris/core/memory.js',
  './iris/core/briefing.js', './iris/core/tools.js', './iris/core/specialists.js', './iris/core/intents.js',
  './iris/voice/mic.js', './iris/voice/stt.js', './iris/voice/tts.js', './iris/voice/remote.js', './iris/voice/native.js', './iris/voice/session.js',
  './iris/ui/dom.js', './iris/ui/charts.js', './iris/ui/orb.js', './iris/ui/settings.js', './iris/ui/panel.js', './iris/ui/live-panels.js', './iris/ui/dashboard.js', './iris/ui/padrinhos-fotos.js', './iris/boot.js',
];
// Opcionais: existem no pacote privado; no deploy público podem não existir.
const OPTIONAL = ['./assets/casal/retrato-do-casal.jpg', './assets/casal/momento-especial.jpg', './assets/casal/noite-juntos.jpg', './assets/casal/capa-do-casal.jpg'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled([...CORE, ...OPTIONAL].map(u => cache.add(u)));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/')) return; // backend da Íris: nunca em cache
  e.respondWith(
    fetch(req).then(r => { if (r.ok && r.type === 'basic') { const clone = r.clone(); caches.open(CACHE).then(c => c.put(req, clone)); } return r; })
      .catch(() => caches.match(req)),
  );
});
