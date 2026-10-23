@echo off
setlocal
cd /d "%~dp0"
title Hentikan ABC Attendance
echo Menunggu demo menyimpan data dan berhenti. Jangan tutup paksa.
echo Server ABC yang dipakai ulang juga ditutup dengan rapi sebelum data disimpan.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum ditemukan. Gunakan Enter pada jendela demo untuk berhenti.
  pause
  exit /b 1
)
node "%~dp0local-demo.mjs" stop
set "ABC_DEMO_EXIT=%ERRORLEVEL%"
if not "%ABC_DEMO_EXIT%"=="0" pause
exit /b %ABC_DEMO_EXIT%
