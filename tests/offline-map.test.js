import { describe, it, expect } from 'vitest';
import {
  latLngToTileXY,
  tileXYToLatLng,
  calculateAreaTileBounds
} from '../src/components/offline-map-manager.js';

describe('Proyección Web Mercator y Cuadrantes Offline (offline-map-manager.js)', () => {
  it('latLngToTileXY convierte coordenadas lat/lng a tuplas de tesela X, Y para un nivel de zoom', () => {
    // A zoom 0, toda la Tierra está en una sola tesela: (0, 0)
    const zeroTile = latLngToTileXY(0, 0, 0);
    expect(zeroTile.x).toBe(0);
    expect(zeroTile.y).toBe(0);
    expect(zeroTile.z).toBe(0);

    // Buenos Aires (-34.6037, -58.3816) a zoom 14
    const baTile = latLngToTileXY(-34.6037, -58.3816, 14);
    expect(baTile.x).toBeGreaterThan(5000);
    expect(baTile.y).toBeGreaterThan(9000);
    expect(baTile.z).toBe(14);
  });

  it('tileXYToLatLng invierte adecuadamente las coordenadas de la tesela a latitud y longitud', () => {
    const originalLat = -34.6037;
    const originalLng = -58.3816;
    const zoom = 14;

    const tile = latLngToTileXY(originalLat, originalLng, zoom);
    const coord = tileXYToLatLng(tile.x, tile.y, zoom);

    // La esquina superior izquierda de la tesela debe estar muy cerca de la posición original
    expect(Math.abs(coord.lat - originalLat)).toBeLessThan(0.05);
    expect(Math.abs(coord.lng - originalLng)).toBeLessThan(0.05);
  });

  it('calculateAreaTileBounds genera la lista de URLs para descargar un cuadrante geográfico', () => {
    const bounds = {
      north: -34.60,
      south: -34.62,
      west: -58.39,
      east: -58.37
    };
    const zoomLevels = [14];
    const template = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

    const tiles = calculateAreaTileBounds(bounds, zoomLevels, template);

    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles[0].z).toBe(14);
    expect(tiles[0].url).toContain('https://tile.openstreetmap.org/14/');
    expect(tiles[0].url.endsWith('.png')).toBe(true);
  });
});
