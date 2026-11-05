# Optimasi launcher dan serah terima penghentian PWA lama

Agen Codex · Branch `codex/legacy-migration` · Basis pekerjaan `633eb17` · 2026-11-04

Status **PARTIAL** · Produksi **NO-GO**

## Perubahan dan pengukuran

- `local-service.mjs` membaca berkas fingerprint dalam kelompok maksimal 16. Hash masih menerima path dan isi file dalam urutan yang sama. Setiap pemeriksaan membaca ulang isi sumber agar launcher tetap mendeteksi perubahan kode.
- Benchmark lokal Windows, Node.js 24.22.0, 125 berkas, 30 pengukuran per versi setelah pemanasan. Kedua implementasi membaca direktori yang sama dan dijalankan bergantian. Median 68,70 → 21,41 ms, p90 73,86 → 24,28 ms. Semua hasil SHA-256 cocok. Angka ini mengukur perhitungan fingerprint, bukan waktu startup Firebase atau waktu muat halaman.

## Kontrak yang berubah

Tidak ada perubahan URL, API, markup, izin, atau format fingerprint. Edit sumber tetap membuat instance yang dimulai dari versi sumber sebelumnya tidak cocok untuk reuse.

## Serah terima untuk Claude atau integrator

Hook `collab-guard` pada tahap sebelumnya menolak edit `server.mjs` oleh Codex, termasuk setelah izin perubahan paralel diberikan. `sw.js` berada dalam daftar berkas terlindungi yang sama. Tahap ini tidak mencoba mengulang edit tersebut.

1. Rekonsiliasi allowlist dan rute `server.mjs` dengan `claude/u6b-modul-admin`. Pertahankan `createPrototypeServer` sebagai penyaji login Mentor aktif selama launcher memakainya, termasuk gate emulator, CSP, injeksi API origin, opsi SESSION 1A, dan recovery. Portal aktif memakai 4277, Mentor 4276. Periksa secara terpisah demo 4173 dan pairing 4176. `local-demo.mjs` memeriksa root Mentor dan marker kesehatan, dan masih dipakai untuk snapshot/recovery legacy.
2. Pindahkan skenario browser yang masih memerlukan shell lama. Mulai dari `tests/emulator/device-management-ui.mjs`, `mentor-attendance-ui.mjs`, `backup-ui.mjs`, `mentor-pairing-ui.mjs` dan `msa-a2-1-ui.mjs`. Bawa assertion penting untuk scope, revisi, retry idempoten, pencabutan, dan isolasi riwayat. Tes browser MSA yang sudah tersedia mencakup finalisasi, koreksi, sesi, dan penutupan data privat saat offline. Kalender offline demo, ekspor XLSX dan formulir siswa lama perlu keputusan eksplisit bila kemampuan setara belum ada di MSA.
3. Sajikan worker penghentian di URL lama `/sw.js` pada origin yang pernah mendaftarkannya. Worker perlu menggantikan versi aktif, menghapus hanya cache milik PWA lama `abc-school-*`, lalu melepas registrasinya. Uji profil Chrome yang sudah memasang worker lama pada origin yang sama, termasuk cache milik aplikasi lain dan penyimpanan browser yang harus bertahan. Uji juga profil bersih. Hapus shell lama setelah kedua jalur lulus.
4. Periksa kembali 13 kandidat dengan ukuran terlacak total **104.693 byte** sebelum menghapus. Shell dan worker: `index.html`, `mentor.html`, `app.js`, `manifest.webmanifest`, `sw.js`. Modul: `assignment-ui.js`, `birthday-ui.js`, `birthdays.js`, `pairing-ui.js`, `reports.js`, `student-import.js`, `xlsx-reader.js`, `xlsx.js`. Jumlah itu adalah inventaris kandidat; beberapa masih dipakai suite lama, dan URL worker perlu masa transisi. Pertahankan modul bersama seperti `data.js`, `scheduling.js`, `service-ui.js`, `pairing-client.js`, `secure-mentor.js` dan `mentor-attendance.js`.
5. Perbarui rute, skrip tes, README dan allowlist bersama penghapusan. Jalankan `npm.cmd run check`, `npm.cmd test`, `npm.cmd run test:stage6`, Chrome portal terpadu, dan tes migrasi worker. Rangkaian sebelumnya berhenti di 159/166 integrasi karena tujuh kasus tanggal tetap Stage 9B.2. Ambil perbaikan fixture dari `codex/regression-stabilization` melalui alur integrasi, lalu ulangi suite. Ukur byte aktual yang terhapus setelah diff siap.

## Kebutuhan saat merge

- Tidak ada modul baru atau perubahan cache untuk optimasi fingerprint.
- Indeks `PROJECT_STATUS.md` dapat merujuk laporan ini untuk benchmark launcher dan sisa pekerjaan PWA legacy.

## Verifikasi aktual

- Benchmark menguji kesamaan fingerprint kedua implementasi selama 30 pengukuran per versi.
- `npm.cmd run check` lulus untuk 240 berkas, `npm.cmd test` lulus 225/225, dan `git diff --check` lulus. Tes mencakup penolakan reuse jika isi sumber atau konfigurasi berubah.
- Pilot yang sudah berjalan tetap `ready` dan portal merespons HTTP 200. Pemeriksaan menemukan fingerprint instance berbeda dari sumber terbaru sesuai kontrak launcher. Tidak dilakukan restart atau regresi browser/emulator penuh pada tahap ini.
- CLI Codebase Memory gagal memuat pengaturan runtime. Pemetaan pengguna file memakai sumber, referensi Git, dan tes yang tersedia.

## Usulan commit

Summary `perf(msa): batch reads for launcher source fingerprints`

- Read source files in bounded batches while preserving hash order.
- Record the benchmark and hand off protected legacy retirement work.
