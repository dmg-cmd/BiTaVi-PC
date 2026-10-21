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
