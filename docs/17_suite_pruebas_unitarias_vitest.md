# BiTaVi PC - Suite de Pruebas Unitarias Automatizadas (Vitest)

> **Documento Oficial del Sistema**: `docs/17_suite_pruebas_unitarias_vitest.md`  
> **Versión del Sistema**: `v1.0.3-alpha`  
> **Fecha de Emisión**: 2026-10-21  
> **Estado**: Activo / En Producción  

---

## 1. Justificación y Propósito de Calidad

Anteriormente, el proyecto únicamente contaba con una verificación sintáctica básica (`scripts/check.js` mediante `node --check`). Si bien aseguraba que no existieran errores de análisis léxico, no garantizaba la corrección de:
1. Las fórmulas matemáticas de navegación (fórmula de Haversine, trigonometría esférica de rumbo).
2. La conversión inversa de colores para KML (`#RRGGBB` a `aabbggrr`).
3. El saneamiento de nombres de archivo prohibidos en sistemas de archivos Windows (`FAT32`, `NTFS`) y Linux (`ext4`).
4. La inspección binaria de cabeceras Magic Bytes (`PK`) y el filtrado de archivos basura del sistema operativo.
5. La integridad del parser de telemetría de BiTaVi Android (`rutas.txt`, `puntos.txt`, etc.).

A partir de la versión **`v1.0.3-alpha`**, BiTaVi PC integra **Vitest** con **happy-dom**, proporcionando un entorno de pruebas unitarias ultrarrápido ejecutado tanto en local como en la nube en cada commit a través de GitHub Actions.

---

## 2. Configuración y Entorno de Ejecución

El archivo de configuración principal [`vitest.config.js`](../vitest.config.js) establece:
- **Entorno**: `happy-dom` (emulación ligera de DOM y `window` para compatibilidad con Leaflet y Blob/File APIs).
- **Alcance**: Todos los archivos ubicados en `tests/**/*.test.js`.
- **Modo Global**: Funciones `describe`, `it`, `expect` disponibles sin necesidad de importaciones redundantes.

Comandos disponibles:
```bash
# Ejecución única de la suite completa (CI / Validación rápida)
npm test

# Modo interactivo en desarrollo (Hot Module Replacement de pruebas)
npm run test:watch
```

---

## 3. Cobertura de las Suites de Prueba

La suite cuenta con **19 pruebas unitarias automatizadas distribuidas en 6 suites**:

| Suite de Prueba | Componente Auditado | Aspectos Clave Verificados |
| :--- | :--- | :--- |
| `tests/navigation-math.test.js` | `src/components/playback.js` | Distancia geodésica con Haversine, rumbo esférico en grados (0° a 360°), traducción a 16 cuadrantes cardinales (`N`, `NE`, `ENE`, etc.) y formateo cronológico `HH:MM:SS`. |
| `tests/kml-kmz.test.js` | `src/components/kml-kmz-exporter.js` | Escape de caracteres XML, conversión cromática hexadecimal a formato inverso `aabbggrr`, generación de KML 2.2 con teselación y referencias locales para contenedores KMZ. |
| `tests/gpx-tools.test.js` | `src/components/gpx-parser.js` | Saneamiento de nombres ilegales en Windows/Linux (`*`, `:`, `"`, `?`, `/`, `\`), compactación de guiones bajos y generación de estándar XML GPX 1.1 con metadatos. |
| `tests/folder-loader.test.js` | `src/components/folder-loader.js` | Descarte preventivo de archivos basura del sistema operativo (`.DS_Store`, `desktop.ini`, `Thumbs.db`, temporales `.crdownload`), categorización de archivos de expedición y detección binaria de Magic Bytes `0x50 0x4B` (`PK`). |
| `tests/search.test.js` | `src/components/search.js` | Normalización de cadenas (remoción de tildes, diacríticos y mayúsculas) y motor de búsqueda táctico offline sobre rutas, fotos y marcadores en memoria. |
| `tests/native-parser.test.js` | `src/components/bitavi-native-parser.js` | Deserialización de líneas de texto de BiTaVi Android delimitadas por tuberías (`|`): `rutas.txt`, `puntos.txt` y `marcadores.txt`. |

---

## 4. Integración en el Pipeline de CI/CD (GitHub Actions)

En el archivo [`.github/workflows/build.yml`](../.github/workflows/build.yml), el paso de pruebas automatizadas se ejecuta de forma obligatoria en entornos `windows-latest` y `ubuntu-latest`:

```yaml
- name: Verificación de sintaxis JS
  run: npm run lint

- name: Pruebas unitarias automatizadas (Vitest)
  run: npm test

- name: Compilación de producción (Vite)
  run: npm run build
```

Si cualquier prueba unitaria falla, el pipeline detiene de inmediato el empaquetado de producción, asegurando que ningún binario defectuoso sea distribuido.
