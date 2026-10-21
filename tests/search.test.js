import { describe, it, expect } from 'vitest';
import { GeoSearch } from '../src/components/search.js';

describe('Buscador Táctico Local e Indexación Offline (search.js)', () => {
  const search = new GeoSearch();

  it('_normalize elimina acentos, diacríticos y convierte a minúsculas', () => {
    expect(search._normalize('Expedición TÁCTICA')).toBe('expedicion tactica');
    expect(search._normalize('Montaña Güepardo')).toBe('montana guepardo');
    expect(search._normalize('  Árbol Ébano Ígneo Ópalo Único  ')).toBe('arbol ebano igneo opalo unico');
    expect(search._normalize('')).toBe('');
    expect(search._normalize(null)).toBe('');
  });

  it('indexLocalData y searchLocal encuentran coincidencias sin distinción de tildes ni mayúsculas', () => {
    search.indexLocalData({
      routes: [
        { id: '1', name: 'Travesía de los Andes', distanceKm: '15.4' },
        { id: '2', name: 'Patrullaje Costero', distanceKm: '8.2' }
      ],
      markers: [
        { id: 'm1', name: 'Refugio Volcán', lat: -34.5, lng: -58.5 }
      ],
      photos: [
        { name: 'Cascada_Escondida.jpg', lat: -34.6, lng: -58.4, date: '2026-10-21' }
      ]
    });

    // Búsqueda con tildes vs sin tildes
    const res1 = search.searchLocal('travesia');
    expect(res1.length).toBe(1);
    expect(res1[0].title).toContain('Travesía de los Andes');

    const res2 = search.searchLocal('VOLCAN');
    expect(res2.length).toBe(1);
    expect(res2[0].title).toContain('Refugio Volcán');

    const res3 = search.searchLocal('cascada');
    expect(res3.length).toBe(1);
    expect(res3[0].title).toBe('Cascada_Escondida.jpg');

    // Búsqueda sin coincidencias
    expect(search.searchLocal('Inexistente')).toEqual([]);
  });
});
