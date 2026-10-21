@echo off
title BiTaVi PC - Bitacora Tactica de Viaje (Visor PC)
echo ========================================================
echo   BiTaVi PC - Bitacora Tactica de Viaje (Visor PC)
echo ========================================================
echo.
echo Verificando entorno de ejecucion en Windows...
echo.

cd /d "%~dp0"

REM Verificar existencia de Node.js en el sistema
where node >nul 2>nul
if %errorlevel% equ 0 goto :node_ok
echo [ERROR] No se detecto Node.js instalado o configurado en el PATH.
echo Por favor, instala Node.js (version LTS recomendada) desde https://nodejs.org/
echo.
pause
exit /b 1

:node_ok
REM Verificar existencia de dependencias base
if exist "node_modules" goto :check_bindings
echo Instalando dependencias base del sistema...
call npm install
if %errorlevel% equ 0 goto :check_bindings
echo [ERROR] No se pudieron instalar las dependencias con npm install.
pause
exit /b 1

:check_bindings
REM Deteccion de conflicto cruzado Windows vs Linux
REM Si falta el binario nativo de Windows para Rolldown/Vite
if exist "node_modules\@rolldown\binding-win32-x64-msvc" goto :start_app
echo [ADVERTENCIA] Detectados modulos sin binarios de Windows.
echo Instalando binario nativo para Windows: @rolldown/binding-win32-x64-msvc...
call npm install --save-optional @rolldown/binding-win32-x64-msvc@1.2.6 --no-audit --no-fund

:start_app
echo.
echo Iniciando servidor local...
echo El navegador web se abrira automaticamente.
echo Presiona Ctrl+C o cierra esta consola para detener el servidor.
echo ========================================================
echo.

REM Intento de arranque con Vite en modo desarrollo
call npm run dev -- --open
if %errorlevel% equ 0 goto :end

echo.
echo ========================================================
echo  AVISO: Vite no pudo arrancar.
echo  Activando servidor local nativo multiplataforma...
echo ========================================================
echo.
call npm run serve

:end
pause