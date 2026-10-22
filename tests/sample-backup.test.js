import { describe, it, expect } from 'vitest';
import fs from 'fs';
import JSZip from 'jszip';
import { BiTaViNativeParser } from '../src/components/bitavi-native-parser.js';

describe('Prueba DOM y carga completa de rutas y fotos', () => {
  it('Carga backup real y puebla selector de rutas y fotos', async () => {
    const zipPath = 'sample-data/backup_20260626_2305-Becasina.zip';
    const data = fs.readFileSync(zipPath);
    const zip = await JSZip.loadAsync(data);

    const textFilesMap = new Map();
    for (const name of Object.keys(zip.files)) {
      if (name.endsWith('.txt')) {
        const txt = await zip.files[name].async('text');
        textFilesMap.set(name.toLowerCase(), txt);
      }
    }

    const mockLayerGroup = { clearLayers: () => {}, addLayer: () => {}, removeLayer: () => {} };
    const mockMap = {
      map: {
        addLayer: () => {},
        removeLayer: () => {},
        fitBounds: () => {},
        distance: () => 10
      },
      fitBounds: () => {},
      routesLayerGroup: mockLayerGroup,
      markersLayerGroup: mockLayerGroup,
      favoritesLayerGroup: mockLayerGroup,
      routeMarkersLayerGroup: mockLayerGroup,
      routeArrowsLayerGroup: mockLayerGroup,
      addRouteArrows: () => mockLayerGroup
    };

    const parser = new BiTaViNativeParser(mockMap);
    const stats = parser.processNativeData(textFilesMap);

    expect(stats.routes.length).toBe(21);
    expect(stats.totalPoints).toBe(71395);

    const bounds = parser.renderRoute('all');
    expect(bounds.isValid()).toBe(true);
  });
});
