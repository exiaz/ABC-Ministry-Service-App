# ABC Goes to School — Master Brief

**Status revisi 25 Oktober 2026:** prototipe lokal dengan jalur Admin/Mentor aman pada Auth/Firestore Emulator, termasuk Stage 1–6 (hasil verifikasi pada PROJECT_STATUS.md). Bukan sistem operasional/produksi. Nama sekolah, kelompok, dan mentor mengikuti direktori yang diberikan pengguna; siswa, jadwal awal dan catatan kehadiran tetap fiktif. Simulasi frontend lama masih terpisah; tambahan tahap di bawah mengatur jalur emulator, sedangkan bagian legacy mendokumentasikan perilaku prototipe awal. Status terverifikasi ada pada revisi terbaru `PROJECT_STATUS.md`.

## Stage 8 — fondasi organisasi/program dan membership, 26 Oktober 2026

Lingkup baru hanya emulator/data fiktif, namespace `test-*`, A1/A2.2 yang valid dan gate independen `ABC_MSA_STAGE8=1` yang mati default. Auth Pilot memakai launcher lama. Tidak mengaktifkan cutover autentikasi atau menetapkan kepemilikan data operasional. Contoh ABC Movement/Yayasan Anak Bintang Cemerlang serta ABC Goes to School/Pojok Ceria/Bangkit Indonesia hanya konfigurasi fixture, bukan pembatasan organisasi atau persetujuan kebijakan nyata.

Organisasi memiliki ID stabil, nama/status/metadata tervalidasi dan owner UID eksplisit. Program ber-ID stabil milik tepat satu organisasi, memiliki nama/deskripsi/status; organisasi boleh nol/beberapa program dan referensi program untuk fondasi berikutnya boleh null. Pemilihan Tanpa program tidak membuat program/event. Membership aktif berscope satu organisasi mengikat UID identitas terverifikasi, revisi akun/identitas dan role/permissions sementara yang diperiksa server. Grant platform terpisah dari membership operasional; jabatan Superadmin/PIC lama tidak memberi izin Stage 8 otomatis. Satu UID boleh memiliki role berbeda di beberapa organisasi, dengan default-deny lintas organisasi.

Mutasi organisasi/program/membership memakai revisi, alasan/konfirmasi, receipt idempoten yang terikat actor/operasi/organisasi/target dan audit append-only. Hanya grant platform eksplisit dapat membuat/mengubah katalog organisasi; pemilik organisasi mengelola manager/viewer, manager mengelola program, viewer hanya membaca program. Owner ditetapkan eksplisit saat organisasi dibuat; transfer/penghapusan owner memerlukan kontrak terpisah. Program tidak memberi role/izin. Akun suspended/recovery-locked dan binding revisi stale ditolak. Reaktivasi akun tidak memulihkan grant lama tanpa pemberian eksplisit baru.

Adapter legacy hanya membaca referensi tuple namespace/sekolah/kelompok/pelayanan melalui izin sumber trusted yang terpisah dan resolver Mentor lama. Unmapped tetap unmapped; proposal mapping tetap perlu review, tidak dianggap event. ID sekolah/kelompok/Mentor/siswa/sesi/batch/histori tidak diubah; tidak ada backfill organisasi/program, pembuatan sesi, perubahan penugasan atau backup Stage 6. Stage 9 event/scheduling/kalender, rundown/BibleMax, Sheets dan absensi/analitik relawan belum diimplementasikan. Kontrak/risiko governance: MSA_ACCOUNT_ARCHITECTURE.md; hasil aktual: PROJECT_STATUS.md.

## AUTH A2.4B — pemulihan akun fiktif tanpa email, 25 Oktober 2026

Di belakang gate tambahan `ABC_MSA_A2_4B=1` yang default mati, seluruh gate A2.4A dan namespace `test-*`, akun personal A2.2 active/verified dapat mengajukan pemulihan dengan username. Respons publik generik, validasi server, budget persisten global/per username dan deduplikasi tidak memberikan sesi/izin. Nomor HP supplied tidak dipakai sebagai kanal tepercaya. Peninjau Superadmin atau PIC dengan delegasi **pemulihan tersendiri** dan scope/revisi aktif memerlukan alasan, bukti independen baru, konfirmasi dan audit; tidak boleh menyetujui diri sendiri.

Challenge acak sekali pakai berlaku 10 menit, terikat UID/pengajuan/status/revisi akun dan epoch. Hanya hash tersimpan; penyerahan pilot melalui panggilan dalam memori launcher dari terminal operator tepercaya, bukan endpoint publik atau tampilan reviewer. Pemilik memilih kata sandi baru melalui input tersembunyi lokal. Firebase tetap menyimpan/memverifikasi password pada UID asli. Sebelum update provider, transaksi menaikkan revisi/epoch dan memasang lock persisten; sesi/admission/perangkat/backup lama langsung ditolak. Kegagalan parsial tetap terkunci, retry satu worker merekonsiliasi operasi tanpa mengembalikan izin. Histori absensi, UID, username, mentorId dan peran tidak ditimpa. Login dan aktivasi/asosiasi baru tetap wajib.

Recovery tidak membuka suspension, memulihkan grant dicabut, mengubah role, atau melewati Stage 6. Owner, Superadmin dan akun Admin/PIC legacy dikecualikan; last-Superadmin safeguard tetap. Tidak mengikat `momor1n`, mengubah default login, memakai akun operasional, mengirim SMS/WhatsApp/email atau mengaktifkan produksi. Recovery lintas proses/persistence, trusted owner, kanal produksi, step-up dan rekonsiliasi anti-rollback tetap gate A2.4C; hasil aktual dan batas UX platform ada pada PROJECT_STATUS.md.

## AUTH A2.4A — suspension dan lifecycle perangkat tertaut, 25 Oktober 2026

Pengelolaan perangkat tertaut hanya untuk data fiktif/emulator di belakang A1 + A2.2 + A2.3 + `ABC_MSA_A2_4A=1` dan namespace `test-*`; default reguler tetap mati. Mentor dengan sesi personal aktif dapat melihat/mencabut perangkat akunnya sendiri. Superadmin berwenang meninjau akun A2.2; PIC memerlukan delegasi per akun/revisi yang masih berlaku, cakupan primary yang tepat dan izin `pairing:read`/`pairing:revoke`. Status akun tetap diubah melalui kontrol Superadmin A1 yang sudah ada.

Pencabutan memerlukan konfirmasi, alasan, requestId dan revisi akun/asosiasi terkini. Transaksi mencabut device dan asosiasi, menaikkan revision dan mencatat actor/target/alasan/waktu/audit/receipt, tanpa mengubah UID, mentorId, credential, grant, ID pelayanan/batch atau histori absensi. Retry yang sama idempoten setelah otorisasi ulang; perubahan bersamaan tidak boleh menimpa state baru. Endpoint pencabutan perangkat lama mengarahkan perangkat tertaut ke kontrol ini agar alasan/revisi tidak dilewati.

Suspension/rejected/nonaktif dan perubahan revisi akun menolak sesi lama serta seluruh akses perangkat yang sudah tertaut, termasuk roster, write/finalisasi/koreksi/retry dan backup Stage 6. Reaktivasi akun tidak mengaktifkan asosiasi stale atau perangkat yang dicabut: diperlukan login baru, kode PIC baru, aktivasi Stage 4/P-256 proof dan konfirmasi asosiasi untuk deviceId/credential baru. Tidak ada transfer/rebind, pemanjangan izin atau fallback legacy bagi perangkat tertaut. Perangkat yang belum tertaut diklasifikasikan sebagai kasus migrasi belum terselesaikan; tidak dicocokkan otomatis berdasarkan nama/nomor/ID dan belum tercakup klaim suspension global. Ini tidak mengaktifkan recovery, migrasi operasional atau cutover. Bukti aktual: PROJECT_STATUS.md.

## AUTH A2.3 — akun Mentor dan perangkat terisolasi, 24 Oktober 2026

Alur akun Mentor terpisah memakai broker username A1, akun active/verified dan link UID–mentorId A2.2 yang masih berlaku. Login hanya menampilkan penugasan efektif dalam tuple link yang disetujui; tidak membuat role, credential, kode aktivasi atau backup. Penugasan tetap, override dan snapshot memakai resolver lama. Halaman `/mentor-account.html` hanya pada shell Mentor lokal dengan `ABC_MSA_A1=1`, `ABC_MSA_A2_2=1`, `ABC_MSA_A2_3=1`, namespace `test-*` serta Auth/Firestore demo valid; ketiganya tidak diaktifkan global.

Pemakaian perangkat memerlukan aktivasi Stage 4 yang sudah sah, private key/proof yang sama, konteks primary Mentor yang cocok, sesi personal aktif dan konfirmasi asosiasi server. Asosiasi tidak memindahkan atau memperpanjang credential/grant. Marker perangkat dan record asosiasi persisten mengikat UID/revisi akun, link, credential dan primary; perangkat yang sudah tertaut tidak kembali menjadi legacy ketika sesi hilang, akun/link dicabut, atau flag dimatikan. Perangkat legacy yang belum diasosiasikan tetap pada kontrak lama. Revisi akun/link yang berubah memerlukan otorisasi perangkat baru; fase ini tidak menyediakan transfer/rebind asosiasi lama.

Roster, status, absensi, retry receipt dan backup perangkat tertaut memeriksa akun/link/asosiasi/sesi/grant/proof server. Pembacaan otorisasi yang relevan berada dalam transaksi write absensi; versi lama/histori tidak dihapus atau ditimpa. Histori baru perangkat personal mencatat UID/revisi otorisasi tambahan. Kelompok utama dan backup Stage 6 tetap terpisah dan session-scoped. UI Indonesia mengutamakan ponsel dengan input/tombol yang terbaca, aktivasi hanya bila perlu, serta status offline tanpa antrean write otomatis. Bukan cutover, recovery, public registration atau linking operasional. Hasil dan batas aktual: PROJECT_STATUS.md; rincian: MSA_ACCOUNT_ARCHITECTURE.md.

## AUTH A2.2 — pendaftaran dan penautan identitas terisolasi, 24 Oktober 2026

Implementasi lokal menambahkan empat isian Nama lengkap, Nomor HP, Username dan Password, tanpa email/alias pada formulir pendaftaran. Fitur mati secara default dan hanya tersedia bila `ABC_MSA_A1=1`, `ABC_MSA_A2_2=1`, namespace `test-*` serta konfigurasi Auth/Firestore Emulator demo valid. Akun baru pending/unverified tanpa role/eligibility. Nomor supplied dinormalisasi +62 dan tetap belum verified sesudah approval identitas.

Superadmin meninjau antrean, alasan, bukti independen dan peringatan duplikat. PIC lama hanya meninjau akun tertentu setelah delegasi Superadmin eksplisit pada tuple sekolah/kelompok/ID pelayanan yang sudah diizinkan server; perubahan revisi/izin PIC membatalkan delegasi lama. Nama/HP yang cocok bukan bukti dan tidak memicu persetujuan/merge. Bukti yang tidak cukup dicatat sebagai tetap pending; penolakan menyimpan alasan dan audit.

Link UID baru terverifikasi ke `mentorId` lama memerlukan review berwenang, bukti, alasan, scope, revision dan receipt idempoten. Klaim Mentor unik ditulis transaksional; ID/histori tetap. Resolusi default memakai resolver lama secara baca-saja hanya pada cakupan link, tanpa membuat penugasan, role, backup, kode/kredensial/perangkat atau akses absensi. Akun Admin/PIC lama tidak digabung otomatis. Registrasi publik, linking operasional, cutover, recovery dan asosiasi akun-perangkat tetap belum diaktifkan. Rincian/batas: MSA_ACCOUNT_ARCHITECTURE.md; hasil aktual: PROJECT_STATUS.md.

## AUTH A2.1 — identitas MSA dan pilot username, 24 Oktober 2026

Identitas aplikasi/header/login/PWA kini **ABC | Ministry Service App**, memakai logo ABC asli; **ABC Goes to School** tetap nama program pelayanan beserta laporan/data/ID-nya. Login email masih default. Pilot username memakai broker/registry A1 dan dapat mengikat UID Admin/PIC lama tanpa mengubah password, role, scope atau owner marker, hanya melalui helper trusted + reautentikasi di namespace tes fiktif `test-*` dengan dua flag eksplisit. Tidak ada enrollment akun nyata, endpoint klaim publik atau aktivasi global. Target `momor1n` hanya diuji pada Superadmin fixture; registry dan akun operasional belum diperiksa/diikat. Kontrak dan prosedur operasional yang belum dijalankan ada di [MSA_ACCOUNT_ARCHITECTURE.md](MSA_ACCOUNT_ARCHITECTURE.md#auth-a21--branding-dan-pilot-username-uid-lama); bukti aktual di PROJECT_STATUS.md. Stage 1–6, Mentor device/proof/backup dan riwayat tetap; linking/inheritance/recovery/cutover menunggu fase terpisah.

## AUTH A1 — implementasi akun uji terisolasi, 24 Oktober 2026

Broker username Firebase, registry privat dan pengelolaan multi-role/scope oleh Superadmin kini diimplementasikan terbatas untuk akun fiktif pada emulator dengan `ABC_MSA_A1=1`, mati secara default. Login utama, akun/PIC/perangkat lama dan absensi tetap memakai jalur sebelumnya. Kontrak aktual, eligibility, last-Superadmin, sesi/revokasi serta batasnya ada di [MSA_ACCOUNT_ARCHITECTURE.md](MSA_ACCOUNT_ARCHITECTURE.md#auth-a1--kontrak-implementasi-lokal); hasil tes aktual ada di PROJECT_STATUS.md. Ini tidak mengaktifkan pendaftaran umum, migrasi/penautan Mentor, pemulihan password, suspension lintas perangkat atau modul pelayanan MSA.

## Evolusi autentikasi MSA — kebutuhan target dan kajian sebelum A1

**Kontrak disempurnakan 24 Oktober 2026; autentikasi personal NOT IMPLEMENTED.** Target CONFIRMED: satu akun personal per relawan, tanpa akun tambahan menurut peran; registrasi Nama lengkap, Nomor HP, Username dan Password; login username tanpa email pada pengalaman pengguna. Dukung undangan serta pendaftaran umum dengan persetujuan. Pendaftar baru tidak menerima hak istimewa sebelum diverifikasi. Username unik tanpa membedakan kapital; rekomendasi teknis PROPOSED 3–32 karakter ASCII. Nomor Indonesia dinormalisasi ke E.164 +62; supplied dan verified tetap status terpisah. Grammar/contoh normalisasi dan race uniqueness hanya dirinci di kontrak akun.

Mentor lama mewarisi kelompok default terverifikasi secara otomatis setelah identitasnya ditautkan secara terverifikasi, dengan mempertahankan `mentorId`, penugasan bertanggal efektif dan snapshot. Kesamaan nama/nomor atau kepemilikan kode perangkat bukan bukti penautan. PIC yang diberi wewenang boleh approve/link Mentor hanya dalam scope-nya; promosi PIC/hak lebih luas memerlukan Superadmin atau delegasi eksplisit. Superadmin/PIC dapat menugaskan relawan yang layak dalam wewenangnya; eligibility dapat dikonfigurasi, tidak bergantung pada pekerjaan full-time atau pengecualian individu hardcoded. Satu akun dapat memiliki beberapa peran, tetapi setiap tindakan/cakupan tetap diperiksa server.

Rancang recovery tanpa email serta suspension global/per-scope tanpa menghapus sejarah. Suspend akun wajib menolak sesi personal dan akses legacy device milik akun; kemampuan ini belum tersedia hanya dengan status PIC saat ini dan menjadi gate migrasi. Pertahankan UID PIC/Superadmin, seluruh identitas sekolah/kelompok/sesi/siswa/batch, riwayat, RBAC dan proteksi Stage 1–6. Kontrak Mentor tanpa login pribadi pada aplikasi/AGENTS.md adalah kondisi sekarang; migrasi ke akun personal belum dijalankan. Registrasi/login tidak otomatis memberi izin perangkat atau absensi.

**Rekomendasi provider PROPOSED:** gunakan Firebase Authentication dengan broker username dan identifier provider internal, registry privat/unik, pengaitan identitas terverifikasi serta membership/penugasan terpisah. Pertahankan gate kode/proof perangkat Stage 4–6 pada fase awal; login password tidak menggantikannya. Izin namespace alias, pengesahan grammar/validator, reviewer/delegasi, kanal recovery, sesi dan cutover tetap gate implementasi. [Kontrak akun bagian 2.1–2.2](MSA_ACCOUNT_ARCHITECTURE.md#21-kontrak-keputusan-dan-kompatibilitas) menjadi rincian tunggal kebijakan dan batas UI; dokumen yang sama memuat alternatif, risiko, fase dan acceptance test. [MSA_PRODUCT_VISION.md](MSA_PRODUCT_VISION.md) memuat konteks perluasan. Pekerjaan UI saat ini hanya merapikan Akun PIC dengan API email/password yang sudah berfungsi; tidak membuat field profil/username yang belum didukung backend. Tidak ada izin migrasi autentikasi/database, perubahan Firebase/dependensi, implementasi modul MSA atau deployment.

## Stage 6 — Backup Mentor / Gabung Kelompok Sementara · 24 Oktober 2026

Lingkup yang disetujui: Admin/Superadmin dan PIC berwenang dapat memberi perangkat Mentor yang sudah aktif izin backup untuk beberapa kelompok pada **sekolah dan ID sesi yang sama**. Kelompok utama dan backup ditampilkan terpisah. Siswa, mentor tetap, ID sesi/batch dan riwayat tidak dipindah atau digabung; finalisasi dan koreksi tetap per kelompok.

Penugasan memerlukan alasan dan konfirmasi. Gunakan perangkat dengan aktivasi mentor Stage 4 yang masih berlaku, bukan kredensial legacy tanpa identitas mentor. Izin backup tidak membuat kode, mengganti pairing atau memperpanjang akses: batasnya mengikuti izin perangkat yang ada, maksimal satu jam sejak aktivasi dan akhir tanggal pelayanan WIB. Masing-masing perangkat harus memiliki aktivasi sendiri. Pencabutan/pengakhiran berlaku pada permintaan server berikutnya, termasuk retry receipt absensi; pencabutan perangkat menutup seluruh aksesnya.

Server memeriksa tindakan PIC yang sudah ada (`pairing:read`, `pairing:issue`, `pairing:revoke`) dan seluruh tuple kelompok utama/backup. Penugasan yang kehilangan izin penerbit, berubah konteks mentor/tanggal, kedaluwarsa atau dicabut tidak memberi akses. Penugasan/revokasi beserta actor, perangkat, mentor awal/tetap, alasan, waktu dan status diaudit. Transaksi absensi tetap memakai revision, idempotencyKey dan pengaman konkurensi lama. Maksimum 15 kelompok backup tambahan per perangkat; tidak ada migrasi data atau perubahan arsitektur MSA. Stage 7 dan deployment berada di luar lingkup ini. Hasil uji aktual: `PROJECT_STATUS.md`.

## Rencana perluasan MSA — PLANNED / NOT IMPLEMENTED

**Dikonfirmasi sebagai kebutuhan produk, 24 Oktober 2026; belum diimplementasikan.** ABC Goes to School Attendance PWA direncanakan berkembang menjadi **ABC | Ministry Service App (MSA)**. Rincian alur, model konseptual, pemetaan kode lama, risiko, keputusan terbuka dan roadmap ada di [MSA_PRODUCT_VISION.md](MSA_PRODUCT_VISION.md). Bagian rencana ini tidak mengubah kontrak atau status Stage 1–5.

- **Multi-organisasi/program:** penyelenggara, program, event pelayanan, aturan perulangan, mitra, tempat, PIC internal/eksternal, relawan dan riwayat harus dibedakan. Contoh konfigurasi mencakup ABC Movement (Goes to School, Natal, pelayanan khusus seperti SD Elyon) serta Yayasan Anak Bintang Cemerlang (Pojok Ceria, Bangkit Indonesia seperti LPKA Blitar, dan kegiatan lain). Contoh tersebut bukan kategori hardcoded atau izin berbagi data lintas organisasi. Dukung kegiatan reguler, berulang, satu kali dan ad hoc.
- **Buat Pelayanan Baru:** pengguna berwenang cukup mengisi penyelenggara, nama pelayanan, tanggal/waktu, tempat dan PIC internal. Program tidak wajib sudah ada atau dipilih. Program, mitra, PIC eksternal, relawan/peran, rundown, perulangan serta catatan bersifat opsional. Dukung draf, penyuntingan kemudian dan jadwal gabungan; membuka kalender/draf tidak otomatis memberi akses absensi.
- **Rundown dan BibleMax:** BibleMax merupakan metodologi pelayanan anak yang terintegrasi, bukan subbagian rundown generik. Dalam Goes to School, rundown BibleMax adalah penerapan metodologi secara utuh. Template adalah titik awal fleksibel: pilihan aktivitas, urutan dan durasi dapat berubah sesuai tujuan/kebutuhan; tidak menetapkan atau mengarang tahapan internal/urutan wajib. Aktivitas dapat ditambah, dihapus, dipindah dan diberi waktu/durasi/PIC/catatan. Reorder harus tetap sama setelah simpan/reload; edit rundown event tidak mengubah template asli. Dukung versi draf/publikasi, pembagian baca-saja dan pemakaian ulang sebagai template. Program lain boleh memakai metode berbeda.
- **Relawan:** profil, penugasan, peran, kehadiran aktual, sejarah partisipasi dan laporan administrasi dibedakan. Penugasan tidak sama dengan hadir. Satu relawan dengan beberapa peran pada event sama tidak dihitung hadir beberapa kali; kehadiran anak tetap terpisah.
- **Google Sheets:** arah awal yang disarankan adalah sinkronisasi bertahap satu arah MSA → Sheets; MSA menjadi sumber utama event/rundown baru. Mapping, izin/kepemilikan, status, retry, konflik dan kemungkinan dua arah kelak harus dirancang. Tidak mengklaim XLSX demo sebagai sinkronisasi atau mengambil alih workbook lama otomatis.
- **UX/merek:** rencanakan logo ABC asli dengan pemisah vertikal dan nama ABC | Ministry Service App; mobile-first, layak desktop, dashboard/jadwal gabungan, Buat Pelayanan Baru yang menonjol, identitas organisasi/program, navigasi sesuai peran dan editor rundown efisien. Gunakan pola umum membership PWA sebagai inspirasi kegunaan tanpa menyalin desain BP. Tidak mengubah asset/manifest/UI sekarang.
- **Arsitektur dan perlindungan:** utamakan perluasan bertahap melalui modul/adapter pada arsitektur yang ada. Pertahankan seluruh ID, sekolah, kelompok, mentor tetap, aktivasi, otorisasi, absensi, snapshot dan riwayat. Model event umum tidak menggantikan `serviceSessionId`. Rancang izin organisasi, anak, relawan, kontak mitra dan lokasi sensitif; tidak ada migrasi, perubahan schema atau perluasan hak yang diizinkan oleh dokumen ini.

**Urutan pekerjaan tetap:** P0 stabilisasi/validasi; **Stage 6 asli: Backup Mentor / Temporary Group Merge**; **Stage 7 asli: Testing, security, documentation**. Pada saat perencanaan MSA, keduanya belum dijalankan; rencana MSA tidak mengganti tahap asli. Implementasi Stage 6 kini mengikuti lingkup di atas dan status terverifikasi pada PROJECT_STATUS.md. Sesudahnya, P1 berfokus pada fondasi MSA/multi-program, jadwal gabungan, Buat Pelayanan Baru dan navigasi; P2 pada Rundown Builder, Sheets dan Volunteer Management; P3 pada kebutuhan Natal khusus serta fitur lanjutan. Natal adalah use case masa depan, bukan target implementasi mendesak. Tahap lanjutan pada visi produk masih usulan dan memerlukan persetujuan lingkup tersendiri.

## Fondasi aplikasi saat ini — Stage 1–5

**Tambahan Milestone 1:** fondasi API roster baca-saja dan otorisasi kredensial uji tersedia pada server terpisah; belum merupakan backend/autentikasi produksi dan tidak mengganti penyimpanan atau akses demo frontend. Seluruh proyek tetap khusus data fiktif. Kontrak, pemisahan jalur legacy, bukti tes dan batasnya dijelaskan pada `README.md` dan revisi terbaru `PROJECT_STATUS.md`; pernyataan batas backend di bawah tetap berlaku untuk operasi produksi/prototipe frontend.

## Tujuan dan lingkup

**Tambahan Stage 5 (23 Oktober 2026):** Jumat reguler dan pelayanan khusus dapat dikonfigurasi pada semua hari. Tanggal hanya filter: memilih tanggal tidak membuat sesi, menambah kelompok atau memberi izin. Sesi harus dikonfigurasi secara eksplisit dan selalu memakai `serviceSessionId` stabil, termasuk beberapa sesi pada sekolah/tanggal sama. Mentor memilih ID sesi bila ada beberapa pilihan; aktivasi Stage 4 tetap langsung membuka satu penugasan dari server. Pelayanan sementara lama perlu verifikasi admin sebelum dipilih Mentor. Arsip, ID, penugasan dan riwayat dipertahankan tanpa migrasi massal.

**Klarifikasi pengguna untuk Admin:** PIC dan Superadmin dapat mengatur jadwal pengelolaan perangkat. PIC dengan izin `pairing:issue` hanya boleh membuat sesi bagi pasangan sekolah/kelompok yang sudah diberikan kepadanya. Penyimpanan eksplisit menambahkan tuple sesi baru hanya kepada operator dan Superadmin pemilik, yang juga harus tetap memiliki cakupan kelompok tersebut. PIC lain tidak otomatis memperoleh akses. Edit memerlukan izin seluruh kelompok sesi, revisi terkini, receipt idempotensi dan audit server. Sekolah dan kelompok lama tetap disertakan; tidak tersedia penghapusan sesi. Jadwal tidak membuat kode/kredensial otomatis. Batas kode 48 jam dan akses maksimal 1 jam/akhir tanggal WIB tetap berlaku.

Superadmin tetap akun administrator aplikasi yang terpisah dari PIC. Form login tidak memublikasikan/mengisi email pemilik atau menyediakan pemilih peran; server menentukan peran. Identitas/password pemilik yang sudah tersimpan tidak diganti otomatis. Tidak menambah alur pengganti mentor/merge Stage 6 atau deployment.

**Tambahan Stage 4 (23 Oktober 2026):** pada jalur Mentor aman/emulator, PIC berizin menerbitkan satu kode unik per sekolah, ID pelayanan, tanggal, kelompok dan mentor efektif. Kode acak disimpan sebagai hash, ditampilkan sekali, dapat diterbitkan serentak secara atomik, berlaku tepat 48 jam sejak waktu penerbitan server dan hanya sekali ditebus. Mentor memasukkan kode saja; server menentukan penugasannya. Perangkat tambahan memerlukan kode lain, bukan pemakaian ulang kode lama. Kode dicabut/kedaluwarsa/sudah dipakai atau penugasannya berubah ditolak. Izin perangkat lama tetap mengikuti kontraknya.

**Batas akses yang disetujui pengguna:** penebusan kode Stage 4 memberi akses maksimal 1 jam sejak penebusan dan paling lambat akhir tanggal pelayanan menurut WIB; setelah tanggal tersebut, penebusan ditolak meskipun jendela kode 48 jam belum habis. Batas akhir disimpan sebagai tengah malam berikutnya yang eksklusif (mencakup 23.59.59 WIB). Pemeriksaan menggunakan jam server, termasuk pada absensi; masa kode tidak memperpanjang sesi perangkat. Perubahan penugasan/tanggal menolak kode serta akses Stage 4 lama tanpa menulis ulang riwayat absensi. Aturan Jumat, mentor tetap dan otorisasi Stage 1–3 dipertahankan. Ini tidak menambah kalender fleksibel, pengganti/merge Stage 6, atau produksi.

**Tambahan Stage 1 (23 Oktober 2026):** mode Admin Emulator memiliki peran Superadmin/PIC yang diperiksa server. Penetapan pemilik melalui setup lokal memakai UID demo yang sama dengan konfirmasi eksplisit; pengelolaan PIC membatasi tindakan dan cakupan sekolah/sesi/kelompok. Tidak memigrasikan seluruh dasbor legacy atau mengubah aturan Jumat, pairing, absensi, dan koreksi pada tahap ini. Status serta bukti tes terkini ada di PROJECT_STATUS.md; mode legacy di bawah tetap terpisah.

Menggantikan percobaan alur laporan WhatsApp dengan absensi sederhana bagi mentor dan rekap bagi admin. Nama sekolah resmi: **SDN Pacarkeling V**, **SDN Airlangga III**, **SDN Kertajaya IV**, tetap memakai ID s1/s2/s3. Satu arah visual: biru muda, merah koral, kuning, tipografi sistem, ilustrasi vektor lokal, tombol besar. Logo memakai berkas asli yang disediakan pengguna.

- **Mentor:** simulasi izin perangkat tanpa akun pribadi → sekolah → **tanggal pelayanan** → kelompok sekolah tersebut → daftar tetap → Hadir sekali ketuk, Izin/koreksi melalui menu → tambah siswa sementara → tinjau/konfirmasi penyelesaian → hasil dan koreksi ulang.
- **Admin:** pintu masuk demo dengan kode `ABC2026`; **Jadwal Pelayanan**, ringkasan dan riwayat dengan filter sekolah, bulan/tahun, ID tanggal pelayanan dan kelompok; pengelolaan siswa/kelompok/mentor; tinjauan siswa sementara; halaman Ulang Tahun Siswa; ekspor XLSX absensi/siswa dan impor XLSX siswa melalui validasi/pratinjau.
- Tampilan mentor mengutamakan ponsel Android. Admin mendukung desktop dan ponsel; tabel lebar memiliki gulir horizontal sendiri.

## Aturan bisnis

1. Beberapa sesi eksplisit dapat memiliki sekolah/tanggal sama; tanggal bukan identitas sesi. **Service Session ID** adalah acuan utama, tidak berubah saat reschedule. Satu batch absensi per pasangan Service Session ID dan kelompok; satu catatan per pasangan Service Session ID dan siswa, termasuk saat siswa berpindah kelompok. Siswa yang sama dapat dicatat pada Jumat lain secara terpisah.
2. Daftar sesi merupakan salinan siswa aktif saat sesi dibuat. Status awal **Belum Diabsen**. Mengetuk **Hadir** selalu menghasilkan Hadir, bukan toggle yang bisa membatalkan tanpa sengaja. Menu status menyediakan Belum Diabsen, Hadir, Izin, Tidak Hadir.
3. Draf disimpan setiap perubahan jika penyimpanan browser tersedia. Progres menghitung semua status selain Belum Diabsen.
4. Penyelesaian selalu memerlukan konfirmasi. Dialog menyebut jumlah siswa tersisa dan menjelaskan perubahan menjadi **Tidak Hadir**. Batal tidak mengubah status. Sesi kosong tidak bisa diselesaikan.
5. Sesi selesai terkunci untuk perubahan biasa. **Koreksi absensi** membuka kembali sebagai draf dan wajib diselesaikan ulang. Tidak ada jejak audit revisi pada fase ini.
6. Ringkasan admin hanya menghitung sesi selesai. Tabel juga menampilkan draf dan kelompok belum dimulai agar laporan parsial tidak tampak final.
7. Siswa sementara hanya masuk sesi asal. Admin menyetujui agar masuk daftar tetap untuk sesi baru, atau menolak tanpa menghapus riwayat. Nama siswa sementara yang sama pada pelayanan dicegah tanpa membedakan huruf besar-kecil. Pendaftaran tetap memeriksa nama terhadap siswa aktif/nonaktif di seluruh sekolah tujuan sebelum membuat siswa baru. Siswa dengan nama sama yang sah memerlukan pembeda nama pada demo ini.
8. Perubahan siswa dan penonaktifan siswa berlaku untuk sesi baru. Snapshot sekolah/kelompok/mentor dan roster lama dipertahankan; penugasan mentor efektif ditentukan melalui model terpisah di bawah. Label sekolah/kelompok mengikuti direktori terkini berdasarkan ID. Nonaktif tidak menghapus riwayat.
9. Setiap kelompok memiliki satu mentor tetap yang berlaku lintas tanggal; tidak berotasi otomatis. Hanya admin yang mengubah penugasan. Mentor memilih sekolah, tanggal dan kelompok tanpa akun pribadi, serta melihat mentor tetap dan pengganti sesi bila ada. Semua kelompok tetap tersedia di pengelolaan; kelompok kosong dapat disertakan admin.
10. Ekspor mengikuti sekolah, bulan/tahun, Service Session ID dan kelompok di Ringkasan/Riwayat. XLSX memuat ID sekolah/pelayanan/kelompok/siswa, tanggal, status, mentor efektif, ID mentor, sumber penugasan, dan label **SIMULASI — DATA FIKTIF**, termasuk draf/belum dimulai. Ini bukan laporan resmi.

## Penugasan mentor tetap dan pengganti

- Identitas kelompok tidak memuat penugasan aktif. `mentors` menyimpan ID/nama mentor terpisah; `defaultMentorAssignments` menyimpan kelompok, mentorId dan tanggal efektif. Nama/ID kelompok tidak berubah ketika mentornya berubah. Seluruh 16 kelompok aktif menggunakan pemetaan otoritatif di bawah; delapan mentor memiliki identitas bersama lintas sekolah.
- **Pengganti sementara:** satu baris aktif per pasangan kelompok dan Service Session ID, pada `sessionMentorOverrides`. Default kelompok tetap. Pengganti mengikuti ID pelayanan yang sama bila jadwalnya diundur, tidak terbawa ke pelayanan lain.
- **Penugasan tetap:** tanggal efektif dapat dipilih mulai hari ini menurut WIB; tidak harus Jumat. Resolver memilih perubahan terakhir yang sudah efektif, sampai perubahan tetap berikutnya. Berlaku pada sesi berikutnya, termasuk sesi mendatang yang batch absensinya sudah dibuka. Pengganti sementara tetap diprioritaskan untuk sesi khususnya.
- Penugasan sesi lampau/arsip dipertahankan dalam snapshot. Tidak tersedia perubahan sementara untuk sesi lampau, atau penugasan tetap mundur sebelum hari ini menurut WIB. Ini menjaga riwayat tanpa menebak penugasan sebelumnya.
- Snapshot mentor berada di `mentorAssignmentSnapshots` dan setiap versi tetap disimpan. `mentorAssignmentEvents` mencatat nilai sebelum/sesudah perubahan admin. Tanggal efektif ganda ditolak; rencana mendatang pada tanggal yang sama dapat diperbarui secara eksplisit, dengan audit. Pengganti ganda ditolak; form memuat pengganti yang sudah ada untuk diperbarui, tidak membuat baris aktif kedua.
- Perubahan mentor tidak mengubah `students`, `groups`, `sessions`, `records`, status, ID, atau timestamp absensi. Field nama mentor pada batch lama disimpan sebagai snapshot kompatibilitas, bukan sumber penugasan aktif. Tampilan mentor, admin, jadwal, detail dan ekspor memakai resolver mentor efektif.
- Pengelolaan kelompok memiliki **Ubah penugasan**, dengan dua opsi jelas: sementara/permanen, serta riwayat. **Ubah kelompok** hanya mengubah identitas/nama; tidak menjadi jalur penggantian mentor. Kelompok baru wajib memilih mentor tetap awal.
- Backup lokal sebelum migrasi revisi ini: `abc-school-prototype-v1-before-mentor-config-3` (backup revisi 1 lama tetap dipertahankan). Nama mentor lama dimigrasikan ke identitas dan snapshot tanpa mengubah catatan absensi atau mereset data. Batas akses admin tetap simulasi frontend, bukan otorisasi produksi.

## Jadwal pelayanan

Aturan Stage 5 di atas menggantikan pembatasan Jumat, keunikan sekolah/tanggal dan pembuatan pelayanan sementara oleh Mentor pada uraian prototipe lama berikut. Frekuensi Jumat tetap panduan reguler; pelayanan khusus hari lain tidak memenuhi target Jumat. Tidak ada sesi berulang otomatis.

- Frekuensi reguler: Pakel **2 Jumat**, Airlangga **1 Jumat**, Kertajaya **1 Jumat** per bulan; total **4 kunjungan**. Tidak ada penetapan pekan tetap, perulangan otomatis, atau pembuatan absensi untuk setiap Jumat.
- Admin memilih sekolah, tanggal Jumat dan kelompok terkait; dapat membuat atau mengubah jadwal. Form menolak tanggal non-Jumat dan duplikasi sekolah/tanggal. Perbandingan frekuensi per bulan ditampilkan sebagai panduan, bukan penghalang perubahan kebutuhan.
- Sekolah dan kelompok yang sudah memiliki batch absensi tidak dapat dipindah/dihapus dari pelayanan tersebut. Reschedule mempertahankan ID, siswa dan status; label tanggal batch/catatan mengikuti tanggal baru. Tanggal sebelumnya tersimpan pada `dateHistory`.
- Mentor menggunakan field kompak **Pilih Tanggal Pelayanan** yang membuka kalender dropdown, bukan kartu jadwal besar. Grid berbahasa Indonesia, pekan Senin–Minggu; tersedia navigasi bulan sebelumnya/berikutnya, pilihan bulan dan input tahun. Non-Jumat dinonaktifkan. Kalender dapat ditutup dengan pilih tanggal, tombol Tutup, Escape, atau klik di luar.
- Tanggal awal adalah hari ini jika Jumat, selain itu Jumat terakhir, dihitung dari jam perangkat dalam **Asia/Jakarta**. Semua Jumat lampau/mendatang dapat dipilih. Pergantian sekolah mengembalikan default tanggal dan mengosongkan kelompok; mengganti tanggal memuat sesi berdasarkan sekolah/tanggal, lalu batch berdasarkan Service Session ID/kelompok.
- Jumat tanpa jadwal memerlukan konfirmasi sebelum pembuatan satu pelayanan sementara **Menunggu Verifikasi Admin**. Batal tidak membuat sesi. Pemilihan ulang memakai ID pelayanan yang sama; pasangan sekolah/tanggal tetap unik. Ini status lokal, bukan pengiriman notifikasi kepada admin.
- Admin tetap dapat mengatur jadwal, reschedule, kelompok terkait, dan memverifikasi pelayanan sementara melalui **Ubah jadwal → Verifikasi & simpan jadwal**. Verifikasi mempertahankan ID dan semua hasil absensi. Pelayanan sementara belum dihitung sebagai jadwal reguler terverifikasi.
- Semua kelompok aktif sekolah tersedia pada langkah kelompok. Memilih tanggal tidak mengganti daftar kelompok rencana admin. Jika mentor mulai absensi kelompok tambahan, kelompok tersebut ditambahkan pada pelayanan yang sama agar laporan dan aturan reschedule tetap menyertakan catatannya.
- Jumat mendatang dapat dibuka dan disimpan sebagai draf. Tombol penyelesaian dinonaktifkan dan fungsi pengiriman memvalidasi ulang tanggal WIB, termasuk ketika konfirmasi dikirim. Penyelesaian tersedia mulai tanggal pelayanan; Jumat sebelumnya mendukung tinjauan dan koreksi seperti semula.
- Sekolah/kelompok terakhir diingat pada perangkat demo yang sudah diberi izin. Saat reload, sekolah dipulihkan ke langkah tanggal dan kelompok ditandai; mentor tetap memilih tanggal dan kelompok. Preferensi tidak memberikan autentikasi dan tidak melewati simulasi izin perangkat.
- Contoh fiktif eksplisit awal: Pakel **9 dan 23 Oktober 2026**, Airlangga **16 Oktober 2026**, Kertajaya **30 Oktober 2026**. Ini bukan jadwal nyata ABC. Contoh awal hanya menyertakan tiga kelompok beroster per sekolah; admin dapat menyertakan kelompok lain melalui form. Tanggal contoh tidak menjadi tanggal berjalan aplikasi; tanggal berjalan dan format memakai **Asia/Jakarta**.
- Absensi lama tanggal 7/14/21 Oktober tetap pada tanggal aslinya sebagai **arsip demo lama**, dapat difilter dalam riwayat/laporan, tidak muncul sebagai pilihan Jumat mentor dan tidak dihitung sebagai kunjungan reguler terjadwal. Tidak dipindahkan secara asumtif ke Jumat.

## Formulir siswa dan konteks absensi

- Mentor tetap mengikuti **sekolah → Jumat → kelompok → absensi**, tanpa langkah pemilihan mentor. **Tambahkan siswa sementara** menampilkan ringkasan sekolah, kelompok, mentor tetap dan tanggal pelayanan; bila ada pengganti sesi, ditampilkan sebagai informasi. **Nama Lengkap**, **Kelas Sekolah** dan **Jenis Kelamin** wajib diisi. Jenis Kelamin memiliki tepat dua radio: **Laki-laki** / **Perempuan**, tanpa pilihan awal atau inferensi nama. Tidak ada dropdown sekolah/kelompok atau field profil privat pada mentor.
- Sekolah, kelompok, ID batch, Service Session ID, tanggal dan mentor default berasal dari konteks aktif, bukan label atau preferensi perangkat. Konteks ditangkap ketika modal dibuka dan divalidasi ulang saat disimpan. Sekolah/kelompok tidak cocok, tanggal yang sudah berubah, atau sesi selesai ditolak.
- Admin **Tambah siswa terdaftar / Ubah data siswa** meminta **Nama Lengkap**, **Kelas Sekolah**, **Jenis Kelamin**, **Sekolah** dan **Kelompok Mentor**. Jenis Kelamin memakai dua radio tanpa pilihan awal pada siswa baru; saat edit menggunakan nilai yang sudah tersimpan. Kelas sekolah disimpan terpisah dari kelompok ABC. Konteks filter sekolah/kelompok eksplisit digunakan untuk prefill; edit menggunakan identitas siswa sendiri. Admin dapat mengubah kedua pilihan. Form global dimulai tanpa pilihan dan tidak mengambil konteks mentor yang tersembunyi.
- Pilihan kelompok hanya memuat kelompok sekolah terpilih. Mengubah sekolah mengosongkan kelompok sebelumnya, dan pasangan ID divalidasi kembali sebelum penyimpanan. Kelompok arsip hanya dapat dipertahankan ketika mengedit pendaftaran lama yang memang menggunakannya; tidak menjadi pilihan pendaftaran baru.
- **Tanggal Lahir**, **Nama Orang Tua/Wali** dan **Alamat Rumah** bersifat opsional pada form admin. Kosong disimpan sebagai **null**, dapat dilengkapi/dikosongkan saat edit. Tanggal lahir harus valid dan tidak di masa depan. Data siswa lama yang belum mempunyai kelas atau gender tetap **null** sampai admin melengkapinya; migrasi tidak menebak nilai. Data siswa menandai gender kosong untuk dilengkapi. Mengedit/menyimpan profil mewajibkan gender yang valid.
- Siswa sementara hanya ditambahkan pada batch asal dan berstatus **pending**. **Setujui** membuka form tinjauan pendaftaran admin, dengan nama/kelas dan sekolah/kelompok asal terisi. Sebelum membuat pendaftaran tetap, nama diperiksa terhadap siswa aktif maupun nonaktif pada sekolah tujuan, lintas kelompok; benturan memerlukan peninjauan admin dan tidak digabung otomatis. Nama sama yang sah membutuhkan pembeda pada prototipe.
- Persetujuan memakai ID siswa sementara yang sama dan menyimpan approvedStudentId. Status kehadiran, roster snapshot, konteks sesi asal dan timestamp absensi tidak diubah; pendaftaran tetap tersedia untuk batch baru. Menolak pengajuan juga mempertahankan kehadiran asal. Profil yang diedit tidak menulis ulang snapshot lama. Gender siswa sementara diteruskan ke pendaftaran tetap; perubahan admin yang eksplisit merupakan koreksi, bukan inferensi.
- Migrasi `studentSchemaRevision: 2` memperluas data tanpa mengubah ID siswa, sekolah/kelompok atau absensi. Kunci penyimpanan tetap; backup sebelum migrasi disimpan di `abc-school-prototype-v1-before-student-schema-2`. Perubahan penonaktifan memperbarui `active` dan `studentStatus` secara bersamaan.
- Field privat disimpan terpisah pada `studentPrivateProfiles`, hanya dirender oleh form admin. Data mentor menggunakan daftar field yang diizinkan: identitas, nama, kelas, sekolah/kelompok dan status; tanggal lahir, wali dan alamat tidak disalin ke objek/record absensi atau laporan mentor. **Ini pemisahan tampilan/payload prototipe, bukan keamanan akses:** seluruh data masih berada pada runtime/localStorage browser yang sama, dan dapat diperiksa lewat alat pengembang. Jangan menggunakan data anak nyata. Pembatasan akses server berada dalam roadmap v1.0.

## Entitas data

| Entitas | Atribut inti |
|---|---|
| Sekolah | id stabil, nama resmi, wilayah, aksen warna, frekuensi Jumat per bulan |
| Kelompok | id, sekolahId, nama; tidak menjadi penyimpan penugasan aktif |
| Mentor | id, nama; satu identitas per orang lintas sekolah |
| Penugasan tetap | id, kelompokId, mentorId, effectiveFrom, penanda baseline |
| Pengganti sesi | id, kelompokId, serviceSessionId, mentorId; satu baris aktif per kelompok/pelayanan |
| Snapshot penugasan | kelompokId, serviceSessionId, tanggal, mentorId, nama, sumber, assignmentId, capturedAt; versi lama dipertahankan |
| Riwayat perubahan admin | jenis, previous, next, changedAt |
| Siswa | id, nama lengkap (`name`), schoolClass, gender (`male`/`female`, null hanya untuk data lama belum lengkap), schoolId, groupId, studentStatus, active kompatibilitas |
| Profil privat siswa (admin) | studentId → dateOfBirth, guardianName, address; setiap nilai boleh null |
| Pelayanan | id stabil, sekolahId, tanggal, daftar kelompokId, penanda simulasi/arsip/provisional, dateHistory |
| Batch absensi kelompok | id stabil, serviceSessionId, tanggal, kelompokId, sekolahId, snapshot sekolah/kelompok/mentor, draf/selesai, waktu perubahan |
| Catatan kehadiran | sekolahId, serviceSessionId, serviceDate, kelompokId, siswaId, snapshot nama, status, penanda siswa sementara |
| Pengajuan siswa sementara | id stabil, name, schoolClass, gender, schoolId, groupId, sessionId, serviceSessionId, serviceDate, defaultMentorId, state/studentStatus |
| Otorisasi demo | flag perangkat lokal; sesi admin hanya di memori halaman |

## Asumsi teknis dan batasan

- HTML/CSS/JavaScript ES modules, tanpa dependensi frontend, font luar, Firebase, API produksi, QR, pembayaran, atau billing. Server Node hanya menyajikan aset lokal; tidak menyimpan data dan bukan backend aplikasi.
- `localStorage`, kunci `abc-school-prototype-v1`, hanya untuk browser/origin sama. Tidak terenkripsi, tidak memiliki backup cloud atau sinkronisasi, dapat hilang saat data browser dibersihkan. Backup lokal sebelum migrasi pelayanan: `abc-school-prototype-v1-before-service-config-1` bila penyimpanan tersedia. Mode privat/kuota dapat menggagalkan penyimpanan; ada peringatan.
- Tidak mendukung pengeditan bersamaan dari beberapa tab/perangkat. Pembukaan ulang pada perangkat berizin memulihkan sekolah terakhir ke langkah tanggal; data absensi dibuka kembali melalui tanggal dan kelompok.
- Manifest dan service worker menyediakan shell offline setelah cache berhasil. Memerlukan localhost atau HTTPS. Kemampuan instalasi bergantung browser; pemasangan Android fisik belum diverifikasi.
- Kode admin dan izin perangkat jelas diberi label simulasi, tidak memberikan keamanan nyata. Tidak boleh menggunakan data anak sungguhan.
- Dibangun dan ditinjau secara lokal. Tidak dipublikasikan.

## Kriteria penerimaan

- [x] Tiga sekolah dapat dipilih, masing-masing dengan kelompok dan roster fiktif.
- [x] Hadir sekali ketuk, perubahan ke Izin, pencarian, siswa sementara, dan progres bekerja.
- [x] Roster tidak lengkap menyebut jumlah belum diabsen sebelum konfirmasi Tidak Hadir; Batal mempertahankan draf.
- [x] Penyelesaian menampilkan konfirmasi; hasil sama muncul pada detail dan ringkasan admin.
- [x] Koreksi sesi selesai dapat dibuka dan diselesaikan ulang.
- [x] Admin memiliki akses demo terpisah, filter, riwayat, pengelolaan data dan penugasan mentor.
- [x] Ekspor menghasilkan paket XLSX dengan data fiktif dan penanda simulasi.
- [x] Data bertahan saat halaman dimuat ulang pada browser yang sama; batasannya dijelaskan.
- [x] Tampilan ponsel dan desktop ditinjau di browser; seluruh aset aplikasi tersedia lokal.
- [x] Kalender dropdown mendukung semua Jumat, navigasi bulan/tahun, default Jumat WIB, konfirmasi pelayanan sementara dan blokir pengiriman masa depan.
- [x] Dua Jumat Pakel tidak menimpa absensi; ID pelayanan menjadi referensi data dan ekspor.
- [x] Jadwal dapat dibuat/reschedule, menolak duplikat/non-Jumat dan menampilkan kelompok/status.
- [x] Semua kelompok memiliki satu default mentor; sementara/permanen dikelola admin dan tampil efektif per sesi.
- [x] Penugasan per tanggal dan riwayat dipertahankan; perubahan mentor tidak mengubah absensi siswa.

## Revisi konfigurasi kelompok dan logo

`group-config.js` revisi 2 menetapkan **16 kelompok aktif: 8 Pakel, 4 Airlangga, 4 Kertajaya**. `mentor-config.js` revisi 3 menyimpan pemetaan default terpisah dari kelompok. Kartu mentor menampilkan nama kelompok lebih besar/semibold, kemudian nama mentor lebih kecil/muted di baris berikutnya. Nama mentor menggunakan awalan **Kak** secara konsisten.

| Sekolah | Kelompok | Mentor default |
|---|---|---|
| SDN Pacarkeling V | Hosea | Kak Lupi |
| SDN Pacarkeling V | Amos | Kak Chriz |
| SDN Pacarkeling V | Obaja | Kak Yulius |
| SDN Pacarkeling V | Zefanya | Kak Gabby |
| SDN Pacarkeling V | Zakharia | Kak Eva |
| SDN Pacarkeling V | Hagai | Kak Louis |
| SDN Pacarkeling V | Yunus | Kak Akris |
| SDN Pacarkeling V | Yoel | Kak Devid |
| SDN Airlangga III | Amos | Kak Chriz |
| SDN Airlangga III | Zakharia | Kak Eva |
| SDN Airlangga III | Obaja | Kak Yulius |
| SDN Airlangga III | Zefanya | Kak Gabby |
| SDN Kertajaya IV | Zakharia | Kak Eva |
| SDN Kertajaya IV | Zefanya | Kak Gabby |
| SDN Kertajaya IV | Obaja | Kak Yulius |
| SDN Kertajaya IV | Amos | Kak Chriz |

ID g1–g15 yang masih dipakai dipertahankan. Koreksi konfigurasi Airlangga: g4 menjadi Amos, g15 menjadi Zefanya; roster tetap mengikuti ID aslinya. Kertajaya memperoleh g18 Amos dengan roster kosong. g16/g17 dari konfigurasi lama ditandai arsip, tidak dihapus: siswa dan relasinya tetap ada dan riwayat tetap dapat diperiksa admin. Kelompok tambahan buatan admin juga dipertahankan. Tidak ada siswa yang dipindahkan otomatis; seed baru tetap memiliki 96 siswa fiktif dan tujuh kelompok tanpa roster.

Kelompok bernama sama lintas sekolah memiliki ID berbeda. Direktori mentor yang boleh dipilih hanya delapan identitas otoritatif. Mentor contoh lama seperti Kak Raka tetap dapat dibaca pada riwayat tetapi tidak menjadi pilihan aktif; rencana/default/override yang memakai identitas di luar direktori dinonaktifkan mulai tanggal migrasi dengan `disabledFrom`, tanpa menghapus baris atau snapshot lampau. Default otoritatif menjadi fallback saat ini, sedangkan penugasan sah antar-delapan mentor dan fasilitas pengganti/permanen tetap tersedia. Nama alias mentor dinormalisasi ke Louis dan Chriz; penugasan, override, snapshot dan referensi audit memakai satu identitas kanonik per orang. Default contoh lama diganti ke pemetaan pengguna, sedangkan rencana khusus yang dibuat admin, override, riwayat, dan snapshot penugasan lampau dipertahankan. Karena itu riwayat dapat menampilkan mentor lama, sesuai penugasan saat itu.

Migrasi bersifat satu kali dan idempoten. Backup lokal revisi ini: `abc-school-prototype-v1-before-group-config-2` dan `abc-school-prototype-v1-before-mentor-config-3`. Kunci penyimpanan utama tetap. Catatan siswa, status, ID batch dan timestamp absensi tidak dihapus/reset. Benturan ID atau nama tetap menghentikan migrasi untuk ditinjau.

Logo asli disalin ke `assets/abc-movement-logo.png`, digunakan pada header/sidebar dan dibungkus dengan latar persegi untuk ikon PWA tanpa mengubah artwork sumber. Warna, layout, navigasi, dan alur absensi dipertahankan.

## Langkah pengembangan berikutnya

1. Validasi alur bersama mentor/admin menggunakan data fiktif, terutama aturan kelompok, koreksi, dan penanganan siswa pindahan.
2. Rancang perlindungan data anak, izin akses berbasis penugasan, otorisasi perangkat, retensi, serta jejak audit sebelum memakai data nyata.
3. Setelah fase prototipe disetujui: pilih backend, sinkronisasi dan konflik offline, pemulihan data, serta pengelolaan sesi. Belum dikerjakan pada fase ini.
4. Uji pada Android fisik: keterbacaan, target sentuh, instalasi, offline, dan kompatibilitas berkas XLSX dengan aplikasi tujuan.

## Admin: filter kelompok dan ulang tahun

- Kelompok & mentor tetap memiliki filter Sekolah (Semua Sekolah sebagai default) dan Kelompok Mentor yang mengikuti sekolah. Mengubah sekolah mereset kelompok; jumlah terfilter/total tampil di tabel. Menggunakan ID/record lama, tidak menduplikasi atau membuat ulang kelompok. Konfigurasi awal tetap 16 aktif (8/4/4); kelompok arsip tidak menjadi pilihan aktif. Aksi tambah, edit dan penugasan dipertahankan.
- **Ulang Tahun Siswa** merupakan halaman admin fungsional yang membaca `students` dan `studentPrivateProfiles`, tanpa database ulang tahun terpisah. Default siswa aktif, bulan berjalan WIB; tersedia 12 pilihan bulan, filter sekolah/kelompok terkait, urutan hari lahir, nama/tanggal lahir/sekolah/kelompok/usia saat ini, serta tautan edit profil.
- Bagian mendatang mencakup hari ini sampai **30 hari** ke depan, lintas bulan/tahun, mengikuti filter sekolah/kelompok tetapi tidak dibatasi bulan yang sedang dipilih. Menampilkan tanggal ulang tahun berikutnya, hari tersisa dan usia yang akan genap.
- Counter tanggal lahir belum lengkap menghitung siswa aktif sesuai filter sekolah/kelompok yang belum mempunyai tanggal lahir valid; nilai tetap null/kosong, tidak diisi otomatis. Empty state dibedakan untuk bulan terpilih dan 30 hari mendatang.
- Tanggal **29 Februari** diperingati pada **28 Februari** pada tahun nonkabisat, termasuk perhitungan usia. Tanggal lahir asli tidak berubah. Tanggal disimpan date-only ISO dan ditampilkan dengan format Indonesia. Halaman dan field privat tidak dirender pada mentor; otorisasi produksi di backend masih tertunda.

## XLSX: data sumber, cakupan dan impor siswa

- Pembuat XLSX yang sudah ada dipertahankan (OOXML/ZIP, tanpa dependensi baru). Ekspor membaca ulang data tersimpan, tidak memakai daftar placeholder atau cache tabel. Nama Unicode dan tanggal ISO disimpan sebagai nilai literal; tidak dievaluasi sebagai formula. Worksheet unduhan bernama **Data ABC**.
- Modal admin **Ekspor XLSX** memilih **Absensi**, **Siswa tanpa profil privat**, atau **Siswa termasuk profil privat (admin)**, serta **Semua data tersimpan** atau **Sesuai filter saat ini**. Jumlah dan cakupan ditampilkan sebelum unduh dan dicatat di workbook. Semua siswa termasuk nonaktif; ekspor terfilter memakai siswa aktif sesuai filter/pencarian. Dari halaman ulang tahun, ekspor siswa terfilter mengikuti bulan ulang tahun dan sekolah/kelompok.
- Ekspor siswa memuat ID/nama/sekolah/kelas/kelompok/mentor ditugaskan/gender/status serta ID sekolah/kelompok. Hanya pilihan profil privat yang menambahkan tanggal lahir/nama wali/alamat. Nilai kosong tetap sel kosong; mentor berasal dari resolver penugasan, tidak ditulis ulang dari file impor.
- Ekspor absensi mempertahankan ID sekolah/pelayanan/kelompok/siswa, tanggal, status siswa, status draf/selesai/belum dimulai, mentor efektif, kelas pada snapshot dan ID batch. Kelas historis yang belum dicatat tetap kosong; tidak ditebak dari kelas terkini. Metadata memisahkan jumlah catatan siswa dan baris kelompok kosong/belum dimulai.
- Sesuai klarifikasi pengguna, sebelumnya belum ada importer. Kini **Data siswa → Impor XLSX** membaca worksheet pertama dengan batas **20 MB / 5000 siswa / 50 kolom**, ZIP standar tidak terenkripsi, inline/shared strings dan DEFLATE. Hanya menerima nilai; formula harus disalin menjadi nilai di Excel. Memerlukan browser modern yang mendukung dekompresi native. CSV masih roadmap.
- Header acuan: **ID siswa** (opsional tetapi dianjurkan), **Nama lengkap**, **Sekolah** atau **ID sekolah**, **Kelas sekolah**, **Kelompok ABC** atau **ID kelompok**, **Jenis kelamin**. **Status siswa**, **Tanggal lahir**, **Nama orang tua/wali** dan **Alamat rumah** opsional. Variasi umum Nama/Kelas/Nama Sekolah/Kelompok Mentor/Tgl Lahir/Nama Wali/Alamat diterima. Jika ID dan label keduanya diisi, keduanya harus cocok. Simpan ID sebagai teks di Excel untuk mempertahankan nol di depan.
- Gender impor menerima label Laki-laki/Perempuan, nilai male/female, atau kode L/P yang eksplisit. Tidak menebak gender dari nama. Tanggal menerima YYYY-MM-DD, DD/MM/YYYY atau serial Excel 1900/1904, lalu divalidasi sebagai date-only; tanggal lahir kosong tetap null.
- Impor menampilkan jumlah baru/perbarui/tetap/bermasalah dan pratinjau nama/baris sebelum konfirmasi. Semua baris harus valid sebelum penyimpanan. Tidak membuat sekolah, kelompok, mentor atau absensi baru.
- ID siswa yang cocok diperbarui tanpa mengganti ID; tanpa ID hanya nama unik pada sekolah yang sama dapat dicocokkan. Nama ambigu/ID ganda/ID berbeda untuk nama yang sama/kelompok lintas sekolah ditolak untuk ditinjau. ID baru boleh dipertahankan dari sumber jika tidak berbenturan dengan siswa/pengajuan yang ada. Data lama yang diimpor ulang tanpa perubahan dilewati, termasuk null gender/kelas yang sudah ada; membuat atau mengubah profil tetap memerlukan gender/kelas.
- Kolom privat yang tidak disertakan tidak menghapus profil privat lama; kolom privat yang disertakan tetapi kosong merupakan pengosongan eksplisit menjadi null. Baris baru tanpa profil privat mendapat null. Impor ulang file yang sama tidak membuat siswa ganda.
- Konfirmasi memeriksa ulang apakah data berubah sejak pratinjau. Backup lokal terakhir sebelum impor: `abc-school-prototype-v1-before-student-import`. Penyimpanan harus berhasil sebelum UI menyatakan selesai; gagal validasi/kuota tidak mengganti data utama. Riwayat absensi dan penugasan mentor tidak ditulis ulang.

## Roadmap v1.0 — status

- **Sudah diimplementasikan pada prototipe:** Birthday Tracker admin, filter sekolah/kelompok, gender wajib pada form, penanda gender belum lengkap, ekspor siswa/absensi yang bersumber dari data tersimpan, serta impor XLSX dengan pratinjau dan pemeriksaan ID.
- **Belum diimplementasikan:** dashboard kelengkapan profil menyeluruh, impor CSV, sinkronisasi/konflik beberapa perangkat, akses admin/perangkat yang aman, pembatasan profil privat pada backend, audit/backup terpusat dan kebijakan retensi data anak.
- Akses admin masih flag frontend/kode demo; seluruh data ada dalam runtime/localStorage browser yang sama. Pemisahan UI/payload bukan keamanan produksi. Pengujian menggunakan data fiktif; format berkas data siswa asli pengguna belum diberikan. Tidak menambahkan backend, layanan berbayar, dependensi baru atau deployment.
