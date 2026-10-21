# BiTaVi PC - Especificación de Datos: GPX y Fotos Georreferenciadas

## 1. Archivos GPX (GPS Exchange Format)
Los archivos `.gpx` son el estándar generado por la app móvil BiTaVi para el registro cronológico del recorrido.

### Estructura Soportada
- `<trkpt lat="..." lon="...">`: Puntos individuales del track con coordenadas en grados decimales (WGS84).
- `<ele>`: Altitud sobre el nivel del mar en metros.
- `<time>`: Marca de tiempo ISO 8601 (ej. `2026-08-28T04:00:00Z`).
- `<wpt lat="..." lon="...">`: Puntos de control o waypoints con nombre (`<name>`) y descripción.

### Cálculos y Telemetría Automática
- **Distancia Acumulada**: Calculada punto a punto mediante la fórmula del semiverseno (*Haversine*):
  $$d = 2r \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
- **Perfil de Elevación**: Identificación automática de la cota mínima y máxima de la ruta.
- **Renderizado Visual**: Polilínea doble con resplandor cian táctico (#00f0ff), más marcadores destacados para el punto de inicio (verde) y punto final (rojo).

---

## 2. Fotografías con Coordenadas GPS (Metadatos EXIF)

### Extracción de Metadatos
El sistema analiza mediante `exifr` los siguientes tags estándar de la cámara:
- `GPSLatitude` y `GPSLongitude`: Posición geográfica exacta de la toma.
- `GPSAltitude`: Elevación del terreno en el instante de captura.
- `DateTimeOriginal`: Fecha y hora original de la captura fotográfica.
- `Make` / `Model`: Dispositivo o cámara utilizada.

### Interacción en el Mapa
1. **Pines Fotográficos Dinámicos**: Cada imagen genera un pin personalizado en el mapa con miniatura en burbuja táctica.
2. **Previsualización Rápida (Popup)**: Al pulsar el pin se abre una tarjeta emergente con la imagen, coordenadas y fecha.
3. **Visor Modal (Lightbox)**: Permite inspeccionar la fotografía a tamaño completo junto a su ficha técnica completa y el botón de enfoque cartográfico.
4. **Galería Lateral**: Lista sincronizada; al hacer clic en una foto de la barra lateral, el mapa vuela de forma suave a sus coordenadas.
