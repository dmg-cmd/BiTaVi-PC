# BiTaVi PC - Exportador KML y KMZ para Google Earth 3D

> **Documento Oficial del Sistema**: `docs/16_exportador_kml_kmz_google_earth_3d.md`  
> **Versión del Sistema**: `v1.0.2-alpha`  
> **Fecha de Emisión**: 2026-10-21  
> **Estado**: Activo / En Producción  

---

## 1. Justificación y Alcance Técnico

El análisis cartográfico bidimensional estándar no permite visualizar los desniveles topográficos, crestas, valles ni la perspectiva aérea tridimensional del terreno en expediciones de montaña, senderismo y patrullaje táctico.

A partir de la versión **`v1.0.2-alpha`**, BiTaVi PC incorpora un motor nativo de exportación a formatos estándar OGC:
- **KML 2.2 (`.kml`)**: Trazados vectoriales 3D compatibles con Google Earth (Web y Desktop), Garmin BaseCamp, ArcGIS y QGIS.
- **KMZ 3D (`.kmz`)**: Paquete comprimido autocontenido que incluye el documento KML raíz (`doc.kml`) y un directorio interno (`files/`) con las fotografías geolocalizadas capturadas en ruta, permitiendo al usuario volar en 3D sobre la expedición y consultar cada fotografía in situ en el globo terráqueo.

---

## 2. Arquitectura del Componente `KmlKmzExporter`

El módulo se encuentra encapsulado en [`src/components/kml-kmz-exporter.js`](../src/components/kml-kmz-exporter.js) y se articula en tres capas:

### 2.1. Conversor Cromático a Estándar KML (`aabbggrr`)
Mientras que CSS y HTML emplean el formato `#RRGGBB`, Google Earth utiliza el estándar KML hexadecimal inverso `aabbggrr` (Alpha, Blue, Green, Red). La función `hexToKmlColor(hex, alpha)` realiza la transformación estricta:

$$\text{CSS: } \#00\text{f0ff} \longrightarrow \text{BGR: } \text{fff000} \longrightarrow \text{KML: } \text{fffff000}$$

Esto asegura que la paleta cromática cian táctica y los colores asignados a cada ruta en BiTaVi se preserven fielmente en el visor 3D de Google Earth.

### 2.2. Generador KML 2.2 XML (`generateKmlXml`)
- **Trazados de Ruta (`<LineString>`)**:
  - Aplica teselación (`<tessellate>1</tessellate>`) y extrusión opcional (`<extrude>1</extrude>`) para amoldar la polilínea a la malla de elevación 3D del terreno digital.
  - Asigna `<altitudeMode>clampToGround</altitudeMode>` para garantizar anclaje estricto a las montañas y acantilados.
  - Genera tuplas de coordenadas tridimensionales en formato estándar: `<coordinates>longitud,latitud,altitud ...</coordinates>`.
- **Puntos de Interés y Waypoints (`<Placemark>` + `<Point>`)**:
  - Exporta marcadores tácticos y favoritos con iconos nativos de Google Earth (`placemark_circle.png`).
- **Fotografías Geolocalizadas**:
  - Inserta iconos tácticos de cámara fotográfica (`camera.png`) en las coordenadas geográficas exactas de cada captura.
  - Estructura descripciones emergentes formateadas en HTML con datos de fecha, altitud, coordenadas y dispositivo fotográfico.

### 2.3. Empaquetador Masivo KMZ (`exportToKmz`)
- Emplea `JSZip` para componer en memoria el archivo `.kmz`.
- Transfiere las imágenes geolocalizadas desde la memoria (`photo.file.arrayBuffer()`) a la subcarpeta interna `files/` del archivo comprimido.
- Emite eventos de telemetría de progreso durante la compresión para informar al operador en el HUD.

---

## 3. Puntos de Entrada en la Interfaz de Usuario

1. **Barra de Gestión de Rutas (`#route-export-bar`)**:
   - Botón **`[🌍 KML 3D]`**: Descarga en el acto el archivo `.kml` de las rutas y waypoints seleccionados.
   - Botón **`[🌐 KMZ 3D (con Fotos)]`**: Genera y descarga el paquete `.kmz` integrado con rutas, waypoints y fotografías incrustadas.
2. **Galería de Fotografías Geolocalizadas**:
   - Botón **`[🌐 Exportar Fotos a KMZ 3D]`**: Permite empaquetar de forma independiente todas las fotografías con metadatos de campaña para Google Earth 3D.
