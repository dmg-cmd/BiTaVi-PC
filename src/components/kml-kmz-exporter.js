import JSZip from 'jszip';
import { sanitizeFilename, downloadBlob } from './gpx-parser.js';

/**
 * Escapa caracteres especiales para XML / KML
 */
export function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convierte color hexadecimal (#RRGGBB) a formato KML (aabbggrr)
 * @param {string} hex Código hexadecimal
 * @param {string} alpha Opacidad en hex (ej: 'ff' para 100%, 'cc' para 80%)
 * @returns {string} Código KML aabbggrr
 */
export function hexToKmlColor(hex, alpha = 'ff') {
  if (!hex || typeof hex !== 'string') return `${alpha}ffffff`;
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length !== 6) return `${alpha}ffffff`;
  const r = clean.substring(0, 2);
  const g = clean.substring(2, 4);
  const b = clean.substring(4, 6);
  return `${alpha}${b}${g}${r}`.toLowerCase();
}

/**
 * Genera el documento XML estándar KML 2.2 para Google Earth 3D
 * @param {Object} data Datos a exportar: { routes, waypoints, photos, title }
 * @param {boolean} isKmz Indica si los enlaces a fotos son locales relativos para contenedor KMZ
 * @returns {string} XML KML formateado
 */
export function generateKmlXml({ routes = [], waypoints = [], photos = [], title = 'Expedición BiTaVi' }, isKmz = false) {
  const safeTitle = escapeXml(title);

  // 1. Definición de estilos para cada ruta
  const routeStyles = routes.map((r, i) => {
    const kmlColor = hexToKmlColor(r.color || '#00f0ff', 'ff');
    return `    <Style id="route_style_${i}">
      <LineStyle>
        <color>${kmlColor}</color>
        <width>4</width>
      </LineStyle>
    </Style>`;
  }).join('\n');

  // Estilo para waypoints y fotos
  const commonStyles = `    <Style id="waypoint_style">
      <IconStyle>
        <scale>1.1</scale>
        <Icon>
          <href>https://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href>
        </Icon>
      </IconStyle>
    </Style>
    <Style id="photo_style">
      <IconStyle>
        <scale>1.2</scale>
        <Icon>
          <href>https://maps.google.com/mapfiles/kml/shapes/camera.png</href>
        </Icon>
      </IconStyle>
    </Style>`;

  // 2. Placemarks de Rutas con LineString 3D
  const routeFolders = routes.map((r, i) => {
    const name = escapeXml(r.name || `Ruta ${i + 1}`);
    const dist = r.distanceKm ? `${r.distanceKm} km` : '';
    const points = r.points || [];
    if (points.length === 0) return '';

    // Comprobar si hay altitudes reales
    const hasElevation = points.some((p) => p.ele !== null && p.ele !== undefined && !isNaN(p.ele));
    const altitudeMode = hasElevation ? 'clampToGround' : 'clampToGround';

    const coordsStr = points.map((p) => {
      const alt = (p.ele !== null && p.ele !== undefined && !isNaN(p.ele)) ? p.ele : 0;
      return `${p.lng},${p.lat},${alt}`;
    }).join(' ');

    return `      <Placemark>
        <name>${name}</name>
        <description><![CDATA[
          <div style="font-family:sans-serif;">
            <p><b>Ruta:</b> ${name}</p>
            ${dist ? `<p><b>Distancia:</b> ${dist}</p>` : ''}
            <p><b>Puntos GPS:</b> ${points.length}</p>
            <p style="font-size:11px;color:#777;">Generado por BiTaVi PC</p>
          </div>
        ]]></description>
        <styleUrl>#route_style_${i}</styleUrl>
        <LineString>
          <extrude>1</extrude>
          <tessellate>1</tessellate>
          <altitudeMode>${altitudeMode}</altitudeMode>
          <coordinates>${coordsStr}</coordinates>
        </LineString>
      </Placemark>`;
  }).filter(Boolean).join('\n');

  // 3. Placemarks de Waypoints / POIs
  const waypointPlacemarks = (waypoints || []).map((wp, i) => {
    const name = escapeXml(wp.name || `Punto ${i + 1}`);
    const desc = escapeXml(wp.desc || wp.description || '');
    const alt = (wp.ele !== null && wp.ele !== undefined) ? wp.ele : 0;

    return `      <Placemark>
        <name>${name}</name>
        <description><![CDATA[
          <div style="font-family:sans-serif;">
            <h4 style="margin:0 0 4px 0;">${name}</h4>
            ${desc ? `<p>${desc}</p>` : ''}
            <p style="font-size:11px;color:#666;">Coord: ${wp.lat.toFixed(6)}, ${wp.lng.toFixed(6)}</p>
          </div>
        ]]></description>
        <styleUrl>#waypoint_style</styleUrl>
        <Point>
          <altitudeMode>clampToGround</altitudeMode>
          <coordinates>${wp.lng},${wp.lat},${alt}</coordinates>
        </Point>
      </Placemark>`;
  }).join('\n');

  // 4. Placemarks de Fotografías Geolocalizadas
  const photoPlacemarks = (photos || []).filter((p) => p && p.lat !== null && p.lng !== null && !isNaN(p.lat) && !isNaN(p.lng)).map((photo, i) => {
    const name = escapeXml(photo.name || `Foto_${i + 1}.jpg`);
    const cleanPhotoName = sanitizeFilename(photo.name, `foto_${i + 1}.jpg`);
    const alt = (photo.alt !== null && photo.alt !== undefined) ? photo.alt : 0;
    const date = escapeXml(photo.dateStr || photo.date || 'Fecha no disponible');
    const camera = escapeXml(photo.camera || '');

    const imgTag = isKmz
      ? `<div style="margin-bottom:8px;"><img src="files/${cleanPhotoName}" style="max-width:380px; max-height:260px; object-fit:contain; border-radius:4px; box-shadow:0 2px 6px rgba(0,0,0,0.3);" /></div>`
      : '';

    return `      <Placemark>
        <name>${name}</name>
        <description><![CDATA[
          <div style="font-family:sans-serif; max-width:400px;">
            <h4 style="margin:0 0 6px 0; color:#0088cc;">${name}</h4>
            ${imgTag}
            <p style="margin:4px 0; font-size:12px; color:#444;">
              <b>Fecha:</b> ${date}<br>
              <b>Coordenadas:</b> ${photo.lat.toFixed(6)}, ${photo.lng.toFixed(6)}<br>
              ${alt ? `<b>Altitud:</b> ${alt} m<br>` : ''}
              ${camera ? `<b>Dispositivo:</b> ${camera}<br>` : ''}
            </p>
            <p style="margin:6px 0 0 0; font-size:10px; color:#888;">Fotografía de Campaña - BiTaVi</p>
          </div>
        ]]></description>
        <styleUrl>#photo_style</styleUrl>
        <Point>
          <altitudeMode>clampToGround</altitudeMode>
          <coordinates>${photo.lng},${photo.lat},${alt}</coordinates>
        </Point>
      </Placemark>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom">
  <Document>
    <name>${safeTitle}</name>
    <open>1</open>
    <description>Expedición y rutas tácticas generadas con BiTaVi PC para Google Earth 3D</description>

${routeStyles}
${commonStyles}

    <Folder>
      <name>🗺️ Rutas de Expedición</name>
      <open>1</open>
${routeFolders || '      <!-- Sin rutas activas -->'}
    </Folder>

    <Folder>
      <name>📍 Waypoints y Puntos Clave</name>
      <open>1</open>
${waypointPlacemarks || '      <!-- Sin waypoints -->'}
    </Folder>

    <Folder>
      <name>📷 Fotografías Geolocalizadas</name>
      <open>1</open>
${photoPlacemarks || '      <!-- Sin fotos geolocalizadas -->'}
    </Folder>
  </Document>
</kml>`;
}

/**
 * Exporta directamente a un archivo .KML y lo descarga
 * @param {Object} data Datos { routes, waypoints, photos, title }
 * @param {string} filename Nombre del archivo .kml
 */
export function exportToKml(data, filename = 'expedicion_bitavi.kml') {
  const kmlContent = generateKmlXml(data, false);
  const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8' });
  downloadBlob(blob, filename.endsWith('.kml') ? filename : `${filename}.kml`);
}

/**
 * Empaqueta y exporta un archivo .KMZ (con doc.kml y carpeta files/ con fotografías)
 * @param {Object} data Datos { routes, waypoints, photos, title }
 * @param {string} filename Nombre del archivo .kmz
 * @param {Function} onProgress Callback de progreso opcional
 * @returns {Promise<void>}
 */
export async function exportToKmz(data, filename = 'expedicion_bitavi_3d.kmz', onProgress = null) {
  onProgress?.({ percent: 10, phase: 'Iniciando empaquetado KMZ para Google Earth 3D...' });

  const zip = new JSZip();
  const photos = (data.photos || []).filter((p) => p && p.lat !== null && p.lng !== null && !isNaN(p.lat) && !isNaN(p.lng));

  // Generar doc.kml indicando isKmz = true
  const kmlContent = generateKmlXml(data, true);
  zip.file('doc.kml', kmlContent);

  // Agregar imágenes en la subcarpeta files/
  if (photos.length > 0) {
    const filesFolder = zip.folder('files');
    let addedCount = 0;

    for (const photo of photos) {
      const cleanPhotoName = sanitizeFilename(photo.name, `foto_${addedCount + 1}.jpg`);

      onProgress?.({
        percent: Math.min(85, Math.round(15 + (addedCount / photos.length) * 65)),
        phase: `Incrustando foto ${addedCount + 1} de ${photos.length} (${cleanPhotoName})...`
      });

      try {
        if (photo.file instanceof Blob) {
          const buffer = await photo.file.arrayBuffer();
          filesFolder.file(cleanPhotoName, buffer);
        } else if (photo.url) {
          const resp = await fetch(photo.url);
          const blob = await resp.blob();
          const buffer = await blob.arrayBuffer();
          filesFolder.file(cleanPhotoName, buffer);
        }
      } catch (err) {
        console.warn('[KMZ Exporter] No se pudo incluir la imagen en el KMZ:', photo.name, err);
      }
      addedCount++;
    }
  }

  onProgress?.({ percent: 90, phase: 'Comprimiendo archivo KMZ...' });

  const kmzBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  onProgress?.({ percent: 100, phase: 'Descarga de KMZ iniciada.' });
  downloadBlob(kmzBlob, filename.endsWith('.kmz') ? filename : `${filename}.kmz`);
}
