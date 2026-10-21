import { describe, it, expect } from 'vitest';
import { FolderBackupLoader } from '../src/components/folder-loader.js';

describe('Clasificación, Filtrado y Magic Bytes (folder-loader.js)', () => {
  const loader = new FolderBackupLoader();

  it('_isJunkEntry identifica y descarta archivos basura del sistema operativo', () => {
    // Archivos ocultos o temporales
    expect(loader._isJunkEntry('.DS_Store')).toBe(true);
    expect(loader._isJunkEntry('desktop.ini')).toBe(true);
    expect(loader._isJunkEntry('Thumbs.db')).toBe(true);
    expect(loader._isJunkEntry('ehthumbs.db')).toBe(true);
    expect(loader._isJunkEntry('~$archivo_temporal.docx')).toBe(true);
    expect(loader._isJunkEntry('.nomedia')).toBe(true);
    expect(loader._isJunkEntry('descarga.crdownload')).toBe(true);
    expect(loader._isJunkEntry('temporal.tmp')).toBe(true);

    // Archivos válidos
    expect(loader._isJunkEntry('backup_2026.zip')).toBe(false);
    expect(loader._isJunkEntry('recorrido.gpx')).toBe(false);
    expect(loader._isJunkEntry('rutas.txt')).toBe(false);
    expect(loader._isJunkEntry('foto.jpg')).toBe(false);
  });

  it('_classifyFile categoriza adecuadamente según nombre y extensión', () => {
    expect(loader._classifyFile('backup_expedicion.zip').type).toBe('zip');
    expect(loader._classifyFile('backup_20260626.tar').type).toBe('zip');
    expect(loader._classifyFile('recorrido.gpx').type).toBe('gpx');
    expect(loader._classifyFile('mapa.kml').type).toBe('geo');
    expect(loader._classifyFile('capa.kmz').type).toBe('geo');
    expect(loader._classifyFile('rutas.txt').type).toBe('text');
    expect(loader._classifyFile('puntos.txt').type).toBe('text');
    expect(loader._classifyFile('IMG_2026.jpg').type).toBe('photo');
    expect(loader._classifyFile('foto.png').type).toBe('photo');
  });

  it('_detectFileTypeFromBytes detecta Magic Bytes PK para archivos ZIP', async () => {
    // Crear un Uint8Array con los Magic Bytes de ZIP: 0x50, 0x4B ('PK')
    const zipBytes = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00]);
    const mockZipBlob = new Blob([zipBytes]);

    const detected = await loader._detectFileTypeFromBytes(mockZipBlob);
    expect(detected).toBe('zip');
  });

  it('_detectFileTypeFromBytes detecta Magic Bytes <gpx / <?xml para archivos GPX', async () => {
    const gpxText = '<?xml version="1.0"?><gpx version="1.1"></gpx>';
    const mockGpxBlob = new Blob([gpxText], { type: 'text/xml' });

    const detected = await loader._detectFileTypeFromBytes(mockGpxBlob);
    expect(detected).toBe('gpx');
  });
});
