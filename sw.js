// =====================================================================
// SERVICE WORKER · App instalable (PWA) · 2026-11-16 · sin internet 2026-11-19
// Pantallas del sistema: "primero la red": si hay internet SIEMPRE carga la versión nueva (después de cada Push);
// solo si no hay señal usa la copia guardada.
// Librerías de internet (Vue, Tailwind, íconos, Supabase JS…): se guardan la primera vez y sin señal se usan
// desde el equipo (2026-11-19, para que la app de técnicos abra sin internet).
// Los DATOS los maneja js/core/offline.js (Supabase no pasa por aquí).
// =====================================================================
const CACHE = 'frc-control-v2';
const CACHE_CDN = 'frc-cdn-v1';
const HOSTS_CDN = ['cdn.tailwindcss.com', 'cdnjs.cloudflare.com', 'unpkg.com', 'cdn.jsdelivr.net', 'cdn.sheetjs.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE && k !== CACHE_CDN) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    if (!HOSTS_CDN.includes(url.hostname)) return;   // Supabase, imágenes externas: normal
    // Librerías con versión fija: se usa la guardada y se actualiza en segundo plano
    e.respondWith((async () => {
      const c = await caches.open(CACHE_CDN);
      const guardado = await c.match(req);
      const red = fetch(req).then((res) => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => null);
      if (guardado) { e.waitUntil(red); return guardado; }
      return (await red) || Response.error();
    })());
    return;
  }
  e.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: 'no-store' });   // siempre del servidor (nunca del caché del navegador)
      if (res && res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
      return res;
    } catch (err) {
      const guardado = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (guardado) return guardado;
      if (req.mode === 'navigate') return (await caches.match('./')) || (await caches.match('index.html')) || Response.error();
      return Response.error();
    }
  })());
});
