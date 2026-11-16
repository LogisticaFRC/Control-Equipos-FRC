// =====================================================================
// SERVICE WORKER · App instalable (PWA) · 2026-11-16
// Estrategia "primero la red": si hay internet SIEMPRE carga la versión nueva (después de cada Push);
// solo si no hay señal usa la copia guardada de las pantallas (los datos siempre vienen de Supabase).
// Las librerías (CDN) y Supabase no se tocan.
// =====================================================================
const CACHE = 'frc-control-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // CDN, Supabase, imágenes externas: normal
  e.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res && res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
      return res;
    } catch (err) {
      const guardado = await caches.match(req);
      if (guardado) return guardado;
      if (req.mode === 'navigate') return (await caches.match('./')) || (await caches.match('index.html')) || Response.error();
      return Response.error();
    }
  })());
});
