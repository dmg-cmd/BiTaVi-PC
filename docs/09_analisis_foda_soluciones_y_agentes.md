# BiTaVi PC - Análisis FODA, Plan de Soluciones y Arquitectura de Agentes

> **Documento Oficial del Sistema**: `docs/09_analisis_foda_soluciones_y_agentes.md`  
**Versión del Sistema**: `v0.4.7-alpha`  
**Fecha de Emisión**: 2026-10-17  
**Estado**: Activo / Referencia Arquitectónica


## 1. Introducción y Contexto del Proyecto

**BiTaVi (Bitácora Táctica de Viaje)** es una plataforma de software diseñada para la visualización, reconstrucción forense y análisis táctico de expediciones terrestres, misiones de campo y travesías. Compuesta por una aplicación móvil nativa para Android y un visor avanzado para PC en entorno web/desktop, el sistema opera con un enfoque estricto en la **soberanía de datos, privacidad operativa y cero dependencias de servicios de pago**.

El visor para PC procesa recorridos en formato estándar GPX y paquetes de backup nativos de BiTaVi Android (`backup\_YYYYMMDD\_HHMM.zip`), correlacionando millones de puntos geográficos (`puntos.txt`), registros de trayectorias (`rutas.txt`), waypoints destacados (`marcadores.txt`), paradas de descanso (`favoritos.txt`) y fotografías de campo con o sin metadatos EXIF GPS.

El presente documento expone una auditoría técnica profunda y estratégica bajo la metodología **FODA (Fortalezas, Oportunidades, Debilidades y Amenazas)**, establece un **Plan de Acción detallado para solventar los problemas detectados** y define la **Estructura Funcional de Agentes** que operan sobre el ciclo de vida del proyecto.


## 2. Matriz de Análisis FODA (SWOT)

```
===================================================================================================  
                                      MATRIZ FODA - BiTaVi PC  
===================================================================================================  
              ORIGEN INTERNO                                      ORIGEN EXTERNO  
---------------------------------------------------------------------------------------------------  
 \[F\] FORTALEZAS                                      \[O\] OPORTUNIDADES  
 • Procesamiento 100% en cliente (Privacidad).        • Nicho táctico y off-grid (rescate, 4x4, montaña).  
 • Infraestructura cartográfica libre (Sin API Keys).• Evolución a PWA con capacidades 100% offline.  
 • Doble compatibilidad: GPX universal y nativo.    • Empaquetado como app nativa (Electron / Tauri).  
 • Geolocalización forense de fotos multidimensional.• Integración con nubes privadas (Nextcloud/WebDAV).  
 • HUD táctico militar inmersivo (Dark Glassmorphism).• Exportación a formatos interoperables (KML/GeoJSON).  
 • Base de código ligera (Vanilla JS ES Modules).    • Creciente demanda de herramientas sin telemetría.  
---------------------------------------------------------------------------------------------------  
 \[D\] DEBILIDADES                                     \[A\] AMENAZAS  
 • Cuellos de botella en memoria RAM (hilo único).   • Políticas de rate-limiting de OSM / OpenTopoMap.  
 • Complejidad de configuración en Google Drive.     • Restricciones de CORS en navegadores modernos.  
 • Desincronización detectada en el versionado.     • Cambios en Google Identity Services (GIS OAuth).  
 • Carencia de tests automatizados (Unit/E2E).       • Competencia de plataformas masivas comerciales.  
 • Dependencia de red para búsqueda (Nominatim).     • Límites de memoria en hardware modesto de campaña.  
 • Falta de persistencia local de sesiones (recarga).• Falta de conectividad en zonas remotas de despliegue.  
===================================================================================================
```


### 2.1. Fortalezas (Factores Internos Positivos)

1. **Privacidad y Soberanía Absoluta de la Información (Local First)**:

   - Todo el análisis, descompresión de ZIPs, parseo de coordenadas y lectura de fotografías se ejecuta **exclusivamente en la memoria RAM del navegador del usuario**. Ninguna coordenada, foto o nota es enviada a servidores de terceros, lo que resulta crítico para misiones tácticas, operativas o privadas.

2. **Infraestructura de Cartografía Libre y Gratuita**:

   - Integración nativa con capas abiertas y públicas: OpenStreetMap Estándar, Topográfico (OpenTopoMap), Satelital de alta resolución (Esri World Imagery) y Senderismo (CyclOSM), sumado a un modo Táctico Oscuro generado mediante filtros matemáticos CSS sobre OSM. Esto elimina costos recurrentes de licencias (como Google Maps o Mapbox).

3. **Compatibilidad Híbrida de Ingestión**:

   - Soporte para el formato estándar de la industria (`.gpx` con cálculo Haversine de distancias y perfiles de altimetría) y decodificación completa del formato propietario tabular de BiTaVi Android (`rutas.txt`, `puntos.txt`, `marcadores.txt`, `favoritos.txt` delimitados por `|`), permitiendo aislar o combinar trayectorias simultáneas.

4. **Motor Forense de Geolocalización Fotográfica**:

   - Algoritmo en 4 niveles para situar imágenes en el mapa:

     - *Nivel 1*: Coordenadas GPS directas embebidas en EXIF (`exifr`).

     - *Nivel 2*: Correlación cruzada de nombres de archivo con paradas registradas en `favoritos.txt`.

     - *Nivel 3*: Coincidencia temporal cronológica (timestamp de la foto cruzado con el registro más cercano de `puntos.txt`).

     - *Nivel 4*: Asignación manual asistida arrastrando fotos directamente sobre el mapa o mediante el botón "Fijar en el Mapa".

5. **Experiencia de Usuario Táctica Inmersiva (Tactical HUD)**:

   - Interfaz con diseño militar *Dark Glassmorphism*, telemetría continua de coordenadas y precisión WGS84, radar interactivo pulsante, visor modal tipo lightbox 96% viewport, vista conectada de fotos 16:9 con cables reactivos dinámicos al fondo del mapa y generador de tarjetas tácticas compartibles en `\<canvas\>`.

6. **Arquitectura Ligera y Modular**:

   - Construcción con JavaScript nativo moderno (ES Modules) y empaquetador Vite, lo que mantiene el tiempo de compilación y carga en milisegundos, sin el peso o la complejidad de frameworks pesados.


### 2.2. Oportunidades (Factores Externos Positivos)

1. **Demanda en Sectores Críticos y de Aventura**:

   - Organizaciones de búsqueda y rescate (SAR), brigadas de bomberos forestales, fuerzas de seguridad, clubes de expedición 4x4, montañismo y cicloturismo demandan software táctico que funcione sin suscripciones abusivas ni dependencia de plataformas propietarias.

2. **Transformación a PWA (Progressive Web App) y Modo Offline Total**:

   - Implementando Service Workers y almacenamiento local de teselas (Cache API / IndexedDB), BiTaVi puede convertirse en una herramienta 100% funcional en laptops en medio de la selva, desierto o montaña, sin conexión a internet.

3. **Empaquetado de Escritorio Autónomo (Electron / Tauri)**:

   - Crear un ejecutable instalable para Windows, Linux y macOS que permita asociar directamente la extensión `.bitavi` o `.zip` y leer carpetas locales sin restricciones de sandbox de navegador.

4. **Interoperabilidad y Exportación Forense**:

   - Oportunidad de agregar exportadores a formato KML/KMZ (Google Earth), GeoJSON (QGIS/ArcGIS), GPX limpio unificado y reportes de misión en PDF con estadísticas de viaje (velocidad media, desniveles, paradas e índice de fotos).

5. **Integración con Almacenamiento Auto-Gestionado (Self-Hosted)**:

   - Ampliar la conectividad de nubes más allá de Google Drive, incluyendo WebDAV, Nextcloud y carpetas de red compartidas (SMB), reforzando el perfil de privacidad y seguridad corporativa.


### 2.3. Debilidades (Factores Internos Limitantes)

1. **Riesgo de Saturación de Memoria (Single-Thread UI Blocking)**:

   - La descompresión de paquetes ZIP pesados (\>300 MB con docenas de imágenes en 4K y millones de registros en `puntos.txt`) se efectúa en el hilo principal del DOM. Esto puede generar congelamiento temporal de la interfaz gráfica o excepciones de *Out of Memory* en navegadores convencionales.

2. **Complejidad de Autenticación en Google Drive para Usuarios Finales**:

   - La integración con Google Drive API v3 requiere que el usuario cree un proyecto en Google Cloud Console, configure la pantalla de consentimiento OAuth y pegue manualmente un `client\_id`. Para usuarios no técnicos, esta barrera de entrada resulta compleja.

3. **Inconsistencia Detectada en la Sincronización de Versiones**:

   - En la auditoría del proyecto se evidenció que `package.json` quedó rezagado en la versión `0.3.9-alpha`, mientras que `src/version.js`, `index.html` y `docs/01\_arquitectura\_y\_versionado.md` registraban la versión `0.4.2-alpha`, incumpliendo temporalmente la regla estricta de sincronización unificada.

4. **Carencia de Suite de Pruebas Automatizadas**:

   - El proyecto cuenta únicamente con `scripts/check.js` (un linter sintáctico básico `node --check`). No existen pruebas unitarias automáticas para verificar la robustez de los parsers ante archivos corruptos ni pruebas de integración visual (E2E).

5. **Dependencia de Servicios Externos para Búsqueda**:

   - La barra de búsqueda de localidades depende exclusivamente de la API Nominatim de OpenStreetMap. Si la máquina no tiene acceso a internet o la API responde con error de límite de tasa (*rate limit* 429), la búsqueda queda inhabilitada y no hay fallback a un índice local.

6. **Volatilidad de la Sesión de Trabajo (Sin Persistencia de Datos)**:

   - Al recargar la página (`F5`), el estado cargado de rutas, fotos y telemetría se vacía. El usuario debe volver a cargar o arrastrar el archivo ZIP cada vez.

7. **Inestabilidad del Pipeline de Compilación en Windows (Vite 8 / Rolldown)**:

   - En entornos Windows se detectó que `npm run build` falla debido a que `npm` omite la instalación del binario nativo `@rolldown/binding-win32-x64-msvc` (bug conocido de dependencias opcionales en npm). Esto imposibilita generar el bundle `dist/` a menos que se fuerce la instalación del paquete binario.


### 2.4. Amenazas (Factores Externos Desfavorables)

1. **Políticas y Restricciones de Servidores de Teselas Abiertas**:

   - Servicios como OpenStreetMap y OpenTopoMap aplican políticas estrictas de uso justo (*Tile Usage Policy*). Un tráfico elevado desde una misma dirección IP o la ausencia de cabeceras de usuario válidas puede derivar en bloqueos temporales de tiles cartográficas.

2. **Cambios en las Políticas de Seguridad de Navegadores y OAuth**:

   - La deprecación gradual de cookies de terceros y el endurecimiento de directivas CORS y COOP/COEP por parte de Chromium pueden comprometer el flujo de Google Identity Services (GIS) en entornos locales (`http://localhost` o `file://`).

3. **Obsolescencia o Incompatibilidad en Dispositivos de Campo**:

   - Equipos de computación antiguos o tablets rugerizadas con memoria RAM limitada (2 GB - 4 GB) pueden experimentar fallas al manipular simultáneamente mapas interactivos Leaflet con capas densas y decenas de imágenes de alta resolución.

4. **Competencia con Suites Comerciales Consolidadas**:

   - Aplicaciones masivas (Strava, Wikiloc, Garmin BaseCamp, Gaia GPS) poseen ecosistemas integrados y presupuestos masivos, por lo que BiTaVi debe enfatizar su nicho diferenciador: **táctico, forense, offline y 100% privado**.


## 3. Plan de Acción: Solución de Problemas Identificados

Para neutralizar las debilidades y blindar al sistema frente a las amenazas, se establece la siguiente matriz de soluciones técnicas estructuradas:

| Problema Identificado | Causa Raíz | Solución Técnica a Implementar | Complejidad | Prioridad |
| - | - | - | - | - |
| **1. Bloqueo de UI con ZIPs masivos** | Procesamiento de `JSZip` y parsing en el hilo principal del DOM. | Migrar la extracción ZIP y parseo de `puntos.txt` a un **Web Worker** dedicado. Procesar coordenadas en batches de 5.000 puntos. | Media | **Alta** |
| **2. Desincronización de Versión** | Actualización manual propensa al olvido en `package.json`. | **Sincronizar de inmediato a `0.4.3-alpha`** en todos los archivos y crear script de versionado unificado (`npm run version:bump`). | Baja | **Inmediata** |
| **3. Complejidad de Google Drive** | Dependencia obligatoria de OAuth y Client ID de Google Cloud. | **Resuelto en v0.4.6-alpha**: Módulo `FolderBackupLoader` con `FileSystem Access API` (`showDirectoryPicker`) y fallback HTML5 para leer carpetas sincronizadas de Google Drive o locales sin API keys. | Media | **Resuelto** |
| **4. Falla de build/ejecución cruzada (Win $\leftrightarrow$ Linux)** | Conflicto de binarios nativos en entornos compartidos y bug de npm con Rolldown. | **Resuelto en v0.4.5-alpha**: Bindings duales en `optionalDependencies`, blindaje de lanzadores con auto-reparación y servidor de contingencia nativo `scripts/serve.js`. | Baja | **Resuelto** |
| **5. Pérdida de datos al recargar** | Ausencia de capa de persistencia para datos de sesión. | Incorporar **IndexedDB** para almacenar la última bitácora/sesión cargada (rutas, marcadores y miniaturas en blobs), con botón de "Restaurar última sesión". | Media | **Media** |
| **6. Cero tests automatizados** | Falta de framework de pruebas en el flujo de desarrollo. | Integrar **Vitest** con tests unitarios para `bitavi-native-parser.js`, `gpx-parser.js` y `zip-loader.js`, utilizando los archivos de `sample-data/`. | Baja | **Media** |
| **7. Búsqueda no operativa offline** | Dependencia absoluta de Nominatim OSM vía internet. | **Resuelto en v0.4.7-alpha**: Buscador táctico híbrido en `GeoSearch` con indexación instantánea de rutas, paradas, waypoints y fotos con tolerancia a fallos de red. | Baja | **Resuelto** |
| **8. Dependencia de red para mapas** | Carga de teselas HTTP en vivo. | Incorporar soporte de **Service Worker con caché LRU de teselas** y permitir la importación de archivos de mapas offline compactos (`.mbtiles` o GeoJSON vectorial). | Alta | **Estratégica** |



### 3.1. Detalle de Implementación de las Soluciones Clave

#### A. Desacoplamiento a Web Workers (Rendimiento Extremo)

- **Diseño**: Crear `src/workers/zip-parser.worker.js`.

- **Funcionamiento**: La lectura del blob del archivo ZIP se transfiere mediante `postMessage(zipArrayBuffer, \[zipArrayBuffer\])` sin clonación de memoria (*transferable objects*). El Worker ejecuta `JSZip`, decodifica los textos `rutas.txt` y `puntos.txt`, arma los arrays numéricos de coordenadas y retorna al hilo principal únicamente la estructura matemática lista para dibujar.

- **Resultado**: La interfaz táctica permanece a 60 FPS, el radar no sufre tirones y el usuario puede cancelar la operación en cualquier instante.

#### B. Persistencia Local Táctica con IndexedDB

- **Diseño**: Módulo `src/components/storage.js` utilizando la base de datos `BiTaVi\_Storage\_v1`.

- **Funcionamiento**: Guarda las geometrías de las rutas, los metadatos y las miniaturas comprimidas (WebP). Al volver a abrir la aplicación, un indicador en el HUD muestra: `\[Sesión previa detectada: Ruta 57 - 2026-07-20\] \[RESTAURAR\]`.

#### C. Integración Nativa con FileSystem Access API

- **Diseño**: Botón secundario en el panel de carga: `"ABRIR CARPETA DE BACKUP (LOCAL/DRIVE)"`.

- **Funcionamiento**: Mediante `window.showDirectoryPicker()` el usuario selecciona la carpeta donde Google Drive para PC sincroniza sus archivos en su disco duro. La aplicación lee los archivos directamente del disco sin necesidad de empaquetar en ZIP ni de tokens de red.


## 4. Descripción de los Agentes Involucrados en el Proyecto

El desarrollo, mantenimiento y evolución de BiTaVi se estructura mediante un **modelo de agentes de software especializados**. Cada agente asume un rol delimitado, cuenta con directivas de conducta precisas, responsabilidades técnicas y un protocolo de coordinación unificado.

```
┌─────────────────────────────────────────────────────────────────────────────────┐  
│              AGENTE 01: ORQUESTADOR Y ARQUITECTO DE SISTEMA                    │  
│             (Supervisión General, Reglas X.Y.Z, Integridad Global)             │  
└───────┬─────────────────┬─────────────────┬─────────────────┬───────────────────┘  
        │                 │                 │                 │  
┌───────▼────────┐ ┌──────▼────────┐ ┌──────▼────────┐ ┌──────▼────────┐ ┌──────▼────────┐  
│  AGENTE 02:    │ │  AGENTE 03:   │ │  AGENTE 04:   │ │  AGENTE 05:   │ │  AGENTE 06:   │  
│  CARTOGRAFÍA Y │ │  INGESTIÓN Y  │ │  FORENSE FOTO │ │  NUBE, I/O Y  │ │  EXPERIENCIA  │  
│  GEOMÁTICA     │ │  PARSER NAT.  │ │  Y EXIF       │ │  STREAMING    │ │  HUD TÁCTICO  │  
└───────┬────────┘ └──────┬────────┘ └──────┬────────┘ └──────┬────────┘ └──────┬────────┘  
        │                 │                 │                 │                 │  
        └─────────────────┴─────────────────┼─────────────────┴─────────────────┘  
                                            │  
                                  ┌─────────▼────────┐  
                                  │   AGENTE 07:     │  
                                  │   CALIDAD, QA Y  │  
                                  │   DOCUMENTACIÓN  │  
                                  └──────────────────┘
```


### Agente 01: Orquestador y Arquitecto Central (Core Orchestrator & Systems Agent)

- **Misión**: Garantizar la coherencia arquitectónica, dirigir la evolución del sistema y hacer cumplir sin excepciones las directivas globales del proyecto (idioma español neutro y versionado numérico estricto).

- **Responsabilidades**:

  - Controlar y unificar el incremento de versión `X.Y.Z` (derecha 0-10, medio 0-5, izquierda mayor).

  - Coordinar la integración de nuevos módulos en `src/main.js` y validar que ningún cambio rompa componentes preexistentes.

  - Asegurar la integridad de archivos antes de cualquier operación destructiva o de reemplazo.

- **Archivos bajo su custodia**: `AGENTS.md`, `.agents/rules/\*`, `package.json`, `src/version.js`, `src/main.js`.


### Agente 02: Ingeniero Cartográfico y Geomática (Carto-Spatial & Geomatics Agent)

- **Misión**: Gestionar el visor de mapas, proyecciones geográficas, renderizado de geometrías vectoriales y cálculos de telemetría de navegación.

- **Responsabilidades**:

  - Administrar el ciclo de vida de Leaflet, capas base libres y filtros visuales (modo nocturno/táctico).

  - Implementar algoritmos de cálculo geodésico (distancia Haversine, cotas de elevación mínima/máxima, cálculo de rumbos).

  - Gestionar las capas vectoriales independientes (`routeLayers`), flechas direccionales de trayectoria y encuadres óptimos (`fitBounds`).

  - Responder a eventos de movimiento de cámara, rastreo del cursor y radar de telemetría GPS.

- **Archivos bajo su custodia**: `src/components/map.js`, `src/styles/map.css`, `docs/02\_visor\_cartografico.md`.


### Agente 03: Especialista en Ingestión y Parsers Nativos (Native Ingestion & Telemetry Agent)

- **Misión**: Decodificar, normalizar y transformar los datos de las rutas, tanto en estándares abiertos de la industria como en el formato tabular propietario de Android.

- **Responsabilidades**:

  - Interpretar y procesar archivos `.gpx` (tracks, segmentos y waypoints).

  - Parsear la arquitectura tabular delimitada por `|` de BiTaVi Android: `rutas.txt`, `puntos.txt`, `marcadores.txt` y `favoritos.txt`.

  - Agrupar puntos masivos por identificador de ruta (`id\_ruta`), extraer marcas temporales, calcular velocidades instantáneas y promedios.

  - Proveer filtros dinámicos de visibilidad (aislar ruta específica vs. visualizar todas las rutas registradas).

- **Archivos bajo su custodia**: `src/components/bitavi-native-parser.js`, `src/components/gpx-parser.js`, `docs/03\_formato\_datos\_gpx\_fotos.md`, `docs/06\_formato\_nativo\_bitavi\_android.md`.


### Agente 04: Analista Forense Multimedia y EXIF (Photographic Forensics Agent)

- **Misión**: Extraer, verificar y geolocalizar el material fotográfico de las expediciones, garantizando su correcta vinculación espacial y visual.

- **Responsabilidades**:

  - Analizar metadatos EXIF con `exifr` (`GPSLatitude`, `GPSLongitude`, `GPSAltitude`, fecha de captura, modelo de dispositivo).

  - Ejecutar los mecanismos de correlación temporal y espacial con `favoritos.txt` y `puntos.txt` para fotos sin coordenadas GPS nativas.

  - Proveer la interfaz de geolocalización manual táctica (arrastrar fotos sobre el mapa, recolocación interactiva de marcadores).

  - Administrar el rail interactivo de miniaturas 16:9, el cálculo dinámico de líneas conectoras SVG adaptadas al contraste de la capa base y el visor lightbox ampliado al 96% de pantalla.

- **Archivos bajo su custodia**: `src/components/photo-parser.js`, `docs/05\_analisis\_forense\_zip.md`.


### Agente 05: Ingeniero de Conectividad Cloud y Procesamiento I/O (Cloud & Pipeline Agent)

- **Misión**: Administrar los canales de entrada de datos, la comunicación con servicios en la nube y el desempaquetado de archivos pesados con tolerancia a fallas.

- **Responsabilidades**:

  - Gestionar el ciclo de vida de autenticación OAuth 2.0 y tokens de acceso con Google Identity Services y Google Drive API v3.

  - Administrar la descarga en flujo progresivo (`ReadableStream`) emitiendo métricas precisas de telemetría (MB transferidos, tiempo estimado y porcentaje).

  - Descomprimir paquetes `.zip` en memoria mediante `JSZip` con tolerancia a elementos corruptos o incompletos.

  - Controlar cancelaciones mediante `AbortController` y timeouts de seguridad para evitar bloqueos por peticiones colgadas.

- **Archivos bajo su custodia**: `src/components/drive-connector.js`, `src/components/zip-loader.js`, `docs/04\_integracion\_google\_drive\_android.md`, `docs/07\_telemetria\_progreso\_descarga.md`, `docs/08\_plan\_trabajo\_descarga\_zip.md`.


### Agente 06: Diseñador UI/UX Táctico e Interactividad (Tactical HUD & Interface Agent)

- **Misión**: Diseñar, pulir y mantener la experiencia visual militar táctica, ergonomía del usuario e interacción gráfica fluida.

- **Responsabilidades**:

  - Diseñar el sistema visual *Dark Glassmorphism* con acentos de color cian `\#00f0ff`, verde táctico y ámbar de advertencia.

  - Renderizar tarjetas tácticas compartibles en `\<canvas\>` de alta resolución para redes sociales o exportación PNG/portapapeles (`share-card.js`).

  - Desarrollar microinteracciones, animaciones de radar táctico, barras de progreso de descarga y transiciones fluidas de paneles colapsables.

  - Mantener la accesibilidad, legibilidad de tipografías monospace (`JetBrains Mono`) y distribución del espacio en pantalla.

- **Archivos bajo su custodia**: `src/styles/main.css`, `src/components/share-card.js`, `src/components/search.js`, `index.html`.


### Agente 07: Guardián de Calidad, Versionado y Documentación (QA, Versioning & Docs Agent)

- **Misión**: Velar por el cumplimiento de estándares de código, verificación estática de sintaxis, documentación técnica exhaustiva y coherencia en las versiones del software.

- **Responsabilidades**:

  - Ejecutar y mantener los scripts de verificación sintáctica (`scripts/check.js`).

  - Auditar la consistencia entre `package.json`, `src/version.js`, `index.html` y los registros de cambio en `docs/01\_arquitectura\_y\_versionado.md`.

  - Redactar, actualizar y versionar toda la documentación técnica dentro del directorio `docs/` en estricto español neutro.

  - Proponer mejoras continuas en la estructura de testing y cobertura de casos límite.

- **Archivos bajo su custodia**: `scripts/check.js`, `docs/\*`, `AGENTS.md`.


### 4.1. Matriz RACI de Responsabilidades por Módulo

| Módulo / Funcionalidad | Agente 01 (Orquestador) | Agente 02 (Carto) | Agente 03 (Parsers) | Agente 04 (Forense) | Agente 05 (Cloud/IO) | Agente 06 (UI/HUD) | Agente 07 (QA/Docs) |
| - | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| **Visor Cartográfico y Capas** | I | **A / R** | C | C | I | C | I |
| **Parseo GPX y Formato Nativo** | I | C | **A / R** | C | C | I | I |
| **Geolocalización EXIF y Fotos** | I | C | C | **A / R** | I | C | I |
| **Conexión GDrive y JSZip** | I | I | I | I | **A / R** | C | I |
| **Sistema Visual HUD y CSS** | I | C | I | I | I | **A / R** | I |
| **Control de Versión X.Y.Z** | **A / R** | I | I | I | I | I | **A / R** |
| **Documentación Técnica** | C | C | C | C | C | C | **A / R** |


*Leyenda*: **R** = Responsable de la ejecución; **A** = Aprobador / Dueño; **C** = Consultado; **I** = Informado.


## 5. Hoja de Ruta y Próximos Pasos Recomendados

1. **Inmediato (`v0.4.3-alpha`)**:

   - Sincronización completa de la versión en `package.json`, `src/version.js`, `index.html` y `docs/01\_arquitectura\_y\_versionado.md`.

   - Adición oficial del presente documento de análisis FODA y descripción de agentes a la colección técnica del sistema.

2. **Corto Plazo (`v0.4.4` a `v0.4.7`)**:

   - Implementación del soporte para `FileSystem Access API` en navegadores compatibles para lectura de carpetas de backup sin necesidad de compresión ZIP ni claves de Google Cloud.

   - Indexación táctica local en el buscador para localizar waypoints y fotos sin requerir conexión a internet.

   - Creación de la suite inicial de pruebas unitarias automatizadas con Vitest para parsers de datos nativos.

3. **Mediano Plazo (`v0.5.0` a `v1.0.0`)**:

   - Desacoplamiento de la descompresión ZIP y procesamiento de coordenadas a un Web Worker dedicado.

   - Almacenamiento local estructurado en IndexedDB para persistencia de sesión entre recargas de página.

   - Empaquetado como aplicación de escritorio nativa mediante Tauri o Electron para despliegues tácticos 100% desconectados de red.

