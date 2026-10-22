# BiTaVi PC - Especificación del Formato Nativo de Backup Android

## 1. Arquitectura de Archivos en el ZIP

A partir del análisis del backup real `backup_20260721_1004.zip`, se confirma que la app **BiTaVi Android** empaqueta su base de datos de expedición en archivos de texto optimizados con delimitador de barra vertical (`|`):

```
backup_YYYYMMDD_HHMM.zip
├── rutas.txt               # Registro de todas las rutas grabadas
├── puntos.txt              # Millones de coordenadas GPS de los tracks vinculados por ID de ruta
├── marcadores.txt          # Puntos tácticos y waypoints de interés con colores hex
├── favoritos.txt           # Paradas automáticas y ubicaciones destacadas
└── images/                 # Carpeta con las 55 fotografías capturadas durante los recorridos
    ├── IMG_GALLERY_xxx.jpg
    └── IMG_xxx.jpg
```

---

## 2. Especificación de Columnas por Archivo

### A. `rutas.txt`
```
id_ruta | nombre_ruta | timestamp_inicio | timestamp_fin | distancia_metros | vel_max | vel_prom
```
- **Ejemplo**: `57|Auto-Ruta 2026-07-20 14:32|1784568742425|1784573750732|4413.46871972084|1.6710782|1.1862314`
- **Interpretación**: Ruta #57, distancia 4.41 km, velocidad promedio 1.18 km/h.

### B. `puntos.txt`
```
id_ruta | latitud | longitud | altitud | velocidad | timestamp
```
- **Ejemplo**: `57|-34.5641703|-58.457921|46.3414986903339|1.1290159|1784568743923`
- **Interpretación**: Punto correspondiente a la Ruta #57 en coordenadas `(-34.5641703, -58.457921)`, altitud 46.34 m.

### C. `marcadores.txt`
```
id_marcador | nombre | descripcion | latitud | longitud | notas | extra | color_hex
```
- **Ejemplo**: `34|Htal Militar ||-34.5706825|-58.4366438|||#2196F3`
- **Interpretación**: Marcador "Htal Militar" en color azul `#2196F3`.

### D. `favoritos.txt`
```
nombre | direccion | latitud | longitud | descripcion | tipo | ... | color_hex | ... | timestamp
```
- **Ejemplo**: `Avenida Cabildo 1594|Avenida Cabildo 1594|-34.566501|-58.4523619|⏱️ Parada automatica de 18 min 42 seg|Automático||||false|#FFD700|Desconocido|Desconocida|1784570694614`
- **Interpretación**: Parada automática de 18 min en Av. Cabildo, color dorado `#FFD700`.

---

## 3. Renderizado y Selector en BiTaVi PC

1. **Selector de Rutas**: Permite conmutar entre ver **Todas las rutas simultáneamente** o enfocar una ruta individual (ej. Ruta 57, 56, 55, 53, 52).
2. **Pines Tácticos**: Los marcadores y favoritos se pintan con sus nombres y colores originales.
3. **Pines Fotográficos**: Las imágenes de la carpeta `images/` se procesan con sus metadatos EXIF para situar los pines de cámara en el mapa.

## 4. Backup JSON Nativo (`ruta.json`)

Además del backup en texto, BiTaVi Android puede exportar una expedición como un único archivo JSON. BiTaVi PC lo reconoce de forma explícita como **Caso 0** de `parseJsonData()`, antes de cualquier heurística.

### Esquema

```json
{
  "route": {
    "name": "2026-06-14 09:23 Lancha hasta La Becasina",
    "startTime": 1782404077137,
    "endTime": 1782404077203,
    "distanceMeters": 32267.5550262928,
    "isActive": false,
    "maxSpeed": 0,
    "avgSpeed": 0
  },
  "locationPoints": [
    { "latitude": -34.4217448, "longitude": -58.5798769, "altitude": 24, "speed": 0, "timestamp": 0 }
  ],
  "waypoints": []
}
```

### Reglas de interpretación

1. **Colección de puntos**: se acepta `locationPoints` (formato actual) y los alias `location_points`, `puntosRuta`, `puntos_ruta`, `trackPoints`, `track_points` y `geopoints`. La clave genérica `puntos` solo se considera parte de este esquema si existe `data.route`.
2. **Nombre y fecha**: se usa `route.name`; si el nombre contiene una fecha (`YYYY-MM-DD`), esa fecha manda sobre `route.startTime`, igual que en `rutas.txt`.
3. **Distancia**: se prioriza `route.distanceMeters` (distancia oficial registrada por Android) en lugar de recalcularla con Haversine.
4. **Velocidades**: `route.maxSpeed` y `route.avgSpeed` se muestran tal como los declara el backup.
5. **Waypoints**: cada elemento de `waypoints` se dibuja como marcador táctico con `name`, `description` y `color`.
6. **Timestamps en cero**: si `locationPoints[].timestamp` es `0`, el punto se conserva pero sin hora; no se usa para geolocalizar fotos por proximidad temporal.

### Ingesta

- **Archivo suelto**: arrastrar o seleccionar un `.json` / `.geojson` agrega la ruta y la dibuja con `renderSingleRoute()`.
- **Dentro de un ZIP**: el análisis del backup también interpreta los `.json` / `.geojson` incluidos, aunque el ZIP contenga además `rutas.txt` o `puntos.txt`.
- **Restauración de sesión**: la ruta se persiste con el resto de la sesión y reaparece tras recargar la aplicación.

### Fotografías del backup

- Las fotos con bloque GPS EXIF se geolocalizan con `latitude`/`longitude` decimales; si no existen, `leerGpsFoto()` convierte DMS EXIF o el GPS embebido en XMP.
- Si la foto fue reencodeada y perdió el EXIF (WhatsApp, Google Fotos, capturas), se intenta el GPS asociado a la parada en `favoritos.json` / `favoritos.txt` y, por último, la proximidad temporal con los puntos de la ruta.
- Los puntos con `timestamp: 0` no permiten el fallback temporal: en ese caso la foto queda como «Sin GPS» y puede fijarse manualmente arrastrándola al mapa.
