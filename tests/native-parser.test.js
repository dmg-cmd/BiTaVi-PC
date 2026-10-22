import { describe, it, expect } from 'vitest';
import { BiTaViNativeParser, parseFlexibleTimestamp } from '../src/components/bitavi-native-parser.js';

describe('Parser de Formato Nativo BiTaVi Android (bitavi-native-parser.js)', () => {
  const mockMapInstance = {
    map: {
      addLayer: () => {},
      removeLayer: () => {}
    },
    routesLayerGroup: { clearLayers: () => {}, addLayer: () => {} },
    routeMarkersLayerGroup: { clearLayers: () => {}, addLayer: () => {} },
    addRouteArrows: () => ({ clearLayers: () => {} })
  };

  it('parseRoutes parsea correctamente el formato rutas.txt separado por pipes', () => {
    const parser = new BiTaViNativeParser(mockMapInstance);
    // Formato: id|name|startTime|endTime|distanceM|maxSpeed|avgSpeed
    const content = '1|Ruta Salto del Agua|1729515600000|1729519200000|5400|12.5|8.2\n2|Patrulla Base|1729520000000|1729523600000|3200|9.0|6.5';

    parser.parseRoutes(content);

    expect(parser.routes.length).toBe(2);
    expect(parser.routes[0].id).toBe('1');
    expect(parser.routes[0].name).toBe('Ruta Salto del Agua');
    expect(parser.routes[0].distanceKm).toBe('5.40');
    expect(parser.routes[0].maxSpeed).toBe('12.5');
    expect(parser.routes[0].avgSpeed).toBe('8.2');
    expect(parser.routes[0].durationMin).toBe(60);

    expect(parser.routes[1].id).toBe('2');
    expect(parser.routes[1].distanceKm).toBe('3.20');
  });

  it('parsePoints asigna los puntos de telemetría a sus respectivas rutas', () => {
    const parser = new BiTaViNativeParser(mockMapInstance);
    // Formato: routeId|lat|lng|ele|speed|timestamp
    const content = '1|-34.6037|-58.3816|25.0|4.2|1729515600000\n1|-34.6045|-58.3790|26.2|5.1|1729515660000\n2|-34.7000|-58.4000|10.0|3.0|1729520000000';

    parser.parsePoints(content);

    expect(parser.pointsByRoute.has('1')).toBe(true);
    expect(parser.pointsByRoute.has('2')).toBe(true);

    const pts1 = parser.pointsByRoute.get('1');
    expect(pts1.length).toBe(2);
    expect(pts1[0].lat).toBe(-34.6037);
    expect(pts1[0].lng).toBe(-58.3816);
    expect(pts1[0].ele).toBe(25.0);
    expect(pts1[0].speed).toBe(4.2);

    const pts2 = parser.pointsByRoute.get('2');
    expect(pts2.length).toBe(1);
    expect(pts2[0].lat).toBe(-34.7000);
  });

  it('parseMarkers extrae marcadores con coordenadas y descripciones', () => {
    const parser = new BiTaViNativeParser(mockMapInstance);
    // Formato: id|name|desc|lat|lng|...
    const content = 'm1|Campamento Alpha|Base logística de expedición|-34.6037|-58.3816|||#FF5722';

    parser.parseMarkers(content);

    expect(parser.markers.length).toBe(1);
    expect(parser.markers[0].name).toBe('Campamento Alpha');
    expect(parser.markers[0].desc).toBe('Base logística de expedición');
    expect(parser.markers[0].lat).toBe(-34.6037);
    expect(parser.markers[0].lng).toBe(-58.3816);
  });

  it('parseFlexibleTimestamp procesa segundos, milisegundos y formatos de texto', () => {
    // Segundos Unix (10 dígitos)
    expect(parseFlexibleTimestamp(1719430000)).toBe(1719430000000);
    // Milisegundos
    expect(parseFlexibleTimestamp(1719430000000)).toBe(1719430000000);
    // Texto ISO
    const isoDate = parseFlexibleTimestamp('2026-06-26 14:30:00');
    expect(isoDate).not.toBeNull();
    expect(new Date(isoDate).toISOString().split('T')[0]).toBe('2026-06-26');
    // Texto DD/MM/YYYY
    const dmyDate = parseFlexibleTimestamp('26/06/2026 10:00:00');
    expect(dmyDate).not.toBeNull();
    expect(new Date(dmyDate).getFullYear()).toBe(2026);
  });

  it('processNativeData hereda startTime a la ruta si viene vacío en rutas.txt pero presente en puntos.txt', () => {
    const parser = new BiTaViNativeParser(mockMapInstance);
    const map = new Map();
    // rutas.txt sin startTime (vacío en parts[2])
    map.set('rutas.txt', '10|Ruta Sin Fecha Inicial|||5000|10|5');
    // puntos.txt con timestamp de fecha
    map.set('puntos.txt', '10|-34.60|-58.38|20|4|1719430000'); // en segundos -> 2024-06-26

    parser.processNativeData(map);

    expect(parser.routes.length).toBe(1);
    expect(parser.routes[0].startTime).toBe(1719430000000);
    expect(parser.routes[0].startDate).not.toBe('Fecha N/D');
  });
});
