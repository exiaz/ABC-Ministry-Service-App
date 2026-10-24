# ABC | Ministry Service App — Prototipe lokal

## AUTH A2.1 — branding dan pilot username

Identitas aplikasi kini Ministry Service App; Goes to School tetap nama program. Logo ABC dan data/ID program tetap. Login email Admin/PIC serta kode aktivasi Mentor di bawah tetap berlaku. Pembaruan cache aset mengganti branding offline tanpa mengganti identitas instalasi PWA atau storage key data.

Jalankan `npm.cmd run test:msa-a2-1` untuk pilot terisolasi: runner memakai port/namespace `test-*` dan akun fiktif sementara, memeriksa pengikatan UID lama, login username berscope, A1 dan tampilan desktop/mobile. `npm.cmd run test:stage6` menjalankan regresi lengkap, termasuk absensi dan backup. Tidak memakai snapshot operasional.

Pilot memerlukan **kedua** flag server `ABC_MSA_A1=1` dan `ABC_MSA_USERNAME_PILOT=1` serta namespace `test-*`. `/username.html` hanya tersedia di lingkungan tersebut dan tetap menyediakan **Masuk dengan email**; `/` tetap login email. Tidak ada form/endpoint untuk mengklaim username. Helper pengikatan hanya trusted dan memerlukan UID sesi sendiri, konfirmasi serta password ulang. `momor1n` hanya diuji pada Superadmin fiktif; akun dan registry operasional tidak diperiksa atau diubah. Jangan memakai fixture untuk mengikat akun nyata. Prosedur aman yang masih direncanakan ada di [kontrak A2.1](MSA_ACCOUNT_ARCHITECTURE.md#auth-a21--branding-dan-pilot-username-uid-lama); pengikatan nyata memerlukan lingkup tersendiri. Username belum menjadi login default.

## AUTH A1 — uji akun username terisolasi

Login Admin/PIC dan aktivasi Mentor di bawah tetap berlaku. A1 mati secara default; tidak ada registrasi umum, migrasi akun atau perubahan password/perangkat lama. Pengujian terpisah tersedia melalui `npm.cmd run test:msa-a1`: runner membuat Auth/Firestore Emulator, namespace dan akun fiktif sementara, memeriksa broker/role serta membuka Chrome headless untuk verifikasi, kemudian menutup emulator tes. Hasil lengkap regresi tetap melalui `npm.cmd run test:stage6`.

Untuk pengembangan terisolasi, flag server `ABC_MSA_A1=1` membuka `/a1.html` pada server Admin emulator yang telah dikonfigurasi. Superadmin lama juga mendapat tautan **Pengelolaan pengguna MSA · Uji A1** dari Akun PIC; halaman meminta autentikasi sendiri, tidak menyalin token melalui URL/storage. Pilihan login username hanya menerima akun uji A1 yang telah direview melalui fixture trusted. Tidak ada form untuk mendaftarkan, memverifikasi atau menautkan orang nyata. Gunakan namespace/data fiktif khusus, bukan snapshot operasional. Menonaktifkan flag dan restart menutup halaman/endpoint A1 serta mengakhiri sesi A1. Kontrak, keterbatasan provisioning, role/scope, suspension dan migrasi ada di [MSA_ACCOUNT_ARCHITECTURE.md](MSA_ACCOUNT_ARCHITECTURE.md#auth-a1--kontrak-implementasi-lokal); hasil aktual di [PROJECT_STATUS.md](PROJECT_STATUS.md).

## Mulai dan login tanpa perintah terminal — Windows

1. Klik dua kali **`Start ABC Attendance.cmd`** di folder proyek. Biarkan jendelanya terbuka. Peluncur memeriksa Node.js 22+, Java JDK 21+, dependensi dan cache emulator. Tunggu empat langkah persiapan sampai **Demo siap**; halaman **Admin 4177** dan **Mentor 4176** baru dibuka setelah emulator dan server diperiksa. Klik Start lagi membuka halaman instance yang sama.
2. **Pertama kali:** jika akun belum ada, ketik password pilihan sendiri **12–128 karakter**, Enter, lalu ketik ulang. Tulisan/tanda bintang memang tidak muncul. Akun dan fixture disimpan sebelum halaman dibuka. **Berikutnya:** akun, data dan password yang sama digunakan kembali; tidak perlu setup ulang.
3. **Login Admin:** masukkan email dan password akun Anda, lalu **Masuk**. Email tidak lagi diisi otomatis; akun Superadmin pemilik terpisah dari akun PIC dan tidak ditawarkan pada form login. Pemilik memakai identitas dari setup lokal sebelumnya; tidak ada penggantian akun/password otomatis. Tombol **Tampilkan kata sandi** membantu memeriksa ketikan. Jika ditolak, periksa isian/izin; jika server belum siap, buka Start dan tunggu Demo siap. Reload memerlukan login lagi.
4. **Lupa password:** klik dua kali **`Reset Admin Password.cmd`**. Baca konfirmasi, ketik **GANTI** dan Enter; Enter tanpa GANTI membatalkan. Sesi server milik peluncur ditutup dan data disimpan lebih dahulu. Buat password baru dua kali melalui prompt tersembunyi; tunggu konfirmasi tersimpan dan halaman dibuka kembali. Login biasa dengan password baru. **Biarkan jendela pemulihan terbuka; jendela itu kini menjalankan demo.** Hanya password akun demo yang diganti, sesi lama dicabut; absensi, sejarah, pairing dan izin perangkat tetap. Akun disabled/identitas lain tidak diaktifkan atau diganti. Tidak ada reset melalui browser, auto-login, atau bypass autentikasi.
5. **Mentor:** halaman terbuka otomatis, tanpa username/password mentor. Di Admin pilih **Perangkat Mentor**, sekolah, tanggal pelayanan yang belum berakhir dan kelompoknya, lalu **Terbitkan kode 48 jam per kelompok**. Bagikan kode sesuai nama mentor pada barisnya. Mentor cukup memasukkan kode; sekolah, tanggal, kelompok dan mentor dipilih server. Tanggal contoh lama yang sudah lewat tidak dapat diaktifkan. Panduan Stage 4 berikut menjelaskan batas aksesnya.
6. **Selesai:** tekan **Enter** di jendela demo, atau klik dua kali **`Stop ABC Attendance.cmd`**. Tunggu **Demo berhenti / Data lokal tersimpan** sebelum menutup jendela. Jika penyimpanan gagal, emulator tetap hidup; tekan Enter/Stop lagi setelah masalah pulih. Hindari tombol X/Task Manager agar snapshot sempat disimpan.

Akun, izin dan data demo dipakai kembali melalui namespace **`local-demo-m2b5b`**. Snapshot Auth/Firestore disimpan hanya di **`.emulator-data/local-demo-launcher/`** (diabaikan Git), lalu dipulihkan ketika peluncur menyalakan emulator berikutnya. Jangan hapus folder ini jika ingin menyimpan demo, dan jangan bagikan/commit snapshot. Data yang telah diedit dan izin yang telah dicabut tidak direset. Peluncur memeriksa izin pairing dan memberi peringatan jika dicabut/tidak lengkap; pemulihan password tidak memulihkan izin tersebut. Reset hanya melalui file lokal di atas dengan konfirmasi, tanpa password bawaan atau endpoint pemulihan publik.

**Jika port 4175/4176/4177 sudah digunakan:** biarkan jendela Start terbuka dan ikuti pesannya. Tidak perlu mengetik perintah PowerShell.

- **Server ABC cocok dan sehat:** dipakai ulang otomatis. Peluncur memeriksa identitas instance melalui pipe lokal dan HTTP, versi source, konfigurasi Auth/Firestore, allowlist UID, namespace dan origin. API/route Admin tetap menolak akses tanpa autentikasi. Stop membiarkan server manual yang dipakai ulang tetap hidup; hanya server yang dibuat peluncur yang ditutup.
- **Server ABC terverifikasi tetapi konfigurasi/versi berbeda:** ketik **GANTI** lalu Enter hanya jika setuju menutup server tersebut dan menjalankan konfigurasi demo yang sama dengan peluncur. Enter saja membatalkan. Penggantian menutup server aplikasi, tanpa menghapus data emulator atau mengganti password/izin.
- **Server lama/tidak dikenal/tidak sehat:** peluncur tidak mengambil alih atau mematikannya. Untuk API manual lama di 4175, cari **jendela API ABC yang Anda jalankan sebelumnya**, tekan **Ctrl+C** di sana, lalu kembali ke jendela Start dan tekan **Enter** untuk mencoba lagi. Tidak perlu memulai ulang Start. Jika tidak mengenali pemilik port, ketik **BATAL** dan minta bantuan operator; jangan menutup proses secara acak. Server sebelum pembaruan ini belum mempunyai identitas lifecycle sehingga memerlukan langkah ini sekali.

Auth/Firestore Emulator manual yang identitas project dan listener loopback-nya cocok dapat digunakan kembali dan **tetap berjalan** setelah Stop; peluncur hanya menghentikan emulator yang ia jalankan sendiri. Saat emulator masih aktif, data aktifnya menjadi acuan; snapshot lama tidak diimpor menimpa data aktif. Jika kode proyek berubah saat demo masih berjalan, klik Start akan meminta konfirmasi penggantian instance lama sebelum membuka halaman. Reset password juga meminta penggantian server manual terverifikasi agar sesi lama tidak tertinggal; server tak dikenal harus ditutup pemiliknya dahulu.

Prasyarat disiapkan operator sekali: **Windows, Node.js 22+, Java JDK 21+, dependensi proyek dan cache emulator yang sudah tersedia**. Peluncur tidak memasang dependensi atau meminta login Firebase cloud. Kesalahan Node/Java/port/data ditampilkan dalam bahasa Indonesia. Hanya Firebase Emulator **demo-abc-attendance**, listener loopback dan data fiktif; tanpa billing/deploy atau endpoint provisioning publik. Panduan PowerShell/operator tetap tersedia di bawah.

## Stage 6 — Backup Mentor / Gabung Kelompok Sementara

1. Aktifkan perangkat backup melalui kode mentor biasa untuk **sesi yang sama**. Perangkat harus masih aktif dan berasal dari sekolah yang sama. Kode yang sudah ditebus tidak dipakai lagi untuk perangkat lain.
2. Login Admin/PIC, buka **Backup Mentor**. Pilih pelayanan yang sudah terdaftar, mentor/perangkat aktif, kelompok yang perlu dibackup dan alasan. Klik **Konfirmasi penugasan backup**, periksa ringkasannya lalu setujui. PIC memerlukan izin baca/terbitkan dan cakupan seluruh kelompok, termasuk kelompok utama perangkat.
3. Pada Mentor, klik **Muat ulang izin kelompok**. **Kelompok utama** dan **Kelompok backup** tetap terpisah; ketuk kelompok untuk membuka absensinya. Selesaikan penyimpanan atau muat ulang konflik sebelum berpindah. Absensi setiap kelompok disimpan, diselesaikan dan dikoreksi secara terpisah.
4. Pantau penugasan pada tab Backup Mentor. Gunakan **Akhiri backup** atau **Cabut backup**, isi alasan dan konfirmasi. PIC memerlukan izin pencabutan serta cakupan lengkap. Permintaan server berikutnya untuk kelompok backup akan ditolak; akses kelompok utama tetap mengikuti izin awal. Cabut seluruh perangkat melalui Perangkat Mentor bila diperlukan.
5. Jalankan **Stop ABC Attendance.cmd** seperti biasa dan tunggu snapshot terverifikasi. Snapshot memuat penugasan/audit bersama data emulator. Pemulihan snapshot lama dapat memulihkan izin lama; tinjau/cabut kembali izin sebelum memakai data hasil pemulihan.

Backup tidak memindah siswa, mengubah mentor tetap atau memperpanjang pairing. Batas akses mengikuti perangkat: maksimal satu jam sejak aktivasi dan akhir tanggal pelayanan WIB, termasuk non-Jumat. Maksimal 15 kelompok backup per perangkat. Beberapa perangkat dapat memiliki izin terpisah; pergantian perangkat membutuhkan aktivasi baru dan penugasan eksplisit, bukan penggunaan ulang kode. Perangkat pairing legacy tanpa identitas mentor tidak ditawarkan; gunakan aktivasi mentor Stage 4 tanpa mereset data.

Jika perangkat tidak muncul, periksa sisa masa akses, sekolah/ID sesi, identitas mentor dan cakupan PIC, lalu muat ulang. Jika hasil simpan tidak pasti, **Coba lagi penugasan yang sama** memakai intent yang sama; jangan membuat penugasan baru sebelum memeriksa daftar. Reload halaman membuang intent di memori, sehingga daftar wajib diperiksa dahulu. Perubahan tanggal/mentor, pencabutan izin penerbit atau expiry dapat membuat penugasan tidak berlaku; kalender tidak memberikan akses baru.

Uji dengan `npm.cmd run test:stage6` atau **Test ABC Attendance.cmd**. Runner memakai port/namespace/data fiktif terisolasi, mencakup regresi Stage 1–5 dan skenario backup. Lihat [QA.md](QA.md) dan hasil aktual [PROJECT_STATUS.md](PROJECT_STATUS.md). Tetap lokal/emulator; Stage 7 dan produksi belum dijalankan.

## Stage 5 — Jadwal pelayanan semua hari

1. Login PIC atau Superadmin di Admin **4177**, lalu buka **Jadwal Pelayanan**. PIC memerlukan **Lihat cakupan dan perangkat** serta **Terbitkan kode Mentor dan atur jadwal**. PIC baca-saja hanya melihat sesi berizin; pengelolaan akun PIC tetap khusus Superadmin.
2. Pilih sekolah, tanggal dan kelompok, lalu **Simpan jadwal**. Jumat reguler dan pelayanan khusus hari lain memakai alur sama. Server membatasi sekolah/kelompok sesuai izin operator. Penyimpanan membuat sesi ber-ID acak dan menambahkan tuple hanya kepada operator serta pemilik, tanpa memberikan akses kepada PIC lain atau membuat kredensial Mentor otomatis.
3. Beberapa sesi dapat memiliki tanggal sama. Periksa **ID sesi** sebelum edit atau penerbitan kode. **Ubah jadwal** mempertahankan ID, mencatat tanggal sebelumnya dan memeriksa revisi. Sekolah/kelompok lama tetap disertakan; sesi dan absensi tidak dihapus. Perubahan tanggal menolak kode dan akses Stage 4 lama: terbitkan kode baru setelah tanggal benar.
4. Buka **Perangkat Mentor**, pilih tanggal/ID sesi dan kelompok, lalu terbitkan kode 48 jam. Mentor cukup memasukkan kode. Akses tetap maksimal **1 jam sejak penebusan**, paling lambat akhir tanggal pelayanan WIB. Kalender semua hari tidak membuka akses 24 jam atau memperpanjang kredensial. Draf mendatang tetap dapat disiapkan; penyelesaian menunggu tanggal pelayanan WIB.

Pada navigasi Mentor dengan grant lama, kalender hanya mengaktifkan tanggal berizin server. Jika kelompok yang sama memiliki beberapa sesi pada satu tanggal, kartu mencantumkan ID masing-masing. Pada demo **4173**, semua hari dapat ditinjau, tetapi tanggal kosong menonaktifkan **Pilih kelompok**. Mentor tidak lagi membuat pelayanan sementara atau menambahkan kelompok ke jadwal. Admin demo perlu mengonfigurasi sesi terlebih dahulu; sesi provisional lama perlu diverifikasi. Arsip tetap tersedia dalam laporan.

Filter laporan dan XLSX demo tetap memakai ID sesi dan mendukung semua hari. Target reguler hanya menghitung Jumat. Tab rekap/ekspor Admin aman yang sebelumnya belum tersedia tetap belum dimigrasikan; tidak memakai localStorage demo sebagai pengganti data server.

Jika respons penyimpanan terputus, gunakan **Coba simpan lagi** dengan permintaan sama; retry tidak membuat sesi kedua. Konflik revisi ditolak: muat ulang sebelum mengubah lagi. Reload menghilangkan intent di memori; periksa daftar ID sebelum membuat sesi baru. Batas lokal: 16 kelompok per operasi dan 256 tuple izin tersimpan per operator. Jika penuh, minta Superadmin meninjau cakupan lama tanpa menghapus riwayat. Batas ukuran body dan rate limit tetap berlaku.

API: `GET/POST /api/admin/service-sessions`, dengan bearer Admin. POST menerima `schoolId`, `date`, `groupIds`, `expectedRevision`, `idempotencyKey`, serta `id` hanya untuk edit. Semua cakupan diperiksa kembali dalam transaksi; peran dari klien tidak memberi akses. Hanya sesi tersimpan dengan tanggal valid dan bukan provisional yang dapat dipakai Mentor. Semua fitur masih khusus emulator/data fiktif.

Uji lengkap: **Test ABC Attendance.cmd** atau `npm.cmd run test:stage5`. Runner yang sama menjalankan regresi Stage 1–5, kalender demo/offline dengan port sementara, serta cold recovery. Startup/Stop mengikuti Stage 3; tidak perlu reset data atau dependensi baru.

## Stage 4 — Kode aktivasi Mentor

1. Superadmin memberi PIC izin **Lihat cakupan dan perangkat**, **Terbitkan kode Mentor dan atur jadwal**, serta **Cabut kode/perangkat** bila diperlukan, dengan cakupan sekolah/pelayanan/kelompok yang sesuai. Login PIC tetap menggunakan akun sendiri; izin diperiksa server.
2. Di **Perangkat Mentor**, pilih sekolah, tanggal/ID sesi pelayanan dan satu atau beberapa kelompok. Terbitkan sekali untuk satu kode per kelompok (maksimal 16 dalam satu batch). Server menentukan mentor efektif; jangan mengganti nama/kelompok pada perangkat Mentor. Seluruh batch berhasil atau seluruhnya ditolak bila salah satu cakupan tidak diizinkan.
3. Kode hanya tampil pada respons pertama. Bagikan secara privat kepada mentor yang tertera, lalu **Sembunyikan semua kode**. Reload, pindah tab/pilihan, keluar dan pemeriksaan sesi menghapus kode dari layar. Daftar berikutnya hanya menampilkan penugasan, waktu dan status. Jangan meletakkan kode dalam URL, log, tangkapan layar atau berkas publik.
4. Mentor memasukkan **kode saja** pada halaman 4176. Kode berlaku tepat **48 jam sejak diterbitkan server**, sekali pakai. Akses perangkat berlaku **maksimal 1 jam sejak ditebus**, dibatasi akhir tanggal pelayanan WIB. Penebusan setelah tanggal pelayanan ditolak walaupun kode belum 48 jam. Untuk perangkat tambahan atau perangkat yang kehilangan kuncinya, terbitkan kode berbeda untuk penugasan yang sama. Reload perangkat yang masih berizin memakai izin tersimpan, tanpa menebus kode lagi.
5. Untuk kode yang belum dipakai, pilih **Cabut kode**, lalu konfirmasi. Kode yang sudah dipakai tidak bisa dipakai ulang; untuk menghentikan aksesnya pilih **Cabut akses perangkat** pada daftar perangkat. Pencabutan kode dan pencabutan akses perangkat adalah tindakan berbeda. Perangkat lain dengan kode berbeda tetap dapat bekerja; riwayat absensi tidak dihapus.

Status membedakan **Belum dipakai**, **Sudah dipakai**, **Kedaluwarsa**, **Dicabut**, **Penugasan berubah** dan **Pelayanan berakhir**. Jika respons penerbitan terputus, gunakan **Coba lagi penerbitan 48 jam** dengan permintaan yang sama. Retry tidak membuat kode kedua dan tidak menampilkan ulang kode; periksa/cabut kode yang belum dipakai sebelum menerbitkan pengganti. Reload halaman menghilangkan intent retry di memori, sehingga daftar server perlu diperiksa kembali. Jika aktivasi terputus setelah kode terpakai, periksa izin tersimpan; bila tidak ada, minta PIC mencabut perangkat yang tertinggal dan menerbitkan kode baru. Tidak ada reset otomatis.

Endpoint baru: `GET/POST /api/admin/activation-codes` (bearer Admin); POST menerima `grants` dan `idempotencyKey`, tanpa TTL dari klien. Penebusan tetap `POST /api/pairing/redeem` dengan proof P-256; status `/api/device/status` menyertakan penugasan minimal. Endpoint pairing lama dipertahankan untuk kompatibilitas, termasuk perangkat/grant lama; form Superadmin/PIC sekarang memakai kode Stage 4. Token dan kode mentah tidak disimpan server. Batas percobaan lama tetap berlaku; penerbitan bulk dihitung per kode.

Uji lengkap yang terisolasi: **Test ABC Attendance.cmd** atau `npm.cmd run test:stage4` (runner yang sama dengan `test:stage3`). Data fiktif dan screenshot berada pada folder run terpisah, tanpa mengimpor snapshot operasional. Jika Node/Java/cache tidak tersedia, perbaiki prasyarat; jangan menonaktifkan autentikasi atau mereset data. Aturan startup, snapshot dan shutdown Stage 3 tetap berlaku. Seluruh fitur ini masih emulator lokal; backup Stage 6 dijelaskan di atas, deployment belum dikerjakan.

## Stage 3 — Persiapan, pengujian dan pemulihan Windows

Operator menyiapkan dependensi dengan `npm.cmd ci` setelah memperoleh izin instalasi. Bila cache belum tersedia, siapkan Firestore Emulator dengan `node node_modules/firebase-tools/lib/bin/firebase.js setup:emulators:firestore` setelah memperoleh izin unduh. Start hanya memeriksa prasyarat; tidak melakukan kedua tindakan ini otomatis. Pastikan `java -version` menunjukkan 21+ dan `node --version` menunjukkan 22+; bila perlu atur `JAVA_HOME` ke folder JDK. Jangan memakai kredensial cloud atau project selain `demo-abc-attendance`.

**Pengujian:** klik dua kali **`Test ABC Attendance.cmd`**, atau jalankan `npm.cmd run test:stage3`. Runner menampilkan **PASS/FAIL** per tahap dan mengembalikan exit code **0** hanya jika semuanya lulus; kegagalan/prasyarat yang kurang menghasilkan **1**. Perintah ini memeriksa sintaks/import, regresi unit, Auth/RBAC Superadmin/PIC, pairing/Mentor, absensi dan konkurensi/idempotensi Stage 2, startup/Stop, serta export/import dan login setelah restart. Tes browser memerlukan Chrome dan Playwright yang sudah tersedia (`CHROME_PATH`/`ABC_PLAYWRIGHT_MODULE` dapat menunjuk instalasi operator). Tidak memasang paket atau browser otomatis.

Tes memakai emulator baru pada lima port loopback sementara, namespace/akun fiktif terpisah, serta folder `.emulator-data/stage3-tests/run-*`. Snapshot operasional tidak diimpor dan layanan operasional tidak diambil alih. Screenshot regresi ditulis dalam folder run tersebut, bukan menimpa bukti historis. Log/artefak tes dipertahankan untuk pemeriksaan dan diabaikan Git. Bila tes gagal sebelum teardown, periksa log run dan layanan milik tes; jangan mematikan proses berdasarkan nama atau port secara massal.

**Penyimpanan dan Stop:** peluncur menutup server miliknya, mengekspor Auth/Firestore ke folder snapshot baru, memeriksa berkas akun/metadata Firestore dan checksum SHA-256 seluruh berkas, lalu mengganti penunjuk `latest.json`. Snapshot lama tidak ditimpa atau dihapus. Snapshot lama tanpa checksum tetap diperiksa strukturnya; checksum baru tidak membuktikan keutuhan historis sebelum checksum dibuat. Emulator milik peluncur dihentikan melalui IPC dan prosedur shutdown Firebase, tanpa `taskkill`. Stop menunggu konfirmasi akhir; kegagalan export tidak dianggap berhasil dan emulator dipertahankan untuk percobaan ulang.

Server/emulator manual tetap hidup setelah Stop. Bila server manual masih menulis saat export, snapshot tidak menjamin semua perubahan lintas Auth/Firestore tercakup; hentikan pekerjaan lalu tutup server manual melalui jendelanya sebelum Stop untuk mendapatkan salinan yang tenang. Bila server manual memakai emulator yang dibuat peluncur, Stop menolak mematikan emulator sampai server manual tersebut ditutup. Penggantian server ABC terverifikasi saat Start/Reset tetap memerlukan konfirmasi **GANTI**; layanan tidak dikenal ditutup sendiri oleh pemiliknya.

**Startup terputus atau listrik padam:** penanda `active.json` menyimpan nama calon snapshot penyelamatan. Saat kanal induk terputus, child emulator mencoba export dan shutdown normal. Pada Start berikutnya, bila emulator tidak aktif, peluncur memeriksa snapshot penyelamatan atau snapshot terakhir dan meminta **PULIHKAN** sebelum memuatnya. Enter membatalkan. Perubahan setelah snapshot mungkin hilang dan izin lama dapat hidup kembali; tinjau/cabut izin setelah pemulihan. Bila tidak ada snapshot lengkap atau checksum berbeda, startup berhenti tanpa membuat data kosong. Jangan menghapus `active.json`, mengganti `latest.json`, atau menyalin snapshot secara coba-coba untuk melewati pemeriksaan; minta operator meninjau salinannya dahulu.

**Layanan gagal sebagian:** bila hanya sebagian port emulator terpakai atau identitas Hub/Auth/Firestore tidak cocok, Start berhenti dan tidak mematikan layanan itu. Tutup instance ABC yang Anda kenali melalui jendelanya, tunggu port dilepas, lalu ulangi Start. Pemeriksaan berkala memberi pesan ketika aplikasi/emulator terputus; hentikan perubahan dan periksa server sebelum melanjutkan. Jalur diagnostik emulator dicetak pada jendela Start. Login tidak direset, pairing/izin tidak dipulihkan otomatis, dan tidak ada pilihan hapus data untuk memperbaiki startup.

Bila emulator sudah mati sehingga Stop tidak dapat mengekspor, minta operator memeriksa snapshot yang masih ada terlebih dahulu. Setelah itu tutup jendela peluncur yang gagal, buka Start, dan tinjau konfirmasi PULIHKAN. Jangan menutup paksa emulator yang masih menyimpan atau menghapus penanda/data untuk melewati pemeriksaan.

## Stage 2 — Bekerja bersamaan dan menangani konflik

- Superadmin, PIC dan perangkat Mentor dapat bekerja bersamaan sesuai izin masing-masing. Gunakan akun PIC sendiri dan tab/profil browser yang sesuai. Keluar dari satu sesi Admin tidak mengakhiri sesi lain, termasuk dua login akun yang sama. Pencabutan akun/izin PIC tetap membatalkan seluruh sesi PIC tersebut.
- Jika absensi menampilkan **Data atau ketentuan absensi berubah**, pilih **Muat ulang data server**, periksa status terbaru, lalu lakukan perubahan yang masih diperlukan. Perubahan lama tidak dikirim ulang otomatis. Tombol **Coba lagi** untuk respons penyimpanan yang hilang memakai permintaan yang sama; tidak menambah revisi atau catatan riwayat dua kali. Siswa Belum Diabsen tetap harus ditandai secara eksplisit sebelum finalisasi.
- Jika penerbitan kode belum pasti, gunakan **Coba lagi penerbitan**. Pilihan dan kunci permintaan dipertahankan dalam memori, termasuk saat pemeriksaan ulang sesi. Bila permintaan pertama sudah berhasil, server menolak duplikat tanpa membuat kode kedua atau menampilkan kembali kode rahasia. Pilih **Batalkan kode terakhir** dengan konfirmasi, atau tunggu kedaluwarsa sebelum menerbitkan pengganti. PIC tanpa izin pencabutan perlu menunggu kedaluwarsa atau meminta bantuan pemilik kode yang berwenang.
- Hindari F5/menutup tab saat penerbitan belum pasti. Reload seluruh halaman menghapus kunci percobaan ulang dari memori; kode yang sempat terbit tetap bisa berlaku sampai kedaluwarsa. Tunggu jendela kode UI **5 menit** berakhir sebelum menerbitkan pengganti yang tidak dapat dikonfirmasi. Tidak ada penyimpanan token/kode mentah/kunci retry di browser storage atau sinkronisasi offline.

Kontrak API penerbitan sekarang mewajibkan `idempotencyKey` 16–128 karakter `[A-Za-z0-9_-]` untuk `POST /api/admin/pairing-codes`. Satu maksud penerbitan memakai satu kunci; retry mempertahankan body dan kunci yang sama. Receipt `pairingSubmissions` terikat UID dan fingerprint pilihan; hanya hash kunci, fingerprint, pairingId dan waktu kedaluwarsa yang disimpan. Duplikat memberi 409 dengan metadata nonrahasia, tanpa `code`; payload berbeda dengan kunci sama ditolak. Helper internal tepercaya masih mendukung pemanggilan lama tanpa kunci, tetapi jalur HTTP tidak. Dua operasi baru dengan kunci berbeda tetap boleh menerbitkan kode berbeda untuk perangkat yang memang berbeda.

Bearer login Admin kini berupa handle per-login: ID token Auth Emulator yang diverifikasi server ditambah nonce acak. Formatnya tetap field `token` pada respons login; gunakan utuh melalui client, jangan merakit atau memotongnya. Server hanya menyimpan hash handle dan tetap memeriksa token Auth, status/peran/revisi izin pada setiap request. ID token langsung dari Auth Emulator atau nonce yang dikarang tidak memberi akses. Riwayat absensi dan mekanisme pairing/proof lama tetap; Stage 4–6 dijelaskan di atas; Stage 7 belum dijalankan.

## Stage 1 — Superadmin dan akun PIC

1. Klik **Start ABC Attendance.cmd**. Jika instance lama masih berjalan, ikuti konfirmasi **GANTI** untuk menyimpan dan menggantinya. Saat pertama mengaktifkan peran, baca penetapan pemilik lalu ketik **TETAPKAN**. Enter saja membatalkan. UID **demo-admin-local** yang sudah ada menjadi satu Superadmin awal; email, password, izin pairing dan absensi lama tetap. Akun baru tetap meminta password tersembunyi melalui setup lama. Tidak membuat pemilik kedua atau mengaktifkan akun/izin yang dicabut.
2. Setelah **Demo siap**, masuk ke Admin **4177** sebagai pemilik, lalu pilih **Akun PIC**. Isi email fiktif berakhiran `.test` atau `example.invalid`, password 12–128 karakter, tindakan yang diizinkan, serta sekolah/sesi/kelompok. Nama mentor membantu memilih cakupan. Klik **Buat PIC** dan tunggu **Akun PIC tersimpan**. Bagikan kredensial secara privat; password tidak ditampilkan kembali.
3. PIC membuka Admin yang sama di browser/profilnya sendiri, mengganti email demo dengan email PIC, lalu login biasa. PIC hanya dapat melihat atau mengelola perangkat dalam cakupan dan tindakan yang diberikan. UID PIC **tidak perlu ditambahkan** ke `ABC_ADMIN_UIDS`; record peran server menjadi acuan setelah migrasi. Untuk PIC yang memakai UI Perangkat Mentor, sertakan izin **Lihat cakupan dan perangkat**.
4. Untuk mengubah PIC, pilih **Ubah izin / status**, atur izin saat status **Aktif**, lalu simpan dan konfirmasi. Pilih **Nonaktif** atau **Dicabut** untuk menolak login dan permintaan berikutnya. Sesi lama berakhir saat izin/revisi akun berubah; PIC perlu login ulang. Nonaktif/Dicabut mempertahankan cakupan lama. Superadmin tetap dapat menonaktifkan PIC ketika izin pairing pemilik tidak tersedia, tetapi tidak dapat memberi cakupan baru di luar izinnya. Perangkat Mentor yang sudah dipasangkan tidak otomatis dicabut; gunakan pencabutan perangkat bila perlu. Kode PIC yang belum ditebus ditolak setelah akun/izin penerbit dicabut.
5. Klik **Stop ABC Attendance.cmd** untuk menyimpan snapshot Auth/Firestore, termasuk akun dan peran baru. Pemulihan password lewat **Reset Admin Password.cmd** hanya untuk pemilik demo; bukan reset password PIC. Penggantian email/password PIC belum tersedia. Backup Mentor mengikuti alur Stage 6 di atas; Stage 7 belum dijalankan.

Peran disimpan pada `emulatorNamespaces/{namespace}/adminAccounts` dan satu penanda pemilik `adminSecurity/owner`. Perubahan izin dicatat di `authorizationEvents`; izin pairing tetap memakai `adminPairingPermissions`. Setelah penanda ada, UID di allowlist saja tidak cukup untuk login, dan peran dari browser diabaikan. Namespace lama yang belum dimigrasikan tetap memakai batas allowlist lama, tanpa pengelolaan akun PIC; panduan M2B di bawah menggambarkan jalur lama tersebut. Kegagalan membaca peran tidak beralih ke mode lama atau demo browser.

Auth dan Firestore tidak mempunyai transaksi bersama. Setup akun yang gagal ditandai `setup-failed` dan ditolak server; minta operator meninjau akun fiktif yang mungkin tertinggal sebelum mencoba email yang sama. Tidak ada penghapusan otomatis atau klaim sukses saat setup belum terkonfirmasi. Semua ini hanya untuk emulator lokal dan data fiktif, bukan pengoperasian dengan data anak nyata.

## Setup demo lokal M2B.5B — akun admin dan data pairing

Bagian ini mendokumentasikan setup/fixture dan pairing lama. Untuk akun Superadmin/PIC dan kode baru, ikuti Stage 1/Stage 4 di atas; tanggal historis contoh tidak dapat dipakai untuk aktivasi Stage 4 setelah hari pelayanannya berakhir.

Helper **CLI tepercaya**, bukan endpoint web: `npm.cmd run demo:provision`. Menggunakan validasi konfigurasi Auth/Firestore Emulator yang sudah ada serta data dan pemetaan dokumen fixture M2B.5B. Hanya project **demo-abc-attendance**, host literal **127.0.0.1**, namespace eksplisit dan data fiktif; konfigurasi produksi/cloud ditolak sebelum akses SDK. Tidak mengubah autentikasi, admission, device proof, atau lifecycle pairing.

Jalankan dari root proyek di Windows PowerShell interaktif:

1. **Terminal Emulator:** jika Auth 9099 dan Firestore 8080 sudah aktif, gunakan instance yang sama. Jika belum:

```powershell
Set-Location 'D:\Work\ABC Goes to School Attendance PWA\ABC Goes to School Attendance PWA'
$env:ABC_JAVA_TCP_FALLBACK='1'
npm.cmd run emulators:start
```

2. **Konfigurasi bersama:** salin blok berikut ke terminal provisioning, terminal API, dan terminal Admin. Semua harus memakai namespace yang sama; jangan mengganti ID sesi dengan tanggal atau memakai namespace tes sementara.

```powershell
Set-Location 'D:\Work\ABC Goes to School Attendance PWA\ABC Goes to School Attendance PWA'
$env:ABC_ROSTER_ADAPTER='firestore-emulator'
$env:ABC_ADMIN_AUTH_MODE='firebase-auth-emulator'
$env:ABC_FIREBASE_PROJECT_ID='demo-abc-attendance'
$env:GCLOUD_PROJECT='demo-abc-attendance'
$env:GOOGLE_CLOUD_PROJECT='demo-abc-attendance'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
$env:ABC_FIRESTORE_NAMESPACE='local-demo-m2b5b'
$env:ABC_ADMIN_UIDS='["demo-admin-local"]'
```

3. **Terminal provisioning:** setelah konfigurasi di atas, jalankan:

```powershell
npm.cmd run demo:provision
```

Jika akun belum ada, ketik password uji pilihan sendiri **12–128 karakter** saat prompt, Enter, lalu ulangi. Karakter tidak ditampilkan, termasuk tanda bintang. Jangan memasukkan password ke argumen command, environment, source, chat, pipe atau redirect. Salah konfirmasi/Ctrl+C membatalkan sebelum akun dibuat. Helper menolak terminal noninteraktif dan argumen tambahan; tidak mencetak password/token/SDK error mentah.

Identitas tetap: **email `admin.demo@abc-attendance.test`**, **UID `demo-admin-local`**. Keduanya dicetak setelah setup berhasil. Allowlist di atas harus dipakai pada **kedua server API dan Admin**, lalu restart server lama agar membaca konfigurasi tersebut; claim/flag browser tidak memberi izin.

Helper membuat akun jika belum ada dan menambahkan 48 dokumen create-only: 3 sekolah, 16 kelompok, 8 mentor, 16 penugasan tetap, 3 Jumat pelayanan, 1 siswa fiktif Hagai dan 1 permission admin. Menggunakan ID fixture yang sudah ada: **s1 / g13 / mentor-louis / demo-pakel-2026-10-09 / fictional-hagai**, tanggal **9 Oktober 2026**, **SDN Pacarkeling V / Hagai / Kak Louis**. Permission di `emulatorNamespaces/local-demo-m2b5b/adminPairingPermissions/demo-admin-local` aktif untuk 16 tuple fixture. Kelompok lain disediakan sesuai mapping resmi, roster lainnya kosong. Tidak membuat profil privat, batch/history absensi, credential perangkat, atau kode pairing otomatis.

**Idempoten tanpa overwrite:** record identik dilewati dan password akun yang sudah ada tidak diminta/diubah. Record berbeda, permission dicabut, UID/email konflik atau akun disabled membuat helper berhenti; tidak ada flag force, reset password, re-enable, delete atau pemulihan izin otomatis. Gunakan namespace demo kosong yang lain pada seluruh terminal bila isi Firestore sudah berubah, atau tinjau lewat operator. Akun Auth bersifat project-wide dan tetap memakai password lama di namespace lain. Auth dan Firestore tidak memiliki transaksi bersama; kegagalan setelah pembuatan akun dapat meninggalkan akun tanpa semua fixture. Perbaiki koneksi/konflik lalu jalankan ulang; data yang sudah ada dipertahankan. Helper tidak melakukan export snapshot atau menyimpan rahasia ke berkas; snapshot runtime runner emulator tetap berada di `.emulator-data/` yang diabaikan Git.

4. **Terminal API** (blok konfigurasi bersama di atas):

```powershell
$env:ABC_ROSTER_PORT='4175'
$env:ABC_MENTOR_ORIGIN='http://127.0.0.1:4176'
node backend/server.mjs
```

5. **Terminal Admin** (blok konfigurasi bersama yang sama):

```powershell
$env:ABC_ADMIN_PORT='4177'
npm.cmd run start:admin
```

6. **Terminal Mentor:**

```powershell
Set-Location 'D:\Work\ABC Goes to School Attendance PWA\ABC Goes to School Attendance PWA'
$env:ABC_API_ORIGIN='http://127.0.0.1:4175'
$env:ABC_MENTOR_PORT='4176'
npm.cmd run start:mentor
```

7. Chrome **http://127.0.0.1:4177** → login email fiktif dan password yang tadi diketik → **Perangkat Mentor** → **SDN Pacarkeling V** → **2026-10-09** → **Hagai / Kak Louis** → terbitkan kode. Masukkan kode secara privat pada aktivasi mentor **http://127.0.0.1:4176** dalam 5 menit, pilih scope yang sama dan periksa **Siswa Hagai Fiktif**. Kode hanya tampil sekali dan tidak dapat ditebus dua kali. Admin → Muat ulang perangkat → Cabut akses → konfirmasi; mentor → Periksa izin harus kehilangan akses. Login admin memerlukan password pribadi uji Anda; kode demo lama tidak digunakan. Tidak ada layanan manual yang dihentikan otomatis oleh helper.

Pemeriksaan terarah helper: `node --test tests/provision-demo.test.mjs`; dengan emulator aktif dan blok konfigurasi bersama, `node --test tests/emulator/provision-demo.test.mjs tests/emulator/device-management.test.mjs`. Tes membuat akun/namespace sementara dan membersihkannya; tidak membuat akun demo persisten dengan password acak untuk pengguna. Tanpa menjalankan helper interaktif, akun persisten belum disiapkan. Tidak untuk produksi/data anak nyata; tidak ada dependency/endpoint baru, deploy, commit atau push.

## M2B.5B — Perangkat Mentor, admin terautentikasi

Catatan kompatibilitas jalur pairing lama. Untuk penerbitan Superadmin/PIC dan aktivasi baru, gunakan panduan Stage 4 di atas; masa kode 5 menit dan pemilihan cakupan manual di bagian ini hanya berlaku bagi jalur lama.

Tab **Perangkat Mentor** pada admin **4177** menggunakan autentikasi M2B.1 dan adapter/lifecycle pairing M2B.2 yang sama dengan mentor **4176** melalui API **4175**. Pilih sekolah, Jumat pelayanan dan satu atau beberapa kelompok; nama kelompok memakai konfigurasi resmi **3 sekolah / 16 kelompok**, dengan subtitle mentor efektif dari resolver server. Pilihan hanya berasal dari izin operator server, tidak memberi izin baru. Kode berlaku **5 menit**, sekali tebus, dan akses perangkat **1 jam sejak penebusan** untuk tuple yang dipilih. Perubahan cakupan memerlukan pencabutan dan pairing baru.

Kode mentah hanya muncul setelah respons penerbitan berhasil, di memori halaman saat itu. **Sembunyikan kode**, pindah pilihan/tab, pemeriksaan sesi, logout, reload, error atau expiry menghapus tampilannya; tidak dapat dibuka kembali. UI tidak mencatat kode di log/storage/daftar perangkat. Respons penerbitan yang hilang tidak diulang otomatis; kode yang tidak diterima dibiarkan kedaluwarsa. **Batalkan kode terakhir** memakai ID hash yang sudah ada dan memerlukan konfirmasi. Kode yang sudah ditebus harus ditangani lewat pencabutan perangkat.

Daftar hanya menampilkan perangkat yang seluruh grant-nya diizinkan untuk admin tersebut: ID perangkat, status Aktif/Kedaluwarsa/Dicabut, cakupan, waktu daftar/expiry/pencabutan dan jejak aktivasi/pencabutan terakhir (jenis, waktu, aktor). Tidak mengirim code/hash credential/public key/profil siswa. **Cabut akses perangkat** memerlukan konfirmasi dan dinyatakan sukses hanya setelah respons server serta pembacaan ulang daftar. Mentor kehilangan akses pada permintaan berikutnya; absensi dan riwayat dipertahankan. Error API/izin mengunci perubahan sampai muat ulang, tanpa fallback demo. Sesi admin invalid/expired/revoked menutup dashboard.

Endpoint same-origin berikut memakai bearer yang sudah di-admit M2B.1 dan verifikasi ulang server. Tidak ada cookie, CORS admin, endpoint publik pemberian izin, atau provisioning alternatif.

| Endpoint | Kontrak minimum |
|---|---|
| `GET /api/admin/pairing-context` (baru) | `{contexts:[{schoolId,groupId,serviceSessionId,schoolName,groupName,mentorName,serviceDate}]}`; hanya scope berizin, relasi server valid. |
| `GET /api/admin/devices` (baru) | `{devices:[{deviceId,state,createdAt,expiresAt,revokedAt,grants,lastEvent}]}`; proyeksi minimum tanpa rahasia. |
| `POST /api/admin/pairing-codes` | Body `{grants,codeTtlMs:300000,grantTtlMs:3600000,idempotencyKey}`; 201 `{pairingId,code,expiresAt}` hanya sekali. Duplikat kunci/payload sama memberi 409 `{duplicateSubmission:true,pairingId,expiresAt,error}` tanpa kode baru; kunci sama/payload berbeda juga ditolak 409. |
| `POST /api/admin/pairing-codes/{pairingId}/revoke` | Lifecycle lama, body `{}`; membatalkan kode pending. |
| `GET /api/admin/devices/{deviceId}` / `POST /api/admin/devices/{deviceId}/revoke` | Lifecycle lama; revoke body `{}`; server memeriksa seluruh grant. |

Read baru dibatasi 60 request/admin/menit, mutasi memakai limiter lama 20/admin/menit. Seluruh respons no-store. 401 menutup sesi, 403 menolak scope/permission, 429 batas percobaan, 503 adapter tidak tersedia. Transaksi, hash token, device proof P-256, single-use, nonce, audit dan validasi relasi M2B.2 tetap digunakan.

Uji manual Windows PowerShell dari root proyek:

1. Gunakan emulator `demo-abc-attendance` yang sudah aktif, atau jalankan `npm.cmd run emulators:start` pada terminal terpisah (opsi TCP Java Windows di bawah tetap berlaku). Operator tepercaya harus sudah menyediakan akun Auth fiktif, data sekolah/kelompok/mentor/sesi/roster fiktif sesuai kontrak, dan dokumen **`emulatorNamespaces/{namespace}/adminPairingPermissions/{uid}`** dengan `{active:true,grants:[{schoolId,groupId,serviceSessionId},...]}`. Maksimum 16 tuple. UID juga wajib berada di `ABC_ADMIN_UIDS`; login saja tidak memberi izin pairing. Tidak ada auto-seed/migrasi ataupun UI pemberian permission. Prosedur operator M2B.2 di bawah tetap berlaku.
2. Pada terminal API dan admin, gunakan **namespace fiktif yang sama dengan data yang sudah disiapkan**, serta allowlist UID yang sama. Isi placeholder bukan token berikut sesuai fixture lokal:

```powershell
$env:ABC_ADMIN_AUTH_MODE='firebase-auth-emulator'
$env:ABC_FIREBASE_PROJECT_ID='demo-abc-attendance'
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
$env:ABC_ROSTER_ADAPTER='firestore-emulator'
$env:ABC_FIRESTORE_NAMESPACE='NAMESPACE_FIKTIF_YANG_SUDAH_DISIAPKAN'
$env:ABC_ADMIN_UIDS='["UID_ADMIN_FIKTIF_YANG_SUDAH_ADA"]'
```

3. Pada terminal API dengan konfigurasi di atas, jalankan `$env:ABC_MENTOR_ORIGIN='http://127.0.0.1:4176'` lalu `node backend/server.mjs` (4175). Pada terminal admin dengan konfigurasi yang sama jalankan `npm.cmd run start:admin` (4177). Pada terminal mentor jalankan `npm.cmd run start:mentor` (4176). Jangan menjalankan server kedua jika port sudah terpakai; server lama perlu dimulai ulang untuk membaca perubahan kode/config. Mode login admin tanpa adapter tetap tersedia, tetapi pengelolaan perangkat menjawab 503.
4. Chrome **http://127.0.0.1:4177** → login akun fiktif → **Perangkat Mentor** → sekolah/Jumat/kelompok → terbitkan kode. Untuk SDN Pacarkeling V / Hagai gunakan scope **s1/g13** dengan ID sesi server yang memang diizinkan, bukan tanggal sebagai ID. Periksa subtitle mentor efektif. Bagikan kode secara privat ke mentor, jangan screenshot/log kode. Pada **http://127.0.0.1:4176**, masukkan kode ke alur aktivasi yang sudah ada. Penebusan kedua/kode kedaluwarsa harus ditolak.
5. Kembali ke admin → **Muat ulang perangkat** → periksa cakupan/status → **Cabut akses perangkat** → Batal harus tidak mengubah data; ulangi dan konfirmasi. Pada mentor **Periksa izin** harus menutup akses. Uji logout admin, akun tanpa permission, dan API terputus: data/kode tidak boleh muncul lewat fallback. Reload admin memerlukan login baru.

Tes otomatis terarah: `node --test tests/admin-devices.test.mjs tests/admin-client.test.mjs tests/admin-login.test.mjs` dan `npm.cmd run test:admin-devices`. Runner emulator memerlukan port bebas dan membuat akun/namespace fiktif sementara, termasuk seluruh mapping 3/16; membersihkannya setelah selesai. Jika emulator manual sudah aktif, gunakan environment demo/Auth/Firestore di atas (UID runner `[]`) lalu `node --test tests/emulator/device-management.test.mjs tests/emulator/device-management-ui.mjs`. Screenshot tanpa kode: `screenshots/admin-devices-mobile.png` dan `screenshots/admin-devices-desktop.png`.

Batas: khusus emulator/owner proses lokal tepercaya. Tidak ada produksi, provisioning permission UI, ubah grant perangkat aktif, refresh credential, offline sync, migrasi/CRUD/ekspor dashboard absensi atau daftar kode lama. Daftar perangkat/audit belum dipaginasi; skala lokal saja, maksimum 16 tuple permission yang sudah ditetapkan kontrak. Refresh status perangkat manual; server tetap menolak expiry/revocation setiap request. Pemeriksaan sesi periodik dapat menyembunyikan kode sebelum 5 menit. Android fisik/Safari/Firefox belum diuji. Bagian M2B.5A dan milestone lama di bawah adalah catatan tahap sebelumnya; perluasan route/fitur terkini dijelaskan di sini.

## M2B.5A — login admin aman, Auth Emulator

`npm.cmd run start:admin` membuka **http://127.0.0.1:4177**. Entry point ini terpisah dari demo **4173**, API mentor **4175**, dan mentor secure **4176**. Server admin menyajikan shell dengan desain/tab dashboard yang sama serta hanya tiga route API same-origin: `POST /api/admin/login`, `GET /api/admin/session`, `POST /api/admin/logout`. Tidak memakai `app.js`, seed, database demo/localStorage, service worker atau endpoint profil siswa. Data/pengelolaan dashboard belum dihubungkan ke database server pada M2B.5A; enam tab tetap dapat dinavigasi, dengan status belum tersedia dan kontrol pengelolaan nonaktif. Seluruh fitur demo lama tetap di 4173; migrasi data/admin operations dilanjutkan pada M2B.5B.

Login menerima JSON `{email,password}` dan memanggil **helper M2B.1 `signIn` yang sama pada context server yang sama**. Token yang diterima baru dapat digunakan setelah verifikasi/admission server, UID allowlist dan status akun Auth Emulator lolos. Client memverifikasi lagi melalui protected session sebelum menampilkan dashboard; tidak mengandalkan flag/claim/kode demo. Respons login `{token,uid,mode}` no-store, tanpa cookie/CORS. Bearer hanya di closure memori client; tidak disimpan di localStorage, sessionStorage, IndexedDB, URL atau cache. Password input dibersihkan saat submit dan tidak dipertahankan untuk refresh. Reload memerlukan login ulang. Login langsung ke Auth Emulator saja tetap tidak meng-admit token ke context API ini.

Logout mencabut admission token server memakai `revoke` M2B.1, segera membersihkan akses client, dan mencegah respons lama membuka dashboard kembali. Jika jaringan gagal, tampil **Keluar lokal; pencabutan belum terkonfirmasi**; login/protected requests ditutup sampai retry logout berhasil. Hilangnya halaman sebelum konfirmasi dapat meninggalkan admission server sampai token expiry, tetapi bearer tidak dipersistenkan. Tidak mengklaim revocation server saat API tidak tersedia. Setiap protected request tetap diperiksa server; UI memeriksa ulang pada focus/online/offline/visibility, pergantian tab dan interval 45 detik. Invalid/expired/revoked atau kegagalan verifikasi menutup dashboard tanpa fallback demo.

Login/logout opt-in hanya pada entry admin, dengan loopback socket, Host literal dan Origin same-origin, body JSON maksimal 4 KiB, batas 10 percobaan login/menit per proses, validasi field dan pesan gagal aman. Tidak menerima UID/role/flag dari body. Tidak membuka CORS admin, pairing-management UI atau bypass allowlist. Tidak memakai sesi cookie, sehingga tidak menambahkan mekanisme CSRF cookie; pemeriksaan Origin/Host dan JSON tetap diberlakukan. Backend mengembalikan 401 untuk kredensial/izin tidak valid, 503 untuk gangguan koneksi Auth Emulator yang dikenali, dan menolak tanpa fallback cloud. Pemeriksaan sesi admin lama juga diverifikasi ulang sebelum respons.

Uji manual Windows PowerShell (jalankan dari root proyek):

1. Jalankan emulator demo yang sudah ada: `$env:ABC_JAVA_TCP_FALLBACK='1'`, lalu `npm.cmd run emulators:start`. Gunakan emulator yang sudah berjalan bila port 8080/9099 aktif; tidak perlu menyalakan instance kedua.
2. Operator tepercaya menyiapkan **akun fiktif yang sudah ada di Auth Emulator**, berikut UID/email/password-nya. Akun tidak dibuat atau diberi izin otomatis oleh UI. UID harus masuk allowlist server; claim `admin` atau kode demo tidak cukup. Gunakan prosedur internal Admin SDK M2B.1 untuk penyediaan akun; tidak ada akun/password bawaan dan jangan menulis rahasia ke source/log/history.
3. Pada terminal admin, atur environment berikut dan mulai server. Ganti placeholder UID dengan UID akun fiktif tersebut (UID bukan token):

```powershell
$env:ABC_ADMIN_AUTH_MODE='firebase-auth-emulator'
$env:ABC_FIREBASE_PROJECT_ID='demo-abc-attendance'
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
$env:ABC_ADMIN_UIDS='["UID_ADMIN_FIKTIF_YANG_SUDAH_ADA"]'
npm.cmd run start:admin
```

4. Buka Chrome pada **http://127.0.0.1:4177**, masukkan akun fiktif. Verifikasi keenam tab, Periksa sesi dan Keluar; reload harus kembali ke login. Coba password salah/UID di luar allowlist. Nonaktifkan/cabut akun melalui operator Auth Emulator, lalu Periksa sesi untuk membuktikan akses ditutup. Putuskan koneksi API untuk menguji error tanpa dashboard/demo fallback. Data sekolah/siswa belum ditampilkan pada tahap ini.

`start:admin` memakai context backend sendiri pada 4177; bearer tidak dibagikan ke API 4175. API 4175 dan CORS mentor tetap seperti M2B.4B. Tidak memerlukan Firestore untuk login admin saja, dependency baru, SDK Firebase browser, produksi atau deployment.

Tes terarah otomatis (port emulator harus bebas): `npm.cmd run test:admin-login`, memakai akun sementara fiktif dan Chrome terisolasi, lalu membersihkan akun/server/browser tes. Bila emulator manual sedang aktif, gunakan environment demo/Auth di atas lalu `node --test tests/emulator/admin-login.test.mjs tests/emulator/admin-login-ui.mjs` untuk memakai instance yang ada. Tes client/HTTP: `node --test tests/admin-client.test.mjs tests/admin-login.test.mjs`. Screenshot baru: `screenshots/admin-auth-mobile.png`, `screenshots/admin-auth-desktop.png`.

Batas: khusus emulator/owner proses lokal tepercaya, bukan produksi. Belum ada full admin database migration, data/CRUD/ekspor admin server, pairing management UI, credential refresh, sesi persisten antar-reload, global logout seluruh akun/perangkat, audit login terpusat atau offline sync. Limiter hanya memori proses dan reset saat restart. Android fisik/Safari/Firefox belum diverifikasi. Siap untuk fondasi M2B.5B; fitur data demo tidak disalin ke mode secure.

## M2B.4B — absensi mentor secure melalui API lokal

Mode mentor **4176** kini memuat roster dan status absensi dari API M2B.4A **4175** untuk tuple sekolah/Jumat/kelompok yang dipilih. Pairing, key storage, proof, nonce dan grant memakai M2B.2–3B yang sama. Demo **4173** tetap terpisah dengan perilaku sebelumnya. Tidak ada integrasi dasbor admin atau produksi.

- Hadir sekali ketuk, serta menu ⋯ untuk Izin, Tidak Hadir dan Belum Diabsen, menyimpan patch dengan revisi dan UUID idempotensi. Baris/status tetap menunjukkan data server terakhir selama menyimpan; kontrol perubahan dikunci sampai respons selesai. Tampilan membedakan memuat, menyimpan, tersimpan, error dan konflik. **Tersimpan hanya muncul sesudah respons mutasi valid dan pembacaan ulang data terbaru berhasil.** Perubahan tidak disimpan ke localStorage/IndexedDB/service worker dan tidak dikirim otomatis saat online kembali.
- **Tinjau & selesaikan** membuka dialog ringkasan empat status. Batal tidak menulis. Konfirmasi tidak tersedia bila ada siswa Belum Diabsen, roster kosong atau tanggal mendatang. Tidak pernah menandai siswa otomatis menjadi Tidak Hadir. API tetap memeriksa konfirmasi, revisi dan tanggal server. Batch selesai terkunci; **Koreksi absensi** memilih siswa, status eksplisit dan alasan, membuka draf lewat endpoint koreksi yang sama, lalu perlu ditinjau/difinalisasi ulang. Tidak mengubah ID atau versi historis.
- Error setelah respons hilang dapat berarti commit sudah terjadi. **Coba simpan lagi** hanya mengirim command/key yang sama dengan proof/nonce baru, lalu membaca ulang versi terkini; receipt lama tidak menggantikan versi server yang lebih baru. Tidak ada retry otomatis atau antrean offline. **Muat ulang data server** membuang command tertunda dan mengambil kondisi aktual. Konflik 409 mengunci perubahan dan mewajibkan muat ulang; perubahan lama tidak diterapkan ulang otomatis. Command retry hanya ada di memori halaman; setelah reload/pergantian pilihan, baca kembali server dan tinjau statusnya.
- Setiap load/save mengikat scope yang ditangkap sebelum request. Respons terlambat diabaikan setelah pilihan/izin berubah, termasuk ketika request pada kelompok lama selesai setelah pindah kelompok. Reload kembali ke pemilihan sekolah; pilih Jumat/kelompok yang sama untuk mengambil catatan tersimpan. Tidak ada data demo atau fallback lokal saat API gagal. Revoked/expired menutup alur dan membersihkan data yang tampil. Status API/roster tidak di-cache; service worker v11 tetap shell same-origin saja.
- CORS opt-in hanya diperluas untuk `GET, PUT /api/attendance` dan `POST /api/attendance/finalize`, `/api/attendance/corrections`, pada origin loopback persis `ABC_MENTOR_ORIGIN` dengan header proof/Authorization/JSON yang sama. Preflight metode/header/origin lain ditolak, admin tetap tanpa CORS, tanpa wildcard/cookie credentials. Kontrak/perilaku transaksi API M2B.4A tidak diubah.

Uji otomatis terarah, memakai Chrome terisolasi dan namespace/akun/roster fiktif sementara:

```powershell
$env:ABC_JAVA_TCP_FALLBACK='1'
npm.cmd run test:attendance-ui
```

JDK/runtime/dependency yang ada dipakai kembali; runner menyalakan/mematikan emulator dan menghapus namespace tes. Jangan jalankan bersamaan dengan emulator manual pada port yang sama. Tes controller/CORS: `node --test tests/mentor-attendance.test.mjs tests/mentor-ui.test.mjs`.

Uji manual:

1. Ikuti konfigurasi emulator dan operator terotorisasi M2B.2–3A di bawah: project `demo-abc-attendance`, namespace fiktif yang sama, sekolah/kelompok/Jumat/roster server valid, dan grant tuple yang sesuai. Jalankan `npm.cmd run emulators:start`; jalankan API `node backend/server.mjs` pada 4175 dengan `ABC_ROSTER_ADAPTER=firestore-emulator`, konfigurasi Auth/Firestore lokal dan `ABC_MENTOR_ORIGIN=http://127.0.0.1:4176`.
2. Jalankan `npm.cmd run start:mentor`, buka **http://127.0.0.1:4176**, lalu aktivasi dengan kode sekali pakai dari operator admin M2B.2 yang sah. Prasyarat admission/allowlist/permission operator tetap berlaku; tidak ada login demo atau provisioning otomatis/bypass baru.
3. Pilih sekolah → Jumat → kelompok. Tandai Hadir/menu status, tunggu **Tersimpan di server**, lalu reload dan pilih scope yang sama. Pastikan Belum Diabsen tetap terpisah, termasuk pada Jumat/kelompok lain.
4. Buka **Tinjau & selesaikan** saat masih ada Belum Diabsen untuk memeriksa penolakan; lengkapi status, tinjau dan konfirmasi. Coba **Koreksi absensi**, pilih status/alasan, lalu selesaikan ulang. Uji dua tab: perubahan dari revisi lama harus konflik dan perlu **Muat ulang data server**. Matikan API/cabut perangkat untuk memeriksa error/penutupan akses tanpa sukses palsu.

Batas: emulator/data fiktif saja; belum ada offline sync, tambah siswa sementara secure, dasbor/ekspor admin API, credential refresh, produksi atau deployment. Perubahan per siswa diserialkan, bukan antrean bulk/offline. Android fisik, Safari/Firefox dan instalasi PWA belum diverifikasi pada tahap ini. Screenshot baru: `screenshots/mentor-attendance-{draft-mobile,mobile,desktop}.png`; artefak tahap sebelumnya dipertahankan.

## M2B.4A — API persistensi absensi, Firestore Emulator

Backend lokal menyediakan `attendance` dari adapter Firestore yang ada. Gunakan konfigurasi emulator/pairing M2B.2–3B yang sama; tidak ada token, akun mentor, dependency atau jalur provisioning baru. Hanya data fiktif. Pada M2B.4A frontend masih baca-saja; integrasi tulis/CORS berikutnya dijelaskan pada bagian M2B.4B di atas.

Semua endpoint berikut menerima tepat tiga query `schoolId`, `groupId`, `serviceSessionId` (masing-masing sekali), `Authorization: Bearer ...`, dan proof ECDSA M2B.2 dengan nonce baru. Tanda tangan mencakup method, URL path/query dan **body JSON mentah persis**. Tidak ada fallback legacy, flag perangkat, role klien, cookie atau kode demo.

| Endpoint | Body JSON / perilaku |
|---|---|
| `GET /api/attendance` | Baca absensi atau roster aktif berstatus `unmarked` bila belum dimulai; tidak membuat batch. |
| `PUT /api/attendance` | `{expectedRevision,idempotencyKey,records:[{studentId,status}]}`; patch status draf, membuat satu batch/snapshot pada penyimpanan pertama. Siswa lain tetap pada status sebelumnya. |
| `POST /api/attendance/finalize` | `{expectedRevision,idempotencyKey,confirm:true}`; hanya draf tidak kosong, semua siswa sudah ditandai eksplisit dan tanggal pelayanan sudah tiba menurut jam server WIB. |
| `POST /api/attendance/corrections` | `{expectedRevision,idempotencyKey,records:[{studentId,status}],reason}`; hanya batch selesai, alasan wajib, membuka draf revisi baru yang harus difinalisasi lagi. |

Status API mempertahankan kode yang ada: `present` = Hadir, `excused` = Izin, `absent` = Tidak Hadir, `unmarked` = Belum Diabsen. **Tidak pernah mengubah `unmarked` menjadi `absent` otomatis**, termasuk saat finalisasi. Ini aturan API M2B.4A yang menggantikan konversi otomatis prototipe untuk jalur backend; perilaku demo/frontend lama tetap. `records` adalah patch 1–300 siswa unik, bukan pengganti roster; ID siswa harus menjadi anggota snapshot sesi atau pendaftaran aktif server saat snapshot pertama dibuat. Pindah/nonaktif sesudah snapshot tidak menulis ulang roster historis. Satu siswa hanya dapat berada pada satu batch per Service Session ID, dan dapat dicatat terpisah pada Jumat lain. Reschedule tetap memakai ID pelayanan/batch yang sama.

Respons sukses 200 hanya `{schoolId,groupId,serviceSessionId,batchId,revision,state,updatedAt,finalizedAt,records:[{studentId,status,updatedAt}]}`. `state`: `not-started`/`draft`/`completed`; belum ada batch berarti `batchId:null`, revisi 0. Timestamp ISO server (nilai lama tetap dipertahankan). Respons tidak memuat nama, tanggal lahir, wali, alamat, profil privat atau audit internal. Gunakan roster API yang ada untuk nama/kelas. Semua respons no-store. Kesalahan: 400 format/konfirmasi, 401 credential/proof invalid/expired/revoked, 403 scope/enrollment/origin, 409 revisi usang/finalisasi belum sah/duplikat data/key berbeda payload, 413 body >32 KiB, 503 adapter emulator tidak tersedia. Metode lain ditolak 405, kegagalan penyimpanan 500 dengan pesan aman.

`expectedRevision` wajib bilangan bulat mulai 0. Setiap mutasi berhasil menaikkan revisi sekali. Pada 409, muat ulang sebelum menyusun perubahan baru. `idempotencyKey` wajib 16–128 karakter huruf/angka/`_`/`-` (misalnya UUID baru per aksi). Kunci berlaku per perangkat untuk seluruh scope/action, disimpan persisten dan tidak kedaluwarsa otomatis. Retry request yang sama harus memakai key/body yang sama dengan **proof/nonce baru**; respons awal dikembalikan tanpa menulis versi lain, walau revisi kini lebih baru. Key sama dengan payload/scope/action lain ditolak 409. Retry respons revisi lama tidak boleh menggantikan state klien yang lebih baru; baca ulang setelah retry bila perlu.

Transaksi Firestore mencakup pemeriksaan credential/device/grant yang sama, relasi sekolah/kelompok/pelayanan, enrollment, revisi, batch, riwayat dan receipt. `attendanceSessionLocks` menserialkan penulisan lintas kelompok per pelayanan untuk mencegah klaim siswa ganda. `sessions` mempertahankan ID batch lama; batch baru memakai ID deterministik. `attendanceHistory` menyimpan setiap versi secara append-only beserta waktu, perangkat, hash credential, action dan alasan koreksi. Mutasi pertama pada batch legacy menyimpan baseline utuh sebelum menulis revisi baru. `attendanceSubmissions` menyimpan fingerprint/hasil minimal untuk idempotensi. Ketiganya hanya internal server; tidak ada endpoint mentor untuk membaca profil/audit mentah. Tidak ada penghapusan riwayat/migrasi data demo.

Tes API terarah: `npm.cmd run test:attendance` (runner Firestore/Auth Emulator yang sama; opsi TCP Java Windows di bawah tetap berlaku). Batas lokal: owner/Admin SDK tepercaya dapat mengubah database; API ini belum untuk produksi, data anak nyata, offline sync, tambah siswa sementara, API admin absensi, pagination/arsip audit atau integrasi UI. Maksimum roster 300 siswa/batch dan body 32 KiB; roster lebih besar gagal tertutup. Receipt/riwayat belum mempunyai kebijakan retensi. Recovery snapshot lama tetap memerlukan revoke/reissue sesuai M2A.3.

## M2B.3B — roster mentor aman, baca-saja

Mode mentor **127.0.0.1:4176** sekarang memakai roster dari API, bukan seed/localStorage. Alur tetap sekolah → kalender Jumat → kelompok → daftar siswa, menggunakan kartu kelompok, subtitle mentor, logo, kalender dan gaya responsif yang ada. Hanya sekolah, tanggal Jumat dan kelompok dalam grant yang ditawarkan. Semua pilihan tetap diperiksa ulang pada server; memodifikasi ID request tidak memberi izin. Demo **4173** tetap menggunakan perilaku/data lokal sebelumnya dan terpisah origin.

- `GET /api/roster-context` adalah tambahan metadata baca-saja. Request memerlukan credential/proof perangkat M2B.2 yang sama. Server mengambil scope dari grant credential, memvalidasi relasi sekolah/kelompok/pelayanan, lalu memeriksa ulang autentikasi/grant sesudah I/O. Query pemilih scope pada endpoint ini tidak diterima. Respons hanya `{contexts:[{schoolId,groupId,serviceSessionId,schoolName,groupName,serviceDate,mentorName}]}`; tidak ada siswa/profil privat. Adapter memakai resolver mentor yang sudah ada untuk default bertanggal efektif, pengganti sesi dan snapshot riwayat; tidak menulis/mengganti penugasan. Metadata invalid/missing menolak akses, bukan memakai direktori publik sebagai fallback.
- `GET /api/roster?schoolId=...&groupId=...&serviceSessionId=...` tetap memakai kontrak lama dan otorisasi tuple tepat sebelum/sesudah membaca. Respons siswa tetap **hanya id, name, schoolClass**, dengan snapshot batch bila ada atau roster aktif yang sesuai bila batch belum ada. Tidak ada DOB, wali, alamat, gender, status kehadiran atau profil privat. Scope berbeda ditolak 403; credential/proof invalid, expired atau revoked ditolak 401.
- Client pairing M2B.3A menambahkan pembacaan terproteksi dengan signature fresh/nonce untuk kedua endpoint. Storage kunci nonextractable dan ciphertext credential tidak berubah. CORS opt-in origin persis `ABC_MENTOR_ORIGIN` kini mencakup GET `/api/roster-context` dan `/api/roster`, tetap tanpa wildcard/cookie/akses admin. Browser/API memakai origin loopback eksplisit yang sama seperti sebelumnya.
- Mode secure tidak membaca/seed/migrasi database absensi demo dari localStorage; formatter dan tampilan yang ada dipakai kembali sebagai kode UI saja. Context/roster hanya berada di memori halaman, tidak disimpan ke localStorage, IndexedDB, file atau cache service worker. Reload mempertahankan credential perangkat tetapi memuat context ulang dan kembali ke pilihan sekolah. Gagal API/network mengosongkan baris dan menampilkan error/retry, tanpa fallback seed atau record demo. Respons request lama diabaikan saat pilihan/izin berubah. State loading, kosong, error koneksi, expired dan revoked tersedia.
- Tidak ada tombol Hadir/Izin, tambah siswa, koreksi atau penyelesaian absensi pada mode ini; hanya pencarian nama lokal pada respons API yang sah. Tidak membuat batch/jadwal/provisional atau menulis attendance server/browser. Service worker v10 hanya menyimpan shell/aset frontend, bukan respons API cross-origin. Demo lama tetap mendukung fitur prototipenya sendiri.

Uji otomatis terarah (Chrome + Auth/Firestore Emulator nyata, seluruh identitas/siswa fiktif):

```powershell
$env:ABC_JAVA_TCP_FALLBACK='1' # bila Windows memerlukan fallback TCP Java
npm.cmd run test:roster
```

Perintah ini menguji metadata/roster bound credential dan suite browser pairing yang diperluas: grant sekolah/kelompok/sesi, snapshot dan kelas siswa, mentor historis/pengganti, loading/kosong, invalid/expired/revoked, reload, private-field exclusion, API 500/network error tanpa fallback serta pairing/storage yang sudah ada. Tes unit terarah: `node --test tests/roster-context.test.mjs tests/mentor-ui.test.mjs`. Regresi: `npm.cmd run check`, `npm.cmd test`, `npm.cmd run test:emulator`. Tidak memerlukan dependency baru. Screenshot `screenshots/mentor-roster-*.png` terpisah dari bukti M2B.3A sebelumnya.

Untuk uji manual:

1. Gunakan setup Auth/Firestore/API/mentor server M2B.3A di bawah, tetap project **demo-abc-attendance**, namespace sama, API **4175**, UI **4176**, serta `ABC_MENTOR_ORIGIN=http://127.0.0.1:4176`. Jalankan emulator lalu API dan `npm.cmd run start:mentor`; jangan mencampur origin dengan demo 4173.
2. Operator tepercaya harus sudah menyiapkan data fiktif server: `schools/{id}` dengan `id,name`; `groups/{id}` dengan `id,schoolId,name`; `serviceSessions/{id}` dengan `id,schoolId,date` (date-only Jumat), `groupIds`; siswa/roster snapshot sesuai kontrak lama. Untuk subtitle mentor, sediakan `mentors` dan penugasan efektif/override/snapshot yang sudah dipakai proyek. Semua berada di `emulatorNamespaces/{namespace}/...`. Import snapshot lama yang belum memiliki nama/tanggal metadata perlu dilengkapi operator secara eksplisit; client tidak mengarangnya dari seed. Tidak ada migrasi otomatis atau data nyata.
3. Operator dengan context admin M2B.1 dan izin pairing M2B.2 menerbitkan kode dengan grant tuple yang menunjuk data tersebut. Masukkan kode pada **http://127.0.0.1:4176**; hanya sekolah/kelompok dan Jumat berizin muncul. Pilih kelompok untuk memuat roster API, termasuk kelompok kosong atau sesi lain yang diizinkan.
4. Reload untuk memverifikasi persistensi credential, cabut perangkat dari context admin lalu tekan Periksa izin, atau putuskan koneksi API untuk menguji penolakan/error tanpa data demo. Hapus izin lokal hanya menghapus key/credential di browser. UI/CLI penerbit kode admin interaktif tetap belum tersedia; CLI API tidak otomatis admit token admin. Gunakan harness otomatis untuk alur lengkap bila context operator manual belum disiapkan.

Batas: read-only dan lokal/emulator saja; tidak ada attendance writes, admin UI, produksi, migrasi siswa atau offline sync. Metadata dan roster perlu tersedia/valid di emulator; server kosong/missing metadata tidak diisi seed otomatis. Browser masih mempercayai kode pada origin sendiri; enkripsi credential tidak melindungi dari XSS yang dapat menggunakan kunci. Tampilan direvalidasi pada focus/online/manual/interval 45 detik, bukan notifikasi revocation seketika; setiap request tetap ditolak langsung oleh server sesudah expiry/revocation. Android fisik, Safari/Firefox dan deployment tidak diverifikasi. Fondasi siap untuk M2B.4 sesuai scope yang disetujui berikutnya, belum sistem produksi.

## M2B.3A — layar aktivasi perangkat mentor

Mode mentor pairing berada pada origin terpisah **http://127.0.0.1:4176** (`npm.cmd run start:mentor`); demo lama tetap **http://127.0.0.1:4173** (`npm.cmd start`). Backend API tetap **http://127.0.0.1:4175**. Tidak menggabungkan aset prototipe dengan server API. Entry point mentor memakai UI/kalender/kelompok/absensi JavaScript yang sama setelah aktivasi, tanpa login pribadi. Roster dan seluruh perubahan absensi **tetap simulasi fiktif di browser**, belum membaca roster API, menulis absensi API atau mengubah penugasan mentor. Pilihan sekolah/kelompok bukan bukti izin API. Admin demo disembunyikan/dinonaktifkan di mode ini dan tetap tersedia pada demo terpisah.

Layar menampilkan perangkat belum aktif, pemeriksaan izin, sedang mengaktifkan, aktif, kode invalid/expired/reused, akses dicabut/expired, serta server/penyimpanan tidak tersedia. Input kode dibersihkan saat dikirim dan tidak dimasukkan ke URL, log, localStorage atau cache. Tombol **Hapus izin lokal** menghapus kunci dan credential lokal saja; catatan demo tidak dihapus dan akses perangkat di server tidak otomatis dicabut. Pencabutan server tetap tugas admin melalui M2B.2.

Client menghasilkan **pasangan kunci proof**, bukan credential tepercaya. Credential acak tetap diterbitkan server melalui endpoint M2B.2. Private key ECDSA P-256 serta kunci AES-GCM nonextractable disimpan sebagai CryptoKey di IndexedDB (dukungan [structured clone untuk CryptoKey](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm)). Bearer disimpan sebagai ciphertext AES-GCM, dengan IV acak dan tambahan data terikat origin UI/API serta deviceId; tidak berupa teks mentah di localStorage/record IndexedDB. Ini melindungi dari penyimpanan plaintext tidak sengaja, **bukan** perlindungan terhadap JavaScript berbahaya pada origin yang sama. Browser yang tidak mendukung clone/persistensi kunci ditolak sebelum kode dikonsumsi; tidak ada fallback ke key extractable atau token sementara.

Proof request mengikuti format M2B.2 persis: method/target/hash code atau token/hash body/timestamp/nonce, dengan ECDSA SHA-256/P1363. Setelah reload, client membaca record dan memverifikasi ulang melalui `GET /api/device/status`; flag demo/localStorage tidak memberikan izin. Recheck juga berjalan ketika jendela/tab aktif, kembali online, tombol Periksa izin ditekan, dan setiap 45 detik selama halaman aktif. Offline/verifikasi gagal menutup alur mode pairing tanpa menghapus record; setelah server tersedia izin diperiksa ulang. Jendela/timestamp tetap mengikuti batas ±60 detik M2B.2, sehingga jam perangkat perlu benar. Perubahan izin lokal disiarkan ke tab lain; belum mengklaim dukungan edit absensi bersamaan.

Transport browser memerlukan **opt-in CORS yang sempit**: set `ABC_MENTOR_ORIGIN=http://127.0.0.1:4176` pada proses API atau parameter `mentorOrigin` pada `createRosterServer`. Hanya `/api/pairing/redeem` dan `/api/device/status` menerima origin persis ini, header proof/Authorization yang dibutuhkan dan preflight GET/POST terkait. Tidak ada wildcard, cookie/CORS credentials, akses CORS admin, atau akses roster CORS. Origin lain (termasuk demo port 4173) ditolak; opsi tidak diatur mempertahankan perilaku API tanpa CORS sebelumnya. Ini hanya izin transport: credential/proof, nonce, limiter, expiry dan revocation server tetap wajib. Frontend memakai CSP yang membatasi script ke origin sendiri dan koneksi ke origin sendiri/API loopback yang dikonfigurasi. Kedua server bind loopback saja. Tidak ada Firebase browser SDK/dependency baru.

Uji otomatis lengkap layar pairing:

```powershell
$env:ABC_JAVA_TCP_FALLBACK='1'  # bila sandbox Windows memerlukan fallback TCP Java
npm.cmd run test:pairing-ui
```

Runner memakai Auth/Firestore Emulator demo dan Chrome terisolasi, namespace/akun fiktif sementara, serta API issuance M2B.2 dengan token admin M2B.1 yang sah. Tidak menggunakan akun/data browser pengguna. Playwright memakai runtime yang sudah tersedia (opsional `ABC_PLAYWRIGHT_MODULE` untuk lokasi paket); Chrome dapat diatur lewat `CHROME_PATH`. Tidak memasang paket baru. Suite browser terpisah dari regresi biasa/emulator agar tidak menambah syarat Chrome pada suite tersebut. Screenshot aktivasi, aktif ponsel dan desktop tersimpan pada `screenshots/mentor-pairing-*.png` tanpa kode/token.

Untuk menyiapkan **uji manual** setelah prasyarat operator terpenuhi:

1. Jalankan `npm.cmd run emulators:start` memakai JDK/TCP lokal yang sudah didokumentasikan. Gunakan hanya project demo dan data fiktif.
2. Pada terminal API, atur konfigurasi Firestore serta Auth M2B.1: `ABC_ROSTER_ADAPTER=firestore-emulator`, `ABC_FIREBASE_PROJECT_ID=demo-abc-attendance`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, `ABC_ADMIN_AUTH_MODE=firebase-auth-emulator`, namespace lokal, allowlist `ABC_ADMIN_UIDS` operator, dan `ABC_MENTOR_ORIGIN=http://127.0.0.1:4176`. Jalankan API yang sudah mempunyai context admin terautentikasi untuk issuance, atau CLI `node backend/server.mjs` untuk layanan redeem/status saja.
3. Pada terminal frontend, jalankan `npm.cmd run start:mentor`, lalu buka **http://127.0.0.1:4176**. Opsional `ABC_API_ORIGIN`/`ABC_MENTOR_PORT` hanya menerima origin/port loopback eksplisit yang terpisah dari API/demo. Jangan mengubah origin sesudah pairing bila ingin memakai record yang sama.
4. Operator yang sudah diotorisasi menerbitkan kode melalui `POST /api/admin/pairing-codes` dengan token yang di-admit context M2B.1 dan grants yang diizinkan dokumen server. Serahkan kode secara privat kepada mentor, masukkan pada layar, lalu uji reload, Periksa izin, pencabutan admin, dan Hapus izin lokal. Jangan menulis code/token/password ke file/log/history.

**Prasyarat manual yang belum dikemas:** belum ada UI/CLI operator interaktif untuk login admin, mengelola izin pairing, dan menyerahkan kode. CLI `node backend/server.mjs` tidak otomatis login/admit token admin; login langsung ke Auth Emulator saja belum cukup untuk issuance. Akun UID fiktif yang sudah di-allowlist, dokumen izin serta relasi roster server, dan context operator M2B.1 yang menjalankan `signIn` tetap diperlukan. Helper server dan endpoint terautentikasi sudah ada, tetapi mode manual tidak otomatis membuat identitas/grants/roster atau membuka endpoint issuance tanpa autentikasi. Gunakan tes otomatis di atas untuk mencoba alur lengkap sekarang; alat operator interaktif berada di luar M2B.3A.

Batas: persistensi normal bergantung dukungan IndexedDB/CryptoKey, origin/browser yang sama dan data browser yang tidak dihapus/diusir. Restart penuh browser, Android fisik, Safari/Firefox dan instalasi Android belum diverifikasi pada tahap ini. Kehilangan kunci/credential memerlukan pairing baru; penghapusan lokal tidak mencabut server. Emulator tetap mempercayai komputer/operator lokal dan tidak untuk data anak nyata; tidak ada klaim produksi, sinkronisasi, backend attendance atau migrasi roster. Cache service worker v9 hanya shell/aset frontend; respons API pada origin berbeda tidak di-cache. Tidak ada deployment, billing, commit atau push.

## M2B.2 — API pairing perangkat mentor lokal

Fondasi M2B.1 dan adapter Firestore Emulator digunakan kembali; in-memory dan frontend lama tetap tersedia tanpa pairing. Seluruh API ini hanya untuk `demo-abc-attendance`, Auth/Firestore loopback, dan data fiktif. Jalankan emulator dan context autentikasi sebagaimana M2B.1 di bawah. `createConfiguredRepositories()` pada mode Firestore kini menyediakan `pairing`; `createRosterServer({...adapters, adminAuthentication})` mengaktifkan route berikut. Tanpa adapter Firestore, route pairing tidak tersedia (503), tanpa fallback penyimpanan.

Operator server tepercaya perlu memberi izin tambahan di `emulatorNamespaces/{namespace}/adminPairingPermissions/{uid}` dengan bentuk `{active:true, grants:[{schoolId,groupId,serviceSessionId}]}`. UID tetap harus allowlisted dan token admin tetap harus lolos M2B.1. **Tidak ada izin pairing bawaan**, wildcard, atau endpoint publik untuk menulis izin ini. Izin mencocokkan tepat sekolah/kelompok/pelayanan yang valid; mencakup seluruh grants yang diminta, bukan hanya salah satunya. Izin admin ini terpisah dari penugasan mentor tetap/pengganti; pairing tidak mengubah keduanya.

| Endpoint | Perilaku |
|---|---|
| `POST /api/admin/pairing-codes` | Admin terotorisasi mengirim `{grants,codeTtlMs?,grantTtlMs?}`; 201 mengembalikan `{pairingId,code,expiresAt}` satu kali. |
| `POST /api/admin/pairing-codes/{pairingId}/revoke` | Admin yang memiliki seluruh cakupan kode mengirim `{}`; mencabut kode pending. Bila penebusan sudah menang, state tetap `redeemed`; cabut perangkat secara terpisah. |
| `POST /api/pairing/redeem` | Tanpa akun mentor: kirim `{code,publicKey}` dengan bukti tanda tangan perangkat. 201 mengembalikan `{deviceId,credential,expiresAt}`. Tidak menerima grants/deviceId/peran dari klien. |
| `GET /api/device/status` | Kredensial serta bukti perangkat sah memberikan `{deviceId,state:"active",expiresAt,grants}`. Kredensial expired/revoked atau bukti tidak sah memberi 401. |
| `GET /api/admin/devices/{deviceId}` | Admin dengan seluruh cakupan perangkat dapat membaca ID, grants, expiry dan state `active`/`expired`/`revoked`. Hanya perangkat hasil pairing. |
| `POST /api/admin/devices/{deviceId}/revoke` | Admin terotorisasi mengirim `{}`; mencabut seluruh akses perangkat, idempoten. Tidak menghapus kredensial/riwayat. |

Kode memakai 128 bit acak (`randomBytes(16)`, 22 karakter base64url); default berlaku 5 menit, batas 1 detik–10 menit. Hanya hash SHA-256 yang disimpan sebagai ID/hash dokumen; tidak menyimpan atau mencatat kode mentah. Credential memakai mekanisme M2A.3 yang sama (256 bit acak, hash di database), bukan jenis token baru. Grant default 1 jam, batas 1 detik–1 jam **sejak penebusan**. Respons berisi rahasia hanya dikirim no-store, tanpa CORS; jangan mencatatnya atau memasukkannya ke URL/file. Body JSON maksimal 8192 byte, query/field tambahan/origin browser tidak diterima pada mutasi pairing.

Transaksi Firestore memeriksa ulang izin server/relasi, state/expiry kode, lalu sekaligus mengonsumsi kode, membuat ID perangkat UUID server, device/key binding, credential/grants, dan audit. Satu kode menghasilkan paling banyak satu perangkat/kredensial, termasuk saat request serentak. Kode revoked/expired/reused/unknown memberi pesan 400 yang sama. Jika respons sukses terputus setelah commit, kode tetap habis; admin perlu menerbitkan kode baru, bukan menebus ulang. Permission pairing yang dicabut atau issuer yang dihapus dari allowlist menolak penebusan kode pending. Otorisasi admin diperiksa ulang sesudah I/O sebelum transaksi tulis commit.

**Bukti perangkat:** perangkat membuat pasangan kunci ECDSA P-256; private key sebaiknya nonextractable dalam Web Crypto dan tidak dikirim ke server. `publicKey` adalah SPKI DER dalam base64url tanpa padding. Device dan credential hasil pairing memiliki penanda `binding:"p256-v1"`; penanda/kunci yang hilang atau rusak menolak akses, tidak menurunkannya menjadi bearer-only. Pada penebusan dan setiap request memakai credential pairing (roster maupun status), sertakan tepat satu header `X-Device-Timestamp` (epoch milidetik, 13 digit), `X-Device-Nonce` (16 byte acak, 22 karakter base64url), dan `X-Device-Signature` (ECDSA SHA-256, format IEEE-P1363 64 byte, base64url tanpa padding). Format signature diverifikasi dengan [API kriptografi Node](https://nodejs.org/docs/latest/api/crypto.html#cryptoverifyalgorithm-data-key-signature-callback). Pesan UTF-8 yang ditandatangani adalah tujuh baris berikut, tanpa newline penutup:

```text
ABC-DEVICE-V1
METHOD
/path?query-persis-request
sha256(token-atau-kode)-hex
sha256(body-UTF8-persis)-hex
timestamp
nonce
```

Untuk redeem, token pada pesan adalah kode pairing dan body berisi JSON persis yang dikirim. Untuk GET roster/status, token adalah credential dan body kosong. Toleransi waktu ±60 detik. Nonce per perangkat disimpan atomik di Firestore sampai jendela replay berlalu; replay ditolak termasuk setelah restart API. Penyimpanan dibatasi 120 nonce aktif per perangkat; budget habis memberi penolakan 401 sampai nonce kedaluwarsa. `device-proof.mjs` mendefinisikan format; tes memakai private key Web Crypto nonextractable. Token yang dicuri tanpa kunci tidak cukup. ID perangkat kiriman klien, localStorage atau fingerprint browser bukan bukti otorisasi.

Limiter persisten memakai transaksi dan jendela menit server: maksimal **10 percobaan redeem/menit per alamat socket** (termasuk request gagal), serta **20 operasi pairing admin/menit per UID**. Header proxy/ID klien diabaikan. Dalam mode loopback, perangkat uji berbagi budget alamat lokal. Limit menghasilkan 429 dan `Retry-After: 60`; restart context/API tidak mereset counter. Kode berentropi tinggi tetap menjadi perlindungan utama terhadap tebakan. State credential, device revocation, permissions, code consumption, audit, limiter dan nonce bertahan selama emulator yang sama/data snapshot yang sama dipakai. Admission token admin M2B.1 tetap harus dibuat ulang setelah restart API.

Verifikasi terarah: `npm.cmd run test:pairing`; regresi final: `npm.cmd run check`, `npm.cmd test`, `npm.cmd run test:emulator`. Identitas/penugasan/siswa tes seluruhnya fiktif. Tes juga memastikan roster, ID, absensi, profil privat dan penugasan mentor tidak diubah.

Batas: ini pengikatan ke kunci, bukan attestasi perangkat fisik. Proses lokal tepercaya, malware/XSS yang bisa memakai kunci, pembagian kode sebelum redeem, dan hilangnya penyimpanan kunci tetap menjadi batas web/platform. Belum ada UI pairing/login, pemulihan kunci/credential, sinkronisasi otomatis perubahan penugasan, TLS publik atau proteksi rollback eksternal. Pemilik emulator dapat mengubah data; restore snapshot lama dapat menghidupkan kembali kode/izin/counter sebelum konsumsi/pencabutan. Jangan buka emulator/API ke LAN/internet atau gunakan data anak nyata. Prototipe demo tetap tidak aman dan terpisah dari API. Siap menjadi fondasi M2B.3, belum produksi.

## M2B.1 — autentikasi admin khusus emulator lokal

`firebase.json` dan runner menjalankan **Auth (127.0.0.1:9099) serta Firestore (127.0.0.1:8080)** pada project `demo-abc-attendance`. Tidak ada project Firebase produksi, service account, signing key, login Google, SDK browser baru, atau login UI. Jalankan `npm.cmd run emulators:start` dengan prasyarat Java/TCP lokal yang dijelaskan di bawah. Snapshot baru dari runner dapat memuat kedua emulator; snapshot lama tetap tidak ditimpa. Bagian milestone sebelumnya di bawah merupakan riwayat.

Untuk mengaktifkan fondasi admin pada proses Node tepercaya, atur konfigurasi server berikut sebelum membuat context autentikasi:

```powershell
$env:ABC_ADMIN_AUTH_MODE='firebase-auth-emulator'
$env:ABC_FIREBASE_PROJECT_ID='demo-abc-attendance'
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
$env:ABC_ADMIN_UIDS='["fictional-admin-uid"]'
```

UID harus sudah merupakan identitas fiktif di Auth Emulator dan diotorisasi operator melalui allowlist server. `ABC_ADMIN_UIDS` wajib berupa array JSON dengan UID unik berkarakter huruf/angka/underscore/tanda minus (1–128 karakter); `[]` menolak semua admin. Tidak ada UID bawaan, promosi melalui email, endpoint pendaftaran/role, atau kepercayaan pada custom claim `admin`. Penghapusan/perubahan allowlist dilakukan operator server dan memerlukan restart context; perubahan environment saat context aktif langsung menutup akses.

`backend/admin-auth.mjs` menyediakan `createLocalAdminAuthentication()` dan `createConfiguredAdminAuthentication()`. Gunakan context yang sama sebagai `createRosterServer({...adapters, adminAuthentication})`. Dari **kode server/operator lokal tepercaya saja**, `await adminAuthentication.signIn({email, password})` melakukan login password ke Auth Emulator dan mengembalikan ID token untuk klien uji lokal. Akun tidak dibuat otomatis. Jangan menulis password/token ke kode, log, file, URL, shell history, atau snapshot; tes memakai nilai acak di memori. Helper ini tidak dipublikasikan melalui HTTP dan CLI API tidak melakukan login otomatis. Contoh penggunaan lengkap dengan identitas fiktif sementara ada di `tests/emulator/admin-auth.test.mjs`.

**Alasan admission token:** [Auth Emulator menerbitkan ID token tanpa tanda tangan](https://firebase.google.com/docs/emulator-suite/connect_auth). Verifikasi SDK emulator saja tidak dapat membuktikan bahwa token benar-benar diterbitkan emulator. Context karena itu menyimpan hanya hash SHA-256 token hasil login tepercaya. Pada setiap request, server memakai `verifyIdToken(token, true)` (project/issuer, expiry, account existence, disabled/revocation), memeriksa waktu secara ketat, allowlist UID, serta kecocokan hash token. Token dengan UID/klaim yang dipalsukan tetap ditolak. Token dari login langsung klien ke emulator belum diterima sampai login melalui context server tersebut; refresh juga harus melalui helper tepercaya. `revoke(token)` menghapus admission lokal. Restart context/API menghapus semua admission; token lama memerlukan login ulang. Tidak ada refresh token atau password yang disimpan oleh context.

- `GET /api/admin/session`, dengan tepat satu header `Authorization: Bearer <ID token>`, mengembalikan hanya `{uid, mode:"emulator-lokal"}` setelah seluruh pemeriksaan. Semua jalur `/api/admin/*` melewati guard yang sama. Belum ada operasi tulis admin/perangkat/absensi atau pembacaan profil privat.
- Konfigurasi admin tidak diaktifkan: jalur admin memberi 503. Token hilang/invalid/expired/forged/revoked/tidak di-admit memberi 401; identitas terautentikasi di luar allowlist memberi 403. Query/cookie/flag browser/localStorage/kode demo/peran klien tidak memberikan izin. Header ganda ditolak. Jalur/metode yang belum tersedia tetap 404/405 setelah otorisasi.
- Mode harus eksplisit, host wajib literal `127.0.0.1:port`, project hanya demo. Konfigurasi hilang/invalid/berubah, emulator tidak tersedia, project bertentangan, environment berkredensial cloud, atau `NODE_ENV=production` menutup akses; tidak ada fallback cloud. CLI tidak dimulai bila konfigurasi admin eksplisit invalid. Listener CLI dan akses admin dibatasi loopback.
- Respons tidak di-cache, tanpa izin CORS atau session cookie; tidak menambahkan alur cookie/CSRF. Otorisasi mentor tetap menggunakan kredensial/grant perangkat yang sudah ada. Token admin tidak menjadi kredensial roster mentor, dan sebaliknya.

Verifikasi: `npm.cmd run test:admin-auth` untuk Auth Emulator terarah; `npm.cmd run test:emulator` untuk seluruh kontrak/regresi emulator; `npm.cmd run check` dan `npm.cmd test` untuk regresi biasa. Seluruh identitas/siswa tes fiktif. Runner memakai project/port lokal tetap, tanpa login cloud/deployment/billing.

**Batas keamanan:** emulator dan pemilik proses/komputer lokal tetap tepercaya; emulator tanpa tanda tangan bukan sistem identitas produksi. Admission tambahan melindungi boundary API dari token buatan klien, tetapi tidak melindungi dari operator lokal yang mengubah kode, allowlist, atau akun emulator. Admission tidak persisten dan tidak ikut snapshot recovery. Belum ada login UI/endpoint, pairing UI, rate limiting produksi, audit admin terpusat, TLS publik, atau integrasi frontend. Prototipe port 4173 tetap memakai kode demo/localStorage dan **tidak menjadi aman** karena API ini tersedia. Tetap gunakan data fiktif dan origin terpisah. Siap untuk pekerjaan M2B.2 sesuai scope berikutnya, bukan penggunaan produksi.

## M2A.3 — otorisasi perangkat persisten dan recovery lokal

Bagian yang sudah tersedia pada M2A.2 (token acak 256 bit/hash SHA-256, grants, expiry, revocation, filter roster, guard demo/loopback) dipakai kembali. Adapter Firestore kini mengaitkan setiap kredensial ke dokumen `devices/{deviceId}`. Perangkat hilang, dicabut atau tidak valid membuat autentikasi ditolak; seluruh kredensial perangkat dicabut melalui satu perubahan state.

- Hanya dari **kode server/operator lokal tepercaya** pada context Firestore: `await adapters.deviceAuthorization.issue({deviceId, grants, ttlMs})`. Gunakan ID perangkat opaque seperti UUID, bukan nama/identitas anak. Setiap grant harus mengacu sekolah/kelompok/pelayanan yang benar-benar ada; helper menggunakan pembacaan roster yang sama, bukan resolver baru.
- `await adapters.credentials.revoke(token)` mencabut satu kredensial; `await adapters.deviceAuthorization.revoke(deviceId)` mencabut seluruh akses perangkat dan menolak penerbitan ulang ke ID perangkat itu. Tidak ada endpoint grant/admin/audit publik; kredensial tidak diberikan berdasarkan flag browser. Factory in-memory dan format respons API tetap.
- `authorizationEvents` hanya menyimpan `event`, `deviceId`, `credentialId` (hash), `at`, dan actor tetap `local-trusted-process`. Issuance/revocation dan audit ditulis atomik. Pembacaan dan penolakan autentikasi tidak menulis log per request. Tidak ada token mentah, nama siswa, alamat, DOB, atau isi roster pada audit. Log ini bukan audit tahan manipulasi terhadap pemilik SDK lokal.
- Kredensial lama yang tidak memiliki pengaitan perangkat ditolak tanpa dihapus/dimigrasikan. Terbitkan izin baru melalui helper tepercaya bila diperlukan. Tidak ada perubahan absensi atau profil lama.

Recovery: `npm.cmd run emulators:start` sekarang mengekspor ke snapshot baru di `.emulator-data/snapshot-*` saat shutdown normal; snapshot sebelumnya tidak ditimpa. Untuk memuat snapshot fiktif yang sudah ada, set `$env:ABC_EMULATOR_IMPORT_DIR='.emulator-data/snapshot-...'`, lalu jalankan perintah start yang sama. Import dibatasi ke snapshot di bawah `.emulator-data` dengan metadata export; akses API tetap hanya ke demo/loopback. Jangan menyimpan data nyata di folder ini atau memasukkannya ke Git. Force-kill tidak menjamin export selesai.

`npm.cmd run test:emulator:recovery` menguji dua masa hidup emulator terpisah: seed fiktif, export, shutdown, import, lalu verifikasi grant valid, pencabutan kredensial/perangkat, expiry, roster/ID, dan audit. Nilai bearer uji acak hanya berada di memori/environment anak proses; snapshot hanya memuat hash. Gunakan JAVA_HOME dan opsi TCP Windows yang sama seperti M2A.2.

**Batas recovery:** snapshot merefleksikan keadaan saat export. Restore snapshot sebelum suatu pencabutan dapat mengembalikan izin lama yang belum kedaluwarsa; cabut/terbitkan ulang izin setelah restore lama. Belum ada proteksi rollback dari sumber revocation eksternal. M2B masih perlu autentikasi admin, provisioning/pairing yang aman dan integrasi frontend; proyek ini tetap hanya untuk data fiktif.

## M2A.2 — adapter Firestore Emulator lokal

Prasyarat: Node >=22, npm, JDK 21+ (`JAVA_HOME` atau PATH). Dependency dipatok pada `firebase-admin@14.5.0` dan devDependency `firebase-tools@15.34.0`; lockfile disertakan. Tidak ada SDK Firebase browser, login Google, key service account, atau project cloud.

- `npm.cmd run test:emulator`: CLI menjalankan **hanya Firestore**, project `demo-abc-attendance`, menjalankan tes kontrak/integrasi, kemudian mematikan emulator. Fixture fiktif memakai namespace `test-<UUID>` dan dibersihkan per tes; tidak membaca localStorage/file siswa pengguna.
- `npm.cmd run emulators:start`: menjalankan emulator lokal kosong. `firebase.json` mengikat service ke loopback, menonaktifkan UI, dan memakai Security Rules yang menolak semua akses client. SDK Admin tetap melewati rules; otorisasi API wajib. Emulator bukan batas keamanan terhadap proses lokal tepercaya yang dapat memakai akses owner emulator; jangan buka port ke LAN/internet.
- Pada PowerShell mesin ini, set `$env:JAVA_HOME='C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot'`. Jika npm belum di PATH, gunakan `& 'C:\Program Files\nodejs\npm.cmd' run test:emulator`.
- Khusus sandbox Windows yang mengalami `Unable to establish loopback connection` pada Java, set `$env:ABC_JAVA_TCP_FALLBACK='1'` sebelum perintah emulator. Runner memakai opsi JVM `jdk.net.unixdomain.tmpdir` menuju direktori tidak tersedia agar pipe internal JDK beralih ke TCP. Opsi hanya berlaku pada subprocess emulator; tidak mengubah OS, instalasi Java, atau PATH sistem.

Aktivasi API (terminal terpisah setelah emulator berjalan):

```powershell
$env:ABC_ROSTER_ADAPTER='firestore-emulator'
$env:ABC_FIREBASE_PROJECT_ID='demo-abc-attendance'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
$env:ABC_FIRESTORE_NAMESPACE='development'
node backend/server.mjs
```

Tanpa `ABC_ROSTER_ADAPTER`, API tetap memakai adapter in-memory kosong. Mode emulator menolak host hilang/non-loopback, project lain, namespace tidak valid, kredensial cloud di environment, atau emulator tidak tersedia, tanpa fallback. Target gRPC dipatok ke host lokal; universe SDK diatur eksplisit untuk mencegah penemuan ADC/metadata otomatis. Tidak ada endpoint untuk menerbitkan token atau mengisi database.

Data berada di `emulatorNamespaces/{namespace}/...`: schools, groups, students, serviceSessions, sessions (snapshot roster), credentials (ID hash SHA-256, expiresAt, revokedAt, grant sekolah/kelompok/sesi). Fixture profil privat berada terpisah dan tidak dibaca oleh adapter roster. ID asli disimpan pada field dan document ID; membaca tidak menulis absensi. API menampilkan field minimum yang sama seperti Milestone 1.

Restart **API** mempertahankan kredensial, pencabutan dan roster selama emulator yang sama tetap berjalan. Restart **emulator** tanpa export/import mengosongkan data; durability/backup produksi belum tersedia. Frontend masih prototipe localStorage dan tidak dihubungkan ke adapter. Jangan gunakan data anak nyata.

Verifikasi tambahan: `npm.cmd run check`, `npm.cmd test`. Suite emulator dijalankan terpisah agar regresi biasa tetap bekerja tanpa Java/emulator. Audit runtime saat implementasi: 0 advisori; audit lengkap: 7 temuan pada rantai devDependency Firebase CLI (4 moderate, 3 high). Tidak menjalankan `audit fix` atau mengganti versi yang disetujui; perlu evaluasi versi CLI sebelum penggunaan produksi.

## M2A.1 — kontrak repository asinkron

Server roster kini memakai adapter in-memory berbasis Promise sebagai default. Kontrak JavaScript/JSDoc ada di `backend/repository-contracts.mjs`; factory dan boundary otorisasi ada di `backend/repositories.mjs`:

- `createInMemoryCredentialRepository()`: gunakan `await issue({grants, ttlMs})`, `await authenticate(authorization)`, dan `await revoke(token)`. Pemeriksaan kedaluwarsa/pencabutan tetap dilakukan server pada setiap autentikasi.
- `createInMemoryRosterRepository(source)`: `await read(scope)` adalah operasi data internal tanpa mutasi; bukan pengganti pemeriksaan izin.
- `createAuthorizedRosterRepository({credentials, repository})`: `await readAuthorized(authorization, scope)` memeriksa identitas dan grant sebelum membaca, memeriksa ulang izin setelah I/O, lalu mengembalikan hasil berjenis `ok`, `unauthenticated`, `invalid-scope`, atau `forbidden`. Field privat tidak diteruskan, sekalipun adapter mengembalikannya. Kegagalan penyimpanan menolak Promise dan dipetakan API menjadi error umum 500, tanpa fallback.

Adapter mendatang diinjeksikan ke `createRosterServer({credentials, repository})` melalui kontrak yang sama. Factory sinkron Milestone 1 tetap tersedia; endpoint, format/status HTTP, dan frontend tidak berubah. Tes kontrak: `node --test tests/repository-contracts.test.mjs`; tambahkan adapter mendatang ke daftar factory pada suite yang sama. Belum ada Firebase, emulator, dependensi baru, atau autentikasi produksi; gunakan data fiktif saja.

## Milestone 1 — fondasi otorisasi roster server (uji lokal)

**Seluruh proyek masih hanya untuk data fiktif.** Autentikasi produksi belum tersedia. Prototipe di port 4173 tetap memakai kode demo/localStorage dan tidak dihubungkan ke API ini.

- API terpisah: `node backend/server.mjs`, default `http://127.0.0.1:4175` (opsional `ABC_ROSTER_PORT`). Startup tidak memuat roster atau menerbitkan kredensial; semua permintaan roster ditolak tanpa kredensial sah.
- Satu endpoint: `GET /api/roster?schoolId=...&groupId=...&serviceSessionId=...`, dengan header `Authorization: Bearer <kredensial-uji>`. Parameter hanya memilih sumber daya, bukan bukti izin.
- Respons sukses hanya berisi tiga ID konteks dan `students: [{id, name, schoolClass}]`. Snapshot batch digunakan bila ada; membaca roster tidak membuat batch atau menulis absensi. Tidak ada DOB, wali, alamat, gender, status absensi, atau profil privat dalam respons mentor.
- `createTestCredentialStore()` hanya dapat dioperasikan dari kode server tepercaya. `issue({grants: [{schoolId, groupId, serviceSessionId}], ttlMs})` membuat token acak 256 bit; default berlaku 5 menit, maksimal 1 jam. Store menyimpan hash token, memeriksa kedaluwarsa setiap request, dan `revoke(token)` langsung mencabut akses. Restart menghapus seluruh kredensial. Token tidak ditulis ke berkas/log.
- Tidak ada endpoint login, penerbitan token, registrasi perangkat, perubahan data, atau akses profil privat. Tidak ada kode akses produksi, layanan cloud, billing, atau dependensi baru. Fixture hanya disuntikkan oleh tes melalui kode server; identitas admin/perangkat produksi belum diimplementasikan.
- API menolak secara default, memeriksa cakupan tepat sekolah/kelompok/pelayanan dan relasi datanya, tidak menerima flag admin/perangkat/kode demo/cookie/query token sebagai identitas, tidak mengaktifkan CORS, dan memberi `Cache-Control: no-store` pada semua respons.

**Batas akses legacy:** `/data.js` pada server prototipe tetap publik dan berisi seed roster fiktif; `/app.js` membuka mekanisme kode demo. Profil privat, ekspor/impor, backup, dan seluruh data yang dimasukkan lewat UI tetap dapat diakses dari runtime/localStorage browser (`abc-school-prototype-v1` dan backup-nya). Service worker menyimpan shell prototipe. Ini bukan perlindungan data anak, sekalipun API baru menolak akses tanpa izin.

Server API tidak menyajikan HTML, JS frontend, service worker, modul backend, atau fixture. Server prototipe memakai allowlist aset dan tidak menyajikan modul backend/fixture/API. Pertahankan origin/port terpisah; jangan gabungkan API dan prototipe lama pada origin yang sama atau memasukkan data nyata ke salah satunya. Izin uji adalah grant eksplisit dari proses tepercaya, belum otomatis disinkronkan dengan penugasan mentor/admin produksi.

Validasi: `node --test tests/access-control.test.mjs tests/roster-api.test.mjs`, lalu `node tests/check.mjs` dan `node --test tests/*.test.mjs`. Tes HTTP memerlukan izin koneksi localhost. Semua fixture fiktif berada di `tests/fixtures/roster.mjs`, terpisah dari data prototipe dan tidak dilayani lewat HTTP.

## Menjalankan prototipe yang sudah ada

Jalankan `npm start` atau `node server.mjs`, lalu buka **http://127.0.0.1:4173** pada komputer yang sama. Tidak perlu memasang dependensi. Jangan membuka `index.html` langsung melalui `file://` karena aplikasi memakai ES modules dan service worker.

Mentor: pilih sekolah → aktifkan perangkat demo → **kalender Jumat pelayanan** → kelompok → catat status → tinjau dan selesaikan. Admin: buka **Admin**, kode demo **ABC2026**. Menu **Jadwal Pelayanan** digunakan untuk memilih Jumat serta kelompok terkait. Direktori sekolah/kelompok/mentor mengikuti pemetaan pengguna; siswa, jadwal awal dan absensi tetap simulasi. Jumat tak terjadwal memerlukan konfirmasi menjadi pelayanan sementara; pengiriman tanggal mendatang baru tersedia pada tanggal pelayanan WIB. Gunakan **Tentang demo → Atur ulang demo** hanya bila ingin menghapus perubahan dan kembali ke contoh awal.

Penyimpanan hanya pada browser/origin yang sama. Tidak ada akun aman, sinkronisasi, atau backend produksi. XLSX adalah berkas yang bisa diunduh dengan isi simulasi berlabel data fiktif. Prototipe tidak dipublikasikan.

Mentor tetap dikelola melalui **Admin → Kelompok & mentor → Ubah penugasan**. Pilih **Pengganti sementara** untuk satu sesi atau **Penugasan tetap** dengan tanggal efektif. Tersedia 16 kelompok aktif dengan nama mentor sebagai subtitle; sesi lampau dan absensi siswa dipertahankan.

Lihat [MASTER_BRIEF.md](MASTER_BRIEF.md) untuk aturan dan batasan; [QA.md](QA.md) untuk hasil pengujian. Jalankan `node --test tests/*.test.mjs` (atau `npm test` bila npm tersedia) untuk seluruh pemeriksaan konfigurasi, pelestarian data, dan struktur ekspor.

Pemeriksaan kode: `npm run check` atau `node tests/check.mjs`. Aplikasi buildless JavaScript, tanpa compiler TypeScript. QA browser opsional: `node tests/browser.mjs`, memerlukan Playwright yang sudah tersedia serta Chrome (dapat diatur melalui CHROME_PATH). Skrip memakai profil browser terisolasi dan server sementara port 4174, tanpa mengubah data browser pengguna.

Jika port 4173 sedang dipakai server versi lama, mulai ulang server tersebut untuk menyajikan modul baru atau pilih port lain melalui variabel lingkungan PORT. Data localStorage berbeda antarport/origin, sehingga gunakan origin lama untuk melanjutkan data lama. Tidak perlu mengatur ulang demo untuk migrasi.

## Alur kerja Codex untuk teks

Skill [No AI Slop](.agents/skills/no-ai-slop/SKILL.md) aktif hanya untuk permintaan editorial eksplisit atau tugas utama berupa penulisan ulang substansial UI Indonesia/petunjuk nonteknis. Coding, tes, pembaruan status, dokumentasi teknis biasa dan laporan rutin tidak otomatis mengaktifkannya. Batas lengkap ada di [AGENTS.md](AGENTS.md).

Untuk meminta penyuntingan, tulis: **Gunakan $no-ai-slop mode Edit untuk memperjelas teks berikut tanpa mengubah makna: [teks].** Untuk meninjau saja, tulis: **Gunakan $no-ai-slop mode Detect pada teks berikut; berikan kutipan masalah dan usulan perbaikan tanpa menulis ulang: [teks].** Hanya Edit substantif membaca [eval.md](.agents/skills/no-ai-slop/eval.md), dengan satu tinjauan mandiri dan pengulangan pemeriksaan yang gagal. Detect hanya melaporkan temuan. Aturan teknis, keamanan dan bukti tes tetap berlaku.
