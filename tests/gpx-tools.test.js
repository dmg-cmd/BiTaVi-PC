import { describe, it, expect } from 'vitest';
import { sanitizeFilename, createGpxXml, createCombinedGpxXml, extractRouteDateSlug, groupRoutesByDay } from '../src/components/gpx-parser.js';

describe('Herramientas GPX y Saneamiento de Archivos (gpx-parser.js)', () => {
  it('sanitizeFilename limpia caracteres ilegales en Windows y Linux', () => {
    expect(sanitizeFilename('Ruta: Norte / Tramo 1 * final ?')).toBe('Ruta_ Norte _ Tramo 1 _ final _');
    expect(sanitizeFilename('Ruta<Táctica>|2')).toBe('Ruta_Táctica_2');
    expect(sanitizeFilename('', 'fallback')).toBe('fallback');
    expect(sanitizeFilename(null, 'fallback')).toBe('fallback');
    expect(sanitizeFilename('Mi_Ruta_Valida.gpx')).toBe('Mi_Ruta_Valida.gpx');
  });

  it('createGpxXml genera un documento XML GPX 1.1 estándar con metadatos y tracks', () => {
    const points = [
      { lat: -34.6037, lng: -58.3816, ele: 25.5, time: '2026-10-21T14:00:00Z', speed: 4.2 },
      { lat: -34.6080, lng: -58.3720, ele: 22.0, time: '2026-10-21T14:10:00Z', speed: 5.1 }
    ];
    const waypoints = [
      { name: 'Punto Control', lat: -34.6037, lng: -58.3816, ele: 25.5 }
    ];

    const xml = createGpxXml('Patrullaje Bravo', points, waypoints);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<gpx version="1.1" creator="BiTaVi PC"');
    expect(xml).toContain('<name>Patrullaje Bravo</name>');
    expect(xml).toContain('<wpt lat="-34.6037" lon="-58.3816">');
    expect(xml).toContain('<name>Punto Control</name>');
    expect(xml).toContain('<trkpt lat="-34.6037" lon="-58.3816">');
    expect(xml).toContain('<ele>25.5</ele>');
    expect(xml).toContain('<time>2026-10-21T14:00:00Z</time>');
    expect(xml).toContain('<speed>4.2</speed>');
  });

  it('createCombinedGpxXml une múltiples tramos de ruta en un único GPX multisegmento', () => {
    const segment1 = [
      { lat: -34.601, lng: -58.380, ele: 10, time: '2026-06-26T10:00:00Z' },
      { lat: -34.602, lng: -58.381, ele: 12, time: '2026-06-26T10:05:00Z' }
    ];
    const segment2 = [
      { lat: -34.610, lng: -58.390, ele: 15, time: '2026-06-26T11:00:00Z' },
      { lat: -34.612, lng: -58.392, ele: 18, time: '2026-06-26T11:15:00Z' }
    ];

    const xml = createCombinedGpxXml('Ruta Completa Unificada', [segment1, segment2]);

    expect(xml).toContain('<name>Ruta Completa Unificada</name>');
    // Debe contener 2 bloques <trkseg> dentro del mismo <trk>
    const trksegMatches = xml.match(/<trkseg>/g) || [];
    expect(trksegMatches.length).toBe(2);
    expect(xml).toContain('lat="-34.601"');
    expect(xml).toContain('lat="-34.612"');
  });

  it('extractRouteDateSlug extrae fechas válidas en formato YYYY-MM-DD', () => {
    // Caso 1: startTime numérico
    const route1 = { name: 'Expedición Sur', startTime: 1782470400000 };
    expect(extractRouteDateSlug(route1)).toBe(new Date(1782470400000).toISOString().split('T')[0]);

    // Caso 2: fecha en el primer punto
    const route2 = { name: 'Travesía' };
    const points2 = [{ time: '2026-08-15T09:30:00Z' }];
    expect(extractRouteDateSlug(route2, points2)).toBe('2026-08-15');

    // Caso 3: fecha en el nombre de la ruta
    const route3 = { name: 'backup_20260626_2305' };
    expect(extractRouteDateSlug(route3)).toBe('2026-06-26');

    const route4 = { name: 'Ruta_2026-04-12_montana' };
    expect(extractRouteDateSlug(route4)).toBe('2026-04-12');
  });

  it('groupRoutesByDay agrupa correctamente las rutas por su fecha cronológica', () => {
    const routes = [
      { id: '1', name: 'Ruta_2026-06-25_Mañana' },
      { id: '2', name: 'Ruta_2026-06-25_Tarde' },
      { id: '3', name: 'Ruta_2026-06-26_Etapa1' }
    ];

    const grouped = groupRoutesByDay(routes);

    expect(grouped.size).toBe(2);
    expect(grouped.has('2026-06-25')).toBe(true);
    expect(grouped.has('2026-06-26')).toBe(true);
    expect(grouped.get('2026-06-25').length).toBe(2);
    expect(grouped.get('2026-06-26').length).toBe(1);
    expect(grouped.get('2026-06-25')[0].id).toBe('1');
    expect(grouped.get('2026-06-25')[1].id).toBe('2');
  });
});
