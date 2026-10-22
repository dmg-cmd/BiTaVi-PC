import { describe, it, expect } from 'vitest';
import { FolderBackupLoader } from '../src/components/folder-loader.js';

describe('FolderBackupLoader - Detección de carpetas nativas y carga unificada', () => {
  it('Clasifica ruta.json y favoritos.json como geodatos válidos', () => {
    const loader = new FolderBackupLoader();
    const c1 = loader._classifyFile('ruta.json');
    expect(c1.type).toBe('geo');
    const c2 = loader._classifyFile('favoritos.json');
    expect(c2.type).toBe('geo');
    expect(loader._isUsefulBiTaViFile(c1.type, 'ruta.json')).toBe(true);
  });

  it('getBackupPayload agrupa los archivos hermanos de la expedición cuando se selecciona un JSON o foto', async () => {
    const loader = new FolderBackupLoader();
    const mockRutaFile = new File(['{"route":{}}'], 'ruta.json', { type: 'application/json' });
    const mockFavFile = new File(['{"favorites":[]}'], 'favoritos.json', { type: 'application/json' });
    const mockFotoFile = new File(['fakeimg'], 'IMG_1.jpg', { type: 'image/jpeg' });

    loader.cachedBackups = [
      { name: 'ruta.json', relPath: 'ruta.json', type: 'geo', file: mockRutaFile },
      { name: 'favoritos.json', relPath: 'favoritos.json', type: 'geo', file: mockFavFile },
      { name: 'IMG_1.jpg', relPath: 'fotos/IMG_1.jpg', type: 'photo', file: mockFotoFile }
    ];

    // Al pedir el payload de ruta.json, debe retornar los archivos relacionados
    const payload = await loader.getBackupPayload(loader.cachedBackups[0]);
    expect(payload.length).toBeGreaterThanOrEqual(2);
    const names = payload.map(f => f.name);
    expect(names).toContain('ruta.json');
    expect(names).toContain('favoritos.json');
  });
});
