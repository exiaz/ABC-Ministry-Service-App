@echo off
setlocal
cd /d "%~dp0"
title ABC Attendance - Demo Lokal
echo Menyiapkan demo secara otomatis. Biarkan jendela ini terbuka.
echo Jika diminta password, ketik meskipun tulisannya tidak terlihat.
echo Server yang cocok digunakan kembali. Jika ada konflik, ikuti pilihan di jendela ini.
echo Proses yang tidak dikenal tidak akan dimatikan otomatis.
echo Node.js 22+, Java JDK 21+, dependensi dan cache emulator akan diperiksa.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum ditemukan. Minta operator menyiapkan runtime proyek ini.
  pause
  exit /b 1
)
node "%~dp0local-demo.mjs" start
set "ABC_DEMO_EXIT=%ERRORLEVEL%"
if not "%ABC_DEMO_EXIT%"=="0" pause
exit /b %ABC_DEMO_EXIT%
