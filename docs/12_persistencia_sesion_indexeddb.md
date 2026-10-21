# BiTaVi PC - Persistencia de Sesión con IndexedDB (BiTaVi_Storage_v1)

> **Estado**: Implementado en `v0.4.8-alpha`  
> **Fecha**: 18 de octubre de 2026  
> **Componente**: `src/components/storage.js` (`BiTaViStorage`)

---

## 1. Justificación y Propósito

En versiones anteriores a `v0.4.8-alpha`, al presionar accidentalmente `F5`, cerrar la pestaña del navegador o navegar hacia atrás, toda la expedición cargada (rutas, puntos GPS, marcadores, favoritos y fotos) se perdía de la memoria volátil del DOM, obligando al usuario a volver a seleccionar el archivo `.zip`, carpetas o archivos de texto.

La persistencia con **IndexedDB** provee un almacenamiento estructurado, transaccional, con soporte para decenas de megabytes de datos binarios (`Blob`) y 100% privado en el navegador del usuario (sin servidores ni telemetría externa).

---

## 2. Arquitectura de Almacenamiento

### 2.1 Identificación de la Base de Datos
- **Nombre**: `BiTaVi_Storage_v1`
- **Versión**: `1`
- **Motor**: API estándar `window.indexedDB`

### 2.2 Almacenes de Objetos (Object Stores)

```
BiTaVi_Storage_v1
├── [sessions] (keyPath: "id")
│   └── id: "active_session"
│       ├── savedAt: "2026-10-18T..."
│       ├── title: "Ruta 1 (Expedición...)"
│       ├── sourceType: "native" | "gpx" | "zip"
│       ├── routes: [...]
│       ├── pointsByRoute: { "1": [...], "2": [...] }
│       ├── markers: [...]
│       ├── favorites: [...]
│       ├── stats: { distanceKm, totalPoints, ... }
│       └── photosMeta: [ { id, name, lat, lng, date, ... }, ... ]
│
└── [photos] (keyPath: "id")
    ├── photo-1: { id: "photo-1", name: "IMG_01.jpg", blob: Blob }
    ├── photo-2: { id: "photo-2", name: "IMG_02.jpg", blob: Blob }
    └── ...
```

1. **`sessions`**: Contiene la telemetría matemática, geometrías y metadatos de rutas, paradas y fotos.
2. **`photos`**: Almacena los archivos binarios de imágenes (`Blob`). Separar los blobs en un almacén dedicado permite que la consulta inicial de cabecera (`getSavedSessionSummary()`) se resuelva en **0 ms** sin transferir pesados megabytes de fotos hasta que el usuario decida restaurar.

---

## 3. Ciclo de Vida de la Sesión

### 3.1 Detección al Arranque (Startup)
1. Al dispararse `DOMContentLoaded`, la aplicación consulta `storage.getSavedSessionSummary()`.
2. Si existe un registro con rutas, puntos o fotos, se muestra de inmediato el banner flotante en el HUD:
   ```
   [💾 EXPEDICIÓN EN MEMORIA LOCAL]
   Sesión detectada: Ruta 1 (42.15 km · 1 ruta · 15 fotos · [18/10/2026])
   [⚡ RESTAURAR EXPEDICIÓN]  [✕ DESCARTAR]
   ```

### 3.2 Restauración (`RESTAURAR EXPEDICIÓN`)
1. Se lee el registro completo y se extraen los blobs de fotos desde el almacén `photos`.
2. Para cada foto, se genera una URL temporal local mediante `URL.createObjectURL(blob)`.
3. Se inyectan las geometrías en `nativeParser.restoreData(...)` y las fotos en `photoHandler.restorePhotos(...)`.
4. Se dibujan las capas en Leaflet, se actualiza el selector de rutas, las estadísticas del HUD, el visor de fotos y se reindexa el buscador táctico local (`refreshSearchIndex()`).
5. El mapa ajusta su encuadre automáticamente (`fitBounds`).

### 3.3 Descarte y Limpieza (`DESCARTAR` o `LIMPIAR RUTA`)
- Al presionar **DESCARTAR** o el botón del panel **LIMPIAR RUTA**, se ejecuta `storage.clearSession()`, eliminando los registros de ambos object stores de IndexedDB para no dejar residuos.

### 3.4 Auto-guardado y Sincronización Reactiva
- Cada vez que se procesa una expedición exitosamente (`handleFiles`), se guarda la sesión automáticamente.
- Cuando el usuario mueve manualmente una foto sobre el mapa (`photoHandler.onPhotoGeotag`), sus nuevas coordenadas se sincronizan en IndexedDB vía `storage.updatePhotoCoordinates(photoId, lat, lng)`.
