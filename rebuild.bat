@echo off
cd /d "%~dp0"
title gonet phone Auto Builder
cls
echo ==========================================================
echo       gonet phone Auto Rebuild Tool
echo ==========================================================
echo.

echo 1. Closing any hanging servers and processes...
powershell -Command "try { Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess -Force -ErrorAction SilentlyContinue } catch {}"
taskkill /F /IM "gonet phone.exe" /T 2>nul
taskkill /F /IM "electron.exe" /T 2>nul
echo [OK] Ports and processes freed successfully.
echo.

echo 2. Cleaning up old dist folders...
if exist dist (
    rmdir /s /q dist
)
echo [OK] Cleanup complete.
echo.

echo 3. Installing app dependencies (npm install)...
call npm install electron-updater
call npm install

echo 4. Building native dependencies (electron-builder)...
call npx electron-builder install-app-deps
echo [OK] Native dependencies built successfully.
echo.

echo 5. Starting the final build and packaging process (.exe)...
call npm run build
echo.
echo ==========================================================
echo Congratulations! The build is complete.
echo Check the [ dist ] folder for your new Setup.exe
echo ==========================================================
pause
