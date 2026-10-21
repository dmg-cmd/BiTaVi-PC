# BiTaVi PC - Soporte de Mapas 100% Offline y Caché de Teselas Cartográficas

> **Documento Oficial del Sistema**: `docs/18_soporte_mapas_offline_tile_caching.md`  
> **Versión del Sistema**: `v1.0.4-alpha`  
> **Fecha de Emisión**: 2026-10-21  
> **Estado**: Activo / En Producción  

---

## 1. Justificación y Propósito Operativo en Campaña

En escenarios de despliegue táctico, navegación todoterreno (*off-grid*) o misiones en áreas remotas de montaña y selva, la conectividad satelital y celular suele ser inexistente o intermitente. Sin un mecanismo de almacenamiento local de cartografía:
1. El visor cartográfico queda ciego, mostrando áreas vacías o fondos grises.
2. La carga de bitácoras, rutas y fotografías geolocalizadas pierde su contexto geográfico y topográfico indispensable para la toma de decisiones.

A partir de la versión **`v1.0.4-alpha`**, BiTaVi PC implementa una arquitectura **Offline First** completa mediante un Service Worker táctico y un motor de descarga de cuadrantes geográficos.

---

## 2. Arquitectura del Sistema de Caché de Mapas

El sistema se compone de dos módulos desacoplados:

### 2.1. Service Worker Táctico (`public/sw.js`)
Intercepta las peticiones de red hacia los servidores cartográficos (OpenStreetMap, OpenTopoMap, Esri World Imagery, CyclOSM) bajo la estrategia **Cache-First**:
- **Búsqueda Inmediata en Caché**: Si la tesela `{z}/{x}/{y}` ya se encuentra en `bitavi-tiles-v1`, se entrega al instante en 0 milisegundos desde el almacenamiento local del equipo.
- **Auto-aprendizaje en Línea**: Cuando hay conexión disponible, las teselas solicitadas por el usuario al navegar por el mapa se descargan y se guardan automáticamente en la caché local para futuras sesiones sin red.
- **Tolerancia a Fallos sin Red**: Si la computadora se encuentra offline y una tesela específica no fue descargada previamente, el Service Worker retorna una respuesta de imagen PNG transparente de $1\times 1$ píxel (`X-BiTaVi-Fallback: offline`), evitando errores en consola o interrupciones en la renderización de Leaflet.

### 2.2. Administrador de Cuadrantes Cartográficos (`src/components/offline-map-manager.js`)
Permite al operador descargar deliberadamente un cuadrante geográfico completo antes de salir a campaña:

#### A. Proyección Matemática Web Mercator ($EPSG:3857$)
Para traducir los límites geográficos de latitud y longitud al sistema de coordenadas de teselas $(X, Y)$ en cada nivel de zoom $Z$, se aplica la proyección estándar:

$$X = \left\lfloor \frac{\text{lng} + 180}{360} \cdot 2^Z \right\rfloor$$

$$Y = \left\lfloor \left(1 - \frac{\ln\left(\tan(\text{lat} \cdot \frac{\pi}{180}) + \sec(\text{lat} \cdot \frac{\pi}{180})\right)}{\pi}\right) \cdot 2^{Z-1} \right\rfloor$$

#### B. Pool de Descarga Concurrente Controlada
La descarga masiva de cuadrantes se ejecuta mediante un grupo de trabajadores asíncronos concurrentes (máximo 6 peticiones simultáneas) para no sobrecargar los servidores cartográficos ni saturar el ancho de banda del equipo.

#### C. Control y Purgado de Almacenamiento
El operador puede consultar en cualquier momento la cantidad exacta de teselas almacenadas en caché y el espacio aproximado ocupado en disco (`getCacheStats`), así como purgar por completo el almacenamiento cuando finalice una misión (`clearTileCache`).

---

## 3. Elementos en la Interfaz de Usuario

En la sección **01 CAPAS CARTOGRÁFICAS LIBRES** del panel lateral se ubica el panel táctico de mapas offline:
1. **Monitor de Conectividad**:
   - `🛰️ MODO EN LÍNEA (ONLINE)`: Punto verde activo.
   - `📡 MODO CAMPO (OFFLINE)`: Punto ámbar de alerta táctica con notificación en la barra de estado inferior.
2. **Contador de Almacenamiento**: Muestra el número total de teselas en memoria y el tamaño estimado en megabytes.
3. **Botón `[📥 Descargar Cuadrante]`**: Descarga en segundo plano todas las teselas del área actualmente visible en el mapa en múltiples niveles de zoom para navegación táctica en campo.
4. **Botón `[🗑️ Purgar]`**: Limpieza completa de la caché para liberar espacio de almacenamiento.
