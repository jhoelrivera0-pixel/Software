@echo off
title IDEESE - Servidor de Inventario Autoejecutable
echo.
echo ====================================================================
echo                   INICIANDO SERVIDOR IDEESE
echo ====================================================================
echo.

setlocal enabledelayedexpansion

:: Ruta para el Node.js portable
set "BIN_DIR=%~dp0bin"
set "NODE_PATH=%BIN_DIR%\node-v18.16.0-win-x64"
set "PATH=%NODE_PATH%;%PATH%"

:: 1. Verificar si Node.js está disponible de forma global o local
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo [INFO] Node.js detectado en el sistema.
    set "NODE_CMD=node"
    set "NPM_CMD=npm"
    goto check_dependencies
)

if exist "%NODE_PATH%\node.exe" (
    echo [INFO] Node.js portable detectado localmente.
    set "NODE_CMD=%NODE_PATH%\node.exe"
    set "NPM_CMD=%NODE_PATH%\npm.cmd"
    goto check_dependencies
)

:: 2. Descargar Node.js Portable si no existe
echo [WARN] Node.js no esta instalado en el sistema.
echo [INFO] Descargando version portable oficial de Node.js (v18.16.0)...
echo Este proceso se realiza una sola vez y tomara unos instantes.
echo.

if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"

:: Descargar usando PowerShell
powershell -Command "Write-Host 'Descargando Node.js...'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v18.16.0/node-v18.16.0-win-x64.zip' -OutFile '%BIN_DIR%\node.zip'"
if %errorlevel% neq 0 (
    echo [ERROR] No se pudo descargar Node.js. Verifica tu conexion a internet.
    pause
    exit /b 1
)

echo [INFO] Extrayendo archivos...
powershell -Command "Write-Host 'Extrayendo...'; Expand-Archive -Path '%BIN_DIR%\node.zip' -DestinationPath '%BIN_DIR%' -Force"
del "%BIN_DIR%\node.zip"

if not exist "%NODE_PATH%\node.exe" (
    echo [ERROR] Fallo la extraccion de Node.js.
    pause
    exit /b 1
)

echo [INFO] Node.js portable configurado correctamente.
set "NODE_CMD=%NODE_PATH%\node.exe"
set "NPM_CMD=%NODE_PATH%\npm.cmd"

:check_dependencies
:: 3. Instalar dependencias si no existe node_modules
if not exist "%~dp0node_modules\" (
    echo [INFO] Instalando dependencias de la aplicacion...
    call "%NPM_CMD%" install --omit=dev
)

:: 4. Abrir la aplicación en el navegador predeterminado
echo [INFO] Abriendo aplicacion en el navegador web...
start "" "http://localhost:3000"

:: 5. Arrancar el servidor
echo [INFO] Iniciando servidor en el puerto 3000...
call "%NODE_CMD%" server.js

pause
