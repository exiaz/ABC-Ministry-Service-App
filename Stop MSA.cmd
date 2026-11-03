@echo off
setlocal
cd /d "%~dp0"
title Hentikan MSA
echo Menghentikan layanan milik MSA. Layanan lain tidak diubah.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum ditemukan. Gunakan Enter di jendela MSA.
  pause
  exit /b 1
)
node "%~dp0local-msa.mjs" stop
set "MSA_EXIT=%ERRORLEVEL%"
if not "%MSA_EXIT%"=="0" pause
exit /b %MSA_EXIT%
