import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { BiTaViNativeParser } from '../src/components/bitavi-native-parser.js';
import { PhotoHandler } from '../src/components/photo-parser.js';

describe('Prueba directa con archivos reales del usuario en Zip/', () => {
  const mockLayerGroup = { clearLayers: () => {}, addLayer: () => {}, removeLayer: () => {}, getLayers: () => [] };
  const mockMap = {
    map: { addLayer: () => {}, removeLayer: () => {}, fitBounds: () => {}, distance: () => 10 },
    fitBounds: () => {},
    routesLayerGroup: mockLayerGroup,
    markersLayerGroup: mockLayerGroup,
    favoritesLayerGroup: mockLayerGroup,
    routeMarkersLayerGroup: mockLayerGroup,
    routeArrowsLayerGroup: mockLayerGroup,
    photosLayerGroup: mockLayerGroup,
    addRouteArrows: () => mockLayerGroup
  };

  it('Carga ruta.json correctamente', () => {
    const parser = new BiTaViNativeParser(mockMap);
    const rutaJsonPath = path.resolve('Zip/ruta.json');
    if (!fs.existsSync(rutaJsonPath)) return;

    const rutaContent = fs.readFileSync(rutaJsonPath, 'utf-8');
    const success = parser.parseJsonData(rutaContent, 'ruta');

    expect(success).toBe(true);
    expect(parser.routes.length).toBe(1);
    const r = parser.routes[0];
    expect(r.name).toBe('2026-06-14 09:23 Lancha hasta La Becasina');
    const pts = parser.pointsByRoute.get(r.id);
    expect(pts.length).toBeGreaterThan(100);
    console.log('Puntos en ruta.json:', pts.length);
  });

  it('Carga favoritos.json y photoGeoMap', () => {
    const parser = new BiTaViNativeParser(mockMap);
    const favJsonPath = path.resolve('Zip/favoritos.json');
    if (!fs.existsSync(favJsonPath)) return;

    const favContent = fs.readFileSync(favJsonPath, 'utf-8');
    const success = parser.parseJsonData(favContent, 'favoritos');

    expect(success).toBe(true);
    expect(parser.favorites.length).toBe(21);
    const geoMap = parser.getPhotoGeoMap();
    console.log('Favoritos cargados:', parser.favorites.length);
    console.log('photoGeoMap size:', geoMap.size);
    expect(geoMap.has('img_gallery_1782522704648.jpg')).toBe(true);
  });

  it('Geolocaliza fotos de Zip/fotos con photoGeoMap', async () => {
    const parser = new BiTaViNativeParser(mockMap);
    const favContent = fs.readFileSync('Zip/favoritos.json', 'utf-8');
    parser.parseJsonData(favContent, 'favoritos');
    const photoGeoMap = parser.getPhotoGeoMap();

    const photoHandler = new PhotoHandler(mockMap);
    const fotosDir = path.resolve('Zip/fotos');
    if (!fs.existsSync(fotosDir)) return;

    const files = fs.readdirSync(fotosDir).map(name => {
      const buf = fs.readFileSync(path.join(fotosDir, name));
      return new File([buf], name, { type: 'image/jpeg' });
    });

    const result = await photoHandler.processPhotoFiles(files, [], photoGeoMap);
    console.log('Total fotos:', result.allPhotos.length);
    const conGps = result.allPhotos.filter(p => p.hasGps);
    console.log('Fotos con GPS:', conGps.length);
    expect(conGps.length).toBe(files.length);
  });
});
