import { describe, it, expect } from 'vitest';
import {
  calculateBearing,
  bearingToCardinal,
  haversineMeters,
  formatDuration
} from '../src/components/playback.js';

describe('Matemáticas de Navegación y Rumbo (playback.js)', () => {
  it('haversineMeters calcula correctamente la distancia en metros entre dos puntos', () => {
    // Obelisco de Buenos Aires: -34.6037, -58.3816
    // Plaza de Mayo: -34.6083, -58.3712
    const d = haversineMeters(-34.6037, -58.3816, -34.6083, -58.3712);
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(1200);

    // Mismo punto debe dar 0 metros
    expect(haversineMeters(-34.6037, -58.3816, -34.6037, -58.3816)).toBe(0);
  });

  it('calculateBearing determina el rumbo esférico en grados (0 a 360)', () => {
    // Rumbo hacia el Norte (aumento de latitud con misma longitud)
    const northBearing = calculateBearing(0, 0, 10, 0);
    expect(northBearing).toBe(0);

    // Rumbo hacia el Este (aumento de longitud sobre el ecuador)
    const eastBearing = calculateBearing(0, 0, 0, 10);
    expect(eastBearing).toBe(90);

    // Rumbo hacia el Sur (disminución de latitud)
    const southBearing = calculateBearing(10, 0, 0, 0);
    expect(southBearing).toBe(180);

    // Rumbo hacia el Oeste
    const westBearing = calculateBearing(0, 10, 0, 0);
    expect(westBearing).toBe(270);
  });

  it('bearingToCardinal traduce rumbos numéricos a cuadrantes cardinales tácticos', () => {
    expect(bearingToCardinal(0)).toBe('N');
    expect(bearingToCardinal(360)).toBe('N');
    expect(bearingToCardinal(45)).toBe('NE');
    expect(bearingToCardinal(90)).toBe('E');
    expect(bearingToCardinal(135)).toBe('SE');
    expect(bearingToCardinal(180)).toBe('S');
    expect(bearingToCardinal(225)).toBe('SW');
    expect(bearingToCardinal(270)).toBe('W');
    expect(bearingToCardinal(315)).toBe('NW');
  });

  it('formatDuration formatea segundos en formato HH:MM:SS', () => {
    expect(formatDuration(0)).toBe('00:00:00');
    expect(formatDuration(45)).toBe('00:00:45');
    expect(formatDuration(125)).toBe('00:02:05');
    expect(formatDuration(3665)).toBe('01:01:05');
    expect(formatDuration(NaN)).toBe('00:00:00');
  });
});
