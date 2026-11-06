# Pil: label filter dan kesinambungan fokus

Agen: Codex | Branch: development | Basis: 12fd9f92590871f0941ee7804a129c519fee301d | Tanggal: 2026-11-06
Status: IMPLEMENTED / TESTED pada Chrome. Commit/push: BLOCKED oleh hook. Produksi: NO-GO.

## Ringkasan
Menangani temuan audit 2 dan 3. Tombol segmented tidak menyusut di bawah lebar isinya; kelompok tetap dapat digulir horizontal. Render pada view yang sama memulihkan kontrol fokus berdasarkan ID/data-* serta mempertahankan scroll horizontal induknya. Perpindahan view tetap memfokuskan judul; posisi kursor input existing dipertahankan.

## Perubahan
- `ui/pil.css`: `flex:0 0 auto` untuk tombol segmented, termasuk filter Absensi.
- `ui/pil.js`: pemulihan fokus pada kontrol yang dirender ulang, tanpa perubahan data/auth/API.
- `tests/pil-browser.mjs`: regresi label, fokus status dengan Space/Enter, scroll filter, pilihan pekan dan tab Anak/Volunteer pada 360/390/768/1440px.
- `.gitattributes`: PDF diperlakukan sebagai binary agar referensi desain aman saat staging/checkout. Keempat PDF staged diverifikasi identik byte-per-byte dengan sumber lokal.

## Kontrak yang berubah
Tidak ada perubahan ID, name, data-*, ARIA, rute, endpoint, teks atau model data. Perilaku fokus setelah render pada view yang sama diperbaiki. Fallback memilih kontrol dengan atribut sama jika pemicu seperti Periksa kebutuhan tidak tersedia lagi pada tab tujuan.

## Kebutuhan integrasi
Tidak ada dependency, modul server, perubahan cache `sw.js` atau `PROJECT_STATUS.md`. Temuan audit 4 dan 5 tetap terbuka.

## Verifikasi aktual
- `tests/pil-browser.mjs` dijalankan melalui Node dengan cwd artefak di luar repositori: 298 assertion lulus; enam viewport 360/390/768/1100/1365/1440px, termasuk regresi pencarian fix 1, filter, status siswa, dialog, riwayat navigasi, scroll, font dan reduced motion. Screenshot Absensi mobile diperiksa visual.
- Run awal tes baru timeout karena setup masih memilih periode satu pekan sehingga tombol 2 Oktober tidak ada. Setup diperbaiki menjadi enam pekan; pengulangan lulus tanpa melemahkan assertion/timeout.
- `node --test tests/pil.test.mjs tests/ui-tokens.test.mjs`: 7/7 lulus sesudah perubahan akhir. Sebelum perbaikan, tes Pil/token/review juga lulus 10/10.
- `npm.cmd run check`: 249 berkas JS/MJS lulus sesudah perubahan akhir. Working diff dan staged diff check juga lulus.
- Pemeriksaan indeks kode gagal: Transport closed. Pemanggil render dan sumber terkait dibaca langsung; tidak melakukan re-index.
- Diff staged sebelumnya gagal pada whitespace internal PDF D0 yang terdeteksi sebagai teks. Atribut binary memperbaiki klasifikasi; pemeriksaan staged ulang lulus dan byte sumber dipertahankan.

## Git dan serah terima
Pengguna mengizinkan commit/push serta penyertaan implementasi Taste Code yang diperlukan. Baseline Taste Code + fix 1, sumber desain, aset/lisensi, arsip dan tes telah staged secara eksplisit. Cache/config lokal tidak staged; pemeriksaan ignore dilakukan. Perintah commit/push ditolak PreToolUse `collab-guard:DESTRUCTIVE_GIT` dengan alasan operasi mengubah branch/riwayat/data dan harus melalui pengguna setelah persetujuan eksplisit. Tidak mencoba bypass hook; commit dan push belum terjadi.

Fix 2–3 tetap sebagai perubahan unstaged pada `ui/pil.js`, `ui/pil.css`, `tests/pil-browser.mjs`, bersama laporan baru ini. Penulis Codex selesai. Agen penerima wajib membaca status, staged diff dan working diff sebelum melanjutkan; jangan menimpa baseline staged atau pekerjaan lokal sebelumnya.

## Risiko dan batas
Belum diuji pada perangkat fisik, Safari/iOS, screen reader, emulator autentikasi, atau cache PWA. Tidak mengulang suite unit penuh. Ini perbaikan pratinjau fixture, bukan kesiapan produksi.

## Usulan commit fix 2–3
Summary: `fix(ui): preserve filter labels and keyboard focus`
Description:
- Keep segmented filter labels readable without shrinking controls.
- Restore same-view control focus and horizontal scroll after rendering.
- Cover keyboard selection and responsive filter regressions.
