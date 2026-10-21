// Script de empaquetado y distribución multiplataforma para BiTaVi PC
// Genera paquetes listos para usar en Windows y Linux en la carpeta release/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Leer version desde package.json
const pkgPath = path.join(ROOT, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const version = pkg.version || '0.5.10-alpha';

console.log('========================================================');
console.log(`  BiTaVi PC - Empaquetador Multiplataforma (v${version})`);
console.log('========================================================\n');

// 1. Compilar proyecto con Vite
console.log('1. Compilando aplicacion web optimizada con Vite...');
execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });

const distDir = path.join(ROOT, 'dist');
if (!fs.existsSync(distDir) || !fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('[ERROR] La carpeta dist no existe o no contiene index.html.');
  process.exit(1);
}

// 2. Preparar carpeta release
const releaseDir = path.join(ROOT, 'release');
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

// Funcion recursiva para agregar carpetas a un JSZip
function addFolderToZip(zip, folderPath, zipPath = '') {
  const entries = fs.readdirSync(folderPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(folderPath, entry.name);
    const itemZipPath = zipPath ? `${zipPath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      const subFolder = zip.folder(itemZipPath);
      addFolderToZip(zip, fullPath, itemZipPath);
    } else {
      zip.file(itemZipPath, fs.readFileSync(fullPath));
    }
  }
}

async function buildPackages() {
  console.log('\n2. Generando paquete de distribucion para Windows...');
  const winZip = new JSZip();
  const winRoot = winZip.folder(`BiTaVi-PC-v${version}-Windows`);

  // Agregar archivos esenciales para Windows
  addFolderToZip(winRoot.folder('dist'), distDir);
  winRoot.file('Iniciar BiTaVi PC.bat', fs.readFileSync(path.join(ROOT, 'Iniciar BiTaVi PC.bat')));
  winRoot.file('package.json', fs.readFileSync(pkgPath));

  const scriptsFolderWin = winRoot.folder('scripts');
  scriptsFolderWin.file('serve.js', fs.readFileSync(path.join(ROOT, 'scripts', 'serve.js')));
  scriptsFolderWin.file('check.js', fs.readFileSync(path.join(ROOT, 'scripts', 'check.js')));

  const winOutPath = path.join(releaseDir, `BiTaVi-PC-v${version}-Windows.zip`);
  const winBuffer = await winZip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });
  fs.writeFileSync(winOutPath, winBuffer);
  console.log(`   -> Paquete Windows creado: release/BiTaVi-PC-v${version}-Windows.zip (${(winBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

  console.log('\n3. Generando paquete de distribucion para Linux / macOS...');
  const linuxZip = new JSZip();
  const linuxRoot = linuxZip.folder(`BiTaVi-PC-v${version}-Linux`);

  // Agregar archivos esenciales para Linux
  addFolderToZip(linuxRoot.folder('dist'), distDir);
  linuxRoot.file('Iniciar BiTaVi PC.sh', fs.readFileSync(path.join(ROOT, 'Iniciar BiTaVi PC.sh')));
  linuxRoot.file('package.json', fs.readFileSync(pkgPath));

  const scriptsFolderLinux = linuxRoot.folder('scripts');
  scriptsFolderLinux.file('serve.js', fs.readFileSync(path.join(ROOT, 'scripts', 'serve.js')));
  scriptsFolderLinux.file('check.js', fs.readFileSync(path.join(ROOT, 'scripts', 'check.js')));

  const linuxOutPath = path.join(releaseDir, `BiTaVi-PC-v${version}-Linux.zip`);
  const linuxBuffer = await linuxZip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });
  fs.writeFileSync(linuxOutPath, linuxBuffer);
  console.log(`   -> Paquete Linux creado: release/BiTaVi-PC-v${version}-Linux.zip (${(linuxBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

  console.log('\n========================================================');
  console.log('  Compilacion y empaquetado completados exitosamente.');
  console.log(`  Archivos listos en: ${releaseDir}`);
  console.log('========================================================\n');
}

buildPackages().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
