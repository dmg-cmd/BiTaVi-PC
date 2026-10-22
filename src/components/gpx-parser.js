import L from 'leaflet';

export class GpxHandler {
  constructor(mapInstance) {
    this.mapInstance = mapInstance;
    this.currentTrackLayer = null;
    this.startMarker = null;
    this.endMarker = null;
  }

  parseGpxText(gpxText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxText, 'text/xml');
    
    // Check for parse error
    const parseError = xmlDoc.getElementsByTagName('parsererror');
    if (parseError.length > 0) {
      throw new Error('Error al interpretar el archivo GPX');
    }

    const trackPoints = [];
    let trkpts = xmlDoc.getElementsByTagName('trkpt');
    if (trkpts.length === 0) {
      trkpts = xmlDoc.getElementsByTagName('rtept');
    }

    let totalDistance = 0;
    let minElevation = Infinity;
    let maxElevation = -Infinity;

    for (let i = 0; i < trkpts.length; i++) {
      const pt = trkpts[i];
      const lat = parseFloat(pt.getAttribute('lat'));
      const lon = parseFloat(pt.getAttribute('lon'));
      
      const eleEl = pt.getElementsByTagName('ele')[0];
      const ele = eleEl ? parseFloat(eleEl.textContent) : null;
      
      const timeEl = pt.getElementsByTagName('time')[0];
      const time = timeEl ? timeEl.textContent : null;

      if (!isNaN(lat) && !isNaN(lon)) {
        trackPoints.push({ lat, lng: lon, ele, time });

        if (ele !== null && !isNaN(ele)) {
          if (ele < minElevation) minElevation = ele;
          if (ele > maxElevation) maxElevation = ele;
        }

        if (trackPoints.length > 1) {
          const prev = trackPoints[trackPoints.length - 2];
          totalDistance += this.haversineDistance(prev.lat, prev.lng, lat, lon);
        }
      }
    }

    // Extract Waypoints (<wpt>)
    const waypoints = [];
    const wpts = xmlDoc.getElementsByTagName('wpt');
    for (let i = 0; i < wpts.length; i++) {
      const wpt = wpts[i];
      const lat = parseFloat(wpt.getAttribute('lat'));
      const lon = parseFloat(wpt.getAttribute('lon'));
      const nameEl = wpt.getElementsByTagName('name')[0];
      const name = nameEl ? nameEl.textContent : `Punto ${i + 1}`;
      if (!isNaN(lat) && !isNaN(lon)) {
        waypoints.push({ lat, lng: lon, name });
      }
    }

    // Extract Track / Route Name
    let trackName = null;
    const nameEl = xmlDoc.querySelector('trk > name, rte > name, metadata > name');
    if (nameEl && nameEl.textContent) {
      trackName = nameEl.textContent.trim();
    }

    return {
      name: trackName,
      points: trackPoints,
      waypoints,
      totalDistanceKm: (totalDistance / 1000).toFixed(2),
      pointsCount: trackPoints.length,
      minElevation: minElevation === Infinity ? null : Math.round(minElevation),
      maxElevation: maxElevation === -Infinity ? null : Math.round(maxElevation)
    };
  }

  renderTrack(parsedData) {
    this.clearTrack();

    if (!parsedData.points || parsedData.points.length === 0) return null;

    const latLngs = parsedData.points.map(p => [p.lat, p.lng]);

    // Outer glow track polyline
    const glowLine = L.polyline(latLngs, {
      color: '#00f0ff',
      weight: 6,
      opacity: 0.35,
      lineCap: 'round',
      lineJoin: 'round'
    });

    // Inner bright tactical core line
    const coreLine = L.polyline(latLngs, {
      color: '#00f0ff',
      weight: 3,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round'
    });

    this.currentTrackLayer = L.featureGroup([glowLine, coreLine]);
    this.mapInstance.routesLayerGroup.addLayer(this.currentTrackLayer);

    // Start marker
    const startPoint = latLngs[0];
    const startIcon = L.divIcon({
      className: 'gpx-terminal-pin start',
      html: '<div style="background:#10b981; color:#000; font-weight:800; font-size:10px; padding:2px 6px; border-radius:4px; border:1px solid #fff; box-shadow:0 0 10px #10b981;">INICIO</div>',
      iconSize: [40, 20],
      iconAnchor: [20, 10]
    });
    this.startMarker = L.marker(startPoint, { icon: startIcon }).addTo(this.mapInstance.routeMarkersLayerGroup);

    // End marker
    const endPoint = latLngs[latLngs.length - 1];
    const endIcon = L.divIcon({
      className: 'gpx-terminal-pin end',
      html: '<div style="background:#f43f5e; color:#fff; font-weight:800; font-size:10px; padding:2px 6px; border-radius:4px; border:1px solid #fff; box-shadow:0 0 10px #f43f5e;">FIN</div>',
      iconSize: [30, 20],
      iconAnchor: [15, 10]
    });
    this.endMarker = L.marker(endPoint, { icon: endIcon }).addTo(this.mapInstance.routeMarkersLayerGroup);

    // Chevrons direccionales sutiles en blanco (paridad con BiTaVi Android)
    this.mapInstance.addRouteArrows(latLngs, '#ffffff');

    // Renderizar Waypoints / POIs si el archivo GPX los incluye
    if (parsedData.waypoints && parsedData.waypoints.length > 0) {
      this.mapInstance.waypointsLayerGroup.clearLayers();
      parsedData.waypoints.forEach((wp, idx) => {
        const wpIcon = L.divIcon({
          className: 'gpx-waypoint-pin',
          html: `<div style="background:#00f0ff; color:#050914; font-weight:800; font-size:9px; padding:2px 5px; border-radius:3px; border:1px solid #fff; box-shadow:0 0 8px rgba(0,240,255,0.8); white-space:nowrap;">📍 ${wp.name || `Punto ${idx + 1}`}</div>`,
          iconSize: [50, 18],
          iconAnchor: [25, 9]
        });
        L.marker([wp.lat, wp.lng], { icon: wpIcon })
          .bindPopup(`<strong>${wp.name}</strong><br>Lat: ${wp.lat.toFixed(5)}<br>Lng: ${wp.lng.toFixed(5)}`)
          .addTo(this.mapInstance.waypointsLayerGroup);
      });
    }

    // Fit map view to track
    this.mapInstance.fitBounds(this.currentTrackLayer.getBounds());

    return this.currentTrackLayer.getBounds();
  }

  clearTrack() {
    this.mapInstance.routesLayerGroup.clearLayers();
    this.mapInstance.routeMarkersLayerGroup.clearLayers();
    this.mapInstance.routeArrowsLayerGroup.clearLayers();
    this.mapInstance.waypointsLayerGroup.clearLayers();
    this.currentTrackLayer = null;
    this.startMarker = null;
    this.endMarker = null;
  }

  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const toRad = x => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

/**
 * Genera el documento XML estándar GPX 1.1 para una ruta con sus puntos y waypoints.
 * @param {string} name - Nombre de la ruta
 * @param {Array<{lat: number, lng: number, ele?: number, time?: string, speed?: number, timestamp?: number}>} points - Puntos GPS
 * @param {Array<{lat: number, lng: number, name?: string, desc?: string}>} waypoints - Puntos de interés opcionales
 * @returns {string} XML GPX 1.1 válido
 */
export function createGpxXml(name, points = [], waypoints = []) {
  const safeName = (name || 'Ruta BiTaVi')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const nowIso = new Date().toISOString();

  let wptXml = '';
  if (waypoints && waypoints.length > 0) {
    wptXml = waypoints.map(w => {
      const wName = (w.name || 'Waypoint')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const wDesc = w.desc
        ? `\n    <desc>${w.desc.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</desc>`
        : '';
      return `  <wpt lat="${w.lat}" lon="${w.lng}">\n    <name>${wName}</name>${wDesc}\n  </wpt>`;
    }).join('\n') + '\n';
  }

  let trkptXml = '';
  if (points && points.length > 0) {
    trkptXml = points.map(p => {
      const eleTag = (p.ele !== null && p.ele !== undefined && !isNaN(p.ele))
        ? `\n        <ele>${p.ele}</ele>`
        : '';
      const isoTime = p.time
        ? p.time
        : (p.timestamp ? new Date(p.timestamp).toISOString() : null);
      const timeTag = isoTime ? `\n        <time>${isoTime}</time>` : '';
      const speedTag = (p.speed !== null && p.speed !== undefined && !isNaN(p.speed))
        ? `\n        <speed>${p.speed}</speed>`
        : '';
      return `      <trkpt lat="${p.lat}" lon="${p.lng}">${eleTag}${timeTag}${speedTag}\n      </trkpt>`;
    }).join('\n');
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="BiTaVi PC" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${safeName}</name>
    <time>${nowIso}</time>
  </metadata>
${wptXml}  <trk>
    <name>${safeName}</name>
    <trkseg>
${trkptXml}
    </trkseg>
  </trk>
</gpx>`;
}

/**
 * Genera un archivo GPX 1.1 unificado con múltiples segmentos de ruta (<trkseg>).
 * Permite guardar varias rutas marcadas como una sola ruta continua o multisegmento.
 * @param {string} name
 * @param {Array<Array<object>>|Array<object>} segments - Lista de arrays de puntos por segmento, o array único de puntos
 * @param {Array<object>} waypoints
 * @returns {string} XML GPX 1.1
 */
export function createCombinedGpxXml(name, segments = [], waypoints = []) {
  const safeName = (name || 'Ruta Unificada BiTaVi')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const nowIso = new Date().toISOString();

  let wptXml = '';
  if (waypoints && waypoints.length > 0) {
    wptXml = waypoints.map(w => {
      const wName = (w.name || 'Waypoint')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const wDesc = w.desc
        ? `\n    <desc>${w.desc.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</desc>`
        : '';
      return `  <wpt lat="${w.lat}" lon="${w.lng}">\n    <name>${wName}</name>${wDesc}\n  </wpt>`;
    }).join('\n') + '\n';
  }

  // Normalizar segments: si se pasa un array simple de puntos [{lat,lng}], envolverlo en [points]
  const segmentList = (segments.length > 0 && !Array.isArray(segments[0]))
    ? [segments]
    : segments;

  let trksegsXml = '';
  for (const pts of segmentList) {
    if (!pts || pts.length === 0) continue;
    const ptsXml = pts.map(p => {
      const eleTag = (p.ele !== null && p.ele !== undefined && !isNaN(p.ele))
        ? `\n        <ele>${p.ele}</ele>`
        : '';
      const isoTime = p.time
        ? p.time
        : (p.timestamp ? new Date(p.timestamp).toISOString() : null);
      const timeTag = isoTime ? `\n        <time>${isoTime}</time>` : '';
      const speedTag = (p.speed !== null && p.speed !== undefined && !isNaN(p.speed))
        ? `\n        <speed>${p.speed}</speed>`
        : '';
      return `      <trkpt lat="${p.lat}" lon="${p.lng}">${eleTag}${timeTag}${speedTag}\n      </trkpt>`;
    }).join('\n');

    trksegsXml += `    <trkseg>\n${ptsXml}\n    </trkseg>\n`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="BiTaVi PC" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${safeName}</name>
    <time>${nowIso}</time>
  </metadata>
${wptXml}  <trk>
    <name>${safeName}</name>
${trksegsXml}  </trk>
</gpx>`;
}

/**
 * Extrae una cadena de fecha limpia en formato YYYY-MM-DD para nombrar archivos a partir de los datos de una ruta.
 * Prioriza: startTime de la ruta -> time/timestamp del primer punto -> fecha en el nombre -> fecha actual.
 * @param {object} route
 * @param {Array<object>} points
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
export function extractRouteDateSlug(route, points = []) {
  // 1. Probar startTime de la ruta
  if (route && route.startTime) {
    const d = new Date(route.startTime);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  }

  // 2. Probar primer punto con time o timestamp
  if (points && points.length > 0) {
    const firstPt = points[0];
    if (firstPt.time) {
      const matchIso = String(firstPt.time).match(/\b(\d{4}-\d{2}-\d{2})\b/);
      if (matchIso) return matchIso[1];
      const d = new Date(firstPt.time);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    if (firstPt.timestamp) {
      const d = new Date(firstPt.timestamp);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
  }

  // 3. Probar fecha en el nombre de la ruta (ej: "backup_20260626", "2026-06-26", "2026_06_26")
  if (route && route.name) {
    const matchDelim = route.name.match(/(?:^|[^0-9])(20\d{2})[-_]([01]\d)[-_]([0-3]\d)(?:[^0-9]|$)/);
    if (matchDelim) {
      return `${matchDelim[1]}-${matchDelim[2]}-${matchDelim[3]}`;
    }
    const matchCompact = route.name.match(/(?:^|[^0-9])(20\d{2})([01]\d)([0-3]\d)(?:[^0-9]|$)/);
    if (matchCompact) {
      return `${matchCompact[1]}-${matchCompact[2]}-${matchCompact[3]}`;
    }
  }

  // 4. Fallback: fecha actual del sistema
  return new Date().toISOString().split('T')[0];
}

/**
 * Agrupa una lista de rutas por día cronológico (YYYY-MM-DD).
 * @param {Array<object>} routes - Lista de rutas
 * @param {Map<string, Array<object>>} pointsByRouteMap - Mapa de puntos por id de ruta
 * @returns {Map<string, Array<object>>} Mapa ordenado por fecha con la lista de rutas correspondientes
 */
export function groupRoutesByDay(routes = [], pointsByRouteMap = new Map()) {
  const grouped = new Map();

  for (const r of routes) {
    const pts = (pointsByRouteMap && typeof pointsByRouteMap.get === 'function')
      ? (pointsByRouteMap.get(r.id) || [])
      : [];
    const dateSlug = extractRouteDateSlug(r, pts);
    if (!grouped.has(dateSlug)) {
      grouped.set(dateSlug, []);
    }
    grouped.get(dateSlug).push(r);
  }

  // Ordenar cronológicamente por fecha
  const sortedKeys = Array.from(grouped.keys()).sort();
  const sortedMap = new Map();
  for (const k of sortedKeys) {
    sortedMap.set(k, grouped.get(k));
  }

  return sortedMap;
}

/**
 * Limpia un nombre de ruta para que sea un nombre de archivo seguro en Windows y Linux.
 * @param {string} name
 * @param {string} fallback
 * @returns {string}
 */
export function sanitizeFilename(name, fallback = 'ruta') {
  if (!name || typeof name !== 'string') return fallback;
  const clean = name.trim().replace(/[\\/:*?"<>|]+/g, '_');
  return clean.length > 0 ? clean : fallback;
}

/**
 * Descarga en el navegador un Blob binario o de texto con el nombre indicado.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
