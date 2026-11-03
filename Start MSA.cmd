@echo off
setlocal
cd /d "%~dp0"
title ABC Ministry Service App
echo Menyiapkan MSA lokal. Semua akun dan data fiktif dimulai dari awal.
echo Biarkan jendela terbuka. Kata sandi akun ditetapkan di aplikasi.
echo Konflik port membatalkan startup tanpa mengubah layanan lain.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22+ belum ditemukan. Minta operator menyiapkan runtime proyek.
  pause
  exit /b 1
)
node "%~dp0local-msa.mjs" start
set "MSA_EXIT=%ERRORLEVEL%"
if not "%MSA_EXIT%"=="0" pause
exit /b %MSA_EXIT%
