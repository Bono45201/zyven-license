@echo off
setlocal
title Zyven Owner Builder
cd /d "%~dp0"

echo.
echo ========================================
echo   ZYVEN OWNER MANAGER - UNIFIED UI
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found in PATH.
  echo Install Node.js and try again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found in PATH.
  pause
  exit /b 1
)

echo [1/3] Installing dependencies...
call npm install
if errorlevel 1 goto :fail

echo [2/3] Building renderer...
call npm run build
if errorlevel 1 goto :fail

echo [3/3] Building portable Windows EXE...
call npm run dist
if errorlevel 1 goto :fail

echo.
echo [OK] Build complete.
echo Output: %CD%\release
echo.
pause
exit /b 0

:fail
echo.
echo [ERROR] Build failed. Read the error above.
echo.
pause
exit /b 1
