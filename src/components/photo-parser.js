import L from 'leaflet';
import exifr from 'exifr';

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
      if (!file.type.startsWith('image/') && !/\.(jpg|jpeg|png|webp|heic)$/i.test(file.name)) continue;

      try {
        let lat = null;
        let lng = null;
        let alt = null;
        let dateStr = 'Fecha no disponible';
        let camera = 'Desconocida';
        let hasGps = false;
        let ts = null;

        // 1. Intentar extraer coordenadas GPS directas de los metadatos EXIF
        try {
          const gps = await exifr.gps(file);
          if (gps && typeof gps.latitude === 'number' && !isNaN(gps.latitude) &&
              typeof gps.longitude === 'number' && !isNaN(gps.longitude)) {
            lat = gps.latitude;
            lng = gps.longitude;
            hasGps = true;
          }
        } catch (e) {
          // EXIF GPS ausente o no legible
        }

        // Metadatos EXIF complementarios (cámara, altitud, fecha de captura)
        try {
          const exifData = await exifr.parse(file, {
            pick: ['DateTimeOriginal', 'Make', 'Model', 'GPSAltitude']
          });

          if (exifData) {
            if (exifData.GPSAltitude && !isNaN(exifData.GPSAltitude)) {
              alt = Math.round(exifData.GPSAltitude);
            }
            if (exifData.DateTimeOriginal) {
              const dt = new Date(exifData.DateTimeOriginal);
              if (!isNaN(dt.getTime())) {
                dateStr = dt.toLocaleString();
                ts = dt.getTime();
              }
            }
            if (exifData.Make || exifData.Model) {
              camera = `${exifData.Make || ''} ${exifData.Model || ''}`.trim();
            }
          }
        } catch (e) {
          // EXIF adicional no disponible
        }

        // 2. Si no hay GPS en EXIF, intentar geolocalización por mapa de favoritos (BiTaVi Android)
        //    Las paradas/favoritos en favoritos.txt guardan la foto asociada y sus coordenadas.
        if (!hasGps && photoGeoMap) {
          const cleanName = file.name.split('/').pop().toLowerCase().trim();
          const geo = photoGeoMap.get(cleanName);
          if (geo && typeof geo.lat === 'number' && !isNaN(geo.lat) && typeof geo.lng === 'number' && !isNaN(geo.lng)) {
            lat = geo.lat;
            lng = geo.lng;
            hasGps = true;
          }
        }

        // 3. Si aún no hay GPS, intentar geotagging por timestamp del nombre de archivo (BiTaVi Android)
        //    Ejemplo: IMG_GALLERY_1782930974104.jpg o IMG_1783348610593_xxx.jpg
        const tsMatch = file.name.match(/(\d{13})/);
        if (tsMatch) {
          const fileTimestamp = parseInt(tsMatch[1], 10);
          const d = new Date(fileTimestamp);
          if (!isNaN(d.getTime()) && (dateStr === 'Fecha no disponible' || !ts)) {
            dateStr = d.toLocaleString();
            ts = fileTimestamp;
          }

          if (!hasGps && routePoints.length > 0) {
            // Buscar el punto GPS con timestamp más cercano (dentro de un rango razonable)
            let closestPoint = null;
            let minDiff = Infinity;

            for (const pt of routePoints) {
              if (pt.timestamp && pt.timestamp > 0) {
                const diff = Math.abs(pt.timestamp - fileTimestamp);
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
}
