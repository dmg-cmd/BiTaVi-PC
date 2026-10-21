# BiTaVi PC - Módulo de Inspección y Análisis Estructural de Backups ZIP

## 1. Propósito
Este módulo permite auditar, desglosar e inspeccionar la estructura interna de cualquier archivo de backup `.ZIP` generado por la app móvil **BiTaVi Android**, ya sea descargado desde Google Drive o cargado localmente.

---

## 2. Capacidades de Análisis
1. **Desglose de Entradas**:
   - Conteo total de carpetas y archivos empaquetados.
   - Cálculo del tamaño descomprimido de cada recurso.
2. **Clasificación Automática de Recursos**:
   - **Ruta GPX**: Detección de archivos `.gpx` y extracción de coordenadas de track.
   - **Fotografías**: Detección de `.jpg`, `.jpeg`, `.png`, `.webp`, `.heic` y lectura de etiquetas EXIF GPS.
   - **Configuración y Metadatos**: Lectura de archivos `.json`, `.xml`, `.txt` o `.csv` que contengan notas o parámetros de la bitácora.
   - **Bases de Datos**: Identificación de bases de datos internas SQLite (`.db`, `.sqlite`, `.realm`).
3. **Visor de Metadatos en Vivo**:
   - Si el ZIP contiene metadatos en formato JSON (ej. título de expedición, participante, fecha, notas tácticas), se renderizan formateados en el panel lateral.
4. **Árbol de Archivos**:
   - Muestra la ruta completa interna de cada elemento con su categoría e indicador de peso.
