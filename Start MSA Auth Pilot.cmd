@echo off
setlocal
cd /d "%~dp0"
title ABC Ministry Service App - Pilot Akun Fiktif
echo Menyiapkan pilot akun dan data fiktif sementara.
echo Biarkan jendela ini terbuka. Kata sandi peninjau diminta tanpa ditampilkan.
echo Demo reguler dan snapshot tidak digunakan. Konflik port membatalkan startup.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22+ belum ditemukan. Minta operator menyiapkan runtime proyek.
  pause
  exit /b 1
)
node "%~dp0local-auth-pilot.mjs" start
set "MSA_PILOT_EXIT=%ERRORLEVEL%"
if not "%MSA_PILOT_EXIT%"=="0" pause
exit /b %MSA_PILOT_EXIT%
