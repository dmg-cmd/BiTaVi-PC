# 📋 BiTaVi PC - Hoja de Ruta y Tareas Pendientes

> **Documento Oficial de Seguimiento y Próximas Fases**  
> **Versión Actual del Sistema**: `v1.0.9-alpha`  
> **Última Actualización**: 21 de octubre de 2026  
> **Plataforma**: Aplicación Web / Desktop para PC (Windows y Linux)

---

## 1. Estado Actual del Sistema (Lo Completado Recientemente)

Se resolvieron, verificaron y documentaron con éxito el 100% de las funcionalidades tácticas requeridas en la hoja de ruta inicial:

- ✅ **Empaquetado de Escritorio Autónomo con Tauri v2 (`v1.0.5-alpha`)**:
  - Backend nativo Rust ultra-eficiente en `src-tauri/` con mínima huella de memoria RAM.
  - Scripts de compilación y ejecución nativa: `npm run tauri:dev` y `npm run tauri:build`.
  - Asociaciones de archivo en el sistema operativo para formatos de misión: `.gpx`, `.kml`, `.kmz` y `.zip`.
  - Documentación técnica completa en `docs/19_empaquetado_escritorio_tauri.md`.
- ✅ **Soporte de Mapas 100% Offline y Caché de Teselas (`v1.0.4-alpha`)**:
  - Service Worker táctico con estrategia Cache-First (`public/sw.js`) para teselas cartográficas de OpenStreetMap, OpenTopoMap, Esri y CyclOSM.
  - Administrador de mapas offline (`src/components/offline-map-manager.js`) con cálculo matemático Web Mercator ($EPSG:3857$).
  - Descarga concurrente controlada de cuadrantes cartográficos visibles con telemetría en tiempo real.
  - Subpanel interactivo en el HUD con monitor de conectividad (`🛰️ EN LÍNEA` / `📡 MODO CAMPO OFFLINE`), contador de teselas y purga de caché.
- ✅ **Suite de Pruebas Unitarias Automatizadas con Vitest (`v1.0.3-alpha`)**:
  - Configuración de Vitest con entorno `happy-dom` (`vitest.config.js`).
  - 19 pruebas unitarias automatizadas en 6 suites: trigonometría esférica de rumbo y Haversine (`playback.js`), conversión cromática a `aabbggrr` y generador KML 2.2 (`kml-kmz-exporter.js`), saneamiento de nombres de archivo y GPX 1.1 (`gpx-parser.js`), Magic Bytes `PK` y filtro de archivos basura (`folder-loader.js`), normalización y búsqueda insensible a tildes (`search.js`), y deserialización de estructuras Android (`bitavi-native-parser.js`).
  - Scripts `npm test` y `npm run test:watch`, con integración en GitHub Actions.
- ✅ **Exportación a Formatos KML y KMZ para Google Earth 3D (`v1.0.2-alpha`)**:
  - Generador estándar KML 2.2 XML (`src/components/kml-kmz-exporter.js`) con teselación (`<tessellate>1</tessellate>`) y adaptación tridimensional a relieve.
  - Conversión cromática exacta entre hexadecimal CSS y el estándar inverso KML `aabbggrr`.
  - Empaquetador masivo KMZ autocontenido con fotos incrustadas en `files/` y popups HTML interactivos.
  - Botones en panel de rutas (`[🌍 KML 3D]`, `[🌐 KMZ 3D (con Fotos)]`) y en galería fotográfica (`[🌐 Exportar Fotos a KMZ 3D]`).
- ✅ **Modo Reproductor y Simulador Táctico de Viaje (`v1.0.1-alpha`)**:
  - Motor de animación desacoplado `RoutePlaybackSimulator` (`src/components/playback.js`) a 60 FPS con `requestAnimationFrame`.
  - Marcador móvil vectorial con rotación por rumbo dinámico esférico (*bearing* de 0° a 360°) y traducción a puntos cardinales.
  - Barra de control HUD (`#playback-bar`) con Play, Pause, Reinicio, línea de tiempo deslizante (*timeline slider*) y selector de velocidad `1x` a `50x`.
  - Seguimiento de cámara opcional y telemetría en tiempo real (velocidad, altitud, distancia acumulada, hora).
  - Botón de reproducción rápida en cada fila del panel lateral de rutas.
- ✅ **Desacoplamiento de Descompresión ZIP Masiva a Web Worker (`v1.0.0-alpha`)**:
  - Web Worker dedicado (`src/workers/zip-worker.js`) para procesar `JSZip` fuera del hilo principal.
  - Transferencia Zero-Copy (`transferable ArrayBuffers`) de fotografías para no saturar memoria RAM.
  - Mantenimiento estricto de 60 FPS en el visor cartográfico y HUD interactivo durante la carga de backups pesados.
  - Fallback automático al hilo principal en navegadores sin soporte de Workers.
- ✅ **Empaquetado Multiplataforma y Repositorio Privado (`v0.5.10-alpha`)**:
  - Script automatizado de distribución para Windows y Linux (`npm run package`).
  - Flujo de GitHub Actions (`.github/workflows/build.yml`) para compilaciones en la nube.
  - Blindaje estricto de `.gitignore` excluyendo backups personales y celulares.
- ✅ **Blindaje del Script de Inicio de Windows (`v0.5.4-alpha`)**:
  - Corrección de sintaxis batch para `cmd.exe` (eliminación de paréntesis conflictivos y adopción de saltos seguros con `goto`).
  - Detección preventiva de Node.js en el sistema y apertura nativa de navegador en Vite (`--open`).
- ✅ **Gestión Incremental de Rutas y Exportación Separada (`v0.5.5-alpha`)**:
  - Botón `[➕ Agregar Ruta]` para sumar archivos GPX, KML y TXT sin sobrescribir rutas existentes.
  - Renombrado interactivo in situ de rutas con nombres personalizados (`✏️`).
  - Guardado y descarga individual o masiva de rutas seleccionadas en archivos `.GPX` independientes o en `.ZIP` estructurado.
- ✅ **Controlador Táctico de Rueda del Mouse (`v0.5.6-alpha`)**:
  - Paso unitario estricto de 1 nivel por muesca de rueda (fin del salto descontrolado al zoom máximo).
  - Filtro anti-rebote y neutralización de inercia de Windows (`wheelCooldown: 160 ms`).
- ✅ **Herramienta Universal de Reubicación de Fotos (`v0.5.7-alpha`)**:
  - Botón permanente `[📍 Reubicar en el mapa]` en el visor modal para mover o corregir con un clic fotos con coordenadas inexactas.
  - Persistencia transaccional de las nuevas coordenadas en IndexedDB.
- ✅ **Reactivación Inmediata de Casillas de Verificación de Rutas (`v0.5.8-alpha`)**:
  - Sincronización directa entre las casillas de verificación de la lista y la visibilidad en Leaflet (mostrar/ocultar instantáneo).

---

## 2. Próximas Mejoras y Evolución Continua (Backlog Opcional)
- **Sincronización P2P / LAN**: Compartir rutas en tiempo real entre instancias de BiTaVi en una misma red local táctica sin Internet.
- **Gráficos de Perfil de Elevación Interactivo**: Perfil altimétrico SVG/Canvas interactivo sincronizado con el cursor sobre la polilínea del mapa.
- **Capas Vectoriales Personalizadas**: Soporte para cargar capas de curvas de nivel y polígonos GeoJSON de áreas protegidas o zonas de interés.

---

## 3. Reglas Inquebrantables de Desarrollo
1. **Idioma Estricto**: Toda comunicación, pensamientos internos, comentarios de código y documentación deben mantenerse en **español neutro**.
2. **Sistema Estricto de Versionado Numérico (`X.Y.Z`)**:
   - `Z`: +1 con cada cambio (0 a 10).
   - `Y`: +1 cuando Z llega a 10 (0 a 5).
   - `X`: +1 cuando Y llega a 5 (ej. `1.0.0`).
   - Sincronización obligatoria en `package.json`, `src/version.js`, `index.html` y `docs/01_arquitectura_y_versionado.md`.
3. **Documentación**: Todos los manuales y especificaciones técnicas deben mantenerse actualizados en el directorio `docs/`.
