// Service Worker Táctico para BiTaVi PC
// Estrategia Cache-First para teselas cartográficas (100% Offline First en expedición)
const TILE_CACHE_NAME = 'bitavi-tiles-v1';
const APP_CACHE_NAME = 'bitavi-app-v1';

// Servidores cartográficos conocidos
const TILE_DOMAINS = [
  'tile.openstreetmap.org',
  'tile.opentopomap.org',
  'server.arcgisonline.com',
  'tile-cyclosm.openstreetmap.fr',
  'openstreetmap.org'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== TILE_CACHE_NAME && name !== APP_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Detección de peticiones de teselas cartográficas (Tile Layers)
  const isTileRequest =
    TILE_DOMAINS.some((domain) => url.hostname.includes(domain)) ||
    url.pathname.includes('/tile/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg');

  if (isTileRequest) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then(async (cache) => {
        // A. Buscar primero en la caché local (velocidad instantánea y soporte sin conexión)
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // B. Si no está en caché y hay conexión, descargar y almacenar para uso futuro
        try {
          const networkResponse = await fetch(event.request, {
            mode: 'cors',
            credentials: 'omit'
          });

          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (fetchErr) {
          // C. Modo Campo Offline: si no hay red y la tesela no estaba descargada,
          // devolver una tesela táctica transparente de 1x1 sin romper la interfaz
          return new Response(
            new Uint8Array([
              0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
              0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
              0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
              0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
              0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
              0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
            ]),
            {
              headers: {
                'Content-Type': 'image/png',
                'X-BiTaVi-Fallback': 'offline'
              }
            }
          );
        }
      })
    );
    return;
  }

  // 2. Recursos de la aplicación (HTML, JS, CSS, fuentes)
  // Estrategia Network-First con Fallback a Caché
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (event.request.method === 'GET' && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(APP_CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
