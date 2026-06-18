// ═══════════════════════════════════════════════════════════════
// FES — Service Worker
// Estrategia:
//   - Shell de la app (HTML/CSS/JS/fonts/CDN libs): cache-first
//   - Llamadas a Supabase (*.supabase.co): network-first, fallback a cache
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = 'fes-cache-v1';

// Recursos del shell que se precachean al instalar.
// './' cubre index.html (la app es single-file).
const SHELL_ASSETS = [
  './',
  './index.html',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&family=Lora:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;600&display=swap',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return; // no cachear POST/PATCH/DELETE (writes a Supabase)

  const url = new URL(request.url);
  const isSupabase = url.hostname.endsWith('.supabase.co');

  if (isSupabase) {
    // Datos dinámicos: priorizar red, caer a cache si no hay conexión.
    event.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Shell de la app y CDNs: cache-first, actualiza en segundo plano.
  event.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
