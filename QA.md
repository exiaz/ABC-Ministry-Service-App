# Pemeriksaan prototipe

## Stage 7 — Regresi penuh, keamanan dan dokumentasi · 24 Oktober 2026

Lingkup terkini mencakup Stage 1–6, AUTH A1 dan AUTH A2.1 pada data fiktif/emulator. Perintah yang digunakan tetap `npm.cmd run check`, `npm.cmd test` dan `npm.cmd run test:stage6`; nama script terakhir dipertahankan karena runner tersebut sudah memuat seluruh suite A1/A2.1, browser, offline dan cold recovery. Tidak menambahkan fitur atau runner baru. Hasil eksekusi, temuan dengan severity, bukti kegagalan/perbaikan dan verdict AUTH A2.2 ada pada revisi Stage 7 di [PROJECT_STATUS.md](PROJECT_STATUS.md). Angka Stage 6 dan bagian berikut merupakan riwayat, bukan hasil terkini.

- Runner lengkap membuat Auth/Firestore Emulator dengan lima port loopback, namespace `test-*` untuk fixture akun, dan direktori TEMP/screenshot terpisah. Tidak mengimpor snapshot operasional. Emulator dan server milik tes ditutup setelah pengujian; instance manual tidak diambil alih.
- Autentikasi/otorisasi: login email pemilik/PIC, broker username A1, collision canonical/race dan UID binding, role/scope/status/revocation server, last-Superadmin, pilot `momor1n` fiktif tanpa migrasi operasional dan tanpa privilege dari nama. Raw ID token, flag browser/localStorage dan request lintas scope tidak menjadi otoritas.
- Mentor/absensi: kode single-use 48 jam, proof/nonce/replay, default/override efektif, batas satu jam/akhir tanggal WIB, backup multi-kelompok/revoke, write/finalize/correct, idempotensi/konkurensi, snapshot/history dan filter data privat.
- UI: MSA pada judul/header, logo asli dan nama program Goes to School; Chrome 360/390/768/1365 px, form PIC, navigasi/login lama, field pilot yang terhubung backend, focus/label/dialog dan tanpa overflow sesuai assertion suite. Ini bukan audit aksesibilitas formal atau bukti perangkat fisik.
- Operasi: prasyarat gagal, startup/shutdown, IPC/lifecycle, checksum/snapshot/recovery dan gagal export, konfigurasi proyek demo/loopback serta penolakan cloud credentials. Tes no-cloud menginstrumentasi koneksi repository/SDK; bukan pemantauan jaringan seluruh komputer.

Temuan terkonfirmasi Stage 7: validasi ASCII username sebelumnya dilakukan setelah Unicode lowercase, sehingga Kelvin sign `K` berubah menjadi `k` dan lolos. Tes regresi unit direproduksi gagal, kemudian validator diperbaiki untuk memeriksa karakter input yang sudah di-trim sebelum canonical dipakai. Tes unit dan login emulator memastikan karakter itu ditolak; tidak mengubah UID, registry, password atau default login. Tidak ada bukti bypass password atau takeover dari temuan ini.

Pengujian Windows menggunakan runtime launcher dan proses emulator/server nyata dengan callback readiness terkontrol. Double-click Explorer, jendela prompt manusia/default browser, pemasangan PWA native, Android fisik, Safari/Firefox, pembaca layar lengkap dan credential/provider produksi tidak diverifikasi. Jangan menguji operasi tersebut dengan data anak nyata atau mengubah jam sistem.

Stage 7 tidak mengizinkan AUTH A2.2. Fondasi yang lulus hanya mendukung fase berikutnya yang disetujui secara terpisah. Registrasi publik, verifikasi identitas/duplikat manusia, reviewer berscope, pengaitan akun-perangkat, suspension lintas legacy device, recovery dan cutover tetap gate migrasi; gunakan [kontrak akun](MSA_ACCOUNT_ARCHITECTURE.md) dan hasil kesiapan di PROJECT_STATUS.md.

## Stage 6 — Backup sementara · 24 Oktober 2026

Jalankan `npm.cmd run test:stage6` atau **Test ABC Attendance.cmd**. Emulator Auth/Firestore, port, namespace dan screenshot terpisah dari data operasional. Gunakan hanya siswa fiktif. Hasil aktual dan lokasi log ada di [PROJECT_STATUS.md](PROJECT_STATUS.md).

Hasil akhir **PASS**: sintaks/import 130 modul, unit 164/164, integrasi 91/91, Chrome 22/22, demo/laporan/offline PASS dan cold lifecycle 2/2. Integrasi lulus pada putaran lengkap; setelah perbaikan assertion/helper tes browser, `npm.cmd run test:stage6 -- --from-browser` menuntaskan Chrome serta pemeriksaan berikutnya dengan exit 0. Perintah tanpa opsi tetap menjalankan seluruh rangkaian. Rincian kegagalan awal/perbaikannya dan log pada PROJECT_STATUS.md.

| Cakupan | Pemeriksaan |
|---|---|
| Admin/PIC | Penugasan multi-kelompok, alasan/konfirmasi, idempotensi, daftar, akhiri/cabut; baca/terbitkan/cabut sesuai tindakan dan seluruh tuple |
| Keamanan | Token palsu/Mentor sebagai Admin, PIC baca-saja/sempit, lintas sekolah/sesi/kelompok, perangkat legacy/tidak aktif ditolak |
| Validitas | Perangkat utama tetap aktif saat grant backup kedaluwarsa; batas satu jam/tengah malam WIB, perubahan mentor/tanggal dan izin penerbit ditolak |
| Absensi | Primary dan backup menulis kelompok sama: satu sukses, satu konflik; kelompok berbeda independen; retry receipt tidak menggandakan write |
| Integritas | Enrollment/default mentor/snapshot/ID tetap; finalisasi/koreksi per kelompok, riwayat append-only dan operator backup terlacak |
| Pencabutan | Race revoke/write diserialkan; request dan receipt setelah revoke ditolak; primary tetap aktif; izin tidak hidup kembali melalui retry penugasan |
| Persistensi/UI | Adapter dibuka kembali; grant/revoke tetap; Chrome Admin dan Mentor memilih/switch kelompok, menyimpan dan menolak akses dicabut; lebar 360/390/1365 piksel |
| Regresi | Aktivasi 48 jam/single-use/proof, RBAC Stage 1–4, kalender semua hari/sesi tanggal sama, launcher/snapshot dan demo/offline tetap |

Pemeriksaan operator: aktivasi perangkat, buat backup dua kelompok pada sesi khusus, muat ulang izin Mentor, simpan kelompok pertama dan pastikan kelompok kedua belum diubah. Cabut backup saat Mentor membukanya; akses server berikutnya harus ditolak dan kelompok utama tetap dapat dibuka. Jangan mengubah jam sistem untuk uji expiry; suite otomatis memakai jam fixture. Setelah selesai, Stop dan tunggu snapshot terverifikasi. Android fisik dan browser selain Chrome belum menjadi bukti uji tahap ini.

## Stage 5 — Kalender semua hari · 23 Oktober 2026

Jalankan **Test ABC Attendance.cmd** atau `npm.cmd run test:stage5`. Runner memakai emulator, namespace, port dan TEMP terpisah; tidak mengimpor snapshot operasional. Kalender demo/offline memakai server port sementara dan screenshot pada folder run yang diabaikan Git. Hasil akhir berada di [PROJECT_STATUS.md](PROJECT_STATUS.md).

Putaran final `npm.cmd run test:stage5`: **PASS/exit 0**, 125 modul sintaks/import, 161 unit, 83 integrasi emulator, 21 pemeriksaan Chrome (termasuk parent), kalender demo/offline PASS dan 2 cold lifecycle. QA Admin/XLSX serta form siswa terpisah juga PASS. Setelah penyesuaian visual, suite PIC diulang 1/1 PASS pada 360/390/1365 piksel. Log utama `.emulator-data/stage5-validation-final.log`; screenshot awal `.emulator-data/stage3-tests/run-gkmC3i/`, screenshot panel akhir `run-H8al71/` pada induk folder yang sama.

| Cakupan | Pemeriksaan |
|---|---|
| Kalender | Semua hari, Jumat lama, hari khusus, tahun kabisat/batas WIB, tanggal rusak dan sesi kosong |
| Identitas | Dua sesi sekolah/kelompok/tanggal sama tetap terpisah; ID wajib saat pilihan ambigu; tanggal bukan ID; pemilihan tidak membuat sesi/batch |
| PIC dan Superadmin | PIC menambah jadwal/token dalam kelompok sendiri, PIC baca-saja ditolak, lintas sekolah/kelompok ditolak; email pemilik kosong/tersembunyi pada login; tidak ada eskalasi peran browser |
| Transaksi | Retry membuat satu sesi, konflik revisi satu pemenang, izin hilang membatalkan write dan tambahan grant, provisional tidak memberi akses |
| Aktivasi | Kode 48 jam, single-use/proof/replay/revoke Stage 4 tetap, aktivasi non-Jumat dan akses berakhir paling lambat tengah malam WIB |
| Absensi/riwayat | Finalisasi/koreksi non-Jumat, receipt dan history append-only, dua sesi tidak bercampur, reschedule mempertahankan ID serta snapshot/absensi sebelumnya |
| Browser/laporan | PIC membuat Minggu lalu menerbitkan kode, Mentor memilih dua sesi berizin pada tanggal sama, laporan/XLSX demo per ID, kalender mobile/desktop dan offline |

Pemeriksaan operator: login PIC dengan akun sendiri, buat sesi khusus dalam cakupan kelompoknya, kemudian terbitkan kode melalui Perangkat Mentor. Buat dua sesi tanggal sama untuk memeriksa ID. Tanggal kosong dan kelompok di luar izin tidak boleh membuka absensi. Reschedule harus menolak kode/akses lama tanpa mengubah riwayat; terbitkan kode baru. Selesaikan dengan Stop dan tunggu snapshot tersimpan. Jangan mengubah jam sistem atau memakai data operasional untuk mencoba batas waktu; tes otomatis menyuntikkan jam fixture.

Android fisik, Safari/Firefox dan rekap/ekspor Admin server belum diverifikasi/tersedia. Tidak menguji produksi atau data anak nyata. Bagian berikut adalah bukti historis Stage 4 dan sebelumnya.

## Stage 4 — Aktivasi Mentor dan kode 48 jam · 23 Oktober 2026

Jalankan **Test ABC Attendance.cmd** atau `npm.cmd run test:stage4`. Perintah ini memakai runner Stage 3 yang sama dan menjalankan seluruh regresi Stage 1–4; PASS/exit 0 hanya jika semua tahap lulus. Prasyarat dan isolasi emulator mengikuti Stage 3. Hasil eksekusi terkini dicatat di [PROJECT_STATUS.md](PROJECT_STATUS.md).

Putaran final: **PASS/exit 0**; sintaks/import 120 modul, unit 158/158, integrasi emulator 77/77, Chrome 20/20 (termasuk parent) dan cold lifecycle 2/2. Emulator uji berhenti sukses; log dan screenshot berada di `.emulator-data/stage3-tests/run-E9QfR9/`, ringkasan log `.emulator-data/stage4-validation.log`.

| Cakupan | Pemeriksaan |
|---|---|
| Penerbitan | Individual/bulk atomik, satu kode per kelompok/mentor efektif, tepat 48 jam, retry kunci sama tanpa kode kedua, status receipt terkini, tidak ada plaintext pada dokumen/audit |
| PIC/RBAC | Izin tindakan dan tuple lengkap, penolakan batch bercakupan campuran tanpa penulisan parsial, daftar hanya scope PIC, revoke di luar scope ditolak, izin penerbit berubah menolak penebusan, TTL klien ditolak |
| Waktu server | 48 jam minus 1 ms diterima, tepat 48 jam ditolak; akses maksimum 1 jam; penebusan 1 ms sebelum akhir tanggal WIB diterima dengan sisa 1 ms; tepat tengah malam ditolak meskipun kode belum 48 jam |
| Perangkat | Satu pemenang penebusan serentak, replay kode/proof ditolak, kunci perangkat lain ditolak, scope kelompok lain ditolak, kode berbeda mengizinkan perangkat lain, revoke satu perangkat tidak memutus perangkat lain |
| Data | Penugasan diselesaikan server, perubahan mentor/tanggal menolak izin lama, absensi dan receipt tetap setelah repository dibuka ulang, penolakan akses tidak menulis ulang absensi |
| Browser | PIC memakai tombol utama 48 jam, bulk sekali tampil, sembunyikan/reload tanpa raw code, konfirmasi/batal revoke, pesan kode dicabut, Mentor langsung ke roster dan pulih setelah reload, tanpa kebocoran kode ke log/storage |

Pemeriksaan operator: pilih Jumat pelayanan yang belum berakhir, bagikan setiap kode sesuai baris mentor, aktifkan dua browser/profil menggunakan **dua kode berbeda**, lalu cabut salah satu perangkat. Izin perangkat lain dan absensi harus tetap. Untuk pesan invalid/kedaluwarsa/sudah dipakai/dicabut, gunakan kode fiktif terpisah; jangan mengubah jam sistem atau data operasional untuk mencoba batas waktu. Tes otomatis menyuntikkan jam server fixture. Periksa status lewat **Muat ulang perangkat** karena daftar bukan pembaruan realtime.

Tangkapan layar uji disimpan setelah kode disembunyikan di folder run yang diabaikan Git. Android fisik, Safari/Firefox, deployment dan penggunaan data anak nyata belum diuji. API/perangkat pairing lama tetap kompatibel dengan masa berlaku sebelumnya; alur baru Superadmin/PIC dijelaskan pada Stage 4 README. Snapshot lama dapat memulihkan izin yang sudah dicabut; tinjau kembali setelah recovery seperti pada Stage 3.

Bagian Stage 3 dan berikutnya adalah bukti historis; angka terkini berada pada status Stage 4.

## Stage 3 — Windows, login dan penyimpanan lokal · 23 Oktober 2026

Jalankan `npm.cmd run test:stage3` atau **Test ABC Attendance.cmd**. Prasyarat: Node.js 22+, Java JDK 21+, dependensi/cache emulator serta Chrome/Playwright yang telah disiapkan operator. Runner menggunakan emulator baru, lima port loopback sementara dan data fiktif; tidak mengimpor snapshot operasional. Exit **0/PASS** berarti seluruh tahap lulus; **1/FAIL** berarti ada prasyarat/pemeriksaan yang gagal. Runner lengkap telah lulus (69 tes emulator, 19 tes browser dan 2 cold lifecycle); regresi unit akhir 154/154 dan sintaks/import 117 modul lulus. Hasil rinci serta batas terbaru dicatat di [PROJECT_STATUS.md](PROJECT_STATUS.md).

| Cakupan | Pemeriksaan |
|---|---|
| Startup | Dependensi hilang/versi kurang, duplikasi launcher, layanan cocok, port tak dikenal, pembatalan startup, browser hanya setelah ready |
| Login dan RBAC | Password pilihan sendiri melalui input tersembunyi, password salah, Superadmin/PIC, cakupan/tindakan, pencabutan, sesi login terpisah; Mentor tetap pairing |
| Stop dan persistence | Snapshot Auth/Firestore unik, struktur dan checksum, pointer tetap saat export gagal, emulator tetap hidup untuk retry, graceful IPC, layanan manual tetap hidup |
| Restart dan recovery | Cold export/import, password lama tetap, absensi/riwayat/perangkat dipertahankan, pemulihan password berkonfirmasi, startup terputus memerlukan PULIHKAN |
| Stage 2 | Issuance berkunci, retry ambigu, dua login satu UID, konkurensi penulis/finalizer, 409 revisi usang, receipt persisten dan riwayat append-only |
| Browser | Empat suite Chrome: akun Superadmin/PIC, login, perangkat, dan absensi Mentor; screenshot disimpan di folder run terisolasi |

Tes yang mengubah port/controller memakai instance fiktif milik tes. Jangan memakai akun atau data anak nyata. Untuk pemeriksaan manual Windows, klik Start dari Explorer, selesaikan prompt pertama, login pemilik/PIC, buka Mentor dengan kode sah, lalu klik Stop dan tunggu konfirmasi. Coba Start ulang dan pastikan password/data tetap. Pembukaan browser melalui aplikasi default Windows dan klik Explorer harus dicatat terpisah dari callback readiness otomatis.

Bila export gagal, jangan tutup paksa emulator: pulihkan masalah penyimpanan lalu ulangi Stop. Bila checksum salah atau tidak ada snapshot lengkap, jangan menghapus data untuk meloloskan startup. Recovery dari snapshot lama dapat mengembalikan izin lama; tinjau/cabut izin. Snapshot bukan transaksi atomik lintas Auth/Firestore ketika server manual masih menulis. Hentikan pekerjaan dan tutup server manual sebelum export untuk salinan yang tenang.

Bagian berikut merupakan riwayat QA sebelum Stage 3.

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
