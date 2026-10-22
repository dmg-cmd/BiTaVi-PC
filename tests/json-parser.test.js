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

  it('Interpreta JSON con array de rutas con puntos embebidos', () => {
    const parser = new BiTaViNativeParser(mockMap);
    const json = {
      routes: [
        {
          id: '101',
          name: 'Ruta Paranacito 2026-06-14',
          points: [
            { lat: -34.21, lng: -58.57, ele: 10 },
            { lat: -34.22, lng: -58.58, ele: 12 }
          ]
        }
      ]
    };

    const success = parser.parseJsonData(json);
    expect(success).toBe(true);
    expect(parser.routes.length).toBe(1);
    expect(parser.routes[0].name).toBe('Ruta Paranacito 2026-06-14');
  });

  it('Interpreta array directo de puntos [[lat, lng], ...]', () => {
    const parser = new BiTaViNativeParser(mockMap);
    const coords = [
      [-34.60, -58.38],
      [-34.61, -58.39]
    ];

    const success = parser.parseJsonData(coords, 'Traza Directa');
    expect(success).toBe(true);
    expect(parser.routes.length).toBe(1);
    expect(parser.routes[0].name).toBe('Traza Directa');
  });
});
