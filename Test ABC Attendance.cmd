@echo off
setlocal
cd /d "%~dp0"
title Uji ABC Attendance
echo Menguji Stage 3-6 dengan data fiktif dan emulator terpisah.
where node >nul 2>nul
if errorlevel 1 (
  echo FAIL - Node.js belum ditemukan. Siapkan Node.js 22+ sesuai README.
  pause
  exit /b 1
)
node "%~dp0tests\stage3.mjs"
set "ABC_TEST_EXIT=%ERRORLEVEL%"
pause
exit /b %ABC_TEST_EXIT%
