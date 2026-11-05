# Permintaan ke Codex: hapus PWA Mentor lama (ABC Attendance)

Agen: Claude · Branch: claude/u6b-modul-admin · Basis: development @ f9e6c3c · Tanggal: 2026-11-04
Status: BLOCKED (menunggu Codex) · Produksi: NO-GO

Tidak ada berkas aplikasi yang diubah. Ini permintaan serah-terima; path terkait milik Codex atau hanya diubah saat merge.

## Ringkasan
Pengguna meminta prototipe "ABC Attendance" lama dihapus karena agen masih membuka emulator PWA itu. PWA lama = PWA Mentor yang disajikan `server.mjs` (`index.html`, `app.js`, `sw.js` dan modul pendukungnya). Penghapusan menyentuh server, tes, dan `sw.js`, jadi diserahkan ke Codex.

## Temuan (hasil `git grep`, belum diuji)
Boleh dihapus setelah dipastikan tidak ada pemakai lain (kandidat):
- `index.html`, `app.js`, `sw.js`, `manifest.webmanifest`
- Rute dan daftar `allowed`/`assets` di `server.mjs` (dan mode `mentor` yang memetakan `index.html` ke `mentor.html`), `mentor.html`
- Modul yang hanya dipakai PWA itu (periksa dulu): `data.js`, `student-data.js`, `birthdays.js`, `birthday-ui.js`, `xlsx-reader.js`, `student-import.js`, `dates.js`, `group-config.js`, `service-config.js`, `scheduling.js`, `service-ui.js`, `reports.js`, `assignments.js`, `assignment-ui.js`, `xlsx.js`, `pairing-*.js`, `device-storage.js`, `secure-mentor.js`, `mentor-attendance.js`

JANGAN dihapus (masih aktif):
- `admin.html`: dipakai `admin-server.mjs` sebagai halaman login Admin (mode usernamePilot).
- `a1.html`: ada di navigasi `msa-session.js` dan `backend/msa-portal-session.mjs`.
- `styles.css`: dipakai `mentor-account.html`, `admin.html`.
- `mentor-config.js`, `mentor-session-schedule.js`, `admin-*.js`, `secure-admin.js`: dipakai admin dan tes.

Tes yang merujuk berkas lama dan perlu disesuaikan: `tests/roster-api.test.mjs` (rute `/`, `/index.html`, `/app.js`, `/sw.js`), `tests/msa-branding.test.mjs` (judul `index.html`, `mentor.html`, isi `app.js`/`reports.js`), `tests/admin-login.test.mjs` (hanya assert 404, kemungkinan aman), serta tes unit untuk modul yang ikut dihapus.

## Kontrak yang berubah
Tidak ada (belum ada perubahan). Bila dikerjakan: rute `/`, `/index.html`, `/app.js`, `/sw.js` di server Mentor lama berubah.

## Kebutuhan saat merge (untuk integrator)
- Versi cache `sw.js`: tidak berlaku bila `sw.js` dihapus; pastikan tidak ada service worker lama terdaftar di perangkat uji.
- Modul di `server.mjs`: daftar `allowed`/`assets` dikurangi.

## Verifikasi aktual
- Hanya `git grep` untuk memetakan rujukan. Tes belum dijalankan.

## Risiko dan pertanyaan terbuka
- Jalur Mentor produksi (`mentor-server.mjs`, `mentor-account.html`) harus tetap berfungsi; konfirmasi pengguna bahwa PWA offline lama memang tidak dipakai lagi.
- `Test ABC Attendance.cmd` dan `tests/stage3.mjs` mungkin masih memakai PWA lama; tentukan apakah ikut diganti nama atau disesuaikan.
- Perubahan menyentuh area server/tes; usulkan `/codex:adversarial-review` bila menyentuh otorisasi.

## Untuk peninjau
- Fokus: tidak ada rute aktif yang putus, `npm.cmd run check` dan `npm.cmd test` hijau.

## Usulan commit
Summary: Catat permintaan penghapusan PWA Mentor lama untuk Codex
Description: Berkas status berisi peta rujukan berkas lama, daftar yang harus dipertahankan, dan tes terdampak. Tidak ada kode yang diubah.
