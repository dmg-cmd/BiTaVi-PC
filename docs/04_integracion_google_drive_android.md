# BiTaVi PC - Integración con Google Drive y Backups de Android

## 1. Contexto de la Integración
La aplicación móvil **BiTaVi para Android** registra expediciones, tracks GPS y fotografías en el dispositivo móvil. Estas sesiones de viaje se exportan o respaldan automáticamente en carpetas o paquetes ZIP almacenados en **Google Drive**.

---

## 2. Estructura Típica de un Paquete de Backup BiTaVi

```
Backup_BiTaVi_YYYY-MM-DD_Expedicion/
├── ruta_viaje.gpx                # Track continuo de la ruta y waypoints
├── bitacora_metadata.json        # Resumen de viaje (título, notas, participantes, fecha)
└── fotos/                        # Fotografías capturadas durante el trayecto
    ├── IMG_20260828_01.jpg       # Foto con EXIF GPS
    ├── IMG_20260828_02.jpg       # Foto con EXIF GPS
    └── IMG_20260828_03.jpg       # Foto con EXIF GPS
```

---

## 3. Flujo de Trabajo en la Versión PC (`v0.1.0-alpha`)

### Fase 1: Descompresión en Memoria de Archivos ZIP (Activa)
- El usuario descarga el archivo `.zip` de su Google Drive a su equipo.
- Arrastra el archivo `.zip` directamente sobre el panel de carga de BiTaVi PC o pulsa "Explorar PC".
- El motor interno (`JSZip` en `src/components/zip-loader.js`) procesa el archivo comprimido directamente en la memoria RAM del navegador en milisegundos:
  - Extrae el archivo `.gpx` y dibuja la polilínea táctica con cálculo de kilómetros y altimetría.
  - Extrae las fotografías y recupera sus metadatos EXIF de ubicación para posicionar los pines fotográficos en el mapa.
  - Lee el archivo `bitacora_metadata.json` con la información del viaje.
- **Privacidad Total**: Todo el procesamiento se realiza en local, sin subir tus archivos a ningún servidor externo.

### Fase 2: Conexión Directa a la Nube de Google Drive (Siguiente versión)
- Integración mediante Google Drive API v3 y Google Picker.
- Permitirá listar directamente las carpetas de backups de BiTaVi guardadas en Google Drive y abrirlas con un solo clic.
