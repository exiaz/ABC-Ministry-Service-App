@echo off
setlocal
cd /d "%~dp0"
title ABC Ministry Service App - Hentikan Pilot
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum ditemukan. Hentikan melalui Enter di jendela pilot.
  pause
  exit /b 1
)
node "%~dp0local-auth-pilot.mjs" stop
set "MSA_PILOT_EXIT=%ERRORLEVEL%"
if not "%MSA_PILOT_EXIT%"=="0" pause
exit /b %MSA_PILOT_EXIT%
