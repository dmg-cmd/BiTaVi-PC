import L from 'leaflet';

/**
 * Calculador de rumbo (bearing en grados 0-360) entre dos coordenadas geográficas
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return Math.round(bearing);
}

/**
 * Convierte un rumbo en grados a punto cardinal táctico (N, NE, E, SE, etc.)
 */
export function bearingToCardinal(deg) {
  const cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(deg / 22.5) % 16;
  return cardinals[index];
}

/**
 * Distancia en metros mediante fórmula de Haversine
 */
export function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radio de la Tierra en metros
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formatea segundos a HH:MM:SS
 */
export function formatDuration(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Motor del Simulador y Reproductor Táctico de Viaje (Route Playback Simulator)
 * Anima el recorrido sobre el mapa en Leaflet con vehículo táctico, rotación por rumbo,
 * telemetría en tiempo real y detección de fotos en proximidad.
 */
export class RoutePlaybackSimulator {
  constructor(mapInstance, options = {}) {
    this.mapInstance = mapInstance;
    this.options = Object.assign(
      {
        followVehicle: true,
        defaultSpeed: 5,
        proximityThresholdMeters: 60
      },
      options
    );

    this.points = [];
    this.photos = [];
    this.currentIndex = 0;
    this.isPlaying = false;
    this.speedMultiplier = this.options.defaultSpeed;
    this.followVehicle = this.options.followVehicle;

    this.marker = null;
    this.animationFrameId = null;
    this.lastTimestamp = null;
    this.progressMeters = 0;
    this.totalDistanceMeters = 0;

    // Callbacks
    this.onTelemetryUpdate = null;
    this.onPhotoNear = null;
    this.onStateChange = null;
    this.onFinish = null;

    this.cumDistances = [];
  }

  /**
   * Carga una serie de puntos GPS para la simulación
   * @param {Array<{lat: number, lng: number, ele?: number, time?: string, speed?: number}>} points
   * @param {Array<Object>} photos Lista de fotos geolocalizadas opcionales
   */
  loadRoute(points, photos = []) {
    this.stop();
    this.points = (points || []).filter((p) => p && !isNaN(p.lat) && !isNaN(p.lng));
    this.photos = photos || [];
    this.currentIndex = 0;
    this.progressMeters = 0;
    this.cumDistances = [0];

    // Precalcular distancias acumuladas
    let dist = 0;
    for (let i = 1; i < this.points.length; i++) {
      const p1 = this.points[i - 1];
      const p2 = this.points[i];
      dist += haversineMeters(p1.lat, p1.lng, p2.lat, p2.lng);
      this.cumDistances.push(dist);
    }
    this.totalDistanceMeters = dist;

    if (this.points.length > 0) {
      this._createOrUpdateMarker(this.points[0], 0);
      this._emitTelemetry();
    }
  }

  /**
   * Inicia o reanuda la reproducción
   */
  play() {
    if (this.points.length < 2) return;
    if (this.currentIndex >= this.points.length - 1) {
      this.currentIndex = 0;
      this.progressMeters = 0;
    }

    this.isPlaying = true;
    this.lastTimestamp = performance.now();
    this._notifyState();
    this._animationLoop(this.lastTimestamp);
  }

  /**
   * Pausa la simulación en el punto actual
   */
  pause() {
    this.isPlaying = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.lastTimestamp = null;
    this._notifyState();
  }

  /**
   * Detiene y reinicia la simulación al inicio
   */
  stop() {
    this.pause();
    this.currentIndex = 0;
    this.progressMeters = 0;
    if (this.points.length > 0) {
      this._createOrUpdateMarker(this.points[0], 0);
      this._emitTelemetry();
    }
    this._notifyState();
  }

  /**
   * Salta a una posición porcentual (0 a 100)
   */
  seekPercent(percent) {
    if (this.points.length === 0) return;
    const clamped = Math.max(0, Math.min(100, percent));
    const targetDist = (clamped / 100) * this.totalDistanceMeters;

    // Buscar el índice más cercano por distancia acumulada
    let targetIndex = 0;
    for (let i = 0; i < this.cumDistances.length; i++) {
      if (this.cumDistances[i] >= targetDist) {
        targetIndex = i;
        break;
      }
    }

    this.currentIndex = Math.max(0, Math.min(this.points.length - 1, targetIndex));
    this.progressMeters = this.cumDistances[this.currentIndex] || 0;

    const currentPt = this.points[this.currentIndex];
    const nextPt = this.points[Math.min(this.currentIndex + 1, this.points.length - 1)];
    const bearing = calculateBearing(currentPt.lat, currentPt.lng, nextPt.lat, nextPt.lng);

    this._createOrUpdateMarker(currentPt, bearing);
    this._emitTelemetry();

    if (this.followVehicle && this.mapInstance?.map) {
      this.mapInstance.map.panTo([currentPt.lat, currentPt.lng], { animate: false });
    }
  }

  /**
   * Establece el multiplicador de velocidad (1x, 2x, 5x, 10x, 20x, 50x)
   */
  setSpeed(multiplier) {
    this.speedMultiplier = Math.max(0.25, parseFloat(multiplier) || 1);
  }

  /**
   * Alterna el seguimiento de cámara en el mapa
   */
  setFollow(enable) {
    this.followVehicle = Boolean(enable);
    if (this.followVehicle && this.points[this.currentIndex] && this.mapInstance?.map) {
      const pt = this.points[this.currentIndex];
      this.mapInstance.map.panTo([pt.lat, pt.lng], { animate: true });
    }
  }

  /**
   * Limpia y destruye el marcador
   */
  destroy() {
    this.stop();
    if (this.marker && this.mapInstance?.map) {
      this.mapInstance.map.removeLayer(this.marker);
      this.marker = null;
    }
    this.points = [];
    this.photos = [];
  }

  // --- MÉTODOS INTERNOS DE ANIMACIÓN ---

  _animationLoop(now) {
    if (!this.isPlaying) return;

    if (!this.lastTimestamp) this.lastTimestamp = now;
    const deltaMs = now - this.lastTimestamp;
    this.lastTimestamp = now;

    // Avance proporcional: simulamos a paso dinámico según velocidad
    // Paso base: 1 punto por cada 120ms a 1x -> a 10x son 10 puntos por cada 120ms
    const stepDelta = (deltaMs / 100) * this.speedMultiplier;
    const stepInt = Math.max(1, Math.floor(stepDelta));

    this.currentIndex += stepInt;

    if (this.currentIndex >= this.points.length - 1) {
      this.currentIndex = this.points.length - 1;
      const finalPt = this.points[this.currentIndex];
      this._createOrUpdateMarker(finalPt, 0);
      this._emitTelemetry();
      this.pause();
      this.onFinish?.();
      return;
    }

    const currentPt = this.points[this.currentIndex];
    const nextPt = this.points[Math.min(this.currentIndex + 1, this.points.length - 1)];
    const bearing = calculateBearing(currentPt.lat, currentPt.lng, nextPt.lat, nextPt.lng);

    this.progressMeters = this.cumDistances[this.currentIndex] || 0;
    this._createOrUpdateMarker(currentPt, bearing);
    this._emitTelemetry();
    this._checkNearbyPhotos(currentPt);

    if (this.followVehicle && this.mapInstance?.map) {
      // Centrar suavemente sin interrumpir zoom ni interacciones
      this.mapInstance.map.panTo([currentPt.lat, currentPt.lng], { animate: false });
    }

    this.animationFrameId = requestAnimationFrame((t) => this._animationLoop(t));
  }

  _createOrUpdateMarker(pt, bearing) {
    if (!this.mapInstance?.map) return;

    const iconHtml = `
      <div class="tactical-sim-marker">
        <div class="sim-pulse-wave"></div>
        <div class="sim-arrow-rotator" style="transform: rotate(${bearing}deg);">
          <svg viewBox="0 0 32 32" width="28" height="28" class="sim-vehicle-svg">
            <polygon points="16,2 30,28 16,21 2,28" fill="#00f0ff" stroke="#07090e" stroke-width="2.5" />
          </svg>
        </div>
      </div>
    `;

    const simIcon = L.divIcon({
      className: 'sim-vehicle-container',
      html: iconHtml,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    if (!this.marker) {
      this.marker = L.marker([pt.lat, pt.lng], {
        icon: simIcon,
        zIndexOffset: 2000
      }).addTo(this.mapInstance.map);
    } else {
      this.marker.setLatLng([pt.lat, pt.lng]);
      this.marker.setIcon(simIcon);
    }
  }

  _emitTelemetry() {
    if (!this.onTelemetryUpdate) return;
    const pt = this.points[this.currentIndex];
    if (!pt) return;

    const nextPt = this.points[Math.min(this.currentIndex + 1, this.points.length - 1)];
    const bearing = calculateBearing(pt.lat, pt.lng, nextPt.lat, nextPt.lng);
    const cardinal = bearingToCardinal(bearing);

    // Calcular velocidad
    let speedKmh = pt.speed ? (pt.speed * 3.6).toFixed(1) : null;
    if (!speedKmh && this.currentIndex > 0) {
      const prev = this.points[this.currentIndex - 1];
      const dMeters = haversineMeters(prev.lat, prev.lng, pt.lat, pt.lng);
      // Asumimos delta de tiempo si existe timestamp, o velocidad promedio
      if (prev.time && pt.time) {
        const dt = (new Date(pt.time) - new Date(prev.time)) / 1000;
        if (dt > 0) speedKmh = ((dMeters / dt) * 3.6).toFixed(1);
      }
    }

    const percent = this.totalDistanceMeters > 0
      ? ((this.progressMeters / this.totalDistanceMeters) * 100).toFixed(1)
      : 0;

    this.onTelemetryUpdate({
      currentIndex: this.currentIndex,
      totalPoints: this.points.length,
      lat: pt.lat.toFixed(6),
      lng: pt.lng.toFixed(6),
      ele: pt.ele !== null && pt.ele !== undefined ? Math.round(pt.ele) : '--',
      speedKmh: speedKmh || '--',
      bearing,
      cardinal,
      time: pt.time ? new Date(pt.time).toLocaleTimeString() : '--:--:--',
      date: pt.time ? new Date(pt.time).toLocaleDateString() : '--',
      percent: parseFloat(percent),
      distanceKm: (this.progressMeters / 1000).toFixed(2),
      totalDistanceKm: (this.totalDistanceMeters / 1000).toFixed(2)
    });
  }

  _checkNearbyPhotos(pt) {
    if (!this.photos || this.photos.length === 0 || !this.onPhotoNear) return;

    for (const photo of this.photos) {
      if (photo.lat && photo.lng) {
        const d = haversineMeters(pt.lat, pt.lng, photo.lat, photo.lng);
        if (d <= this.options.proximityThresholdMeters) {
          this.onPhotoNear(photo, d);
          break;
        }
      }
    }
  }

  _notifyState() {
    this.onStateChange?.({
      isPlaying: this.isPlaying,
      currentIndex: this.currentIndex,
      speedMultiplier: this.speedMultiplier,
      followVehicle: this.followVehicle
    });
  }
}
