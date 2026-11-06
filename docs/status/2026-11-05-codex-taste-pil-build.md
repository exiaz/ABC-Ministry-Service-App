# Build antarmuka Pil dari mockup terbaru

Agen: Codex | Branch: development | Basis: 12fd9f92590871f0941ee7804a129c519fee301d | Tanggal: 2026-11-05
Status: IMPLEMENTED untuk UI dan pratinjau data fiktif. Produksi: NO-GO.

## Ringkasan
Root pratinjau yang sebelumnya berisi Tinjauan UI/UX kini membuka Welcome ABC MSA dan view aplikasi Pil. Arsitektur vanilla, package manager, dan pipeline yang ada dipertahankan. Tidak ada login sukses palsu, API baru, atau penyimpanan absensi dari fixture. Halaman operasional tetap memakai controller dan kontrak lama, dengan pembaruan token serta skin autentikasi bersama.

## Perubahan
- `index.html`, `ui/pil.js`, `ui/pil.css`, `ui/pil-data.js`: Welcome, masuk, beranda Admin/Mentor, absensi, dasbor anak/Volunteer, pelayanan/detail, kalender/filter, serta view pendukung akun/perangkat/jadwal/riwayat.
- `ui/pil-kit.css`, `ui/pil-charts.js`: salinan kit dengan atribusi baris pertama. Charts dipertahankan identik; CSS hanya mengganti token dan membuang aturan dark yang tidak dipakai. Grafik khusus dirender dari data sebagai SVG dengan skala 0-100%, nilai, dan kontrol pekan native.
- `ui/msa-tokens.css`, `ui/msa-auth.css`, `msa-shell.css`: token Pil, kanvas putih, radius/kontrol sesuai referensi, form kanan dan media kiri pada desktop, transisi serta reduced motion. Komponen dan hook existing tetap dipakai.
- `msa-visual.js`, `msa-visual.json`: media generated dari fase Assets menjadi default Welcome/login. Media terpublikasi tetap mengungguli default. Keterangan ilustratif hanya muncul untuk file generated tersebut.
- `server.mjs`, `admin-server.mjs`: tambahan allowlist aset eksplisit. Tidak membuka folder arbitrer atau mengubah guard API/halaman Mentor.
- `ui-review.html`: salinan halaman tinjauan sebelumnya, dipertahankan sebagai arsip; modul dan sumber tinjauannya tidak ditimpa. Runner browser arsip kini menunjuk URL tersebut.
- `tests/pil.test.mjs`, `tests/pil-browser.mjs`, `tests/ui-tokens.test.mjs`: data, route statis, interaksi, ukuran target, font, dan ukuran D0 terbaru. Pemeriksaan kontras lama tidak dilemahkan.

## Gaya, shell, face, dan pengecualian
Sheet yang didealt adalah Framed sheet. Sesuai prioritas referensi dan brand system yang diberikan, komposisi Pil menggantikannya pada layar yang tercakup PDF: sidebar putih desktop 272px, navigasi pil ponsel, kartu radius 32/40, kontrol kapsul, dan dua font existing. Tidak menambahkan frame L atau mempertahankan kanvas krem C10.

Face adalah logo asli, Baloo 2/Nunito Sans, serta fokus merah ABC. Signature adalah unit tanggal, nama pelayanan, tempat/kelompok, PIC, dan status berikon. Signature digunakan pada objek pelayanan, tidak dipaksakan ke Welcome. Kartu merah, navigasi aktif kuning, ring gelap/kuning, dan sorotan pekan kuning pada seri biru merupakan pengecualian langsung dari referensi terhadap anggaran warna dan aturan satu hue chart generik. Mark grafik tetap memiliki batas kontras dan angka. Tidak memakai gradient, glow, atau shadow pada kartu diam. Kontrol operasional mempertahankan border yang lebih kuat agar pemeriksaan kontras existing tetap terpenuhi.

## Pertanyaan tiap view
- Welcome: bagaimana mulai masuk untuk pelayanan?
- Masuk: apakah akun dapat diautentikasi?
- Beranda Mentor: sesi mana yang perlu dikerjakan?
- Beranda Admin: draf dan pelayanan mana yang memerlukan tindakan?
- Absensi: siswa mana yang belum dicatat dan apakah perubahan sudah tersimpan?
- Dasbor Anak: bagaimana kehadiran pada cakupan dan periode terpilih?
- Dasbor Volunteer: slot pelayanan mana yang kosong?
- Pelayanan/detail: pelayanan mana yang harus dibuka, dengan konteks apa?
- Kalender: pelayanan apa pada tanggal dan filter terpilih?
- Jadwal: penugasan mana yang tersedia?
- Riwayat: catatan sesi berizin mana yang tersedia?
- Akun/Perangkat: akun atau perangkat mana yang perlu diperiksa?

## Kontrak yang berubah
- Root server pratinjau tetap `index.html`, tetapi kini menampilkan aplikasi Pil. Arsip tinjauan tersedia di `/ui-review.html`.
- Hash `#/welcome`, `#/masuk`, `#/beranda`, `#/mentor`, `#/admin`, `#/absensi`, `#/dasbor`, `#/pelayanan`, `#/kalender`, `#/jadwal`, `#/riwayat`, `#/akun`, `#/perangkat` hanya mengatur pratinjau lokal.
- Detail pelayanan menggunakan `#/pelayanan?service=<id>` agar Back/Forward bekerja. Filter disimpan per konteks; kalender tidak mewarisi filter daftar secara tidak sengaja.
- Login pratinjau memakai helper `msaFetch`, endpoint existing `/api/portal/login`, header portal dan kredensial same-origin. Tidak menyimpan password atau membuat sesi dari fixture. Server pratinjau memang tidak menyediakan endpoint login; kondisi itu mendapat feedback, bukan login demo.
- Tidak mengubah ID/name/data/ARIA, endpoint, cookie, grant, proof perangkat, model data, atau request/response operasional. Controller autentikasi dan absensi tidak diedit.
- Default media Welcome/login berubah ke `msa-auth-documentation.png`; slot dan protokol publikasi tetap sama.

## Kebutuhan integrasi
- Aset statis baru sudah masuk allowlist server pratinjau dan server Admin. Tidak mengubah `sw.js`; validasi cache PWA dan integrasi emulator merupakan pemeriksaan lanjutan, bukan hasil fase ini.
- Tidak mengubah `PROJECT_STATUS.md`, gate produksi, atau konfigurasi emulator.
- View analitik dan angka fixture belum merupakan endpoint analitik live. Tombol write Sample data dinonaktifkan dengan alasan jelas; tidak ada antrean offline baru.

## Verifikasi aktual
- Baseline `npm.cmd test`: 267/267 lulus sebelum perubahan.
- Setelah implementasi, satu run `npm.cmd test` lulus 270/270. Pengulangan terakhir di sandbox menghasilkan 268/270: dialog password native berakhir terlalu awal dan hook Windows ditolak akses folder sementara. Dua berkas terkait diulang di luar sandbox melalui eskalasi alat yang disetujui: `node --test tests/local-msa-setup.test.mjs tests/workspace-lock.test.mjs`, 12/12 lulus tanpa perubahan kode atau assertion.
- `npm.cmd run check`: 249 berkas JS/MJS lolos pemeriksaan sintaks dan local import. Proyek tidak memiliki TypeScript, lint, atau build step terpisah.
- `node --test tests/pil.test.mjs tests/ui-tokens.test.mjs tests/review.test.mjs`: 10/10 lulus setelah perubahan akhir.
- `node --test tests/review-browser.mjs`: 1/1 lulus pada URL arsip.
- `node tests/pil-browser.mjs`: lulus pada 360/390/768/1100/1365/1440px, 13 view per viewport, 234 assertion untuk satu h1, tanpa overflow horizontal, dan box interaktif minimal 48x48px. Tidak ada pageerror atau console.assert gagal.
- Interaksi browser: login gagal tanpa sukses palsu dan password dibersihkan; pencarian/filter AND/reset; detail dan Back/Forward; Escape/focus return; tanggal dan pekan kalender; pilihan status termasuk absent; hitungan berubah; input berulang; scroll tetap setelah edit; tab/group/periode grafik; loading/empty/error/zero; retry fixture; reduced motion.
- FontFace loaded dan `document.fonts.check` lulus untuk Nunito Sans 400/600/700/800 serta Baloo 2 700/800. Baloo 2 berubah dari digit proporsional menjadi lebar sama dengan tabular-nums. Nunito Sans sudah memiliki lebar digit sama pada normal.
- Tiga belas assertion modul data lulus di Node dan termuat tanpa kegagalan assertion di browser. Charts.js identik dengan kit, atribusi CSS dipertahankan, SHA256 PNG generated tetap identik dengan fase Assets.
- Tangkapan desktop dan ponsel diperiksa visual, termasuk crop autentikasi, ukuran label grafik, dan clearance navigasi. Area kerja ponsel bergulir di atas navigasi tetap agar kontrol tidak menutupi konten.
- `git diff --check` serta pemeriksaan sintaks eksplisit modul UI baru dan server lulus. Git memberi peringatan konversi LF/CRLF dan pembacaan ignore global, bukan kegagalan pemeriksaan diff.
- Semua server pengujian memakai port sementara dan ditutup di finally. Tidak menjalankan preview server persisten.

## Verify before publishing:
- `ui/pil-data.js`: clock 6 November 2026, organisasi/program, identitas Admin/Mentor/PIC/Volunteer, tujuh pelayanan beserta tempat/status/tanggal, enam kelompok, 148 siswa, 36 sesi, dan 888 catatan semuanya representatif/fiktif.
- `ui/pil-data.js`: 726/888 kehadiran dibulatkan menjadi 82%; label enam pekan 78/84/80/86/88/75%; Kelompok 3 berisi 18 hadir, 2 izin, 0 tidak hadir, dan 4 belum diisi dari 24 siswa.
- `ui/pil-data.js`: 22 slot, 18 terisi, empat kosong pada tiga kebutuhan; rerata enam pekan 111/132 menjadi 84%. Ini keterisian slot, bukan bukti kehadiran Volunteer.
- `assets/msa-auth-documentation.png`: ilustrasi sintetis, bukan dokumentasi kegiatan atau bukti afiliasi. Metadata asli dan keterangan ilustratif dipertahankan.
- Integrasi login/sesi/perangkat/penyimpanan melalui emulator, publikasi media, cache PWA, perangkat fisik, dan screen reader belum diuji ulang pada fase Build ini. Keberhasilan UI fixture bukan kesiapan produksi.

## Serah terima
Penulis Codex menyelesaikan giliran Build; tidak ada commit/push/deploy. Perubahan lokal sebelumnya pada `.taste/`, server pratinjau, sumber tinjauan, tes dan laporan historis dipertahankan. Agen berikut membaca diff terkini dan laporan ini; tidak mengganti controller atau data operasional dengan fixture. Pemeriksaan Preview dan visual Review TasteCode berikutnya tetap diperlukan.

## Usulan commit
Summary: feat(ui): apply latest Pil mockups to MSA presentation
Description:
- Replace the review entry with native Pil application views and reconciled fixtures.
- Reuse shared tokens, fonts, media slots and protected operational routes.
- Add responsive browser coverage and preserve the prior review as an archive.
