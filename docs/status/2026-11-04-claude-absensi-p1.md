# Absensi Mentor: perbaikan P1 dari audit UI/UX (P1-1 s.d. P1-3)

Agen: Claude · Branch: claude/absensi-p1 · Basis: development @ f9e6c3c · Tanggal: 2026-11-04
Status: IMPLEMENTED · Produksi: NO-GO

## Ringkasan
Tiga perbaikan lapisan tampilan dari audit UI/UX 4 Nov 2026 untuk alur absensi Mentor di ponsel 360 px. Arah dipilih pengguna: foto dipindah ke bawah kartu, tab diurutkan ulang dengan pudar di tepi kanan.

## Perubahan
- `mentor-account.html`: slot foto `data-visual-slot="dashboard"` dipindah dari bawah strip tanggal ke akhir `#account-profile` (setelah `#account-backup`). Kartu kelompok dan tombol "Mulai absensi" kini langsung di bawah sapaan.
- `secure-mentor.js` (render saja):
  - Urutan tab filter: Semua, **Belum Diabsen**, Hadir, Izin, Tidak Hadir (sebelumnya Belum Diabsen terakhir dan terpotong di 360 px).
  - Catatan "Belum Diabsen tetap terpisah dari Tidak Hadir…" dikeluarkan dari bilah lengket `.mentor-cta` dan ditaruh tepat sebelumnya (tidak lengket). Bilah lengket tinggal tombol "Tinjau & selesaikan", ditambah catatan tanggal-belum-tiba hanya bila pelayanan di masa depan (alasan tombol nonaktif tetap dekat tombol).
- `mentor-account.css`: di ≤640 px `.mentor-tabs` diberi `mask-image` pudar 32 px di kanan sebagai petunjuk gulir, plus spacer `::after` 24 px agar tab terakhir tidak ikut pudar saat strip digulir habis.

Koreksi atas audit: P1-2 di audit menyebut bilah "Tinjau & selesaikan" dirender sebelum daftar. Itu keliru. Bilah sudah berada setelah daftar; yang terlihat di tangkapan adalah posisi lengketnya di atas nav. Masalah nyatanya tinggi bilah lengket (catatan dua baris + tombol) yang menutup kolom pencarian dan baris siswa; itu yang diperbaiki.

## Kontrak yang berubah (wajib, untuk agen lain)
- Tidak ada `id`, `name`, `data-*`, ARIA, rute hash, URL, atau endpoint yang berubah.
- Urutan DOM: slot foto `dashboard` pindah ke akhir `#account-profile`; urutan tombol `[data-action=roster-tab]` berubah (dipilih lewat `data-id`, tes yang ada tidak bergantung pada urutan).
- Teks tidak berubah; `.mentor-cta__note` dengan teks aturan Belum Diabsen kini sibling sebelum `.mentor-cta`, bukan anaknya.

## Kebutuhan saat merge (untuk integrator)
- Versi cache `sw.js`: naik (`secure-mentor.js` ada di daftar ASSETS; v15 → v16 atau sesuai urutan merge U6a/U6b).
- Modul baru di `server.mjs`: tidak.
- Baris indeks `PROJECT_STATUS.md` yang disarankan: "4 Nov 2026 — UI-OVERHAUL absensi P1: kartu kelompok sebelum foto, tab Belum Diabsen kedua dengan petunjuk gulir, bilah selesaikan lebih ringkas. Rincian: docs/status/2026-11-04-claude-absensi-p1.md."
- Branch ini dari `development` (tanpa U6a/U6b). Berkas yang disentuh tidak tumpang tindih dengan U6a/U6b.

## Verifikasi aktual
- `npm.cmd run check`: 240 berkas lulus.
- `npm.cmd test`: 225/225 lulus.
- `git diff --check`: bersih.
- `node tests/stage3.mjs --a2-3` (atas persetujuan pengguna): unit 225/225, integrasi 7/7, Chrome 3/3 lulus (`run-bxAUNH`); tes menegaskan tanpa overflow horizontal di 360/390/768/1365.
- `node tests/stage3.mjs --visual`: unit 225/225, integrasi/Chrome 3/3 lulus (`run-gqnwEC`), termasuk pratinjau slot `dashboard`.
- Tangkapan 360 px diperiksa visual (`run-bxAUNH/screenshots/msa-a2-3-authorized-360.png`, `-keyboard-360.png`): "Mulai absensi" di y≈530 (dalam layar 640 tanpa gulir; sebelumnya ≈730); tab "Belum Diabsen 2" kedua dan terlihat, pudar tepi kanan tampak; bilah lengket kini satu tombol. Lebar 390/768/1365 hanya dicek oleh assertion overflow, tidak diperiksa visual.
- Belum diuji: perangkat fisik, browser selain Chrome, screen reader, cincin fokus pada tab di area pudar.

## Risiko dan pertanyaan terbuka
- `mask-image` juga memudarkan cincin fokus tab di 32 px tepi kanan; tab yang difokus keyboard biasanya digulir ke tengah, tetapi perlu dilihat di tangkapan.
- Pratinjau Visual Studio slot `dashboard` (`tests/emulator/msa-visual.test.mjs`) membangun ulang halaman Mentor; posisi foto berubah di sana juga. Perlu `--visual` untuk memastikan.
- Temuan detektor Impeccable "dark-glow" pada `mentor-account.html` berasal dari `styles.css:2` (bayangan `dialog` legacy). Dibiarkan; masuk P2-5 audit.

## Untuk peninjau
- Fokus: regresi UI 360 px pada beranda Mentor dan absensi; tidak ada perubahan logika absensi.
- Diff: `git diff development...claude/absensi-p1`

## Jawaban atas tinjauan
Belum ada tinjauan.

## Usulan commit
Summary: UI absensi Mentor: kartu sebelum foto, tab Belum Diabsen kedua, bilah selesaikan ringkas
Description: Perbaikan P1-1 s.d. P1-3 audit UI/UX 4 Nov 2026 (lapisan tampilan saja). Slot foto dashboard dipindah ke bawah kartu kelompok agar "Mulai absensi" terlihat tanpa gulir di 360 px. Tab filter diurutkan Semua, Belum Diabsen, Hadir, Izin, Tidak Hadir dengan pudar tepi kanan di ≤640 px. Catatan aturan dikeluarkan dari bilah lengket sehingga bilah hanya berisi tombol. Tanpa perubahan id, data-*, ARIA, teks, atau logika absensi. check 240, test 225/225, stage3 --a2-3 dan --visual lulus.
