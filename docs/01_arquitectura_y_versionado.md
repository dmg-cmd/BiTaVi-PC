# BiTaVi PC - Arquitectura y Control de Versiones

## 1. Identificación del Sistema
- **Nombre del Proyecto**: BiTaVi (Bitácora Táctica de Viaje) - Visor para PC
- **Versión Actual**: `v1.1.4-alpha`
- **Plataforma**: Aplicación Web / Desktop para PC
- **Licencia**: Código Abierto / Uso Táctico Libre

---

## 2. Sistema y Regla Estricta de Versionado (`X.Y.Z`)
1. **Dígito Derecho (`Z`)**: Se incrementa `+1` con cada cambio o mejora. Cuenta del `0` al `10`.
2. **Dígito del Medio (`Y`)**: Al llegar el derecho a `10`, `Y` se incrementa `+1` y `Z` vuelve a `0`. Cuenta del `0` al `5`.
3. **Dígito Izquierdo (`X`)**: Al llegar el del medio a `5`, `X` se incrementa `+1` y los demás vuelven a `0` (ej. `1.0.0`).

---

## 3. Historial de Versiones (Changelog)

### `v1.1.4-alpha` (2026-10-22)
- **Barra de Menús Superior Táctica y Pestañas de Navegación Compacta en el Panel**:
  - **Barra de Menús Superior (`.top-menu-bar`)**: Menús desplegables en el encabezado (`📁 Archivo`, `🗺️ Ver`, `🌐 Capas`, `⚡ Táctica`) con acceso directo e instantáneo a todas las funciones sin necesidad de desplazarse por el panel lateral.
  - **Pestañas Superiores del Panel Lateral (`.sidebar-tabs`)**: Barra de pestañas horizontal compacta (`📋 Todo`, `🏁 Rutas`, `📷 Fotos`, `🗺️ Capas`, `📦 Cargar`, `🔍 Análisis`) que muestra exclusivamente la sección elegida, evitando el scroll vertical prolongado.
  - **Enfoque Reactivo Automático**: Al cargar rutas o fotos, el panel lateral conmuta automáticamente a la pestaña correspondiente en la parte superior.

### `v1.1.3-alpha` (2026-10-22)
- **Soporte Universal de Rutas, Puntos y Geodatos en Formato JSON / GeoJSON (`parseJsonData` y `parseGeoJson`)**:
  - Incorporación de motor universal de interpretación de archivos `.json` y `.geojson`. Admite GeoJSON estándar (`FeatureCollection`, `LineString`, `MultiLineString`, `Point`), backups unificados en JSON (`routes`, `rutas`, `points`, `puntos`, `waypoints`, `paradas`), arrays de coordenadas directas y archivos emparejados.
  - Reconocimiento tanto en la carga directa de archivos individuales como dentro de archivos `.ZIP` y carpetas conectadas.

### `v1.1.2-alpha` (2026-10-22)
- **Advertencia Diagnóstica Interactiva y Resistencia en Selección Parcial de Archivos de Telemetría**:
  - Detección proactiva si el usuario selecciona `rutas.txt` sin `puntos.txt`, explicando mediante notificación en pantalla la necesidad de cargar ambos o el `.ZIP` completo para renderizar los trazos en el mapa.

### `v1.1.1-alpha` (2026-10-22)
- **Corrección Crítica de Extracción EXIF GPS en Fotos y Soporte Recursivo de Carpetas Arrastradas**:
  - **Detección Directa de Coordenadas GPS en Fotografías (`photo-parser.js`)**: Se corrigió el error donde `exifr.parse(file, ['latitude', 'longitude'])` fallaba en calcular las coordenadas devolviendo `undefined` para todas las imágenes. Ahora se invoca `exifr.gps(file)` directamente, recuperando con 100% de precisión la latitud, longitud, altitud y cámara de las fotos tomadas con el celular (Google Pixel 9 Pro XL, Samsung, etc.).
  - **Geolocalización Automática de Fotos de Galería por Paradas / Favoritos (`favoritos.txt`)**: Las fotos importadas de la galería que no poseían EXIF directo por restricciones del sistema Android se asocian y posicionan en el mapa a través de las coordenadas del waypoint/parada registrado en `favoritos.txt`.
  - **Soporte Drag & Drop Recursivo de Carpetas Completas (`main.js`)**: Al arrastrar una carpeta de viaje al mapa o al dropzone (carpeta descomprimida de Android o backup), se procesa el árbol de directorios con `webkitGetAsEntry` / `createReader` recursivo para leer automáticamente `rutas.txt`, `puntos.txt`, fotos e imágenes.
  - **Scroll Automático hacia la Telemetría de Rutas**: Al cargar rutas desde cualquier origen, la interfaz enfoca automáticamente la sección `#section-route-stats` en el panel lateral.

### `v1.1.0-alpha` (2026-10-22)
- **Separación Real de Días en Rutas de Backups Android (`rutas.txt`), Fechas en Español y Extracción Masiva de GPX en ZIP**:
  - **Priorización de Fecha Real en el Nombre de Ruta (`extractRouteDateSlug` y `parseRoutes`)**: En los backups de BiTaVi Android (`rutas.txt`), el campo numérico `startTime` registra el instante en que la base de datos SQLite reimportó las rutas (compartiendo todas el mismo día), mientras que la fecha real de cada excursión se conserva en el nombre de la ruta (`Auto-Ruta 2026-06-13 12:55`, `16 abr 2026 10:12:33`, `5 jun 2026 23:42:48`, `2026-06-14 09:23 Lancha hasta La Becasina`). Ahora `extractRouteDateSlug` y `parseRoutes` priorizan la fecha explícita del nombre antes del `startTime` genérico, separando cada ruta en su día real.
  - **Reconocimiento de Meses en Español e Inglés (`extractDateFromName`)**: Soporte completo para fechas con nombres de meses abreviados o completos (`ene`, `feb`, `mar`, `abr`, `may`, `jun`, `jul`, `ago`, `sep`, `set`, `oct`, `nov`, `dic`, `16 de abril de 2026`, `5 jun. 2026`, etc.).
  - **Extracción de Múltiples Archivos `.GPX` en Paquetes `.ZIP` (`zip-worker.js`, `zip-loader.js` y `main.js`)**: Cuando un archivo `.ZIP` contiene múltiples rutas `.gpx` (o un `.gpx` contiene múltiples `<trk>`/`<rte>`), se extraen e incorporan todas en `BiTaViNativeParser` y se despliega el panel de Gestión y Selección de Rutas (`populateRouteSelector`).
  - **Carga Completa de Archivos de Telemetría en Carpeta Conectada (`folder-loader.js`)**: Al seleccionar `rutas.txt` o `puntos.txt` desde el modal de carpeta conectada o desde `[➕ Agregar Ruta]`, se vinculan automáticamente sus archivos hermanos para renderizar todas las rutas.
  - **Hito de Versión Media (`1.1.0-alpha`)**: Al alcanzar `1.0.10-alpha`, conforme a la regla `X.Y.Z`, el dígito medio incrementa a `1` y el derecho vuelve a `0`.

### `v1.0.10-alpha` (2026-10-22)
- **Corrección Crítica de Agrupación por Día y Extracción de Metadatos en GPX Masivos**:
  - **Corrección de Excepción en Renderizado (`ReferenceError: allDayVisible`)**: Solucionado el error en tiempo de ejecución en `populateRouteSelector` provocado por la variable `allDayVisible` no declarada en el ámbito de los grupos diarios. Ahora se calcula reactivamente con `dayRoutes.every(r => r.visible !== false)`, permitiendo que la lista se dibuje e interactúe sin bloqueos.
  - **Extracción de Tiempo en GPX (`parseGpxText`)**: Reconoce metadatos de tiempo `<metadata><time>`, marcas de tiempo a nivel de track `<trk><time>` y `<rte><time>`, y tiempo del primer punto registrado en el archivo GPX.
  - **Carga de Archivos Múltiples (`addNewRoutesFromFiles`)**: Al agregar múltiples archivos GPX o ZIP (como los 81 archivos del usuario), se extrae la fecha del XML interno, del nombre del archivo en disco (`extractDateFromName`) o de la fecha de última modificación física del archivo (`f.lastModified`), evitando que queden sin fecha.
  - **Integración en `extractRouteDateSlug` y `addRoute`**: Considera `route.fileName` y `route.lastModified` como fuentes confiables de fechado cronológico.
  - **Pruebas Automatizadas**: Nuevas pruebas unitarias para `parseGpxText` y resolución de días en lotes masivos de 81 rutas en `tests/gpx-tools.test.js` (30/30 pruebas unitarias exitosas).

### `v1.0.9-alpha` (2026-10-21)
- **Corrección y Robustecimiento Integral de Detección Cronológica y Agrupación por Días**:
  - **Función Universal `parseFlexibleTimestamp` (`src/components/bitavi-native-parser.js`)**: Interpreta con precisión timestamps en milisegundos, segundos Unix (10 dígitos), cadenas ISO y formatos con barras o guiones (`DD/MM/YYYY`, `YYYY-MM-DD`).
  - **Función de Reconocimiento de Patrones `extractDateFromName` (`src/components/gpx-parser.js`)**: Detecta automáticamente fechas en nombres de rutas, archivos y backups con formatos latinoamericanos (`DD/MM/YYYY`, `DD-MM-YYYY`), estándar (`YYYY-MM-DD`, `YYYY/MM/DD`) y compactos (`YYYYMMDD`, `DDMMYYYY`).
  - **Herencia Automática de Fechas entre Puntos y Rutas**: Si una ruta en `rutas.txt` carece de fecha o tiene valor nulo/0, el parser examina los puntos asociados en `puntos.txt` y le asigna el timestamp real del primer punto registrado.
  - **Eliminación del Fallback de Fecha de Hoy**: Si una ruta no posee fecha detectable, se clasifica limpiamente como `'Sin Fecha'` en lugar de asignarle la fecha actual, impidiendo que decenas de rutas terminen agrupadas artificialmente en un solo día.
  - **Pruebas Automatizadas**: 3 nuevas pruebas unitarias en `tests/gpx-tools.test.js` y `tests/native-parser.test.js` (28/28 pruebas unitarias exitosas).

### `v1.0.8-alpha` (2026-10-21)
- **Separación de Rutas por Día y Unión Táctica Diaria (`groupRoutesByDay`)**:
  - **Organización Visual por Día en la Lista de Rutas**: Las rutas se presentan ordenadas y agrupadas bajo encabezados cronológicos (`📅 YYYY-MM-DD`), con interruptor activo `[📅 Agrupar por Día]` para alternar entre vista agrupada y continua.
  - **Controles por Día**: Cada cabecera de día incluye casilla maestra para marcar o desmarcar todas las rutas de ese día, botón `[👁️]` para visibilidad por día y botón directo `[🔗 Unir Día]` para generar y descargar inmediatamente el GPX unificado de esa jornada en 1 clic.
  - **Botón `[📅 Unir por Día (.GPX / ZIP)]` en Barra de Exportación**: Procesa todas las rutas marcadas y genera un archivo `.gpx` unificado por cada día; si se abarcan múltiples días, empaqueta los GPX diarios en un archivo ZIP estructurado.
  - **Pruebas Automatizadas**: Nueva prueba unitaria para `groupRoutesByDay` en `tests/gpx-tools.test.js` (25/25 pruebas unitarias exitosas).

### `v1.0.7-alpha` (2026-10-21)
- **Unificación de Rutas en GPX Único y Empaquetado ZIP Nombrado por Fecha de Primera Ruta**:
  - **Botón `[🔗 Unir en Una Sola Ruta (.GPX)]`**: Unifica todas las rutas marcadas en un único archivo estándar GPX 1.1 multisegmento (`<trkseg>`) preservando la discontinuidad o continuidad de tramos (`src/components/gpx-parser.js` -> `createCombinedGpxXml`).
  - **Botón `[📦 ZIP Rutas Separadas]`**: Empaqueta cada ruta seleccionada de forma independiente en su propio archivo `.gpx` dentro de un `.ZIP` nombrado automáticamente con la fecha de la primera ruta (`rutas_YYYY-MM-DD.zip`).
  - **Extractor Táctico de Fechas (`extractRouteDateSlug`)**: Detección cronológica precisa a partir de `startTime`, `time`/`timestamp` de los puntos o metadatos de nombre.
  - **Suite de Pruebas**: 2 nuevas pruebas unitarias en `tests/gpx-tools.test.js` para validación de XML unificado y extracción de fechas (24/24 pruebas totales exitosas).

### `v1.0.6-alpha` (2026-10-21)
- **Publicación y Disponibilidad Directa de Ejecutables en Git y GitHub (`release/`)**:
  - Inclusión oficial del directorio de distribución `release/` en el árbol de Git con instaladores y binarios portables (`BiTaVi-v1.0.6-alpha-setup.exe`, `BiTaVi-v1.0.6-alpha-portable.exe` y zips multiplataforma).
  - Guía informativa de descargas directa en `release/README.md`.
  - Integración de publicación automatizada en GitHub Actions (`.github/workflows/build.yml`) para creación de releases en GitHub con binarios adjuntos.
  - Ajuste de `.gitignore` para permitir paquetes de distribución sin comprometer la seguridad de respaldos personales.

### `v1.0.5-alpha` (2026-10-21)
- **Empaquetado Nativo de Escritorio con Tauri v2 (`src-tauri/`)**:
  - **Integración de Tauri v2 con Backend Rust Ultraligero**:
    - Configuración integral en `src-tauri/tauri.conf.json` e inicialización del núcleo Rust en `src-tauri/src/main.rs` y `src-tauri/src/lib.rs`.
    - Tamaño de binario y consumo de memoria mínimos frente a soluciones basadas en Chromium pesado (Electron).
    - Scripts npm añadidos: `"tauri"`, `"tauri:dev"` y `"tauri:build"`.
  - **Asociaciones Nativas de Archivos del Sistema Operativo**:
    - Registro de extensiones de archivo en el sistema operativo (Windows y Linux): `.gpx` (GPS Exchange Format), `.kml` y `.kmz` (Google Earth), y `.zip` (Backups de BiTaVi).
  - **Documentación Técnica Oficial**: Se redactó la especificación técnica en [`docs/19_empaquetado_escritorio_tauri.md`](19_empaquetado_escritorio_tauri.md).

### `v1.0.4-alpha` (2026-10-21)
- **Soporte de Mapas 100% Offline y Caché de Teselas Cartográficas (`public/sw.js` y `src/components/offline-map-manager.js`)**:
  - **Service Worker Táctico con Estrategia Cache-First (`public/sw.js`)**:
    - Intercepción automática de peticiones hacia servidores de mapas libres (OpenStreetMap, OpenTopoMap, Esri, CyclOSM).
    - Entrega instantánea de teselas en 0 ms desde la caché local `bitavi-tiles-v1`.
    - Auto-almacenamiento de teselas al navegar en línea y respuesta de contingencia transparente de 1x1 píxel sin conexión para teselas no descargadas.
  - **Gestor de Cuadrantes Cartográficos (`src/components/offline-map-manager.js`)**:
    - Proyección matemática Web Mercator ($EPSG:3857$) para cálculo y delimitación de cuadrantes geográficos en múltiples zooms.
    - Descarga concurrente controlada (pool de 6 hilos simultáneos) con barra de progreso y telemetría en tiempo real.
    - Monitoreo de conectividad (`online`/`offline`) y purgado selectivo de caché de teselas.
  - **Integración en la Interfaz HUD**:
    - Subpanel táctico en "01 Capas Cartográficas": monitor de estado de conexión (`🛰️ EN LÍNEA` / `📡 MODO CAMPO OFFLINE`), contador de teselas en memoria y botones `[📥 Descargar Cuadrante]` y `[🗑️ Purgar]`.
  - **Documentación Técnica Oficial**: Se redactó la especificación técnica en [`docs/18_soporte_mapas_offline_tile_caching.md`](18_soporte_mapas_offline_tile_caching.md).

### `v1.0.3-alpha` (2026-10-21)
- **Suite de Pruebas Unitarias Automatizadas con Vitest (`tests/`)**:
  - **Integración de Vitest & happy-dom (`vitest.config.js`)**:
    - Configuración del motor de pruebas ultrarrápido Vitest con entorno DOM simulado `happy-dom` para soporte sin fisuras de APIs web y Leaflet.
    - Scripts npm agregados: `npm test` (`vitest run`) y `npm run test:watch`.
    - Integración en el flujo de CI de GitHub Actions (`.github/workflows/build.yml`).
  - **Batería Exhaustiva de Pruebas (19 tests en 6 suites)**:
    - `tests/navigation-math.test.js`: Validación matemática de la fórmula de Haversine, cálculo de rumbos esféricos (*bearing* de 0° a 360°), traducción a rumbos cardinales (`N`, `NE`, `E`, etc.) y formateo de duración.
    - `tests/kml-kmz.test.js`: Escape de caracteres XML, conversión cromática estricta `#RRGGBB` -> `aabbggrr` y estructura de documento KML 2.2 / KMZ.
    - `tests/gpx-tools.test.js`: Saneamiento de nombres de archivo prohibidos en Windows/Linux y generación de estándar XML GPX 1.1 con telemetría.
    - `tests/folder-loader.test.js`: Detección binaria de Magic Bytes (`PK` y `<xml`), filtrado estricto de archivos de sistema (`.DS_Store`, `desktop.ini`, `Thumbs.db`) y clasificación taxonómica de archivos de expedición.
    - `tests/search.test.js`: Normalización sin diacríticos ni acentos e indexación offline de rutas, fotos y marcadores.
    - `tests/native-parser.test.js`: Interpretación y deserialización de estructuras nativas de BiTaVi Android (`rutas.txt`, `puntos.txt`, `marcadores.txt`).
  - **Documentación Técnica Oficial**: Se documentó la arquitectura de pruebas en [`docs/17_suite_pruebas_unitarias_vitest.md`](17_suite_pruebas_unitarias_vitest.md).

### `v1.0.2-alpha` (2026-10-21)
- **Exportación a Formatos KML y KMZ 3D para Google Earth (`src/components/kml-kmz-exporter.js`)**:
  - **Generador KML 2.2 XML Estándar (`generateKmlXml`)**:
    - Polilíneas con teselación (`<tessellate>1</tessellate>`), extrusión y modo `<altitudeMode>clampToGround</altitudeMode>` adaptadas a la topografía tridimensional.
    - Conversión cromática exacta entre hexadecimal CSS y el estándar KML inverso `aabbggrr` (`hexToKmlColor`).
    - Marcadores de waypoints y favoritos con iconos nativos de Google Earth.
  - **Empaquetador Autocontenido KMZ con Fotos (`exportToKmz`)**:
    - Generación de paquetes comprimidos KMZ con `doc.kml` en la raíz y subcarpeta `files/` que aloja las fotos geolocalizadas reales.
    - Popups descriptivos en HTML con previsualización fotográfica, coordenadas, altitud y marcas de tiempo de captura.
  - **Integración en Interfaz**:
    - Botones dedicados en la barra de exportación de rutas: `[🌍 KML 3D]` y `[🌐 KMZ 3D (con Fotos)]`.
    - Botón de exportación masiva en la galería fotográfica: `[🌐 Exportar Fotos a KMZ 3D]`.
  - **Documentación Técnica Oficial**: Se documentó la especificación técnica en [`docs/16_exportador_kml_kmz_google_earth_3d.md`](16_exportador_kml_kmz_google_earth_3d.md).

### `v1.0.1-alpha` (2026-10-21)
- **Modo Reproductor y Simulador Táctico de Viaje (Playback de Ruta)**:
  - **Motor de Simulación Desacoplado (`src/components/playback.js`)**:
    - Implementación de la clase `RoutePlaybackSimulator` que reproduce de forma fluida el recorrido mediante `requestAnimationFrame` a 60 FPS.
    - Marcador táctico móvil vectorial con orientación dinámica calculada mediante fórmula esférica de rumbo (*bearing* de 0° a 360°) y traducción a rumbos cardinales (`N`, `NE`, `E`, etc.).
  - **Barra de Control HUD Interactiva (`#playback-bar`)**:
    - Controles de reproducción: `[▶ Iniciar]` / `[⏸ Pausar]` / `[⏹ Reiniciar]`.
    - Selector de velocidad instantánea en tiempo real (`1x`, `2x`, `5x`, `10x`, `20x`, `50x`).
    - Deslizador de línea de tiempo (*timeline slider*) porcentual y continuo para saltar o rebobinar instantáneamente a cualquier momento de la expedición.
    - Interruptor `[🎯 Seguir Cámara]` para centrado automático y seguimiento visual del vehículo o explorador.
    - Telemetría en vivo: distancia recorrida acumulada, altitud instantánea, velocidad calculada en km/h, rumbo cardinal y hora del registro.
  - **Integración con Selector de Rutas y Galería**:
    - Botón de reproducción directa `[▶]` en cada fila del panel de rutas y acceso táctico global en el HUD superior (`#btn-toggle-playback`).
    - Detección de proximidad geográfica (< 60 m) con fotos geolocalizadas durante el avance del simulador.
  - **Documentación Técnica Oficial**: Se redactó el manual de arquitectura y especificación matemática en [`docs/15_simulador_reproductor_tactico_viaje.md`](15_simulador_reproductor_tactico_viaje.md).

### `v1.0.0-alpha` (2026-10-21)
- **Hito Mayor: Desacoplamiento de Descompresión Masiva ZIP en Web Worker (`src/workers/zip-worker.js`)**:
  - **Procesamiento en Hilo Secundario**: La descompresión de archivos ZIP masivos (con cientos de fotografías y millones de registros GPS de BiTaVi Android) se trasladó por completo a un Web Worker modular (`src/workers/zip-worker.js`).
  - **Rendimiento a 60 FPS sin Congelamientos**: Se eliminó el bloqueo del hilo principal del navegador durante la carga de respaldos grandes; el visor cartográfico y las animaciones del HUD responden con total fluidez.
  - **Transferencia Zero-Copy de Memoria**: Las imágenes extraídas se transfieren entre el Worker y el hilo principal utilizando `transferable ArrayBuffers`, evitando clonación o consumo duplicado de memoria RAM.
  - **Mecanismo de Contingencia (*Fallback*)**: Si el navegador o entorno no soporta Workers, `ZipBackupHandler` conmuta automáticamente y sin interrupciones a la ejecución local en el hilo principal.
  - **Hito de Versión Mayor (`X.Y.Z`)**: Tras alcanzar `v0.5.10-alpha`, según la regla del sistema el dígito principal avanza a `v1.0.0-alpha`.

### `v0.5.10-alpha` (2026-10-21)
- **Empaquetado Multiplataforma Autónomo (Windows / Linux) y Preparación de Repositorio GitHub Privado**:
  - **Empaquetador Multiplataforma (`scripts/package.js` y `npm run package`)**:
    - Script automatizado que compila la versión de producción con Vite y genera paquetes portables `.zip` en el directorio `release/` optimizados tanto para Windows (`BiTaVi-PC-v0.5.10-Windows.zip`) como para Linux/macOS (`BiTaVi-PC-v0.5.10-Linux.zip`), incluyendo sus respectivos scripts de inicio rápido (`.bat` / `.sh`) y el servidor táctico local Node.js.
  - **Flujo de Integración Continua Multiplataforma (`.github/workflows/build.yml`)**:
    - Automatización mediante GitHub Actions con matriz para `windows-latest` y `ubuntu-latest`. Ejecuta verificación sintáctica, compilación y generación de artefactos distribuibles en cada push/PR.
  - **Blindaje Estricto de Seguridad y Exclusión de Backups (`.gitignore`)**:
    - Se configuró la exclusión total de archivos de respaldo comprimidos (`*.zip`, `*.tar`, `backup_*`) para evitar la subida de datos personales del teléfono móvil o backups pesados a GitHub.
    - Se preservaron únicamente los archivos de prueba ligeros autorizados (`sample-data/backup_ejemplo_bitavi.zip` y `sample-data/recorrido_tactico_ejemplo.gpx`).
  - **Inicialización del Repositorio Git Local**: Repositorio inicializado en la rama `main` listo para vinculación con el repositorio privado remoto.

### `v0.5.9-alpha` (2026-10-18)
- **Consolidación Documental, Purga y Unificación de Pendientes (`docs/pendientes.md`)**:
  - **Historial completo y exhaustivo**: Se revisó y validó que todo el historial de cambios de la aplicación desde la creación de la base hasta las últimas intervenciones (`v0.5.4-alpha` a `v0.5.8-alpha`) se encuentre plenamente documentado y sincronizado.
  - **Purga de archivos obsoletos**: Se eliminó el archivo residual desactualizado `PENDIENTES.md` de la raíz del proyecto para evitar duplicidades o confusión con respecto al estado del desarrollo.
  - **Creación de hoja de ruta oficial (`docs/pendientes.md`)**: Se estructuró un documento centralizado con las tareas pendientes reales para fases futuras (descompresión masiva en Web Worker, simulador de playback de viaje, exportación KML/KMZ para Google Earth 3D, tests automatizados con Vitest, caché offline de mapas y empaquetado nativo con Tauri).

### `v0.5.8-alpha` (2026-10-18)
- **Reactivación Inmediata de Casillas de Verificación para Mostrar / Ocultar Rutas en el Mapa**:
  - **Sincronización directa de casillas**: Se corrigió el desacople introducido en el rediseño anterior, conectando el evento `change` de cada checkbox `.route-export-box` a `nativeParser.setRouteVisibility(r.id, isChecked)`.
  - **Ocultamiento instantáneo**: Al desmarcar la casilla de cualquier ruta, su polilínea, flechas y marcadores de inicio/fin se ocultan del mapa de inmediato y la fila se atenúa visualmente.
  - **Casilla maestra sincronizada**: Al marcar o desmarcar la casilla superior ("Elegir todas / Mostrar todas"), todas las rutas en el visor se encienden o apagan coordinadamente en tiempo real.
  - **Sincronización bidireccional**: La casilla y el botón de alternancia rápida `👁️ / 🙈` se mantienen perfectamente sincronizados.

### `v0.5.7-alpha` (2026-10-18)
- **Herramienta Universal de Reubicación y Corrección de Fotos en el Mapa (`[📍 Reubicar en el mapa]`)**:
  - **Corrección de fotos mal ubicadas**: Anteriormente, si una foto ya tenía coordenadas registradas (incluso si eran incorrectas por caché de GPS del teléfono, triangulación celular lejana o desfase), el botón de fijación en el mapa se ocultaba. Ahora el visor modal ofrece permanentemente **`[📍 Reubicar en el mapa]`**, permitiendo al usuario corregir y mover cualquier foto con un solo clic sobre la posición correcta del terreno.
  - **Persistencia transaccional de coordenadas**: Al reubicar una foto, sus nuevas coordenadas se sincronizan inmediatamente en IndexedDB y en el catálogo del buscador táctico, conservando la corrección tras recargar o cerrar la app.

### `v0.5.6-alpha` (2026-10-18)
- **Controlador Táctico de Rueda del Mouse (Resolución de Saltos Bruscos, Inercia y Rebote en Windows)**:
  - **Desactivación del gestor descontrolado nativo de Leaflet**: Se sustituyó `scrollWheelZoom` por defecto (el cual acumulaba deltas grandes en milisegundos provocando que el zoom saltara de golpe al nivel máximo o se desbordara en ráfagas retardadas).
  - **Paso Unitario Estricto (1 nivel por muesca)**: Cada movimiento intencional de la rueda del mouse ahora incrementa o reduce exactamente **1 nivel de zoom entero** (`zoomStep = +1 / -1`), garantizando previsibilidad absoluta y fin del disparo al zoom máximo.
  - **Filtro Anti-rebote y Neutralización de Inercia de Windows (`wheelCooldown`)**:
    - Se incorporó un mecanismo de amortiguación temporal de 160 ms tras cada salto de zoom.
    - Este filtro descarta los eventos parásitos generados por la inercia de Windows, los micro-rebotes mecánicos de encoders de mouse con holgura (que producían los 2 o 3 saltos en reversa hacia arriba al detenerse el giro) y los micro-desplazamientos de trackpads.
  - **Zoom Focalizado en Cursor**: El zoom mantiene el centrado dinámico sobre las coordenadas geográficas exactas apuntadas por el puntero del mouse (`setZoomAround`).

### `v0.5.5-alpha` (2026-10-18)
- **Gestión Incremental de Rutas, Renombrado Interactivo y Exportación Separada (.GPX / .ZIP)**:
  - **Carga y Adición Incremental de Rutas (`[➕ Agregar Ruta]`)**:
    - Se eliminó el comportamiento destructivo anterior donde cargar un nuevo archivo GPX borraba la sesión previa del mapa.
    - Se implementó `addNewRoutesFromFiles` y el método `nativeParser.addRoute(...)`. Ahora el usuario puede pulsar `[➕ Agregar Ruta]` o soltar múltiples archivos GPX, KML o de rutas sucesivos, acumulándose en la misma expedición con colores diferenciados y telemetría consolidada.
  - **Renombrado Interactivo in situ ("Nombre Diferente")**:
    - Cada ruta en el panel de telemetría cuenta con edición en tiempo real (clic en el texto o botón con icono de lápiz `✏️`).
    - Al presionar `Enter` o perder el foco, el nuevo nombre se actualiza dinámicamente en memoria, en la lista, en el popup táctico de la polilínea en el mapa y se sincroniza en el almacenamiento local persistente de IndexedDB.
  - **Exportación y Guardado de Rutas Elegidas Separadas**:
    - **Selección granular**: Cada fila cuenta con su casilla `[✓]` para elegir exactamente qué rutas se desean exportar, acompañada de una casilla maestra para seleccionar todas.
    - **Descarga individual directa (`💾`)**: Cada ruta dispone de un botón de descarga rápida para guardarla en el acto como archivo `.gpx` con su nombre asignado (`Nombre_Personalizado.gpx`).
    - **Guardado masivo por separado (`[💾 Guardar Elegidas (.GPX)]` / `[📦 ZIP Separadas]`)**: Permite descargar todas las rutas elegidas como archivos GPX individuales independientes o empaquetarlas en un archivo ZIP estructurado (`rutas_seleccionadas_bitavi.zip`) utilizando `JSZip`.
    - **Generador de estándar GPX 1.1 (`createGpxXml`)**: Motor propio que crea archivos GPX 1.1 estándar con metadatos, nombres, waypoints, elevación, marcas de tiempo y velocidades compatibles con Garmin, Strava, Wikiloc, Google Earth y BiTaVi Android.
  - **Control Visual Granular**:
    - Botón de alternancia de visibilidad `👁️ / 🙈` por cada ruta individual para ocultar o aislar tramos en el visor sin eliminarlos.

### `v0.5.4-alpha` (2026-10-18)
- **Corrección Crítica y Blindaje del Script de Inicio para Windows (`Iniciar BiTaVi PC.bat`)**:
  - **Resolución de Error de Sintaxis de CMD (`"No se esperaba ... en este momento"`)**: El intérprete de comandos `cmd.exe` de Windows cerraba prematuramente los bloques condicionales `if (...)` al encontrar paréntesis dentro de mensajes de salida `echo` (como `(rolldown win32-x64)`). Se eliminaron todos los bloques de paréntesis propensos a rotura, reestructurando el flujo mediante saltos directos de control con etiquetas (`goto :node_ok`, `goto :check_bindings`, `goto :start_app`, `goto :end`).
  - **Verificación Robusta de Node.js**: Se incorporó detección preventiva de Node.js (`where node`). Si Node.js no está instalado o no se encuentra en el `PATH`, el script muestra un mensaje informativo en español y mantiene pausada la ventana en lugar de cerrarse de manera súbita.
  - **Apertura Nativa del Navegador con Vite**: Se sustituyó el comando auxiliar con temporizador `timeout` (el cual provocaba fallos de redirección de entrada y ventanas cmd parpadeantes) por el flag nativo `--open` de Vite (`npm run dev -- --open`), garantizando que la aplicación abra el navegador predeterminado de inmediato cuando el servidor local esté listo.
  - **Soporte cruzado y binding nativo**: Se aseguró la presencia e instalación limpia del paquete `@rolldown/binding-win32-x64-msvc` para evitar fallos si el repositorio proviene de entornos mixtos Linux/WSL.

### `v0.5.3-alpha` (2026-10-18)
- **Detección Binaria por Magic Bytes (`PK`) y Exclusión Total de Archivos Desconocidos sin Extensión**:
  - **Paridad con el motor de Android (`BackupUseCase.kt`)**: Se implementó inspección binaria ultra liviana de cabeceras (`_detectFileTypeFromBytes`). Si un archivo comienza con los bytes `0x50 0x4B` (`PK`), es catalogado inequívocamente como `📦 Backup Comprimido (ZIP)` aun si carece de extensión `.zip`, fue exportado por Android sin extensión o tiene nombres dinámicos.
  - **Exclusión total de archivos desconocidos sin extensión**: Anteriormente, cualquier archivo no reconocido caía en `type: 'other'` ("📄 Archivo"), llenando la lista con archivos internos de Android (bases de datos sin extensión como `localizer_db`, `journal`, cachés o índices). Ahora, mediante `_isUsefulBiTaViFile`, todo archivo que no sea un respaldo ZIP verificado, ruta GPX/KML, telemetría o fotografía queda **estrictamente excluido** del visor.
  - **Iteración universal de carpetas (`_getDirectoryEntries`)**: Se adaptó el generador de lectura de directorios para soportar indistintamente las variantes de la API del navegador (`handle.values()`, `handle.entries()` e iteración asíncrona directa) garantizando que ningún archivo sea ignorado durante el escaneo.

### `v0.5.2-alpha` (2026-10-18)
- **Blindaje del Escáner de Backups ZIP y Filtrado de Archivos Basura (Google Drive Desktop / PC)**:
  - **Carga diferida y tolerancia a archivos en la nube (on-demand / streaming)**: Al escanear una carpeta en Google Drive Desktop donde los archivos `.zip` grandes están alojados en la nube con descarga bajo demanda, la llamada síncrona a `entry.getFile()` solía arrojar excepción y provocar que el archivo fuera descartado por completo (marcando 0 backups). Se implementó un cargador no bloqueante (`getFile: async () => await entry.getFile()`) que registra el respaldo de inmediato por su nombre e invoca la lectura completa del `Blob` únicamente cuando el usuario pulsa `[CARGAR]`.
  - **Filtro estricto de archivos basura del sistema operativo**: Se implementó `_isJunkEntry()` para ignorar de raíz archivos de sistema o temporales como `desktop.ini`, `Thumbs.db`, `ehthumbs.db`, `.nomedia`, `.DS_Store`, `~$*`, `.tmp`, `.crdownload`, eliminando los "archivos raros" que antes ensuciaban la interfaz.
  - **Detección robusta de extensiones y nombres**: El clasificador unificado `_classifyFile()` reconoce variaciones de mayúsculas/minúsculas y formatos de compresión (`.zip`, `.tar`, `.gz`, `.7z`, nombres con `backup_`), categorizándolos inequívocamente como `📦 Backup Comprimido`.
  - **Botón `[📦 Seleccionar .ZIP Directo]` en el modal**: Se añadió acceso directo (`#btn-modal-pick-direct-zip`) en el modal y en el estado vacío para permitir al usuario seleccionar inmediatamente su archivo `.zip` mediante el diálogo nativo de archivos del sistema sin tener que explorar carpetas.
  - **Telemetría visual clara**: La barra de estado y el modal ahora indican con precisión cuántos backups ZIP específicos fueron detectados (ej. `📦 3 backup(s) ZIP detectado(s)`).

### `v0.5.1-alpha` (2026-10-18)
- **Escaneo Recursivo y Selector Inclusivo de Archivos de Carpeta**:
  - **Detección profunda sin omisiones**: El motor `FolderBackupLoader` ahora explora recursivamente hasta 4 niveles de subcarpetas, garantizando que backups o rutas alojados en subdirectorios de Google Drive (`Google Drive/BiTaVi/Backups/`) sean catalogados sin excepción.
  - **Clasificación inclusiva y visual**: Ya no se ocultan archivos con extensiones no convencionales; se muestran todos los archivos detectados clasificados por tipo (`📦 Backups ZIP`, `🗺️ Rutas GPX/TXT/KML`, `📷 Fotografías`, `📄 Otros`) con indicación de su ruta relativa interna.
  - **Pestañas de filtrado táctico y contadores**: El modal de carpeta conectada incluye botones de filtro rápido con contadores dinámicos para aislar al instante backups, rutas o fotos.
  - **Botón `[⚡ Cargar Carpeta Completa]`**: Permite procesar de una sola vez todos los archivos del directorio en caso de tratarse de una expedición desglosada en múltiples archivos de texto y fotografías.

### `v0.5.0-alpha` (2026-10-18)
- **Compatibilidad Universal con GPX de Cualquier Aplicación Externa**:
  - **Soporte dual de trazados**: El motor `GpxHandler` (`src/components/gpx-parser.js`) ahora reconoce de forma transparente tanto tracks grabados en tiempo real (`<trkpt>`) como rutas planificadas (`<rtept>`), admitiendo archivos de Strava, Wikiloc, Garmin, Komoot, OsmAnd, OruxMaps, Google Earth o Relive.
  - **Renderizado táctico de Waypoints / POIs**: Si el archivo GPX externo incluye waypoints marcados (`<wpt>`), BiTaVi los dibuja sobre la capa `waypointsLayerGroup` con marcadores cian tácticos y popups descriptivos de nombre y coordenadas.
  - **Limpieza atómica de capas**: El método `clearTrack` purga coordinadamente rutas, marcadores de inicio/fin, chevrons y waypoints sin dejar capas huérfanas en el mapa.
  - **Hito de versión mayor/media**: Por regla del proyecto, tras completarse `0.4.10`, el dígito medio avanza a `0.5.0`.

### `v0.4.10-alpha` (2026-10-18)
- **Conexión de Carpeta y Selector Preciso de Backups de BiTaVi Android**:
  - **Fin de la ingestión masiva indiscriminada**: Al conectar una carpeta local o sincronizada por Google Drive Desktop para PC, el sistema ya no mezcla ni procesa todos los archivos de golpe en lote.
  - **Catalogación e indexación de respaldos**: El módulo `FolderBackupLoader` (`src/components/folder-loader.js`) escanea la carpeta buscando archivos `.zip` (`backup_*.zip`, `ROUTE_*.zip`), archivos `.gpx` y subcarpetas de expediciones.
  - **Modal táctico de selección de backup (`#folder-backup-modal`)**: Presenta la lista de backups disponibles ordenados cronológicamente (el más reciente primero), detallando nombre del archivo, fecha de modificación y peso formateado en MB/KB.
  - **Filtro de búsqueda en tiempo real**: Caja de búsqueda rápida para filtrar respaldos por fecha o nombre dentro del modal.
  - **Barra de estado de carpeta conectada (`#connected-folder-bar`)**: Ubicada en el Panel 02, mantiene en memoria el acceso a la carpeta seleccionada y permite volver a abrir el selector de backups o cambiar de viaje en un clic sin reabrir el diálogo del explorador del sistema operativo.
  - **Carga selectiva y aislada**: Al pulsar `[CARGAR]`, el sistema procesa exclusivamente el archivo de backup seleccionado con `handleFiles([backup])`, manteniendo la expedición limpia y sin mezclas de rutas ajenas.

### `v0.4.9-alpha` (2026-10-18)
- **Chevrons Direccionales Sutiles en Blanco (Paridad con BiTaVi Android)**:
  - **Sustitución de flechas toscas**: Se reemplazaron las flechas triangulares gruesas de color por chevrons tácticos vectoriales SVG sutiles ("dos rayitas" en forma de V abierta hacia atrás).
  - **Color blanco puro con contorno oscuro de contraste**: El trazo interior es blanco (`#ffffff`, `stroke-width: 1.8px`) envuelto en un contorno oscuro táctico (`rgba(15, 15, 20, 0.92)`, `stroke-width: 3.6px`, `stroke-linecap: round`, `stroke-linejoin: round`) para asegurar visibilidad nítida sobre cualquier color de ruta (verde, cian, rojo, amarillo) y cualquier mapa base (satelital, topográfico u OSM nocturno).
  - **Geometría conforme Mercator y rumbo geodésico**: Cálculo exacto del rumbo (`bearing`) con corrección de latitud esférica ($dx = \Delta lng \times \cos(lat)$, $dy = \Delta lat$), garantizando que el chevron se oriente exactamente a lo largo de la tangente del trazado sin distorsión angular.
  - **Distribución balanceada y filtrado de detenciones**: Paso dinámico (`stride`) con detección de puntos estacionarios para evitar acumulación de chevrons cuando el usuario está detenido, y fallback garantizado para rutas de pocos puntos.
  - **Paridad estricta con BiTaVi Android**: Réplica fiel de la lógica implementada en `RouteDirectionArrowsOverlay.kt`.

### `v0.4.8-alpha` (2026-10-18)
- **Persistencia de Sesión con IndexedDB (`BiTaVi_Storage_v1`)**:
  - **Módulo `BiTaViStorage` (`src/components/storage.js`)**: Persistencia local transaccional y offline-first sin servidores para salvaguardar la última expedición ante recargas de página (`F5`), cierres de pestaña o navegación accidental.
  - **Almacenamiento dual de datos y fotografías**: Esquema con dos Object Stores (`sessions` para rutas, telemetría, marcadores y favoritos; `photos` para el resguardo de imágenes en objetos `Blob` nativos sin penalización de base64).
  - **Banner táctico de restauración en HUD**: Al abrir la aplicación, si existe una sesión previa guardada, se muestra de forma inmediata un banner contextual en el visor (`#session-restore-banner`) con opciones para `[⚡ RESTAURAR EXPEDICIÓN]` o `[✕ DESCARTAR]`.
  - **Auto-guardado y sincronización reactiva**: Guardado automático al procesar paquetes ZIP, archivos nativos de texto o carpetas locales, y sincronización en vivo cuando se geolocaliza o arrastra un marcador de foto en el mapa.
  - **Limpieza controlada**: Al pulsar "LIMPIAR RUTA", la sesión en IndexedDB se purga de manera segura sin dejar huérfanos.

### `v0.4.7-alpha` (2026-10-17)
- **Buscador Táctico Local e Híbrido (Offline First)**:
  - **Indexación instantánea en memoria**: El módulo `GeoSearch` (`src/components/search.js`) ahora cataloga automáticamente todas las rutas, waypoints de `marcadores.txt`, paradas de `favoritos.txt` y fotografías con o sin GPS cargadas en la expedición.
  - **Búsqueda insensible a diacríticos**: Algoritmo de normalización Unicode NFD para coincidencias flexibles sin importar acentos, tildes o mayúsculas.
  - **Resultados categorizados en HUD**: Desplegable táctico con separadores visuales para `🛰️ EXPEDICIÓN ACTIVA` (offline) y `🌐 CARTOGRAFÍA MUNDIAL (OSM)`. Badges distintivos por tipo de entidad (`RUTA`, `WAYPOINT`, `PARADA`, `FOTO`, `MAPA`).
  - **Navegación espacial asistida**: Al seleccionar un resultado local, la cámara vuela suavemente a las coordenadas (`flyToCoordinates`), encuadra la ruta correspondiente (`fitBounds`) o abre el visor ampliado si se trata de una fotografía.
  - **Tolerancia a fallos de red**: Si el equipo no cuenta con internet o la API de OpenStreetMap responde con lentitud o límite de tasa (429), los resultados de la expedición se presentan de forma inmediata (0 ms).

### `v0.4.6-alpha` (2026-10-17)
- **Ingestión Directa de Carpetas con FileSystem Access API**:
  - **Módulo `FolderBackupLoader` (`src/components/folder-loader.js`)**: Soporte nativo para `window.showDirectoryPicker()`, permitiendo seleccionar directamente carpetas de viaje descomprimidas o carpetas locales sincronizadas por Google Drive Desktop para PC.
  - **Cero dependencias de red o claves API**: Carga instantánea de `rutas.txt`, `puntos.txt`, `marcadores.txt`, `favoritos.txt` y fotografías en subcarpetas `images/` sin consumir RAM en descompresión ZIP ni requerir credenciales en Google Cloud.
  - **Fallback transparente**: En navegadores sin soporte de la API nativa de directorios, conmuta automáticamente a selección de directorios por input HTML5 (`webkitdirectory`).
  - **Botón táctico en HUD**: Nuevo control `📁 Abrir Carpeta (Drive / PC)` en el Panel 02 de carga de datos.
  - **Telemetría visual integrada**: Conexión con el overlay táctico (`#tactical-progress-overlay`) para reporte en vivo de escaneo e indexación de archivos en tiempo real.

### `v0.4.5-alpha` (2026-10-17)
- **Compatibilidad Operativa Multiplataforma Bidireccional (Windows $\longleftrightarrow$ Linux)**:
  - **Servidor local nativo de contingencia (`scripts/serve.js`)**: Servidor HTTP en Node.js puro (cero dependencias nativas binarias) con resolución MIME y soporte para ES Modules, que garantiza el arranque del visor táctico en cualquier sistema operativo independientemente de conflictos de binarios.
  - **Doble resolución de bindings nativos para Rolldown/Vite**: Registro explícito de `@rolldown/binding-win32-x64-msvc` y `@rolldown/binding-linux-x64-gnu` en `optionalDependencies` de `package.json`.
  - **Blindaje de lanzadores**:
    - `Iniciar BiTaVi PC.bat`: Detección automática de dependencias generadas desde Linux, instalación del binding de Windows y fallback transparente a `node scripts/serve.js` si Vite no puede iniciar.
    - `Iniciar BiTaVi PC.sh`: Detección de dependencias generadas desde Windows, finales de línea LF puros, soporte para entornos Linux y WSL (`wslview`, `xdg-open`) y fallback al servidor nativo.
  - **Auditoría de nombres de archivo y rutas**: Verificación de *case sensitivity* en todos los `import` y rutas de archivos para garantizar ejecución limpia en sistemas Linux.
  - **Optimización de `scripts/check.js`**: Reemplazo de manipulación manual de separadores de ruta por `relative(ROOT, file)` para compatibilidad cruzada.

### `v0.4.4-alpha` (2026-10-14)
- **Distinción explícita de plataforma PC en ejecutables y scripts**:
  - Renombrados los scripts lanzadores a `Iniciar BiTaVi PC.bat` e `Iniciar BiTaVi PC.sh` con títulos y cabeceras explícitas de "Visor PC" para evitar confusiones con la versión móvil de Android.

### `v0.4.3-alpha` (2026-10-14)
- **Análisis FODA, Solución de Problemas y Catálogo de Agentes**:
  - Creación del documento maestro `docs/09_analisis_foda_soluciones_y_agentes.md` con matriz FODA exhaustiva, plan de resolución a cuellos de botella en memoria, alternativas a Google Drive con FileSystem Access API, y catálogo de 7 agentes de software con matriz RACI.
  - Sincronización estricta del número de versión en `package.json` (que se encontraba desfasado en 0.3.9), `src/version.js`, `index.html` y documentación técnica.

### `v0.4.2-alpha` (2026-08-29)
- **Lightbox de foto a pantalla completa sin datos**:
  - El modal de foto ahora ocupa ~96% del viewport (antes 900px con panel lateral) y la imagen se ajusta al contenedor (`object-fit: contain`, sin límite de 75vh).
  - Se eliminó el panel lateral de metadatos (latitud, longitud, altitud, cámara). La barra inferior conserva solo el nombre, la fecha y los botones "Centrar en el mapa" / "Fijar en el mapa".

### `v0.4.1-alpha` (2026-08-29)
- **Corrección de ubicación del badge de fecha de ruta**:
  - El badge se movió del vértice superior izquierdo (que tapaba el control de zoom en modo normal) al **centro superior del mapa**, donde queda visible tanto en modo normal como en modo FOTOS (el rail ocupa la izquierda).
  - `z-index` subido a 650 para quedar por encima del rail de fotos (450) y del sidebar (500).

### `v0.4.0-alpha` (2026-08-29)
- **Fecha de la ruta visible en el mapa**:
  - Nuevo badge flotante táctico sobre el mapa (esquina superior izquierda) que muestra la fecha de la(s) ruta(s) cargadas (`#route-date-badge`).
  - Nueva tarjeta de telemetría "FECHA RUTA" en el Panel 03.
  - Para rutas nativas de BiTaVi Android usa `startDate`; para GPX usa la marca de tiempo del primer punto (`trkpt`/`time`). Se actualiza al cargar backup, GPX, TXT nativos o demo, y se oculta con "Limpiar Mapa".
  - Al llegar el dígito `Z` a 10, se incrementa `Y` (0.3.10 → 0.4.0) según las reglas de versionado.

### `v0.3.10-alpha` (2026-08-29)
- **Geolocalización manual de fotos (sin GPS en EXIF)**:
  - Desde el modal de la foto, botón "📍 FIJAR EN EL MAPA": activa el modo y al hacer clic en el mapa se asignan las coordenadas (`photoHandler.assignPhotoLocation`, `main.js`).
  - Arrastrar la miniatura de la foto (galería del Panel 04 o rail de FOTOS) y soltarla sobre el mapa para ubicarla en ese punto.
  - Los marcadores de foto son ahora arrastrables: soltar el marcador reescribe las coordenadas de la foto ya geolocalizada.
  - Al hacer clic en cualquier miniatura (galería o rail) se abre la foto a tamaño completo (vista ampliada/lightbox); el "Centrar en mapa" queda en el modal.
  - Cancelación del modo "fijar" con `Escape`.
  - `npm run lint` y `npm run typecheck` siguen pasando; `dist/` regenerado.

### `v0.3.9-alpha` (2026-08-29)
- **Mantenimiento y limpieza**:
  - Versión centralizada en `src/version.js` (`APP_VERSION`); el badge del HUD y la `ShareCard` se derivan de ahí para evitar desincronización manual.
  - Eliminada la dependencia muerta `lucide` de `package.json`.
  - Eliminado el `apiKey` de Google Drive sin uso en `drive-connector.js` (el conector solo usa el Client ID con token OAuth).
  - `search.js` (Nominatim) ahora cancela la petición anterior con `AbortController`, evitando condiciones de carrera en búsquedas rápidas.
  - `map.js`: ya no se auto-geolocaliza en cada carga (se evita el permiso/error en PC sin GPS); el centrado usa la última ubicación guardada o el botón "GPS AUTO".
  - `photo-parser.js`: `clearPhotos` quita capas/marcadores antes de revocar las object URLs (evita popup con imagen rota).
  - Añadidos scripts `npm run lint` / `npm run typecheck` (`scripts/check.js`, verificación de sintaxis sin dependencias).
  - Regenerado `dist/` con la versión actualizada.

### `v0.3.8-alpha` (2026-08-28)
- **Enfoque de rutas activas**: el botón "Enfocar Rutas" ahora encuadra únicamente las trayectorias visibles (las tildadas en el selector). `BiTaViNativeParser` lleva registro de rutas visibles (`visibleRoutes`) y expone `getVisibleRoutesBounds()`; si no hay rutas nativas (p.ej. GPX) se mantiene el enfoque anterior con `currentRouteBounds`.

### `v0.3.7-alpha` (2026-08-28)
- **Flechas de dirección y selección de rutas**:
  - Las flechas de recorrido ahora usan el **mismo color que su trayectoria** (se pasa el color de ruta a `addRouteArrows`) y se dibujan encima de la línea (están en `markerPane`, por encima de `overlayPane`). También se aplicó en GPX.
  - Nuevo selector **Mostrar / Ocultar Rutas**: lista de checkboxes (uno por trayectoria, con muestra de color) más una casilla "Todas las rutas". Permite aislar recorridos en el mapa ocultando los demás. Cada ruta se renderiza en su propio grupo de capas (`routeLayers`) y `setRouteVisibility` los agrega/quita sin reprocesar.
  - `getRouteColorMap()` asegura que línea, flechas y checkbox compartan exactamente el mismo color por ruta.

### `v0.3.6-alpha` (2026-08-28)
- **Corrección crítica de carga de backup**: el error "Error al descomprimir el backup ZIP: latLngs is not defined" se debía a un parámetro mal escrito (`latlLngs`) en `MapManager.addRouteArrows` (map.js), introducido en v0.3.4. Se renombró a `latLngs`. El backup ahora carga completo (rutas, fotos y flechas de dirección).

### `v0.3.5-alpha` (2026-08-28)
- **Robustez en carga de ZIP**: `zip-loader.js` ahora tolera entradas individuales que fallen al descomprimir (las omite con advertencia en consola) en lugar de abortar todo el backup. Verificado que el ZIP de ejemplo se descomprime íntegro (58/58 entradas) con JSZip en Node.

### `v0.3.4-alpha` (2026-08-28)
- **Mejoras de vista FOTOS y ruta**:
  - Flechas de dirección a lo largo de la ruta (`addRouteArrows`) para recordar el sentido del recorrido.
  - Pines INICIO/FIN separados en `routeMarkersLayerGroup`: se ocultan en FOTOS (evitan los rectángulos) y se mantienen ordenados por tiempo (primer y último punto).
  - FOTOS oculta también marcadores de ruta; las flechas de dirección permanecen visibles como contexto.
  - Rail de fotos ordenado por marca temporal (`ts`).
  - El control de zoom se desplaza a la derecha del rail (`fotos-active`) para no quedar tapado.

### `v0.3.3-alpha` (2026-08-28)
- **Vista FOTOS: ocultar también marcadores de datos**: además de las fotos, ahora se ocultan los marcadores de `marcadores.txt` y `favoritos.txt` (`hideDataMarkers`/`showDataMarkers` en `BiTaViNativeParser`), dejando en el mapa únicamente la ruta y los puntos de referencia de fotos con sus líneas.

### `v0.3.2-alpha` (2026-08-28)
- **Corrección: rectángulos de foto en vista FOTOS**: `hidePhotoMarkers`/`showPhotoMarkers` referenciaban `this.photosLayerGroup` (inexistente en `PhotoHandler`) en lugar de `this.mapInstance.photosLayerGroup`, por lo que el grupo de marcadores nunca se ocultaba. Ahora sí se remueve y solo queda el punto de referencia dibujado en el SVG.

### `v0.3.1-alpha` (2026-08-28)
- **Color adaptativo de conectores (vista FOTOS)**: el punto de referencia y la línea que une la foto con su ubicación ahora cambian de color según el fondo del mapa (`getBasemapTheme`): claro → tonos oscuros, oscuro/satélite → cian y ámbar brillantes, para asegurar contraste y visibilidad. Se redibujan al cambiar de capa base.

### `v0.3.0-alpha` (2026-08-28)
- **Vista FOTOS: solo punto de referencia (sin rectángulos)**: se reemplazó el intercambio de íconos por ocultar todo el grupo de marcadores de fotos (`hidePhotoMarkers`/`showPhotoMarkers`). El punto en el mapa se dibuja en el SVG de conectores, eliminando las burbujas/rectángulos de color que tapaban la ubicación.

### `v0.2.10-alpha` (2026-08-28)
- **Miniaturas del rail en 16:9**: las fotos del rail de la vista FOTOS usan `aspect-ratio: 16 / 9` para una proporción de video/pantalla estándar.

### `v0.2.9-alpha` (2026-08-28)
- **Rail de fotos más grande**: se incrementó el ancho del rail (188px → 280px) y la altura de las miniaturas (120px → 170px) en la vista FOTOS.

### `v0.2.8-alpha` (2026-08-28)
- **Corrección vista FOTOS (solo punto de referencia)**: al cargar un backup mientras la vista FOTOS está activa, las fotos nuevas ahora se convierten a punto de referencia (`setCompactMode(true)` en `updatePhotosGallery`), evitando que aparezcan las burbujas ("carteles") que tapaban la ubicación.

### `v0.2.7-alpha` (2026-08-28)
- **Vista FOTOS filtrada por viewport + modo compacto de marcadores**:
  - El rail de fotos ahora solo muestra las fotos dentro del pedazo de mapa visible (`map.getBounds()`).
  - Al activar FOTOS, las burbujas de foto del mapa desaparecen y quedan solo puntos de referencia (`photo-ref-dot`) en su posición GPS.
  - El rail se reconstruye al hacer `moveend`/`zoom` para reflejar la vista actual.

### `v0.2.6-alpha` (2026-08-28)
- **Vista de fotos conectadas al mapa (en la misma pantalla)**:
  - Botón "📷 FOTOS" en el header para activar/desactivar la vista.
  - Rail de fotos geolocalizadas a la izquierda del mapa (`photo-rail`).
  - Cada foto tiene su punto en el mapa y una **línea ámbar** que une la miniatura con su posición GPS.
  - Las líneas se recalculan al mover/zoom/redimensionar el mapa y al hacer scroll del rail.
  - Clic en una foto del rail enfoca el marcador en el mapa.

### `v0.2.5-alpha` (2026-08-28)
- **Nueva funcionalidad "Tarjeta Táctica Compartible"**:
  - Botón "Compartir Tarjeta" en la sección de Fotografías Geolocalizadas (visible solo si hay fotos con GPS).
  - `share-card.js`: compone en `<canvas>` una tarjeta con fondo táctico, la ruta registrada, los puntos GPS de las fotos, una barra transparente inferior con miniaturas y líneas que unen cada foto con su posición en el mapa.
  - Exporta la imagen como PNG ("Descargar PNG") o la copia al portapapeles ("Copiar al portapapeles") para redes sociales.

### `v0.2.4-alpha` (2026-08-28)
- **Geolocalización de Fotografías por Paradas/Favoritos**:
  - `favoritos.txt` registra las fotografías asociadas a paradas (nombre de archivo en la URL `content://`) junto con sus coordenadas. El parser nativo (`bitavi-native-parser.js`) ahora extrae el nombre de foto (`photoFile`) y expone `getPhotoGeoMap()`.
  - `photo-parser.js` prioriza la geolocalización por mapa de favoritos antes que por timestamp, posicionando los pines de cámara en el mapa.
  - Se corrigió la detección de imágenes que no tienen `type` MIME pero sí extensión de imagen válida.

### `v0.2.3-alpha` (2026-08-28)
- **Corrección de Descarga de Backups ZIP y Progreso de Descarga**:
  - Refactorizado `drive-connector.js`: re-autenticación automática del token OAuth (`ensureAuthenticated`), manejo de `content-length`/`file.size` nulos, `AbortController` con timeout de 5 minutos y logging de diagnóstico en consola.
  - Blindaje del stream de descarga (`response.body.getReader()`) con try-catch y verificación de `response.body` no nulo.
  - Overlay de progreso (`#tactical-progress-overlay`) con fallback al texto de `#cursor-coords` si el overlay no está disponible.
  - Validación y logging de archivos en `handleFiles` (detección de `FileList` vacío, formato no reconocido, tamaño excesivo).
  - `zip-loader.js` con try-catch global y reporte de progreso mejorado.

### `v0.2.2-alpha` (2026-08-28)
- **Corrección Crítica de Renderizado de Fotos y Fallback**:
  - Blindaje contra errores `TypeError` en fotos sin coordenadas GPS directas (`null.toFixed()`).
  - Geotagging automático de fotos por coincidencia temporal de timestamp en el nombre de archivo (`IMG_GALLERY_timestamp.jpg`) con los puntos de `puntos.txt`.
  - Inclusión de todas las fotos en la galería lateral del Panel 04 para visualización instantánea.

### `v0.2.1-alpha` (2026-08-28)
- **Regla Estricta de Versionado X.Y.Z**: Formalización de progresión numérica (derecha 0-10 -> medio 0-5 -> izquierda).
- **Módulo de Telemetría Visual y Progreso en Vivo**:
  - Radar táctico animado con barrido cónico.
  - Barra de progreso iluminada con lectura de `ReadableStream` (MB descargados y porcentaje exacto).
  - Feedback paso a paso durante descompresión en RAM (`JSZip`) y extracción EXIF de fotos.

### `v0.2.0-alpha` (2026-08-28)
- **Parser Nativo de BiTaVi Android**:
  - Soporte para `rutas.txt`, `puntos.txt`, `marcadores.txt` y `favoritos.txt`.
  - Selector de rutas individual o vista global.
  - Pines tácticos con colores originales y paradas automáticas.
- **Sincronización con Google Drive API v3**.
- **Panel 05 de Análisis Forense de ZIPs** y exportador de diagnósticos.

### `v0.1.0-alpha` (2026-08-28)
- **Visor Cartográfico Inicial**:
  - Soporte de capas 100% libres de OpenStreetMap, Topográfico, Satelital y Táctico Nocturno.
  - Buscador geográfico de localidades (Nominatim OSM) y fijación manual de ubicación con persistencia.

---

## 3. Estructura del Proyecto

```
BiTaVi/
├── docs/                                  # Carpeta de documentación técnica
│   ├── 01_arquitectura_y_versionado.md    # Arquitectura, versiones y changelog
│   ├── 02_visor_cartografico.md           # Funciones del mapa y capas libres
│   ├── 03_formato_datos_gpx_fotos.md      # Especificación GPX y metadatos EXIF
│   ├── 04_integracion_google_drive_android.md # Plan de sincronización Android/Drive
│   ├── 05_analisis_forense_zip.md         # Módulo de inspección forense de backups
│   ├── 06_formato_nativo_bitavi_android.md # Estructura tabular de Android (rutas, puntos)
│   ├── 07_telemetria_progreso_descarga.md # Telemetría de descarga y descompresión
│   ├── 08_plan_trabajo_descarga_zip.md    # Plan de contingencia y fixes de Drive
│   └── 09_analisis_foda_soluciones_y_agentes.md # FODA, soluciones y catálogo de agentes
├── sample-data/                           # Datos de ejemplo para pruebas
│   └── recorrido_tactico_ejemplo.gpx
├── src/
│   ├── components/
│   │   ├── bitavi-native-parser.js        # Parser de rutas, puntos, marcas y favoritos
│   │   ├── drive-connector.js             # Conector Google Identity Services / Drive API
│   │   ├── gpx-parser.js                  # Parseo y renderizado de GPX
│   │   ├── map.js                         # Inicialización Leaflet, capas y GPS
│   │   ├── photo-parser.js                # Extracción EXIF GPS, lightbox y rail
│   │   ├── search.js                      # Buscador geográfico Nominatim OSM
│   │   ├── share-card.js                  # Generador de tarjeta táctica en Canvas
│   │   └── zip-loader.js                  # Descompresión en RAM con JSZip
│   ├── styles/
│   │   ├── main.css                       # Sistema visual táctico (Dark Glassmorphism)
│   │   └── map.css                        # Estilos cartográficos, radar y popups
│   ├── version.js                         # Fuente única de verdad de la versión
│   └── main.js                            # Punto de entrada y eventos
├── index.html                             # Estructura principal e interfaz HUD
└── package.json                           # Dependencias y scripts
```
