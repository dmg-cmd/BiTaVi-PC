/**
 * BiTaVi Storage Manager
 * Gestión de persistencia de expediciones y fotografías en IndexedDB (BiTaVi_Storage_v1)
 * Cero dependencias externas, offline-first y transaccional.
 */

const DB_NAME = 'BiTaVi_Storage_v1';
const DB_VERSION = 1;
const STORE_SESSIONS = 'sessions';
const STORE_PHOTOS = 'photos';
const ACTIVE_SESSION_ID = 'active_session';

export class BiTaViStorage {
  constructor() {
    this.db = null;
    this.isSupported = typeof window !== 'undefined' && 'indexedDB' in window;
  }

  /**
   * Inicializa la conexión con IndexedDB y crea los almacenes si no existen
   * @returns {Promise<IDBDatabase|null>}
   */
  async init() {
    if (!this.isSupported) {
      console.warn('[BiTaVi Storage] IndexedDB no está disponible en este navegador.');
      return null;
    }

    if (this.db) return this.db;

    return new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          // Almacén para metadatos de sesión y telemetría de rutas
          if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
            db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
          }

          // Almacén para archivos binarios (Blobs) de fotos de expedición
          if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
            db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
          }

          console.log('[BiTaVi Storage] Estructura de base de datos inicializada.');
        };

        request.onsuccess = (event) => {
          this.db = event.target.result;
          console.log('[BiTaVi Storage] Conectado exitosamente a', DB_NAME);
          resolve(this.db);
        };

        request.onerror = (event) => {
          console.error('[BiTaVi Storage] Error abriendo IndexedDB:', event.target.error);
          resolve(null); // Fallback suave para no romper la app
        };

        request.onblocked = () => {
          console.warn('[BiTaVi Storage] Apertura bloqueada por otra pestaña abierta.');
        };
      } catch (err) {
        console.error('[BiTaVi Storage] Excepción inicializando IndexedDB:', err);
        resolve(null);
      }
    });
  }

  /**
   * Obtiene un resumen liviano de la sesión guardada (sin transferir los blobs de fotos)
   * Ideal para comprobar al arranque y mostrar el banner en 0 ms.
   * @returns {Promise<object|null>}
   */
  async getSavedSessionSummary() {
    try {
      await this.init();
      if (!this.db) return null;

      return new Promise((resolve) => {
        const tx = this.db.transaction([STORE_SESSIONS], 'readonly');
        const store = tx.objectStore(STORE_SESSIONS);
        const req = store.get(ACTIVE_SESSION_ID);

        req.onsuccess = () => {
          const session = req.result;
          if (!session) {
            resolve(null);
            return;
          }

          resolve({
            id: session.id,
            savedAt: session.savedAt,
            title: session.title || 'Expedición sin título',
            sourceType: session.sourceType || 'native',
            routesCount: session.routesCount || (session.routes ? session.routes.length : 0),
            totalPoints: session.totalPoints || 0,
            markersCount: session.markersCount || 0,
            favoritesCount: session.favoritesCount || 0,
            photosCount: session.photosCount || (session.photosMeta ? session.photosMeta.length : 0),
            distanceKm: session.distanceKm || '0.00',
            routeDate: session.routeDate || null
          });
        };

        req.onerror = () => {
          console.warn('[BiTaVi Storage] Error leyendo resumen de sesión:', req.error);
          resolve(null);
        };
      });
    } catch (e) {
      console.warn('[BiTaVi Storage] Excepción en getSavedSessionSummary:', e);
      return null;
    }
  }

  /**
   * Guarda de forma transaccional la sesión actual y sus fotos asociadas
   * @param {object} sessionData - Metadatos, rutas, puntos, marcadores y favoritos
   * @param {Array<{id: string, name: string, blob: Blob}>} photoBlobs - Lista de fotos en binario
   * @returns {Promise<boolean>}
   */
  async saveSession(sessionData, photoBlobs = []) {
    try {
      await this.init();
      if (!this.db) return false;

      const record = {
        id: ACTIVE_SESSION_ID,
        savedAt: new Date().toISOString(),
        title: sessionData.title || 'Expedición de Viaje',
        sourceType: sessionData.sourceType || 'native',
        routes: sessionData.routes || [],
        pointsByRoute: sessionData.pointsByRoute || {},
        markers: sessionData.markers || [],
        favorites: sessionData.favorites || [],
        gpxData: sessionData.gpxData || null,
        zipAnalysis: sessionData.zipAnalysis || null,
        stats: sessionData.stats || {},
        photosMeta: sessionData.photosMeta || [],
        routesCount: sessionData.routesCount || (sessionData.routes ? sessionData.routes.length : 0),
        totalPoints: sessionData.totalPoints || 0,
        markersCount: sessionData.markersCount || 0,
        favoritesCount: sessionData.favoritesCount || 0,
        photosCount: photoBlobs.length,
        distanceKm: sessionData.distanceKm || '0.00',
        routeDate: sessionData.routeDate || null
      };

      return new Promise((resolve) => {
        const tx = this.db.transaction([STORE_SESSIONS, STORE_PHOTOS], 'readwrite');
        const sessionStore = tx.objectStore(STORE_SESSIONS);
        const photoStore = tx.objectStore(STORE_PHOTOS);

        sessionStore.put(record);

        // Guardar cada blob de foto en su almacén
        if (Array.isArray(photoBlobs) && photoBlobs.length > 0) {
          photoStore.clear();
          for (const item of photoBlobs) {
            if (item && item.id && item.blob) {
              photoStore.put({
                id: item.id,
                name: item.name || 'foto.jpg',
                blob: item.blob
              });
            }
          }
        }

        tx.oncomplete = () => {
          console.log('[BiTaVi Storage] Sesión guardada con éxito. Fotos:', photoBlobs.length);
          resolve(true);
        };

        tx.onerror = () => {
          console.error('[BiTaVi Storage] Error transaccional al guardar sesión:', tx.error);
          resolve(false);
        };
      });
    } catch (e) {
      console.error('[BiTaVi Storage] Excepción guardando sesión:', e);
      return false;
    }
  }

  /**
   * Carga la sesión completa y reconstituye los Blobs y URLs para las fotografías
   * @returns {Promise<object|null>}
   */
  async loadFullSession() {
    try {
      await this.init();
      if (!this.db) return null;

      const session = await new Promise((resolve) => {
        const tx = this.db.transaction([STORE_SESSIONS], 'readonly');
        const req = tx.objectStore(STORE_SESSIONS).get(ACTIVE_SESSION_ID);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });

      if (!session) return null;

      // Recuperar los blobs de fotografías asociados
      const photosMap = await new Promise((resolve) => {
        const tx = this.db.transaction([STORE_PHOTOS], 'readonly');
        const store = tx.objectStore(STORE_PHOTOS);
        const req = store.getAll();
        req.onsuccess = () => {
          const map = new Map();
          (req.result || []).forEach(item => {
            map.set(item.id, item.blob);
          });
          resolve(map);
        };
        req.onerror = () => resolve(new Map());
      });

      // Reconstruir lista de fotos con Blob y ObjectURL
      const restoredPhotos = (session.photosMeta || []).map(meta => {
        const blob = photosMap.get(meta.id);
        const url = blob ? URL.createObjectURL(blob) : (meta.url || '');
        return {
          ...meta,
          blob: blob || null,
          url
        };
      });

      return {
        ...session,
        photos: restoredPhotos
      };
    } catch (e) {
      console.error('[BiTaVi Storage] Error cargando sesión completa:', e);
      return null;
    }
  }

  /**
   * Actualiza las coordenadas de una fotografía geolocalizada manualmente
   * @param {string} photoId 
   * @param {number} lat 
   * @param {number} lng 
   * @returns {Promise<boolean>}
   */
  async updatePhotoCoordinates(photoId, lat, lng) {
    try {
      await this.init();
      if (!this.db) return false;

      return new Promise((resolve) => {
        const tx = this.db.transaction([STORE_SESSIONS], 'readwrite');
        const store = tx.objectStore(STORE_SESSIONS);
        const req = store.get(ACTIVE_SESSION_ID);

        req.onsuccess = () => {
          const session = req.result;
          if (!session || !session.photosMeta) {
            resolve(false);
            return;
          }

          const photo = session.photosMeta.find(p => p.id === photoId);
          if (photo) {
            photo.lat = lat;
            photo.lng = lng;
            photo.hasGps = true;
            photo.geotagSource = 'manual';
            store.put(session);
          }
          resolve(true);
        };

        req.onerror = () => resolve(false);
      });
    } catch (e) {
      console.warn('[BiTaVi Storage] Error actualizando coordenadas de foto:', e);
      return false;
    }
  }

  /**
   * Limpia y elimina la sesión activa y los blobs de fotos en IndexedDB
   * @returns {Promise<boolean>}
   */
  async clearSession() {
    try {
      await this.init();
      if (!this.db) return false;

      return new Promise((resolve) => {
        const tx = this.db.transaction([STORE_SESSIONS, STORE_PHOTOS], 'readwrite');
        tx.objectStore(STORE_SESSIONS).delete(ACTIVE_SESSION_ID);
        tx.objectStore(STORE_PHOTOS).clear();

        tx.oncomplete = () => {
          console.log('[BiTaVi Storage] Sesión local eliminada con éxito.');
          resolve(true);
        };

        tx.onerror = () => {
          console.error('[BiTaVi Storage] Error eliminando sesión:', tx.error);
          resolve(false);
        };
      });
    } catch (e) {
      console.error('[BiTaVi Storage] Excepción limpiando sesión:', e);
      return false;
    }
  }
}
