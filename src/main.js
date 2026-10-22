import JSZip from 'jszip';
import { BiTaViMap } from './components/map.js';
import { GpxHandler, sanitizeFilename, downloadBlob, createCombinedGpxXml, extractRouteDateSlug, groupRoutesByDay } from './components/gpx-parser.js';
import { PhotoHandler } from './components/photo-parser.js';
import { ZipBackupHandler } from './components/zip-loader.js';
import { GeoSearch } from './components/search.js';
import { GoogleDriveConnector } from './components/drive-connector.js';
import { FolderBackupLoader } from './components/folder-loader.js';
import { BiTaViNativeParser } from './components/bitavi-native-parser.js';
import { RoutePlaybackSimulator } from './components/playback.js';
import { exportToKml, exportToKmz } from './components/kml-kmz-exporter.js';
import { OfflineMapManager } from './components/offline-map-manager.js';
import { ShareCard } from './components/share-card.js';
import { BiTaViStorage } from './components/storage.js';
import { APP_VERSION } from './version.js';
import 'leaflet/dist/leaflet.css';

// Global Error Catcher for On-Screen Visibility
window.addEventListener('error', (e) => {
  console.error('BiTaVi Runtime Error:', e.error || e.message);
  const coords = document.getElementById('cursor-coords');
  if (coords) coords.innerHTML = `⚠️ <span style="color:#ef4444; font-weight:bold;">Error:</span> ${e.message}`;
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('BiTaVi Promise Rejection:', e.reason);
  const coords = document.getElementById('cursor-coords');
  if (coords) coords.innerHTML = `⚠️ <span style="color:#ef4444; font-weight:bold;">Error en proceso:</span> ${e.reason?.message || e.reason}`;
});

document.addEventListener('DOMContentLoaded', () => {
  // Sincronizar el badge de versión del HUD con la versión centralizada
  const versionTagEl = document.querySelector('.version-tag');
  if (versionTagEl) versionTagEl.textContent = `v${APP_VERSION}`;

  // DOM Elements
  const telemetryLat = document.getElementById('telemetry-lat');
  const telemetryLng = document.getElementById('telemetry-lng');
  const telemetryZoom = document.getElementById('telemetry-zoom');
  const telemetryAcc = document.getElementById('telemetry-acc');
  const cursorCoords = document.getElementById('cursor-coords');
  
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  const btnSearchClear = document.getElementById('btn-search-clear');
  
  const btnLocate = document.getElementById('btn-locate');
  const btnSetManual = document.getElementById('btn-set-manual');
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const sidebar = document.getElementById('tactical-sidebar');
  
  const layerCards = document.querySelectorAll('.layer-card');
  
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const btnBrowseFiles = document.getElementById('btn-browse-files');
  const btnBrowseFolder = document.getElementById('btn-browse-folder');
  const btnLoadSampleZip = document.getElementById('btn-load-sample-zip');
  
  // Google Drive Modal Elements
  const btnOpenGdriveModal = document.getElementById('btn-open-gdrive-modal');
  const gdriveModal = document.getElementById('gdrive-modal');
  const gdriveModalClose = document.getElementById('gdrive-modal-close');
  const gdriveModalBackdrop = document.getElementById('gdrive-modal-backdrop');
  const gdriveClientIdInput = document.getElementById('gdrive-client-id');
  const btnSaveGdriveCreds = document.getElementById('btn-save-gdrive-creds');
  const btnGdriveLogin = document.getElementById('btn-gdrive-login');
  const gdriveStatusMsg = document.getElementById('gdrive-status-msg');
  const gdriveFilesContainer = document.getElementById('gdrive-files-container');
  const gdriveFilesList = document.getElementById('gdrive-files-list');

  // Connected Folder & Backup Selector Elements
  const connectedFolderBar = document.getElementById('connected-folder-bar');
  const connectedFolderLabel = document.getElementById('connected-folder-label');
  const connectedFolderStats = document.getElementById('connected-folder-stats');
  const btnShowFolderBackups = document.getElementById('btn-show-folder-backups');
  const folderBackupModal = document.getElementById('folder-backup-modal');
  const folderModalClose = document.getElementById('folder-modal-close');
  const folderModalBackdrop = document.getElementById('folder-modal-backdrop');
  const folderModalDirName = document.getElementById('folder-modal-dir-name');
  const btnFolderChangeDir = document.getElementById('btn-folder-change-dir');
  const folderBackupFilter = document.getElementById('folder-backup-filter');
  const folderBackupsList = document.getElementById('folder-backups-list');
  const folderEmptyMsg = document.getElementById('folder-empty-msg');

  // ZIP Analysis Elements
  const zipAnalysisEmpty = document.getElementById('zip-analysis-empty');
  const zipAnalysisContent = document.getElementById('zip-analysis-content');
  const zipInfoName = document.getElementById('zip-info-name');
  const zipInfoSize = document.getElementById('zip-info-size');
  const zipMetadataBox = document.getElementById('zip-metadata-box');
  const zipMetaJson = document.getElementById('zip-meta-json');
  const zipStatTotal = document.getElementById('zip-stat-total');
  const zipStatGpx = document.getElementById('zip-stat-gpx');
  const zipStatPhotos = document.getElementById('zip-stat-photos');
  const zipStatConfigs = document.getElementById('zip-stat-configs');
  const zipFilesTree = document.getElementById('zip-files-tree');
  
  // Route Telemetry Elements
  const routeSelectWrapper = document.getElementById('route-select-wrapper');
  const routeSelector = document.getElementById('route-selector');
  const btnAddRoute = document.getElementById('btn-add-route');
  const btnAddRouteAction = document.getElementById('btn-add-route-action');
  const routeFileAddInput = document.getElementById('route-file-add-input');
  const chkGroupByDay = document.getElementById('chk-group-by-day');
  const btnSaveCombinedRoute = document.getElementById('btn-save-combined-route');
  const btnSaveByDay = document.getElementById('btn-save-by-day');
  const btnSaveSelectedZip = document.getElementById('btn-save-selected-zip');
  const btnSaveSelectedKml = document.getElementById('btn-save-selected-kml');
  const btnSaveSelectedKmz = document.getElementById('btn-save-selected-kmz');
  const btnExportKmzPhotos = document.getElementById('btn-export-kmz-photos');

  // Offline Maps Elements (v1.0.4-alpha)
  const connectivityIndicator = document.getElementById('connectivity-indicator');
  const connectivityText = document.getElementById('connectivity-text');
  const offlineCacheCount = document.getElementById('offline-cache-count');
  const btnDownloadOfflineMap = document.getElementById('btn-download-offline-map');
  const btnClearOfflineCache = document.getElementById('btn-clear-offline-cache');
  const statDistance = document.getElementById('stat-distance');
  const statPoints = document.getElementById('stat-points');
  const statElevation = document.getElementById('stat-elevation');
  const statPhotosCount = document.getElementById('stat-photos-count');
  const routeDateBadge = document.getElementById('route-date-badge');
  const routeDateText = document.getElementById('route-date-text');
  const statRouteDate = document.getElementById('stat-route-date');
  const routeActions = document.getElementById('route-actions');
  const btnFitRoute = document.getElementById('btn-fit-route');
  const btnClearRoute = document.getElementById('btn-clear-route');
  const btnShareCard = document.getElementById('btn-share-card');
  const btnTogglePhotos = document.getElementById('btn-toggle-photos');
  // Photo & Lightbox Elements
  const photosContainer = document.getElementById('photos-container');
  const photosList = document.getElementById('photos-list');
  const photoModal = document.getElementById('photo-modal');
  const modalClose = document.getElementById('modal-close');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalImg = document.getElementById('modal-img');
  const modalPhotoName = document.getElementById('modal-photo-name');
  const modalPhotoDate = document.getElementById('modal-photo-date');
  const modalJumpBtn = document.getElementById('modal-jump-btn');
  const modalSetLocationBtn = document.getElementById('modal-set-location-btn');

  // Session Restore Elements (IndexedDB v0.4.8-alpha)
  const sessionRestoreBanner = document.getElementById('session-restore-banner');
  const sessionBannerText = document.getElementById('session-banner-text');
  const btnRestoreSession = document.getElementById('btn-restore-session');
  const btnDiscardSession = document.getElementById('btn-discard-session');

  // Playback Simulator Elements (v1.0.1-alpha)
  const btnTogglePlayback = document.getElementById('btn-toggle-playback');
  const btnSimulateRoute = document.getElementById('btn-simulate-route');
  const playbackBar = document.getElementById('playback-bar');
  const playbackCloseBtn = document.getElementById('playback-close-btn');
  const playbackPlayBtn = document.getElementById('playback-play-btn');
  const playbackStopBtn = document.getElementById('playback-stop-btn');
  const playbackSlider = document.getElementById('playback-slider');
  const playbackPercent = document.getElementById('playback-percent');
  const playbackFollowBtn = document.getElementById('playback-follow-btn');
  const playbackSpeedBtns = document.querySelectorAll('.playback-speed-group .speed-btn');
  const simTelemetryDist = document.getElementById('sim-telemetry-dist');
  const simTelemetrySpeed = document.getElementById('sim-telemetry-speed');
  const simTelemetryEle = document.getElementById('sim-telemetry-ele');
  const simTelemetryBearing = document.getElementById('sim-telemetry-bearing');
  const simTelemetryTime = document.getElementById('sim-telemetry-time');
  const playbackRouteName = document.getElementById('playback-route-name');

  // State Variables
  let activeModalPhoto = null;
  let currentRouteBounds = null;
  let isManualLocationPickMode = false;
  let photoPlacementMode = null;

  // 1. Initialize Map
  let mapInstance;
  try {
    mapInstance = new BiTaViMap(
      'map',
      // On Coordinates / Zoom update
      (coords) => {
        telemetryLat.textContent = `${coords.lat.toFixed(6)}°`;
        telemetryLng.textContent = `${coords.lng.toFixed(6)}°`;
        telemetryZoom.textContent = coords.zoom;
        if (!isManualLocationPickMode) {
          cursorCoords.textContent = `LAT: ${coords.lat.toFixed(6)}° | LNG: ${coords.lng.toFixed(6)}° | ZOOM: ${coords.zoom}`;
        }
      },
      // On User Location Found
      (loc) => {
        telemetryLat.textContent = `${loc.lat.toFixed(6)}°`;
        telemetryLng.textContent = `${loc.lng.toFixed(6)}°`;
        telemetryAcc.textContent = `±${loc.accuracy} m`;
        cursorCoords.textContent = `📍 Ubicación fijada: ${loc.label || 'Posición GPS'} (±${loc.accuracy}m)`;
      },
      // On Location Error (e.g. PC without GPS antenna or denied permissions)
      (errorMsg) => {
        cursorCoords.textContent = `⚠️ ${errorMsg}`;
      }
    );
  } catch (mapErr) {
    console.error('[BiTaVi] Error inicializando el mapa:', mapErr);
    cursorCoords.textContent = `⚠️ Error al iniciar el mapa: ${mapErr.message}`;
    alert('No se pudo inicializar el mapa. Abre la consola (F12) para ver el error.');
    return;
  }

  // 2. Initialize Handlers
  const gpxHandler = new GpxHandler(mapInstance);
  const photoHandler = new PhotoHandler(mapInstance, (photo) => {
    openPhotoModal(photo);
  });
  const zipHandler = new ZipBackupHandler();
  const geoSearch = new GeoSearch();
  const nativeParser = new BiTaViNativeParser(mapInstance);
  const shareCard = new ShareCard(APP_VERSION);
  const storage = new BiTaViStorage();

  // 3. Inicializar Simulador y Reproductor Táctico de Viaje (v1.0.1-alpha)
  const playbackSimulator = new RoutePlaybackSimulator(mapInstance);

  playbackSimulator.onTelemetryUpdate = (t) => {
    if (simTelemetryDist) simTelemetryDist.textContent = `${t.distanceKm} / ${t.totalDistanceKm} km`;
    if (simTelemetrySpeed) simTelemetrySpeed.textContent = `${t.speedKmh} km/h`;
    if (simTelemetryEle) simTelemetryEle.textContent = `${t.ele} m`;
    if (simTelemetryBearing) simTelemetryBearing.textContent = `${t.bearing}° ${t.cardinal}`;
    if (simTelemetryTime) simTelemetryTime.textContent = t.time;
    if (playbackSlider) playbackSlider.value = t.percent;
    if (playbackPercent) playbackPercent.textContent = `${t.percent.toFixed(1)}%`;
  };

  playbackSimulator.onStateChange = (state) => {
    if (playbackPlayBtn) {
      playbackPlayBtn.textContent = state.isPlaying ? '⏸ Pausar' : '▶ Reanudar';
      if (state.isPlaying) {
        playbackPlayBtn.classList.remove('accent');
        playbackPlayBtn.classList.add('highlight-btn');
      } else {
        playbackPlayBtn.classList.remove('highlight-btn');
        playbackPlayBtn.classList.add('accent');
      }
    }
  };

  playbackSimulator.onFinish = () => {
    if (playbackPlayBtn) {
      playbackPlayBtn.textContent = '▶ Reiniciar';
      playbackPlayBtn.classList.remove('highlight-btn');
      playbackPlayBtn.classList.add('accent');
    }
    updateProgress(100, '🏁 Simulación táctica completada.', 'Recorrido finalizado.');
  };

  playbackSimulator.onPhotoNear = (photo, distMeters) => {
    const coordsEl = document.getElementById('cursor-coords');
    if (coordsEl) {
      coordsEl.innerHTML = `📷 <span style="color:var(--accent-cyan)">Foto en ruta:</span> ${photo.name} (${Math.round(distMeters)} m)`;
    }
  };

  function openPlayback(points, title = 'Ruta Activa') {
    if (!points || points.length < 2) {
      alert('⚠️ No hay suficientes puntos GPS cargados para simular el recorrido.');
      return;
    }
    if (playbackBar) playbackBar.classList.remove('hidden');
    if (playbackRouteName) playbackRouteName.textContent = title;
    playbackSimulator.loadRoute(points, photoHandler.photos);
    if (playbackSlider) playbackSlider.value = 0;
    if (playbackPercent) playbackPercent.textContent = '0.0%';
    if (playbackPlayBtn) {
      playbackPlayBtn.textContent = '▶ Iniciar';
      playbackPlayBtn.classList.add('accent');
      playbackPlayBtn.classList.remove('highlight-btn');
    }
  }

  function startPlaybackForActiveRoutes() {
    let pts = [];
    let title = 'Expedición';

    if (nativeParser.pointsByRoute && nativeParser.pointsByRoute.size > 0) {
      const visibleIds = Array.from(nativeParser.visibleRoutes);
      if (visibleIds.length > 0) {
        visibleIds.forEach(id => {
          const routePts = nativeParser.pointsByRoute.get(id);
          if (routePts && routePts.length > 0) {
            pts = pts.concat(routePts);
          }
        });
        const firstRoute = nativeParser.routes.find(r => r.id === visibleIds[0]);
        title = visibleIds.length === 1 ? (firstRoute?.name || 'Ruta') : `${visibleIds.length} Rutas Visibles`;
      } else {
        const firstEntry = nativeParser.pointsByRoute.entries().next().value;
        if (firstEntry) {
          pts = firstEntry[1];
          const r = nativeParser.routes.find(x => x.id === firstEntry[0]);
          title = r?.name || 'Ruta';
        }
      }
    }

    if (!pts || pts.length < 2) {
      alert('ℹ️ Carga primero una ruta GPX o un backup de BiTaVi para iniciar la simulación táctica.');
      return;
    }

    openPlayback(pts, title);
  }

  // Listeners de la barra de reproducción
  if (btnTogglePlayback) {
    btnTogglePlayback.addEventListener('click', () => {
      if (playbackBar && !playbackBar.classList.contains('hidden')) {
        playbackSimulator.stop();
        playbackBar.classList.add('hidden');
      } else {
        startPlaybackForActiveRoutes();
      }
    });
  }

  if (btnSimulateRoute) {
    btnSimulateRoute.addEventListener('click', () => {
      startPlaybackForActiveRoutes();
    });
  }

  if (playbackCloseBtn) {
    playbackCloseBtn.addEventListener('click', () => {
      playbackSimulator.destroy();
      if (playbackBar) playbackBar.classList.add('hidden');
    });
  }

  if (playbackPlayBtn) {
    playbackPlayBtn.addEventListener('click', () => {
      if (playbackSimulator.isPlaying) {
        playbackSimulator.pause();
      } else {
        playbackSimulator.play();
      }
    });
  }

  if (playbackStopBtn) {
    playbackStopBtn.addEventListener('click', () => {
      playbackSimulator.stop();
      if (playbackSlider) playbackSlider.value = 0;
      if (playbackPercent) playbackPercent.textContent = '0.0%';
    });
  }

  if (playbackSlider) {
    playbackSlider.addEventListener('input', (e) => {
      playbackSimulator.seekPercent(parseFloat(e.target.value));
    });
  }

  if (playbackFollowBtn) {
    playbackFollowBtn.addEventListener('click', () => {
      const willFollow = !playbackSimulator.followVehicle;
      playbackSimulator.setFollow(willFollow);
      playbackFollowBtn.classList.toggle('active-toggle', willFollow);
    });
  }

  if (playbackSpeedBtns) {
    playbackSpeedBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        playbackSpeedBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const speed = parseFloat(btn.dataset.speed) || 1;
        playbackSimulator.setSpeed(speed);
      });
    });
  }

  // 4. Inicializar Administrador de Mapas 100% Offline (v1.0.4-alpha)
  const offlineMapManager = new OfflineMapManager();
  offlineMapManager.registerServiceWorker();

  async function refreshOfflineStats() {
    const stats = await offlineMapManager.getCacheStats();
    if (offlineCacheCount) {
      offlineCacheCount.textContent = `${stats.tileCount} teselas (~${stats.estimatedSizeMb} MB)`;
    }
  }
  refreshOfflineStats();

  offlineMapManager.onConnectivityChange = ({ online }) => {
    if (connectivityIndicator) {
      connectivityIndicator.className = online ? 'status-indicator-dot online' : 'status-indicator-dot warning';
    }
    if (connectivityText) {
      connectivityText.textContent = online ? 'MODO EN LÍNEA (ONLINE)' : '📡 MODO CAMPO (OFFLINE)';
    }
    if (!online) {
      cursorCoords.innerHTML = '📡 <span style="color:var(--accent-amber);font-weight:700;">Modo Campo Offline Activo:</span> Navegando con teselas en caché local.';
    } else {
      cursorCoords.textContent = '🛰️ Conexión restaurada a los servidores cartográficos.';
    }
  };

  if (btnDownloadOfflineMap) {
    btnDownloadOfflineMap.addEventListener('click', async () => {
      if (!mapInstance?.map) return;
      const b = mapInstance.map.getBounds();
      const currentZoom = mapInstance.map.getZoom();
      const zooms = [currentZoom, Math.min(18, currentZoom + 1), Math.min(18, currentZoom + 2)];

      const bounds = {
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest()
      };

      const template = mapInstance.getCurrentTileUrlTemplate();

      try {
        btnDownloadOfflineMap.disabled = true;
        btnDownloadOfflineMap.textContent = '⏳ Descargando...';

        const result = await offlineMapManager.downloadAreaTiles({
          bounds,
          zoomLevels: zooms,
          layerUrlTemplate: template,
          onProgress: (p) => {
            updateProgress(p.percent, p.phase, `Tesela ${p.completed} de ${p.total}`);
          }
        });

        await refreshOfflineStats();
        cursorCoords.innerHTML = `✅ <span style="color:var(--accent-cyan);font-weight:700;">Cuadrante Offline Guardado:</span> ${result.downloaded} teselas listas para usar sin internet.`;
      } catch (err) {
        console.error('[Offline Download Error]', err);
        alert(`Error al descargar cuadrante offline: ${err.message}`);
      } finally {
        btnDownloadOfflineMap.disabled = false;
        btnDownloadOfflineMap.textContent = '📥 Descargar Cuadrante';
      }
    });
  }

  if (btnClearOfflineCache) {
    btnClearOfflineCache.addEventListener('click', async () => {
      const ok = confirm('¿Deseas purgar todas las teselas de mapas almacenadas en la caché offline?');
      if (ok) {
        await offlineMapManager.clearTileCache();
        await refreshOfflineStats();
        cursorCoords.textContent = '🗑️ Caché de teselas purgada con éxito.';
      }
    });
  }

  // Sincronizador del buscador táctico local con los datos de expedición
  const refreshSearchIndex = () => {
    geoSearch.indexLocalData({
      routes: nativeParser.routes,
      markers: nativeParser.markers,
      favorites: nativeParser.favorites,
      photos: photoHandler.photos,
      pointsByRoute: nativeParser.pointsByRoute
    });
  };

  // Al geolocalizar/reescribir una foto (drag del marcador), refrescar vistas, buscador y almacenamiento local
  photoHandler.onPhotoGeotag = (photo) => {
    updatePhotosGallery(photoHandler.photos);
    const geoCount = photoHandler.photos.filter(p => p.lat !== null && p.lng !== null && !isNaN(p.lat) && !isNaN(p.lng)).length;
    statPhotosCount.textContent = geoCount;
    refreshSearchIndex();
    storage.updatePhotoCoordinates(photo.id, photo.lat, photo.lng);
  };

  // --- Rail de fotos con conectores al mapa (vista táctica en pantalla) ---
  const mainContainerEl = document.querySelector('.main-container');

  const photoRail = document.createElement('div');
  photoRail.className = 'photo-rail hidden';
  photoRail.id = 'photo-rail';
  mainContainerEl.appendChild(photoRail);

  const connectorSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  connectorSvg.setAttribute('class', 'connector-layer hidden');
  mainContainerEl.appendChild(connectorSvg);

  const railPhotoEls = new Map();
  let photosRailVisible = false;

  function buildPhotoRail() {
    photoRail.innerHTML = '';
    railPhotoEls.clear();
    const bounds = mapInstance.map.getBounds();
    const geoPhotos = photoHandler.photos.filter(p =>
      p.lat !== null && p.lng !== null && !isNaN(p.lat) && !isNaN(p.lng) &&
      bounds.contains([p.lat, p.lng])
    ).sort((a, b) => (a.ts || 0) - (b.ts || 0));
    if (geoPhotos.length === 0) {
      photoRail.innerHTML = '<div class="photo-rail-empty">No hay fotos en esta vista del mapa</div>';
      return;
    }
    geoPhotos.forEach(photo => {
      const item = document.createElement('div');
      item.className = 'photo-rail-item';
      item.innerHTML = `<img src="${photo.url}" alt="${photo.name}" class="photo-rail-thumb" draggable="false" />`;
      item.addEventListener('click', () => {
        photoHandler.focusPhoto(photo.id);
        railPhotoEls.forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        openPhotoModal(photo);
      });
      item.draggable = true;
      item.addEventListener('dragstart', (ev) => {
        ev.dataTransfer.setData('application/x-bitavi-photo', photo.id);
        ev.dataTransfer.effectAllowed = 'move';
        cursorCoords.textContent = '📤 Suelta la foto sobre el mapa para ubicarla...';
      });
      photoRail.appendChild(item);
      railPhotoEls.set(photo.id, item);
    });
  }

  function drawConnectors() {
    if (!photosRailVisible) return;
    while (connectorSvg.firstChild) connectorSvg.removeChild(connectorSvg.firstChild);
    const mcRect = mainContainerEl.getBoundingClientRect();

    // Color adaptativo según el fondo del mapa (claro/oscuro) para que se vea
    const theme = (typeof mapInstance.getBasemapTheme === 'function') ? mapInstance.getBasemapTheme() : 'dark';
    const palette = theme === 'dark'
      ? { line: 'rgba(245, 158, 11, 0.95)', dotFill: '#00f0ff', dotStroke: '#ffffff' }
      : { line: 'rgba(124, 45, 18, 0.95)', dotFill: '#0f172a', dotStroke: '#ffffff' };

    photoHandler.photos.forEach(photo => {
      if (!(photo.lat !== null && photo.lng !== null && !isNaN(photo.lat) && !isNaN(photo.lng))) return;
      const el = railPhotoEls.get(photo.id);
      const marker = photoHandler.photoMarkers.get(photo.id);
      if (!el || !marker) return;
      const r = el.getBoundingClientRect();
      const ax = r.right - mcRect.left;
      const ay = r.top + r.height / 2 - mcRect.top;
      const pt = mapInstance.map.latLngToContainerPoint(marker.getLatLng());
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', ax);
      line.setAttribute('y1', ay);
      line.setAttribute('x2', pt.x);
      line.setAttribute('y2', pt.y);
      line.setAttribute('class', 'connector-line');
      line.style.stroke = palette.line;
      connectorSvg.appendChild(line);
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', pt.x);
      dot.setAttribute('cy', pt.y);
      dot.setAttribute('r', 5);
      dot.setAttribute('class', 'connector-dot');
      dot.style.fill = palette.dotFill;
      dot.style.stroke = palette.dotStroke;
      connectorSvg.appendChild(dot);
    });
  }

  function togglePhotosRail(force) {
    photosRailVisible = (typeof force === 'boolean') ? force : !photosRailVisible;
    if (photosRailVisible) {
      photoHandler.hidePhotoMarkers();
      nativeParser.hideDataMarkers();
      mapInstance.hideRouteMarkers();
      document.body.classList.add('fotos-active');
      buildPhotoRail();
      photoRail.classList.remove('hidden');
      connectorSvg.classList.remove('hidden');
      drawConnectors();
    } else {
      photoHandler.showPhotoMarkers();
      nativeParser.showDataMarkers();
      mapInstance.showRouteMarkers();
      document.body.classList.remove('fotos-active');
      photoRail.classList.add('hidden');
      connectorSvg.classList.add('hidden');
    }
  }

  mapInstance.map.on('move', drawConnectors);
  mapInstance.map.on('zoom', drawConnectors);
  mapInstance.map.on('resize', drawConnectors);
  mapInstance.map.on('moveend', () => {
    if (photosRailVisible) {
      buildPhotoRail();
      drawConnectors();
    }
  });
  photoRail.addEventListener('scroll', drawConnectors);
  window.addEventListener('resize', drawConnectors);

  // Actualiza los valores de la telemetría (distancia, puntos, rutas/marcadores)
  function updateAllRouteStats() {
    const stats = nativeParser.recalculateStats();
    statDistance.textContent = `${stats.totalDistanceKm} km`;
    statPoints.textContent = stats.totalPoints.toLocaleString();
    statElevation.textContent = `${stats.routesCount} r / ${stats.markersCount + stats.favoritesCount} m`;
    showRouteDate(nativeParser.routes);
    if (stats.routesCount > 0) {
      routeActions.classList.remove('hidden');
    } else {
      routeActions.classList.add('hidden');
    }
  }

  function populateRouteSelector(routes) {
    if (!routes || routes.length === 0) {
      routeSelectWrapper.classList.add('hidden');
      return;
    }

    routeSelectWrapper.classList.remove('hidden');
    const colorMap = nativeParser.getRouteColorMap();
    routeSelector.innerHTML = '';
    routeSelector.className = 'route-checklist';

    // Fila maestra: seleccionar/deseleccionar todas para exportar y contador
    const allWrap = document.createElement('div');
    allWrap.className = 'route-check-all';
    allWrap.innerHTML = `
      <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
        <input type="checkbox" class="route-export-all-box" checked title="Seleccionar/Deseleccionar todas para exportar">
        <span style="color:var(--accent-cyan); font-weight:700;">Elegir todas (${routes.length})</span>
      </label>
      <button type="button" class="btn-inline-icon btn-toggle-all-vis" title="Mostrar/Ocultar todas en el mapa" style="color:var(--text-muted); font-size:0.65rem;">👁️ Alternar</button>
    `;
    routeSelector.appendChild(allWrap);

    const allBox = allWrap.querySelector('.route-export-all-box');
    const btnToggleAllVis = allWrap.querySelector('.btn-toggle-all-vis');

    allBox.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      routeSelector.querySelectorAll('.route-export-box').forEach(cb => { cb.checked = isChecked; });
      routeSelector.querySelectorAll('.route-day-box').forEach(cb => { cb.checked = isChecked; });
      routes.forEach(r => nativeParser.setRouteVisibility(r.id, isChecked));
      routeSelector.querySelectorAll('.route-item-row').forEach(row => {
        const visBtn = row.querySelector('.btn-toggle-vis');
        if (isChecked) {
          row.classList.remove('route-hidden-row');
          if (visBtn) visBtn.textContent = '👁️';
        } else {
          row.classList.add('route-hidden-row');
          if (visBtn) visBtn.textContent = '🙈';
        }
      });
      routeSelector.querySelectorAll('.btn-toggle-day-vis').forEach(btn => {
        btn.textContent = isChecked ? '👁️' : '🙈';
      });
    });

    let allVisible = true;
    btnToggleAllVis.addEventListener('click', () => {
      allVisible = !allVisible;
      allBox.checked = allVisible;
      routeSelector.querySelectorAll('.route-export-box').forEach(cb => { cb.checked = allVisible; });
      routeSelector.querySelectorAll('.route-day-box').forEach(cb => { cb.checked = allVisible; });
      routes.forEach(r => nativeParser.setRouteVisibility(r.id, allVisible));
      routeSelector.querySelectorAll('.route-item-row').forEach(row => {
        const visBtn = row.querySelector('.btn-toggle-vis');
        if (allVisible) {
          row.classList.remove('route-hidden-row');
          if (visBtn) visBtn.textContent = '👁️';
        } else {
          row.classList.add('route-hidden-row');
          if (visBtn) visBtn.textContent = '🙈';
        }
      });
      routeSelector.querySelectorAll('.btn-toggle-day-vis').forEach(btn => {
        btn.textContent = allVisible ? '👁️' : '🙈';
      });
    });

    function createRouteRow(r) {
      const color = colorMap.get(r.id) || '#00f0ff';
      const isVisible = nativeParser.visibleRoutes.has(r.id);

      const row = document.createElement('div');
      row.className = `route-item-row ${isVisible ? '' : 'route-hidden-row'}`;
      row.dataset.routeId = r.id;

      row.innerHTML = `
        <input type="checkbox" class="route-export-box" data-route-id="${r.id}" ${isVisible ? 'checked' : ''} title="Mostrar / Ocultar esta ruta en el mapa y seleccionarla para guardar">
        <span class="route-swatch" style="background:${color}" title="Color asignado en el mapa"></span>
        <div class="route-name-container">
          <span class="route-name-text" title="Clic para renombrar">${r.name}</span>
          <input type="text" class="route-name-input hidden" value="${r.name}" />
          <button type="button" class="btn-inline-icon btn-rename-route" title="Renombrar ruta">✏️</button>
        </div>
        <span class="route-dist-tag monospace">${r.distanceKm} km</span>
        <button type="button" class="btn-inline-icon btn-play-route" title="Simular / Reproducir esta ruta en el mapa" style="color:var(--accent-cyan);">▶</button>
        <button type="button" class="btn-inline-icon btn-toggle-vis" title="Mostrar/Ocultar en el mapa">${isVisible ? '👁️' : '🙈'}</button>
        <button type="button" class="btn-inline-icon btn-download-gpx" title="Guardar esta ruta individual en .GPX con su nombre">💾</button>
        <button type="button" class="btn-inline-icon btn-danger btn-delete-route" title="Eliminar ruta del mapa">✕</button>
      `;

      const exportBox = row.querySelector('.route-export-box');
      const nameText = row.querySelector('.route-name-text');
      const nameInput = row.querySelector('.route-name-input');
      const renameBtn = row.querySelector('.btn-rename-route');
      const playBtn = row.querySelector('.btn-play-route');
      const visBtn = row.querySelector('.btn-toggle-vis');
      const downloadBtn = row.querySelector('.btn-download-gpx');
      const deleteBtn = row.querySelector('.btn-delete-route');

      if (playBtn) {
        playBtn.addEventListener('click', () => {
          const pts = nativeParser.pointsByRoute.get(r.id);
          if (pts && pts.length > 1) {
            nativeParser.setRouteVisibility(r.id, true);
            row.classList.remove('route-hidden-row');
            if (visBtn) visBtn.textContent = '👁️';
            exportBox.checked = true;
            openPlayback(pts, r.name);
          } else {
            alert('⚠️ Esta ruta no contiene suficientes puntos GPS para la simulación.');
          }
        });
      }

      // Al cambiar la casilla de verificación: mostrar/ocultar la ruta en el mapa de inmediato
      exportBox.addEventListener('change', (e) => {
        const showRoute = e.target.checked;
        nativeParser.setRouteVisibility(r.id, showRoute);
        if (showRoute) {
          row.classList.remove('route-hidden-row');
          if (visBtn) visBtn.textContent = '👁️';
        } else {
          row.classList.add('route-hidden-row');
          if (visBtn) visBtn.textContent = '🙈';
        }
        const allBoxes = Array.from(routeSelector.querySelectorAll('.route-export-box'));
        allBox.checked = allBoxes.every(b => b.checked);
        const dayGroup = row.closest('.route-day-group');
        if (dayGroup) {
          const dayBox = dayGroup.querySelector('.route-day-box');
          const dayBoxes = Array.from(dayGroup.querySelectorAll('.route-export-box'));
          if (dayBox) dayBox.checked = dayBoxes.every(b => b.checked);
        }
      });

      // Lógica de renombrado interactivo
      function startEditingName() {
        nameText.classList.add('hidden');
        nameInput.classList.remove('hidden');
        nameInput.value = r.name;
        nameInput.focus();
        nameInput.select();
      }

      function commitName() {
        const newName = nameInput.value.trim();
        if (newName && newName !== r.name) {
          nativeParser.renameRoute(r.id, newName);
          nameText.textContent = newName;
          r.name = newName;
          persistCurrentSession();
          refreshSearchIndex();
          cursorCoords.textContent = `✏️ Ruta renombrada a "${newName}".`;
        }
        nameInput.classList.add('hidden');
        nameText.classList.remove('hidden');
      }

      nameText.addEventListener('click', startEditingName);
      renameBtn.addEventListener('click', startEditingName);

      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitName();
        } else if (e.key === 'Escape') {
          nameInput.value = r.name;
          nameInput.classList.add('hidden');
          nameText.classList.remove('hidden');
        }
      });

      nameInput.addEventListener('blur', commitName);

      // Botón alternar visibilidad rápida (sincronizado con la casilla)
      visBtn.addEventListener('click', () => {
        const currentlyVisible = nativeParser.visibleRoutes.has(r.id);
        const nextVisible = !currentlyVisible;
        exportBox.checked = nextVisible;
        nativeParser.setRouteVisibility(r.id, nextVisible);
        if (nextVisible) {
          row.classList.remove('route-hidden-row');
          visBtn.textContent = '👁️';
        } else {
          row.classList.add('route-hidden-row');
          visBtn.textContent = '🙈';
        }
        const allBoxes = Array.from(routeSelector.querySelectorAll('.route-export-box'));
        allBox.checked = allBoxes.every(b => b.checked);
        const dayGroup = row.closest('.route-day-group');
        if (dayGroup) {
          const dayBox = dayGroup.querySelector('.route-day-box');
          const dayBoxes = Array.from(dayGroup.querySelectorAll('.route-export-box'));
          if (dayBox) dayBox.checked = dayBoxes.every(b => b.checked);
        }
      });

      // Guardar GPX individual directamente con su nombre
      downloadBtn.addEventListener('click', () => {
        const gpxXml = nativeParser.exportRouteToGpx(r.id, r.name);
        if (!gpxXml) {
          alert('No se pudo generar el archivo GPX para esta ruta.');
          return;
        }
        const safeFile = `${sanitizeFilename(r.name)}.gpx`;
        const blob = new Blob([gpxXml], { type: 'application/gpx+xml;charset=utf-8' });
        downloadBlob(blob, safeFile);
        cursorCoords.textContent = `💾 Ruta "${r.name}" guardada como ${safeFile}`;
      });

      // Eliminar ruta individual
      deleteBtn.addEventListener('click', () => {
        if (confirm(`¿Quitar la ruta "${r.name}" del visor?`)) {
          nativeParser.removeRoute(r.id);
          populateRouteSelector(nativeParser.routes);
          updateAllRouteStats();
          persistCurrentSession();
          refreshSearchIndex();
          cursorCoords.textContent = `🗑️ Ruta eliminada.`;
        }
      });

      return row;
    }

    // Comprobar si se deben agrupar las rutas por día
    const shouldGroupByDay = chkGroupByDay ? chkGroupByDay.checked : true;

    if (shouldGroupByDay) {
      const groupedByDay = groupRoutesByDay(routes, nativeParser.pointsByRoute);

      groupedByDay.forEach((dayRoutes, dateSlug) => {
        const dayGroup = document.createElement('div');
        dayGroup.className = 'route-day-group';
        dayGroup.style.cssText = 'margin-bottom: 6px; border: 1px solid var(--border-dark); border-radius: 4px; overflow: hidden; background: rgba(0,0,0,0.2);';

        const dayHeader = document.createElement('div');
        dayHeader.className = 'route-day-header';
        dayHeader.style.cssText = 'background: rgba(255, 179, 0, 0.08); padding: 4px 6px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-dark);';

        const isSinFecha = dateSlug === 'Sin Fecha';
        const dayLabel = isSinFecha ? '📁 Sin Fecha Detectada' : `📅 ${dateSlug}`;
        const countLabel = `${dayRoutes.length} ${dayRoutes.length === 1 ? 'ruta' : 'rutas'}`;
        dayHeader.innerHTML = `
          <label style="display:flex; align-items:center; gap:5px; cursor:pointer; font-size:0.68rem; font-weight:700; color:${isSinFecha ? 'var(--text-muted)' : 'var(--accent-amber)'};">
            <input type="checkbox" class="route-day-box" ${allDayVisible ? 'checked' : ''} title="Marcar/desmarcar todas las rutas de ${dayLabel}">
            <span>${dayLabel} (${countLabel})</span>
          </label>
          <div style="display:flex; align-items:center; gap:4px;">
            <button type="button" class="btn-inline-icon btn-unir-dia" title="Unir y descargar las rutas de este grupo en un solo archivo GPX" style="color:var(--accent-cyan); font-size:0.62rem; font-weight:700; padding:1px 5px; border:1px solid var(--border-dark); border-radius:3px; background:rgba(0,0,0,0.3); cursor:pointer;">🔗 Unir Día</button>
            <button type="button" class="btn-inline-icon btn-toggle-day-vis" title="Mostrar/Ocultar rutas de este grupo en el mapa" style="font-size:0.65rem; cursor:pointer;">${allDayVisible ? '👁️' : '🙈'}</button>
          </div>
        `;
        dayGroup.appendChild(dayHeader);

        const dayItems = document.createElement('div');
        dayItems.className = 'route-day-items';
        dayRoutes.forEach(r => {
          dayItems.appendChild(createRouteRow(r));
        });
        dayGroup.appendChild(dayItems);
        routeSelector.appendChild(dayGroup);

        const dayBox = dayHeader.querySelector('.route-day-box');
        const btnUnirDia = dayHeader.querySelector('.btn-unir-dia');
        const btnToggleDayVis = dayHeader.querySelector('.btn-toggle-day-vis');

        dayBox.addEventListener('change', (e) => {
          const isChecked = e.target.checked;
          dayItems.querySelectorAll('.route-export-box').forEach(cb => { cb.checked = isChecked; });
          dayRoutes.forEach(r => nativeParser.setRouteVisibility(r.id, isChecked));
          dayItems.querySelectorAll('.route-item-row').forEach(row => {
            const visBtn = row.querySelector('.btn-toggle-vis');
            if (isChecked) {
              row.classList.remove('route-hidden-row');
              if (visBtn) visBtn.textContent = '👁️';
            } else {
              row.classList.add('route-hidden-row');
              if (visBtn) visBtn.textContent = '🙈';
            }
          });
          btnToggleDayVis.textContent = isChecked ? '👁️' : '🙈';
          const allBoxes = Array.from(routeSelector.querySelectorAll('.route-export-box'));
          allBox.checked = allBoxes.every(b => b.checked);
        });

        btnUnirDia.addEventListener('click', () => {
          cursorCoords.textContent = `⏳ Unificando ${dayRoutes.length} rutas del día ${dateSlug}...`;
          const segments = dayRoutes.map(r => nativeParser.pointsByRoute.get(r.id) || []);
          const unifiedName = `Ruta ${dateSlug} (${dayRoutes.length} tramos)`;
          const gpxXml = createCombinedGpxXml(unifiedName, segments, nativeParser.markers);
          const fileName = `ruta_unificada_${dateSlug}.gpx`;
          const blob = new Blob([gpxXml], { type: 'application/gpx+xml;charset=utf-8' });
          downloadBlob(blob, fileName);
          cursorCoords.textContent = `✅ Día ${dateSlug} guardado como una sola ruta en ${fileName}`;
        });

        btnToggleDayVis.addEventListener('click', () => {
          const isVis = btnToggleDayVis.textContent === '👁️';
          const nextVis = !isVis;
          dayBox.checked = nextVis;
          dayBox.dispatchEvent(new Event('change'));
        });
      });
    } else {
      routes.forEach(r => {
        routeSelector.appendChild(createRouteRow(r));
      });
    }
  }

  // Agrega rutas de forma incremental desde archivos GPX, KML o TXT
  async function addNewRoutesFromFiles(files) {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    showProgress('AGREGANDO RUTAS', `${fileList.length} archivo(s)`, 15, 'Procesando archivos...', 'Incorporando telemetría...');

    try {
      let addedCount = 0;
      for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        updateProgress(Math.round(20 + (i / fileList.length) * 70), `Leyendo ${f.name}...`, 'Interpretando coordenadas...');

        if (f.name.toLowerCase().endsWith('.gpx')) {
          const text = await f.text();
          const parsed = gpxHandler.parseGpxText(text);
          if (parsed && parsed.points && parsed.points.length > 0) {
            const fileNameWithoutExt = f.name.replace(/\.[^/.]+$/, '');
            const routeName = parsed.name || fileNameWithoutExt || `Ruta ${nativeParser.routes.length + 1}`;
            nativeParser.addRoute({ name: routeName }, parsed.points, true);
            addedCount++;
          }
        } else if (f.name.toLowerCase().endsWith('.zip')) {
          const extracted = await zipHandler.processZipBackup(f);
          if (extracted.gpxText) {
            const parsed = gpxHandler.parseGpxText(extracted.gpxText);
            if (parsed.points && parsed.points.length > 0) {
              const routeName = parsed.name || f.name.replace(/\.[^/.]+$/, '');
              nativeParser.addRoute({ name: routeName }, parsed.points, true);
              addedCount++;
            }
          }
        }
      }

      updateAllRouteStats();
      populateRouteSelector(nativeParser.routes);

      const bounds = nativeParser.getVisibleRoutesBounds();
      if (bounds && bounds.isValid()) {
        mapInstance.fitBounds(bounds, { padding: [40, 40] });
      }

      updateProgress(100, `✅ ¡${addedCount} ruta(s) agregada(s) con éxito!`, 'Telemetría actualizada.');
      cursorCoords.textContent = `✅ Se agregaron ${addedCount} ruta(s) a la sesión.`;
      refreshSearchIndex();
      await persistCurrentSession();
      hideProgress(600);
    } catch (err) {
      hideProgress(0);
      console.error('[BiTaVi] Error agregando rutas:', err);
      alert(`Error al agregar rutas: ${err.message}`);
    }
  }

  // 1. Guarda las rutas marcadas unificadas en UN SOLO ARCHIVO GPX (.GPX)
  function saveCombinedRoute() {
    if (!nativeParser.routes || nativeParser.routes.length === 0) {
      alert('No hay rutas disponibles para guardar.');
      return;
    }

    const selectedBoxes = Array.from(routeSelector.querySelectorAll('.route-export-box:checked'));
    const selectedIds = selectedBoxes.map(b => b.dataset.routeId);
    const selectedRoutes = nativeParser.routes.filter(r => selectedIds.includes(r.id));

    if (selectedRoutes.length === 0) {
      alert('Por favor selecciona al menos una ruta marcando su casilla [✓] para guardarla.');
      return;
    }

    const firstRoute = selectedRoutes[0];
    const firstRoutePoints = nativeParser.pointsByRoute.get(firstRoute.id) || [];
    const dateSlug = extractRouteDateSlug(firstRoute, firstRoutePoints);

    // Si seleccionó 1 sola ruta: se descarga su GPX individual con su nombre
    if (selectedRoutes.length === 1) {
      const gpxXml = nativeParser.exportRouteToGpx(firstRoute.id, firstRoute.name);
      if (!gpxXml) {
        alert('Error generando GPX para la ruta seleccionada.');
        return;
      }
      const fileName = `${sanitizeFilename(firstRoute.name)}.gpx`;
      const blob = new Blob([gpxXml], { type: 'application/gpx+xml;charset=utf-8' });
      downloadBlob(blob, fileName);
      cursorCoords.textContent = `💾 Ruta "${firstRoute.name}" guardada como ${fileName}`;
      return;
    }

    // Múltiples rutas marcadas: unificarlas en una sola ruta GPX con tramos <trkseg>
    cursorCoords.textContent = `⏳ Unificando ${selectedRoutes.length} rutas en un solo archivo GPX...`;
    const segments = selectedRoutes.map(r => nativeParser.pointsByRoute.get(r.id) || []);
    const unifiedName = `${firstRoute.name} (Unificada)`;
    const gpxXml = createCombinedGpxXml(unifiedName, segments, nativeParser.markers);
    const fileName = `${sanitizeFilename(firstRoute.name)}_unificada_${dateSlug}.gpx`;
    const blob = new Blob([gpxXml], { type: 'application/gpx+xml;charset=utf-8' });
    downloadBlob(blob, fileName);
    cursorCoords.textContent = `✅ ${selectedRoutes.length} rutas unificadas en un solo archivo: ${fileName}`;
  }

  // 2. Guarda las rutas marcadas SEPARADAS en un archivo ZIP con la fecha de la primera ruta
  async function saveSelectedRoutesZip() {
    if (!nativeParser.routes || nativeParser.routes.length === 0) {
      alert('No hay rutas disponibles para guardar.');
      return;
    }

    const selectedBoxes = Array.from(routeSelector.querySelectorAll('.route-export-box:checked'));
    const selectedIds = selectedBoxes.map(b => b.dataset.routeId);
    const selectedRoutes = nativeParser.routes.filter(r => selectedIds.includes(r.id));

    if (selectedRoutes.length === 0) {
      alert('Por favor selecciona al menos una ruta marcando su casilla [✓] para guardarla.');
      return;
    }

    const firstRoute = selectedRoutes[0];
    const firstRoutePoints = nativeParser.pointsByRoute.get(firstRoute.id) || [];
    const dateSlug = extractRouteDateSlug(firstRoute, firstRoutePoints);

    cursorCoords.textContent = `⏳ Empaquetando ${selectedRoutes.length} rutas separadas en archivo ZIP...`;
    const zip = new JSZip();
    const usedNames = new Set();

    selectedRoutes.forEach((r, idx) => {
      const gpxXml = nativeParser.exportRouteToGpx(r.id, r.name);
      if (gpxXml) {
        let baseName = sanitizeFilename(r.name, `ruta_${idx + 1}`);
        if (usedNames.has(baseName)) {
          baseName = `${baseName}_${idx + 1}`;
        }
        usedNames.add(baseName);
        zip.file(`${baseName}.gpx`, gpxXml);
      }
    });

    const zipFileName = `rutas_${dateSlug}.zip`;
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, zipFileName);
    cursorCoords.textContent = `✅ ${selectedRoutes.length} rutas guardadas por separado en ${zipFileName}`;
  }

  // 3. Guarda las rutas marcadas agrupadas por día en GPX individual o ZIP
  async function saveRoutesGroupedByDay() {
    if (!nativeParser.routes || nativeParser.routes.length === 0) {
      alert('No hay rutas disponibles para guardar.');
      return;
    }

    const selectedBoxes = Array.from(routeSelector.querySelectorAll('.route-export-box:checked'));
    const selectedIds = selectedBoxes.map(b => b.dataset.routeId);
    const selectedRoutes = nativeParser.routes.filter(r => selectedIds.includes(r.id));

    if (selectedRoutes.length === 0) {
      alert('Por favor selecciona al menos una ruta marcando su casilla [✓] para guardarla.');
      return;
    }

    const groupedByDay = groupRoutesByDay(selectedRoutes, nativeParser.pointsByRoute);
    const days = Array.from(groupedByDay.keys());

    // Si solo hay 1 día seleccionado: descarga directa del archivo unificado GPX de ese día
    if (days.length === 1) {
      const dateSlug = days[0];
      const dayRoutes = groupedByDay.get(dateSlug);
      cursorCoords.textContent = `⏳ Unificando ${dayRoutes.length} rutas del día ${dateSlug}...`;
      const segments = dayRoutes.map(r => nativeParser.pointsByRoute.get(r.id) || []);
      const unifiedName = `Ruta ${dateSlug} (${dayRoutes.length} tramos)`;
      const gpxXml = createCombinedGpxXml(unifiedName, segments, nativeParser.markers);
      const fileName = `ruta_unificada_${dateSlug}.gpx`;
      const blob = new Blob([gpxXml], { type: 'application/gpx+xml;charset=utf-8' });
      downloadBlob(blob, fileName);
      cursorCoords.textContent = `✅ Día ${dateSlug} guardado como una sola ruta en ${fileName}`;
      return;
    }

    // Múltiples días seleccionados: empaquetar cada día unificado dentro de un ZIP
    cursorCoords.textContent = `⏳ Unificando ${selectedRoutes.length} rutas en ${days.length} archivos GPX diarios...`;
    const zip = new JSZip();

    for (const dateSlug of days) {
      const dayRoutes = groupedByDay.get(dateSlug);
      const segments = dayRoutes.map(r => nativeParser.pointsByRoute.get(r.id) || []);
      const unifiedName = `Ruta ${dateSlug} (${dayRoutes.length} tramos)`;
      const gpxXml = createCombinedGpxXml(unifiedName, segments, nativeParser.markers);
      zip.file(`ruta_unificada_${dateSlug}.gpx`, gpxXml);
    }

    const firstDay = days[0];
    const lastDay = days[days.length - 1];
    const zipFileName = `rutas_unificadas_por_dia_${firstDay}_a_${lastDay}.zip`;
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, zipFileName);
    cursorCoords.textContent = `✅ ${days.length} días unificados (${selectedRoutes.length} rutas) guardados en ${zipFileName}`;
  }

  // Recopila datos de rutas elegidas, waypoints y fotos para exportación a Google Earth 3D
  function collectExportData() {
    const selectedBoxes = Array.from(routeSelector.querySelectorAll('.route-export-box:checked'));
    const selectedIds = selectedBoxes.map(b => b.dataset.routeId);
    let selectedRoutes = nativeParser.routes.filter(r => selectedIds.includes(r.id));
    if (selectedRoutes.length === 0 && nativeParser.routes.length > 0) {
      selectedRoutes = nativeParser.routes;
    }
    const colorMap = nativeParser.getRouteColorMap();

    const routes = selectedRoutes.map(r => ({
      id: r.id,
      name: r.name,
      color: colorMap.get(r.id) || '#00f0ff',
      distanceKm: r.distanceKm,
      points: nativeParser.pointsByRoute.get(r.id) || []
    }));

    const waypoints = [
      ...(nativeParser.markers || []).map(m => ({ name: m.name || 'Marcador', lat: m.lat, lng: m.lng, desc: m.desc })),
      ...(nativeParser.favorites || []).map(f => ({ name: f.name || 'Favorito', lat: f.lat, lng: f.lng, desc: f.desc }))
    ];

    const photos = photoHandler.photos || [];

    let title = 'Expedición BiTaVi';
    if (routes.length === 1) title = routes[0].name;
    else if (routes.length > 1) title = `${routes.length} Rutas BiTaVi`;

    return { routes, waypoints, photos, title };
  }

  // Exporta rutas y waypoints a KML para Google Earth
  function saveSelectedKml() {
    const data = collectExportData();
    if (data.routes.length === 0 && data.waypoints.length === 0 && data.photos.length === 0) {
      alert('⚠️ No hay rutas, waypoints ni fotos cargadas para exportar a KML.');
      return;
    }
    const safeName = sanitizeFilename(data.title, 'expedicion_bitavi_3d');
    exportToKml(data, `${safeName}.kml`);
    cursorCoords.textContent = `🌍 Expedición exportada a ${safeName}.kml para Google Earth 3D`;
  }

  // Exporta rutas, waypoints y fotos incrustadas a KMZ para Google Earth 3D
  async function saveSelectedKmz() {
    const data = collectExportData();
    if (data.routes.length === 0 && data.waypoints.length === 0 && data.photos.length === 0) {
      alert('⚠️ No hay datos disponibles para empaquetar en KMZ.');
      return;
    }
    const safeName = sanitizeFilename(data.title, 'expedicion_bitavi_3d');
    cursorCoords.textContent = `🌐 Generando paquete KMZ para Google Earth 3D...`;
    try {
      await exportToKmz(data, `${safeName}.kmz`, (p) => {
        updateProgress(p.percent, p.phase, 'Empaquetando KMZ 3D...');
      });
      cursorCoords.textContent = `✅ Archivo KMZ 3D "${safeName}.kmz" generado con éxito.`;
    } catch (err) {
      console.error('[KMZ Error]', err);
      alert(`Error al generar KMZ: ${err.message}`);
    }
  }

  // Muestra la fecha de la(s) ruta(s) en el badge del mapa y en la telemetría
  function showRouteDate(routes) {
    const dates = (routes || [])
      .map(r => r.startDate || r.date)
      .filter(Boolean);
    if (dates.length === 0) {
      routeDateBadge.classList.add('hidden');
      statRouteDate.textContent = '--';
      return;
    }
    const main = dates[0];
    statRouteDate.textContent = main;
    routeDateText.textContent = dates.length === 1
      ? main
      : `${dates.length} rutas · ${main}`;
    routeDateBadge.classList.remove('hidden');
  }

  // Google Drive Connector
  const gdriveConnector = new GoogleDriveConnector(
    async (downloadedZipFile) => {
      closeGdriveModal();
      await handleFiles([downloadedZipFile]);
    },
    (status) => {
      gdriveStatusMsg.textContent = status;
      cursorCoords.textContent = status;
    }
  );

  // Initialize GDrive credentials from localStorage
  if (gdriveClientIdInput) {
    gdriveClientIdInput.value = gdriveConnector.clientId;
  }

  // Progress Overlay Elements
  const progressOverlay = document.getElementById('tactical-progress-overlay');
  const progressTitle = document.getElementById('progress-title');
  const progressFilename = document.getElementById('progress-filename');
  const progressStatusLabel = document.getElementById('progress-status-label');
  const progressPercentVal = document.getElementById('progress-percent-val');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const progressDetailText = document.getElementById('progress-detail-text');
  let progressHideTimeout = null;

   function showProgress(title, filename, percent = 0, status = 'Iniciando...', detail = '') {
     if (progressHideTimeout) {
       clearTimeout(progressHideTimeout);
       progressHideTimeout = null;
     }
     if (!progressOverlay) {
       const coords = document.getElementById('cursor-coords');
       if (coords) coords.textContent = `⏳ ${status} ${percent}%`;
       console.warn('[BiTaVi] showProgress: overlay no encontrado, fallback en cursor-coords');
       return;
     }
     progressTitle.textContent = title;
     progressFilename.textContent = filename;
     progressPercentVal.textContent = `${percent}%`;
     progressBarFill.style.width = `${percent}%`;
     progressStatusLabel.textContent = status;
     progressDetailText.textContent = detail || 'Transferencia segura y procesamiento local en RAM...';
     progressOverlay.classList.remove('hidden');
   }

   function updateProgress(percent, status, detail) {
     if (!progressOverlay) {
       const coords = document.getElementById('cursor-coords');
       if (coords) coords.textContent = `⏳ ${status || ''} ${percent !== undefined && percent !== null ? percent + '%' : ''}`;
       return;
     }
     if (percent !== undefined && percent !== null) {
       progressPercentVal.textContent = `${percent}%`;
       progressBarFill.style.width = `${percent}%`;
     }
     if (status) progressStatusLabel.textContent = status;
     if (detail) progressDetailText.textContent = detail;
   }

   function hideProgress(delay = 600) {
     if (!progressOverlay) return;
     if (progressHideTimeout) clearTimeout(progressHideTimeout);
     progressHideTimeout = setTimeout(() => {
       progressOverlay.classList.add('hidden');
       progressHideTimeout = null;
     }, delay);
   }

  // Google Drive Modal Handlers
  function openGdriveModal() {
    gdriveModal.classList.remove('hidden');
    gdriveStatusMsg.textContent = '';
  }

  function closeGdriveModal() {
    gdriveModal.classList.add('hidden');
  }

  if (btnOpenGdriveModal) btnOpenGdriveModal.addEventListener('click', openGdriveModal);
  if (gdriveModalClose) gdriveModalClose.addEventListener('click', closeGdriveModal);
  if (gdriveModalBackdrop) gdriveModalBackdrop.addEventListener('click', closeGdriveModal);

  if (btnSaveGdriveCreds) {
    btnSaveGdriveCreds.addEventListener('click', () => {
      const cid = gdriveClientIdInput.value.trim();
      if (!cid) {
        alert('Por favor ingresa un Client ID de Google Cloud Console.');
        return;
      }
      gdriveConnector.saveCredentials(cid);
      gdriveStatusMsg.textContent = '✅ Credenciales guardadas en tu navegador.';
    });
  }

  if (btnGdriveLogin) {
    btnGdriveLogin.addEventListener('click', async () => {
      try {
        gdriveStatusMsg.textContent = '🔑 Conectando con Google...';
        const files = await gdriveConnector.listBiTaViBackups();
        renderGdriveFilesList(files);
      } catch (err) {
        console.error(err);
        gdriveStatusMsg.textContent = `❌ Error: ${err.message || 'No se pudo conectar con Google Drive'}`;
      }
    });
  }

  function renderGdriveFilesList(files) {
    if (!files || files.length === 0) {
      gdriveStatusMsg.textContent = 'ℹ️ No se encontraron archivos .ZIP de backup en tu Drive.';
      gdriveFilesContainer.classList.add('hidden');
      return;
    }

    gdriveFilesContainer.classList.remove('hidden');
    gdriveFilesList.innerHTML = '';

    files.forEach(file => {
      const card = document.createElement('div');
      card.className = 'photo-card';
      const sizeMb = file.size ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : '';
      const modDate = file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : '';

      card.innerHTML = `
        <span style="font-size: 1.2rem;">📦</span>
        <div class="photo-meta" style="flex: 1;">
          <span class="photo-title">${file.name}</span>
          <span class="photo-coords">${sizeMb} &bull; ${modDate}</span>
        </div>
        <button class="tactical-btn-sm highlight-btn">DESCARGAR</button>
      `;

       card.addEventListener('click', async () => {
         try {
           closeGdriveModal();
           const fileSizeMb = file.size ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'Calculando...';
           console.log('[BiTaVi] Iniciando descarga GDrive:', file.name, 'ID:', file.id, 'Size:', file.size, 'SizeMb:', fileSizeMb);
           showProgress('DESCARGANDO DESDE GOOGLE DRIVE', file.name, 0, 'Iniciando descarga...', `Tamaño: ${fileSizeMb}`);
           await gdriveConnector.downloadZipFile(
             file.id, file.name,
             (prog) => {
               updateProgress(prog.percent, prog.phase, `Descargado: ${prog.loadedMb} MB ${prog.totalMb !== '--' ? `/ ${prog.totalMb} MB` : ''}`);
             },
             file.size || null
           );
         } catch (err) {
           hideProgress(0);
           console.error('[BiTaVi] Error descarga GDrive:', err);
           alert(`Error al descargar de Drive: ${err.message}`);
         }
       });

      gdriveFilesList.appendChild(card);
    });

    gdriveStatusMsg.textContent = `✅ ${files.length} archivo(s) de backup encontrados en tu cuenta.`;
  }

  // 3. Search Bar Integration (Búsqueda Híbrida Táctica: Expedición Local + OSM)
  let searchDebounce = null;
  let currentSearchResults = [];

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (query.length > 0) {
      btnSearchClear.classList.remove('hidden');
    } else {
      btnSearchClear.classList.add('hidden');
      searchResults.classList.add('hidden');
      currentSearchResults = [];
      return;
    }

    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(async () => {
      const results = await geoSearch.search(query);
      renderSearchResults(results);
    }, 200);
  });

  searchInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      if (currentSearchResults.length > 0) {
        selectSearchResult(currentSearchResults[0]);
      } else {
        const query = searchInput.value.trim();
        if (query.length >= 2) {
          const results = await geoSearch.search(query);
          const first = (results.local && results.local[0]) || (results.global && results.global[0]);
          if (first) selectSearchResult(first);
        }
      }
    } else if (e.key === 'Escape') {
      searchResults.classList.add('hidden');
    }
  });

  btnSearchClear.addEventListener('click', () => {
    searchInput.value = '';
    btnSearchClear.classList.add('hidden');
    searchResults.classList.add('hidden');
    searchResults.innerHTML = '';
    currentSearchResults = [];
  });

  function renderSearchResults({ local = [], global = [] }) {
    currentSearchResults = [...local, ...global];
    if (currentSearchResults.length === 0) {
      searchResults.classList.add('hidden');
      searchResults.innerHTML = '';
      return;
    }

    searchResults.innerHTML = '';

    // Resultados de la expedición activa (Offline)
    if (local.length > 0) {
      const localHeader = document.createElement('div');
      localHeader.className = 'search-category-header';
      localHeader.innerHTML = `<span>🛰️ EXPEDICIÓN ACTIVA</span><span>${local.length} hallazgo(s)</span>`;
      searchResults.appendChild(localHeader);

      local.forEach(item => {
        searchResults.appendChild(createSearchResultRow(item));
      });
    }

    // Resultados globales de cartografía mundial (OSM)
    if (global.length > 0) {
      const globalHeader = document.createElement('div');
      globalHeader.className = 'search-category-header';
      globalHeader.innerHTML = `<span>🌐 CARTOGRAFÍA MUNDIAL (OSM)</span><span>${global.length} resultado(s)</span>`;
      searchResults.appendChild(globalHeader);

      global.forEach(item => {
        searchResults.appendChild(createSearchResultRow(item));
      });
    }

    searchResults.classList.remove('hidden');
  }

  function createSearchResultRow(item) {
    const row = document.createElement('div');
    row.className = 'search-result-item';

    const badgeClass = item.type === 'route' ? 'badge-ruta' :
                       item.type === 'marker' ? 'badge-waypoint' :
                       item.type === 'favorite' ? 'badge-parada' :
                       item.type === 'photo' ? 'badge-foto' : 'badge-mapa';

    row.innerHTML = `
      <div class="search-item-info">
        <span class="search-result-name">
          <span>${item.icon || '📍'}</span>
          <span>${item.title}</span>
        </span>
        <span class="search-result-sub">${item.subtitle}</span>
      </div>
      <span class="search-badge ${badgeClass}">${item.badge || 'ITEM'}</span>
    `;

    row.addEventListener('click', () => {
      selectSearchResult(item);
    });

    return row;
  }

  function selectSearchResult(item) {
    searchResults.classList.add('hidden');

    if (item.category === 'local') {
      searchInput.value = item.title;

      if (item.type === 'route') {
        if (nativeParser.routeLayers && nativeParser.routeLayers.has(item.raw.id)) {
          const grp = nativeParser.routeLayers.get(item.raw.id);
          if (grp && grp.trackGroup) {
            try {
              mapInstance.fitBounds(grp.trackGroup.getBounds(), { padding: [50, 50], maxZoom: 16 });
            } catch (_) {}
          }
        } else if (item.lat !== null && item.lng !== null) {
          mapInstance.flyToCoordinates(item.lat, item.lng, 15);
        }
        cursorCoords.textContent = `🚩 Ruta enfocada: ${item.title}`;
      } else if (item.type === 'marker') {
        mapInstance.flyToCoordinates(item.lat, item.lng, 17);
        cursorCoords.textContent = `📍 Waypoint: ${item.title} (${item.lat.toFixed(5)}°, ${item.lng.toFixed(5)}°)`;
      } else if (item.type === 'favorite') {
        mapInstance.flyToCoordinates(item.lat, item.lng, 17);
        cursorCoords.textContent = `⭐ Parada: ${item.title} (${item.lat.toFixed(5)}°, ${item.lng.toFixed(5)}°)`;
      } else if (item.type === 'photo') {
        if (item.lat !== null && item.lng !== null && !isNaN(item.lat) && !isNaN(item.lng)) {
          mapInstance.flyToCoordinates(item.lat, item.lng, 17);
          cursorCoords.textContent = `📷 Foto: ${item.title} (${item.lat.toFixed(5)}°, ${item.lng.toFixed(5)}°)`;
        } else {
          cursorCoords.textContent = `📷 Foto sin GPS (abriendo en visor): ${item.title}`;
        }
        openPhotoModal(item.raw);
      }
    } else {
      searchInput.value = item.name || item.title;
      mapInstance.setManualLocation(item.lat, item.lng, item.displayName ? item.displayName.split(',')[0] : item.title, 14);
      cursorCoords.textContent = `🌐 Ubicación establecida en ${item.displayName || item.title}`;
    }
  }

  // Close search dropdown on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      searchResults.classList.add('hidden');
    }
  });

  // 4. GPS Auto Location Button
  btnLocate.addEventListener('click', () => {
    cursorCoords.textContent = '🛰️ Solicitando señal GPS al navegador...';
    mapInstance.locateUser(true);
  });

  // 5. Manual Location Pinning (Click on map)
  btnSetManual.addEventListener('click', () => {
    isManualLocationPickMode = !isManualLocationPickMode;
    if (isManualLocationPickMode) {
      btnSetManual.classList.add('highlight-btn');
      cursorCoords.textContent = '🎯 MODO SELECCIÓN: Haz clic en el mapa donde quieras fijar tu posición.';
    } else {
      btnSetManual.classList.remove('highlight-btn');
      cursorCoords.textContent = 'Modo selección desactivado.';
    }
  });

  mapInstance.map.on('click', (e) => {
    if (photoPlacementMode) {
      const { lat, lng } = e.latlng;
      photoHandler.assignPhotoLocation(photoPlacementMode, lat, lng);
      photoPlacementMode = null;
      cursorCoords.textContent = `📍 Foto ubicada en: Lat ${lat.toFixed(5)}°, Lng ${lng.toFixed(5)}°`;
      persistCurrentSession();
      refreshSearchIndex();
      return;
    }

    if (isManualLocationPickMode) {
      const { lat, lng } = e.latlng;
      mapInstance.setManualLocation(lat, lng, 'Ubicación seleccionada');
      isManualLocationPickMode = false;
      btnSetManual.classList.remove('highlight-btn');
      cursorCoords.textContent = `📍 Posición fijada en: Lat ${lat.toFixed(5)}°, Lng ${lng.toFixed(5)}°`;
    }
  });

  // 6. Sidebar Toggle
  btnToggleSidebar.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });

  // 7. Layer Selection (Open / Free Maps)
  layerCards.forEach(card => {
    card.addEventListener('click', () => {
      layerCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const layerKey = card.getAttribute('data-layer');
      mapInstance.setLayer(layerKey);
      if (photosRailVisible) drawConnectors();
    });
  });

  // 8. File Upload / Dropzone Handlers
  const folderLoader = new FolderBackupLoader();

  btnBrowseFiles.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  // Gestión y renderizado del Modal de Backups de Carpeta Conectada
  function openFolderBackupModal() {
    if (!folderBackupModal) return;
    folderBackupModal.classList.remove('hidden');
    if (folderBackupFilter) {
      folderBackupFilter.value = '';
      folderBackupFilter.focus();
    }
  }

  function closeFolderBackupModal() {
    if (!folderBackupModal) return;
    folderBackupModal.classList.add('hidden');
  }

  if (folderModalClose) folderModalClose.addEventListener('click', closeFolderBackupModal);
  if (folderModalBackdrop) folderModalBackdrop.addEventListener('click', closeFolderBackupModal);

  let currentFolderTabFilter = 'all';

  function updateFolderTabCounts(backups) {
    const total = backups.length;
    const zips = backups.filter(b => b.type === 'zip').length;
    const routes = backups.filter(b => b.type === 'gpx' || b.type === 'text' || b.type === 'geo').length;
    const photos = backups.filter(b => b.type === 'photo').length;

    const countAll = document.getElementById('count-tab-all');
    const countZip = document.getElementById('count-tab-zip');
    const countRoute = document.getElementById('count-tab-route');
    const countPhoto = document.getElementById('count-tab-photo');

    if (countAll) countAll.textContent = total;
    if (countZip) countZip.textContent = zips;
    if (countRoute) countRoute.textContent = routes;
    if (countPhoto) countPhoto.textContent = photos;

    const scanStats = document.getElementById('folder-modal-scan-stats');
    if (scanStats) {
      scanStats.textContent = zips > 0 
        ? `📦 ${zips} backup(s) ZIP detectado(s) • ${total} archivo(s)` 
        : `${total} archivo(s) indexado(s)`;
    }
  }

  function renderFolderBackups(backups, filterText = '') {
    if (!folderBackupsList) return;
    folderBackupsList.innerHTML = '';
    updateFolderTabCounts(backups);

    const query = filterText.toLowerCase().trim();
    const filtered = backups.filter(b => {
      // Filtro de pestaña
      if (currentFolderTabFilter === 'zip' && b.type !== 'zip') return false;
      if (currentFolderTabFilter === 'route' && b.type !== 'gpx' && b.type !== 'text' && b.type !== 'geo') return false;
      if (currentFolderTabFilter === 'photo' && b.type !== 'photo') return false;

      // Filtro de texto
      if (!query) return true;
      const searchTarget = `${b.name} ${b.relPath || ''} ${b.category || ''} ${b.dateFormatted || ''}`.toLowerCase();
      return searchTarget.includes(query);
    });

    if (filtered.length === 0) {
      if (folderEmptyMsg) {
        folderEmptyMsg.classList.remove('hidden');
        if (query) {
          folderEmptyMsg.innerHTML = `🔍 No hay archivos que coincidan con "<strong>${filterText}</strong>".`;
        } else if (currentFolderTabFilter !== 'all') {
          folderEmptyMsg.innerHTML = `ℹ️ No hay archivos en esta categoría. Prueba seleccionando la pestaña "Todos" o "Backups ZIP".`;
        } else {
          folderEmptyMsg.innerHTML = `
            ⚠️ No se encontraron archivos de backup reconocibles en esta carpeta.<br>
            <span style="font-size: 0.68rem; color: var(--text-dark); margin-top: 6px; display: block;">
              Los archivos del sistema y temporales han sido filtrados para evitar desorden.<br>
              Si tienes tu archivo de backup comprimido, puedes seleccionarlo directamente:
            </span>
            <button type="button" id="btn-empty-pick-zip" class="tactical-btn-sm highlight-btn" style="margin: 0.6rem auto 0 auto; display: block;">📂 Seleccionar Archivo .ZIP Manualmente</button>
          `;
          const btnEmpty = document.getElementById('btn-empty-pick-zip');
          if (btnEmpty) {
            btnEmpty.addEventListener('click', (ev) => {
              ev.stopPropagation();
              closeFolderBackupModal();
              fileInput.click();
            });
          }
        }
      }
      return;
    }

    if (folderEmptyMsg) folderEmptyMsg.classList.add('hidden');

    filtered.forEach(backup => {
      const card = document.createElement('div');
      card.className = 'photo-card';
      card.style.cursor = 'pointer';

      const icon = backup.icon || (backup.type === 'folder' ? '📁' : (backup.type === 'gpx' ? '🗺️' : '📦'));
      const subtitle = backup.relPath && backup.relPath !== backup.name ? backup.relPath : backup.category || 'Archivo';

      card.innerHTML = `
        <span style="font-size: 1.3rem;">${icon}</span>
        <div class="photo-meta" style="flex: 1; overflow: hidden;">
          <span class="photo-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${backup.relPath || backup.name}">${backup.name}</span>
          <span class="photo-coords">${backup.sizeFormatted} &bull; ${backup.dateFormatted} &bull; <span style="color: var(--accent-cyan); font-weight: 600;">${subtitle}</span></span>
        </div>
        <button class="tactical-btn-sm highlight-btn" style="flex-shrink: 0;">CARGAR</button>
      `;

      card.addEventListener('click', async () => {
        try {
          closeFolderBackupModal();
          showProgress('CARGANDO EXPEDICIÓN', backup.name, 15, 'Extrayendo archivo seleccionado...', `Tamaño: ${backup.sizeFormatted}`);
          const payloadFiles = await folderLoader.getBackupPayload(backup);
          if (payloadFiles && payloadFiles.length > 0) {
            await handleFiles(payloadFiles);
          } else {
            hideProgress(0);
            alert('No se pudieron leer los archivos del elemento seleccionado.');
          }
        } catch (err) {
          hideProgress(0);
          console.error('[BiTaVi] Error al cargar archivo de carpeta:', err);
          alert(`Error al cargar: ${err.message}`);
        }
      });

      folderBackupsList.appendChild(card);
    });
  }

  // Pestañas de filtrado en el modal
  document.querySelectorAll('.folder-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.folder-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFolderTabFilter = btn.dataset.filter || 'all';
      renderFolderBackups(folderLoader.cachedBackups, folderBackupFilter ? folderBackupFilter.value : '');
    });
  });

  // Botón "Cargar Carpeta Completa"
  const btnFolderLoadAll = document.getElementById('btn-folder-load-all');
  if (btnFolderLoadAll) {
    btnFolderLoadAll.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!folderLoader.fallbackFiles || folderLoader.fallbackFiles.length === 0) {
        alert('No hay archivos detectados en la carpeta para cargar.');
        return;
      }
      closeFolderBackupModal();
      showProgress('CARGANDO CARPETA COMPLETA', folderLoader.connectedFolderName, 25, `Procesando ${folderLoader.fallbackFiles.length} archivos...`, 'Telemetría y rutas en curso');
      await handleFiles(folderLoader.fallbackFiles);
    });
  }

  // Filtrado reactivo en el modal de backups de carpeta
  if (folderBackupFilter) {
    folderBackupFilter.addEventListener('input', (e) => {
      renderFolderBackups(folderLoader.cachedBackups, e.target.value);
    });
  }

  // Actualizar barra de estado de carpeta conectada en el panel
  function updateConnectedFolderBar(folderName, backups) {
    if (!connectedFolderBar) return;
    connectedFolderBar.classList.remove('hidden');
    const total = Array.isArray(backups) ? backups.length : (typeof backups === 'number' ? backups : 0);
    const zips = Array.isArray(backups) ? backups.filter(b => b.type === 'zip').length : 0;
    if (connectedFolderLabel) connectedFolderLabel.textContent = folderName;
    if (connectedFolderStats) {
      connectedFolderStats.textContent = zips > 0 
        ? `${zips} backup(s) ZIP detectados (${total} total)` 
        : `${total} archivo(s) disponible(s)`;
    }
    if (folderModalDirName) folderModalDirName.textContent = folderName;
  }

  // Botón "Seleccionar .ZIP Directo" dentro del modal
  const btnModalPickDirectZip = document.getElementById('btn-modal-pick-direct-zip');
  if (btnModalPickDirectZip) {
    btnModalPickDirectZip.addEventListener('click', (e) => {
      e.stopPropagation();
      closeFolderBackupModal();
      fileInput.click();
    });
  }

  // Botón "Ver Backups" en el panel
  if (btnShowFolderBackups) {
    btnShowFolderBackups.addEventListener('click', (e) => {
      e.stopPropagation();
      if (folderLoader.cachedBackups.length > 0) {
        renderFolderBackups(folderLoader.cachedBackups);
        openFolderBackupModal();
      } else {
        btnBrowseFolder?.click();
      }
    });
  }

  // Botón "Cambiar Carpeta" dentro del modal
  if (btnFolderChangeDir) {
    btnFolderChangeDir.addEventListener('click', async (e) => {
      e.stopPropagation();
      closeFolderBackupModal();
      btnBrowseFolder?.click();
    });
  }

  if (btnBrowseFolder) {
    btnBrowseFolder.addEventListener('click', async (e) => {
      e.stopPropagation();
      showProgress('CONECTANDO CARPETA DE EXPEDICIÓN', 'Esperando selección...', 10, 'Selecciona la carpeta donde guardas tus backups de Android...', 'Acceso directo a disco');
      try {
        const result = await folderLoader.connectDirectory((p) => {
          updateProgress(35, p.phase, p.detail);
        });

        hideProgress(0);

        if (!result) {
          return;
        }

        updateConnectedFolderBar(result.folderName, result.backups);

        // Caso 1: La carpeta contiene directamente un viaje sin comprimir (rutas.txt y puntos.txt en la raíz)
        if (result.isSingleDirectBackup && result.directFiles && result.directFiles.length > 0) {
          showProgress('CARGANDO EXPEDICIÓN', result.folderName, 50, 'Interpretando archivos de viaje...', 'Rutas y waypoints detectados');
          await handleFiles(result.directFiles);
          return;
        }

        // Caso 2: Se encontraron uno o más backups (archivos .ZIP / .GPX / subcarpetas)
        if (result.backups.length > 0) {
          renderFolderBackups(result.backups);
          openFolderBackupModal();
        } else {
          // Caso 3: Carpeta vacía o sin backups reconocibles
          renderFolderBackups([]);
          openFolderBackupModal();
        }
      } catch (err) {
        hideProgress(0);
        console.error('[BiTaVi] Error al conectar carpeta de expedición:', err);
        alert(`Error al conectar con la carpeta: ${err.message}`);
      }
    });
  }

  if (btnLoadSampleZip) {
    btnLoadSampleZip.addEventListener('click', async (e) => {
      e.stopPropagation();
      await loadDemoBackupZip();
    });
  }

  dropzone.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    e.target.value = '';
  });

  // Global window drop prevention so dragging files outside dropzone doesn't open the file in the browser tab
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    window.addEventListener(eventName, (e) => {
      e.preventDefault();
    });
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer) {
      const photoId = e.dataTransfer.getData('application/x-bitavi-photo');
      if (photoId) {
        const containerPoint = mapInstance.map.mouseEventToContainerPoint(e);
        const latLng = mapInstance.map.containerPointToLatLng(containerPoint);
        photoHandler.assignPhotoLocation(photoId, latLng.lat, latLng.lng);
        cursorCoords.textContent = `📍 Foto ubicada en: Lat ${latLng.lat.toFixed(5)}°, Lng ${latLng.lng.toFixed(5)}°`;
        return;
      }
    }
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
  });

   // Main file processing router
   async function handleFiles(files) {
     if (!files || files.length === 0) {
       console.warn('[BiTaVi] handleFiles recibió files vacío o inválido:', files);
       return;
     }

     console.log('[BiTaVi] handleFiles recibió', files.length, 'archivo(s)');

     const zipFiles = [];
     const imageFiles = [];
     const gpxFiles = [];
     const textFiles = [];

     for (const file of files) {
       console.log('[BiTaVi] Archivo:', file.name, 'type:', file.type, 'size:', file.size);
       const name = file.name.toLowerCase();
       if (name.endsWith('.zip')) {
         zipFiles.push(file);
       } else if (name.endsWith('.gpx')) {
         gpxFiles.push(file);
       } else if (name.endsWith('.txt') || name.endsWith('.csv') || name.endsWith('.json')) {
         textFiles.push(file);
       } else if (file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|gif|bmp)$/i.test(name)) {
         imageFiles.push(file);
       } else {
         console.warn('[BiTaVi] Formato no reconocido para:', file.name);
       }
     }

     if (zipFiles.length === 0 && textFiles.length === 0 && gpxFiles.length === 0 && imageFiles.length === 0) {
       console.warn('[BiTaVi] Ningún formato válido detectado');
       alert('Formato no reconocido. Por favor selecciona un archivo .ZIP de backup, .GPX, .TXT (rutas, puntos, marcadores, favoritos) o fotos JPG/PNG.');
       return;
     }

     // Process ZIP Backup Files (from Google Drive / Android App / Local PC)
     for (const zipFile of zipFiles) {
       console.log('[BiTaVi] Procesando ZIP:', zipFile.name, 'tamaño:', zipFile.size, 'bytes');
       cursorCoords.textContent = `📦 Descomprimiendo backup de viaje ${zipFile.name}...`;
       showProgress('DESCOMPRIMIENDO EXPEDICIÓN', zipFile.name, 10, 'Descomprimiendo archivos en memoria RAM...', 'Iniciando extracción segura...');

       try {
         if (zipFile.size > 500 * 1024 * 1024) {
           alert('⚠️ El archivo es muy grande (' + (zipFile.size / (1024 * 1024)).toFixed(1) + ' MB). Se puede demorar.');
         }

         const extracted = await zipHandler.processZipBackup(zipFile, (p) => {
           updateProgress(p.percent, p.phase, p.currentFile || 'Extrayendo...');
         });

         updateProgress(85, 'Interpretando telemetría y rutas de BiTaVi Android...', 'Parseando rutas.txt y puntos.txt...');

         // 1. Process Native BiTaVi Android Files (rutas.txt, puntos.txt, marcadores.txt, favoritos.txt)
         const textFilesMap = new Map();
         extracted.textFiles.forEach(tf => {
           const simpleName = tf.name.split('/').pop().toLowerCase();
           textFilesMap.set(simpleName, tf.content);
         });

         if (textFilesMap.has('rutas.txt') || textFilesMap.has('puntos.txt') || textFilesMap.has('marcadores.txt') || textFilesMap.has('favoritos.txt')) {
           const nativeStats = nativeParser.processNativeData(textFilesMap);
           currentRouteBounds = nativeParser.renderRoute('all');

            populateRouteSelector(nativeStats.routes);
            showRouteDate(nativeStats.routes);

            const totalDistKm = nativeStats.routes.reduce((acc, r) => acc + parseFloat(r.distanceKm || 0), 0).toFixed(2);
           statDistance.textContent = `${totalDistKm} km`;
           statPoints.textContent = nativeStats.totalPoints.toLocaleString();
           statElevation.textContent = `${nativeStats.routesCount} r / ${nativeStats.markersCount + nativeStats.favoritesCount} m`;
           routeActions.classList.remove('hidden');
         } 
         else if (extracted.gpxText) {
           const parsed = gpxHandler.parseGpxText(extracted.gpxText);
           currentRouteBounds = gpxHandler.renderTrack(parsed);

           statDistance.textContent = `${parsed.totalDistanceKm} km`;
           statPoints.textContent = parsed.pointsCount;
           if (parsed.minElevation !== null && parsed.maxElevation !== null) {
             statElevation.textContent = `${parsed.minElevation} / ${parsed.maxElevation} m`;
           } else {
             statElevation.textContent = `N/D`;
           }
           routeActions.classList.remove('hidden');
         }

         if (extracted.imageFiles.length > 0) {
           updateProgress(92, `Extrayendo ubicación GPS de ${extracted.imageFiles.length} fotografías...`, 'Analizando metadatos EXIF...');
           const allRoutePoints = Array.from(nativeParser.pointsByRoute.values()).flat();
           const photoGeoMap = nativeParser.getPhotoGeoMap ? nativeParser.getPhotoGeoMap() : null;
           const result = await photoHandler.processPhotoFiles(extracted.imageFiles, allRoutePoints, photoGeoMap);
           updatePhotosGallery(result.allPhotos);
           statPhotosCount.textContent = result.allPhotos.length;
         }

         renderZipAnalysis(extracted);

         updateProgress(100, '✅ ¡Carga de expedición completada con éxito!', `${extracted.structureAnalysis.totalEntries} elementos posicionados`);
         cursorCoords.textContent = `✅ Backup Android ${zipFile.name} cargado con éxito.`;
         hideProgress();
       } catch (err) {
         hideProgress(0);
         console.error('[BiTaVi] Error procesando ZIP:', err);
         alert(`Error al descomprimir el backup ZIP: ${err.message}`);
       }
      }

    // Process Individual Native Text Files (e.g. rutas.txt, puntos.txt, marcadores.txt, favoritos.txt)
    if (textFiles.length > 0) {
      showProgress('PROCESANDO ARCHIVOS NATIVOS', `${textFiles.length} archivo(s)`, 20, 'Leyendo datos...', 'Procesando telemetría...');
      try {
        const textFilesMap = new Map();
        for (let i = 0; i < textFiles.length; i++) {
          const tf = textFiles[i];
          const content = await tf.text();
          const simpleName = tf.name.split('/').pop().toLowerCase();
          textFilesMap.set(simpleName, content);
          updateProgress(20 + Math.round(((i + 1) / textFiles.length) * 45), `Leído ${tf.name}`, 'Parseando...');
        }

        if (textFilesMap.has('rutas.txt') || textFilesMap.has('puntos.txt') || textFilesMap.has('marcadores.txt') || textFilesMap.has('favoritos.txt')) {
          updateProgress(75, 'Interpretando telemetría de BiTaVi...', 'Calculando coordenadas...');
          const nativeStats = nativeParser.processNativeData(textFilesMap);
          currentRouteBounds = nativeParser.renderRoute('all');
          populateRouteSelector(nativeStats.routes);
          showRouteDate(nativeStats.routes);

          const totalDistKm = nativeStats.routes.reduce((acc, r) => acc + parseFloat(r.distanceKm || 0), 0).toFixed(2);
          statDistance.textContent = `${totalDistKm} km`;
          statPoints.textContent = nativeStats.totalPoints.toLocaleString();
          statElevation.textContent = `${nativeStats.routesCount} r / ${nativeStats.markersCount + nativeStats.favoritesCount} m`;
          routeActions.classList.remove('hidden');
          cursorCoords.textContent = `✅ Datos Android cargados (${nativeStats.routesCount} rutas, ${nativeStats.totalPoints} puntos, ${nativeStats.markersCount} marcadores, ${nativeStats.favoritesCount} favoritos).`;
        }

        if (imageFiles.length > 0) {
          updateProgress(90, `Geolocalizando ${imageFiles.length} fotografías...`, 'Analizando EXIF...');
          const allRoutePoints = Array.from(nativeParser.pointsByRoute.values()).flat();
          const photoGeoMap = nativeParser.getPhotoGeoMap ? nativeParser.getPhotoGeoMap() : null;
          const result = await photoHandler.processPhotoFiles(imageFiles, allRoutePoints, photoGeoMap);
          updatePhotosGallery(result.allPhotos);
          statPhotosCount.textContent = result.allPhotos.length;
        }

        updateProgress(100, '✅ ¡Carga completada con éxito!', `${textFiles.length} archivo(s) procesados`);
        hideProgress();
      } catch (err) {
        hideProgress(0);
        console.error(err);
        alert(`Error al procesar archivos de texto: ${err.message}`);
      }
    }

    // Process Individual GPX Files (Carga incremental sin sobrescribir rutas previas)
    if (gpxFiles.length > 0) {
      await addNewRoutesFromFiles(gpxFiles);
    }

    // Process Individual Photo Files (if not already processed with native text files)
    if (imageFiles.length > 0 && textFiles.length === 0 && zipFiles.length === 0) {
      const result = await photoHandler.processPhotoFiles(imageFiles);
      updatePhotosGallery(result.allPhotos);
      statPhotosCount.textContent = result.allPhotos.length;
    }

    // Refrescar el catálogo del buscador táctico local con todas las entidades cargadas
    refreshSearchIndex();

    // Persistir de forma segura en IndexedDB para restaurar tras F5 o reinicio
    await persistCurrentSession();
  }

  // Load Demo Backup ZIP (for quick testing)
  async function loadDemoBackupZip() {
    try {
      cursorCoords.textContent = `⚡ Cargando Backup ZIP de demostración...`;
      showProgress('CARGANDO DEMO BACKUP', 'backup_ejemplo_bitavi.zip', 0, 'Descargando paquete de demostración...', 'Conectando con almacenamiento local...');
      
      const response = await fetch('./sample-data/backup_ejemplo_bitavi.zip');
      if (!response.ok) {
        // If zip not generated yet, load gpx directly
        const gpxRes = await fetch('./sample-data/recorrido_tactico_ejemplo.gpx');
        const text = await gpxRes.text();
        const parsed = gpxHandler.parseGpxText(text);
        currentRouteBounds = gpxHandler.renderTrack(parsed);
        statDistance.textContent = `${parsed.totalDistanceKm} km`;
        statPoints.textContent = parsed.pointsCount;
        if (parsed.minElevation !== null && parsed.maxElevation !== null) {
          statElevation.textContent = `${parsed.minElevation} / ${parsed.maxElevation} m`;
        }
        let gpxDate = '--';
        if (parsed.points.length && parsed.points[0].time) {
          gpxDate = new Date(parsed.points[0].time).toLocaleString();
        }
        showRouteDate([{ startDate: gpxDate }]);
        routeActions.classList.remove('hidden');
        cursorCoords.textContent = `✅ Ruta de demostración cargada con éxito.`;
        refreshSearchIndex();
        await persistCurrentSession();
        hideProgress(400);
        return;
      }
      
      const blob = await response.blob();
      const file = new File([blob], 'backup_ejemplo_bitavi.zip', { type: 'application/zip' });
      await handleFiles([file]);
    } catch (err) {
      hideProgress(0);
      console.warn('Error cargando demo:', err);
    }
  }

  // Update Photos Gallery List in Sidebar
  function updatePhotosGallery(photos) {
    if (!photos || photos.length === 0) {
      photosContainer.classList.remove('hidden');
      photosList.classList.add('hidden');
      photosList.innerHTML = '';
      btnShareCard.classList.add('hidden');
      if (btnExportKmzPhotos) btnExportKmzPhotos.classList.add('hidden');
      if (photosRailVisible) { photoHandler.hidePhotoMarkers(); nativeParser.hideDataMarkers(); buildPhotoRail(); drawConnectors(); }
      return;
    }

    photosContainer.classList.add('hidden');
    photosList.classList.remove('hidden');
    photosList.innerHTML = '';

    const hasGeo = photos.some(p => p.lat !== null && p.lng !== null && !isNaN(p.lat) && !isNaN(p.lng));
    if (hasGeo) {
      btnShareCard.classList.remove('hidden');
      if (btnExportKmzPhotos) btnExportKmzPhotos.classList.remove('hidden');
    } else {
      btnShareCard.classList.add('hidden');
      if (btnExportKmzPhotos) btnExportKmzPhotos.classList.add('hidden');
    }

    photos.forEach(photo => {
      const card = document.createElement('div');
      card.className = 'photo-card';
      const coordsText = (photo.lat !== null && photo.lng !== null && !isNaN(photo.lat) && !isNaN(photo.lng))
        ? `${photo.lat.toFixed(5)}°, ${photo.lng.toFixed(5)}°`
        : '📍 Sin GPS directo';

      card.innerHTML = `
        <img src="${photo.url}" alt="${photo.name}" class="photo-thumbnail" draggable="false" />
        <div class="photo-meta">
          <span class="photo-title">${photo.name}</span>
          <span class="photo-coords">${coordsText}</span>
          <span class="photo-time">${photo.date}</span>
        </div>
      `;

      // Clic: abrir la foto a tamaño completo (vista ampliada)
      card.addEventListener('click', () => {
        openPhotoModal(photo);
      });

      // Arrastrar la tarjeta al mapa para geolocalizarla manualmente
      card.draggable = true;
      card.addEventListener('dragstart', (ev) => {
        ev.dataTransfer.setData('application/x-bitavi-photo', photo.id);
        ev.dataTransfer.effectAllowed = 'move';
        cursorCoords.textContent = '📤 Suelta la foto sobre el mapa para ubicarla...';
      });

      photosList.appendChild(card);
    });

    if (photosRailVisible) {
      photoHandler.hidePhotoMarkers();
      nativeParser.hideDataMarkers();
      buildPhotoRail();
      requestAnimationFrame(drawConnectors);
    }
  }

  // Fit and Clear Route buttons
  btnFitRoute.addEventListener('click', () => {
    const visibleBounds = (nativeParser.routeLayers && nativeParser.routeLayers.size > 0)
      ? nativeParser.getVisibleRoutesBounds()
      : null;
    if (visibleBounds) {
      mapInstance.fitBounds(visibleBounds);
    } else if (currentRouteBounds && currentRouteBounds.isValid()) {
      mapInstance.fitBounds(currentRouteBounds);
    }
  });

  // Acciones de Gestión de Rutas (Agregar rutas y Guardar elegidas)
  if (btnAddRoute) {
    btnAddRoute.addEventListener('click', () => {
      if (routeFileAddInput) routeFileAddInput.click();
    });
  }
  if (btnAddRouteAction) {
    btnAddRouteAction.addEventListener('click', () => {
      if (routeFileAddInput) routeFileAddInput.click();
    });
  }
  if (routeFileAddInput) {
    routeFileAddInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files.length > 0) {
        await addNewRoutesFromFiles(e.target.files);
        routeFileAddInput.value = '';
      }
    });
  }
  if (btnSaveCombinedRoute) {
    btnSaveCombinedRoute.addEventListener('click', saveCombinedRoute);
  }
  if (btnSaveByDay) {
    btnSaveByDay.addEventListener('click', saveRoutesGroupedByDay);
  }
  if (btnSaveSelectedZip) {
    btnSaveSelectedZip.addEventListener('click', saveSelectedRoutesZip);
  }
  if (chkGroupByDay) {
    chkGroupByDay.addEventListener('change', () => {
      populateRouteSelector(nativeParser.routes);
    });
  }
  if (btnSaveSelectedKml) {
    btnSaveSelectedKml.addEventListener('click', saveSelectedKml);
  }
  if (btnSaveSelectedKmz) {
    btnSaveSelectedKmz.addEventListener('click', saveSelectedKmz);
  }

  // --- Persistencia y Restauración de Sesión con IndexedDB (v0.4.8-alpha) ---
  async function persistCurrentSession() {
    try {
      const hasNative = nativeParser.routes.length > 0 || nativeParser.markers.length > 0 || nativeParser.favorites.length > 0;
      const hasGpx = gpxHandler.currentTrack !== null;
      const hasPhotos = photoHandler.photos.length > 0;

      if (!hasNative && !hasGpx && !hasPhotos) return;

      // Serializar puntos por ruta
      const pointsObj = {};
      if (nativeParser.pointsByRoute) {
        nativeParser.pointsByRoute.forEach((pts, rId) => {
          pointsObj[rId] = pts;
        });
      }

      const totalDist = statDistance.textContent.replace(' km', '').trim();
      let title = 'Expedición';
      if (nativeParser.routes.length === 1) {
        title = nativeParser.routes[0].name || 'Ruta 1';
      } else if (nativeParser.routes.length > 1) {
        title = `${nativeParser.routes.length} Rutas (${nativeParser.routes[0].name || 'Ruta'})`;
      } else if (hasGpx) {
        title = 'Ruta GPX';
      } else if (hasPhotos) {
        title = `${photoHandler.photos.length} Fotos Geolocalizadas`;
      }

      const sessionData = {
        title,
        sourceType: hasNative ? 'native' : (hasGpx ? 'gpx' : 'photos'),
        routes: nativeParser.routes,
        pointsByRoute: pointsObj,
        markers: nativeParser.markers,
        favorites: nativeParser.favorites,
        routesCount: nativeParser.routes.length,
        totalPoints: parseInt((statPoints.textContent || '0').replace(/,/g, ''), 10) || 0,
        markersCount: nativeParser.markers.length,
        favoritesCount: nativeParser.favorites.length,
        distanceKm: totalDist,
        routeDate: routeDateText && routeDateText.textContent !== '--' ? routeDateText.textContent : null,
        photosMeta: photoHandler.photos.map(p => ({
          id: p.id,
          name: p.name,
          size: p.size,
          hasGps: p.hasGps,
          lat: p.lat,
          lng: p.lng,
          alt: p.alt,
          date: p.date,
          ts: p.ts,
          camera: p.camera
        }))
      };

      // Si las fotos tienen blob directo o se pueden obtener por URL
      const photoBlobs = [];
      for (const p of photoHandler.photos) {
        if (p.blob) {
          photoBlobs.push({ id: p.id, name: p.name, blob: p.blob });
        } else if (p.url && !p.url.startsWith('blob:')) {
          try {
            const res = await fetch(p.url);
            const b = await res.blob();
            photoBlobs.push({ id: p.id, name: p.name, blob: b });
          } catch (fetchErr) {
            console.warn('[BiTaVi] No se pudo obtener blob para foto:', p.name);
          }
        }
      }

      await storage.saveSession(sessionData, photoBlobs);
      console.log('[BiTaVi] Sesión persistida con éxito en IndexedDB.');
    } catch (err) {
      console.warn('[BiTaVi] Error en auto-guardado de sesión:', err);
    }
  }

  async function restoreSavedSession() {
    try {
      cursorCoords.textContent = '⏳ Restaurando expedición previa desde almacenamiento local...';
      const fullSession = await storage.loadFullSession();
      if (!fullSession) {
        alert('No se pudo recuperar la sesión previa.');
        if (sessionRestoreBanner) sessionRestoreBanner.classList.add('hidden');
        return;
      }

      // 1. Restaurar rutas nativas
      if (fullSession.routes && fullSession.routes.length > 0) {
        const stats = nativeParser.restoreData({
          routes: fullSession.routes,
          pointsByRoute: fullSession.pointsByRoute,
          markers: fullSession.markers,
          favorites: fullSession.favorites
        });

        currentRouteBounds = nativeParser.renderRoute('all');
        populateRouteSelector(stats.routes);
        showRouteDate(stats.routes);

        const totalDistKm = stats.routes.reduce((acc, r) => acc + parseFloat(r.distanceKm || 0), 0).toFixed(2);
        statDistance.textContent = `${totalDistKm} km`;
        statPoints.textContent = stats.totalPoints.toLocaleString();
        statElevation.textContent = `${stats.routesCount} r / ${stats.markersCount + stats.favoritesCount} m`;
        routeActions.classList.remove('hidden');

        if (currentRouteBounds && currentRouteBounds.isValid()) {
          mapInstance.fitBounds(currentRouteBounds);
        }
      } else if ((fullSession.markers && fullSession.markers.length > 0) || (fullSession.favorites && fullSession.favorites.length > 0)) {
        nativeParser.restoreData({
          routes: [],
          pointsByRoute: {},
          markers: fullSession.markers || [],
          favorites: fullSession.favorites || []
        });
        routeActions.classList.remove('hidden');
      }

      // 2. Restaurar fotos
      if (fullSession.photos && fullSession.photos.length > 0) {
        photoHandler.restorePhotos(fullSession.photos);
        updatePhotosGallery(photoHandler.photos);
        const geoCount = photoHandler.photos.filter(p => p.lat !== null && p.lng !== null && !isNaN(p.lat) && !isNaN(p.lng)).length;
        statPhotosCount.textContent = geoCount;

        if (!currentRouteBounds || !currentRouteBounds.isValid()) {
          const geoPhotos = photoHandler.photos.filter(p => p.hasGps && p.lat && p.lng);
          if (geoPhotos.length > 0) {
            const b = L.latLngBounds(geoPhotos.map(p => [p.lat, p.lng]));
            if (b.isValid()) mapInstance.fitBounds(b);
          }
        }
      }

      // 3. Reindexar catálogo del buscador táctico local
      refreshSearchIndex();

      // 4. Ocultar banner y reportar en coordenadas
      if (sessionRestoreBanner) sessionRestoreBanner.classList.add('hidden');
      cursorCoords.textContent = `✅ Expedición restaurada: ${fullSession.title || 'Sesión'} (${fullSession.distanceKm || '0'} km).`;
    } catch (err) {
      console.error('[BiTaVi] Error restaurando sesión:', err);
      cursorCoords.textContent = `⚠️ Error al restaurar sesión previa: ${err.message}`;
    }
  }

  // Comprobar proactivamente si existe una sesión previa al cargar
  if (sessionRestoreBanner && storage) {
    storage.getSavedSessionSummary().then(summary => {
      if (summary && (summary.routesCount > 0 || summary.photosCount > 0 || summary.totalPoints > 0 || summary.markersCount > 0)) {
        const dateText = summary.routeDate || (summary.savedAt ? new Date(summary.savedAt).toLocaleDateString() : 'Reciente');
        const details = `${summary.title} · ${summary.distanceKm} km · ${summary.routesCount} rutas · ${summary.photosCount} fotos · [${dateText}]`;
        if (sessionBannerText) sessionBannerText.textContent = details;
        sessionRestoreBanner.classList.remove('hidden');
      }
    }).catch(err => {
      console.warn('[BiTaVi] Error consultando resumen de sesión previa:', err);
    });

    if (btnRestoreSession) {
      btnRestoreSession.addEventListener('click', () => {
        restoreSavedSession();
      });
    }

    if (btnDiscardSession) {
      btnDiscardSession.addEventListener('click', async () => {
        await storage.clearSession();
        sessionRestoreBanner.classList.add('hidden');
        cursorCoords.textContent = '🗑️ Expedición anterior descartada de la memoria local.';
      });
    }
  }

  btnClearRoute.addEventListener('click', async () => {
    gpxHandler.clearTrack();
    photoHandler.clearPhotos();
    nativeParser.clearAll();
    geoSearch.clearLocalIndex();
    currentRouteBounds = null;
    statDistance.textContent = '0.00 km';
    statPoints.textContent = '0';
    statElevation.textContent = '0 / 0';
    statPhotosCount.textContent = '0';
    showRouteDate([]);
    routeSelectWrapper.classList.add('hidden');
    routeActions.classList.add('hidden');
    updatePhotosGallery([]);
    fileInput.value = '';
    await storage.clearSession();
    if (sessionRestoreBanner) sessionRestoreBanner.classList.add('hidden');
  });

  // Generar y compartir la "Tarjeta Táctica" con fotos + posiciones en el mapa
  btnShareCard.addEventListener('click', () => {
    const geoPhotos = photoHandler.photos.filter(p =>
      p.lat !== null && p.lng !== null && !isNaN(p.lat) && !isNaN(p.lng)
    );
    if (geoPhotos.length === 0) {
      alert('No hay fotos geolocalizadas para compartir. Carga un backup que incluya fotos con GPS o paradas/favoritos con ubicación.');
      return;
    }
    const routeGroups = nativeParser.pointsByRoute ? Array.from(nativeParser.pointsByRoute.values()) : [];
    let title = 'Bitácora Táctica de Viaje';
    if (nativeParser.routes && nativeParser.routes.length === 1) {
      title = nativeParser.routes[0].name || title;
    } else if (nativeParser.routes && nativeParser.routes.length > 1) {
      title = `${nativeParser.routes.length} Rutas Registradas`;
    }
    const subtitle = geoPhotos[0] && geoPhotos[0].date ? geoPhotos[0].date : '';
    shareCard.open({ photos: geoPhotos, routeGroups, title, subtitle });
  });

  if (btnExportKmzPhotos) {
    btnExportKmzPhotos.addEventListener('click', async () => {
      const geoPhotos = photoHandler.photos.filter(p =>
        p.lat !== null && p.lng !== null && !isNaN(p.lat) && !isNaN(p.lng)
      );
      if (geoPhotos.length === 0) {
        alert('No hay fotos geolocalizadas para exportar.');
        return;
      }
      cursorCoords.textContent = `🌐 Exportando ${geoPhotos.length} fotos a KMZ 3D...`;
      try {
        await exportToKmz(
          {
            routes: [],
            waypoints: [],
            photos: geoPhotos,
            title: `Fotografías de Campaña (${geoPhotos.length})`
          },
          'fotos_bitavi_3d.kmz',
          (p) => updateProgress(p.percent, p.phase, 'Generando KMZ de fotos...')
        );
        cursorCoords.textContent = `✅ ${geoPhotos.length} fotos exportadas con éxito a fotos_bitavi_3d.kmz`;
      } catch (err) {
        console.error('[KMZ Photos Error]', err);
        alert(`Error al generar KMZ de fotos: ${err.message}`);
      }
    });
  }

  btnTogglePhotos.addEventListener('click', () => {
    togglePhotosRail();
    btnTogglePhotos.classList.toggle('active', photosRailVisible);
  });

  // Modal Lightbox Logic
  function openPhotoModal(photo) {
    activeModalPhoto = photo;
    modalImg.src = photo.url;
    modalPhotoName.textContent = photo.name;
    modalPhotoDate.textContent = photo.date;

    if (photo.lat !== null && photo.lng !== null && !isNaN(photo.lat) && !isNaN(photo.lng)) {
      modalJumpBtn.classList.remove('hidden');
      modalSetLocationBtn.textContent = '📍 Reubicar en el mapa';
      modalSetLocationBtn.title = 'Mover o corregir la posición de esta foto en el mapa';
      modalSetLocationBtn.classList.remove('hidden');
    } else {
      modalJumpBtn.classList.add('hidden');
      modalSetLocationBtn.textContent = '📍 Fijar en el mapa';
      modalSetLocationBtn.title = 'Ubicar esta foto sin coordenadas en el mapa';
      modalSetLocationBtn.classList.remove('hidden');
    }

    photoModal.classList.remove('hidden');
  }

  function closePhotoModal() {
    photoModal.classList.add('hidden');
    modalImg.src = '';
    activeModalPhoto = null;
  }

  modalClose.addEventListener('click', closePhotoModal);
  modalBackdrop.addEventListener('click', closePhotoModal);

  // "Fijar en el mapa": entrar en modo colocación de la foto actual
  if (modalSetLocationBtn) {
    modalSetLocationBtn.addEventListener('click', () => {
      const pid = activeModalPhoto ? activeModalPhoto.id : null;
      closePhotoModal();
      if (!pid) return;
      photoPlacementMode = pid;
      cursorCoords.textContent = '📍 Haz clic en el mapa para ubicar la foto seleccionada.';
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (photoPlacementMode) {
        photoPlacementMode = null;
        cursorCoords.textContent = '📍 Ubicación de foto cancelada.';
      }
      closePhotoModal();
    }
  });

  const btnCopyZipReport = document.getElementById('btn-copy-zip-report');
  const btnDownloadZipReport = document.getElementById('btn-download-zip-report');
  let lastExtractedZipData = null;

  // Render ZIP Structure & Forensics Analysis
  function renderZipAnalysis(extracted) {
    if (!extracted || !extracted.structureAnalysis) {
      zipAnalysisEmpty.classList.remove('hidden');
      zipAnalysisContent.classList.add('hidden');
      lastExtractedZipData = null;
      return;
    }

    lastExtractedZipData = extracted;
    zipAnalysisEmpty.classList.add('hidden');
    zipAnalysisContent.classList.remove('hidden');

    zipInfoName.textContent = extracted.zipName;
    zipInfoSize.textContent = `${extracted.fileSizeMb} MB`;

    const { structureAnalysis, metadata } = extracted;
    zipStatTotal.textContent = structureAnalysis.totalEntries;
    zipStatGpx.textContent = structureAnalysis.gpxCount;
    zipStatPhotos.textContent = structureAnalysis.photoCount;
    zipStatConfigs.textContent = structureAnalysis.configFilesCount;

    // Show metadata JSON if found
    if (metadata) {
      zipMetadataBox.classList.remove('hidden');
      zipMetaJson.textContent = JSON.stringify(metadata, null, 2);
    } else {
      zipMetadataBox.classList.add('hidden');
    }

    // Render tree of files inside ZIP
    zipFilesTree.innerHTML = '';
    structureAnalysis.files.forEach(file => {
      const row = document.createElement('div');
      row.className = 'zip-file-row';
      row.innerHTML = `
        <span class="zip-file-name" title="${file.path}">📄 ${file.path}</span>
        <span class="zip-file-cat">[${file.category}]</span>
        <span class="zip-file-size">${file.sizeFormatted}</span>
      `;
      zipFilesTree.appendChild(row);
    });
  }

  // Copy Report to Clipboard
  if (btnCopyZipReport) {
    btnCopyZipReport.addEventListener('click', async () => {
      if (!lastExtractedZipData) return;
      const report = {
        archivoZip: lastExtractedZipData.zipName,
        tamanioMb: lastExtractedZipData.fileSizeMb,
        resumen: lastExtractedZipData.structureAnalysis,
        metadatosAndroid: lastExtractedZipData.metadata,
        archivosTexto: lastExtractedZipData.textFiles.map(t => ({ nombre: t.name, preview: t.content.slice(0, 500) })),
        fotosCantidad: lastExtractedZipData.imageFiles.length,
        gpxDetectado: lastExtractedZipData.gpxFileName
      };

      const text = JSON.stringify(report, null, 2);
      try {
        await navigator.clipboard.writeText(text);
        btnCopyZipReport.textContent = '✅ ¡Copiado!';
        cursorCoords.textContent = '📋 Diagnóstico copiado al portapapeles. Pégalo en el chat con Ctrl+V.';
        setTimeout(() => {
          btnCopyZipReport.textContent = '📋 Copiar Reporte';
        }, 2500);
      } catch (err) {
        // Fallback prompt
        prompt('Copia el siguiente texto para el asistente:', text);
      }
    });
  }

  // Download Report JSON
  if (btnDownloadZipReport) {
    btnDownloadZipReport.addEventListener('click', () => {
      if (!lastExtractedZipData) return;
      const report = {
        archivoZip: lastExtractedZipData.zipName,
        tamanioMb: lastExtractedZipData.fileSizeMb,
        resumen: lastExtractedZipData.structureAnalysis,
        metadatosAndroid: lastExtractedZipData.metadata,
        archivosTexto: lastExtractedZipData.textFiles,
        fotosCantidad: lastExtractedZipData.imageFiles.length,
        gpxDetectado: lastExtractedZipData.gpxFileName
      };

      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analisis_${lastExtractedZipData.zipName.replace('.zip', '')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
});
