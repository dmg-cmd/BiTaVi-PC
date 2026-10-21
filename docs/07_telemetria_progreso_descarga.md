# BiTaVi PC - Módulo de Telemetría y Feedback Visual de Descarga

## 1. Descripción del Módulo

Para archivos de backup pesados (como los de 300+ MB que contienen decenas de fotografías en alta resolución y millones de puntos GPS), el usuario necesita certeza visual de la tasa de transferencia y la fase de procesamiento.

---

## 2. Componentes de Telemetría Implementados

### A. Overlay Táctico (`#tactical-progress-overlay`)
- **Radar de Exploración**: Animación SVG/CSS de barrido cónico continuo (`@keyframes radar-spin`) con icono pulsante.
- **Barra de Carga Luminosa**: Barra con gradiente dinámico (`#00f0ff` -> `#38bdf8` -> `#10b981`) y efecto de resplandor (*shimmer*).
- **Indicador Numérico**: Porcentaje en tiempo real con tipografía monospace táctica.

---

## 3. Fases Notificadas en Vivo

1. **Fase de Descarga HTTP Stream (Google Drive API)**:
   - Lectura progresiva mediante `ReadableStream` y `reader.read()`.
   - Cálculo de MB descargados vs MB totales (`content-length`).
   - Reporte continuo de porcentaje exacto: `Descargando: 138.4 MB / 305.1 MB (45%)`.
2. **Fase de Descompresión en RAM (`JSZip`)**:
   - Conteo y notificación de cada archivo extraído en memoria: `Extrayendo archivo 24 de 59 (IMG_GALLERY_xxx.jpg)...`.
3. **Fase de Interpretación Nativa**:
   - Parseo de `rutas.txt` y agrupación de `puntos.txt` por ID de ruta.
4. **Fase de Extracción EXIF GPS**:
   - Extracción de geolocalización de las 55 fotografías.
5. **Finalización y Enfoque**:
   - Cierre suave del overlay y vuelo del mapa a los límites de la ruta.
