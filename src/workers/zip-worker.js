// Web Worker dedicado para descompresión masiva de archivos ZIP de BiTaVi
// Ejecuta JSZip en un hilo en segundo plano para evitar bloqueos del DOM y congelamientos del mapa.
import JSZip from 'jszip';

self.onmessage = async (e) => {
  const { action, buffer, fileName, fileSize } = e.data;

  if (action !== 'PROCESS_ZIP') return;

  const reportProgress = (percent, phase, currentFile = '') => {
    self.postMessage({
      type: 'PROGRESS',
      percent,
      phase,
      currentFile
    });
  };

  try {
    reportProgress(5, 'Leyendo estructura del archivo comprimido en segundo plano...');

    const zip = new JSZip();
    const contents = await zip.loadAsync(buffer);
    const entries = Object.keys(contents.files);

    reportProgress(10, `ZIP decodificado. ${entries.length} archivos detectados.`);

    let gpxText = null;
    let gpxFileName = null;
    let metadata = null;
    const textFiles = [];
    const folders = [];
    const filesList = [];
    const images = [];
    const transferableBuffers = [];

    let processedCount = 0;

    for (const filename of entries) {
      const entry = contents.files[filename];
      const startPercent = Math.min(85, Math.round(10 + (processedCount / Math.max(1, entries.length)) * 75));

      reportProgress(
        startPercent,
        `Extrayendo archivo ${processedCount + 1} de ${entries.length}...`,
        filename
      );

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
        if (!gpxText) {
          try {
            gpxText = await entry.async('string');
            gpxFileName = filename.split('/').pop();
          } catch (err) {
            // Ignorar archivo corrupto
          }
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
          const imgBuffer = await entry.async('arraybuffer');
          const cleanName = filename.split('/').pop();

          let mimeType = 'image/jpeg';
          if (lowerName.endsWith('.png')) mimeType = 'image/png';
          else if (lowerName.endsWith('.webp')) mimeType = 'image/webp';
          else if (lowerName.endsWith('.heic')) mimeType = 'image/heic';

          images.push({
            name: cleanName,
            mimeType,
            buffer: imgBuffer
          });
          transferableBuffers.push(imgBuffer);
        } catch (err) {
          // Ignorar imagen corrupta
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
            } catch (err) {}
          }
        } catch (err) {
          // Ignorar archivo de texto no legible
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

    reportProgress(90, 'Estructura descomprimida. Finalizando transferencia...');

    const structureAnalysis = {
      totalEntries: entries.length,
      folders,
      files: filesList,
      gpxCount: filesList.filter((f) => f.category === 'Ruta GPX').length,
      photoCount: images.length,
      configFilesCount: textFiles.length
    };

    self.postMessage(
      {
        type: 'SUCCESS',
        result: {
          zipName: fileName,
          fileSizeMb: (fileSize / (1024 * 1024)).toFixed(2),
          gpxText,
          gpxFileName,
          images,
          metadata,
          textFiles,
          structureAnalysis
        }
      },
      transferableBuffers
    );
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error.message || 'Error desconocido al descomprimir ZIP en el Worker'
    });
  }
};
