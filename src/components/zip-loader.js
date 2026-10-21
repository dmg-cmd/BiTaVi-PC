import JSZip from 'jszip';

export class ZipBackupHandler {
  constructor() {}

  async processZipBackup(zipFile, onProgress) {
    if (!zipFile) {
      throw new Error('Archivo ZIP no proporcionado.');
    }
    console.log('[ZipLoader] Iniciando procesamiento de:', zipFile.name, 'tamaño:', zipFile.size, 'bytes');
    onProgress?.({ percent: 0, phase: 'Iniciando lectura del archivo...' });

    try {
      onProgress?.({ percent: 5, phase: 'Leyendo estructura del archivo comprimido...' });
      const zip = new JSZip();
      const contents = await zip.loadAsync(zipFile);
      console.log('[ZipLoader] ZIP cargado. Archivos:', Object.keys(contents.files).length);

      let gpxText = null;
      let gpxFileName = null;
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
          : `${(rawSize / (1024)).toFixed(1)} KB`;

        let category = 'Desconocido';

        if (lowerName.endsWith('.gpx')) {
          category = 'Ruta GPX';
          if (!gpxText) {
            try {
              gpxText = await entry.async('string');
              gpxFileName = filename.split('/').pop();
            } catch (e) {
              console.warn('[ZipLoader] No se pudo extraer GPX', filename, e.message);
            }
          }
        }
        else if (
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
            if (lowerName.endsWith('.webp')) mimeType = 'image/webp';
            if (lowerName.endsWith('.heic')) mimeType = 'image/heic';

            const file = new File([blob], cleanName, { type: mimeType });
            imageFiles.push(file);
          } catch (e) {
            console.warn('[ZipLoader] No se pudo extraer imagen', filename, e.message);
          }
        }
        else if (lowerName.endsWith('.json') || lowerName.endsWith('.xml') || lowerName.endsWith('.txt') || lowerName.endsWith('.csv')) {
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
        }
        else if (lowerName.endsWith('.db') || lowerName.endsWith('.sqlite') || lowerName.endsWith('.realm')) {
          category = 'Base de Datos App';
        }

        processedCount++;
        const currentPercent = Math.min(85, Math.round(5 + (processedCount / Math.max(1, entries.length)) * 75));
        onProgress?.({
          percent: currentPercent,
          currentFile: filename,
          phase: `Extrayendo archivo ${processedCount} de ${entries.length} (${filename})...`
        });

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
        gpxCount: filesList.filter(f => f.category === 'Ruta GPX').length,
        photoCount: imageFiles.length,
        configFilesCount: textFiles.length
      };

      return {
        zipName: zipFile.name,
        fileSizeMb: (zipFile.size / (1024 * 1024)).toFixed(2),
        gpxText,
        gpxFileName,
        imageFiles,
        metadata,
        textFiles,
        structureAnalysis
      };
    } catch (err) {
      console.error('[ZipLoader] Error procesando ZIP:', err);
      throw new Error(`Error al procesar el archivo ZIP: ${err.message}`);
    }
  }
}