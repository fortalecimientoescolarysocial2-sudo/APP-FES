// FES La Rioja — Service Worker
// Subir este archivo junto con index.html en Supabase Storage

const CACHE = 'fes-v2';
const SHELL = ['./'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Dejar pasar Supabase y CDNs normalmente (sin cachear)
  if(url.hostname.includes('supabase') ||
     url.hostname.includes('googleapis') ||
     url.hostname.includes('jsdelivr') ||
     url.hostname.includes('fonts')) {
    return;
  }

  // Para navegación: red primero, caché como fallback (offline)
  if(e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  }
});
