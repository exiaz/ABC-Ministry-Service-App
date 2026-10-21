# Pemeriksaan prototipe

**Status terbaru:** revisi kalender dan 16 kelompok, 21 Oktober 2026. **37/37 tes otomatis lulus**, sintaks/import 21 JS/MJS lulus. Buildless JavaScript, tidak ada compiler TypeScript. QA Chrome dengan profil terisolasi lulus untuk kalender bulan/tahun, Jumat saja, konfirmasi/batal sesi sementara, 8/4/4 kartu kelompok, Hagai/Kak Louis, roster terpisah, kirim/koreksi/reload, blokir masa depan, override/permanen admin, verifikasi sesi tanpa perubahan riwayat, serta reload/kalender saat offline. Viewport 360/390/1365 tidak melebar; tidak ada error JavaScript. Android fisik belum diuji.

Bukti dan daftar perubahan lengkap: [PROJECT_STATUS.md](PROJECT_STATUS.md). Skrip: `node --test tests/*.test.mjs`, `node tests/check.mjs`, `node tests/browser.mjs` (Playwright + Chrome tersedia di lingkungan uji).

Bagian di bawah adalah riwayat QA tahap sebelumnya, termasuk nama dan batasan konfigurasi lama; tidak menjadi spesifikasi revisi ini.

Dilakukan 21 Oktober 2026 pada browser pratinjau desktop. Data pengujian dikembalikan ke contoh awal setelah selesai.

| Alur | Hasil |
|---|---|
| Pilih Pacarkeling V, simulasi izin perangkat, pilih Kelas 1–2 | Lulus; 12 siswa fiktif, status awal belum diabsen |
| Tandai Alya dan Bima hadir, ubah Bima menjadi Izin | Lulus; progres 2/12 dan ringkasan 1 Hadir, 1 Izin |
| Cari Alya | Lulus; hanya nama yang cocok ditampilkan, ringkasan tetap seluruh roster |
| Tambah Adira Permata sementara | Lulus; roster menjadi 13 siswa; menunggu tinjauan admin |
| Selesaikan roster tidak lengkap | Lulus; dialog menyebut 11 siswa belum diabsen; Batal mempertahankan draf; konfirmasi menghasilkan 1 Hadir, 1 Izin, 11 Tidak Hadir |
| Koreksi Citra menjadi Hadir dan selesaikan ulang | Lulus; 2 Hadir, 1 Izin, 10 Tidak Hadir; cocok dengan tabel admin |
| Muat ulang draf koreksi dan hasil selesai | Lulus; status dan angka bertahan setelah dimuat ulang |
| Kode admin salah lalu ABC2026 | Lulus; kode salah menampilkan pesan, kode demo membuka dasbor |
| Filter sekolah, kelompok, pertemuan; detail riwayat 14 Oktober | Lulus; tampilan dan jumlah sesuai sesi yang dipilih |
| Setujui siswa sementara, ubah nama dan kelompok | Lulus; masuk daftar tetap; nama/kelompok di sesi asal tetap utuh |
| Tambah/nonaktifkan siswa, tambah kelompok, ganti mentor | Lulus; data aktif berubah; salinan riwayat tetap utuh |
| Unduh XLSX simulasi | Lulus; unduhan nyata bertanda SIMULASI; lima bagian ZIP dan XML dibaca, baris sesuai filter serta status |
| Ponsel kecil dan desktop | Ditinjau pada pengaturan viewport 360×800, 390×844, dan 1365×900. Lebar konten mengikuti viewport; tabel admin memiliki gulir sendiri |
| Cache shell saat server dihentikan | Lulus setelah kunjungan awal; pemuatan ulang dan navigasi roster tetap bekerja dari cache, data lokal tersedia |
| Kesalahan browser | Tidak ada kesalahan JavaScript/peringatan aplikasi pada pemeriksaan akhir |

Pemeriksaan otomatis: `node --test tests/prototype.test.mjs` — **4/4 lulus**: identitas sesi dan isolasi roster; pelestarian snapshot saat data berubah; hitungan status; struktur ZIP/XLSX, CRC, dan escaping teks literal. Pemeriksaan sintaks JavaScript juga lulus.

Bukti visual: [mentor ponsel](screenshots/mentor-mobile.jpg), [hasil admin desktop](screenshots/admin-desktop.jpg), [halaman awal](screenshots/mentor-home-desktop.jpg).

Belum diverifikasi: Android fisik, dialog pemasangan PWA, perubahan jaringan perangkat nyata, pembukaan berkas di Excel/Google Sheets, semua kombinasi pembaca layar, serta kondisi kuota penyimpanan penuh. Tidak ada pengujian keamanan produksi karena akses masih simulasi.

## Revisi kelompok dan logo — 21 Oktober 2026

- **8/8 tes otomatis lulus** melalui `node --test`: empat tes dasar serta konfigurasi 17 kelompok, migrasi idempoten/pelestarian relasi, resolusi nama untuk snapshot lama, dan penolakan benturan tanpa merge/pemindahan.
- Pemeriksaan sintaks seluruh modul `.js`/`.mjs` lulus. Proyek tidak memiliki tahap build atau pemeriksaan tipe TypeScript terpisah.
- Browser: ketiga daftar sekolah menampilkan nama persis sesuai urutan baru (8/6/3); halaman mentor menampilkan Hosea di Pakel, Hagai di Airlangga, Zakharia di Kertajaya dengan roster lama.
- Filter admin dan tabel ringkasan diperiksa untuk setiap sekolah; 17 kelompok muncul di pengelolaan kelompok, form edit Obaja menggunakan nama terkini, detail sesi selesai tetap menampilkan 8 Hadir/1 Izin/1 Tidak Hadir.
- Nama snapshot historis tidak diubah di penyimpanan; label layar dan ekspor diselesaikan melalui ID direktori terkini. Tidak ada reset data atau penghapusan siswa/riwayat selama revisi. Membuka kelompok dalam pengujian mengikuti perilaku lama yang membuat draf bila sesi belum ada.
- Logo asli terlihat utuh pada desktop dan ponsel 390×844; halaman ponsel tidak melebar (lebar konten sama dengan viewport). Aset logo dan konfigurasi tercakup dalam cache PWA.
- Tidak ditemukan benturan pemetaan pada penyimpanan browser yang diuji. Delapan kelompok tambahan sengaja kosong dan tanpa penugasan mentor.

Berkas revisi: `group-config.js`, `data.js`, `app.js`, `styles.css`, `server.mjs`, `sw.js`, `icon.svg`, `assets/abc-movement-logo.png`, `tests/group-config.test.mjs`, `tests/prototype.test.mjs`, `MASTER_BRIEF.md`, `README.md`, `QA.md`. Bukti visual baru: [kelompok Pakel dan logo](screenshots/groups-updated-desktop.jpg).
