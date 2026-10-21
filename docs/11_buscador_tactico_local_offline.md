# BiTaVi PC - Buscador Táctico Local e Híbrido (Offline First)

> **Documento Oficial del Sistema**: `docs/11_buscador_tactico_local_offline.md`  
> **Versión del Sistema**: `v0.4.7-alpha`  
> **Fecha de Emisión**: 2026-10-17  
> **Estado**: Activo / Referencia Arquitectónica

---

## 1. Justificación y Propósito Operativo

En despliegues de campaña, expediciones fuera de pista (*off-grid*) o misiones tácticas en zonas remotas, la conectividad a internet es nula o inestable. Anteriormente, la barra de búsqueda en el HUD dependía exclusivamente de la API Nominatim de OpenStreetMap (`https://nominatim.openstreetmap.org/search`), generando dos vulnerabilidades:
1. **Inoperancia sin red**: Al perder la conexión, el buscador quedaba completamente inerte.
2. **Falta de visibilidad sobre los datos cargados**: No era posible buscar por nombre las rutas, paradas, waypoints ni fotografías cargadas en el mapa.

En la versión **`v0.4.7-alpha`**, el módulo [`src/components/search.js`](../src/components/search.js) evoluciona a un **motor híbrido con prioridad local (Offline First)**.

---

## 2. Arquitectura del Motor de Búsqueda Táctico

### 2.1. Indexación Dinámica en Memoria
Al cargar un paquete de backup (vía ZIP o carpeta con `FolderBackupLoader`), archivos GPX o fotos individuales, el sistema alimenta el catálogo en memoria mediante `indexLocalData()`:

- **Rutas (`rutas.txt` / GPX)**: Indexa nombre de la trayectoria, distancia en kilómetros, fecha de inicio y punto geográfico inicial.
- **Waypoints (`marcadores.txt`)**: Indexa nombres y notas descriptivas junto con sus coordenadas WGS84.
- **Paradas de Descanso (`favoritos.txt`)**: Indexa nombres de lugares, notas, dirección y foto asociada.
- **Fotografías de Campo**: Indexa nombres de archivo, fechas de captura y estado de geolocalización (con GPS / sin fijar).

### 2.2. Normalización Diacrítica y Tokenización
El motor implementa normalización Unicode mediante descomposición canónica (`NFD`):
```javascript
str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
```
Esto permite encontrar coincidencias exactas o parciales independientemente de acentos, tildes (`á`, `é`, `í`, `ó`, `ú`) o variaciones tipográficas en el ingreso táctico rápido.

### 2.3. Ponderación de Relevancia
Los resultados se ordenan algorítmicamente priorizando:
1. Coincidencia al inicio del título (+50 puntos).
2. Coincidencia interna (+30 puntos).
3. Prioridad por tipo de elemento: Rutas (+10), Waypoints (+8), Paradas (+7), Fotos (+5).

### 2.4. Integración Híbrida con Nominatim OSM
- Si hay conectividad (`navigator.onLine !== false`), el buscador dispara en segundo plano una consulta con `AbortController` y un timeout estricto de 2.5 segundos para evitar retrasos en la interfaz.
- Si no hay conexión o el servicio de OpenStreetMap devuelve un error 429 de límite de tasa, el visor entrega los resultados locales en **0 milisegundos**.

---

## 3. Experiencia Visual y Navegación en el Mapa

El menú desplegable (`.search-results-dropdown`) clasifica visualmente los elementos en dos categorías tácticas:

1. **`🛰️ EXPEDICIÓN ACTIVA (OFFLINE)`**:
   - Cada resultado incluye un badge distintivo: `RUTA`, `WAYPOINT`, `PARADA`, `FOTO GPS` o `FOTO`.
   - Al hacer clic en un elemento:
     - **Ruta**: Se encuadra la trayectoria completa mediante `mapInstance.fitBounds()`.
     - **Waypoint / Parada**: La cámara vuela con animación suave a las coordenadas (`flyToCoordinates(lat, lng, 17)`).
     - **Fotografía**: Se vuela a la ubicación GPS y se abre el visor ampliado (Lightbox).
2. **`🌐 CARTOGRAFÍA MUNDIAL (OSM)`**:
   - Muestra ciudades, pueblos y puntos globales con badge `MAPA`, centrando la cartografía base mediante `mapInstance.setManualLocation()`.

---

## 4. Control de Calidad y Pruebas

- **Linter sintáctico**: 13/13 archivos analizados con éxito (`npm run lint`).
- **Compilación de producción**: Bundle generado sin incidencias en `dist/` (`npm run build`).
- **Versionado sincronizado**: `v0.4.7-alpha`.
