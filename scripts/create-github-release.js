// Script para publicar Releases oficiales en GitHub con subida directa de binarios y paquetes
import { spawnSync } from 'node:child_process';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// 1. Obtener Token de Git Credentials
const cred = spawnSync('git', ['credential', 'fill'], {
  input: 'protocol=https\nhost=github.com\n\n',
  encoding: 'utf-8'
});

const token = cred.stdout.split('\n').find(l => l.startsWith('password='))?.slice(9).trim();
const repo = 'dmg-cmd/BiTaVi-PC';

if (!token) {
  console.error('[ERROR] No se pudo obtener el token de acceso a GitHub desde git credential.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
const version = pkg.version || '1.0.6-alpha';
const tag = `v${version}`;

function apiRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function uploadAsset(uploadUrl, filePath, name, contentType) {
  return new Promise((resolve, reject) => {
    const cleanUrl = uploadUrl.replace(/\{.*?\}$/, '') + `?name=${encodeURIComponent(name)}`;
    const urlObj = new URL(cleanUrl);
    const stat = fs.statSync(filePath);

    const req = https.request({
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'User-Agent': 'BiTaVi-Release-Uploader',
        'Authorization': `token ${token}`,
        'Content-Type': contentType,
        'Content-Length': stat.size
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);

    const stream = fs.createReadStream(filePath);
    stream.pipe(req);
  });
}

async function main() {
  console.log(`========================================================`);
  console.log(`  Publicador Oficial de GitHub Releases - BiTaVi PC`);
  console.log(`  Repositorio: ${repo}`);
  console.log(`  Versión: ${tag}`);
  console.log(`========================================================\n`);

  // 1. Verificar si el release ya existe
  console.log(`1. Verificando release existente para ${tag}...`);
  const checkRes = await apiRequest({
    hostname: 'api.github.com',
    path: `/repos/${repo}/releases/tags/${tag}`,
    method: 'GET',
    headers: {
      'User-Agent': 'BiTaVi-Release-Uploader',
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  let release = checkRes.status === 200 ? checkRes.data : null;

  if (!release) {
    console.log(`2. Creando nuevo Release en GitHub para ${tag}...`);
    const createRes = await apiRequest({
      hostname: 'api.github.com',
      path: `/repos/${repo}/releases`,
      method: 'POST',
      headers: {
        'User-Agent': 'BiTaVi-Release-Uploader',
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      }
    }, JSON.stringify({
      tag_name: tag,
      target_commitish: 'main',
      name: `BiTaVi PC ${tag} - Instaladores y Paquetes de Escritorio`,
      body: `## 🧭 BiTaVi PC ${tag} - Bitácora Táctica de Viaje

### 📦 Archivos Ejecutables y Paquetes Disponibles para Descarga:

| Archivo | Tipo | Tamaño | Descripción |
| :--- | :--- | :--- | :--- |
| **\`BiTaVi-${version}-setup.exe\`** | Instalador Windows | ~2.0 MB | Instalador guiado de escritorio con asociaciones de archivo (\`.gpx\`, \`.kml\`, \`.kmz\`, \`.zip\`). |
| **\`BiTaVi-${version}-portable.exe\`** | Portable Windows | ~8.6 MB | Ejecutable nativo autónomo de 1 solo archivo (no requiere instalación). |
| **\`BiTaVi-PC-${tag}-Windows.zip\`** | Paquete Portable | ~0.19 MB | Paquete ZIP para Windows con lanzador \`Iniciar BiTaVi PC.bat\`. |
| **\`BiTaVi-PC-${tag}-Linux.zip\`** | Paquete Portable | ~0.19 MB | Paquete ZIP para Linux/macOS con lanzador \`./Iniciar BiTaVi PC.sh\`. |

---
- **Soporte Cartográfico 100% Offline**: Caché inteligente de teselas OpenStreetMap, OpenTopoMap, Esri y CyclOSM.
- **Simulador y Reproductor de Rutas**: Playback táctico a 60 FPS con cálculo esférico de rumbo (0-360°).
- **Exportación 3D**: KML 2.2 y KMZ autocontenido con fotos geolocalizadas para Google Earth.`,
      draft: false,
      prerelease: true
    }));

    if (createRes.status !== 201) {
      console.error('[ERROR] No se pudo crear el release:', createRes);
      process.exit(1);
    }
    release = createRes.data;
    console.log(`   -> Release creado exitosamente (ID: ${release.id})`);
  } else {
    console.log(`   -> Release existente encontrado (ID: ${release.id})`);
  }

  // 2. Subir archivos de la carpeta release/
  const releaseDir = path.join(ROOT, 'release');
  const filesToUpload = [
    { name: `BiTaVi-v${version}-setup.exe`, file: `BiTaVi-v${version}-setup.exe`, mime: 'application/vnd.microsoft.portable-executable' },
    { name: `BiTaVi-v${version}-portable.exe`, file: `BiTaVi-v${version}-portable.exe`, mime: 'application/vnd.microsoft.portable-executable' },
    { name: `BiTaVi-PC-${tag}-Windows.zip`, file: `BiTaVi-PC-${tag}-Windows.zip`, mime: 'application/zip' },
    { name: `BiTaVi-PC-${tag}-Linux.zip`, file: `BiTaVi-PC-${tag}-Linux.zip`, mime: 'application/zip' }
  ];

  console.log(`\n3. Subiendo ejecutables y paquetes a GitHub Releases...`);
  const existingAssets = release.assets || [];

  for (const item of filesToUpload) {
    const localPath = path.join(releaseDir, item.file);
    if (!fs.existsSync(localPath)) {
      console.warn(`   [AVISO] Archivo local no encontrado: ${localPath}`);
      continue;
    }

    // Si ya existe en el release, eliminarlo para resubir
    const existing = existingAssets.find(a => a.name === item.name);
    if (existing) {
      console.log(`   -> Eliminando version anterior de ${item.name} (Asset ID: ${existing.id})...`);
      await apiRequest({
        hostname: 'api.github.com',
        path: `/repos/${repo}/releases/assets/${existing.id}`,
        method: 'DELETE',
        headers: {
          'User-Agent': 'BiTaVi-Release-Uploader',
          'Authorization': `token ${token}`
        }
      });
    }

    console.log(`   -> Subiendo ${item.name} (${(fs.statSync(localPath).size / 1024 / 1024).toFixed(2)} MB)...`);
    const upRes = await uploadAsset(release.upload_url, localPath, item.name, item.mime);
    if (upRes.status === 201) {
      console.log(`      ✓ Subido exitosamente: ${upRes.data.browser_download_url}`);
    } else {
      console.error(`      ✗ Error al subir ${item.name}:`, upRes);
    }
  }

  console.log(`\n========================================================`);
  console.log(`  Proceso completado exitosamente.`);
  console.log(`  URL del Release: ${release.html_url}`);
  console.log(`========================================================`);
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
