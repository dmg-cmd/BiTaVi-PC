# 🖥️ BiTaVi PC - Empaquetado Nativo de Escritorio con Tauri v2

> **Documento de Especificación Técnica Oficial**  
> **Versión del Sistema**: `v1.0.5-alpha`  
> **Fecha de Publicación**: 21 de octubre de 2026  
> **Entorno**: Tauri v2, Rust 1.90+, Node.js, Webview2 (Windows) / WebKitGTK (Linux)

---

## 1. Contexto y Objetivos Técnicos

**BiTaVi PC** fue concebido como una estación de visualización cartográfica y telemetría de alto rendimiento. Para entornos tácticos y de campo donde no se desea depender de un navegador web externo, se ha integrado **Tauri v2** para generar binarios de escritorio 100% nativos, seguros y con consumo mínimo de recursos.

### Beneficios Clave frente a Tecnologías Tradicionales (ej. Electron):
1. **Huella de Memoria Ultraligera**: Tauri utiliza el motor webview nativo del sistema operativo (WebView2 en Windows y WebKitGTK en Linux), reduciendo el consumo de RAM de cientos de megabytes a unas pocas decenas de MB.
2. **Tamaño del Ejecutable Compacto**: Los instaladores y portables pesan entre 5 MB y 15 MB, frente a los 80-150 MB típicos de Electron.
3. **Seguridad Robusta**: Backend protegido en Rust compilado a código máquina nativo.
4. **Asociaciones de Archivo**: Integración directa con el explorador de Windows y administradores de archivos en Linux para abrir directamente archivos `.gpx`, `.kml`, `.kmz` y `.zip`.

---

## 2. Arquitectura de Integración

```
BiTaVi-PC/
├── src-tauri/
│   ├── Cargo.toml               # Manifiesto de paquetes Rust (bitavi-pc v1.0.5)
│   ├── build.rs                 # Script de compilación de Tauri
│   ├── tauri.conf.json          # Configuración de ventana, plugins y bundle
│   ├── icons/                   # Iconos multiplataforma (32x32, 128x128, .ico, .icns)
│   └── src/
│       ├── main.rs              # Punto de entrada Windows Subsystem
│       └── lib.rs               # Configuración del builder de Tauri
├── src/                         # Frontend Web/PWA estándar (Leaflet, JSZip, Exifr)
├── dist/                        # Salida de Vite empaquetada para el frontend
└── package.json                 # Comandos de orquestación npm
```

---

## 3. Configuración del Núcleo (`src-tauri/tauri.conf.json`)

La configuración principal define la integración de ventana, resoluciones mínimas y asociaciones de archivos:

```json
{
  "productName": "BiTaVi",
  "version": "1.0.5",
  "identifier": "com.bitavi.pc",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "title": "BiTaVi - Bitácora Táctica de Viaje",
        "width": 1280,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "fileAssociations": [
      {
        "ext": ["gpx"],
        "name": "GPX",
        "description": "Ruta GPS en formato GPX",
        "mimeType": "application/gpx+xml"
      },
      {
        "ext": ["kml"],
        "name": "KML",
        "description": "Ruta geográfica Google Earth KML",
        "mimeType": "application/vnd.google-earth.kml+xml"
      },
      {
        "ext": ["kmz"],
        "name": "KMZ",
        "description": "Paquete comprimido Google Earth KMZ",
        "mimeType": "application/vnd.google-earth.kmz"
      },
      {
        "ext": ["zip"],
        "name": "ZIP",
        "description": "Paquete de respaldo BiTaVi ZIP",
        "mimeType": "application/zip"
      }
    ]
  }
}
```

---

## 4. Comandos de Operación

En `package.json` se han integrado los scripts para el ciclo de vida del empaquetado:

| Comando | Acción |
| :--- | :--- |
| `npm run tauri:dev` | Lanza el servidor de desarrollo Vite y levanta la ventana nativa de Tauri con Hot Module Reload (HMR). |
| `npm run tauri:build` | Compila el frontend (`npm run build`) y genera los binarios nativos de escritorio (instalador `.msi`/`.exe` en Windows, `.deb`/`.AppImage` en Linux). |
| `npm run package` | Genera paquetes portables estándar ZIP multiplataforma en `release/`. |

---

## 5. Control de Calidad y Pruebas

Tanto la suite de pruebas unitarias (`npm test`) como los análisis estáticos de código (`npm run lint`) continúan ejecutándose con 100% de éxito antes de cada empaquetado y en el flujo automatizado de GitHub Actions.
