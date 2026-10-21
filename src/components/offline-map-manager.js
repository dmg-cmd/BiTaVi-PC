/**
 * Administrador de Mapas 100% Offline y Caché de Teselas Cartográficas para BiTaVi PC
 * Utiliza Service Workers y CacheStorage API para almacenar cuadrantes geográficos completos
 * y permitir navegación táctica en campo sin conexión a internet.
 */

const TILE_CACHE_NAME = 'bitavi-tiles-v1';

/**
 * Convierte coordenadas geográficas (Lat/Lng) a coordenadas de tesela (X, Y)
 * Proyección Web Mercator estándar (EPSG:3857 / Slippy Map Tilename)
 *
 * @param {number} lat Latitud en grados (-85.0511 a 85.0511)
 * @param {number} lng Longitud en grados (-180 a 180)
 * @param {number} zoom Nivel de zoom entero (0 a 19)
 * @returns {{x: number, y: number, z: number}}
 */
export function latLngToTileXY(lat, lng, zoom) {
  const z = Math.max(0, Math.min(19, Math.floor(zoom)));
  const n = Math.pow(2, z);

  const x = Math.floor(((lng + 180) / 360) * n);

  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n
  );

  return {
    x: Math.max(0, Math.min(n - 1, x)),
    y: Math.max(0, Math.min(n - 1, y)),
    z
  };
}

/**
 * Convierte coordenadas de tesela (X, Y) a coordenadas geográficas (Lat/Lng) del borde superior izquierdo
 */
export function tileXYToLatLng(x, y, zoom) {
  const n = Math.pow(2, zoom);
  const lng = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lng };
}

/**
 * Calcula todas las tuplas de teselas necesarias para cubrir un cuadrante geográfico
 * en una serie de niveles de zoom dados.
 *
 * @param {{north: number, south: number, east: number, west: number}} bounds Límites geográficos
 * @param {Array<number>} zoomLevels Niveles de zoom a incluir
 * @param {string} urlTemplate Plantilla de URL de la capa (ej: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png')
 * @returns {Array<{x: number, y: number, z: number, url: string}>} Lista de teselas a descargar
 */
export function calculateAreaTileBounds(bounds, zoomLevels = [13, 14, 15], urlTemplate = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png') {
  const tiles = [];
  const zooms = (zoomLevels || []).sort((a, b) => a - b);

  for (const z of zooms) {
    // Esquina superior izquierda (Norte, Oeste)
    const nw = latLngToTileXY(bounds.north, bounds.west, z);
    // Esquina inferior derecha (Sur, Este)
    const se = latLngToTileXY(bounds.south, bounds.east, z);

    const minX = Math.min(nw.x, se.x);
    const maxX = Math.max(nw.x, se.x);
    const minY = Math.min(nw.y, se.y);
    const maxY = Math.max(nw.y, se.y);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        // Resolver subdominios si la plantilla los tiene (ej: {s})
        const subdomains = ['a', 'b', 'c'];
        const s = subdomains[(x + y) % subdomains.length];
        const url = urlTemplate
          .replace('{s}', s)
          .replace('{z}', String(z))
          .replace('{x}', String(x))
          .replace('{y}', String(y));

        tiles.push({ x, y, z, url });
      }
    }
  }

  return tiles;
}

/**
 * Gestor táctico de mapas offline y conectividad
 */
export class OfflineMapManager {
  constructor(options = {}) {
    this.options = Object.assign(
      {
        concurrency: 6,
        swPath: '/sw.js'
      },
      options
    );

    this.isServiceWorkerSupported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
    this.isCacheSupported = typeof window !== 'undefined' && 'caches' in window;
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.onConnectivityChange = null;

    this._setupConnectivityListeners();
  }

  /**
   * Inicializa y registra el Service Worker si el entorno lo soporta
   */
  async registerServiceWorker() {
    if (!this.isServiceWorkerSupported) {
      console.warn('[OfflineMap] Service Workers no están soportados en este navegador.');
      return false;
    }

    try {
      const reg = await navigator.serviceWorker.register(this.options.swPath, {
        scope: '/'
      });
      console.log('[OfflineMap] Service Worker táctico registrado con éxito. Ámbito:', reg.scope);
      return true;
    } catch (err) {
      console.warn('[OfflineMap] No se pudo registrar el Service Worker:', err.message);
      return false;
    }
  }

  /**
   * Descarga un cuadrante geográfico de teselas y las almacena en la caché del navegador
   *
   * @param {Object} params { bounds, zoomLevels, layerUrlTemplate, onProgress, abortSignal }
   * @returns {Promise<{total: number, downloaded: number, failed: number}>}
   */
  async downloadAreaTiles({ bounds, zoomLevels = [13, 14, 15], layerUrlTemplate, onProgress, abortSignal }) {
    if (!this.isCacheSupported) {
      throw new Error('CacheStorage no está disponible en este entorno.');
    }

    const template = layerUrlTemplate || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const tileList = calculateAreaTileBounds(bounds, zoomLevels, template);

    if (tileList.length === 0) {
      return { total: 0, downloaded: 0, failed: 0 };
    }

    // Límite de seguridad para evitar bloqueos por parte de los proveedores de teselas
    if (tileList.length > 2500) {
      throw new Error(`El área seleccionada requiere ${tileList.length} teselas, superando el límite seguro de 2500. Reduce el nivel de zoom o el tamaño del cuadrante.`);
    }

    const cache = await caches.open(TILE_CACHE_NAME);
    let completed = 0;
    let failed = 0;
    const total = tileList.length;

    onProgress?.({
      total,
      completed: 0,
      failed: 0,
      percent: 0,
      phase: `Iniciando descarga de ${total} teselas cartográficas...`
    });

    // Pool de concurrencia controlada
    const concurrency = Math.min(this.options.concurrency, 6);
    let cursor = 0;

    const worker = async () => {
      while (cursor < tileList.length) {
        if (abortSignal?.aborted) {
          throw new Error('Descarga de cuadrante cancelada por el usuario.');
        }

        const idx = cursor++;
        const tile = tileList[idx];

        try {
          // Verificar si ya existe en caché antes de solicitar por red
          const match = await cache.match(tile.url);
          if (!match) {
            const resp = await fetch(tile.url, {
              mode: 'cors',
              credentials: 'omit',
              signal: abortSignal
            });

            if (resp.status === 200) {
              await cache.put(tile.url, resp);
            } else {
              failed++;
            }
          }
        } catch (fetchErr) {
          if (abortSignal?.aborted) throw fetchErr;
          failed++;
        }

        completed++;
        const percent = Math.round((completed / total) * 100);
        onProgress?.({
          total,
          completed,
          failed,
          percent,
          phase: `Descargando teselas: ${completed}/${total} (${percent}%)...`
        });
      }
    };

    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(worker());
    }

    await Promise.all(workers);

    return { total, downloaded: completed - failed, failed };
  }

  /**
   * Obtiene estadísticas de teselas actualmente en memoria caché
   * @returns {Promise<{tileCount: number, estimatedSizeMb: string}>}
   */
  async getCacheStats() {
    if (!this.isCacheSupported) {
      return { tileCount: 0, estimatedSizeMb: '0.00' };
    }

    try {
      const cache = await caches.open(TILE_CACHE_NAME);
      const keys = await cache.keys();
      // Estimación: promedio de 22 KB por tesela PNG comprimida
      const estimatedBytes = keys.length * 22 * 1024;
      return {
        tileCount: keys.length,
        estimatedSizeMb: (estimatedBytes / (1024 * 1024)).toFixed(2)
      };
    } catch (_) {
      return { tileCount: 0, estimatedSizeMb: '0.00' };
    }
  }

  /**
   * Elimina y purga todas las teselas cartográficas almacenadas en la caché
   */
  async clearTileCache() {
    if (!this.isCacheSupported) return false;
    try {
      await caches.delete(TILE_CACHE_NAME);
      await caches.open(TILE_CACHE_NAME);
      return true;
    } catch (err) {
      console.warn('[OfflineMap] Error purgando caché de teselas:', err);
      return false;
    }
  }

  _setupConnectivityListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.onConnectivityChange?.({ online: true });
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.onConnectivityChange?.({ online: false });
    });
  }
}
