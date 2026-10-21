#!/usr/bin/env bash

# Cargar entorno de usuario habitual (NVM, fnm, Volta o Node en ~/.nvm o /usr/local/bin)
export PATH="$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -n 1)/bin:$HOME/.asdf/shims:$HOME/.fnm/current/bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:$PATH"

if [ -s "$HOME/.nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    \. "$HOME/.nvm/nvm.sh" 2>/dev/null
fi

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR" || exit 1

echo "========================================================"
echo "  BiTaVi PC - Bitacora Tactica de Viaje (Linux)"
echo "========================================================"
echo ""

# Verificar node y npm
if ! command -v npm &> /dev/null; then
    echo "ERROR: No se encontro 'npm' ni 'node' en el PATH del sistema."
    echo "PATH actual: $PATH"
    echo ""
    echo "Presiona Enter para cerrar..."
    read -r
    exit 1
fi

echo "Entorno detectado:"
echo " - Node: $(node -v 2>/dev/null || echo 'No detectado')"
echo " - NPM:  $(npm -v 2>/dev/null || echo 'No detectado')"
echo " - OS:   $(uname -s 2>/dev/null) $(uname -m 2>/dev/null)"
echo ""

# Instalar dependencias si no existen
if [ ! -d "node_modules" ]; then
    echo "Instalando dependencias base necesarias..."
    npm install
fi

# Deteccion de conflicto cruzado Linux <-> Windows
# Si falta el binario de Linux para Rolldown/Vite (provocado por npm install previo en Windows)
if [ ! -d "node_modules/@rolldown/binding-linux-x64-gnu" ] && [ ! -d "node_modules/@rolldown/binding-linux-x64-musl" ]; then
    echo "[ADVERTENCIA] Detectados modulos instalados en Windows."
    echo "Adaptando binarios nativos para Linux (rolldown linux-x64)..."
    npm install --save-optional @rolldown/binding-linux-x64-gnu@1.2.6 --no-audit --no-fund 2>/dev/null
    echo "Binarios nativos de Linux configurados."
    echo ""
fi

echo "Iniciando servidor local..."
echo "La ventana del navegador se abrira en http://localhost:5173/"
echo "Presiona Ctrl+C en esta terminal para detener el servidor."
echo ""

# Intentar abrir el navegador en 2 segundos (soporte para Linux nativo y WSL)
(sleep 2 && (wslview "http://localhost:5173/" 2>/dev/null || xdg-open "http://localhost:5173/" 2>/dev/null || sensible-browser "http://localhost:5173/" 2>/dev/null || x-www-browser "http://localhost:5173/" 2>/dev/null)) &

# Intentar ejecutar con Vite; si falla, conmutar automaticamente al servidor nativo
if ! npm run dev; then
    echo ""
    echo "========================================================"
    echo " AVISO: Vite encontro un conflicto de binarios."
    echo " Conmutando al servidor local nativo multiplataforma..."
    echo "========================================================"
    echo ""
    npm run serve
fi

echo ""
echo "El servidor se ha detenido. Presiona Enter para cerrar esta ventana..."
read -r
