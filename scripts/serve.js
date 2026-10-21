// Servidor HTTP local táctico para BiTaVi PC (Node.js nativo puro)
// Cero dependencias nativas o binarias: compatible al 100% con Windows, Linux, macOS y WSL.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Priorizar la carpeta dist si existe (bundle optimizado y autocontenido), o servir raíz
const DIST_DIR = path.join(ROOT, 'dist');
const SERVE_DIR = fs.existsSync(path.join(DIST_DIR, 'index.html')) ? DIST_DIR : ROOT;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.gpx': 'application/gpx+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.zip': 'application/zip'
};

const DEFAULT_PORT = 5173;

function openBrowser(url) {
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  if (isWindows) {
    exec(`start "" "${url}"`);
  } else if (isMac) {
    exec(`open "${url}"`);
  } else {
    // Linux y WSL: probar wslview, xdg-open, sensible-browser o x-www-browser
    exec(`wslview "${url}" 2>/dev/null || xdg-open "${url}" 2>/dev/null || sensible-browser "${url}" 2>/dev/null || x-www-browser "${url}" 2>/dev/null`);
  }
}

function startServer(port) {
  const server = http.createServer((req, res) => {
    // Manejo de URL básica
    let reqUrl = decodeURI(req.url.split('?')[0]);
    if (reqUrl === '/' || reqUrl === '') {
      reqUrl = '/index.html';
    }

    // Ruta segura dentro del directorio a servir
    let safePath = path.normalize(path.join(SERVE_DIR, reqUrl));
    if (!fs.existsSync(safePath) && fs.existsSync(path.join(ROOT, 'public', reqUrl))) {
      safePath = path.join(ROOT, 'public', reqUrl);
    }
    if (!safePath.startsWith(SERVE_DIR) && !safePath.startsWith(path.join(ROOT, 'public'))) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403 Prohibido: acceso denegado');
      return;
    }

    fs.stat(safePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // Fallback SPA: si no existe el archivo estático, servir index.html
        const indexPath = path.join(SERVE_DIR, 'index.html');
        fs.readFile(indexPath, (indexErr, content) => {
          if (indexErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Recurso no encontrado');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        });
        return;
      }

      const ext = path.extname(safePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stats.size,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });

      const readStream = fs.createReadStream(safePath);
      readStream.pipe(res);
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Puerto ${port} en uso, intentando en el puerto ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Error al iniciar el servidor táctico:', err);
    }
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}/`;
    console.log('================================================');
    console.log('  BiTaVi PC - Servidor Local Multiplataforma');
    console.log('================================================');
    console.log(`  Entorno de ejecucion: ${process.platform} (${process.arch})`);
    console.log(`  Directorio servido:   ${SERVE_DIR}`);
    console.log(`  URL local activa:     ${url}`);
    console.log('================================================');
    console.log('  Presiona Ctrl+C para detener el servidor.\n');

    // Apertura diferida de navegador
    setTimeout(() => openBrowser(url), 600);
  });
}

startServer(DEFAULT_PORT);
