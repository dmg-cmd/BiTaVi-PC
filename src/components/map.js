import L from 'leaflet';

export class BiTaViMap {
  constructor(mapContainerId, onCoordsChange, onLocationFound, onLocationError) {
    this.containerId = mapContainerId;
    this.onCoordsChange = onCoordsChange;
    this.onLocationFound = onLocationFound;
    this.onLocationError = onLocationError;
    this.map = null;
    this.userLocationMarker = null;
    this.userAccuracyCircle = null;
    this.currentTileLayer = null;
    this.layers = {};
    
    // Feature Layer Groups
    this.routesLayerGroup = L.layerGroup();
    this.photosLayerGroup = L.layerGroup();
    this.waypointsLayerGroup = L.layerGroup();
    this.routeMarkersLayerGroup = L.layerGroup();
    this.routeArrowsLayerGroup = L.layerGroup();

    this.init();
  }

  init() {
    // Recuperar última posición guardada o por defecto
    const savedLocation = this.getSavedLocation();
    const defaultCenter = savedLocation ? [savedLocation.lat, savedLocation.lng] : [-34.6037, -58.3816];
    const defaultZoom = savedLocation ? savedLocation.zoom || 14 : 12;

    // Initialize Leaflet Map
    this.map = L.map(this.containerId, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false // Desactivado para usar nuestro controlador anti-rebote y anti-inercia
    });

    // Setup Free / Open Tile Layers
    this.setupFreeTileLayers();

    // Add Layer Groups to map
    this.routesLayerGroup.addTo(this.map);
    this.photosLayerGroup.addTo(this.map);
    this.waypointsLayerGroup.addTo(this.map);
    this.routeMarkersLayerGroup.addTo(this.map);
    this.routeArrowsLayerGroup.addTo(this.map);

    // Setup map event listeners
    this.setupMapEvents();

    if (savedLocation) {
      this.updateUserMarker([savedLocation.lat, savedLocation.lng], 50, savedLocation.name || 'Última ubicación fijada');
    }
  }

  getSavedLocation() {
    try {
      const data = localStorage.getItem('bitavi_last_location');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  saveLocation(lat, lng, zoom = 14, name = '') {
    try {
      localStorage.setItem('bitavi_last_location', JSON.stringify({ lat, lng, zoom, name }));
    } catch (e) {}
  }

  setupFreeTileLayers() {
    // 1. OpenStreetMap Standard (100% Libre y Gratuito)
    this.layers.osm = {
      layer: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }),
      filterClass: null
    };

    // 2. Táctico Oscuro (100% Libre vía OpenStreetMap con render nocturno)
    this.layers.dark = {
      layer: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }),
      filterClass: 'tactical-dark-filter'
    };

    // 3. OpenTopoMap (Topográfico Libre con curvas de nivel)
    this.layers.topo = {
      layer: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
        maxZoom: 17
      }),
      filterClass: null
    };

    // 4. Esri World Imagery (Satelital Aéreo Libre)
    this.layers.satellite = {
      layer: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye',
        maxZoom: 19
      }),
      filterClass: null
    };

    // 5. CyclOSM (Senderismo & Ciclorrutas Libre)
    this.layers.cyclosm = {
      layer: L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | CyclOSM',
        maxZoom: 18
      }),
      filterClass: null
    };

    // Capa predeterminada: OpenStreetMap Standard libre
    this.setLayer('osm');
  }

  setLayer(layerKey) {
    const layerConfig = this.layers[layerKey];
    if (!layerConfig) return;

    this.currentLayerKey = layerKey;

    const mapContainer = document.getElementById(this.containerId);

    // Remove previous filter classes
    mapContainer.classList.remove('tactical-dark-filter', 'tactical-contrast-filter');

    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }

    this.currentTileLayer = layerConfig.layer;
    this.currentTileLayer.addTo(this.map);

    // Apply CSS filter class if defined
    if (layerConfig.filterClass) {
      mapContainer.classList.add(layerConfig.filterClass);
    }
  }

  /**
   * Devuelve el tema del fondo del mapa actual para ajustar el contraste
   * de overlays (líneas y puntos de fotos): 'dark' u 'light'.
   */
  getBasemapTheme() {
    const key = this.currentLayerKey;
    if (key === 'dark' || key === 'satellite') return 'dark';
    return 'light';
  }

  setupMapEvents() {
    // Track cursor movement for coordinate HUD
    this.map.on('mousemove', (e) => {
      if (this.onCoordsChange) {
        this.onCoordsChange({
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          zoom: this.map.getZoom()
        });
      }
    });

    this.map.on('zoomend', () => {
      const center = this.map.getCenter();
      if (this.onCoordsChange) {
        this.onCoordsChange({
          lat: center.lat,
          lng: center.lng,
          zoom: this.map.getZoom()
        });
      }
    });

    // Controlador táctico de rueda del mouse (filtrado anti-inercia y anti-rebote de Windows)
    this.setupWheelZoomControl();
  }

  /**
   * Controlador de rueda de mouse táctico y predecible:
   * 1. Limita cada muesca/giro a exactamente 1 nivel de zoom (evita saltar al máximo).
   * 2. Aplica un período de enfriamiento (cooldown de 160 ms) que filtra ráfagas de hardware,
   *    micro-rebotes de encoders mecánicos gastados (saltos inversos) y la inercia de Windows.
   * 3. Mantiene el zoom centrado sobre las coordenadas exactas del puntero del mouse.
   */
  setupWheelZoomControl() {
    const mapContainer = document.getElementById(this.containerId);
    if (!mapContainer) return;

    let wheelCooldown = false;

    mapContainer.addEventListener('wheel', (e) => {
      // Bloquear scroll de página y comportamiento nativo inestable
      e.preventDefault();

      // Si estamos en la ventana de enfriamiento (cooldown), descartar rebotes o inercia
      if (wheelCooldown) return;

      // Filtrar desplazamientos microscópicos (ruido de trackpad o micro-vibración)
      if (Math.abs(e.deltaY) < 4) return;

      // deltaY < 0 es giro hacia arriba (acercar +1), deltaY > 0 es giro hacia abajo (alejar -1)
      const zoomStep = e.deltaY < 0 ? 1 : -1;
      const currentZoom = this.map.getZoom();
      const minZoom = this.map.getMinZoom();
      const maxZoom = this.map.getMaxZoom();
      const nextZoom = Math.min(Math.max(currentZoom + zoomStep, minZoom), maxZoom);

      if (nextZoom !== currentZoom) {
        const mouseLatLng = this.map.mouseEventToLatLng(e);
        this.map.setZoomAround(mouseLatLng, nextZoom, { animate: true });

        // Cooldown para amortiguar ráfagas mecánicas y descartar rebotes inversos
        wheelCooldown = true;
        setTimeout(() => {
          wheelCooldown = false;
        }, 160);
      }
    }, { passive: false });
  }

  locateUser(flyTo = true) {
    if (!('geolocation' in navigator)) {
      if (this.onLocationError) {
        this.onLocationError('Tu navegador no soporta el servicio de geolocalización GPS.');
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy, altitude } = position.coords;
        const latLng = [latitude, longitude];

        this.saveLocation(latitude, longitude, 16, 'Posición GPS detectada');
        this.updateUserMarker(latLng, accuracy, 'MI POSICIÓN GPS');

        if (flyTo) {
          this.map.flyTo(latLng, 16, {
            duration: 1.5,
            easeLinearity: 0.25
          });
        } else {
          this.map.setView(latLng, 15);
        }

        if (this.onLocationFound) {
          this.onLocationFound({
            lat: latitude,
            lng: longitude,
            accuracy: Math.round(accuracy),
            altitude: altitude ? Math.round(altitude) : null
          });
        }
      },
      (error) => {
        let msg = 'No se pudo obtener la posición GPS.';
        if (error.code === 1) {
          msg = 'Permiso de ubicación denegado en el navegador. Puedes buscar tu ciudad en la barra de búsqueda.';
        } else if (error.code === 2) {
          msg = 'Ubicación no disponible en tu PC (sin antena GPS o señal Wi-Fi). Puedes buscar tu ciudad arriba.';
        } else if (error.code === 3) {
          msg = 'Tiempo de espera de señal GPS agotado.';
        }
        if (this.onLocationError) {
          this.onLocationError(msg);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  setManualLocation(lat, lng, label = 'Ubicación fijada', zoom = 15) {
    const latLng = [lat, lng];
    this.saveLocation(lat, lng, zoom, label);
    this.updateUserMarker(latLng, 30, label);
    this.map.flyTo(latLng, zoom, { duration: 1.5 });

    if (this.onLocationFound) {
      this.onLocationFound({
        lat,
        lng,
        accuracy: 30,
        altitude: null,
        label
      });
    }
  }

  updateUserMarker(latLng, accuracy = 30, tooltipText = 'UBICACIÓN ACTUAL') {
    // Custom animated tactical radar icon
    const radarIcon = L.divIcon({
      className: 'user-radar-container',
      html: `
        <div class="user-radar-marker">
          <div class="radar-wave"></div>
          <div class="radar-dot"></div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    if (this.userLocationMarker) {
      this.userLocationMarker.setLatLng(latLng);
      this.userLocationMarker.setTooltipContent(tooltipText);
    } else {
      this.userLocationMarker = L.marker(latLng, {
        icon: radarIcon,
        zIndexOffset: 1000
      }).addTo(this.map);
      this.userLocationMarker.bindTooltip(tooltipText, {
        permanent: false,
        direction: 'top',
        className: 'tactical-tooltip'
      });
    }

    if (this.userAccuracyCircle) {
      this.userAccuracyCircle.setLatLng(latLng);
      this.userAccuracyCircle.setRadius(accuracy);
    } else {
      this.userAccuracyCircle = L.circle(latLng, {
        radius: accuracy,
        color: '#10b981',
        weight: 1,
        fillColor: '#10b981',
        fillOpacity: 0.08
      }).addTo(this.map);
    }
  }

  flyToCoordinates(lat, lng, zoom = 17) {
    this.map.flyTo([lat, lng], zoom, {
      duration: 1.2
    });
  }

  fitBounds(bounds, options = { padding: [50, 50], maxZoom: 17 }) {
    this.map.fitBounds(bounds, options);
  }

  /**
   * Dibuja sutiles chevrons tácticos (dos rayitas en blanco con reborde oscuro)
   * a lo largo de la ruta para indicar el sentido del recorrido, idéntico al
   * comportamiento de BiTaVi Android (RouteDirectionArrowsOverlay).
   * @param {Array<[number, number]>} latLngs - Puntos de la ruta.
   * @param {string} [arrowColor='#ffffff'] - Color principal del trazo (blanco por defecto).
   * @returns {L.LayerGroup|null} Grupo de capas con los chevrons.
   */
  addRouteArrows(latLngs, arrowColor = '#ffffff') {
    if (!latLngs || latLngs.length < 2) return null;
    const group = L.layerGroup();
    const total = latLngs.length;
    const maxArrows = 26;
    const stride = Math.max(1, Math.floor(total / maxArrows));

    let arrowsDrawn = 0;

    // Rumbo geodésico exacto (0° = Norte, 90° = Este)
    const calcBearing = (p1, p2) => {
      const lat1 = (p1[0] * Math.PI) / 180;
      const lat2 = (p2[0] * Math.PI) / 180;
      const dLng = ((p2[1] - p1[1]) * Math.PI) / 180;
      const y = Math.sin(dLng) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
      const brng = (Math.atan2(y, x) * 180) / Math.PI;
      return (brng + 360) % 360;
    };

    // Marcador con chevron SVG sutil de dos rayitas
    const createChevronMarker = (pos, bearingDeg) => {
      const icon = L.divIcon({
        className: 'route-arrow',
        html: `
          <svg class="route-chevron-svg" width="16" height="16" viewBox="0 0 16 16" style="transform: rotate(${Math.round(bearingDeg)}deg);">
            <path class="route-chevron-halo" d="M 3.5 11.5 L 8 4.5 L 12.5 11.5" />
            <path class="route-chevron-core" d="M 3.5 11.5 L 8 4.5 L 12.5 11.5" style="stroke: ${arrowColor};" />
          </svg>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      return L.marker(pos, { icon, interactive: false });
    };

    for (let i = 0; i + stride < total; i += stride) {
      const p1 = latLngs[i];
      const p2 = latLngs[i + stride];

      const dLat = Math.abs(p2[0] - p1[0]);
      const dLng = Math.abs(p2[1] - p1[1]);
      if (dLat < 0.00002 && dLng < 0.00002) continue;

      const mid = L.latLng((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2);
      const bearing = calcBearing(p1, p2);

      createChevronMarker(mid, bearing).addTo(group);
      arrowsDrawn++;
    }

    // Si por pocos puntos no se llegó a dibujar, colocar al menos uno entre extremos
    if (arrowsDrawn === 0 && total >= 2) {
      const first = latLngs[0];
      const last = latLngs[total - 1];
      const dLat = Math.abs(last[0] - first[0]);
      const dLng = Math.abs(last[1] - first[1]);
      if (dLat >= 0.00002 || dLng >= 0.00002) {
        const mid = L.latLng((first[0] + last[0]) / 2, (first[1] + last[1]) / 2);
        const bearing = calcBearing(first, last);
        createChevronMarker(mid, bearing).addTo(group);
      }
    }

    group.addTo(this.routeArrowsLayerGroup);
    return group;
  }

  hideRouteMarkers() {
    if (this.routeMarkersLayerGroup && this.map) {
      this.map.removeLayer(this.routeMarkersLayerGroup);
    }
  }

  showRouteMarkers() {
    if (this.routeMarkersLayerGroup && this.map) {
      this.routeMarkersLayerGroup.addTo(this.map);
    }
  }
}
