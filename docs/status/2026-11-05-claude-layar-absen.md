# Layar absen (pratinjau UI) — Claude, 2026-11-05

Branch: `claude/u6b-modul-admin`. Belum di-commit.

## Yang dibuat
Halaman statis mandiri `ui-absen.html` (rute hash `#/`, `#/siswa`, `#/ulang-tahun`, `#/rundown`, `#/kelompok`), memakai data contoh lokal. Tidak menyentuh halaman aktif `msa-*`, `backend/`, auth, atau berkas milik Codex.

Berkas baru: `ui-absen.html`, `ui/absen-kit.css` (kit tasteskill + token ABC), `ui/absen.css`, `ui/absen.js`, `ui/absen-data.js`, `ui/absen-charts.js`, `assets/fonts/geist-variable.ttf`, `geist-mono-variable.ttf`, `OFL-Geist.txt`.

## Kontrak yang berubah
Tidak ada: tidak ada id, `data-*`, ARIA, rute, atau endpoint aplikasi lama yang diubah. Semua id/rute di atas baru dan hanya milik halaman ini.

## Kebutuhan saat merge (integrator)
- `server.mjs`: tambahkan `ui-absen.html`, `ui/absen*.css|js`, `assets/fonts/geist*.ttf` ke daftar izin bila halaman ini ingin disajikan server aplikasi.
- `sw.js`: naikkan cache bila berkas ini dimasukkan ke daftar pra-cache.

## Penyimpangan dari lembar (dan alasannya)
- Tombol utama merah ABC (bukan hitam): merek eksplisit; satu per layar.
- Target sentuh 44px (48px di ponsel) untuk semua kontrol, nav berpitch 44px, bukan 34px: aturan audit.
- Daftar siswa 11 baris (bukan 8) dan kartu samping bertumpuk dalam satu kolom agar dasar kartu sejajar.
- "Tandai semua hadir" menjadi "Tandai sisanya hadir": tidak menimpa izin/tidak hadir yang sudah diisi.
- Tidak ada tombol Keluar: belum ada autentikasi di pratinjau ini.
- Biru #64A4D9 hanya 2,7:1 di atas putih, jadi kotak hadir diberi tepi #1D5F99 dan selalu disertai teks.

## Pengujian
- `npm.cmd run check`: lolos (240 berkas). `npm.cmd test`: 225 lolos, 0 gagal.
- Chrome headless (Playwright, server statis sementara) di 360/390/768/1280/1440: tanpa galat konsol dan `console.assert`, tanpa luapan horizontal, satu h1 per tampilan, tidak ada target sentuh di bawah 44px, Geist dan Geist Mono terbaca `loaded`, kontras teks di atas 4,5:1.
- Dijalankan: menandai, Tandai sisanya hadir, simpan gagal lalu coba lagi, tab, cari, urutan kolom, laci tambah siswa (validasi, Escape, fokus kembali), tab bulan, `?daftar=memuat|galat|kosong`, `prefers-reduced-motion`.
- Belum dijalankan: suite emulator/browser proyek, pembacaan layar, uji perangkat nyata.

## Batasan
- "Simpan absen" hanya menyimpan di memori halaman; tidak ada backend.
- Pembatasan peran (admin vs mentor) hanya tampilan; kontrol akses nyata harus di server (Codex).
