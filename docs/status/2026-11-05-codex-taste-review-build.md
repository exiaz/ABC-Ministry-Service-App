# TasteCode: ruang tinjauan UI/UX

Agen: Codex · Branch: development · Basis: development @ 12fd9f9 · Tanggal: 2026-11-05
Status: IMPLEMENTED / TESTED lokal · Produksi: NO-GO

## Ringkasan
Permintaan Build terbaru mengimplementasikan blueprint sebagai ruang tinjauan statis dalam proyek yang ada. Enam view menampilkan bukti lokal dan cakupan pemeriksaan; skor serta verdict tetap belum ditetapkan. Ini bukan hasil audit mockup dan tidak menambahkan fungsi operasional MSA.

## Perubahan
- `index.html`, `ui/review.js`, `ui/review-data.js`, `ui/review.css`: navigasi hash, scorecard, filter sumber/temuan dan reset, detail pemeriksaan, pemuatan dokumen, viewer gambar, keadaan kosong/loading/error dan retry.
- `ui/review-kit.css`, `ui/review-charts.js`, `ui/LICENSE-tasteskill.txt`: salinan kit dengan atribusi MIT; CSS memakai token brand, chart helper disalin utuh tetapi tidak dipakai karena tidak ada data grafik.
- `server.mjs`: opsi `review` hanya mengizinkan entry dan berkas tinjauan pada server non-Mentor. `npm start` mengaktifkan ruang tinjauan; pemanggil factory default dan Mentor mempertahankan root tertutup.
- `tests/review.test.mjs`, `tests/review-browser.mjs`: konsistensi bukti, filter, batas static serving, navigasi, keyboard, gambar gagal/retry, modul data gagal/retry dan responsivitas.

## Keputusan visual dan asumsi
- Style: Achromatic ledger; shell: open plane. Nunito Sans dan logo asli mengikuti brand system. Face merah ABC disediakan sebagai token data utama, tetapi tidak dipaksakan ke chrome atau grafik rekaan.
- Signature tanggal sesi, kelompok dan status tidak dirender karena tidak ada bukti sesi lengkap. Tidak mengarang data absensi untuk memenuhinya.
- Target kontrol diperbesar menjadi minimal 48px untuk aturan aksesibilitas proyek, menggantikan tinggi visual 36px sheet. Label navigasi tetap tampil; menu tablet/mobile memakai sheet.
- Referensi user-reference-4 tetap dipilih, tetapi PDF belum tersedia. Komposisi fallback blueprint bukan klaim kesesuaian visual dengan referensi.
- Tidak ada backend, autentikasi, otorisasi, data siswa, atau histori absensi yang diubah. Tidak ada dependensi atau preview server persisten baru.

## Pertanyaan per layar
- Tinjauan: apakah bukti cukup untuk keputusan adopsi?
- Autentikasi: apakah alur masuk jelas dan feedback tepat?
- Absensi: apakah Mentor memahami sesi, pilihan kehadiran dan penyimpanan?
- Siswa: apakah informasi dapat ditemukan dan dikelola sesuai kewenangan?
- Rundown: apakah bukti cukup untuk menilai urutan kegiatan dan tindakan pengguna?
- Sumber: sumber mana yang tersedia dan apa batas pemeriksaannya?

## Kontrak yang berubah
- Server CLI `node server.mjs` / `npm start`: `/` yang sebelumnya tidak menyajikan halaman kini membuka tinjauan statis.
- Factory `createPrototypeServer`: parameter opsional `review=false`; root lama tetap 404 bila tidak diaktifkan, termasuk Mentor. Tidak mengubah API atau header keamanan.
- Hash baru hanya pada entry tinjauan: `#/tinjauan`, `#/autentikasi`, `#/absensi`, `#/siswa`, `#/rundown`, `#/sumber`.
- Tidak ada hook atau kontrak halaman operasional yang dipindah.

## Kebutuhan integrasi
- `sw.js`: tidak berubah; entry tinjauan tidak mendaftarkan service worker.
- Allowlist berkas tinjauan sudah diterapkan secara terarah dalam `server.mjs`.
- `PROJECT_STATUS.md`: tidak diubah. Entri aditif bila integrasi diminta: ruang tinjauan statis teruji, referensi PDF dan audit komparatif belum selesai.

## Verifikasi aktual
- `npm.cmd run check`: lulus, 247 berkas JS/MJS. Checker proyek tidak memindai `ui/`; sintaks modul UI diperiksa terpisah dengan `node --check`.
- `npm.cmd test`: hasil akhir 267/267 lulus. Eksekusi awal gagal pada tiga assertion root legacy akibat perubahan root terlalu luas; diperbaiki dengan opsi review terpisah tanpa melemahkan tes.
- `node --test tests/review.test.mjs tests/auth-pilot.test.mjs tests/mentor-ui.test.mjs tests/roster-api.test.mjs tests/review-browser.mjs`: 27/27 lulus setelah perbaikan kontrak server.
- `node --test tests/review-browser.mjs`: eksekusi terakhir 1/1 lulus setelah penambahan reset temuan. Menguji Chrome headless, filter gabungan/reset, topik, rute tak dikenal, Back/Forward, viewer, Escape/fokus kembali, retry gambar dan modul data, menu aktif yang dipilih ulang, reduced motion.
- Layout diuji pada 360/390/768/1365/1440px: tanpa overflow horizontal, satu h1, sidebar terlipat pada tablet/mobile. Target kontrol view tinjauan diperiksa minimal 48px. View sumber dan absensi juga diperiksa overflow pada semua ukuran.
- Font: satu FontFace Nunito Sans loaded; `document.fonts.check` untuk 400/500/700 lulus. Semua digit berukuran 8.40625px pada normal dan tabular-nums: sudah sama lebar, tetapi tidak ada perubahan lebar akibat fitur tersebut. Tidak mengklaim fitur tnum mengubah glyph.
- Pemeriksaan kontras delapan pasangan token teks lulus >=4.5:1; minimum 6.84:1. Ini bukan sertifikasi aksesibilitas menyeluruh.
- Salinan chart kit identik dengan sumber; komentar lisensi awal dan lisensi MIT lengkap dipertahankan.
- `git diff --check`: lulus. Peringatan Git tentang akses global ignore dan normalisasi CRLF muncul; tidak mengubah konfigurasi Git.
- Tangkapan lokal: `.emulator-data/review-build/desktop.png`, `mobile.png`; tidak untuk commit. Tangkapan desktop/mobile diperiksa secara visual.
- Tidak ada build step, lint khusus, atau TypeScript compiler pada proyek. Tidak dipasang alat baru.

## Risiko dan pekerjaan tersisa
- Verify before publishing: perbarui status ketersediaan/pemeriksaan sumber dalam `ui/review-data.js`, khususnya empat PDF katalog. Dataset adalah snapshot pemeriksaan, bukan sinkronisasi langsung.
- `categories.rating`, `findings`, `recommendations`, dan `verdict` pada modul yang sama sengaja belum berisi hasil audit. Array kosong tidak berarti aplikasi bebas masalah.
- Belum diuji: screen reader, perangkat fisik, browser selain Chrome, kesesuaian komposisi PDF terpilih, dan pengujian pengguna.
- Aplikasi ini adalah alat penataan bukti. Penilaian komparatif, skor ahli dan keputusan adopsi masih memerlukan pemeriksaan mockup yang sebenarnya.

## Serah terima
- Penulis: Codex; pekerjaan Build selesai, siap Preview oleh TasteCode. Tidak ada server pengujian yang ditinggalkan.
- Baseline: `12fd9f9`; lingkup: entry tinjauan, `ui/review*`, lisensi kit, allowlist server dan tes terkait.
- Perubahan lokal yang sudah ada dipertahankan: `.taste/assets.json`, `.taste/brand.json`, `.taste/brief.json`, `.taste/page.json`. Tidak ditulis ulang oleh pekerjaan Build.
- Tidak staging, commit, push, merge, deploy atau perubahan branch.
- Agen penerima membaca ulang laporan, diff, dan berkas terbaru sebelum menyunting.

## Usulan commit
Summary: `feat(review): add local evidence review workspace`
Description:
- Add six accessible review views with source filters and evidence previews.
- Preserve legacy server roots through an explicit review serving option.
- Cover review data, static boundaries and browser interactions with tests.
