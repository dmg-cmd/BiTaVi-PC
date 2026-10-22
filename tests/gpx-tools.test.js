import { describe, it, expect } from 'vitest';
import { GpxHandler, sanitizeFilename, createGpxXml, createCombinedGpxXml, extractRouteDateSlug, extractDateFromName, groupRoutesByDay } from '../src/components/gpx-parser.js';

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

  it('extractDateFromName reconoce formatos YYYY-MM-DD, DD/MM/YYYY y compactos', () => {
    expect(extractDateFromName('2026-06-26')).toBe('2026-06-26');
    expect(extractDateFromName('Ruta 26/06/2026')).toBe('2026-06-26');
    expect(extractDateFromName('26-06-2026')).toBe('2026-06-26');
    expect(extractDateFromName('backup_20260626_2305')).toBe('2026-06-26');
    expect(extractDateFromName('Ruta_26062026')).toBe('2026-06-26');
    expect(extractDateFromName('2024/05/10')).toBe('2024-05-10');
    expect(extractDateFromName('Sin Fecha')).toBeNull();
  });

  it('extractRouteDateSlug extrae fechas válidas en múltiples formatos y maneja fallback', () => {
    // Caso 1: startTime numérico en ms
    const route1 = { name: 'Expedición Sur', startTime: 1782470400000 };
    expect(extractRouteDateSlug(route1)).toBe(new Date(1782470400000).toISOString().split('T')[0]);

    // Caso 1b: startTime en segundos Unix (10 dígitos)
    const route1b = { name: 'Ruta Segundos', startTime: 1719430000 };
    expect(extractRouteDateSlug(route1b)).toBe('2024-06-26');

    // Caso 2: fecha en un punto intermedio
    const route2 = { name: 'Travesía' };
    const points2 = [{ lat: -34, lng: -58 }, { time: '2026-08-15T09:30:00Z' }];
    expect(extractRouteDateSlug(route2, points2)).toBe('2026-08-15');

    // Caso 3: fecha formato latino en el nombre
    const route3 = { name: 'Salida 26/06/2026 mañana' };
    expect(extractRouteDateSlug(route3)).toBe('2026-06-26');

    // Caso 4: ruta sin fecha detectable
    const route4 = { name: 'Ruta Desconocida' };
    expect(extractRouteDateSlug(route4, [])).toBe('Sin Fecha');
  });

  it('groupRoutesByDay agrupa correctamente las rutas por su fecha cronológica', () => {
    const routes = [
      { id: '1', name: 'Ruta_2026-06-25_Mañana' },
      { id: '2', name: 'Ruta_2026-06-25_Tarde' },
      { id: '3', name: 'Ruta 26/06/2026 Etapa1' },
      { id: '4', name: 'Ruta Antigua', startTime: 1719430000 } // 2024-06-26
    ];

    const grouped = groupRoutesByDay(routes);

    expect(grouped.size).toBe(3);
    expect(grouped.has('2024-06-26')).toBe(true);
    expect(grouped.has('2026-06-25')).toBe(true);
    expect(grouped.has('2026-06-26')).toBe(true);
    expect(grouped.get('2026-06-25').length).toBe(2);
    expect(grouped.get('2026-06-26').length).toBe(1);
    expect(grouped.get('2024-06-26').length).toBe(1);
  });

  it('GpxHandler.parseGpxText extrae startTime y startDate desde metadata time o track time', () => {
    const handler = new GpxHandler(null);
    const gpxWithMeta = `<?xml version="1.0" encoding="UTF-8"?>
      <gpx version="1.1" creator="Test">
        <metadata>
          <time>2024-05-10T08:30:00Z</time>
        </metadata>
        <trk>
          <name>Patrulla Mayo</name>
          <trkseg>
            <trkpt lat="-34.60" lon="-58.38"><ele>10</ele></trkpt>
          </trkseg>
        </trk>
      </gpx>`;
    
    const parsed = handler.parseGpxText(gpxWithMeta);
    expect(parsed.name).toBe('Patrulla Mayo');
    expect(parsed.startDate).toBe('2024-05-10');
    expect(parsed.startTime).toBeGreaterThan(0);
  });

  it('extractRouteDateSlug y groupRoutesByDay resuelven fechas por fileName y lastModified separando múltiples archivos', () => {
    const routeFile = { name: 'Track', fileName: 'salida_2024-07-15.gpx' };
    expect(extractRouteDateSlug(routeFile)).toBe('2024-07-15');

    // Emular 81 archivos cargados con diferentes nombres o fechas de modificación
    const routes81 = [];
    for (let i = 1; i <= 81; i++) {
      const day = (i % 3) + 1; // 3 días distintos: 2024-05-01, 2024-05-02, 2024-05-03
      routes81.push({
        id: `route_${i}`,
        name: `Track_${i}`,
        fileName: `actividad_2024-05-0${day}_parte_${i}.gpx`,
        lastModified: 1714564800000 + day * 86400000
      });
    }

    const grouped = groupRoutesByDay(routes81);
    // Deben agruparse en 3 días distintos, no en 1 solo grupo
    expect(grouped.size).toBe(3);
    expect(grouped.has('2024-05-01')).toBe(true);
    expect(grouped.has('2024-05-02')).toBe(true);
    expect(grouped.has('2024-05-03')).toBe(true);
    expect(grouped.get('2024-05-01').length + grouped.get('2024-05-02').length + grouped.get('2024-05-03').length).toBe(81);
  });

  it('extractDateFromName y groupRoutesByDay separan rutas reales de rutas.txt con meses en español aunque compartan startTime de reimportación', () => {
    expect(extractDateFromName('16 abr 2026 10:12:33')).toBe('2026-04-16');
    expect(extractDateFromName('5 jun 2026 23:42:48')).toBe('2026-06-05');
    expect(extractDateFromName('Auto-Ruta 2026-06-13 12:55')).toBe('2026-06-13');
    expect(extractDateFromName('2026-06-14 09:23 Lancha hasta La Becasina')).toBe('2026-06-14');

    // Simulación exacta de rutas.txt donde todas tienen startTime del mismo día de importación (1782404078xxx)
    const routesFromBackup = [
      { id: '1', name: 'Auto-Ruta 2026-06-13 12:55', startTime: 1782404078536 },
      { id: '2', name: '16 abr 2026 10:12:33', startTime: 1782404077751 },
      { id: '3', name: '5 jun 2026 23:42:48', startTime: 1782404077565 },
      { id: '4', name: '2026-06-10 10:16', startTime: 1782404077445 },
      { id: '5', name: '2026-06-10 16:42 - Buenos Aires', startTime: 1782404077297 },
      { id: '6', name: '2026-06-11 09:55 Chi kung', startTime: 1782404077271 },
      { id: '7', name: '2026-06-14 07:04 - Buenos Aires', startTime: 1782404077206 },
      { id: '8', name: '2026-06-14 09:23 Lancha hasta La Becasina', startTime: 1782404077137 }
    ];

    const grouped = groupRoutesByDay(routesFromBackup);
    expect(grouped.size).toBe(6);
    expect(grouped.has('2026-04-16')).toBe(true);
    expect(grouped.has('2026-06-05')).toBe(true);
    expect(grouped.has('2026-06-10')).toBe(true);
    expect(grouped.get('2026-06-10').length).toBe(2);
    expect(grouped.has('2026-06-11')).toBe(true);
    expect(grouped.has('2026-06-13')).toBe(true);
    expect(grouped.has('2026-06-14')).toBe(true);
    expect(grouped.get('2026-06-14').length).toBe(2);
  });

  it('GpxHandler.parseGpxTracks extrae múltiples tracks independientes de un mismo archivo GPX', () => {
    const handler = new GpxHandler(null);
    const multiGpx = `<?xml version="1.0" encoding="UTF-8"?>
      <gpx version="1.1">
        <trk>
          <name>Tramo 2026-06-10</name>
          <trkseg>
            <trkpt lat="-34.60" lon="-58.38"><ele>10</ele></trkpt>
          </trkseg>
        </trk>
        <trk>
          <name>Tramo 16 abr 2026</name>
          <trkseg>
            <trkpt lat="-34.62" lon="-58.40"><ele>15</ele></trkpt>
          </trkseg>
        </trk>
      </gpx>`;

    const tracks = handler.parseGpxTracks(multiGpx, 'Expedicion');
    expect(tracks.length).toBe(2);
    expect(tracks[0].name).toBe('Tramo 2026-06-10');
    expect(tracks[0].startDate).toBe('2026-06-10');
    expect(tracks[1].name).toBe('Tramo 16 abr 2026');
    expect(tracks[1].startDate).toBe('2026-04-16');
  });
});
