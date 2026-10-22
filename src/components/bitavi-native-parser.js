import L from 'leaflet';
import { createGpxXml, extractDateFromName } from './gpx-parser.js';

/**
 * Parsea timestamps flexibles en formatos: milisegundos (>1e10), segundos Unix (1e9..1e10),
 * cadenas ISO o formatos de fecha humanos (DD/MM/YYYY, YYYY-MM-DD, "16 abr 2026 10:12:33", etc.).
 * @param {string|number} val
 * @returns {number|null} Timestamp en milisegundos o null si no es válido
 */
export function parseFlexibleTimestamp(val) {
  if (val === null || val === undefined || val === '') return null;
  const num = typeof val === 'number' ? val : Number(val);
  if (!isNaN(num) && isFinite(num) && num > 0) {
    if (num > 1000000000 && num < 10000000000) {
      return num * 1000;
    }
    if (num >= 10000000000) {
      return num;
    }
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1990 && d.getFullYear() < 2100) {
      return d.getTime();
    }
    const dmy = trimmed.match(/^([0-3]?\d)[/.-]([01]?\d)[/.-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (dmy) {
      const day = parseInt(dmy[1], 10);
      const month = parseInt(dmy[2], 10) - 1;
      const year = parseInt(dmy[3], 10);
      const hour = dmy[4] ? parseInt(dmy[4], 10) : 0;
      const min = dmy[5] ? parseInt(dmy[5], 10) : 0;
      const sec = dmy[6] ? parseInt(dmy[6], 10) : 0;
      const parsedD = new Date(year, month, day, hour, min, sec);
      if (!isNaN(parsedD.getTime())) {
        return parsedD.getTime();
      }
    }
    const slug = extractDateFromName(trimmed);
    if (slug) {
      const timeMatch = trimmed.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      const hh = timeMatch ? timeMatch[1].padStart(2, '0') : '12';
      const mm = timeMatch ? timeMatch[2].padStart(2, '0') : '00';
      const ss = timeMatch && timeMatch[3] ? timeMatch[3].padStart(2, '0') : '00';
      const isoD = new Date(`${slug}T${hh}:${mm}:${ss}Z`);
      if (!isNaN(isoD.getTime())) {
        return isoD.getTime();
      }
    }
  }
  return null;
}

/**
 * Parser y Renderizador del Formato Nativo de Backup de BiTaVi Android
 * Procesa: rutas.txt, puntos.txt, marcadores.txt, favoritos.txt y carpeta images/
 */
export class BiTaViNativeParser {
  constructor(mapInstance) {
    this.mapInstance = mapInstance;
    this.routes = [];
    this.pointsByRoute = new Map();
    this.markers = [];
    this.favorites = [];
    this.routeLayers = new Map();
    this.visibleRoutes = new Set();
    this.markersLayerGroup = L.layerGroup();
    this.favoritesLayerGroup = L.layerGroup();

    this.markersLayerGroup.addTo(this.mapInstance.map);
    this.favoritesLayerGroup.addTo(this.mapInstance.map);
  }

  /**
   * Procesa los archivos de texto nativos de BiTaVi
   * @param {Map<string, string>} textFilesMap - Mapa con nombre de archivo y su contenido
   */
  processNativeData(textFilesMap) {
    this.clearAll();

    // 1. Parsear rutas.txt
    if (textFilesMap.has('rutas.txt')) {
      this.parseRoutes(textFilesMap.get('rutas.txt'));
    }

    // 2. Parsear puntos.txt
    if (textFilesMap.has('puntos.txt')) {
      this.parsePoints(textFilesMap.get('puntos.txt'));
    }

    // 3. Parsear marcadores.txt
    if (textFilesMap.has('marcadores.txt')) {
      this.parseMarkers(textFilesMap.get('marcadores.txt'));
    }

    // 4. Parsear favoritos.txt
    if (textFilesMap.has('favoritos.txt')) {
      this.parseFavorites(textFilesMap.get('favoritos.txt'));
    }

    // 5. Si alguna ruta no tiene startTime válido, heredar fecha del primer punto con timestamp
    this.routes.forEach(r => {
      if (!r.startTime) {
        const pts = this.pointsByRoute.get(r.id);
        if (pts && pts.length > 0) {
          const firstWithTime = pts.find(p => p.timestamp || p.time);
          if (firstWithTime) {
            const parsedTs = parseFlexibleTimestamp(firstWithTime.timestamp || firstWithTime.time);
            if (parsedTs) {
              r.startTime = parsedTs;
              r.startDate = new Date(parsedTs).toLocaleString();
            }
          }
        }
      }
    });

    // 6. Renderizar marcadores y favoritos en el mapa
    this.renderMarkersAndFavorites();

    return {
      routesCount: this.routes.length,
      routes: this.routes,
      totalPoints: Array.from(this.pointsByRoute.values()).reduce((acc, p) => acc + p.length, 0),
      markersCount: this.markers.length,
      favoritesCount: this.favorites.length
    };
  }

  /**
   * Restaura datos de rutas, marcadores y favoritos persistidos en IndexedDB
   * @param {object} data
   */
  restoreData(data) {
    this.clearAll();
    this.routes = data.routes || [];
    this.markers = data.markers || [];
    this.favorites = data.favorites || [];
    this.pointsByRoute = new Map();

    if (data.pointsByRoute) {
      if (data.pointsByRoute instanceof Map) {
        this.pointsByRoute = new Map(data.pointsByRoute);
      } else {
        Object.keys(data.pointsByRoute).forEach(k => {
          this.pointsByRoute.set(k, data.pointsByRoute[k]);
        });
      }
    }

    this.renderMarkersAndFavorites();

    return {
      routesCount: this.routes.length,
      routes: this.routes,
      totalPoints: Array.from(this.pointsByRoute.values()).reduce((acc, p) => acc + p.length, 0),
      markersCount: this.markers.length,
      favoritesCount: this.favorites.length
    };
  }

  parseRoutes(content) {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    this.routes = lines.map(line => {
      const parts = line.split('|');
      const id = parts[0];
      const name = parts[1] || `Ruta ${id}`;
      let startTime = parseFlexibleTimestamp(parts[2]);
      const endTime = parseFlexibleTimestamp(parts[3]);
      const distanceM = parts[4] ? parseFloat(parts[4]) : 0;
      const maxSpeed = parts[5] ? parseFloat(parts[5]) : 0;
      const avgSpeed = parts[6] ? parseFloat(parts[6]) : 0;

      const durationMin = (startTime && endTime) 
        ? Math.round((endTime - startTime) / 60000) 
        : 0;

      // Si el nombre de la ruta contiene la fecha real (ej: "Auto-Ruta 2026-06-13 12:55" o "16 abr 2026 10:12:33"),
      // priorizar esa fecha sobre timestamps de reimportación de base de datos SQLite en Android
      const nameDateSlug = extractDateFromName(name);
      let startDate = startTime ? new Date(startTime).toLocaleString() : 'Fecha N/D';
      if (nameDateSlug) {
        const nameTs = parseFlexibleTimestamp(name);
        const startIso = startTime ? new Date(startTime).toISOString().split('T')[0] : null;
        if (!startIso || startIso !== nameDateSlug) {
          startDate = nameDateSlug;
          if (nameTs) {
            startTime = nameTs;
          }
        }
      }

      return {
        id,
        name,
        startTime,
        endTime,
        startDate,
        distanceKm: (distanceM / 1000).toFixed(2),
        distanceM: Math.round(distanceM),
        maxSpeed: maxSpeed.toFixed(1),
        avgSpeed: avgSpeed.toFixed(1),
        durationMin
      };
    });
  }

  parsePoints(content) {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    lines.forEach(line => {
      const parts = line.split('|');
      if (parts.length < 3) return;

      const routeId = parts[0];
      const lat = parseFloat(parts[1]);
      const lng = parseFloat(parts[2]);
      const ele = parts[3] ? parseFloat(parts[3]) : null;
      const speed = parts[4] ? parseFloat(parts[4]) : null;
      const timestamp = parseFlexibleTimestamp(parts[5]);

      if (!isNaN(lat) && !isNaN(lng)) {
        if (!this.pointsByRoute.has(routeId)) {
          this.pointsByRoute.set(routeId, []);
        }
        this.pointsByRoute.get(routeId).push({ lat, lng, ele, speed, timestamp });
      }
    });
  }

  parseMarkers(content) {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    this.markers = lines.map(line => {
      const parts = line.split('|');
      const id = parts[0];
      const name = parts[1] || 'Marcador';
      const desc = parts[2] || '';
      const lat = parseFloat(parts[3]);
      const lng = parseFloat(parts[4]);
      const color = parts[7] || '#2196F3';

      return { id, name, desc, lat, lng, color };
    }).filter(m => !isNaN(m.lat) && !isNaN(m.lng));
  }

  parseFavorites(content) {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    this.favorites = lines.map(line => {
      const parts = line.split('|');
      const name = parts[0] || 'Favorito / Parada';
      const address = parts[1] || '';
      const lat = parseFloat(parts[2]);
      const lng = parseFloat(parts[3]);
      const desc = parts[4] || '';
      const type = parts[5] || 'Punto';
      const color = parts[10] || '#FFD700';
      const timestamp = parts[13] ? parseInt(parts[13]) : null;
      const photoUrl = parts[6] || '';

      // Extraer el nombre del archivo de foto desde el content:// URI o ruta
      const photoFileMatch = photoUrl.match(/([^/\\?#]+?\.(?:jpg|jpeg|png|webp|heic))/i);
      const photoFile = photoFileMatch ? photoFileMatch[1].trim() : null;

      return { name, address, lat, lng, desc, type, color, timestamp, photoUrl, photoFile };
    }).filter(f => !isNaN(f.lat) && !isNaN(f.lng));
  }

  /**
   * Construye un mapa de geolocalización de fotos a partir de los favoritos:
   * { nombreDeFoto -> { lat, lng } }
   * Útil para posicionar fotos que no tienen EXIF GPS pero sí un favorito/parada asociado.
   */
  /**
   * Interpreta datos en formato JSON / GeoJSON de forma universal y robusta.
   * Soporta GeoJSON estándar, arrays de rutas, tablas de puntos, Google Timeline / Takeout,
   * objetos anidados y auto-descubrimiento heurístico recursivo de coordenadas.
   * @param {string|object} jsonContent
   * @param {string} fallbackName
   * @returns {boolean} true si se encontraron rutas, waypoints o puntos
   */
  parseJsonData(jsonContent, fallbackName = 'Ruta JSON') {
    let data;
    if (typeof jsonContent === 'string') {
      try {
        // Remover posibles marcas de orden de bytes (BOM UTF-8) y espacios
        const cleanStr = jsonContent.trim().replace(/^\uFEFF/, '');
        data = JSON.parse(cleanStr);
      } catch (e) {
        console.warn('[BiTaVi] JSON no válido:', e);
        return false;
      }
    } else {
      data = jsonContent;
    }

    if (!data) return false;
    let added = false;
    this.lastJsonInspection = { keys: Object.keys(data || {}), routesFound: 0, pointsFound: 0 };

    // Caso 0: backup nativo de BiTaVi Android exportado a JSON
    // { route: { name, startTime, endTime, distanceMeters, ... },
    //   locationPoints: [ { latitude, longitude, altitude, speed, timestamp } ],
    //   waypoints: [ ... ] }
    // Debe evaluarse antes que el escáner heurístico para no perder nombre, fecha ni distancia.
    if (this.parseBitaviBackupJson(data, fallbackName)) {
      this.renderMarkersAndFavorites();
      return true;
    }

    // Helper para buscar propiedad tolerante a mayúsculas/minúsculas y subcontenedores comunes
    const findContainer = (obj, candidateKeys) => {
      if (!obj || typeof obj !== 'object') return null;
      // 1. Búsqueda directa
      for (const key of candidateKeys) {
        if (obj[key] !== undefined) return obj[key];
        const lowerKey = key.toLowerCase();
        for (const k of Object.keys(obj)) {
          if (k.toLowerCase() === lowerKey && obj[k] !== undefined) return obj[k];
        }
      }
      // 2. Búsqueda en contenedores secundarios comunes (data, payload, response, result, export, backup, trip, viaje)
      const subContainers = ['data', 'payload', 'response', 'result', 'export', 'backup', 'trip', 'viaje', 'expedicion'];
      for (const sub of subContainers) {
        if (obj[sub] && typeof obj[sub] === 'object') {
          for (const key of candidateKeys) {
            if (obj[sub][key] !== undefined) return obj[sub][key];
            const lowerKey = key.toLowerCase();
            for (const k of Object.keys(obj[sub])) {
              if (k.toLowerCase() === lowerKey && obj[sub][k] !== undefined) return obj[sub][k];
            }
          }
        }
      }
      return null;
    };

    // Caso A: GeoJSON estándar (FeatureCollection, Feature, GeometryCollection o geometry directo)
    if (data.type === 'FeatureCollection' || data.type === 'Feature' || data.type === 'GeometryCollection' || data.coordinates || Array.isArray(data.features)) {
      const geoResult = this.parseGeoJson(data, fallbackName);
      if (geoResult) return true;
    }

    // Caso B: Array en la raíz
    if (Array.isArray(data) && data.length > 0) {
      const firstItem = data[0];

      // B1: Array de Rutas (cada elemento es un objeto que contiene una colección de puntos)
      const hasRoutePointsProp = firstItem && typeof firstItem === 'object' && (
        firstItem.points || firstItem.puntos || firstItem.coordinates || firstItem.coordenadas ||
        firstItem.latLngs || firstItem.locations || firstItem.path || firstItem.track || firstItem.trazado || firstItem.nodes
      );

      if (hasRoutePointsProp) {
        data.forEach((r, idx) => {
          if (!r || typeof r !== 'object') return;
          const routeId = String(r.id || r.id_ruta || r.routeId || idx + 1);
          const name = r.name || r.nombre || r.title || r.titulo || `${fallbackName} ${idx + 1}`;
          const pts = r.points || r.puntos || r.coordinates || r.coordenadas || r.latLngs || r.locations || r.path || r.track || r.trazado || r.nodes || [];
          const parsedPoints = this._normalizePointsArray(pts);

          if (parsedPoints.length > 0) {
            this.addRoute({
              id: routeId,
              name,
              startTime: r.startTime || r.time || parseFlexibleTimestamp(r.startDate || name) || null,
              startDate: r.startDate || r.fecha || extractDateFromName(name) || null
            }, parsedPoints, false);
            added = true;
            this.lastJsonInspection.routesFound++;
            this.lastJsonInspection.pointsFound += parsedPoints.length;
          }
        });
        if (added) {
          this.renderMarkersAndFavorites();
          return true;
        }
      }

      // B2: Array de Puntos individuales con ID de ruta (ej. tabla relacional puntos.txt volcada a JSON)
      const hasRouteIdProp = firstItem && typeof firstItem === 'object' && (
        firstItem.id_ruta !== undefined || firstItem.routeId !== undefined || firstItem.route_id !== undefined ||
        firstItem.ruta !== undefined || firstItem.id_recorrido !== undefined || firstItem.track_id !== undefined
      );

      if (hasRouteIdProp) {
        const ptsByRoute = new Map();
        data.forEach(pt => {
          if (!pt) return;
          const rId = String(pt.id_ruta ?? pt.routeId ?? pt.route_id ?? pt.ruta ?? pt.id_recorrido ?? pt.track_id ?? '1');
          if (!ptsByRoute.has(rId)) ptsByRoute.set(rId, []);
          ptsByRoute.get(rId).push(pt);
        });

        ptsByRoute.forEach((pts, rId) => {
          const parsedPoints = this._normalizePointsArray(pts);
          if (parsedPoints.length > 0) {
            const rName = `${fallbackName}${ptsByRoute.size > 1 ? ` (Ruta ${rId})` : ''}`;
            this.addRoute({
              id: rId,
              name: rName,
              startDate: extractDateFromName(rName) || null
            }, parsedPoints, false);
            added = true;
            this.lastJsonInspection.routesFound++;
            this.lastJsonInspection.pointsFound += parsedPoints.length;
          }
        });
        if (added) {
          this.renderMarkersAndFavorites();
          return true;
        }
      }

      // B3: Array directo de coordenadas o puntos planos [ [lat, lng], ... ] o [ {lat, lng}, ... ]
      const parsedPoints = this._normalizePointsArray(data);
      if (parsedPoints.length > 0) {
        this.addRoute({
          name: fallbackName,
          startDate: extractDateFromName(fallbackName) || null
        }, parsedPoints, false);
        added = true;
        this.lastJsonInspection.routesFound++;
        this.lastJsonInspection.pointsFound += parsedPoints.length;
        this.renderMarkersAndFavorites();
        return true;
      }
    }

    // Caso C: Objeto contenedor con listas de rutas, puntos, marcadores y favoritos
    const routeKeys = ['routes', 'rutas', 'tracks', 'recorridos', 'trips', 'viajes', 'segments', 'legs', 'paths', 'activities', 'history', 't_rutas', 'tbl_rutas', 'tours'];
    const pointKeys = ['points', 'puntos', 'coordinates', 'coordenadas', 'locations', 'positions', 'trackpoints', 'nodes', 't_puntos', 'locationpoints', 'location_points', 'puntosruta', 'puntos_ruta', 'track_points', 'geopoints'];
    const markerKeys = ['markers', 'marcadores', 'waypoints', 'pois', 'puntos_interes', 't_marcadores'];
    const favoriteKeys = ['favorites', 'favoritos', 'paradas', 'stops', 'photos', 'fotos', 'imagenes', 't_favoritos'];

    const routesList = findContainer(data, routeKeys);
    const pointsList = findContainer(data, pointKeys);
    const markersList = findContainer(data, markerKeys);
    const favoritesList = findContainer(data, favoriteKeys);

    // C1: Rutas con puntos embebidos adentro de cada objeto ruta
    if (Array.isArray(routesList)) {
      routesList.forEach((r, idx) => {
        if (!r || typeof r !== 'object') return;
        const routeId = String(r.id || r.id_ruta || idx + 1);
        const name = r.name || r.nombre || r.title || `${fallbackName} ${idx + 1}`;
        const pts = r.points || r.puntos || r.coordinates || r.coordenadas || r.latLngs || r.locations || r.path || r.track || [];
        const parsedPoints = this._normalizePointsArray(pts);

        if (parsedPoints.length > 0) {
          this.addRoute({
            id: routeId,
            name,
            startTime: r.startTime || r.time || parseFlexibleTimestamp(r.startDate || name) || null,
            startDate: r.startDate || r.fecha || extractDateFromName(name) || null
          }, parsedPoints, false);
          added = true;
          this.lastJsonInspection.routesFound++;
          this.lastJsonInspection.pointsFound += parsedPoints.length;
        }
      });
    }

    // C2: Puntos en lista plana que tienen routeId o son una sola traza
    if (Array.isArray(pointsList) && (!routesList || routesList.length === 0)) {
      const containerName = data.name || data.nombre || data.title || fallbackName;
      const ptsByRoute = new Map();
      pointsList.forEach(pt => {
        if (!pt) return;
        const rId = String(pt.routeId ?? pt.route_id ?? pt.id_ruta ?? pt.ruta ?? '1');
        if (!ptsByRoute.has(rId)) ptsByRoute.set(rId, []);
        ptsByRoute.get(rId).push(pt);
      });

      ptsByRoute.forEach((pts, rId) => {
        const parsedPoints = this._normalizePointsArray(pts);
        if (parsedPoints.length > 0) {
          const rName = `${containerName}${ptsByRoute.size > 1 ? ` (Tramo ${rId})` : ''}`;
          this.addRoute({
            id: rId,
            name: rName,
            startDate: extractDateFromName(rName) || null
          }, parsedPoints, false);
          added = true;
          this.lastJsonInspection.routesFound++;
          this.lastJsonInspection.pointsFound += parsedPoints.length;
        }
      });
    }

    // C3: Marcadores y Waypoints en JSON
    if (Array.isArray(markersList)) {
      markersList.forEach((m, idx) => {
        if (!m) return;
        const lat = parseFloat(m.lat ?? m.latitude ?? m.latitud ?? m.Lat ?? m.y);
        const lng = parseFloat(m.lng ?? m.lon ?? m.longitude ?? m.longitud ?? m.Lng ?? m.x);
        if (!isNaN(lat) && !isNaN(lng)) {
          this.markers.push({
            id: String(m.id || `marker-${Date.now()}-${idx}`),
            name: m.name || m.nombre || m.title || 'Marcador',
            desc: m.desc || m.descripcion || '',
            lat,
            lng,
            color: m.color || '#2196F3'
          });
          added = true;
        }
      });
    }

    // C4: Favoritos, Paradas y Fotos en JSON
    if (Array.isArray(favoritesList)) {
      favoritesList.forEach(f => {
        if (!f) return;
        const lat = parseFloat(f.lat ?? f.latitude ?? f.latitud ?? f.Lat ?? f.y);
        const lng = parseFloat(f.lng ?? f.lon ?? f.longitude ?? f.longitud ?? f.Lng ?? f.x);
        if (!isNaN(lat) && !isNaN(lng)) {
          const photoUrl = f.photoUrl || f.photo || f.foto || f.image || f.file || '';
          const photoFile = f.photoFile || (photoUrl ? photoUrl.split('/').pop().replace(/^.*[\\/]/, '') : null);
          this.favorites.push({
            name: f.name || f.nombre || f.title || 'Favorito',
            address: f.address || f.direccion || '',
            lat,
            lng,
            desc: f.desc || f.descripcion || '',
            type: f.type || f.tipo || 'Punto',
            color: f.color || '#FFD700',
            photoUrl,
            photoFile
          });
          added = true;
        }
      });
    }

    // Caso D: Objeto único que representa directamente una sola ruta
    if (!added && typeof data === 'object') {
      const singlePts = data.points || data.puntos || data.coordinates || data.coordenadas || data.locations || data.latLngs || data.path || data.track;
      if (Array.isArray(singlePts)) {
        const parsedPoints = this._normalizePointsArray(singlePts);
        if (parsedPoints.length > 0) {
          const rName = data.name || data.nombre || data.title || fallbackName;
          this.addRoute({
            name: rName,
            startDate: data.startDate || data.fecha || extractDateFromName(rName) || null
          }, parsedPoints, false);
          added = true;
          this.lastJsonInspection.routesFound++;
          this.lastJsonInspection.pointsFound += parsedPoints.length;
        }
      }
    }

    // Caso E: Google Timeline / Takeout (locations array o semanticSegments)
    if (!added && data.timelineObjects && Array.isArray(data.timelineObjects)) {
      data.timelineObjects.forEach((item, idx) => {
        const act = item.activitySegment;
        if (act && act.waypointPath && Array.isArray(act.waypointPath.points)) {
          const parsedPoints = this._normalizePointsArray(act.waypointPath.points);
          if (parsedPoints.length > 0) {
            this.addRoute({
              name: `Timeline Actividad ${idx + 1} (${act.activityType || 'Desplazamiento'})`,
              startDate: act.duration?.startTimestamp ? act.duration.startTimestamp.split('T')[0] : null
            }, parsedPoints, false);
            added = true;
          }
        }
      });
    }

    // Caso F: Auto-descubrimiento heurístico recursivo ("Deep Coordinate Scanner")
    // Explora árboles JSON heterogéneos buscando arrays con 2 o más coordenadas válidas
    if (!added && typeof data === 'object') {
      const discoveredTracks = this._deepScanForCoordinates(data);
      if (discoveredTracks.length > 0) {
        discoveredTracks.forEach((trackPts, tIdx) => {
          const rName = `${fallbackName}${discoveredTracks.length > 1 ? ` (Tramo ${tIdx + 1})` : ''}`;
          this.addRoute({
            name: rName,
            startDate: extractDateFromName(rName) || null
          }, trackPts, false);
          added = true;
          this.lastJsonInspection.routesFound++;
          this.lastJsonInspection.pointsFound += trackPts.length;
        });
      }
    }

    if (added) {
      this.renderMarkersAndFavorites();
    }

    return added;
  }

  /**
   * Escanea recursivamente un objeto o árbol JSON buscando secuencias de coordenadas GPS válidas
   * @param {object|Array} rootObj
   * @param {number} maxDepth
   * @returns {Array<Array<object>>} lista de tramos de puntos descubiertos
   */
  _deepScanForCoordinates(rootObj, maxDepth = 5) {
    const discovered = [];

    const traverse = (node, depth) => {
      if (!node || depth > maxDepth) return;

      if (Array.isArray(node)) {
        if (node.length >= 2) {
          const normalized = this._normalizePointsArray(node);
          // Si al menos el 70% de los elementos se normalizaron a puntos válidos y hay al menos 2
          if (normalized.length >= 2 && normalized.length >= Math.floor(node.length * 0.7)) {
            discovered.push(normalized);
            return; // Ya procesamos este array como un track, no descender más en él
          }
        }
        for (const item of node) {
          if (typeof item === 'object') traverse(item, depth + 1);
        }
      } else if (typeof node === 'object') {
        for (const key of Object.keys(node)) {
          traverse(node[key], depth + 1);
        }
      }
    };

    traverse(rootObj, 0);
    return discovered;
  }

  /**
   * Interpreta el backup nativo de BiTaVi Android exportado a JSON:
   * { route: {...}, locationPoints: [{ latitude, longitude, altitude, speed, timestamp }], waypoints: [...] }
   *
   * Es el formato que genera la app Android al compartir una expedición como JSON.
   * Se resuelve de forma explícita (no heurística) para conservar nombre, fecha,
   * distancia oficial y waypoints del recorrido.
   *
   * @param {object} data
   * @param {string} fallbackName
   * @returns {boolean} true si se agregó al menos una ruta
   */
  parseBitaviBackupJson(data, fallbackName = 'Ruta JSON') {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;

    // La colección de puntos cambia de nombre según la versión de la app Android.
    // 'puntos' solo se acepta si existe data.route, para no capturar otros formatos
    // genéricos que también usan la clave "puntos" junto a "rutas".
    const NATIVE_POINT_KEYS = [
      'locationPoints', 'location_points', 'puntosRuta', 'puntos_ruta',
      'trackPoints', 'track_points', 'geopoints'
    ];
    const pointsKey = NATIVE_POINT_KEYS.find(k => Array.isArray(data[k]))
      || ((data.route && typeof data.route === 'object' && Array.isArray(data.puntos)) ? 'puntos' : null);
    if (!pointsKey) return false;

    const points = this._normalizePointsArray(data[pointsKey]);
    if (points.length < 2) return false;

    // Metadatos: normalmente en data.route (objeto), con tolerancia a data.ruta
    const meta = (data.route && typeof data.route === 'object' && !Array.isArray(data.route))
      ? data.route
      : (data.ruta && typeof data.ruta === 'object' && !Array.isArray(data.ruta))
        ? data.ruta
        : {};

    const name = meta.name || meta.nombre || data.name || data.nombre || fallbackName;
    const startTime = parseFlexibleTimestamp(meta.startTime ?? meta.startDate ?? data.startTime);
    const endTime = parseFlexibleTimestamp(meta.endTime ?? data.endTime);

    // La distancia declarada por Android tiene prioridad sobre el cálculo geodésico
    const declaredDistance = Number(
      meta.distanceMeters ?? meta.distanceM ?? meta.distanciaMetros ?? data.distanceMeters
    );

    // Igual que parseRoutes(): la fecha escrita en el nombre es la fecha real del recorrido
    const nameDate = extractDateFromName(name);
    const startDate = nameDate || (startTime ? new Date(startTime).toLocaleString() : null);

    this.addRoute({
      id: meta.id !== undefined && meta.id !== null ? String(meta.id) : undefined,
      name,
      startTime,
      endTime,
      startDate,
      distanceM: Number.isFinite(declaredDistance) && declaredDistance > 0 ? declaredDistance : undefined,
      maxSpeed: meta.maxSpeed !== undefined && meta.maxSpeed !== null ? Number(meta.maxSpeed).toFixed(1) : '0.0',
      avgSpeed: meta.avgSpeed !== undefined && meta.avgSpeed !== null ? Number(meta.avgSpeed).toFixed(1) : '0.0',
      durationMin: (startTime && endTime && endTime > startTime)
        ? Math.round((endTime - startTime) / 60000)
        : 0,
      fileName: data.fileName || null
    }, points, false);

    // Puntos de interés / waypoints del backup → marcadores tácticos
    if (Array.isArray(data.waypoints)) {
      data.waypoints.forEach((w, idx) => {
        if (!w || typeof w !== 'object') return;
        const lat = parseFloat(w.latitude ?? w.lat ?? w.latitud);
        const lng = parseFloat(w.longitude ?? w.lng ?? w.lon ?? w.longitud);
        if (isNaN(lat) || isNaN(lng)) return;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
        this.markers.push({
          id: String(w.id ?? `wp-${Date.now()}-${idx}`),
          name: w.name || w.nombre || 'Waypoint',
          desc: w.description || w.desc || w.comment || '',
          lat,
          lng,
          color: w.color || '#2196F3'
        });
      });
    }

    this.lastJsonInspection.routesFound++;
    this.lastJsonInspection.pointsFound += points.length;
    return true;
  }

  /**
   * Interpreta objetos GeoJSON (FeatureCollection, Feature, LineString, MultiLineString, Point)
   */
  parseGeoJson(geoJson, fallbackName = 'GeoJSON') {
    let added = false;
    const features = geoJson.type === 'FeatureCollection'
      ? geoJson.features
      : (geoJson.type === 'Feature' ? [geoJson] : (Array.isArray(geoJson.features) ? geoJson.features : [{ geometry: geoJson, properties: {} }]));

    if (!features || !Array.isArray(features)) return false;

    features.forEach((feat, idx) => {
      const geom = feat.geometry || feat;
      const props = feat.properties || {};
      const featName = props.name || props.title || props.id || `${fallbackName}${features.length > 1 ? ` ${idx + 1}` : ''}`;

      if (geom.type === 'LineString') {
        const coords = geom.coordinates || [];
        const points = coords.map(c => ({
          lng: parseFloat(c[0]),
          lat: parseFloat(c[1]),
          ele: c[2] !== undefined ? parseFloat(c[2]) : null
        })).filter(p => !isNaN(p.lat) && !isNaN(p.lng));

        if (points.length > 0) {
          this.addRoute({
            name: featName,
            startDate: props.date || props.time || extractDateFromName(featName) || null,
            startTime: props.timestamp || null
          }, points, false);
          added = true;
        }
      } else if (geom.type === 'MultiLineString') {
        const multiCoords = geom.coordinates || [];
        multiCoords.forEach((coords, partIdx) => {
          const points = coords.map(c => ({
            lng: parseFloat(c[0]),
            lat: parseFloat(c[1]),
            ele: c[2] !== undefined ? parseFloat(c[2]) : null
          })).filter(p => !isNaN(p.lat) && !isNaN(p.lng));

          if (points.length > 0) {
            this.addRoute({
              name: `${featName} (Tramo ${partIdx + 1})`,
              startDate: props.date || extractDateFromName(featName) || null
            }, points, false);
            added = true;
          }
        });
      } else if (geom.type === 'Point') {
        const coords = geom.coordinates || [];
        const lng = parseFloat(coords[0]);
        const lat = parseFloat(coords[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          this.markers.push({
            id: String(props.id || `marker-${Date.now()}-${idx}`),
            name: featName,
            desc: props.description || props.desc || '',
            lat,
            lng,
            color: props.color || '#2196F3'
          });
          added = true;
        }
      }
    });

    if (added) {
      this.renderMarkersAndFavorites();
    }
    return added;
  }

  /**
   * Normaliza una lista heterogénea de puntos a formato estándar { lat, lng, ele, speed, timestamp }
   */
  _normalizePointsArray(pts) {
    if (!Array.isArray(pts)) return [];
    return pts.map(p => {
      if (!p) return null;
      let lat, lng, ele = null, speed = null, timestamp = null;

      if (Array.isArray(p) && p.length >= 2) {
        const v0 = parseFloat(p[0]);
        const v1 = parseFloat(p[1]);
        // Detección heurística de [lat, lng] vs [lng, lat]:
        // Si el segundo valor está fuera del rango [-90, 90], el primero es lat y el segundo es lng (o viceversa)
        if (Math.abs(v0) <= 90 && Math.abs(v1) > 90) {
          lat = v0; lng = v1;
        } else if (Math.abs(v1) <= 90 && Math.abs(v0) > 90) {
          lng = v0; lat = v1;
        } else {
          // Por defecto asumimos [lat, lng] a menos que sea formato GeoJSON [lon, lat]
          lat = v0; lng = v1;
        }
        if (p.length > 2 && p[2] !== null && p[2] !== undefined && p[2] !== '') {
          const parsedEle = parseFloat(p[2]);
          ele = isNaN(parsedEle) ? null : parsedEle;
        }
      } else if (typeof p === 'object') {
        // Soporte Google Timeline / Takeout con latitudeE7 y longitudeE7
        if (p.latitudeE7 !== undefined && p.longitudeE7 !== undefined) {
          lat = parseFloat(p.latitudeE7) / 1e7;
          lng = parseFloat(p.longitudeE7) / 1e7;
        } else {
          const rawLat = p.lat ?? p.latitude ?? p.latitud ?? p.Lat ?? p.Latitude ?? p.Latitud ?? p.y ?? p.Y;
          const rawLng = p.lng ?? p.lon ?? p.longitude ?? p.longitud ?? p.Lng ?? p.Lon ?? p.Longitude ?? p.Longitud ?? p.x ?? p.X;
          lat = parseFloat(rawLat);
          lng = parseFloat(rawLng);
        }

        const rawEle = p.ele ?? p.alt ?? p.altitude ?? p.elevacion ?? p.Alt ?? p.Altitude ?? p.z ?? p.Z;
        const parsedEle = rawEle !== undefined && rawEle !== null && rawEle !== '' ? parseFloat(rawEle) : NaN;
        ele = isNaN(parsedEle) ? null : parsedEle;

        const rawSpeed = p.speed ?? p.velocidad ?? p.Speed;
        const parsedSpeed = rawSpeed !== undefined && rawSpeed !== null && rawSpeed !== '' ? parseFloat(rawSpeed) : NaN;
        speed = isNaN(parsedSpeed) ? null : parsedSpeed;

        timestamp = p.timestamp ?? p.time ?? p.timestampMs ?? p.fecha ?? p.Fecha ?? p.date ?? null;
      }

      if (typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng)) {
        // Validar que las coordenadas estén dentro del rango geográfico válido de la Tierra
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          return { lat, lng, ele, speed, timestamp: parseFlexibleTimestamp(timestamp) };
        }
      }
      return null;
    }).filter(Boolean);
  }

  getPhotoGeoMap() {
    const map = new Map();
    this.favorites.forEach(f => {
      if (f.photoFile && !isNaN(f.lat) && !isNaN(f.lng)) {
        const cleanName = f.photoFile.toLowerCase().trim();
        map.set(cleanName, { lat: f.lat, lng: f.lng });
        // Registrar también sin extensión para tolerancia
        const withoutExt = cleanName.replace(/\.[^/.]+$/, '');
        if (withoutExt && withoutExt !== cleanName) {
          map.set(withoutExt, { lat: f.lat, lng: f.lng });
        }
      }
    });
    return map;
  }

  renderMarkersAndFavorites() {
    this.markersLayerGroup.clearLayers();
    this.favoritesLayerGroup.clearLayers();

    // 1. Renderizar Marcadores Tácticos
    this.markers.forEach(m => {
      const icon = L.divIcon({
        className: 'native-marker-pin',
        html: `
          <div style="background: ${m.color}; color: #fff; font-weight: 800; font-size: 11px; padding: 3px 8px; border-radius: 4px; border: 1.5px solid #fff; box-shadow: 0 0 10px ${m.color}; display: flex; align-items: center; gap: 4px; white-space: nowrap;">
            <span>📍</span> <span>${m.name}</span>
          </div>
        `,
        iconSize: [100, 24],
        iconAnchor: [50, 12]
      });

      const marker = L.marker([m.lat, m.lng], { icon });
      marker.bindPopup(`
        <div class="tactical-popup" style="padding: 0.75rem;">
          <h4 style="color: ${m.color}; font-size: 0.85rem; margin-bottom: 0.25rem;">📍 ${m.name}</h4>
          <p style="font-size: 0.7rem; color: #cbd5e1;">${m.desc || 'Marcador táctico de ruta'}</p>
          <div class="monospace" style="font-size: 0.65rem; color: #00f0ff; margin-top: 0.4rem;">
            LAT: ${m.lat.toFixed(6)}°<br>LNG: ${m.lng.toFixed(6)}°
          </div>
        </div>
      `);
      this.markersLayerGroup.addLayer(marker);
    });

    // 2. Renderizar Favoritos y Paradas Automáticas
    this.favorites.forEach(f => {
      const icon = L.divIcon({
        className: 'native-fav-pin',
        html: `
          <div style="background: ${f.color}; color: #000; font-weight: 800; font-size: 10px; padding: 2px 7px; border-radius: 4px; border: 1px solid #fff; box-shadow: 0 0 8px ${f.color}; display: flex; align-items: center; gap: 3px; white-space: nowrap;">
            <span>⭐</span> <span>${f.name}</span>
          </div>
        `,
        iconSize: [90, 20],
        iconAnchor: [45, 10]
      });

      const marker = L.marker([f.lat, f.lng], { icon });
      marker.bindPopup(`
        <div class="tactical-popup" style="padding: 0.75rem;">
          <h4 style="color: ${f.color}; font-size: 0.85rem; margin-bottom: 0.25rem;">⭐ ${f.name}</h4>
          <p style="font-size: 0.7rem; color: #cbd5e1;">${f.desc || f.address || 'Punto de interés / Parada'}</p>
          <div class="monospace" style="font-size: 0.65rem; color: #00f0ff; margin-top: 0.4rem;">
            LAT: ${f.lat.toFixed(6)}° | LNG: ${f.lng.toFixed(6)}°
          </div>
        </div>
      `);
      this.favoritesLayerGroup.addLayer(marker);
    });
  }

  /**
   * Renderiza una ruta específica o todas las rutas
   * @param {string|'all'} routeId 
   */
  renderRoute(routeId = 'all') {
    this.mapInstance.routesLayerGroup.clearLayers();
    this.mapInstance.routeMarkersLayerGroup.clearLayers();
    this.mapInstance.routeArrowsLayerGroup.clearLayers();
    this.routeLayers = new Map();

    const allBounds = L.latLngBounds([]);

    const targetRouteIds = (routeId === 'all')
      ? Array.from(this.pointsByRoute.keys())
      : [routeId];

    this.visibleRoutes = new Set(targetRouteIds);

    const colorMap = this.getRouteColorMap();

    targetRouteIds.forEach(id => {
      const points = this.pointsByRoute.get(id);
      if (!points || points.length === 0) return;

      const latLngs = points.map(p => [p.lat, p.lng]);
      const routeInfo = this.routes.find(r => r.id === id);
      const routeColor = colorMap.get(id) || '#00f0ff';

      // Línea de resplandor exterior
      const glowLine = L.polyline(latLngs, {
        color: routeColor,
        weight: 6,
        opacity: 0.4,
        lineCap: 'round'
      });

      // Línea central sólida
      const coreLine = L.polyline(latLngs, {
        color: routeColor,
        weight: 3,
        opacity: 0.95,
        lineCap: 'round'
      });

      const trackGroup = L.featureGroup([glowLine, coreLine]);

      // Popup de información de ruta al hacer clic en la línea
      const popupHtml = `
        <div class="tactical-popup" style="padding: 0.75rem;">
          <h4 style="color: ${routeColor}; font-size: 0.85rem; margin-bottom: 0.25rem;">🏁 ${routeInfo?.name || `Ruta ${id}`}</h4>
          <div class="monospace" style="font-size: 0.68rem; color: #cbd5e1; display: flex; flex-direction: column; gap: 3px;">
            <div><span>Distancia:</span> <strong>${routeInfo?.distanceKm || (this.calculateDistance(points) / 1000).toFixed(2)} km</strong></div>
            <div><span>Fecha:</span> ${routeInfo?.startDate || 'N/D'}</div>
            <div><span>Puntos:</span> ${points.length}</div>
            <div><span>Velocidad Prom:</span> ${routeInfo?.avgSpeed || '--'} km/h</div>
          </div>
        </div>
      `;
      coreLine.bindPopup(popupHtml);

      // Marcadores de Inicio y Fin agrupados por ruta (para ocultar por separado)
      const markersGroup = L.layerGroup();
      const startPin = L.divIcon({
        className: 'native-pin-start',
        html: `<div style="background:#10b981; color:#000; font-weight:800; font-size:9px; padding:2px 5px; border-radius:3px; border:1px solid #fff;">INICIO R${id}</div>`,
        iconSize: [50, 16]
      });
      markersGroup.addLayer(L.marker(latLngs[0], { icon: startPin }));

      const endPin = L.divIcon({
        className: 'native-pin-end',
        html: `<div style="background:#f43f5e; color:#fff; font-weight:800; font-size:9px; padding:2px 5px; border-radius:3px; border:1px solid #fff;">FIN R${id}</div>`,
        iconSize: [40, 16]
      });
      markersGroup.addLayer(L.marker(latLngs[latLngs.length - 1], { icon: endPin }));

      // Chevrons direccionales sutiles en blanco (paridad con BiTaVi Android)
      const arrowsGroup = this.mapInstance.addRouteArrows(latLngs, '#ffffff');

      this.mapInstance.routesLayerGroup.addLayer(trackGroup);
      this.mapInstance.routeMarkersLayerGroup.addLayer(markersGroup);

      this.routeLayers.set(id, { trackGroup, markersGroup, arrowsGroup });
      allBounds.extend(trackGroup.getBounds());
    });

    // Añadir también marcadores y favoritos a los límites si no hay rutas
    if (!allBounds.isValid()) {
      this.markers.forEach(m => allBounds.extend([m.lat, m.lng]));
      this.favorites.forEach(f => allBounds.extend([f.lat, f.lng]));
    }

    if (allBounds.isValid()) {
      this.mapInstance.fitBounds(allBounds, { padding: [50, 50], maxZoom: 16 });
    }

    return allBounds;
  }

  /**
   * Devuelve un mapa estable idRuta -> color, para que las flechas, la línea
   * y el selector de rutas usen exactamente el mismo color por trayectoria.
   */
  getRouteColorMap() {
    const ids = Array.from(this.pointsByRoute.keys());
    const colors = ['#00f0ff', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'];
    const map = new Map();
    ids.forEach((id, i) => map.set(id, colors[i % colors.length]));
    return map;
  }

  /**
   * Muestra u oculta una trayectoria individual (línea, inicio/fin y flechas).
   * Permite separar recorridos en el mapa según convenga al usuario.
   */
  setRouteVisibility(routeId, visible) {
    const grp = this.routeLayers.get(routeId);
    if (!grp) return;
    const { trackGroup, markersGroup, arrowsGroup } = grp;
    if (visible) {
      this.visibleRoutes.add(routeId);
      this.mapInstance.routesLayerGroup.addLayer(trackGroup);
      this.mapInstance.routeMarkersLayerGroup.addLayer(markersGroup);
      if (arrowsGroup) this.mapInstance.routeArrowsLayerGroup.addLayer(arrowsGroup);
    } else {
      this.visibleRoutes.delete(routeId);
      this.mapInstance.routesLayerGroup.removeLayer(trackGroup);
      this.mapInstance.routeMarkersLayerGroup.removeLayer(markersGroup);
      if (arrowsGroup) this.mapInstance.routeArrowsLayerGroup.removeLayer(arrowsGroup);
    }
  }

  /**
   * Devuelve los límites (LatLngBounds) combinados solo de las rutas actualmente
   * visibles, para que "Enfocar Rutas" encuadre únicamente lo que se muestra.
   * @returns {L.LatLngBounds|null}
   */
  getVisibleRoutesBounds() {
    const bounds = L.latLngBounds([]);
    if (this.routeLayers && this.routeLayers.size > 0) {
      this.routeLayers.forEach((grp, id) => {
        if (this.visibleRoutes.has(id) && grp.trackGroup) {
          try { bounds.extend(grp.trackGroup.getBounds()); } catch (e) {}
        }
      });
    }
    // Fallback directo a coordenadas en memoria si las capas aún no fueron inicializadas
    if (!bounds.isValid() && this.pointsByRoute && this.pointsByRoute.size > 0) {
      this.pointsByRoute.forEach((pts, id) => {
        if (this.visibleRoutes.has(id) && Array.isArray(pts)) {
          pts.forEach(p => {
            if (p && !isNaN(p.lat) && !isNaN(p.lng)) bounds.extend([p.lat, p.lng]);
          });
        }
      });
    }
    return bounds.isValid() ? bounds : null;
  }

  calculateDistance(points) {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += this.mapInstance.map.distance([points[i - 1].lat, points[i - 1].lng], [points[i].lat, points[i].lng]);
    }
    return total;
  }

  clearAll() {
    this.routes = [];
    this.pointsByRoute.clear();
    this.markers = [];
    this.favorites = [];
    this.markersLayerGroup.clearLayers();
    this.favoritesLayerGroup.clearLayers();
    this.mapInstance.routesLayerGroup.clearLayers();
  }

  /**
   * Oculta los marcadores de datos (marcadores.txt / favoritos.txt) del mapa.
   * Usado en la vista FOTOS para que solo queden los puntos de referencia de fotos.
   */
  hideDataMarkers() {
    if (this.mapInstance && this.mapInstance.map) {
      if (this.markersLayerGroup) this.mapInstance.map.removeLayer(this.markersLayerGroup);
      if (this.favoritesLayerGroup) this.mapInstance.map.removeLayer(this.favoritesLayerGroup);
    }
  }

  showDataMarkers() {
    if (this.mapInstance && this.mapInstance.map) {
      if (this.markersLayerGroup) this.markersLayerGroup.addTo(this.mapInstance.map);
      if (this.favoritesLayerGroup) this.favoritesLayerGroup.addTo(this.mapInstance.map);
    }
  }

  /**
   * Agrega una ruta de forma incremental a la colección activa.
   * @param {object} routeData - { id, name, startTime, endTime, startDate, ... }
   * @param {Array} points - Array de puntos { lat, lng, ele, time, speed, timestamp }
   * @param {boolean} renderNow - Renderizar inmediatamente en el mapa (default true)
   * @returns {object} la ruta agregada
   */
  addRoute(routeData, points = [], renderNow = true) {
    if (!points || points.length === 0) {
      throw new Error('La ruta debe contener al menos un punto geográfico.');
    }

    let id = routeData.id ? String(routeData.id) : null;
    if (!id || this.pointsByRoute.has(id)) {
      id = `r_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }

    const distM = routeData.distanceM !== undefined 
      ? routeData.distanceM 
      : this.calculateDistance(points);
    const distKm = (distM / 1000).toFixed(2);

    let startTime = parseFlexibleTimestamp(routeData.startTime);
    let endTime = parseFlexibleTimestamp(routeData.endTime);
    if (!startTime && points && points.length > 0) {
      const firstWithTime = points.find(p => p.time || p.timestamp);
      if (firstWithTime) {
        startTime = parseFlexibleTimestamp(firstWithTime.timestamp || firstWithTime.time);
      }
    }
    if (!startTime && routeData.lastModified) {
      startTime = parseFlexibleTimestamp(routeData.lastModified);
    }

    let startDate = routeData.startDate;
    if (!startDate || startDate === 'Fecha N/D') {
      startDate = startTime ? new Date(startTime).toLocaleString() : 'Fecha N/D';
    }

    const newRoute = {
      id,
      name: routeData.name || `Ruta ${this.routes.length + 1}`,
      startTime: startTime || null,
      endTime: endTime || null,
      startDate,
      distanceKm: distKm,
      distanceM: Math.round(distM),
      maxSpeed: routeData.maxSpeed || '0.0',
      avgSpeed: routeData.avgSpeed || '0.0',
      durationMin: routeData.durationMin || 0,
      fileName: routeData.fileName || null,
      lastModified: routeData.lastModified || null
    };

    this.routes.push(newRoute);
    this.pointsByRoute.set(id, points);
    this.visibleRoutes.add(id);

    if (renderNow) {
      this.renderSingleRoute(id);
    }

    return newRoute;
  }

  /**
   * Renderiza una sola ruta en el mapa y la agrega a los grupos de capas
   * @param {string} routeId
   * @returns {L.LatLngBounds|null}
   */
  renderSingleRoute(routeId) {
    const points = this.pointsByRoute.get(routeId);
    if (!points || points.length === 0) return null;

    if (this.routeLayers.has(routeId)) {
      const existing = this.routeLayers.get(routeId);
      this.mapInstance.routesLayerGroup.removeLayer(existing.trackGroup);
      this.mapInstance.routeMarkersLayerGroup.removeLayer(existing.markersGroup);
      if (existing.arrowsGroup) this.mapInstance.routeArrowsLayerGroup.removeLayer(existing.arrowsGroup);
      this.routeLayers.delete(routeId);
    }

    const colorMap = this.getRouteColorMap();
    const routeColor = colorMap.get(routeId) || '#00f0ff';
    const latLngs = points.map(p => [p.lat, p.lng]);
    const routeInfo = this.routes.find(r => r.id === routeId);

    const glowLine = L.polyline(latLngs, {
      color: routeColor,
      weight: 6,
      opacity: 0.4,
      lineCap: 'round'
    });

    const coreLine = L.polyline(latLngs, {
      color: routeColor,
      weight: 3,
      opacity: 0.95,
      lineCap: 'round'
    });

    const trackGroup = L.featureGroup([glowLine, coreLine]);

    const popupHtml = `
      <div class="tactical-popup" style="padding: 0.75rem;">
        <h4 style="color: ${routeColor}; font-size: 0.85rem; margin-bottom: 0.25rem;">🏁 ${routeInfo?.name || `Ruta ${routeId}`}</h4>
        <div class="monospace" style="font-size: 0.68rem; color: #cbd5e1; display: flex; flex-direction: column; gap: 3px;">
          <div><span>Distancia:</span> <strong>${routeInfo?.distanceKm || (this.calculateDistance(points) / 1000).toFixed(2)} km</strong></div>
          <div><span>Fecha:</span> ${routeInfo?.startDate || 'N/D'}</div>
          <div><span>Puntos:</span> ${points.length}</div>
        </div>
      </div>
    `;
    coreLine.bindPopup(popupHtml);

    const markersGroup = L.layerGroup();
    const startPin = L.divIcon({
      className: 'native-pin-start',
      html: `<div style="background:#10b981; color:#000; font-weight:800; font-size:9px; padding:2px 5px; border-radius:3px; border:1px solid #fff;">INICIO</div>`,
      iconSize: [45, 16]
    });
    markersGroup.addLayer(L.marker(latLngs[0], { icon: startPin }));

    const endPin = L.divIcon({
      className: 'native-pin-end',
      html: `<div style="background:#f43f5e; color:#fff; font-weight:800; font-size:9px; padding:2px 5px; border-radius:3px; border:1px solid #fff;">FIN</div>`,
      iconSize: [35, 16]
    });
    markersGroup.addLayer(L.marker(latLngs[latLngs.length - 1], { icon: endPin }));

    const arrowsGroup = this.mapInstance.addRouteArrows(latLngs, '#ffffff');

    this.mapInstance.routesLayerGroup.addLayer(trackGroup);
    this.mapInstance.routeMarkersLayerGroup.addLayer(markersGroup);

    this.routeLayers.set(routeId, { trackGroup, markersGroup, arrowsGroup });
    return trackGroup.getBounds();
  }

  /**
   * Cambia el nombre de una ruta tanto en memoria como en su popup de mapa
   * @param {string} routeId
   * @param {string} newName
   * @returns {object|null}
   */
  renameRoute(routeId, newName) {
    const route = this.routes.find(r => r.id === routeId);
    if (!route) return null;
    const cleanName = (newName || '').trim();
    if (cleanName.length > 0) {
      route.name = cleanName;
      const grp = this.routeLayers.get(routeId);
      if (grp && grp.trackGroup) {
        const colorMap = this.getRouteColorMap();
        const routeColor = colorMap.get(routeId) || '#00f0ff';
        const points = this.pointsByRoute.get(routeId) || [];
        const popupHtml = `
          <div class="tactical-popup" style="padding: 0.75rem;">
            <h4 style="color: ${routeColor}; font-size: 0.85rem; margin-bottom: 0.25rem;">🏁 ${route.name}</h4>
            <div class="monospace" style="font-size: 0.68rem; color: #cbd5e1; display: flex; flex-direction: column; gap: 3px;">
              <div><span>Distancia:</span> <strong>${route.distanceKm} km</strong></div>
              <div><span>Fecha:</span> ${route.startDate || 'N/D'}</div>
              <div><span>Puntos:</span> ${points.length}</div>
            </div>
          </div>
        `;
        grp.trackGroup.eachLayer(layer => {
          if (layer.bindPopup) layer.bindPopup(popupHtml);
        });
      }
    }
    return route;
  }

  /**
   * Elimina una ruta de la colección y retira sus capas del mapa
   * @param {string} routeId
   */
  removeRoute(routeId) {
    if (this.routeLayers.has(routeId)) {
      const { trackGroup, markersGroup, arrowsGroup } = this.routeLayers.get(routeId);
      this.mapInstance.routesLayerGroup.removeLayer(trackGroup);
      this.mapInstance.routeMarkersLayerGroup.removeLayer(markersGroup);
      if (arrowsGroup) this.mapInstance.routeArrowsLayerGroup.removeLayer(arrowsGroup);
      this.routeLayers.delete(routeId);
    }
    this.pointsByRoute.delete(routeId);
    this.visibleRoutes.delete(routeId);
    this.routes = this.routes.filter(r => r.id !== routeId);
  }

  /**
   * Exporta una ruta individual en formato GPX XML
   * @param {string} routeId
   * @param {string} customName - Nombre personalizado opcional
   * @returns {string|null} XML GPX
   */
  exportRouteToGpx(routeId, customName = null) {
    const route = this.routes.find(r => r.id === routeId);
    const points = this.pointsByRoute.get(routeId);
    if (!points || points.length === 0) return null;
    const name = customName || route?.name || `Ruta ${routeId}`;
    return createGpxXml(name, points, this.markers);
  }

  /**
   * Recalcula estadísticas acumuladas de todas las rutas cargadas
   * @returns {object}
   */
  recalculateStats() {
    const totalDistKm = this.routes.reduce((acc, r) => acc + parseFloat(r.distanceKm || 0), 0).toFixed(2);
    const totalPoints = Array.from(this.pointsByRoute.values()).reduce((acc, pts) => acc + pts.length, 0);
    return {
      routesCount: this.routes.length,
      totalDistanceKm: totalDistKm,
      totalPoints,
      markersCount: this.markers.length,
      favoritesCount: this.favorites.length
    };
  }
}

