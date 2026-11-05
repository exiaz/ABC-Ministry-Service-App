# Hapus PWA ABC Attendance lama

Agen: Claude · Branch: development · Tanggal: 2026-11-05 · Status: IMPLEMENTED (tahap 1 dari 2) · Produksi: NO-GO

Pengguna menyetujui penghapusan PWA offline lama dan meminta migrasi penuh. Tahap 1 (PWA) selesai; tahap 2 (admin.html/a1.html) belum, alasan di bawah.

## Perubahan
- Dihapus: `index.html`, `mentor.html`, `app.js`, `sw.js`, `manifest.webmanifest`, `pairing-ui.js`, `birthday-ui.js` (dihapus lewat `git rm`, sehingga sudah ter-stage; belum commit).
- `server.mjs`: daftar `allowed` hanya memuat modul yang masih diimpor halaman terlayani; rute `/` dan pemetaan `index.html`→`mentor.html` dihapus (kini 404).
- Tes browser PWA lama dihapus: `tests/browser.mjs`, `tests/admin-browser.mjs`, `tests/student-forms-browser.mjs`; skrip `test:browser:legacy` dan rujukan README dihapus.
- Tes disesuaikan (lama → baru): `roster-api.test.mjs` (root/app.js/sw.js 200 → 404), `mentor-ui.test.mjs` (root mentor/demo → 404), `auth-pilot.test.mjs` (root mentor biasa `pairing-root` → 404), `msa-branding.test.mjs` (hapus cek manifest/index/mentor/app/sw).
- Arsip riwayat `PROJECT_STATUS.md` dipisah (laporan terpisah di sesi yang sama).

## Kontrak yang berubah
Server prototipe (4173) dan server Mentor tidak lagi menyajikan `/`, `/index.html`, `/app.js`, `/sw.js`, `/manifest.webmanifest`, `/mentor.html`. Login Mentor tetap di `/mentor-account.html`.

## Kebutuhan integrasi
- Service worker lama yang sudah terpasang di perangkat uji tidak dibersihkan otomatis; hapus manual lewat pengaturan situs.
- `PROJECT_STATUS.md` belum diperbarui untuk entri ini (tugas integrator).

## Verifikasi aktual
- `npm.cmd run check`: 242 berkas lulus. `npm.cmd test`: 249/249. `node tests/stage3.mjs --a2-3`: lulus, termasuk 2/2 Chrome portal.

## Belum dikerjakan / batas
1. `admin.html` + `admin-*.js` + `secure-admin.js` dan `a1.html` + `msa-users.js` BUKAN sisa mati: itulah satu-satunya UI Admin untuk kode pairing, aktivasi, perangkat, akun, backup, kalender, dan pengguna & izin. Menghapusnya menghilangkan fungsi tanpa pengganti `msa-*`; perlu pembangunan ulang di UI baru (area auth/backend, penugasan terpisah). Tautan `msa-session.js` dan `backend/msa-portal-session.mjs` ke `/a1.html` juga bergantung padanya. `styles.css` masih dipakai halaman-halaman itu dan `mentor-account.html`.
2. Modul klien lama yang masih diimpor jalur aktif: `data.js`, `scheduling.js`, `assignments.js`, `student-data.js`, `service-ui.js`, `secure-mentor.js`, `pairing-client.js` dan pendukungnya (dipakai `mentor-account.js`, `ui/absen.js`, `local-demo.mjs`).
3. Kode mati yang kini hanya dipakai tes: `reports.js`, `assignment-ui.js`, `birthdays.js`, `student-import.js`. Tidak dihapus agar tes domainnya (admin-data, assignments, scheduling, flexible-calendar) tidak hilang tanpa keputusan pengguna.
4. Perangkat fisik, screen reader, dan browser selain Chrome tidak diuji.

## Serah terima
Baseline: development @ fc4bc9a + perubahan lokal. Lingkup: path di atas. Tidak ada commit/push/deploy.

## Usulan commit
Summary: Hapus PWA ABC Attendance lama dan tes browser terkait
Description: Hapus index/mentor.html, app.js, sw.js, manifest, pairing-ui, birthday-ui; rapikan allow-list server.mjs; sesuaikan tes root menjadi 404; hapus tes browser PWA lama.
