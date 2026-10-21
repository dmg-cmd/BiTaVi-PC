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
