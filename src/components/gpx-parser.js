import L from 'leaflet';
import { parseFlexibleTimestamp } from './bitavi-native-parser.js';

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

    // Extract Track / Route / Metadata Time
    let trackTime = null;
    const timeEl = xmlDoc.querySelector('metadata > time, trk > time, rte > time');
    if (timeEl && timeEl.textContent) {
      trackTime = timeEl.textContent.trim();
    }
    if (!trackTime && trackPoints.length > 0) {
      const firstWithTime = trackPoints.find(p => p.time);
      if (firstWithTime) {
        trackTime = firstWithTime.time;
      }
    }

    let startTime = null;
    let startDate = null;
    if (trackTime) {
      const parsedTime = parseFlexibleTimestamp(trackTime);
      if (parsedTime) {
        startTime = parsedTime;
        const d = new Date(startTime);
        if (!isNaN(d.getTime())) {
          startDate = d.toISOString().split('T')[0];
        }
      } else {
        const fromName = extractDateFromName(trackTime);
        if (fromName) {
          startDate = fromName;
          const d = new Date(`${fromName}T12:00:00Z`);
          if (!isNaN(d.getTime())) startTime = d.getTime();
        }
      }
    }

    return {
      name: trackName,
      time: trackTime,
      startTime,
      startDate,
      points: trackPoints,
      waypoints,
      totalDistanceKm: (totalDistance / 1000).toFixed(2),
      pointsCount: trackPoints.length,
      minElevation: minElevation === Infinity ? null : Math.round(minElevation),
      maxElevation: maxElevation === -Infinity ? null : Math.round(maxElevation)
    };
  }

  /**
   * Extrae una o múltiples rutas desde un texto GPX (soporta múltiples <trk> o <rte>).
   * @param {string} gpxText
   * @param {string} fallbackName
   * @returns {Array<{name: string, startTime: number|null, startDate: string|null, points: Array, waypoints: Array}>}
   */
  parseGpxTracks(gpxText, fallbackName = 'Ruta GPX') {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxText, 'text/xml');
    const parseError = xmlDoc.getElementsByTagName('parsererror');
    if (parseError.length > 0) {
      throw new Error('Error al interpretar el archivo GPX');
    }

    const metaTimeEl = xmlDoc.querySelector('metadata > time');
    const metaTimeStr = metaTimeEl && metaTimeEl.textContent ? metaTimeEl.textContent.trim() : null;
    const metaNameEl = xmlDoc.querySelector('metadata > name');
    const metaNameStr = metaNameEl && metaNameEl.textContent ? metaNameEl.textContent.trim() : null;

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

    const results = [];
    let containers = Array.from(xmlDoc.getElementsByTagName('trk'));
    let ptTagName = 'trkpt';
    if (containers.length === 0) {
      containers = Array.from(xmlDoc.getElementsByTagName('rte'));
      ptTagName = 'rtept';
    }

    if (containers.length === 0) {
      const single = this.parseGpxText(gpxText);
      if (single && single.points && single.points.length > 0) {
        return [{
          name: single.name || fallbackName,
          startTime: single.startTime,
          startDate: single.startDate,
          points: single.points,
          waypoints: single.waypoints || []
        }];
      }
      return [];
    }

    containers.forEach((trkEl, idx) => {
      const ptsEls = trkEl.getElementsByTagName(ptTagName);
      const pts = [];
      for (let i = 0; i < ptsEls.length; i++) {
        const pt = ptsEls[i];
        const lat = parseFloat(pt.getAttribute('lat'));
        const lon = parseFloat(pt.getAttribute('lon'));
        const eleEl = pt.getElementsByTagName('ele')[0];
        const ele = eleEl ? parseFloat(eleEl.textContent) : null;
        const timeEl = pt.getElementsByTagName('time')[0];
        const time = timeEl ? timeEl.textContent.trim() : null;
        if (!isNaN(lat) && !isNaN(lon)) {
          pts.push({ lat, lng: lon, ele, time });
        }
      }

      if (pts.length === 0) return;

      const trkNameEl = trkEl.querySelector(':scope > name') || trkEl.getElementsByTagName('name')[0];
      const rawName = (trkNameEl && trkNameEl.textContent) ? trkNameEl.textContent.trim() : null;
      const name = rawName || (containers.length === 1 ? (metaNameStr || fallbackName) : `${metaNameStr || fallbackName} (${idx + 1})`);

      const trkTimeEl = trkEl.querySelector(':scope > time');
      let trackTime = (trkTimeEl && trkTimeEl.textContent) ? trkTimeEl.textContent.trim() : null;
      if (!trackTime) {
        const firstWithTime = pts.find(p => p.time);
        if (firstWithTime) trackTime = firstWithTime.time;
      }
      if (!trackTime && metaTimeStr) {
        trackTime = metaTimeStr;
      }

      let startTime = null;
      let startDate = null;
      if (trackTime) {
        const parsedTime = parseFlexibleTimestamp(trackTime);
        if (parsedTime) {
          startTime = parsedTime;
          const d = new Date(startTime);
          if (!isNaN(d.getTime())) {
            startDate = d.toISOString().split('T')[0];
          }
        } else {
          const fromName = extractDateFromName(trackTime);
          if (fromName) {
            startDate = fromName;
            const d = new Date(`${fromName}T12:00:00Z`);
            if (!isNaN(d.getTime())) startTime = d.getTime();
          }
        }
      }

      if (!startDate) {
        const fromTrackName = extractDateFromName(name) || extractDateFromName(fallbackName);
        if (fromTrackName) {
          startDate = fromTrackName;
          if (!startTime) {
            const d = new Date(`${fromTrackName}T12:00:00Z`);
            if (!isNaN(d.getTime())) startTime = d.getTime();
          }
        }
      }

      results.push({
        name,
        startTime,
        startDate,
        points: pts,
        waypoints: idx === 0 ? waypoints : []
      });
    });

    return results;
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

const MONTH_NAME_MAP = {
  ene: '01', enero: '01', jan: '01', january: '01',
  feb: '02', febrero: '02', february: '02',
  mar: '03', marzo: '03', march: '03',
  abr: '04', abril: '04', apr: '04', april: '04',
  may: '05', mayo: '05',
  jun: '06', junio: '06', june: '06',
  jul: '07', julio: '07', july: '07',
  ago: '08', agosto: '08', aug: '08', august: '08',
  sep: '09', set: '09', sept: '09', septiembre: '09', setiembre: '09', september: '09',
  oct: '10', octubre: '10', october: '10',
  nov: '11', noviembre: '11', november: '11',
  dic: '12', diciembre: '12', dec: '12', december: '12'
};

/**
 * Extrae una fecha en formato YYYY-MM-DD a partir de un texto (nombre de ruta, archivo o cadena de fecha).
 * Soporta YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY,
 * fechas con meses en texto ("16 abr 2026", "5 jun 2026", "16 de abril de 2026"), YYYYMMDD y DDMMYYYY.
 * @param {string} text
 * @returns {string|null}
 */
export function extractDateFromName(text) {
  if (!text || typeof text !== 'string') return null;

  // 1. Formato YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD o YYYY_MM_DD
  const mYmd = text.match(/(?:^|[^0-9])(20\d{2})[-/._]([01]?\d)[-/._]([0-3]?\d)(?:[^0-9]|$)/);
  if (mYmd) {
    const y = mYmd[1];
    const m = mYmd[2].padStart(2, '0');
    const d = mYmd[3].padStart(2, '0');
    const mNum = parseInt(m, 10);
    const dNum = parseInt(d, 10);
    if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
      return `${y}-${m}-${d}`;
    }
  }

  // 2. Formato DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY o DD_MM_YYYY
  const mDmy = text.match(/(?:^|[^0-9])([0-3]?\d)[-/._]([01]?\d)[-/._](20\d{2})(?:[^0-9]|$)/);
  if (mDmy) {
    const d = mDmy[1].padStart(2, '0');
    const m = mDmy[2].padStart(2, '0');
    const y = mDmy[3];
    const dNum = parseInt(d, 10);
    const mNum = parseInt(m, 10);
    if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
      return `${y}-${m}-${d}`;
    }
  }

  // 3. Formato con nombre de mes en español/inglés: "16 abr 2026", "5 jun. 2026", "16 de abril de 2026"
  const mTextMonthDmy = text.match(/(?:^|[^0-9])([0-3]?\d)\s*(?:de\s+|[-/._]\s*)?([a-zA-Záéíóúñ]{3,10})\.?\s*(?:de\s+|[-/._,]\s*)?(20\d{2})(?:[^0-9]|$)/i);
  if (mTextMonthDmy) {
    const d = mTextMonthDmy[1].padStart(2, '0');
    const mKey = mTextMonthDmy[2].toLowerCase();
    const y = mTextMonthDmy[3];
    const m = MONTH_NAME_MAP[mKey] || MONTH_NAME_MAP[mKey.slice(0, 3)];
    const dNum = parseInt(d, 10);
    if (m && dNum >= 1 && dNum <= 31) {
      return `${y}-${m}-${d}`;
    }
  }

  // 4. Formato mes en texto primero: "abr 16, 2026" o "jun 5 2026"
  const mTextMonthMdy = text.match(/(?:^|[^a-zA-Z])([a-zA-Záéíóúñ]{3,10})\.?\s+([0-3]?\d)(?:,|\s+de)?\s+(20\d{2})(?:[^0-9]|$)/i);
  if (mTextMonthMdy) {
    const mKey = mTextMonthMdy[1].toLowerCase();
    const d = mTextMonthMdy[2].padStart(2, '0');
    const y = mTextMonthMdy[3];
    const m = MONTH_NAME_MAP[mKey] || MONTH_NAME_MAP[mKey.slice(0, 3)];
    const dNum = parseInt(d, 10);
    if (m && dNum >= 1 && dNum <= 31) {
      return `${y}-${m}-${d}`;
    }
  }

  // 5. Formato compacto YYYYMMDD (ej: backup_20260626, 20260626_2305)
  const mCompactYmd = text.match(/(?:^|[^0-9])(20\d{2})([01]\d)([0-3]\d)(?:[^0-9]|$)/);
  if (mCompactYmd) {
    const y = mCompactYmd[1];
    const m = mCompactYmd[2];
    const d = mCompactYmd[3];
    const mNum = parseInt(m, 10);
    const dNum = parseInt(d, 10);
    if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
      return `${y}-${m}-${d}`;
    }
  }

  // 6. Formato compacto DDMMYYYY (ej: ruta_26062026)
  const mCompactDmy = text.match(/(?:^|[^0-9])([0-3]\d)([01]\d)(20\d{2})(?:[^0-9]|$)/);
  if (mCompactDmy) {
    const d = mCompactDmy[1];
    const m = mCompactDmy[2];
    const y = mCompactDmy[3];
    const dNum = parseInt(d, 10);
    const mNum = parseInt(m, 10);
    if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
      return `${y}-${m}-${d}`;
    }
  }

  return null;
}

/**
 * Extrae una cadena de fecha limpia en formato YYYY-MM-DD para nombrar archivos y agrupar rutas.
 * Prioriza:
 * 1) Fecha explícita en el nombre de la ruta (ej: "Auto-Ruta 2026-06-13 12:55", "16 abr 2026 10:12:33")
 * 2) Fecha explícita en el nombre del archivo (route.fileName)
 * 3) Puntos GPS con time/timestamp válido (> 0)
 * 4) startTime / startDate de la ruta
 * 5) lastModified / id -> 'Sin Fecha'
 * @param {object} route
 * @param {Array<object>} points
 * @returns {string} Fecha en formato YYYY-MM-DD o 'Sin Fecha'
 */
export function extractRouteDateSlug(route, points = []) {
  // 1. Priorizar fecha explícita escrita en el nombre de la ruta (en BiTaVi Android el nombre conserva
  //    la fecha real del recorrido incluso cuando SQLite reasigna startTime al restaurar un backup)
  if (route && route.name) {
    const fromName = extractDateFromName(route.name);
    if (fromName) return fromName;
  }

  // 2. Probar route.fileName si existe y tiene fecha en el nombre del archivo
  if (route && route.fileName) {
    const fromFile = extractDateFromName(route.fileName);
    if (fromFile) return fromFile;
  }

  // 3. Probar puntos de la ruta (examinar los primeros 30 puntos por si alguno tiene fecha real > 0)
  if (points && points.length > 0) {
    const maxScan = Math.min(points.length, 30);
    for (let i = 0; i < maxScan; i++) {
      const pt = points[i];
      if (pt.timestamp) {
        const num = Number(pt.timestamp);
        if (!isNaN(num) && num > 0) {
          const ms = (num > 1000000000 && num < 10000000000) ? num * 1000 : num;
          const d = new Date(ms);
          if (!isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2100) {
            return d.toISOString().split('T')[0];
          }
        }
      }
      if (pt.time) {
        const fromTime = extractDateFromName(String(pt.time));
        if (fromTime) return fromTime;
        const d = new Date(pt.time);
        if (!isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2100) {
          return d.toISOString().split('T')[0];
        }
      }
    }
  }

  // 4. Probar startTime de la ruta
  if (route && route.startTime) {
    const num = Number(route.startTime);
    if (!isNaN(num) && num > 0) {
      const ms = (num > 1000000000 && num < 10000000000) ? num * 1000 : num;
      const d = new Date(ms);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2100) {
        return d.toISOString().split('T')[0];
      }
    } else if (typeof route.startTime === 'string') {
      const fromStr = extractDateFromName(route.startTime);
      if (fromStr) return fromStr;
    }
  }

  // 5. Probar route.startDate si existe y no es 'Fecha N/D'
  if (route && route.startDate && route.startDate !== 'Fecha N/D') {
    const fromStart = extractDateFromName(route.startDate);
    if (fromStart) return fromStart;
  }

  // 6. Probar route.lastModified si existe
  if (route && route.lastModified) {
    const num = Number(route.lastModified);
    if (!isNaN(num) && num > 1000000000) {
      const ms = (num < 10000000000) ? num * 1000 : num;
      const d = new Date(ms);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2100) {
        return d.toISOString().split('T')[0];
      }
    }
  }

  // 7. Probar route.id (por si es un timestamp o contiene fecha)
  if (route && route.id) {
    const fromId = extractDateFromName(String(route.id));
    if (fromId) return fromId;
    const numId = Number(route.id);
    if (!isNaN(numId) && numId > 1000000000) {
      const ms = (numId < 10000000000) ? numId * 1000 : numId;
      const d = new Date(ms);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2100) {
        return d.toISOString().split('T')[0];
      }
    }
  }

  // 8. Si no tiene fecha detectable, clasificar como 'Sin Fecha' (no asignar fecha de hoy)
  return 'Sin Fecha';
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

  // Ordenar cronológicamente por fecha, dejando 'Sin Fecha' al final
  const sortedKeys = Array.from(grouped.keys()).sort((a, b) => {
    if (a === 'Sin Fecha') return 1;
    if (b === 'Sin Fecha') return -1;
    return a.localeCompare(b);
  });

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
