# BiTaVi PC - Módulo de Visor Cartográfico

## 1. Propósito
El visor cartográfico es el núcleo visual de **BiTaVi PC**, encargado de desplegar el territorio, la telemetría en tiempo real, las rutas registradas y las fotografías geolocalizadas.

---

## 2. Capas Cartográficas Libres (Sin API Key)

Todas las capas utilizadas provienen de fuentes abiertas y públicas, sin requerir suscripciones ni claves comerciales:

1. **OpenStreetMap Standard**:
   - **Proveedor**: OpenStreetMap Foundation
   - **URL**: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
   - **Uso**: Capa base urbana y de carreteras estándar de alta fidelidad.

2. **Táctico Oscuro (OSM Nocturno)**:
   - **Mecanismo**: Renderizado táctico nocturno aplicado mediante filtros CSS (`brightness`, `invert`, `contrast`, `hue-rotate`) sobre la capa OpenStreetMap.
   - **Ventaja**: Cero dependencias externas y estética visual militar/táctica nativa.

3. **Topográfico (OpenTopoMap)**:
   - **Proveedor**: OpenTopoMap / SRTM
   - **URL**: `https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png`
   - **Uso**: Lectura de curvas de nivel, relieve sombreado y cotas de altura para expediciones y travesías.

4. **Satelital (Esri World Imagery)**:
   - **Proveedor**: Esri / USGS / NASA
   - **URL**: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`
   - **Uso**: Imágenes satelitales y fotografía aérea de alta resolución.

5. **Ciclo & Senderismo (CyclOSM)**:
   - **Proveedor**: OpenStreetMap Francia / CyclOSM
   - **URL**: `https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png`
   - **Uso**: Caminos rurales, senderos peatonales y pistas de montaña.

---

## 3. Telemetría, Búsqueda y Geolocalización
- **Buscador Geográfico Táctico (Nominatim OpenStreetMap)**: 
  - Permite escribir el nombre de cualquier ciudad, localidad, provincia o dirección en la barra superior.
  - Muestra sugerencias en tiempo real y al presionar `Enter` o hacer clic en una opción, el mapa vuela suavemente a la ubicación seleccionada.
- **Fijación Manual de Ubicación (`FIJAR AQUÍ`)**:
  - Permite activar el modo de selección táctica y hacer un solo clic en cualquier parte del mapa para fijar allí la posición base del usuario.
- **Persistencia en `localStorage`**: 
  - Recuerda automáticamente la última posición fijada por el usuario para que la próxima vez que abra BiTaVi en su PC, el mapa inicie directamente en su zona.
- **Detección GPS Automática (`GPS AUTO`)**:
  - Se comunica con la API `navigator.geolocation` con modo de alta precisión.
  - Si la computadora de escritorio no posee chip GPS físico o el navegador restringe los permisos, el sistema emite un aviso táctico guiando al usuario a usar el buscador de ciudades o la fijación manual.
- **Marcador Radar Táctico**: Un marcador pulsante animado (`user-radar-marker`) indica la posición activa y un círculo semitransparente refleja el radio de precisión en metros.
- **HUD Superior**: Refleja continuamente la latitud, longitud, nivel de zoom, precisión y Datum WGS84.
- **Rastreo de Cursor**: Informa de las coordenadas geográficas exactas por donde se desplaza el cursor del ratón sobre el terreno.
