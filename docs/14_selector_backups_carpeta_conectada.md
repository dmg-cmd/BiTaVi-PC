# BiTaVi PC - Conexión de Carpeta y Selector de Backups de Android

## 1. Contexto y Diagnóstico
En la versión `v0.4.6-alpha` se introdujo la ingestión directa de carpetas mediante la `FileSystem Access API`. Sin embargo, al apuntar a una carpeta sincronizada por **Google Drive para PC** o una carpeta local que contenía el histórico de viajes exportados por la app móvil BiTaVi Android, el cargador recopilaba todos los archivos de manera indiscriminada y los procesaba en bloque.

### Deficiencias del enfoque anterior:
1. **Saturación y mezcla de datos**: Si el usuario tenía 5 o 10 backups `.zip` en la misma carpeta de Drive (`backup_20261015.zip`, `backup_20261018.zip`, etc.), el sistema descomprimía y sobreescribía o mezclaba todas las rutas a la vez.
2. **Incomodidad operativa**: Para ver un viaje anterior o cambiar de expedición, el usuario debía navegar nuevamente por el explorador de archivos del sistema operativo.
3. **Consumo innecesario de CPU y memoria**: Se descomprimían decenas de megabytes de backups que el usuario no deseaba consultar en ese momento.

---

## 2. Nueva Arquitectura Táctica (`v0.4.10-alpha`)

Se implementó un flujo en dos fases: **Conexión de Carpeta** $\longrightarrow$ **Selección Quirúrgica de Backup**.

```
[Usuario pulsa "Conectar Carpeta (Drive / PC)"]
       │
       ▼
[FileSystem Access API / window.showDirectoryPicker()]
       │
       ▼
[FolderBackupLoader: Escaneo y Catalogación Inteligente]
   ├── Archivos .ZIP (backup_*.zip, ROUTE_*.zip)
   ├── Archivos .GPX
   └── Subcarpetas estructuradas (rutas.txt, puntos.txt)
       │
       ▼
[Modal Táctico: #folder-backup-modal]
   ├── Lista ordenada (más reciente arriba)
   ├── Nombre, tamaño formateado (MB/KB) y fecha
   ├── Filtro de búsqueda instantáneo
   └── Botón táctico "[CARGAR]"
       │
       ▼
[handleFiles([selectedBackup])] -> Carga limpia y aislada de esa expedición
```

---

## 3. Componentes Involucrados

### 3.1 `src/components/folder-loader.js` (`FolderBackupLoader`)
- **`connectDirectory(onProgress)`**: Conecta con el directorio y almacena el `FileSystemDirectoryHandle`.
- **`_scanDirectoryHandle(dirHandle)`**: Inspecciona los archivos de primer nivel y subdirectorios inmediatos para encontrar backups sin descender infinitamente.
- **`formatSize(bytes)`** y **`formatDate(timestamp)`**: Formateo táctico homogéneo para presentación visual.
- **`getBackupPayload(backupItem)`**: Extrae de forma perezosa (*lazy*) únicamente el archivo `File` del backup elegido cuando el usuario lo solicita.

### 3.2 Modal de Selección (`#folder-backup-modal` en `index.html`)
- Despliegue con backdrop táctico blur y botón de cierre.
- Indicador de carpeta activa conectada (`#folder-modal-dir-name`).
- Buscador reactivo en vivo (`#folder-backup-filter`) para filtrar por fecha o nombre.
- Botón `[🔄 Cambiar Carpeta]` para alternar de directorio sin cerrar la aplicación.

### 3.3 Barra de Carpeta Conectada en Panel 02 (`#connected-folder-bar`)
- Se activa en el Panel 02 cuando una carpeta ha sido enlazada.
- Muestra el nombre de la carpeta y la cantidad de backups disponibles.
- Incluye el botón `[Ver Backups]` para abrir el modal en cualquier momento y cambiar de viaje con 1 clic.

---

## 4. Beneficios Operativos
1. **Precisión Quirúrgica**: El usuario elige con exactitud cuál de los backups de Android desea visualizar.
2. **Cero Mezcla de Datos**: Cada expedición se abre de manera aislada y limpia.
3. **Persistencia en Sesión**: Mientras la pestaña permanezca abierta, la carpeta sigue conectada y accesible para conmutar entre diferentes viajes en segundos.
