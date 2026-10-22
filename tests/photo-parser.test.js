import { describe, it, expect } from 'vitest';
import fs from 'fs';
import JSZip from 'jszip';
import { PhotoHandler } from '../src/components/photo-parser.js';

describe('Geolocalización de fotos con EXIF y Favoritos', () => {
  it('Extrae coordenadas GPS de fotos tomadas con el celular', async () => {
    const zipPath = 'sample-data/backup_20260626_2305-Becasina.zip';
    if (!fs.existsSync(zipPath)) return;

    const data = fs.readFileSync(zipPath);
    const zip = await JSZip.loadAsync(data);

    // Tomar 3 fotos de prueba que tengan EXIF
    const imgEntries = Object.keys(zip.files).filter(f => f.includes('IMG_1782242491909') || f.includes('IMG_1782246173728'));
    const files = [];
    for (const name of imgEntries) {
      const buf = await zip.files[name].async('uint8array');
      const cleanName = name.split('/').pop();
      files.push(new File([buf], cleanName, { type: 'image/jpeg' }));
    }

    const mockMap = {
      map: {
        addLayer: () => {},
        removeLayer: () => {},
        fitBounds: () => {}
      },
      routesLayerGroup: { getLayers: () => [] },
      photosLayerGroup: { addLayer: () => {}, clearLayers: () => {} },
      fitBounds: () => {}
    };

    const handler = new PhotoHandler(mockMap);
    const result = await handler.processPhotoFiles(files);

    expect(result.allPhotos.length).toBe(files.length);
    const withGps = result.allPhotos.filter(p => p.hasGps && p.lat !== null && p.lng !== null);
    expect(withGps.length).toBe(files.length);
    expect(withGps[0].lat).toBeCloseTo(-34.5885, 2);
    expect(withGps[0].lng).toBeCloseTo(-58.4107, 2);
    expect(withGps[0].camera).toContain('Pixel');
  });

  it('Geolocaliza fotos de galería sin EXIF mediante el mapa de favoritos', async () => {
    const photoGeoMap = new Map();
    photoGeoMap.set('img_gallery_test.jpg', { lat: -34.3835, lng: -58.5690 });

    const dummyFile = new File([new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0])], 'IMG_GALLERY_TEST.jpg', { type: 'image/jpeg' });

    const mockMap = {
      map: {
        addLayer: () => {},
        removeLayer: () => {},
        fitBounds: () => {}
      },
      routesLayerGroup: { getLayers: () => [] },
      photosLayerGroup: { addLayer: () => {}, clearLayers: () => {} },
      fitBounds: () => {}
    };

    const handler = new PhotoHandler(mockMap);
    const result = await handler.processPhotoFiles([dummyFile], [], photoGeoMap);

    expect(result.allPhotos.length).toBe(1);
    expect(result.allPhotos[0].hasGps).toBe(true);
    expect(result.allPhotos[0].lat).toBeCloseTo(-34.3835, 3);
    expect(result.allPhotos[0].lng).toBeCloseTo(-58.5690, 3);
  });
});
