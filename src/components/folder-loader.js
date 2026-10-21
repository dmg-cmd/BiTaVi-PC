/**
 * Cargador y Conector de Carpetas de Expedición y Backups mediante FileSystem Access API
 * Permite conectar una carpeta local o sincronizada por Google Drive Desktop en PC,
 * catalogar todos los archivos de backup generados por BiTaVi Android (.ZIP / .GPX / carpetas)
 * y seleccionar de forma precisa cuál cargar sin sobrecargar la memoria ni mezclar datos.
 */
export class FolderBackupLoader {
  constructor() {
    this.isNativeSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
    this.connectedDirectoryHandle = null;
    this.connectedFolderName = '';
    this.cachedBackups = [];
    this.fallbackFiles = null;
  }

  /**
   * Conecta con una carpeta del sistema de archivos y cataloga los backups disponibles
   * @param {Function} onProgress Callback de telemetría táctica
   * @returns {Promise<{folderName: string, backups: Array, isSingleDirectBackup: boolean, directFiles?: File[]}>}
   */
  async connectDirectory(onProgress = null) {
    if (this.isNativeSupported) {
      return await this._connectWithFileSystemApi(onProgress);
    } else {
      return await this._connectWithInputFallback(onProgress);
    }
  }

  /**
   * Re-escanea la carpeta ya conectada sin volver a abrir el diálogo nativo
   */
  async refreshConnectedDirectory(onProgress = null) {
    if (this.connectedDirectoryHandle) {
      return await this._scanDirectoryHandle(this.connectedDirectoryHandle, onProgress);
    }
    return null;
  }

  /**
   * Formatea el tamaño en bytes a KB o MB
   */
  formatSize(bytes) {
    if (!bytes || bytes <= 0) return '0 KB';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  /**
   * Formatea un timestamp a fecha y hora local legible
   */
  formatDate(timestamp) {
    if (!timestamp) return 'Fecha no disponible';
    try {
      const d = new Date(timestamp);
      return d.toLocaleDateString('es-AR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (_) {
      return 'Fecha no disponible';
    }
  }

  /**
   * Conexión moderna mediante FileSystem Access API
   */
  async _connectWithFileSystemApi(onProgress) {
    let dirHandle;
    try {
      dirHandle = await window.showDirectoryPicker({
        id: 'bitavi-backup-folder',
        mode: 'read',
        startIn: 'documents'
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        return null;
      }
      console.warn('[FolderLoader] Falló showDirectoryPicker, recurriendo a fallback:', err);
      return await this._connectWithInputFallback(onProgress);
    }

    this.connectedDirectoryHandle = dirHandle;
    this.connectedFolderName = dirHandle.name;
    return await this._scanDirectoryHandle(dirHandle, onProgress);
  }

  /**
   * Determina si una entrada es un archivo o directorio basura del sistema operativo
   * (Windows, macOS, Linux, Google Drive temporal)
   */
  _isJunkEntry(name) {
    if (!name) return true;
    const trimmed = name.trim();
    if (trimmed.startsWith('.') || trimmed.startsWith('~$')) return true;
    const lower = trimmed.toLowerCase();
    if (
      lower === 'desktop.ini' ||
      lower === 'thumbs.db' ||
      lower === 'ehthumbs.db' ||
      lower === 'ntuser.dat' ||
      lower === '.ds_store' ||
      lower === '.nomedia' ||
      lower === 'icon\r' ||
      lower === '$recycle.bin' ||
      lower === 'system volume information' ||
      lower === 'node_modules'
    ) {
      return true;
    }
    if (
      lower.endsWith('.tmp') ||
      lower.endsWith('.temp') ||
      lower.endsWith('.crdownload') ||
      lower.endsWith('.part') ||
      lower.endsWith('.lnk') ||
      lower.endsWith('.url') ||
      lower.endsWith('.bak')
    ) {
      return true;
    }
    return false;
  }

  /**
   * Inspecciona rápidamente los primeros bytes del archivo (Magic Bytes)
   * para identificar con certeza si es un ZIP (PK) o GPX (<gpx / <?xml)
   * incluso si carece de extensión o fue renombrado por Android.
   */
  async _detectFileTypeFromBytes(fileObj) {
    if (!fileObj || fileObj.size < 2) return null;
    try {
      const slice = fileObj.slice(0, 64);
      const buffer = await slice.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // Firma Magic Bytes de ZIP: 0x50 0x4B ('PK')
      if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
        return 'zip';
      }

      // Firma XML / GPX / KML: 0x3C ('<')
      if (bytes[0] === 0x3C) {
        const text = new TextDecoder('utf-8').decode(bytes).toLowerCase();
        if (text.includes('<gpx') || text.includes('<?xml')) {
          return 'gpx';
        }
        if (text.includes('<kml')) {
          return 'geo';
        }
      }
    } catch (_) {}
    return null;
  }

  /**
   * Clasifica un archivo según su extensión y nombre para la visualización táctica
   */
  _classifyFile(fileName) {
    const lower = fileName.toLowerCase().trim();
    let type = 'other';
    let icon = '📄';
    let category = 'Archivo';

    if (
      lower.endsWith('.zip') ||
      lower.endsWith('.tar') ||
      lower.endsWith('.gz') ||
      lower.endsWith('.7z') ||
      lower.includes('.zip') ||
      lower.startsWith('backup_') ||
      lower.startsWith('bitavi_')
    ) {
      type = 'zip';
      icon = '📦';
      category = 'Backup Comprimido';
    } else if (lower.endsWith('.gpx')) {
      type = 'gpx';
      icon = '🗺️';
      category = 'Ruta GPS GPX';
    } else if (lower.endsWith('.kml') || lower.endsWith('.kmz') || lower.endsWith('.geojson') || lower.endsWith('.json')) {
      type = 'geo';
      icon = '🌐';
      category = 'Geodatos';
    } else if (
      lower === 'rutas.txt' ||
      lower === 'puntos.txt' ||
      lower === 'marcadores.txt' ||
      lower === 'favoritos.txt' ||
      lower.endsWith('.txt')
    ) {
      type = 'text';
      icon = '📝';
      category = 'Telemetría BiTaVi';
    } else if (/\.(jpg|jpeg|png|webp|heic)$/i.test(lower)) {
      type = 'photo';
      icon = '📷';
      category = 'Fotografía';
    }

    return { type, icon, category };
  }

  /**
   * Determina si un archivo es relevante para BiTaVi y no basura de sistema o sin extensión
   */
  _isUsefulBiTaViFile(type, fileName) {
    if (type === 'zip' || type === 'gpx' || type === 'text' || type === 'geo' || type === 'photo') {
      return true;
    }
    // Si sigue siendo 'other', solo se admite si tiene una extensión conocida válida y no es basura
    const lower = fileName.toLowerCase().trim();
    const validExtensions = ['.zip', '.gpx', '.kml', '.kmz', '.geojson', '.json', '.txt', '.jpg', '.jpeg', '.png', '.webp', '.heic'];
    return validExtensions.some(ext => lower.endsWith(ext));
  }

  /**
   * Generador asíncrono para iterar entradas de directorio de forma compatible con todos los navegadores
   */
  async *_getDirectoryEntries(handle) {
    if (typeof handle.values === 'function') {
      try {
        for await (const entry of handle.values()) {
          yield entry;
        }
        return;
      } catch (_) {}
    }
    if (typeof handle.entries === 'function') {
      try {
        for await (const [, entry] of handle.entries()) {
          yield entry;
        }
        return;
      } catch (_) {}
    }
    try {
      for await (const item of handle) {
        yield Array.isArray(item) ? item[1] : item;
      }
    } catch (e) {
      console.warn('[FolderLoader] No se pudo iterar directorio:', e);
    }
  }

  /**
   * Escanea el handle de directorio buscando backups y archivos de viaje de forma recursiva
   */
  async _scanDirectoryHandle(dirHandle, onProgress) {
    const folderName = dirHandle.name;
    const allFiles = [];
    const backups = [];

    onProgress?.({
      phase: 'Conectando con carpeta...',
      detail: `Escaneando archivos en ${folderName}...`,
      count: 0
    });

    let hasRutasTxt = false;
    let hasPuntosTxt = false;

    // Escaneo recursivo profundo (hasta 4 niveles de subcarpetas)
    const scanRecursively = async (handle, pathPrefix = '', depth = 0) => {
      if (depth > 4) return;
      try {
        for await (const entry of this._getDirectoryEntries(handle)) {
          if (!entry || !entry.name) continue;

          // Filtrar basura de sistema o carpetas reservadas
          if (this._isJunkEntry(entry.name)) {
            continue;
          }

          if (entry.kind === 'file') {
            const relPath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
            let { type, icon, category } = this._classifyFile(entry.name);

            // Intentar leer metadatos de forma no bloqueante
            let fileObj = null;
            let fileSize = 0;
            let fileLastModified = Date.now();
            let sizeFormatted = 'En nube / disco';
            let dateFormatted = 'Disponible para transferir';

            try {
              fileObj = await entry.getFile();
              fileSize = fileObj.size;
              fileLastModified = fileObj.lastModified;
              sizeFormatted = this.formatSize(fileSize);
              dateFormatted = this.formatDate(fileLastModified);
              try {
                Object.defineProperty(fileObj, 'relativePath', { value: relPath, writable: true, configurable: true });
              } catch (_) {}
            } catch (fileErr) {
              console.warn(`[FolderLoader] Metadatos diferidos para ${entry.name}:`, fileErr);
            }

            // Comprobación de Magic Bytes si no se reconoció por nombre o si fileObj está disponible
            if (fileObj) {
              const detectedType = await this._detectFileTypeFromBytes(fileObj);
              if (detectedType === 'zip') {
                type = 'zip';
                icon = '📦';
                category = 'Backup Comprimido (ZIP)';
              } else if (detectedType === 'gpx') {
                type = 'gpx';
                icon = '🗺️';
                category = 'Ruta GPS GPX';
              } else if (detectedType === 'geo') {
                type = 'geo';
                icon = '🌐';
                category = 'Geodatos';
              }
            }

            // Si el archivo NO es útil para BiTaVi (archivos sin extensión, binarios del sistema, etc.), se descarta
            if (!this._isUsefulBiTaViFile(type, entry.name)) {
              continue;
            }

            if (fileObj) {
              allFiles.push(fileObj);
            }

            const lower = entry.name.toLowerCase();
            if (lower === 'rutas.txt') hasRutasTxt = true;
            if (lower === 'puntos.txt') hasPuntosTxt = true;

            backups.push({
              id: `file-${relPath}`,
              name: entry.name,
              relPath: relPath,
              type: type,
              icon: icon,
              category: category,
              size: fileSize,
              sizeFormatted: sizeFormatted,
              lastModified: fileLastModified,
              dateFormatted: dateFormatted,
              file: fileObj,
              getFile: async () => {
                if (fileObj) return fileObj;
                const freshFile = await entry.getFile();
                try {
                  Object.defineProperty(freshFile, 'relativePath', { value: relPath, writable: true, configurable: true });
                } catch (_) {}
                return freshFile;
              }
            });

            if (backups.length % 5 === 0) {
              onProgress?.({
                phase: 'Indexando respaldos de la carpeta...',
                detail: `${backups.length} respaldos válidos en ${folderName}`,
                count: backups.length
              });
            }
          } else if (entry.kind === 'directory') {
            const nextPath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
            await scanRecursively(entry, nextPath, depth + 1);
          }
        }
      } catch (dirErr) {
        console.warn('[FolderLoader] Error escaneando directorio:', handle.name, dirErr);
      }
    };

    await scanRecursively(dirHandle, '', 0);

    // Ordenar los elementos: primero backups ZIP y rutas GPX/TXT, luego fotos y otros, por fecha descendente
    const typePriority = { zip: 1, gpx: 2, text: 3, geo: 4, photo: 5, other: 6 };
    backups.sort((a, b) => {
      const pA = typePriority[a.type] || 99;
      const pB = typePriority[b.type] || 99;
      if (pA !== pB) return pA - pB;
      return (b.lastModified || 0) - (a.lastModified || 0);
    });

    this.cachedBackups = backups;
    this.fallbackFiles = allFiles;

    const isSingleDirectBackup = hasRutasTxt && hasPuntosTxt;

    return {
      folderName,
      backups,
      allFiles,
      isSingleDirectBackup,
      directFiles: isSingleDirectBackup ? allFiles : null
    };
  }

  /**
   * Implementación de contingencia con <input type="file" webkitdirectory>
   */
  _connectWithInputFallback(onProgress) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.directory = true;
      input.multiple = true;
      input.style.display = 'none';
      document.body.appendChild(input);

      input.addEventListener('change', async () => {
        const fileList = input.files;
        document.body.removeChild(input);

        if (!fileList || fileList.length === 0) {
          resolve(null);
          return;
        }

        const files = Array.from(fileList);
        const folderName = files[0]?.webkitRelativePath?.split('/')[0] || 'Carpeta de Backup';
        this.connectedFolderName = folderName;
        this.fallbackFiles = files;

        const backups = [];
        let hasRutasTxt = false;
        let hasPuntosTxt = false;

        for (const file of files) {
          if (this._isJunkEntry(file.name)) {
            continue;
          }

          const relPath = file.webkitRelativePath || file.name;
          const fileName = file.name;
          let { type, icon, category } = this._classifyFile(fileName);

          // Detección por Magic Bytes si es necesario
          const detectedType = await this._detectFileTypeFromBytes(file);
          if (detectedType === 'zip') {
            type = 'zip';
            icon = '📦';
            category = 'Backup Comprimido (ZIP)';
          } else if (detectedType === 'gpx') {
            type = 'gpx';
            icon = '🗺️';
            category = 'Ruta GPS GPX';
          } else if (detectedType === 'geo') {
            type = 'geo';
            icon = '🌐';
            category = 'Geodatos';
          }

          // Descartar archivos basura o sin extensión no relacionados con BiTaVi
          if (!this._isUsefulBiTaViFile(type, fileName)) {
            continue;
          }

          const lower = fileName.toLowerCase();
          if (lower === 'rutas.txt') hasRutasTxt = true;
          if (lower === 'puntos.txt') hasPuntosTxt = true;

          backups.push({
            id: `file-${relPath}`,
            name: fileName,
            relPath: relPath,
            type: type,
            icon: icon,
            category: category,
            size: file.size,
            sizeFormatted: this.formatSize(file.size),
            lastModified: file.lastModified,
            dateFormatted: this.formatDate(file.lastModified),
            file: file,
            getFile: async () => file
          });
        }

        const typePriority = { zip: 1, gpx: 2, text: 3, geo: 4, photo: 5, other: 6 };
        backups.sort((a, b) => {
          const pA = typePriority[a.type] || 99;
          const pB = typePriority[b.type] || 99;
          if (pA !== pB) return pA - pB;
          return (b.lastModified || 0) - (a.lastModified || 0);
        });

        this.cachedBackups = backups;
        const isSingleDirectBackup = hasRutasTxt && hasPuntosTxt;

        resolve({
          folderName,
          backups,
          allFiles: files,
          isSingleDirectBackup,
          directFiles: isSingleDirectBackup ? files : null
        });
      });

      input.addEventListener('cancel', () => {
        document.body.removeChild(input);
        resolve(null);
      });

      input.click();
    });
  }

  /**
   * Obtiene los archivos a procesar para el backup seleccionado
   * @param {Object} backupItem
   * @returns {Promise<File[]>} Array de archivos listos para handleFiles
   */
  async getBackupPayload(backupItem) {
    if (!backupItem) return [];
    if (backupItem.type === 'zip' || backupItem.type === 'gpx') {
      const file = typeof backupItem.getFile === 'function' ? await backupItem.getFile() : backupItem.file;
      return [file];
    } else if (backupItem.type === 'folder') {
      const files = typeof backupItem.getFiles === 'function' ? await backupItem.getFiles() : backupItem.files;
      return files || [];
    }
    return [];
  }
}
