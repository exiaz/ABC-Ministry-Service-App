# ABC Attendance — status revisi

**21 Oktober 2026 · filter admin, gender, ulang tahun dan XLSX · prototipe lokal · tidak dipublikasikan**

## Revisi terbaru

- Kelompok & mentor: filter Sekolah/Kelompok Mentor, reset kelompok saat sekolah berubah, jumlah terfilter/total; edit/tambah/penugasan tetap tersedia. Konfigurasi tetap 16 kelompok aktif (8/4/4).
- Direktori pilihan mentor dibatasi pada delapan identitas otoritatif. Alias ejaan dinormalisasi; orang/penugasan demo seperti Kak Raka disimpan untuk riwayat tetapi dinonaktifkan dari pilihan/rencana aktif. Raka berasal dari direktori/QA prototipe lama; tidak dianggap penugasan baru yang disahkan. `disabledFrom`, snapshot dan audit mempertahankan riwayat. Fasilitas pengganti satu sesi/permanen bertanggal tetap bekerja dengan mentor sah.
- Kedua form siswa wajib memilih salah satu dari dua radio **Laki-laki / Perempuan**, tanpa default. Data lama yang kosong tetap null dan ditandai untuk dilengkapi. Persetujuan siswa sementara mempertahankan gender dan ID, tanpa menulis ulang kehadiran.
- Halaman admin **Ulang Tahun Siswa**: 12 bulan, sekolah/kelompok terkait, siswa aktif, urutan hari lahir, usia, edit profil, daftar 30 hari ke depan dan counter tanggal lahir belum lengkap. Tanggal 29 Februari memakai peringatan 28 Februari saat nonkabisat; DOB asli tetap.
- Ekspor: pilihan siswa publik/privat admin atau absensi; semua/terfilter dengan jumlah/cakupan jelas. Sumber dibaca ulang dari data tersimpan. Siswa memuat gender/status/kelas/mentor; absensi menambahkan kelas snapshot dan ID batch, membedakan draf/final/belum dimulai serta tanggal yang terpisah. Profil privat hanya ikut saat dipilih eksplisit. Nilai kosong tetap kosong.
- Klarifikasi pengguna: yang sebelumnya sudah ada adalah ekspor; impor sebelumnya belum ada. Kini tersedia **Data siswa → Impor XLSX** dengan validasi, pratinjau, konfirmasi, pembaruan berdasar ID, deteksi duplikat, backup dan penyimpanan atomik. Tidak membuat ulang kelompok/mentor atau mengubah absensi. Format/header dan batas ukuran dijelaskan pada brief.
- Migrasi mentor revisi 3 dan siswa revisi 2 menyimpan backup lokal sebelum perubahan. Kalender, konteks absensi, desain, dashboard dan catatan lama dipertahankan. Tidak ada dependensi/backend/deployment baru.

## Validasi terarah revisi ini

- **43/43 lulus; 0 gagal**: `tests/admin-data.test.mjs`, `tests/student-forms.test.mjs`, `tests/assignments.test.mjs`, `tests/scheduling.test.mjs`. Mencakup filter, 16 mapping, mentor contoh/riwayat, aktivasi ulang pengganti dengan mentor sah, gender, persetujuan, DOB null/29 Februari/pergantian tahun/30 hari, cakupan ekspor, serial Excel, impor/update/duplikasi/validasi atomik dan pelestarian absensi.
- QA Chrome terisolasi dengan data fiktif: filter 8/4/4 dan reset; delapan pilihan mentor tanpa Raka; validasi gender kosong dan persetujuan; filter/empty state ulang tahun; viewport 390/1365; field privat dan tab ulang tahun tidak ada pada mentor; tidak ada error JavaScript.
- XLSX hasil unduhan dibandingkan **sel per sel** dengan data sumber pada saat ekspor: siswa publik/privat/terfilter serta absensi semua/terfilter. Ekspor siswa publik dan privat masing-masing 102 siswa pada fixture sebelum impor; tidak menambah nama atau nilai kosong.
- Importer berhasil membaca file ZIP DEFLATE dengan shared strings dan namespace XML berprefiks, mempertahankan Unicode dan mengubah serial tanggal Excel ke date-only. Dua siswa baru diimpor dengan ID sumber, lalu impor ulang menghasilkan 0 baru/0 perbarui/2 tetap. File kelompok lintas sekolah ditolak. Ekspor data lama berisi null gender/kelas dapat diimpor ulang tanpa mengubah ID, membuat duplikat atau mengarang nilainya.
- Pembacaan silang independen memakai openpyxl (read-only terhadap berkas, tanpa mengubah/menulis workbook): isi ekspor siswa publik/privat cocok; ekspor siswa terfilter, dua berkas absensi dan sumber impor juga dapat dibaca. Tidak diuji melalui aplikasi Microsoft Excel fisik.
- `node tests/check.mjs`: seluruh 30 modul JS/MJS lulus sintaks dan import lokal. Proyek buildless JavaScript, tanpa compiler TypeScript. Tidak melakukan QA luas atau suite yang tidak terkait.

Bukti: [filter kelompok](screenshots/admin-group-filters.png), [ulang tahun desktop](screenshots/admin-birthdays-desktop.png), [ulang tahun ponsel](screenshots/admin-birthdays-mobile.png). Skenario browser: `tests/admin-browser.mjs`; artefak XLSX fiktif untuk verifikasi berada pada `qa-artifacts/admin-revision/`.

## Berkas revisi ini

| Berkas | Perubahan |
|---|---|
| `app.js`, `styles.css` | Filter, gender, halaman ulang tahun, ekspor dengan cakupan, alur impor/pratinjau |
| `mentor-config.js`, `assignments.js`, `assignment-ui.js` | Direktori sah, pensiunan demo/audit, filter tabel dan penjagaan reassignment |
| `student-data.js`, `data.js` | Gender nullable lama/wajib baru, preservasi ID dan snapshot, dukungan ID sumber impor |
| `birthdays.js`, `birthday-ui.js` (baru) | Perhitungan date-only, 29 Februari, filter/usia/30 hari dan UI admin |
| `reports.js`, `xlsx.js` | Data aktual, kolom/cakupan/count, privat eksplisit; pembuat XLSX lama dipertahankan |
| `student-import.js`, `xlsx-reader.js` (baru) | Validasi dan rencana impor, ID/upsert, pembaca ZIP/XML terbatas tanpa dependensi |
| `scheduling.js` | Pemeriksaan date-only menerima hanya string |
| `server.mjs`, `sw.js` | Modul baru dan cache v8 untuk preview/offline |
| `tests/admin-data.test.mjs`, `tests/admin-browser.mjs` (baru) | Pengujian fitur terbaru dan kompatibilitas XLSX |
| `tests/student-forms.test.mjs`, `tests/student-forms-browser.mjs`, `tests/browser.mjs` | Memilih gender secara eksplisit pada fixture form |
| `MASTER_BRIEF.md`, `PROJECT_STATUS.md` | Aturan, format impor, status implementasi, validasi dan batasan |

## Batasan

- Otorisasi tetap simulasi frontend/localStorage; **belum aman untuk data anak asli**. Akses backend berbasis peran, sinkronisasi dan backup terpusat masih tertunda. Profil privat hanya dipisahkan dari tampilan/payload mentor, bukan dilindungi di server.
- Impor membaca worksheet pertama dari XLSX tidak terenkripsi, maksimal 20 MB/5000 siswa/50 kolom; memerlukan header yang didukung dan browser modern dengan dekompresi native. Formula tidak dievaluasi; salin menjadi nilai di Excel. CSV belum diimplementasikan.
- Berkas siswa asli pengguna belum diberikan; pengujian memakai fixture fiktif dan format standar XLSX. Android fisik dan Microsoft Excel fisik belum diuji.
- Backup hanya di browser yang sama, dapat hilang saat penyimpanan dibersihkan. Tidak ada deployment atau layanan berbayar.

## Riwayat revisi sebelumnya — formulir konteks

Hasil di bawah disimpan sebagai bukti tahap sebelumnya, bukan spesifikasi/hasil pengujian ulang revisi terbaru.

## Formulir siswa sesuai konteks (tahap sebelumnya)

- Acuan konfigurasi tetap `MASTER_BRIEF.md` sesuai klarifikasi pengguna; tidak membuat `database.md` baru. Tidak ada perubahan pada 3 sekolah, 16 kelompok, mentor, kalender, dashboard atau navigasi.
- Mentor: modal siswa sementara menampilkan sekolah/kelompok/mentor/tanggal aktif secara otomatis. Hanya Nama Lengkap dan Kelas Sekolah yang wajib diisi; tidak ada pilihan konteks berulang. Penyimpanan memvalidasi ulang konteks dan tidak menerima sekolah/kelompok dari input mentor.
- Admin: nama lengkap/kelas wajib, dropdown Sekolah dan Kelompok Mentor terpisah dan saling terkait. Form mengikuti filter eksplisit atau profil yang diedit, dapat diubah admin; form global tidak mewarisi pilihan mentor. Mengubah sekolah mengosongkan kelompok yang lama.
- Admin dapat mengisi/mengedit tanggal lahir, nama wali dan alamat; kosong tetap null. Field privat ditempatkan pada `studentPrivateProfiles` dan tidak dimasukkan pada payload/record absensi mentor. Data kelas lama yang tidak diketahui tetap null sampai dilengkapi.
- Persetujuan siswa sementara membuka tinjauan pendaftaran dengan konteks awal. Pemeriksaan duplikat mencakup siswa aktif/nonaktif sekolah tujuan, lintas kelompok. ID siswa dan absensi sesi asal dipertahankan; pendaftaran permanen berlaku pada batch baru.
- Migrasi skema siswa bersifat aditif/idempoten dan memiliki backup lokal sebelum perubahan. Riwayat absensi, snapshot, ID, status dan penugasan mentor dipertahankan.
- Roadmap v1.0 pada brief mencakup Birthday Tracker admin (filter bulanan/sekolah/kelompok, ulang tahun mendatang, tanggal lahir kosong), kelengkapan profil, impor CSV/XLSX dan backend aman berbasis peran. Fitur-fitur roadmap tersebut **belum diimplementasikan**.

Berkas revisi ini: `student-data.js` (baru), `app.js`, `data.js`, `styles.css`, `server.mjs`, `sw.js` (cache v7), `tests/student-forms.test.mjs` dan `tests/student-forms-browser.mjs` (baru), penyesuaian satu field wajib pada `tests/browser.mjs`, `MASTER_BRIEF.md`, `PROJECT_STATUS.md`.

Validasi terarah revisi ini:

- `node --test tests/student-forms.test.mjs tests/prototype.test.mjs`: **14/14 lulus** (10 tes model/konteks/formulir + 4 tes regresi dasar).
- Sintaks modul yang diubah diperiksa; tidak menjalankan ulang suite lengkap atau QA kalender/dashboard yang tidak terkait.
- QA browser terarah pada viewport ponsel 390 px lulus: mentor memiliki tepat dua input dan tanpa dropdown, ringkasan Hagai/Kak Louis benar, perpindahan ke Airlangga memakai Amos/Kak Chriz tanpa konteks lama, form global memiliki dropdown sekolah/kelompok terkait, pergantian sekolah mengosongkan kelompok, prefill admin dari filter sekolah/kelompok benar, profil opsional tersimpan/dapat dikosongkan menjadi null, field privat tidak tampil pada roster mentor, persetujuan/reload mempertahankan seluruh absensi lama. Tidak ada error JavaScript.
- Bukti tampilan: [form mentor](screenshots/student-temporary-form.png), [form admin](screenshots/student-admin-form.png). Skrip pemeriksaan terarah: `tests/student-forms-browser.mjs`.
- Preview lokal memakai server yang sudah ada; server dimulai ulang untuk menyajikan modul `student-data.js` dan cache v7.

Batasan: seluruh penyimpanan dan akses tetap simulasi frontend/localStorage pada browser yang sama. Pemisahan field privat baru membatasi tampilan dan data absensi, belum mengamankan akses melalui server. Gunakan data fiktif saja; tidak ada dependency, backend, fitur berbayar atau deployment baru.

## Riwayat revisi sebelumnya — kalender dan kelompok

Hasil 37/37 berikut adalah bukti revisi sebelumnya; bukan klaim menjalankan ulang seluruh suite pada revisi formulir.

## Perubahan selesai

- Daftar kartu Jumat tetap pada mentor diganti field **Pilih Tanggal Pelayanan**, dengan popover kalender berbahasa Indonesia. Navigasi bulan/tahun, Jumat aktif dan hari lain nonaktif; tanggal awal memakai hari ini jika Jumat atau Jumat terakhir menurut Asia/Jakarta.
- Jumat lampau dan mendatang dapat dipilih. Sesi sekolah/tanggal yang sudah ada dimuat kembali, tanpa duplikasi. Jumat belum dijadwalkan memerlukan konfirmasi; Batal tidak membuat sesi. Sesi baru berlabel **Menunggu Verifikasi Admin**.
- Tanggal mendatang dapat dibuka sebagai draf; pengiriman diblokir pada tombol dan fungsi pengiriman sampai tanggal pelayanan WIB. Absensi lampau dapat ditinjau/dikoreksi. Roster dan status tetap terpisah per sekolah, Service Session ID/tanggal, kelompok, dan siswa.
- Kartu kelompok memiliki nama kelompok sebagai teks utama dan nama mentor berawalan **Kak** sebagai subtitle. Pemetaan awal tepat **16 kelompok aktif, 3 sekolah, 8 identitas mentor**; seluruh Amos menggunakan identitas Chriz yang sama. Hagai menampilkan Kak Louis.
- ID kelompok lama yang masih diperlukan dipertahankan; g4 dikoreksi menjadi Amos, g15 menjadi Zefanya. g18 Amos Kertajaya ditambahkan dengan roster kosong. g16/g17 lama diarsipkan sambil mempertahankan siswa, kelompok, dan riwayatnya. Kelompok buatan admin tidak dihapus.
- Migrasi default mempertahankan snapshot penugasan lampau, rencana khusus admin, override, roster, catatan dan timestamp absensi. Backup revisi 2 disimpan di browser jika penyimpanan tersedia. Alias ejaan mengarah ke identitas mentor kanonik.
- Admin tetap memiliki jadwal, reschedule, pengelolaan siswa, penggantian sementara satu sesi, penugasan permanen bertanggal efektif, laporan, filter, dan XLSX. Pelayanan sementara dapat diverifikasi dari **Ubah jadwal → Verifikasi & simpan jadwal**, tanpa membuat ulang absensi.
- Semua kelompok aktif sekolah tersedia pada mentor; memulai kelompok tambahan memasukkannya ke pelayanan yang sama. Memilih tanggal saja tidak mengubah daftar kelompok rencana admin.
- Perangkat demo berizin mengingat sekolah dan kelompok terakhir. Reload memulihkan langkah tanggal dan menandai kelompok sebelumnya, tanpa menjadikan preferensi sebagai autentikasi.
- Arsitektur ES modules tanpa dependensi frontend, warna, logo, navigasi dan komponen lain dipertahankan. Tidak ada backend, fitur berbayar atau deployment baru.

## Berkas dimodifikasi

| Berkas | Perubahan |
|---|---|
| `dates.js` (baru) | Tanggal WIB aktual, Jumat terakhir, perpindahan bulan |
| `service-ui.js`, `app.js`, `styles.css` | Kalender dropdown, alur konfirmasi, subtitle, preferensi, pemblokiran pengiriman, verifikasi admin |
| `group-config.js`, `mentor-config.js` | Pemetaan 16 kelompok/8 mentor, identitas terpisah, arsip kelompok lama |
| `data.js`, `assignments.js`, `assignment-ui.js`, `scheduling.js` | Migrasi/pelestarian data, sesi Jumat, resolver mentor dan aturan tanggal aktual |
| `server.mjs`, `sw.js` | Penyajian/cache modul tanggal; cache v6; port lokal dapat diatur melalui PORT |
| `package.json`, `tests/check.mjs` (baru) | Perintah pemeriksaan sintaks/import dan QA browser |
| `tests/calendar.test.mjs` (baru) | 9 tes kalender, tanggal, konfigurasi, migrasi dan pelestarian |
| `tests/browser.mjs` (baru) | QA browser terisolasi untuk mentor/admin dan tampilan responsif |
| `tests/assignments.test.mjs`, `tests/group-config.test.mjs`, `tests/prototype.test.mjs`, `tests/scheduling.test.mjs` | Ekspektasi direktori terbaru dan waktu uji tetap agar dapat diulang |
| `MASTER_BRIEF.md`, `PROJECT_STATUS.md`, `README.md`, `QA.md` | Aturan terbaru, penggunaan, bukti dan batasan |
| `screenshots/calendar-*.png`, `screenshots/groups-*-mobile.png`, `screenshots/future-attendance-mobile.png` | Bukti QA revisi ini |

## Pengujian

- **37/37 tes otomatis lulus**: 28 tes yang sudah ada diperbarui untuk konfigurasi terbaru, ditambah 9 tes aturan baru.
- **21 berkas JS/MJS lulus pemeriksaan sintaks dan import lokal** melalui `node tests/check.mjs`. Proyek ini buildless JavaScript: tidak memiliki tahap build atau TypeScript/type-check terpisah; tidak diklaim memiliki pemeriksaan tipe statis.
- QA Chrome desktop dengan viewport **360, 390 dan 1365 px** lulus tanpa pelebaran halaman atau error JavaScript. Skenario menggunakan waktu uji 21 Oktober 2026 WIB; fungsi tanggal aktual diuji terpisah di batas tengah malam UTC/WIB.
- Kalender benar-benar terbuka sebagai grid; tombol bulan dan pilihan bulan/tahun berfungsi, Januari 2027 dapat dipilih, Kamis 22 Oktober nonaktif dan Jumat tak terjadwal 2 Oktober aktif. Escape menutup kalender.
- Konfirmasi dibatalkan tanpa membuat sesi, lalu dikonfirmasi menjadi satu pelayanan sementara. Pakel menampilkan 8 kartu termasuk **Hagai / Kak Louis**; Airlangga dan Kertajaya masing-masing 4 kartu dengan subtitle mentor terpisah.
- Absensi 2 Oktober: Hadir/Izin, siswa sementara, konfirmasi 11 belum diabsen, penyelesaian, koreksi dan reload berhasil. Hasil akhir **2 Hadir / 1 Izin / 10 Tidak Hadir** tetap pada sesi asal. Tanggal 9 Oktober tetap beroster 12; tanggal 23 Oktober beroster 12 dan tombol kirim nonaktif.
- Cache modul tanggal diverifikasi; reload saat offline memulihkan langkah tanggal dan kalender tetap dapat dibuka.
- Penggantian admin Kak Eva untuk 23 Oktober dan penugasan tetap Kak Chriz mulai 1 November berhasil tanpa mengubah absensi 2 Oktober. Verifikasi sesi sementara mempertahankan ID dan hasil tersebut.
- Migrasi revisi 1 diuji dengan kelompok lama, mentor lama dan snapshot historis: 16 aktif/18 termasuk dua arsip, roster dan semua absensi tetap, idempotensi lulus. Ejaan alias diuji agar menggunakan satu identitas.

Bukti: [kalender ponsel](screenshots/calendar-mobile.png), [kalender desktop](screenshots/calendar-desktop.png), [kelompok Pakel](screenshots/groups-calendar-mobile.png), [Airlangga](screenshots/groups-s2-mobile.png), [Kertajaya](screenshots/groups-s3-mobile.png), [tanggal mendatang](screenshots/future-attendance-mobile.png).

## Batasan tersisa

- Tetap prototipe localStorage: otorisasi, verifikasi admin dan penugasan disimulasikan, tanpa sinkronisasi, notifikasi admin, backend atau keamanan produksi. Jangan gunakan data anak sungguhan.
- Jam berjalan mengikuti jam perangkat dalam WIB; belum menggunakan jam server tepercaya. Multi-tab/perangkat bersamaan belum didukung.
- Nama sekolah/kelompok/mentor berasal dari pemetaan pengguna; siswa, jadwal awal dan hasil absensi tetap contoh fiktif. Tujuh kelompok baru/tanpa roster tetap kosong; admin dapat mengisi siswa, dan roster kosong tidak dapat dikirim.
- Kelompok lama yang diarsipkan tetap tersedia bagi admin untuk roster/riwayat; tidak dimunculkan pada pilihan kelompok mentor aktif. Rencana admin yang sudah dibuat dipertahankan dan dapat berbeda dari default awal.
- Reload offline dan kalender setelah reload offline berhasil diuji melalui cache shell baru. Chrome responsif telah diuji. Instalasi dan interaksi pada Android fisik belum diverifikasi. Tidak ada deployment.
