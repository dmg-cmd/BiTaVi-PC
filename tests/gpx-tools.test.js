import { describe, it, expect } from 'vitest';
import { sanitizeFilename, createGpxXml } from '../src/components/gpx-parser.js';

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
});
