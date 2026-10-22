import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import L from 'leaflet';
import { BiTaViNativeParser } from '../src/components/bitavi-native-parser.js';
import { PhotoHandler } from '../src/components/photo-parser.js';

describe('Flujo de handleFiles con los archivos del usuario', () => {
  it('Simula el flujo completo de carga de ruta.json + favoritos.json + fotos', async () => {
    const html = fs.readFileSync('index.html', 'utf8');
    document.body.innerHTML = html;

    const mapContainer = document.getElementById('map');
    // Mock básico de Leaflet map
    const mockLayerGroup = () => {
      const layers = [];
      return {
        clearLayers: () => { layers.length = 0; },
        addLayer: (l) => { layers.push(l); },
        removeLayer: (l) => {
          const idx = layers.indexOf(l);
          if (idx !== -1) layers.splice(idx, 1);
        },
        getLayers: () => layers,
        addTo: () => this
      };
    };

    const routesLayerGroup = mockLayerGroup();
    const photosLayerGroup = mockLayerGroup();
    const markersLayerGroup = mockLayerGroup();
    const favoritesLayerGroup = mockLayerGroup();
    const routeMarkersLayerGroup = mockLayerGroup();
    const routeArrowsLayerGroup = mockLayerGroup();

    const mockMapInstance = {
      map: {
        addLayer: () => {},
        removeLayer: () => {},
        fitBounds: () => {},
        distance: () => 10,
        mouseEventToContainerPoint: () => ({ x: 0, y: 0 }),
        containerPointToLatLng: () => ({ lat: 0, lng: 0 })
      },
      fitBounds: () => {},
      routesLayerGroup,
      photosLayerGroup,
      markersLayerGroup,
      favoritesLayerGroup,
      routeMarkersLayerGroup,
      routeArrowsLayerGroup,
      addRouteArrows: () => mockLayerGroup()
    };

    const nativeParser = new BiTaViNativeParser(mockMapInstance);
    const photoHandler = new PhotoHandler(mockMapInstance);

    if (!fs.existsSync('Zip/ruta.json') || !fs.existsSync('Zip/favoritos.json')) {
      return;
    }

    // 1. Archivos
    const rutaJsonText = fs.readFileSync('Zip/ruta.json', 'utf8');
    const favJsonText = fs.readFileSync('Zip/favoritos.json', 'utf8');

    // Parsear ruta.json
    const addedRuta = nativeParser.parseJsonData(rutaJsonText, 'ruta');
    expect(addedRuta).toBe(true);
    expect(nativeParser.routes.length).toBe(1);

    // Parsear favoritos.json
    const addedFav = nativeParser.parseJsonData(favJsonText, 'favoritos');
    expect(addedFav).toBe(true);
    expect(nativeParser.favorites.length).toBe(21);

    // Renderizar
    const bounds = nativeParser.renderRoute('all');
    console.log('Routes layers in map:', routesLayerGroup.getLayers().length);
    console.log('Bounds valid:', bounds.isValid());
    expect(routesLayerGroup.getLayers().length).toBeGreaterThan(0);
    expect(bounds.isValid()).toBe(true);

    // 2. Fotos
    const photoGeoMap = nativeParser.getPhotoGeoMap();
    expect(photoGeoMap.size).toBe(42);

    const fotosDir = 'Zip/fotos';
    const photoFiles = fs.readdirSync(fotosDir).map(name => {
      const buf = fs.readFileSync(path.join(fotosDir, name));
      return new File([buf], name, { type: 'image/jpeg' });
    });

    const photoRes = await photoHandler.processPhotoFiles(photoFiles, [], photoGeoMap);
    console.log('Photos processed:', photoRes.allPhotos.length);
    const withGps = photoRes.allPhotos.filter(p => p.hasGps);
    console.log('Photos with GPS:', withGps.length);
    expect(withGps.length).toBe(21);
    expect(photosLayerGroup.getLayers().length).toBe(21);
  });
});
