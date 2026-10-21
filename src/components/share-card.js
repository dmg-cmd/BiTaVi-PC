/**
 * ShareCard - Genera una "Tarjeta Táctica" compartible en redes sociales.
 *
 * Compone en un <canvas>:
 *   - Fondo táctico oscuro con grilla.
 *   - La ruta registrada (polilíneas por ruta).
 *   - Los puntos GPS donde fueron tomadas las fotos.
 *   - Una barra transparente inferior con las miniaturas de las fotos.
 *   - Líneas que unen cada miniatura con su posición en el mapa.
 *   - Cabecera y pie con la marca BiTaVi.
 *
 * Nota: no se capturan los tiles del mapa (restricción CORS de los servidores
 * de mapas), por eso se redibuja el contexto geográfico de forma táctica.
 */

export class ShareCard {
  constructor(versionTag = '') {
    this.versionTag = versionTag;
    this.modal = null;
    this.canvas = null;
    this.data = null;
    this.preloaded = [];
    this.buildModal();
  }

  buildModal() {
    const overlay = document.createElement('div');
    overlay.className = 'share-modal-overlay hidden';
    overlay.id = 'share-card-overlay';

    overlay.innerHTML = `
      <div class="share-modal" role="dialog" aria-modal="true" aria-label="Tarjeta táctica para compartir">
        <div class="share-modal-header">
          <div class="share-modal-title">
            <span class="share-modal-badge">🛰️ TARJETA TÁCTICA</span>
            <span class="share-modal-sub">Vista previa de la imagen a compartir</span>
          </div>
          <button class="share-modal-close" id="share-card-close" title="Cerrar">✕</button>
        </div>
        <div class="share-modal-body">
          <canvas id="share-card-canvas" class="share-modal-canvas"></canvas>
          <div id="share-card-loading" class="share-modal-loading hidden">Generando tarjeta…</div>
        </div>
        <div class="share-modal-actions">
          <button class="tactical-btn-sm" id="share-card-copy">📋 Copiar al portapapeles</button>
          <button class="tactical-btn-sm accent" id="share-card-download">⬇ Descargar PNG</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.modal = overlay;
    this.canvas = overlay.querySelector('#share-card-canvas');

    overlay.querySelector('#share-card-close').addEventListener('click', () => this.close());
    overlay.querySelector('#share-card-download').addEventListener('click', () => this.downloadPNG());
    overlay.querySelector('#share-card-copy').addEventListener('click', () => this.copyToClipboard());

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) this.close();
    });
  }

  open({ photos = [], routeGroups = [], title = 'Bitácora Táctica de Viaje', subtitle = '' }) {
    const geoPhotos = photos.filter(p => this.isValidCoord(p.lat, p.lng));
    if (geoPhotos.length === 0) {
      alert('No hay fotos geolocalizadas para compartir. Carga un backup que incluya fotos con GPS o paradas/favoritos con ubicación.');
      return;
    }
    this.data = { photos: geoPhotos, routeGroups, title, subtitle };
    this.modal.classList.remove('hidden');
    this.render();
  }

  close() {
    this.modal.classList.add('hidden');
  }

  isValidCoord(lat, lng) {
    return lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng);
  }

  loadImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  async render() {
    const loading = this.modal.querySelector('#share-card-loading');
    loading.classList.remove('hidden');
    this.preloaded = await Promise.all(this.data.photos.map(p => this.loadImage(p.url)));
    loading.classList.add('hidden');
    this.drawCanvas();
  }

  drawCanvas() {
    const W = 1600;
    const H = 1000;
    const canvas = this.canvas;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const { photos, routeGroups, title, subtitle } = this.data;

    // --- Recolección de coordenadas para la proyección ---
    const allCoords = [];
    routeGroups.forEach(group => group.forEach(pt => {
      if (this.isValidCoord(pt.lat, pt.lng)) allCoords.push([pt.lat, pt.lng]);
    }));
    photos.forEach(p => allCoords.push([p.lat, p.lng]));

    if (allCoords.length === 0) allCoords.push([-34.6037, -58.3816]);

    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    allCoords.forEach(([lat, lng]) => {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    });

    // expandir un margen si es un solo punto
    if (maxLat - minLat < 1e-5) { minLat -= 0.005; maxLat += 0.005; }
    if (maxLng - minLng < 1e-5) { minLng -= 0.005; maxLng += 0.005; }

    const latCenter = (minLat + maxLat) / 2;
    const cosLat = Math.cos(latCenter * Math.PI / 180);

    // --- Área del mapa ---
    const headerH = 110;
    const barH = 210;
    const mapArea = { x: 40, y: headerH, w: W - 80, h: H - headerH - barH - 20 };

    const latSpan = maxLat - minLat;
    const lngSpan = (maxLng - minLng) * cosLat;
    const scale = Math.min(mapArea.w / lngSpan, mapArea.h / latSpan) || 1;
    const contentW = lngSpan * scale;
    const contentH = latSpan * scale;
    const offsetX = mapArea.x + (mapArea.w - contentW) / 2;
    const offsetY = mapArea.y + (mapArea.h - contentH) / 2;

    const project = (lat, lng) => ({
      x: offsetX + (lng - minLng) * cosLat * scale,
      y: offsetY + (maxLat - lat) * scale
    });

    // --- Fondo ---
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#07090e');
    bgGrad.addColorStop(1, '#0e131f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // --- Grilla táctica ---
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.06)';
    ctx.lineWidth = 1;
    const gridStep = 50;
    for (let x = mapArea.x; x <= mapArea.x + mapArea.w; x += gridStep) {
      ctx.beginPath(); ctx.moveTo(x, mapArea.y); ctx.lineTo(x, mapArea.y + mapArea.h); ctx.stroke();
    }
    for (let y = mapArea.y; y <= mapArea.y + mapArea.h; y += gridStep) {
      ctx.beginPath(); ctx.moveTo(mapArea.x, y); ctx.lineTo(mapArea.x + mapArea.w, y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.strokeRect(mapArea.x, mapArea.y, mapArea.w, mapArea.h);

    // --- Rutas ---
    if (routeGroups.length > 0) {
      ctx.save();
      ctx.shadowColor = 'rgba(16, 185, 129, 0.7)';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      routeGroups.forEach(group => {
        const pts = group.filter(pt => this.isValidCoord(pt.lat, pt.lng)).map(pt => project(pt.lat, pt.lng));
        if (pts.length < 2) return;
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.stroke();
      });
      ctx.restore();
    }

    // --- Puntos de fotos ---
    photos.forEach(p => {
      const pos = project(p.lat, p.lng);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#00f0ff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    });

    // --- Barra transparente de fotos ---
    const barY = H - barH;
    ctx.fillStyle = 'rgba(7, 9, 14, 0.55)';
    ctx.fillRect(0, barY, W, barH);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, barY); ctx.lineTo(W, barY); ctx.stroke();

    // --- Miniaturas en grilla dentro de la barra ---
    const pad = 22;
    const gridX0 = pad;
    const gridY0 = barY + pad;
    const gridW = W - pad * 2;
    const gridH = barH - pad * 2;
    const n = photos.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(n * (gridW / gridH))));
    const rows = Math.ceil(n / cols);
    const cellW = gridW / cols;
    const cellH = gridH / rows;
    const thumb = Math.min(cellW, cellH) * 0.86;

    photos.forEach((photo, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = gridX0 + col * cellW + cellW / 2;
      const cy = gridY0 + row * cellH + cellH / 2;

      // conector a la posición en el mapa
      const pos = project(photo.lat, photo.lng);
      ctx.save();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(cx, cy - thumb / 2);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.restore();

      // miniatura redondeada
      const x = cx - thumb / 2;
      const y = cy - thumb / 2;
      this.roundRect(ctx, x, y, thumb, thumb, 8);
      ctx.save();
      ctx.clip();
      const img = this.preloaded[i];
      if (img) {
        // cubrir el área manteniendo recorte
        const ir = Math.max(thumb / img.width, thumb / img.height);
        const dw = img.width * ir;
        const dh = img.height * ir;
        ctx.drawImage(img, x + (thumb - dw) / 2, y + (thumb - dh) / 2, dw, dh);
      } else {
        ctx.fillStyle = '#1a2233';
        ctx.fillRect(x, y, thumb, thumb);
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.9)';
      ctx.lineWidth = 1.5;
      this.roundRect(ctx, x, y, thumb, thumb, 8);
      ctx.stroke();
    });

    // --- Cabecera ---
    const headerGrad = ctx.createLinearGradient(0, 0, W, 0);
    headerGrad.addColorStop(0, 'rgba(7, 9, 14, 0.95)');
    headerGrad.addColorStop(1, 'rgba(14, 19, 31, 0.95)');
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, W, headerH);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.beginPath(); ctx.moveTo(0, headerH); ctx.lineTo(W, headerH); ctx.stroke();

    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 34px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText('BiTaVi', 40, 42);

    ctx.fillStyle = '#e6edf3';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(this.truncate(title, 46), 40, 82);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(230, 237, 243, 0.65)';
    ctx.font = '20px sans-serif';
    const rightText = subtitle ? this.truncate(subtitle, 40) : 'Bitácora Táctica de Viaje';
    ctx.fillText(rightText, W - 40, 42);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`📷 ${photos.length} FOTOS`, W - 40, 82);
    ctx.textAlign = 'left';

    // --- Pie ---
    ctx.fillStyle = 'rgba(230, 237, 243, 0.4)';
    ctx.font = '16px monospace';
    const footer = this.versionTag ? `Generado con BiTaVi ${this.versionTag}` : 'Generado con BiTaVi';
    ctx.fillText(footer, 40, H - 12);
  }

  roundRect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  truncate(str, max) {
    str = String(str || '');
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
  }

  downloadPNG() {
    this.canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bitavi_tarjeta_tactica.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  }

  async copyToClipboard() {
    try {
      const blob = await new Promise(resolve => this.canvas.toBlob(resolve, 'image/png'));
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      const btn = this.modal.querySelector('#share-card-copy');
      const original = btn.textContent;
      btn.textContent = '✅ ¡Copiado!';
      setTimeout(() => { btn.textContent = original; }, 1800);
    } catch (e) {
      alert('No se pudo copiar al portapapeles (el navegador lo bloquea fuera de un contexto seguro). Usa "Descargar PNG".');
    }
  }
}
