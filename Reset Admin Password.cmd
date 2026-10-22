@echo off
setlocal
cd /d "%~dp0"
title Pulihkan Password Admin ABC Attendance
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum ditemukan. Minta operator menyiapkan runtime proyek ini.
  pause
  exit /b 1
)
node "%~dp0local-demo.mjs" recover
set "ABC_DEMO_EXIT=%ERRORLEVEL%"
if not "%ABC_DEMO_EXIT%"=="0" pause
exit /b %ABC_DEMO_EXIT%
