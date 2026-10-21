// Verificación de sintaxis ligera (sin dependencias externas).
// Recorre todos los archivos .js del proyecto y ejecuta `node --check`.
// Equivale a un paso mínimo de lint/typecheck según las reglas de BiTaVi.
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, extname, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const EXCLUDE_DIRS = new Set(['node_modules', 'dist', '.git', '.agents']);

function collectJs(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectJs(full, acc);
    } else if (extname(full) === '.js') {
      acc.push(full);
    }
  }
  return acc;
}

const files = collectJs(ROOT);
let failed = 0;

for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    console.log(`OK   ${relative(ROOT, file)}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${relative(ROOT, file)}`);
    console.error(err.stderr?.toString() || err.message);
  }
}

console.log(`\n${files.length - failed}/${files.length} archivos OK`);
process.exit(failed === 0 ? 0 : 1);
