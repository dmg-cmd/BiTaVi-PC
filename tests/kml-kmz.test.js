import { describe, it, expect } from 'vitest';
import {
  escapeXml,
  hexToKmlColor,
  generateKmlXml
} from '../src/components/kml-kmz-exporter.js';

describe('Exportador KML y KMZ para Google Earth 3D (kml-kmz-exporter.js)', () => {
  it('escapeXml escapa adecuadamente caracteres reservados de XML', () => {
    expect(escapeXml('Ruta & "Táctica" <Alpha>')).toBe('Ruta &amp; &quot;Táctica&quot; &lt;Alpha&gt;');
    expect(escapeXml(null)).toBe('');
    expect(escapeXml('Ruta limpia')).toBe('Ruta limpia');
  });

  it('hexToKmlColor convierte colores RGB hexadecimales a formato inverso aabbggrr', () => {
    // Cian táctico: #00f0ff -> Alpha: ff, Blue: ff, Green: f0, Red: 00 -> fffff000
    expect(hexToKmlColor('#00f0ff', 'ff')).toBe('fffff000');

    // Rojo puro: #ff0000 -> f=ff, r=ff, g=00, b=00 -> ff0000ff
    expect(hexToKmlColor('#ff0000', 'ff')).toBe('ff0000ff');

    // Azul puro: #0000ff -> ff, r=00, g=00, b=ff -> ffff0000
    expect(hexToKmlColor('#0000ff', 'ff')).toBe('ffff0000');

    // Verde puro: #00ff00 -> ff, r=00, g=ff, b=00 -> ff00ff00
    expect(hexToKmlColor('#00ff00', 'ff')).toBe('ff00ff00');

    // Manejo de valores vacíos o inválidos
    expect(hexToKmlColor(null, 'ff')).toBe('ffffffff');
  });

  it('generateKmlXml genera un documento KML 2.2 válido con rutas y coordenadas 3D', () => {
    const mockData = {
      title: 'Misión Exploración Norte',
      routes: [
        {
          id: '1',
          name: 'Sendero Montaña',
          color: '#00f0ff',
          distanceKm: '5.20',
          points: [
            { lat: -34.6037, lng: -58.3816, ele: 25 },
            { lat: -34.6045, lng: -58.3790, ele: 32 }
          ]
        }
      ],
      waypoints: [
        { name: 'Punto Alpha', lat: -34.6037, lng: -58.3816, ele: 25, desc: 'Base principal' }
      ],
      photos: [
        { name: 'IMG_01.jpg', lat: -34.6045, lng: -58.3790, alt: 32, dateStr: '2026-10-21 15:30' }
      ]
    };

    const xml = generateKmlXml(mockData, false);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<kml xmlns="http://www.opengis.net/kml/2.2"');
    expect(xml).toContain('<name>Misión Exploración Norte</name>');
    expect(xml).toContain('<Placemark>');
    expect(xml).toContain('<LineString>');
    expect(xml).toContain('<tessellate>1</tessellate>');
    expect(xml).toContain('-58.3816,-34.6037,25 -58.379,-34.6045,32');
    expect(xml).toContain('<name>Punto Alpha</name>');
    expect(xml).toContain('<name>IMG_01.jpg</name>');
  });

  it('generateKmlXml incluye referencias locales de imágenes para contenedor KMZ', () => {
    const mockData = {
      title: 'Ruta con Fotos',
      photos: [
        { name: 'foto_cumbre.jpg', lat: -34.60, lng: -58.38, alt: 100 }
      ]
    };

    const kmzXml = generateKmlXml(mockData, true);
    expect(kmzXml).toContain('src="files/foto_cumbre.jpg"');
  });
});
