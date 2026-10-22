import { describe, it, expect } from 'vitest';
import { BiTaViNativeParser } from '../src/components/bitavi-native-parser.js';

describe('Soporte Universal de Rutas y Puntos en formato JSON / GeoJSON', () => {
  const mockLayerGroup = { clearLayers: () => {}, addLayer: () => {}, removeLayer: () => {} };
  const mockMap = {
    map: { addLayer: () => {}, removeLayer: () => {}, fitBounds: () => {}, distance: () => 10 },
    fitBounds: () => {},
    routesLayerGroup: mockLayerGroup,
    markersLayerGroup: mockLayerGroup,
    favoritesLayerGroup: mockLayerGroup,
    routeMarkersLayerGroup: mockLayerGroup,
    routeArrowsLayerGroup: mockLayerGroup,
    addRouteArrows: () => mockLayerGroup
  };

  it('Interpreta GeoJSON LineString y MultiLineString', () => {
    const parser = new BiTaViNativeParser(mockMap);
    const geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Recorrido Delta' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [-58.57, -34.38, 5],
              [-58.56, -34.35, 6],
              [-58.55, -34.32, 4]
            ]
          }
        }
      ]
    };

    const success = parser.parseJsonData(geojson, 'Test GeoJSON');
    expect(success).toBe(true);
    expect(parser.routes.length).toBe(1);
    expect(parser.routes[0].name).toBe('Recorrido Delta');
    const pts = parser.pointsByRoute.get(parser.routes[0].id);
    expect(pts.length).toBe(3);
    expect(pts[0].lat).toBeCloseTo(-34.38, 2);
    expect(pts[0].lng).toBeCloseTo(-58.57, 2);
  });

  it('Interpreta JSON con array de rutas en la raíz [ { name, points }, ... ]', () => {
    const parser = new BiTaViNativeParser(mockMap);
    const rootArray = [
      {
        id: 'r1',
        name: 'Ruta Montaña',
        points: [
          { lat: -32.89, lng: -68.84, ele: 750 },
          { lat: -32.90, lng: -68.85, ele: 760 }
        ]
      },
      {
        id: 'r2',
        name: 'Ruta Valle',
        coordinates: [
          [-32.91, -68.86],
          [-32.92, -68.87]
        ]
      }
    ];

    const success = parser.parseJsonData(rootArray, 'Expedición Raíz');
    expect(success).toBe(true);
    expect(parser.routes.length).toBe(2);
    expect(parser.routes[0].name).toBe('Ruta Montaña');
    expect(parser.routes[1].name).toBe('Ruta Valle');
  });

  it('Interpreta JSON con array plano de puntos agrupados por id_ruta', () => {
    const parser = new BiTaViNativeParser(mockMap);
    const flatPoints = [
      { id_ruta: 57, latitud: -34.56, longitud: -58.45, altitud: 45 },
      { id_ruta: 57, latitud: -34.57, longitud: -58.46, altitud: 46 },
      { id_ruta: 58, latitud: -34.70, longitud: -58.60, altitud: 20 },
      { id_ruta: 58, latitud: -34.71, longitud: -58.61, altitud: 22 }
    ];

    const success = parser.parseJsonData(flatPoints, 'Puntos Planos');
    expect(success).toBe(true);
    expect(parser.routes.length).toBe(2);
  });

  it('Interpreta JSON estilo Google Timeline Takeout con latitudeE7', () => {
    const parser = new BiTaViNativeParser(mockMap);
    const takeout = {
      locations: [
        { latitudeE7: -346037220, longitudeE7: -583815920, timestamp: '2026-06-15T10:00:00Z' },
        { latitudeE7: -346040000, longitudeE7: -583820000, timestamp: '2026-06-15T10:05:00Z' }
      ]
    };

    const success = parser.parseJsonData(takeout, 'Google Timeline');
    expect(success).toBe(true);
    expect(parser.routes.length).toBe(1);
    const pts = parser.pointsByRoute.get(parser.routes[0].id);
    expect(pts[0].lat).toBeCloseTo(-34.6037, 3);
    expect(pts[0].lng).toBeCloseTo(-58.3815, 3);
  });

  it('Interpreta JSON anidado con claves en español y paradas/fotos', () => {
    const parser = new BiTaViNativeParser(mockMap);
    const nested = {
      data: {
        rutas: [
          {
            nombre: 'Circuito Chico',
            coordenadas: [
              { lat: -41.13, lon: -71.30 },
              { lat: -41.14, lon: -71.32 }
            ]
          }
        ],
        favoritos: [
          {
            nombre: 'Mirador Panorámico',
            lat: -41.135,
            lon: -71.31,
            foto: 'MIRADOR_01.JPG'
          }
        ]
      }
    };

    const success = parser.parseJsonData(nested, 'Bariloche');
    expect(success).toBe(true);
    expect(parser.routes.length).toBe(1);
    expect(parser.favorites.length).toBe(1);
    expect(parser.favorites[0].name).toBe('Mirador Panorámico');
    const photoMap = parser.getPhotoGeoMap();
    expect(photoMap.has('mirador_01.jpg')).toBe(true);
  });

  it('Interpreta objeto JSON de una sola ruta', () => {
    const parser = new BiTaViNativeParser(mockMap);
    const singleRoute = {
      name: 'Travesía Nahuel Huapi',
      points: [
        { lat: -41.05, lng: -71.40 },
        { lat: -41.06, lng: -71.41 }
      ]
    };

    const success = parser.parseJsonData(singleRoute);
    expect(success).toBe(true);
    expect(parser.routes.length).toBe(1);
    expect(parser.routes[0].name).toBe('Travesía Nahuel Huapi');
  });

  it('Descubre automáticamente coordenadas en árboles JSON heterogéneos', () => {
    const parser = new BiTaViNativeParser(mockMap);
    const randomTree = {
      status: 200,
      payload: {
        device: 'Android Pixel',
        tripSummary: {
          traceLogs: [
            { y: -34.50, x: -58.50 },
            { y: -34.51, x: -58.51 }
          ]
        }
      }
    };

    const success = parser.parseJsonData(randomTree, 'Auto Heurística');
    expect(success).toBe(true);
    expect(parser.routes.length).toBe(1);
  });
});
