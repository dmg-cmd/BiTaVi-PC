import L from 'leaflet';
import exifr from 'exifr';

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|heic|heif|avif|tiff?)$/i;

/**
 * Comprueba si un File/Blob es una imagen, tolerando tipos MIME vacíos
 * (frecuente en arrastres nativos de Tauri o en archivos descomprimidos).
 * @param {File} file
 * @returns {boolean}
 */
export function esArchivoImagen(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith('image/')) return true;
  return IMAGE_EXT_RE.test(file.name || '');
}

/**
 * Convierte coordenadas DMS a grados decimales.
 * Acepta arrays EXIF [grados, minutos, segundos] y textos XMP tipo "34,12.6168S".
 * @param {Array<number>|string|number} value
 * @param {string} [ref] - "N"/"S"/"E"/"W"
 * @returns {number} grados decimales o NaN
 */
export function dmsToDecimal(value, ref) {
  if (value === null || value === undefined) return NaN;

  if (Array.isArray(value) && value.length > 0) {
    const deg = Number(value[0]) || 0;
    const min = Number(value[1]) || 0;
    const sec = Number(value[2]) || 0;
    let dec = deg + min / 60 + sec / 3600;
    if (/^[SW]/i.test(ref || '')) dec = -Math.abs(dec);
    return dec;
  }

  if (typeof value === 'string') {
    // Referencia cardinal embebida en el texto XMP (p. ej. "34,12.6168S")
    const refFromValue = (value.match(/[NSEW]/i) || [''])[0].toUpperCase();
    const refFinal = refFromValue || (ref || '').toUpperCase();

    // Quitar cardinales y símbolos de grados/minutos/segundos
    let clean = value
      .replace(/[NSEW]/gi, ' ')
      .replace(/[°º]/g, ' ')
      .replace(/['′]/g, ' ')
      .replace(/["″]/g, ' ')
      .trim();
    if (!clean) return NaN;

    // "34,12.6168" usa la coma como separador grados/minutos y el punto como decimal
    if (clean.includes(',') && clean.includes('.')) {
      clean = clean.replace(',', ' ');
    } else {
      // "34,2102" (coma decimal europea) → "34.2102"
      clean = clean.replace(/,/g, '.');
    }

    const nums = clean.match(/-?\d+(?:\.\d+)?/g);
    if (!nums || nums.length === 0) return NaN;
    const n = nums.map(Number);
    let dec = n.length >= 3
      ? n[0] + n[1] / 60 + n[2] / 3600
      : n.length === 2
        ? n[0] + n[1] / 60
        : n[0];
    if (/^[SW]$/.test(refFinal)) dec = -Math.abs(dec);
    return dec;
  }

  const num = Number(value);
  return Number.isFinite(num) ? num : NaN;
}

/**
 * Valida que un par de coordenadas sea geográficamente utilizable.
 */
export function gpsEnRango(lat, lng) {
  return typeof lat === 'number' && typeof lng === 'number' &&
    isFinite(lat) && isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0);
}

/**
 * Lee las coordenadas GPS de una foto probando, en orden:
 * bloque GPS EXIF, DMS crudo (EXIF/XMP), XMP con prefijo y, por último, exifr.gps().
 * Deja diagnóstico en consola cuando no hay GPS legible.
 * @param {File|Blob} file
 * @returns {Promise<{lat:number, lng:number, alt:number|null, source:string}|null>}
 */
export async function leerGpsFoto(file) {
  let raw = null;

  try {
    raw = await exifr.parse(file, {
      tiff: true,
      ifd0: true,
      exif: true,
      gps: true,
      interop: true,
      xmp: true,
      reviveValues: true,
      sanitize: true,
      mergeOutput: true
    });
  } catch (err) {
    console.warn('[EXIF] parse() no pudo leer:', file && file.name, err && err.message);
  }

  if (raw) {
    // 1) exifr ya entrega latitude/longitude decimales cuando hay bloque GPS
    const lat1 = Number(raw.latitude);
    const lng1 = Number(raw.longitude);
    if (gpsEnRango(lat1, lng1)) {
      const alt1 = Number(raw.GPSAltitude);
      return { lat: lat1, lng: lng1, alt: isFinite(alt1) ? alt1 : null, source: 'exif' };
    }

    // 2) DMS crudo del bloque GPS EXIF
    const lat2 = dmsToDecimal(raw.GPSLatitude, raw.GPSLatitudeRef);
    const lng2 = dmsToDecimal(raw.GPSLongitude, raw.GPSLongitudeRef);
    if (gpsEnRango(lat2, lng2)) {
      const alt2 = Number(raw.GPSAltitude);
      return { lat: lat2, lng: lng2, alt: isFinite(alt2) ? alt2 : null, source: 'exif-dms' };
    }

    // 3) XMP con prefijo (fotos reencodeadas por Google Fotos / Android)
    const lat3 = dmsToDecimal(raw['exif:GPSLatitude'], raw['exif:GPSLatitudeRef']);
    const lng3 = dmsToDecimal(raw['exif:GPSLongitude'], raw['exif:GPSLongitudeRef']);
    if (gpsEnRango(lat3, lng3)) {
      return { lat: lat3, lng: lng3, alt: null, source: 'xmp' };
    }
  }

  // 4) Último recurso: API dedicada de exifr
  try {
    const gps = await exifr.gps(file);
    const lat4 = Number(gps && gps.latitude);
    const lng4 = Number(gps && gps.longitude);
    if (gpsEnRango(lat4, lng4)) {
      return { lat: lat4, lng: lng4, alt: null, source: 'exif-gps' };
    }
  } catch (err) {
    console.warn('[EXIF] gps() no pudo leer:', file && file.name, err && err.message);
  }

  console.info('[EXIF] Sin GPS legible:', {
    name: file && file.name,
    size: file && file.size,
    type: file && file.type,
    claves: raw ? Object.keys(raw).slice(0, 25) : null
  });

  return null;
}

/**
 * Intenta inferir el timestamp numérico (epoch ms) de una foto a partir de:
 * 1. Timestamp EXIF ya leído.
 * 2. Metadatos adjuntos de Google Fotos (creationTime).
 * 3. 13 dígitos en el nombre del archivo (formato milisegundos BiTaVi/Android).
 * 4. Patrón YYYYMMDD_HHMMSS habitual en cámaras de Android/Google Fotos.
 * @param {File|Blob} file 
 * @param {number|null} existingTs 
 * @returns {number|null}
 */
export function inferirTimestampFoto(file, existingTs = null) {
  if (typeof existingTs === 'number' && !isNaN(existingTs) && existingTs > 0) {
    return existingTs;
  }

  if (file && file._gphotosMetadata && file._gphotosMetadata.creationTime) {
    const dt = new Date(file._gphotosMetadata.creationTime);
    if (!isNaN(dt.getTime())) return dt.getTime();
  }

  const name = (file && file.name) ? file.name : '';

  // 13 dígitos continuos (milisegundos)
  const ts13 = name.match(/(\d{13})/);
  if (ts13) {
    const parsed = parseInt(ts13[1], 10);
    if (!isNaN(parsed) && parsed > 946684800000) { // Mayor al año 2000
      return parsed;
    }
  }

  // Patrón YYYYMMDD_HHMMSS (ej: IMG_20240512_143022.jpg)
  const matchYmd = name.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (matchYmd) {
    const [_, y, mo, d, h, mi, s] = matchYmd;
    const year = parseInt(y, 10);
    const month = parseInt(mo, 10) - 1;
    const day = parseInt(d, 10);
    const hour = parseInt(h, 10);
    const minute = parseInt(mi, 10);
    const second = parseInt(s, 10);
    const dt = new Date(year, month, day, hour, minute, second);
    if (!isNaN(dt.getTime())) return dt.getTime();
  }

  return null;
}

/**
 * Lee metadatos EXIF complementarios: fecha de captura, cámara y altitud.
 * @param {File|Blob} file
 * @returns {Promise<{dateStr:string, ts:number|null, camera:string, alt:number|null}>}
 */
export async function leerMetadatosFoto(file) {
  const result = { dateStr: 'Fecha no disponible', ts: null, camera: 'Desconocida', alt: null };

  try {
    const exifData = await exifr.parse(file, {
      tiff: true,
      ifd0: true,
      exif: true,
      gps: true,
      pick: ['DateTimeOriginal', 'CreateDate', 'Make', 'Model', 'GPSAltitude']
    });

    if (exifData) {
      const rawAlt = Number(exifData.GPSAltitude);
      if (isFinite(rawAlt)) result.alt = rawAlt;

      const rawDate = exifData.DateTimeOriginal || exifData.CreateDate;
      if (rawDate) {
        const dt = new Date(rawDate);
        if (!isNaN(dt.getTime())) {
          result.dateStr = dt.toLocaleString();
          result.ts = dt.getTime();
        }
      }

      if (exifData.Make || exifData.Model) {
        result.camera = `${exifData.Make || ''} ${exifData.Model || ''}`.trim();
      }
    }
  } catch (err) {
    console.warn('[EXIF] Metadatos complementarios no disponibles:', file && file.name, err && err.message);
  }

  // Complemento con metadatos de Google Fotos si faltan campos
  if (file && file._gphotosMetadata) {
    const gpMeta = file._gphotosMetadata;
    if (gpMeta.creationTime && (result.ts === null || result.dateStr === 'Fecha no disponible')) {
      const dt = new Date(gpMeta.creationTime);
      if (!isNaN(dt.getTime())) {
        result.dateStr = dt.toLocaleString();
        result.ts = dt.getTime();
      }
    }
    if (gpMeta.photo && result.camera === 'Desconocida') {
      const cam = `${gpMeta.photo.cameraMake || ''} ${gpMeta.photo.cameraModel || ''}`.trim();
      if (cam) result.camera = cam;
    }
  }

  // Si aún no hay ts, intentar inferir del nombre
  if (result.ts === null) {
    const inferred = inferirTimestampFoto(file, null);
    if (inferred) {
      result.ts = inferred;
      if (result.dateStr === 'Fecha no disponible') {
        result.dateStr = new Date(inferred).toLocaleString();
      }
    }
  }

  return result;
}

export class PhotoHandler {
  constructor(mapInstance, onPhotoSelect) {
    this.mapInstance = mapInstance;
    this.onPhotoSelect = onPhotoSelect;
    this.onPhotoGeotag = null;
    this.photos = [];
    this.photoMarkers = new Map();
  }

  async processPhotoFiles(fileList, routePoints = [], photoGeoMap = null) {
    const newPhotos = [];

    for (const file of fileList) {
      if (!esArchivoImagen(file)) continue;

      try {
        let lat = null;
        let lng = null;
        let alt = null;
        let dateStr = 'Fecha no disponible';
        let camera = 'Desconocida';
        let hasGps = false;
        let ts = null;
        let geotagSource = null;

        // 1. EXIF: bloque GPS, DMS, XMP y API dedicada, todo en una sola lectura
        const gps = await leerGpsFoto(file);
        if (gps) {
          lat = gps.lat;
          lng = gps.lng;
          if (gps.alt !== null) alt = Math.round(gps.alt);
          hasGps = true;
          geotagSource = gps.source;
        }

        // Metadatos EXIF complementarios (cámara, altitud, fecha de captura)
        const exifMeta = await leerMetadatosFoto(file);
        dateStr = exifMeta.dateStr;
        ts = exifMeta.ts;
        if (exifMeta.camera !== 'Desconocida') camera = exifMeta.camera;
        if (alt === null && exifMeta.alt !== null) alt = Math.round(exifMeta.alt);

        // 2. Si no hay GPS en EXIF, intentar geolocalización por mapa de favoritos (BiTaVi Android)
        //    Las paradas/favoritos en favoritos.txt guardan la foto asociada y sus coordenadas.
        if (!hasGps && photoGeoMap) {
          const cleanName = file.name.split('/').pop().toLowerCase().trim();
          const withoutExt = cleanName.replace(/\.[^/.]+$/, '');
          const geo = photoGeoMap.get(cleanName) || photoGeoMap.get(withoutExt);
          if (geo && typeof geo.lat === 'number' && !isNaN(geo.lat) && typeof geo.lng === 'number' && !isNaN(geo.lng)) {
            lat = geo.lat;
            lng = geo.lng;
            hasGps = true;
            geotagSource = 'favoritos';
          }
        }

        // 3. Si aún no hay GPS, intentar geotagging por correlación temporal contra la ruta
        //    Soporta: timestamps EXIF, Google Photos creationTime, 13 dígitos y patrón YYYYMMDD_HHMMSS
        const photoTs = inferirTimestampFoto(file, ts);
        if (photoTs) {
          const d = new Date(photoTs);
          if (!isNaN(d.getTime()) && (dateStr === 'Fecha no disponible' || !ts)) {
            dateStr = d.toLocaleString();
            ts = photoTs;
          }

          if (!hasGps && routePoints.length > 0) {
            // Buscar el punto GPS con timestamp más cercano (dentro de un rango de 1 hora)
            let closestPoint = null;
            let minDiff = Infinity;

            for (const pt of routePoints) {
              if (pt.timestamp && pt.timestamp > 0) {
                const diff = Math.abs(pt.timestamp - photoTs);
                if (diff < minDiff) {
                  minDiff = diff;
                  closestPoint = pt;
                }
              }
            }

            if (closestPoint && minDiff < 3600000) { // dentro de 1 hora
              lat = closestPoint.lat;
              lng = closestPoint.lng;
              alt = closestPoint.ele ? Math.round(closestPoint.ele) : null;
              hasGps = true;
              geotagSource = 'timestamp';
            }
          }
        }

        const objectUrl = URL.createObjectURL(file);

        const photoObj = {
          id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          size: file.size,
          url: objectUrl,
          blob: file,
          hasGps,
          geotagSource,
          lat,
          lng,
          alt,
          date: dateStr,
          ts,
          camera
        };

        this.photos.push(photoObj);
        newPhotos.push(photoObj);

        if (hasGps && lat !== null && lng !== null) {
          this.createPhotoMarker(photoObj);
        }
      } catch (err) {
        console.error(`Error procesando foto ${file.name}:`, err);
      }
    }

    // Si se agregaron fotos y no hay rutas activas en el mapa, encuadrar fotos
    const geoPhotos = newPhotos.filter(p => p.lat !== null && p.lng !== null && !isNaN(p.lat) && !isNaN(p.lng));
    const hasActiveRoutes = this.mapInstance?.routesLayerGroup?.getLayers()?.length > 0;
    if (geoPhotos.length > 0 && !hasActiveRoutes) {
      const bounds = L.latLngBounds(geoPhotos.map(p => [p.lat, p.lng]));
      if (bounds.isValid()) {
        this.mapInstance.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
      }
    }

    return {
      allPhotos: this.photos,
      newPhotos
    };
  }

  createPhotoMarker(photo) {
    // Custom DivIcon with photo thumbnail bubble and tactical pointer
    const photoIcon = L.divIcon({
      className: 'photo-marker-wrapper',
      html: `
        <div class="photo-map-pin" id="marker-${photo.id}">
          <div class="pin-bubble">
            <img src="${photo.url}" alt="${photo.name}" class="pin-img" />
          </div>
          <div class="pin-pointer"></div>
        </div>
      `,
      iconSize: [38, 48],
      iconAnchor: [19, 46],
      popupAnchor: [0, -42]
    });

    const marker = L.marker([photo.lat, photo.lng], { icon: photoIcon, draggable: true });
    marker._photoIcon = photoIcon;

    // Permitir corregir la posición arrastrando el marcador (fotos ya geolocalizadas)
    marker.on('dragend', () => {
      const ll = marker.getLatLng();
      photo.lat = ll.lat;
      photo.lng = ll.lng;
      photo.hasGps = true;
      if (this.onPhotoGeotag) this.onPhotoGeotag(photo);
    });

    // Popup content with tactical styling
    const popupContent = document.createElement('div');
    popupContent.className = 'tactical-popup';
    popupContent.innerHTML = `
      <div class="popup-img-wrapper" id="popup-img-${photo.id}">
        <img src="${photo.url}" alt="${photo.name}" />
        <span class="popup-overlay-badge">GPS FIX</span>
      </div>
      <div class="popup-details">
        <div class="popup-title">${photo.name}</div>
        <div class="popup-meta">
          <div><span>LAT:</span> ${photo.lat.toFixed(6)}°</div>
          <div><span>LNG:</span> ${photo.lng.toFixed(6)}°</div>
          <div><span>FECHA:</span> ${photo.date}</div>
        </div>
        <button class="popup-open-btn" id="btn-popup-open-${photo.id}">VER EN TAMAÑO COMPLETO</button>
      </div>
    `;

    // Hook click to open lightbox
    popupContent.querySelector(`#popup-img-${photo.id}`).addEventListener('click', () => {
      if (this.onPhotoSelect) this.onPhotoSelect(photo);
    });
    popupContent.querySelector(`#btn-popup-open-${photo.id}`).addEventListener('click', () => {
      if (this.onPhotoSelect) this.onPhotoSelect(photo);
    });

    marker.bindPopup(popupContent, { maxWidth: 260, minWidth: 220 });

    this.mapInstance.photosLayerGroup.addLayer(marker);
    this.photoMarkers.set(photo.id, marker);
  }

  /**
   * Oculta todos los marcadores de foto del mapa (usado en la vista FOTOS).
   * El punto de referencia se dibuja aparte en el SVG de conectores,
   * evitando que queden burbujas/rectángulos sobre el mapa.
   */
  hidePhotoMarkers() {
    if (this.mapInstance && this.mapInstance.photosLayerGroup && this.mapInstance.map) {
      this.mapInstance.map.removeLayer(this.mapInstance.photosLayerGroup);
    }
  }

  showPhotoMarkers() {
    if (this.mapInstance && this.mapInstance.photosLayerGroup && this.mapInstance.map) {
      this.mapInstance.photosLayerGroup.addTo(this.mapInstance.map);
    }
  }

  focusPhoto(photoId) {
    const photo = this.photos.find(p => p.id === photoId);
    const marker = this.photoMarkers.get(photoId);

    if (photo && marker) {
      this.mapInstance.flyToCoordinates(photo.lat, photo.lng, 17);
      setTimeout(() => {
        marker.openPopup();
      }, 700);
    }
  }

  clearPhotos() {
    // Quitar primero los marcadores/capas del mapa y luego revocar las
    // object URLs, para evitar que un popup abierto muestre la imagen rota.
    this.mapInstance.photosLayerGroup.clearLayers();
    this.photoMarkers.clear();
    this.photos.forEach(p => URL.revokeObjectURL(p.url));
    this.photos = [];
  }

  /**
   * Asigna (o reasigna) coordenadas a una foto de forma manual: desde el
   * modal "Fijar en el mapa" o arrastrando su miniatura al mapa.
   * Crea el marcador si aún no existe, o mueve el existente.
   * @returns {object|null} la foto actualizada
   */
  assignPhotoLocation(photoId, lat, lng) {
    const photo = this.photos.find(p => p.id === photoId);
    if (!photo) return null;

    photo.lat = lat;
    photo.lng = lng;
    photo.hasGps = true;
    photo.geotagSource = 'manual';

    const marker = this.photoMarkers.get(photoId);
    if (marker) {
      marker.setLatLng([lat, lng]);
    } else {
      this.createPhotoMarker(photo);
    }

    if (this.onPhotoGeotag) this.onPhotoGeotag(photo);
    return photo;
  }

  /**
   * Reintenta geolocalizar fotos cargadas que aún no tengan coordenadas,
   * aprovechando nuevas rutas o el mapa de favoritos/paradas.
   * @param {Array<object>} routePoints
   * @param {Map} photoGeoMap
   * @returns {number} cantidad de fotos recién geolocalizadas
   */
  retryGeotagging(routePoints = [], photoGeoMap = null) {
    let newlyGeotagged = 0;

    for (const photo of this.photos) {
      if (photo.hasGps && photo.lat !== null && photo.lng !== null && !isNaN(photo.lat) && !isNaN(photo.lng)) {
        continue;
      }

      let lat = null;
      let lng = null;
      let alt = null;
      let source = null;

      // 1. Geolocalización por favoritos / paradas de BiTaVi o JSON
      if (photoGeoMap) {
        const cleanName = photo.name.split('/').pop().toLowerCase().trim();
        const withoutExt = cleanName.replace(/\.[^/.]+$/, '');
        const geo = photoGeoMap.get(cleanName) || photoGeoMap.get(withoutExt);
        if (geo && typeof geo.lat === 'number' && !isNaN(geo.lat) && typeof geo.lng === 'number' && !isNaN(geo.lng)) {
          lat = geo.lat;
          lng = geo.lng;
          source = 'favoritos';
        }
      }

      // 2. Geotagging por timestamp de foto contra las coordenadas de la ruta
      if (lat === null && routePoints && routePoints.length > 0) {
        const photoTs = inferirTimestampFoto(photo.blob || { name: photo.name }, photo.ts);
        if (photoTs) {
          let closestPoint = null;
          let minDiff = Infinity;

          for (const pt of routePoints) {
            if (pt.timestamp && pt.timestamp > 0) {
              const diff = Math.abs(pt.timestamp - photoTs);
              if (diff < minDiff) {
                minDiff = diff;
                closestPoint = pt;
              }
            }
          }

          if (closestPoint && minDiff < 3600000) { // dentro de 1 hora
            lat = closestPoint.lat;
            lng = closestPoint.lng;
            alt = closestPoint.ele ? Math.round(closestPoint.ele) : null;
            source = 'timestamp';
          }
        }
      }

      if (lat !== null && lng !== null) {
        photo.lat = lat;
        photo.lng = lng;
        photo.alt = alt;
        photo.hasGps = true;
        photo.geotagSource = source;
        this.createPhotoMarker(photo);
        newlyGeotagged++;
      }
    }

    return newlyGeotagged;
  }

  /**
   * Restaura fotografías previamente persistidas en IndexedDB
   * @param {Array<object>} photosList
   * @returns {Array<object>}
   */
  restorePhotos(photosList) {
    this.clearPhotos();
    if (!Array.isArray(photosList)) return [];

    photosList.forEach(photo => {
      this.photos.push(photo);
      if (photo.hasGps && photo.lat !== null && photo.lng !== null && !isNaN(photo.lat) && !isNaN(photo.lng)) {
        this.createPhotoMarker(photo);
      }
    });

    return this.photos;
  }

  /**
   * Devuelve los límites (LatLngBounds) de todas las fotos geolocalizadas
   * @returns {L.LatLngBounds|null}
   */
  getPhotosBounds() {
    const geoPhotos = this.photos.filter(p => p.hasGps && p.lat !== null && p.lng !== null && !isNaN(p.lat) && !isNaN(p.lng));
    if (geoPhotos.length === 0) return null;
    const bounds = L.latLngBounds(geoPhotos.map(p => [p.lat, p.lng]));
    return bounds.isValid() ? bounds : null;
  }
}
