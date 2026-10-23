import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GooglePhotosConnector } from '../src/components/photos-connector.js';
import { inferirTimestampFoto, leerMetadatosFoto } from '../src/components/photo-parser.js';

describe('GooglePhotosConnector', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('inicializa correctamente y lee clientId desde localStorage o fallback de drive', () => {
    localStorage.setItem('bitavi_gdrive_client_id', 'test-drive-client-id');
    const connector = new GooglePhotosConnector();
    expect(connector.clientId).toBe('test-drive-client-id');

    connector.saveCredentials('nuevo-photos-client-id');
    expect(connector.clientId).toBe('nuevo-photos-client-id');
    expect(localStorage.getItem('bitavi_gphotos_client_id')).toBe('nuevo-photos-client-id');
  });

  it('lanza error explicativo cuando la API responde con 403 (falta activar API en Google Cloud)', () => {
    const connector = new GooglePhotosConnector();
    expect(() => {
      connector.handleApiError(403, JSON.stringify({ error: { message: 'Method not enabled' } }));
    }).toThrow(/Google Photos Library API/);
  });

  it('descarga fotos y las convierte en objetos File con _gphotosMetadata adjunto', async () => {
    const fakeBlob = new Blob(['fake image bytes'], { type: 'image/jpeg' });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => fakeBlob,
    });

    const onDownloaded = vi.fn();
    const connector = new GooglePhotosConnector(onDownloaded);

    const items = [
      {
        id: 'photo_abc123',
        filename: 'viaje_2024.jpg',
        baseUrl: 'https://lh3.googleusercontent.com/test',
        mimeType: 'image/jpeg',
        mediaMetadata: {
          creationTime: '2024-05-12T15:30:00Z',
          width: '1920',
          height: '1080',
          photo: {
            cameraMake: 'Samsung',
            cameraModel: 'Galaxy S23'
          }
        }
      }
    ];

    const progressUpdates = [];
    const files = await connector.downloadPhotos(items, (p) => progressUpdates.push(p));

    expect(files.length).toBe(1);
    expect(files[0].name).toBe('viaje_2024.jpg');
    expect(files[0]._gphotosMetadata).toBeDefined();
    expect(files[0]._gphotosMetadata.creationTime).toBe('2024-05-12T15:30:00Z');
    expect(files[0]._gphotosMetadata.photo.cameraModel).toBe('Galaxy S23');
    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(onDownloaded).toHaveBeenCalledWith(files);
  });
});

describe('Inferencia y correlación de timestamps para Google Fotos', () => {
  it('infiere timestamp desde metadatos creationTime de Google Photos', () => {
    const fakeFile = {
      name: 'foto_sin_fecha.jpg',
      _gphotosMetadata: {
        creationTime: '2024-06-15T12:00:00Z'
      }
    };
    const ts = inferirTimestampFoto(fakeFile);
    expect(ts).toBe(new Date('2024-06-15T12:00:00Z').getTime());
  });

  it('infiere timestamp desde patrón universal de cámara YYYYMMDD_HHMMSS', () => {
    const fakeFile = {
      name: 'IMG_20240320_143000.jpg'
    };
    const ts = inferirTimestampFoto(fakeFile);
    expect(ts).toBeDefined();
    const d = new Date(ts);
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(2); // Marzo (0-indexed)
    expect(d.getDate()).toBe(20);
  });

  it('respeta timestamp numérico preexistente', () => {
    const fakeFile = { name: 'archivo.jpg' };
    const ts = inferirTimestampFoto(fakeFile, 1710000000000);
    expect(ts).toBe(1710000000000);
  });

  it('completa cámara y fecha en leerMetadatosFoto cuando provienen de Google Photos', async () => {
    const fakeFile = new File(['1234'], 'IMG_test.jpg', { type: 'image/jpeg' });
    fakeFile._gphotosMetadata = {
      creationTime: '2024-01-10T09:00:00Z',
      photo: {
        cameraMake: 'Google',
        cameraModel: 'Pixel 8'
      }
    };

    const meta = await leerMetadatosFoto(fakeFile);
    expect(meta.camera).toBe('Google Pixel 8');
    expect(meta.ts).toBe(new Date('2024-01-10T09:00:00Z').getTime());
  });
});
