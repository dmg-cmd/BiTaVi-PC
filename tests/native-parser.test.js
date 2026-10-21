import { describe, it, expect } from 'vitest';
import { BiTaViNativeParser } from '../src/components/bitavi-native-parser.js';

describe('Parser de Formato Nativo BiTaVi Android (bitavi-native-parser.js)', () => {
  const mockMapInstance = {
    map: {
      addLayer: () => {},
      removeLayer: () => {}
    }
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
});
