/**
 * Módulo de Búsqueda Táctica Híbrida: Local Offline + Nominatim OpenStreetMap
 * Permite buscar rutas, paradas, waypoints y fotografías de la expedición sin conexión a internet,
 * con fallback integrado a geocodificación global cuando hay red disponible.
 */
export class GeoSearch {
  constructor(onLocationSelected = null) {
    this.onLocationSelected = onLocationSelected;
    this.localIndex = [];
    this.inFlightController = null;
  }

  /**
   * Normaliza cadenas eliminando tildes y diacríticos para búsqueda flexible
   */
  _normalize(str) {
    if (!str) return '';
    return str
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /**
   * Actualiza el índice táctico local con los datos cargados en memoria
   * @param {Object} data Elementos de la expedición
   */
  indexLocalData({ routes = [], markers = [], favorites = [], photos = [], pointsByRoute = null }) {
    this.localIndex = [];

    // 1. Indexar Rutas
    routes.forEach((r, idx) => {
      let lat = null;
      let lng = null;
      if (pointsByRoute && pointsByRoute.has(r.id)) {
        const pts = pointsByRoute.get(r.id);
        if (pts && pts.length > 0) {
          lat = pts[0].lat;
          lng = pts[0].lng;
        }
      }
      this.localIndex.push({
        id: `route-${r.id || idx}`,
        type: 'route',
        category: 'local',
        title: r.name ? `Ruta: ${r.name}` : `Trayectoria ${r.id || idx + 1}`,
        subtitle: `${r.distanceKm ? r.distanceKm + ' km' : 'Distancia N/D'} • ${r.startDate || 'Sin fecha'}`,
        lat,
        lng,
        raw: r,
        icon: '🚩',
        badge: 'RUTA'
      });
    });

    // 2. Indexar Marcadores / Waypoints
    markers.forEach((m, idx) => {
      this.localIndex.push({
        id: `marker-${idx}`,
        type: 'marker',
        category: 'local',
        title: m.name || `Waypoint ${idx + 1}`,
        subtitle: m.desc ? `Nota: ${m.desc}` : `Coordenadas: ${m.lat.toFixed(4)}°, ${m.lng.toFixed(4)}°`,
        lat: m.lat,
        lng: m.lng,
        raw: m,
        icon: '📍',
        badge: 'WAYPOINT'
      });
    });

    // 3. Indexar Favoritos / Paradas
    favorites.forEach((f, idx) => {
      this.localIndex.push({
        id: `fav-${idx}`,
        type: 'favorite',
        category: 'local',
        title: f.name || `Parada ${idx + 1}`,
        subtitle: f.address || f.desc || (f.photoFile ? `Foto asociada: ${f.photoFile}` : 'Parada registrada'),
        lat: f.lat,
        lng: f.lng,
        raw: f,
        icon: '⭐',
        badge: 'PARADA'
      });
    });

    // 4. Indexar Fotografías
    photos.forEach((p, idx) => {
      const hasCoords = p.lat !== null && p.lng !== null && !isNaN(p.lat) && !isNaN(p.lng);
      this.localIndex.push({
        id: `photo-${p.id || idx}`,
        type: 'photo',
        category: 'local',
        title: p.name || `Foto ${idx + 1}`,
        subtitle: `${p.date || 'Fecha no disponible'} • ${hasCoords ? 'Geolocalizada' : 'Sin fijar en mapa'}`,
        lat: p.lat,
        lng: p.lng,
        raw: p,
        icon: '📷',
        badge: hasCoords ? 'FOTO GPS' : 'FOTO'
      });
    });
  }

  /**
   * Limpia el índice local al resetear o limpiar el mapa
   */
  clearLocalIndex() {
    this.localIndex = [];
  }

  /**
   * Búsqueda sincrónica ultra-rápida sobre el índice local en memoria
   */
  searchLocal(query) {
    if (!query || query.trim().length === 0 || this.localIndex.length === 0) return [];
    const normQuery = this._normalize(query);
    const tokens = normQuery.split(/\s+/).filter(t => t.length > 0);

    const matches = [];

    for (const item of this.localIndex) {
      const normTitle = this._normalize(item.title);
      const normSubtitle = this._normalize(item.subtitle);

      // Verificar que todos los tokens coincidan en título o subtítulo
      const matchAll = tokens.every(token => normTitle.includes(token) || normSubtitle.includes(token));

      if (matchAll) {
        // Ponderar relevancia: coincidencia al inicio del título tiene mayor prioridad
        let score = 0;
        if (normTitle.startsWith(normQuery)) score += 50;
        else if (normTitle.includes(normQuery)) score += 30;
        if (item.type === 'route') score += 10;
        if (item.type === 'marker') score += 8;
        if (item.type === 'favorite') score += 7;

        matches.push({ ...item, score });
      }
    }

    return matches.sort((a, b) => b.score - a.score).slice(0, 8);
  }

  /**
   * Búsqueda híbrida combinada: resultados locales de la expedición + Nominatim OSM
   */
  async search(query) {
    if (!query || query.trim().length < 2) return { local: [], global: [] };

    // 1. Búsqueda local instantánea (0 ms)
    const local = this.searchLocal(query);

    // 2. Si no hay conexión o se cancela, retornar solo local
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return { local, global: [] };
    }

    // 3. Consultar Nominatim OSM con timeout para no retrasar la UI
    if (this.inFlightController) {
      this.inFlightController.abort();
    }
    this.inFlightController = new AbortController();

    let global = [];
    try {
      const timeoutId = setTimeout(() => this.inFlightController.abort(), 2500);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
      
      const response = await fetch(url, {
        headers: { 'Accept-Language': 'es,en' },
        signal: this.inFlightController.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        global = data.map(item => ({
          id: `osm-${item.place_id || item.osm_id}`,
          type: 'global',
          category: 'global',
          name: item.name || item.display_name.split(',')[0],
          displayName: item.display_name,
          title: item.name || item.display_name.split(',')[0],
          subtitle: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          icon: '🌐',
          badge: 'MAPA'
        }));
      }
    } catch (err) {
      // Ignorar cancelaciones o fallos de red
      if (err && err.name !== 'AbortError') {
        console.warn('[GeoSearch] Búsqueda externa no disponible:', err.message);
      }
    }

    return { local, global };
  }
}
