# Migrasi regresi browser ke MSA

Agen Codex · Branch `codex/legacy-migration` · Basis `development@f9e6c3c` · 2026-11-04

Status **PARTIAL** · Produksi **NO-GO**

## Ringkasan

Perintah browser utama memakai akun Mentor MSA dan portal. Alur kalender, laporan, dan offline prototipe tetap tersedia melalui perintah regresi terpisah selama PWA lama masih disajikan.

## Perubahan

- `package.json` dan `tests/stage3.mjs` mengarahkan `test:browser` ke AUTH A2.3, SESSION 1A, dan Chrome portal dengan respons sesi simulasi. Regresi penuh memakai pengujian portal yang sama. `test:browser:legacy` tetap menjalankan `tests/browser.mjs` dan menyimpan screenshot di `.emulator-data/legacy-browser/`.
- `tests/emulator/msa-a2-3-ui.mjs` memeriksa draf belum lengkap, pembatalan, finalisasi, koreksi dengan alasan, dan finalisasi ulang. Firestore diverifikasi untuk ID batch yang sama, kenaikan revisi, dan snapshot status sebelum koreksi.
- `Test ABC Attendance.cmd` menjadi `Test MSA.cmd`. `README.md` dan `QA.md` memakai nama baru.

## Kontrak yang berubah

- `npm.cmd run test:browser` menjalankan regresi MSA. Gunakan `npm.cmd run test:browser:legacy` untuk runner demo sebelumnya.
- `test:stage6` dan `--from-browser` menjalankan pengujian portal sebagai ganti fase kalender/laporan/offline demo. Browser kompatibilitas Mentor pairing, backup, dan pengelolaan perangkat masih ada di regresi penuh.
- Shortcut Windows `Test ABC Attendance.cmd` → `Test MSA.cmd`. URL, kontrak API, dan skema data aplikasi tetap.

## Kebutuhan saat merge

- Indeks `PROJECT_STATUS.md` dapat merujuk laporan ini sebagai migrasi parsial suite browser.
- Rekonsiliasi perubahan U6b dan peta pengguna `server.mjs` sebelum memutus rute lama. Pilot terpadu masih memakai factory server itu untuk login Mentor.
- Pertahankan endpoint pembaruan pada URL `/sw.js` di setiap origin lama sampai pengujian upgrade berhasil. Uji dari profil Chrome yang sudah memasang worker lama dan periksa registrasi hilang, cache `abc-school-*` terhapus, cache lain dan penyimpanan browser tetap utuh.

## Verifikasi aktual

- `npm.cmd run check` lulus pada 240 berkas dan `npm.cmd test` lulus 225/225.
- `npm.cmd run test:browser` lulus pada 7/7 integrasi, 3/3 Chrome Mentor, dan 2/2 Chrome portal simulasi. Emulator uji ditutup. Chrome mencatat pembatalan request gambar pada dua URL visual; suite tetap lulus.
- `npm.cmd run test:browser:legacy` lulus, termasuk service worker, kalender, laporan, dan muat ulang offline.
- `node --test tests/msa-portal-browser.mjs` lulus 1/1 dari salinan `development@f9e6c3c` dengan controller terpisah. Login Superadmin/PIC, navigasi, sesi bersama dan penolakan izin diverifikasi. Pilot uji ditutup.
- `npm.cmd run test:stage6` lulus sintaks dan 225/225 unit, lalu berhenti pada integrasi 159/166. Tujuh kegagalan di Stage 9B.2 berkaitan dengan fixture tanggal tetap 3 November 2026 dan penolakan jadwal lampau. Sumber dan fixture Stage 9B.2 identik dengan basis. Fase browser penuh dan cold recovery tidak tercapai. Emulator uji ditutup.
- Shortcut baru diverifikasi dengan CMD pada skenario Node tidak tersedia. Pesan prasyarat muncul dan exit code 1.

## Batas dan risiko

- Hook `collab-guard` menolak edit `server.mjs` setelah otorisasi pengguna untuk perubahan paralel. Penghentian service worker, penghapusan shell/aset, dan pengukuran runtime menunggu tahap integrasi.
- `local-demo.mjs` masih memeriksa respons root Mentor dalam mode pairing dan mempertahankan jalur snapshot/recovery. Tes lama juga masih memakai shell pairing untuk otorisasi, konflik revisi, retry, serta pencabutan perangkat. Migrasikan cakupan ini sebelum menghapus rute dan asetnya.
- Tiga worktree terdaftar masih aktif. `MSA-claude` memiliki commit cleanup dan file lokal unik. Tidak ada branch lokal tambahan yang terintegrasi dan aman dihapus, serta tidak ada metadata worktree yang ditandai usang oleh dry-run Git.

## Untuk peninjau

- Periksa bahwa absensi setelah koreksi memakai batch dan siswa yang sama, riwayat status lama bertahan, dan demo dapat diuji lewat perintah eksplisit.
- Diff `git diff development...codex/legacy-migration`.

## Usulan commit

Summary `test(msa): make MSA the default browser regression`

- Run current Mentor and portal checks by default and retain an explicit legacy command.
- Verify attendance finalization and correction history through the MSA Mentor UI.
- Rename the Windows test shortcut to match the active application.
