import { describe, it, expect, vi, beforeEach } from 'vitest';

// Se aísla exifr para poder simular fotos con distintos bloques EXIF/XMP
// sin depender de fixtures binarios en el repositorio.
vi.mock('exifr', () => ({
  default: {
    parse: vi.fn(),
    gps: vi.fn()
  }
}));

import exifr from 'exifr';
import {
  PhotoHandler,
  dmsToDecimal,
  gpsEnRango,
  esArchivoImagen,
  leerGpsFoto
} from '../src/components/photo-parser.js';

const mockLayerGroup = { addLayer: () => {}, removeLayer: () => {}, clearLayers: () => {}, getLayers: () => [] };
const mockMap = {
  map: { addLayer: () => {}, removeLayer: () => {}, fitBounds: () => {} },
  routesLayerGroup: mockLayerGroup,
  photosLayerGroup: mockLayerGroup,
  fitBounds: () => {}
};

function dummyJpg(name = 'IMG_1782404077137.jpg') {
  return new File([new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1])], name, { type: 'image/jpeg' });
}

describe('Conversión DMS → decimal', () => {
  it('Convierte arrays EXIF con referencia S/W a valores negativos', () => {
    expect(dmsToDecimal([34, 25, 18.2808], 'S')).toBeCloseTo(-34.4217447, 6);
    expect(dmsToDecimal([58, 34, 47.5568], 'W')).toBeCloseTo(-58.5798769, 6);
    expect(dmsToDecimal([34, 25, 18.2808], 'N')).toBeCloseTo(34.4217447, 6);
  });

  it('Convierte texto XMP "grados,minutos.decimal"', () => {
    expect(dmsToDecimal('34,25.30468S')).toBeCloseTo(-34.4217447, 6);
    expect(dmsToDecimal('58,34.792613W')).toBeCloseTo(-58.5798769, 6);
  });

  it('Convierte notación con símbolos y coma decimal', () => {
    expect(dmsToDecimal(`34°25'18.28" S`)).toBeCloseTo(-34.4217447, 6);
    expect(dmsToDecimal('34,4217448')).toBeCloseTo(34.4217448, 7);
    expect(dmsToDecimal(-34.4217448)).toBeCloseTo(-34.4217448, 7);
    expect(dmsToDecimal(null)).toBeNaN();
    expect(dmsToDecimal('sin datos')).toBeNaN();
  });
});

describe('Validación de imágenes y coordenadas', () => {
  it('Acepta imágenes aunque el tipo MIME venga vacío (Tauri/ZIP)', () => {
    expect(esArchivoImagen(new File([], 'foto.JPG', { type: '' }))).toBe(true);
    expect(esArchivoImagen(new File([], 'foto.jpeg', { type: '' }))).toBe(true);
    expect(esArchivoImagen(new File([], 'notas.txt', { type: '' }))).toBe(false);
    expect(esArchivoImagen(null)).toBe(false);
  });

  it('Rechaza coordenadas nulas o fuera de rango', () => {
    expect(gpsEnRango(-34.4, -58.5)).toBe(true);
    expect(gpsEnRango(0, 0)).toBe(false);
    expect(gpsEnRango(NaN, -58.5)).toBe(false);
    expect(gpsEnRango(91, 0)).toBe(false);
    expect(gpsEnRango(0, 181)).toBe(false);
  });
});

describe('Lectura de GPS EXIF/XMP', () => {
  beforeEach(() => {
    exifr.parse.mockReset();
    exifr.gps.mockReset();
  });

  it('Lee latitude/longitude decimales del bloque GPS EXIF', async () => {
    exifr.parse.mockResolvedValue({
      latitude: -34.4217448,
      longitude: -58.5798769,
      GPSAltitude: 24
    });

    const gps = await leerGpsFoto(dummyJpg());
    expect(gps).toMatchObject({ lat: -34.4217448, lng: -58.5798769, source: 'exif' });
    expect(gps.alt).toBe(24);
  });

  it('Convierte DMS crudo cuando exifr no entrega latitude/longitude', async () => {
    exifr.parse.mockResolvedValue({
      GPSLatitude: [34, 25, 18.2808],
      GPSLatitudeRef: 'S',
      GPSLongitude: [58, 34, 47.5568],
      GPSLongitudeRef: 'W'
    });

    const gps = await leerGpsFoto(dummyJpg());
    expect(gps.source).toBe('exif-dms');
    expect(gps.lat).toBeCloseTo(-34.4217447, 6);
    expect(gps.lng).toBeCloseTo(-58.5798769, 6);
  });

  it('Rescata GPS solo presente en XMP con prefijo exif:', async () => {
    exifr.parse.mockResolvedValue({
      'exif:GPSLatitude': '34,25.30468S',
      'exif:GPSLongitude': '58,34.792613W'
    });

    const gps = await leerGpsFoto(dummyJpg());
    expect(gps.source).toBe('xmp');
    expect(gps.lat).toBeCloseTo(-34.4217447, 6);
    expect(gps.lng).toBeCloseTo(-58.5798769, 6);
  });

  it('Usa exifr.gps() como último recurso', async () => {
    exifr.parse.mockResolvedValue(null);
    exifr.gps.mockResolvedValue({ latitude: -34.5, longitude: -58.5 });

    const gps = await leerGpsFoto(dummyJpg());
    expect(gps).toMatchObject({ lat: -34.5, lng: -58.5, source: 'exif-gps' });
  });

  it('Devuelve null cuando la foto no tiene GPS legible', async () => {
    exifr.parse.mockResolvedValue({ Make: 'Google' });
    exifr.gps.mockRejectedValue(new Error('Sin EXIF'));

    await expect(leerGpsFoto(dummyJpg('captura.png'))).resolves.toBeNull();
  });
});

describe('Geotagging en processPhotoFiles', () => {
  beforeEach(() => {
    exifr.parse.mockReset();
    exifr.gps.mockReset();
  });

  it('Persiste el origen del GPS EXIF y los metadatos de la cámara', async () => {
    exifr.parse.mockImplementation(async (file, options = {}) => {
      if (Array.isArray(options.pick)) {
        return {
          DateTimeOriginal: '2026:06:14 09:23:00',
          Make: 'Google',
          Model: 'Pixel 9 Pro XL',
          GPSAltitude: 24
        };
      }
      return { latitude: -34.4217448, longitude: -58.5798769, GPSAltitude: 24 };
    });

    const handler = new PhotoHandler(mockMap);
    const result = await handler.processPhotoFiles([dummyJpg()]);

    expect(result.allPhotos.length).toBe(1);
    const photo = result.allPhotos[0];
    expect(photo.hasGps).toBe(true);
    expect(photo.geotagSource).toBe('exif');
    expect(photo.lat).toBeCloseTo(-34.4217448, 6);
    expect(photo.lng).toBeCloseTo(-58.5798769, 6);
    expect(photo.alt).toBe(24);
    expect(photo.camera).toContain('Pixel');
    expect(photo.ts).not.toBeNull();
    expect(photo.date).not.toBe('Fecha no disponible');
  });

  it('Mantiene el geotag por favoritos cuando no hay EXIF', async () => {
    exifr.parse.mockResolvedValue(null);
    exifr.gps.mockRejectedValue(new Error('Sin EXIF'));

    const photoGeoMap = new Map([['img_gallery_test.jpg', { lat: -34.3835, lng: -58.569 }]]);
    const handler = new PhotoHandler(mockMap);
    const result = await handler.processPhotoFiles(
      [new File([new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0])], 'IMG_GALLERY_TEST.jpg', { type: '' })],
      [],
      photoGeoMap
    );

    expect(result.allPhotos[0].hasGps).toBe(true);
    expect(result.allPhotos[0].geotagSource).toBe('favoritos');
    expect(result.allPhotos[0].lat).toBeCloseTo(-34.3835, 3);
  });
});
