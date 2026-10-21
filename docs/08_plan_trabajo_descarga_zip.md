# BiTaVi PC - Plan de Trabajo: Corrección de Descarga ZIP y Progreso

> **Estado**: Fases 1-4 implementadas (código corregido). Pendiente fase 5 (testing del usuario) y responder preguntas Q1-Q6.

## 1. Resumen del Problema

Los botones de carga/descarga de archivos ZIP de backup de la app móvil BiTaVi **no descargan** y **no muestran la línea de progreso** de descarga (overlay táctico `#tactical-progress-overlay`).

### 1.1 Cambios implementados (v0.2.3-alpha)

| Archivo | Cambio aplicado |
|---------|-----------------|
| `src/components/drive-connector.js` | Re-autenticación (`ensureAuthenticated`), timeout 5 min (`AbortController`), manejo de `size`/`content-length` nulos, verificación de `response.body`, try-catch global, logging `[GDrive]` |
| `src/main.js` | Fallback del overlay en `#cursor-coords`, logging `[BiTaVi]` en `handleFiles`, validación de tamaño de ZIP (>500 MB), paso de `file.size \|\| null` a la descarga |
| `src/components/zip-loader.js` | Reescritura limpia con try-catch global y logging `[ZipLoader]` |

---

## 2. Diagnóstico Inicial

### 2.1 Flujo actual de descarga (Google Drive)
```
Usuario hace clic en "DESCARGAR" en modal GDrive
  → gdriveConnector.downloadZipFile(file.id, file.name, onProgress, file.size)
    → fetch(..., { headers: { Authorization: `Bearer ${token}` } })
      → response.body.getReader() → lectura de chunks
        → onProgress({ percent, loadedMb, totalMb, phase })
          → updateProgress(percent, phase, detail)
            → showProgress() / updateProgress() en overlay
```

### 2.2 Puntos de fallo identificados

| # | Componente | Archivo | Línea(s) | Problema |
|---|-----------|---------|----------|----------|
| 1 | **OAuth token stale** | `drive-connector.js` | 64-91 | `authenticate()` usa `tokenClient.requestAccessToken()` pero si el token expira entre la lista y la descarga, `this.accessToken` es inválido sin re-autenticación |
| 2 | **Sin try-catch en stream** | `drive-connector.js` | 152-174 | Si `response.body.getReader()` falla o `reader.read()` lanza error, la función se rompe sin notificar al usuario ni al callback `onProgress` |
| 3 | **`onFileDownloaded` es async pero no se await correctamente** | `main.js` | 177-179 | El callback `handleFiles([downloadedZipFile])` es async y está dentro de `await gdriveConnector.downloadZipFile(...)`, pero `handleFiles` procesa ZIP y puede tardar varios segundos, bloqueando la UI sin feedback |
| 4 | **Overlay puede no encontrarse** | `main.js` | 193 | `progressOverlay = document.getElementById('tactical-progress-overlay')` — si el DOM no lo tiene (ej. renderizado tardío), `showProgress` y `updateProgress` hacen `return` sin aviso |
| 5 | **`file.size` puede ser `null` del API** | `main.js` | 288, 304 | `file.size` del response de Drive API puede ser `null` si el archivo está en acceso compartido, causando `NaN` en cálculos de progreso |
| 6 | **Sin timeout ni retry** | `drive-connector.js` | 128-187 | La descarga puede colgarse indefinidamente sin mecanismo de timeout ni reintento |

### 2.3 Flujo de carga local ZIP
```
Archivo .ZIP seleccionado
  → handleFiles([zipFile])
    → zipHandler.processZipBackup(zipFile, onProgress)
      → JSZip.loadAsync(zipFile)
        → Extracción de cada entry con entry.async('string'/'blob')
```
- **Problema potencial**: Archivos ZIP grandes (>100MB) pueden causar *out-of-memory* o timeout en `JSZip.loadAsync()` sin que se notifique al usuario hasta que el navegador se vuelva no responsivo.

---

## 3. Plan de Trabajo por Fases

### Fase 1 — Diagnóstico y logging (Día 1)
**Objetivo**: Identificar exactamente dónde falla la descarga y el progreso.

- [ ] **1.1** Añadir `console.log`/`console.warn` en los siguientes puntos:
  - `drive-connector.js: authenticate()` → loggear `response.access_token` obtenido
  - `drive-connector.js: downloadZipFile()` → loggear el `response` completo (status, headers, body) antes de llamar a `getReader()`
  - `drive-connector.js: downloadZipFile()` → loggear si `response.body` es `null`
  - `main.js: renderGdriveFilesList()` → loggear `file.size` para verificar que no es `null`
  - `main.js: showProgress()` → loggear si `progressOverlay` es `null`
  - `main.js: updateProgress()` → loggear si `progressOverlay` es `null`

- [ ] **1.2** Abrir DevTools (F12) y capturar la consola y la pestaña Network al intentar descargar un backup de Google Drive.

- [ ] **1.3** Verificar que `progressOverlay` existe en el DOM al momento del clic en DESCARGAR.

### Fase 2 — Corrección del flujo de descarga GDrive (Día 1-2)
**Objetivo**: Hacer que la descarga desde Google Drive funcione correctamente.

- [ ] **2.1** Corregir re-autenticación automática en `drive-connector.js`:
  ```js
  // En downloadZipFile, antes del fetch, verificar y refrescar el token si es necesario
  if (!this.accessToken || /* token expirado */) {
    await this.authenticate();
  }
  ```

- [ ] **2.2** Añadir try-catch robusto alrededor del `ReadableStream`:
  ```js
  try {
    const reader = response.body.getReader();
    // ... lectura de chunks
  } catch (streamErr) {
    console.error('Stream error:', streamErr);
    this.onStatusUpdate?.(`❌ Error de transmisión: ${streamErr.message}`);
    throw streamErr;
  }
  ```

- [ ] **2.3** Manejar `file.size === null`:
  ```js
  const totalBytes = contentLength 
    ? parseInt(contentLength, 10) 
    : (knownSizeBytes && knownSizeBytes > 0 ? parseInt(knownSizeBytes, 10) : 0);
  ```

- [ ] **2.4** Añadir timeout a la descarga:
  ```js
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000); // 2 min
  // En fetch: { headers: ..., signal: controller.signal }
  // Limpiar timeout al completar
  ```

### Fase 3 — Corrección del overlay de progreso (Día 2)
**Objetivo**: Asegurar que la barra de progreso se muestra siempre durante la descarga.

- [ ] **3.1** Verificar que `progressOverlay` se obtiene correctamente en `DOMContentLoaded`:
  ```js
  const progressOverlay = document.getElementById('tactical-progress-overlay');
  if (!progressOverlay) console.warn('⚠️ #tactical-progress-overlay no encontrado en DOM');
  ```

- [ ] **3.2** Añadir fallback visual si el overlay falla:
  ```js
  function showProgress(...) {
    if (!progressOverlay) {
      // Fallback: mostrar en cursor-coords
      const coords = document.getElementById('cursor-coords');
      if (coords) coords.textContent = `⏳ ${status}: ${percent}%`;
      return;
    }
    // ... código actual
  }
  ```

- [ ] **3.3** Verificar que `progressOverlay.classList.remove('hidden')` funciona:
  - Inspeccionar que el CSS `.photo-modal.hidden { display: none !important; }` no esté interfiriendo con `z-index` o `position`

### Fase 4 — Optimización de carga ZIP local (Día 2-3)
**Objetivo**: Mejorar la carga de ZIPs locales grandes.

- [ ] **4.1** Añadir validación de tamaño antes de procesar:
  ```js
  if (zipFile.size > 500 * 1024 * 1024) { // 500MB
    alert('El archivo es muy grande. Considera dividir el backup.');
    return;
  }
  ```

- [ ] **4.2** Mejorar `onProgress` en `zip-loader.js` para reportar progreso de lectura del zip:
  ```js
  // Actualizar el porcentaje basado en entries procesados
  onProgress?.({ percent: Math.round((processedCount / entries.length) * 100), phase: `...` });
  ```

- [ ] **4.3** Añadir chunking o `JSZip` con concurrencia controlada para archivos muy grandes:
  - Considerar `JSZip` con opciones de `loadAsync` con chunk size
  - Mostrar progreso de carga antes de empezar a extraer entries

### Fase 5 — Testing y verificación (Día 3)
**Objetivo**: Confirmar que todo funciona.

- [ ] **5.1** Probar descarga desde Google Drive con:
  - Archivo pequeño (<10 MB)
  - Archivo mediano (50-100 MB)
  - Archivo grande (>200 MB)

- [ ] **5.2** Verificar que el overlay de progreso:
  - Aparece al iniciar descarga
  - Muestra porcentaje actualizado en tiempo real
  - Muestra MB descargados vs totales
  - Se cierra correctamente al 100%

- [ ] **5.3** Probar carga local de ZIP:
  - Con el botón "Explorar PC"
  - Con arrastrar y soltar (drag & drop)
  - Con el botón "Cargar Demo ZIP"

- [ ] **5.4** Verificar que la consola no tiene errores nuevos.

---

## 4. Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/drive-connector.js` | Re-autenticación, try-catch en stream, timeout, manejo de size null |
| `src/main.js` | Logging de diagnóstico, fallback de progreso, validación de `progressOverlay` |
| `src/components/zip-loader.js` | Validación de tamaño, mejor progreso de extracción |
| `docs/07_telemetria_progreso_descarga.md` | Actualizar con cambios realizados |
| `docs/08_plan_trabajo_descarga_zip.md` | *(Este archivo)* |

---

## 5. Preguntas para el usuario

Antes de iniciar la Fase 1, responde a lo siguiente:

- [ ] **Q1**: ¿Los botones que no funcionan son solo los de Google Drive ("DESCARGAR" en el modal) o también el de "Explorar PC" y "Cargar Demo ZIP"?
- [ ] **Q2**: ¿Qué ves en la consola del navegador (F12 → Console) cuando haces clic en DESCARGAR? ¿Hay errores en rojo?
- [ ] **Q3**: ¿Logra abrir el modal de Google Drive, conectar tu cuenta y listar los archivos ZIP de backup? ¿Cuál es el último paso que ves antes de que falle?
- [ ] **Q4**: ¿La "línea de descarga" se refiere al overlay táctico (la pantalla con el radar y la barra de progreso) que no aparece, o es otra cosa?
- [ ] **Q5**: ¿Estás probando en un navegador moderno (Chrome, Edge, Firefox)? ¿Es una app Electron o un sitio web normal?
- [ ] **Q6**: ¿El token de Google Drive está guardado (`localStorage.getItem('bitavi_gdrive_client_id')`)? ¿Ya lograste conectar la cuenta alguna vez?
