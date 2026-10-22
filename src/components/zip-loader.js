import JSZip from 'jszip';

export class ZipBackupHandler {
  constructor() {}

  /**
   * Procesa un archivo ZIP de backup de BiTaVi utilizando un Web Worker en segundo plano.
   * Si los Web Workers no están disponibles en el entorno, conmuta a procesamiento en el hilo principal.
   *
   * @param {File|Blob} zipFile Archivo ZIP a procesar.
   * @param {Function} onProgress Callback para notificar telemetría de progreso { percent, phase, currentFile }.
   * @returns {Promise<Object>} Datos extraídos del backup (rutas, fotos, metadatos, etc.).
   */
  async processZipBackup(zipFile, onProgress) {
    if (!zipFile) {
      throw new Error('Archivo ZIP no proporcionado.');
    }
    console.log('[ZipLoader] Iniciando procesamiento de:', zipFile.name, 'tamaño:', zipFile.size, 'bytes');

    // Intentar procesar en Web Worker para mantener la interfaz a 60 FPS
    if (typeof window !== 'undefined' && typeof window.Worker !== 'undefined') {
      try {
        return await this._processWithWorker(zipFile, onProgress);
      } catch (workerErr) {
        console.warn('[ZipLoader] Falló el procesamiento en Web Worker. Conmutando al hilo principal:', workerErr);
      }
    }

    return await this._processInMainThread(zipFile, onProgress);
  }

  /**
   * Ejecución asíncrona desacoplada en hilo secundario mediante Web Worker.
   */
  async _processWithWorker(zipFile, onProgress) {
    onProgress?.({ percent: 2, phase: 'Iniciando Web Worker de descompresión...' });

    const buffer = await zipFile.arrayBuffer();

    return new Promise((resolve, reject) => {
      let worker;
      try {
        worker = new Worker(new URL('../workers/zip-worker.js', import.meta.url), {
          type: 'module'
        });
      } catch (err) {
        return reject(err);
      }

      worker.onmessage = (e) => {
        const data = e.data;
        if (data.type === 'PROGRESS') {
          onProgress?.({
            percent: data.percent,
            phase: data.phase,
            currentFile: data.currentFile
          });
        } else if (data.type === 'SUCCESS') {
          worker.terminate();
          const rawResult = data.result;

          // Reconstruir los objetos File a partir de los buffers transferidos
          const imageFiles = (rawResult.images || []).map((img) => {
            return new File([img.buffer], img.name, { type: img.mimeType });
          });

          resolve({
            zipName: rawResult.zipName,
            fileSizeMb: rawResult.fileSizeMb,
            gpxText: rawResult.gpxText,
            gpxFileName: rawResult.gpxFileName,
            gpxFiles: rawResult.gpxFiles || (rawResult.gpxText ? [{ name: rawResult.gpxFileName || 'ruta.gpx', content: rawResult.gpxText }] : []),
            imageFiles,
            metadata: rawResult.metadata,
            textFiles: rawResult.textFiles,
            structureAnalysis: rawResult.structureAnalysis
          });
        } else if (data.type === 'ERROR') {
          worker.terminate();
          reject(new Error(data.error));
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        reject(new Error(err.message || 'Error en el Web Worker'));
      };

      // Transferir el buffer sin duplicación en RAM (Zero-Copy)
      worker.postMessage(
        {
          action: 'PROCESS_ZIP',
          buffer,
          fileName: zipFile.name,
          fileSize: zipFile.size
        },
        [buffer]
      );
    });
  }

  /**
   * Mecanismo de contingencia en el hilo principal si los Workers no están soportados.
   */
  async _processInMainThread(zipFile, onProgress) {
    onProgress?.({ percent: 5, phase: 'Leyendo estructura del archivo comprimido...' });
    const zip = new JSZip();
    const contents = await zip.loadAsync(zipFile);
    console.log('[ZipLoader] ZIP cargado en hilo principal. Archivos:', Object.keys(contents.files).length);

    let gpxText = null;
    let gpxFileName = null;
    const gpxFiles = [];
    const imageFiles = [];
    let metadata = null;
    const textFiles = [];
    const folders = [];
    const filesList = [];

    const entries = Object.keys(contents.files);
    let processedCount = 0;

    for (const filename of entries) {
      const entry = contents.files[filename];
      const startPercent = Math.min(85, Math.round(5 + (processedCount / Math.max(1, entries.length)) * 75));

      onProgress?.({
        percent: startPercent,
        currentFile: filename,
        phase: `Extrayendo archivo ${processedCount + 1} de ${entries.length} (${filename})...`
      });

      if (entry.dir) {
        folders.push(filename);
        processedCount++;
        continue;
      }

      const lowerName = filename.toLowerCase();
      const rawSize = entry._data ? entry._data.uncompressedSize || 0 : 0;
      const sizeFormatted = rawSize > 1024 * 1024
        ? `${(rawSize / (1024 * 1024)).toFixed(2)} MB`
        : `${(rawSize / 1024).toFixed(1)} KB`;

      let category = 'Desconocido';

      if (lowerName.endsWith('.gpx')) {
        category = 'Ruta GPX';
        try {
          const content = await entry.async('string');
          const cleanGpxName = filename.split('/').pop();
          gpxFiles.push({ name: cleanGpxName, path: filename, content });
          if (!gpxText) {
            gpxText = content;
            gpxFileName = cleanGpxName;
          }
        } catch (e) {
          console.warn('[ZipLoader] No se pudo extraer GPX', filename, e.message);
        }
      } else if (
        lowerName.endsWith('.jpg') ||
        lowerName.endsWith('.jpeg') ||
        lowerName.endsWith('.png') ||
        lowerName.endsWith('.webp') ||
        lowerName.endsWith('.heic')
      ) {
        category = 'Fotografía';
        try {
          const blob = await entry.async('blob');
          const cleanName = filename.split('/').pop();

          let mimeType = 'image/jpeg';
          if (lowerName.endsWith('.png')) mimeType = 'image/png';
          else if (lowerName.endsWith('.webp')) mimeType = 'image/webp';
          else if (lowerName.endsWith('.heic')) mimeType = 'image/heic';

          const file = new File([blob], cleanName, { type: mimeType });
          imageFiles.push(file);
        } catch (e) {
          console.warn('[ZipLoader] No se pudo extraer imagen', filename, e.message);
        }
      } else if (
        lowerName.endsWith('.json') ||
        lowerName.endsWith('.xml') ||
        lowerName.endsWith('.txt') ||
        lowerName.endsWith('.csv')
      ) {
        category = 'Config / Metadatos';
        try {
          const content = await entry.async('string');
          textFiles.push({ name: filename, content });

          if (lowerName.endsWith('.json')) {
            try {
              metadata = JSON.parse(content);
            } catch (e) {}
          }
        } catch (e) {
          console.warn('[ZipLoader] No se pudo extraer archivo de texto', filename, e.message);
        }
      } else if (
        lowerName.endsWith('.db') ||
        lowerName.endsWith('.sqlite') ||
        lowerName.endsWith('.realm')
      ) {
        category = 'Base de Datos App';
      }

      processedCount++;
      filesList.push({
        path: filename,
        sizeBytes: rawSize,
        sizeFormatted,
        category
      });
    }

    const structureAnalysis = {
      totalEntries: entries.length,
      folders,
      files: filesList,
      gpxCount: filesList.filter((f) => f.category === 'Ruta GPX').length,
      photoCount: imageFiles.length,
      configFilesCount: textFiles.length
    };

    return {
      zipName: zipFile.name,
      fileSizeMb: (zipFile.size / (1024 * 1024)).toFixed(2),
      gpxText,
      gpxFileName,
      gpxFiles,
      imageFiles,
      metadata,
      textFiles,
      structureAnalysis
    };
  }
}
