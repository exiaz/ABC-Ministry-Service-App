# ABC | Ministry Service App — visi produk dan rencana arsitektur

**Tanggal:** 24 Oktober 2026. **Status seluruh perluasan MSA: PLANNED / NOT IMPLEMENTED.**

Dokumen ini berisi rencana, bukan izin implementasi atau perubahan schema. [MASTER_BRIEF.md](MASTER_BRIEF.md) tetap acuan kebutuhan; dokumen ini merinci arsitektur dan roadmap usulannya. [PROJECT_STATUS.md](PROJECT_STATUS.md) mencatat implementasi serta bukti pengujian. Stage 1–5 tetap berlaku; Stage 6 **Backup Mentor / Temporary Group Merge** dan Stage 7 **Testing, security, documentation** tidak diganti, diperluas, atau dijalankan oleh pekerjaan perencanaan ini.

## 1. Kondisi yang diperiksa

| Kondisi saat ini, bukan fitur MSA | Bukti kode yang diperiksa |
|---|---|
| JavaScript ES modules/Node.js; prototipe demo dan jalur Admin/Mentor emulator terpisah | [package.json](package.json), [admin-server.mjs](admin-server.mjs), [secure-admin.js](secure-admin.js) |
| Jadwal semua hari menggunakan `serviceSessionId`, sekolah dan kelompok; sesi bertanggal sama tetap berbeda; revisi, receipt dan audit melindungi perubahan | [backend/service-calendar.mjs](backend/service-calendar.mjs), [tests/emulator/flexible-calendar.test.mjs](tests/emulator/flexible-calendar.test.mjs) |
| Peran Superadmin/PIC serta izin pairing yang dibatasi server; izin `pairing:issue` saat ini juga dipakai untuk jadwal dalam cakupan kelompok operator | [backend/admin-accounts.mjs](backend/admin-accounts.mjs), [backend/service-calendar.mjs](backend/service-calendar.mjs) |
| Kode Stage 4 berlaku tepat 48 jam, sekali pakai; perangkat terikat kunci/proof dan scope, akses maksimal satu jam serta akhir tanggal pelayanan WIB | [backend/device-pairing.mjs](backend/device-pairing.mjs), [backend/firestore-emulator.mjs](backend/firestore-emulator.mjs) |
| Absensi memakai revisi, idempotensi, kunci transaksi per sesi dan riwayat versi; roster Mentor memakai proyeksi field terbatas | [backend/attendance.mjs](backend/attendance.mjs), [backend/roster.mjs](backend/roster.mjs) |
| Laporan dan XLSX demo tersedia; rekap/ekspor Admin server belum dimigrasikan | [reports.js](reports.js), [secure-admin.js](secure-admin.js), status Stage 5 |

Belum ditemukan modul organisasi/program, event umum, rundown, kehadiran relawan atau integrasi Google Sheets dalam aplikasi. `PROJECT.md` tidak ditemukan di root; tidak dibuat dokumen pengganti yang menduplikasi rencana ini. Angka tes Stage 5 yang sudah dicatat merupakan bukti historis implementasi, bukan pengujian baru dalam pekerjaan dokumentasi ini. Seluruh aplikasi masih lokal/emulator dan khusus data fiktif; bukan sistem produksi yang telah disahkan untuk data anak nyata.

## 2. Cakupan produk — PLANNED / NOT IMPLEMENTED

MSA menyatukan perencanaan, penugasan, pelaksanaan, dokumentasi dan evaluasi pelayanan. Contoh berikut adalah data konfigurasi, bukan kategori atau daftar organisasi yang ditanam dalam kode:

- **ABC Movement:** Goes to School, pelayanan Natal, pelayanan khusus seperti SD Elyon.
- **Yayasan Anak Bintang Cemerlang:** Pojok Ceria, Bangkit Indonesia seperti kegiatan di LPKA Blitar, dan kegiatan lain.

Penyelenggara adalah pihak pemilik/pengelola kegiatan; program adalah pengelompokan kegiatan yang opsional. Event pelayanan adalah kejadian konkret dengan ID sendiri. Mitra, tempat, PIC internal, PIC eksternal dan relawan mempunyai relasi terpisah; sebuah sekolah atau tempat tidak otomatis menjadi penyelenggara. Program boleh tidak dipilih. Kegiatan reguler, berulang, satu kali dan ad hoc dapat memakai model event yang sama.

MSA tidak otomatis menyatukan izin atau data kedua organisasi. Kepemilikan data, kerja sama lintas organisasi dan siapa yang boleh melihatnya perlu disetujui sebelum implementasi multi-organisasi. Evaluasi awal berupa catatan hasil/tindak lanjut berizin dan agregat sumber yang jelas; tidak mengarang skor dampak pelayanan.

## 3. Alur Buat Pelayanan Baru — PLANNED / NOT IMPLEMENTED

1. Pengguna yang sudah diotorisasi memilih **Buat Pelayanan Baru**. Server membatasi daftar penyelenggara sesuai keanggotaannya; pilihan atau klaim browser tidak memberi kewenangan baru.
2. Form awal hanya mewajibkan **penyelenggara, nama pelayanan, tanggal/waktu mulai, tempat, dan PIC internal**. Zona waktu terlihat jelas, dengan WIB sebagai default awal yang kompatibel. Waktu selesai/durasi acara dapat dilengkapi kemudian. Tempat dapat diisi sebagai label singkat agar tidak harus membuat katalog tempat terlebih dahulu; alamat rinci bukan syarat awal.
3. **Program boleh kosong** dengan pilihan Tanpa program. Mitra, PIC eksternal, relawan, peran, rundown, perulangan dan catatan juga opsional. Menyimpan pelayanan tanpa program tidak membuat program baru secara diam-diam.
4. Simpan sebagai draf ber-ID stabil setelah lima isian minimum valid. Membuka form, memilih tanggal atau menyimpan draf tidak membuat sesi absensi sekolah, kode aktivasi, penugasan relawan atau hak akses otomatis. Pengisian parsial sebelum minimum terpenuhi belum menjadi event tersimpan; kebutuhan autosave parsial masih keputusan terbuka.
5. Lengkapi detail nanti, periksa benturan sebagai informasi operasional, lalu publikasikan dengan izin yang sesuai. Publikasi jadwal dan publikasi rundown mempunyai versi/status terpisah; tidak semua kegiatan harus memiliki rundown.
6. Jadwal gabungan menampilkan event yang berhak dilihat pengguna, dengan filter penyelenggara/program, status dan rentang waktu. Dua event pada waktu/tanggal sama tetap berbeda. Pengeditan memakai revisi dan receipt idempotensi; reschedule tidak mengganti ID.

PIC internal adalah penanggung jawab event, bukan otomatis administrator aplikasi. PIC eksternal adalah kontak mitra dan tidak otomatis mendapat akun atau izin. Mengubah PIC memerlukan aturan server tersendiri, bukan mengganti scope melalui field form.

Perulangan disimpan sebagai aturan terpisah dari kejadian. Pembuatan kejadian harus melalui pratinjau rentang, pengecualian dan konfirmasi yang dibatasi, bukan menghasilkan tanggal tanpa batas. Setiap kejadian mempunyai ID sendiri. Edit satu kejadian atau kejadian mendatang harus dibedakan; riwayat kejadian lampau tidak ditulis ulang. Perulangan tidak menerbitkan kode/perangkat secara otomatis.

## 4. Arsitektur konseptual — PLANNED / NOT IMPLEMENTED

Usulan: pertahankan aplikasi JavaScript/Node.js dan pisahkan modul domain secara bertahap dalam aplikasi yang sama. Tidak ada usulan microservices, penggantian framework/database atau pemasangan dependensi pada tahap ini. Repository/adapter memisahkan model MSA dari kontrak absensi lama; kebutuhan penyimpanan fisik, index dan API harus dirancang serta disetujui pada tahap implementasinya.

```mermaid
flowchart TD
  O["Penyelenggara dan keanggotaan"] --> E["Event pelayanan"]
  P["Program opsional"] -.-> E
  S["Aturan perulangan opsional"] --> E
  E --> R["Versi rundown"]
  E --> V["Penugasan dan kehadiran relawan"]
  E --> H["Dokumentasi dan evaluasi berizin"]
  E --> L["Tautan opsional ke sesi absensi lama"]
  R --> Q["Antrean proyeksi Sheets satu arah"]
```

Nama di bawah adalah konsep, bukan koleksi/schema yang sudah dibuat atau kontrak API final.

| Konsep usulan | Identitas, relasi dan aturan utama |
|---|---|
| Penyelenggara (`organizations`) | ID stabil, nama dan status. Satu penyelenggara utama per event sebagai usulan awal; kerja sama tidak melebur tenant. |
| Keanggotaan/izin (`organizationMemberships`) | Identitas pengguna + organisasi + tindakan/cakupan + status/revisi. Organisasi terpilih pada UI bukan sumber otorisasi. |
| Program (`programs`) | Milik penyelenggara; nama/metode/template yang dikonfigurasi. `programId` pada event boleh kosong. |
| Event (`serviceEvents`) | ID stabil, penyelenggara, program opsional, nama, waktu/zona, tempat, PIC internal, status/revisi dan riwayat perubahan. Tidak mensyaratkan sekolah atau kelompok. |
| Seri (`recurrenceRules`) | Aturan/rentang/pengecualian serta relasi ke kejadian yang sudah dimaterialisasi. Bukan pengganti ID event. |
| Mitra/tempat/kontak | Mitra, venue dan kontak PIC eksternal dipisahkan. Label tempat dapat di-snapshot pada event; detail kontak/lokasi sensitif dibatasi. |
| Referensi absensi lama (`eventAttendanceLinks`) | Tautan event ke namespace dan `serviceSessionId` lama. Satu sesi lama paling banyak dipetakan ke satu event kanonik; event umum dapat memiliki nol atau beberapa tautan yang disetujui. |
| Profil relawan (`volunteerProfiles`) | Profil minimal per organisasi; akun login opsional/terpisah. Hubungan dengan `mentorId` lama harus melalui pemetaan terverifikasi, bukan kesamaan nama. |
| Penugasan/peran (`serviceAssignments`) | Event + relawan + satu/beberapa peran + status penugasan. Dapat direncanakan sebelum kehadiran diketahui. |
| Kehadiran relawan (`volunteerAttendance`) | Satu catatan per event dan relawan, dengan revisi/audit. Tidak memakai koleksi kehadiran anak. |
| Template dan versi rundown | Template dapat berlaku per program/metode; setiap versi mempunyai provenance dan lingkup akses. |
| Rundown event dan versi | Salinan kerja event, sumber versi template opsional, urutan aktivitas tersimpan, draf/publikasi dan revisi. |
| Dokumen/evaluasi pelayanan | Referensi berkas, izin, catatan hasil dan tindak lanjut; akses media tidak diasumsikan publik. |
| Koneksi/job sinkronisasi | Organisasi, target file/tab, versi proyeksi, status, checksum, retry/audit; rahasia koneksi dipisahkan dari data domain. |

Semua entitas baru yang berada dalam organisasi harus divalidasi server terhadap organisasi dan relasi induknya. Namespace emulator yang sekarang ada bukan tenant organisasi dan tidak cukup menjadi kontrol akses MSA. Identitas sekolah, kelompok, mentor, siswa, batch, pelayanan dan catatan lama tidak diubah menjadi ID organisasi/program.

### Jembatan ke Stage 1–5

- Modul absensi Goes to School tetap memakai sekolah, kelompok, mentor tetap, `serviceSessionId`, batch/record, snapshot serta jejak koreksi yang sudah ada. Jangan menggabungkan batch hanya karena tanggal/event sama.
- Pada awal adopsi, pemetaan event ke sesi lama dibuat eksplisit dan dapat dimulai satu banding satu. Tidak setiap event MSA mempunyai absensi anak. Pemetaan lebih dari satu sesi memerlukan aturan agregasi yang jelas agar satu pelayanan tidak dihitung berulang.
- Event baru yang membutuhkan absensi sekolah harus melewati adapter dan otorisasi lama, bukan membuat atau mengubah dokumen absensi dari form umum. Edit tanggal parent tidak boleh diam-diam memindahkan sesi lama atau mempertahankan kode yang semestinya ditolak.
- Waktu event diusulkan disimpan sebagai waktu mulai yang dapat dinormalisasi beserta zona IANA; tanggal lokal diturunkan secara konsisten. Kontrak sesi lama tetap date-only WIB. Batas kode 48 jam serta akses satu jam/akhir hari WIB tidak diinterpretasikan ulang dari waktu acara tanpa persetujuan perubahan kontrak.
- Mentor tetap tidak memerlukan login pribadi. Kehadiran profil relawan MSA bukan alasan mencabut/membuat ulang mentor, mengganti default mentor, atau membuka scope baru. Alur Backup Mentor/Temporary Group Merge tetap menjadi pekerjaan Stage 6 asli.

## 5. Rundown Builder dan BibleMax — PLANNED / NOT IMPLEMENTED

**BibleMax adalah metodologi pelayanan anak yang terintegrasi. Dalam Goes to School, rundown BibleMax mewakili penerapan metodologi tersebut secara utuh; BibleMax bukan subbagian yang ditempelkan pada rundown generik.** Program lain dapat menggunakan metode rundown berbeda.

Template BibleMax adalah titik awal yang fleksibel. Pilihan aktivitas, urutan dan durasinya boleh berubah sesuai tujuan serta kebutuhan pelayanan. Dokumen ini tidak menetapkan tahapan internal, daftar aktivitas wajib, urutan baku atau durasi standar BibleMax. Isi template pertama harus berasal dari materi yang disetujui pemilik metodologi, bukan disimpulkan dari satu contoh Sheets.

Alur editor: pilih template atau mulai kosong → salin versi ke event → tambah/hapus/pindah aktivitas → atur waktu/durasi/PIC/catatan → simpan draf → tinjau → publikasikan versi → bagikan tampilan baca-saja. Menyimpan rundown sebagai template baru merupakan tindakan terpisah dengan pemeriksaan akses dan sanitasi data event.

Istilah sesi/aktivitas pada rundown adalah unit isi acara, bukan `serviceSessionId` pada domain absensi sekolah. Memindahkan aktivitas tidak membuat atau memindahkan sesi absensi.

Usulan aturan penyimpanan:

- Aktivitas mempunyai ID stabil. Urutan kanonik disimpan terpisah sebagai daftar ID berurutan, bukan dihitung kembali dari nama, waktu, tipe atau posisi awal template. Setiap aktivitas harus muncul tepat sekali dalam urutan; perubahan item dan urutan disimpan atomik pada revisi yang sama.
- Reload dan pembukaan perangkat lain harus mempertahankan hasil reorder. Pengubahan bersamaan memakai expectedRevision; konflik tidak diselesaikan dengan menimpa seluruh rundown terbaru. PIC/catatan aktivitas boleh belum diisi dan tetap tampak belum ditentukan, tanpa mengarang nama penanggung jawab.
- Waktu/durasi dapat disesuaikan per aktivitas. Tampilan menunjukkan total/estimasi selesai dan benturan; pengubahan satu durasi tidak diam-diam mengubah waktu event atau aturan akses perangkat.
- Rundown event merupakan salinan dengan provenance versi template, bukan referensi hidup ke isi template. Edit event tidak mengubah template asli. Update template hanya berlaku untuk pemakaian baru kecuali pengguna memilih menerapkan perubahan melalui pratinjau.
- Versi publikasi dibekukan. Revisi berikutnya menjadi draf baru dan tidak membocorkan perubahan belum dipublikasikan. Tampilan baca-saja awal diusulkan memerlukan otorisasi dan menunjuk versi publikasi tertentu; tautan tamu/versi terbaru memerlukan keputusan izin tersendiri.
- Template yang berasal dari rundown lama tidak otomatis membawa nomor kontak, relawan, lokasi rinci atau catatan privat ke event lain. Penghapusan aktivitas pada draf baru tidak menghapus versi publikasi/riwayat terdahulu.

Uji penerimaan kelak harus mencakup template BibleMax tanpa urutan wajib, reorder-save-reload, urutan yang sama di Sheets, konflik dua editor, isolasi event/template dan tidak bocornya draf melalui pembagian baca-saja.

## 6. Relawan dan sejarah pelayanan — PLANNED / NOT IMPLEMENTED

Pisahkan **ditugaskan** dari **hadir**. Seorang relawan dapat menjadi PIC dan pemimpin dua aktivitas tetapi tetap dihitung satu orang hadir pada event yang sama. Sumber hitungan kehadiran adalah catatan unik `(eventId, volunteerId)`; jumlah peran/penugasan adalah ukuran berbeda dan harus diberi label.

Profil minimal, penugasan, konfirmasi kesiapan, kehadiran aktual dan riwayat partisipasi merupakan modul terpisah. Pembatalan penugasan tidak menghapus sejarah kehadiran. Koreksi kehadiran membutuhkan pelaku, alasan dan versi sebelumnya. Kehadiran anak tetap berada di domain absensi lama, tidak digabung dengan daftar relawan.

Identitas relawan pada dua organisasi tidak digabung berdasarkan nama/email/telepon secara otomatis. Riwayat awal diusulkan terbatas per organisasi; pelaporan lintas organisasi dan pemetaan identitas bersama memerlukan izin serta keputusan tata kelola. Status penugasan yang belum dikonfirmasi tidak boleh menjadi Hadir/Tidak hadir secara otomatis.

## 7. Batas izin dan privasi — PLANNED / NOT IMPLEMENTED

Usulan tindakan MSA dipisahkan, misalnya membuat/mengedit/publikasi event, mengedit/publikasi rundown, mengelola relawan, mencatat kehadiran dan menghubungkan Sheets. Nama serta matriks izin final belum disahkan. Jangan memperluas `pairing:issue` lama menjadi hak membuat semua program/event/organisasi.

| Batas yang direncanakan | Perlakuan yang diusulkan |
|---|---|
| Admin platform, admin organisasi, PIC event, editor rundown, pembaca | Pisahkan kemampuan teknis, pengelolaan organisasi dan isi kegiatan. Admin platform bukan otomatis pembaca semua data sensitif lintas organisasi; pemetaan terhadap Superadmin lama harus disetujui. |
| Pengguna/PIC internal | Keanggotaan aktif dan izin tindakan/cakupan diperiksa ulang server untuk setiap request serta saat commit. Menjadi PIC event atau mempunyai profil relawan tidak otomatis memberi hak admin. |
| Kontak PIC eksternal/mitra | Field operasional terbatas; tidak otomatis menjadi akun, anggota organisasi atau penerima data anak. |
| Anak dan profil privat | Tetap hanya untuk admin berwenang, termasuk API, ekspor dan job integrasi. Rundown/Sheets tidak membawa roster/profil anak secara default. |
| Relawan dan lokasi sensitif | Kontak pribadi, lokasi rinci, catatan pendampingan dan media dibatasi per kebutuhan; kalender gabungan cukup memakai label tempat yang disetujui. |
| Pembagian rundown | Baca-saja bukan publik otomatis. Proyeksi yang dibagikan memisahkan konten pelayanan dari catatan privat; izin/revokasi berlaku pada server, bukan tombol tersembunyi atau tab browser. |

Setiap lintasan baru memerlukan validasi relasi organisasi/program/event, allowlist field, audit minimal tanpa rahasia, penolakan lintas organisasi, dan idempotensi untuk mutasi penting. Rahasia OAuth/credential tidak berada dalam localStorage, log, URL, dokumen domain atau Sheets. Kebijakan persetujuan dokumentasi, retensi, akses mitra dan penanganan insiden perlu ditetapkan pemilik data sebelum memakai data nyata. Ini persyaratan desain, bukan klaim kepatuhan atau kesiapan produksi.

## 8. Google Sheets — PLANNED / NOT IMPLEMENTED

### Kesesuaian dengan alur yang ada

Kode saat ini menghasilkan/membaca XLSX; ekspor XLSX bukan sinkronisasi Sheets. Tidak ada connector, OAuth Google, worker atau mapping file/tab MSA yang sudah diimplementasikan.

Catatan pekerjaan sebelumnya menyebut penggunaan tab rundown Goes to School yang diduplikasi dari template, dengan format/merge dipertahankan dan PIC yang belum diputuskan dibiarkan kosong. Catatan tersebut bersifat historis, **belum diverifikasi ulang terhadap workbook aktif** dalam pekerjaan ini. Tidak ada workbook/tab/range operasional yang dibuka atau diubah; struktur dan kepemilikan target harus dikonfirmasi kembali sebelum implementasi. Contoh itu bukan definisi urutan wajib BibleMax dan ID file/tab lama tidak ditanam dalam aplikasi.

Usulan awal: **MSA menjadi sumber utama event/rundown baru; sinkronisasi MSA → Sheets satu arah, bertahap, dan hanya ke target yang disetujui.** Workbook historis tetap menjadi arsip yang tidak ditimpa. Mulai dengan proyeksi versi rundown yang dipublikasikan ke tab baru dari template yang disetujui atau area khusus keluaran MSA. Draf internal tidak dikirim otomatis. Pemilihan file, tab dan area tulis harus eksplisit; tidak mengambil alih semua tab atau formula yang ada.

| Sumber MSA usulan | Proyeksi Sheets | Pengaman |
|---|---|---|
| ID penyelenggara/program/event, nama pelayanan | Metadata/header yang disetujui; program boleh kosong | Nama organisasi bukan kunci; tidak membuat program dari nama tab |
| Waktu mulai, zona, label tempat | Header waktu/tempat minimal | Format lokal jelas; lokasi rinci hanya bila diizinkan |
| ID rundown/versi, ID aktivitas, urutan kanonik | Identitas proyeksi + baris mengikuti urutan tersimpan | Nomor baris/nama tab bukan ID aktivitas |
| Nama aktivitas, durasi/waktu, PIC, catatan yang boleh dibagikan | Kolom sesuai mapping template | Penugasan belum ada tetap kosong; catatan privat tidak ikut |
| ID job/checksum/versi ekspor | Metadata operasional minimal | Tidak menyimpan token, profil anak atau rahasia |

Gunakan identitas file/tab dan mapping range berversi, disertai ID event/aktivitas di metadata atau area khusus bila template mendukung. Google menyediakan developer metadata untuk mengikat lokasi ke data aplikasi, tetapi metadata bukan tempat rahasia atau kontrol akses. [Dokumentasi metadata Sheets](https://developers.google.com/workspace/sheets/api/guides/metadata).

### Otorisasi dan kepemilikan

Koneksi harus disetujui pengelola organisasi dan pemilik file; identitas integrasi berbeda dari kode perangkat Mentor. Utamakan scope sesempit mungkin untuk file yang dipilih, dengan `drive.file` sebagai kandidat yang harus diuji pada skenario file/template yang disetujui. Google menyatakan scope Sheets berlaku untuk satu file spreadsheet, tidak dapat dibatasi ke satu tab. Karena itu tab terpisah tidak memberikan isolasi privasi; file keluaran terpisah yang disanitasi mungkin diperlukan. [Scope resmi Sheets API](https://developers.google.com/workspace/sheets/api/scopes).

Model OAuth pengguna versus identitas layanan, kepemilikan file bersama, penyimpanan/rotasi/revokasi token dan lingkungan worker belum diputuskan. Jangan menambah credential cloud atau mengubah batas loopback emulator saat ini agar integrasi tampak tersedia. Integrasi berjalan hanya setelah prasyarat serta izin terpisah disetujui; koneksi dicabut harus menghentikan job berikutnya.

### Status, retry dan konflik

- Saat publikasi disimpan, catat intent/outbox secara atomik bersama versi sumber dalam desain yang dipilih. Job usulan menyimpan organisasi, event/versi, target/mapping, checksum, jumlah percobaan dan hasil aman. Status yang diusulkan: menunggu, berjalan, tersinkron, konflik, gagal/perlu tindakan, atau koneksi dicabut.
- Tidak ada transaksi tunggal lintas database MSA dan Sheets. Gunakan kunci job stabil per target/versi, pemeriksaan hasil dan read-back agar retry setelah timeout tidak menggandakan tab/baris. Jangan menjanjikan exactly-once dari API provider. Job versi lama tidak boleh menimpa proyeksi versi lebih baru; serialisasi pekerjaan per target dan periksa versi sumber terakhir.
- Bedakan kegagalan sementara dari izin dicabut/mapping berubah. Retry dibatasi dengan exponential backoff dan jitter; status gagal tetap terlihat dan dapat diulang secara eksplisit. Google mendokumentasikan kuota dan truncated exponential backoff, sehingga budget perlu disesuaikan saat implementasi, bukan diasumsikan tanpa batas. [Batas penggunaan Sheets API](https://developers.google.com/workspace/sheets/api/limits).
- Sebelum menulis ulang area keluaran, bandingkan checksum/struktur terhadap hasil sinkron terakhir. Perubahan manual pada area itu menjadi konflik yang memerlukan pratinjau/persetujuan; tidak otomatis ditimpa atau ditarik menjadi data MSA. Jangan memakai last-write-wins lintas sistem.
- Pertahankan merge, formula dan area template di luar mapping. Teks pengguna diperlakukan sebagai data, bukan formula yang dieksekusi. Read-back memeriksa urutan, jumlah aktivitas, waktu, PIC kosong dan versi sebelum menyatakan berhasil.
- Sinkronisasi dua arah tetap rencana lanjutan: membutuhkan kepemilikan per field, pemetaan ID stabil, deteksi hapus/reorder, three-way merge terhadap versi dasar, dan penyelesaian konflik berizin. Jangan mengaktifkannya sebagai efek samping retry satu arah.

## 9. UX dan merek — PLANNED / NOT IMPLEMENTED

Nama tampilan direncanakan **ABC | Ministry Service App**, menggunakan logo ABC asli dan pemisah vertikal sebagai elemen tata letak. Tidak mengganti asset, manifest, cache, domain atau nama paket saat ini. Penyesuaian merek/PWA dipisahkan dari migrasi data dan baru dilaksanakan pada tahap yang disetujui.

Navigasi usulan: dashboard, jadwal, **Buat Pelayanan Baru**, program/penyelenggara, rundown dan relawan sesuai izin; modul absensi Goes to School tetap mempunyai pintu masuk yang jelas. Identitas penyelenggara/program tampak pada kartu/detail; kegiatan tanpa program diberi label yang wajar, bukan dianggap data rusak. Dashboard menampilkan tugas/jadwal/status yang benar-benar tersedia dan berizin, bukan grafik contoh seolah data operasional.

Utamakan satu kolom pada ponsel, tombol simpan/status yang jelas, input opsional yang dapat dibuka bertahap, serta daftar/tabel yang layak di desktop. Editor rundown menyediakan drag-and-drop dan tombol Naik/Turun yang dapat dipakai tanpa drag, indikator perubahan belum tersimpan, pratinjau publikasi dan penanganan konflik. Mengadopsi pola umum PWA membership diperbolehkan sebagai inspirasi kegunaan; tidak menyalin desain, asset atau identitas BP. Referensi visual BP yang spesifik belum diberikan dan tidak perlu ditebak untuk rencana ini.

## 10. Migrasi bertahap — PLANNED / NOT IMPLEMENTED

1. Inventarisasi ulang kontrak, gap server/demo dan bukti Stage 1–5; selesaikan Stage 6–7 asli sebelum memulai implementasi MSA. Tetapkan pemilik data, matriks izin, definisi event dan persetujuan organisasi.
2. Tambahkan fondasi MSA secara additive melalui modul/adapter di masa depan, dengan fitur belum aktif secara default dan jalur legacy tetap tersedia. Uji data fiktif; tidak langsung backfill semua record atau mengubah root/namespace.
3. Buat pemetaan organisasi/program/event untuk data lama melalui pratinjau dan persetujuan. Jangan mengasumsikan setiap sekolah adalah organisasi, atau setiap sesi harus mempunyai program. Pemetaan diulang secara idempoten dengan kunci unik; ID absensi lama tetap sama. Nilai yang belum diketahui tetap belum dipetakan, bukan ditebak dari nama/tanggal.
4. Setiap batch migrasi kelak memerlukan snapshot yang diverifikasi, dry-run, rekonsiliasi jumlah/relasi/revisi dan laporan perubahan; simpan provenance serta catatan sebelum/sesudah. Perubahan penugasan atau penggabungan kelompok bukan pekerjaan migrasi MSA ini.
5. Uji rollback pada data fiktif. Utamakan menonaktifkan adapter/fitur baru tanpa menghapus data MSA atau memulihkan ulang seluruh namespace. Restore snapshot lama dapat menghidupkan izin yang telah dicabut; peninjauan/revokasi ulang tetap diperlukan. Jangan memakai rollback untuk membuka kembali credential lama secara otomatis.
6. Aktifkan modul per organisasi setelah gate fungsional, keamanan, privasi dan operasi lulus. Cutover tidak dianggap selesai hanya karena UI sudah memakai nama MSA; tidak ada deployment yang diizinkan oleh dokumen ini.

## 11. Prioritas dan tahap — PLANNED / NOT IMPLEMENTED

Nomor tahap berikut merupakan usulan setelah roadmap asli, bukan penggantian Stage 6–7. Setiap tahap implementasi memerlukan lingkup dan persetujuan tersendiri.

| Urutan/prioritas | Lingkup | Gate sebelum lanjut |
|---|---|---|
| P0, sebelum/sambil persiapan Stage 6 | Stabilkan Stage 1–5, inventarisasi keterbatasan dan validasi regresi | Tidak mengklaim tes lama sebagai tes baru; gap server/demo diketahui |
| **Stage 6 asli** | **Backup Mentor / Temporary Group Merge** | Scope asli dijaga; izin sementara, identitas dan riwayat tidak rusak; tidak dimulai dalam rencana ini |
| **Stage 7 asli** | **Testing, security, documentation** | Regresi Stage 1–6, keamanan dan petunjuk operasi sesuai lingkup yang disetujui; bukan sertifikasi produksi otomatis |
| Stage 8 usulan, P1 | Fondasi MSA: organisasi, program opsional, keanggotaan/izin dan adapter legacy | Kepemilikan data, pemetaan ID serta uji penolakan lintas organisasi disetujui |
| Stage 9 usulan, P1 | Buat Pelayanan Baru, draf/publikasi, jadwal gabungan, perulangan terbatas, dashboard/navigasi/merek | Lima isian minimum; tanpa program tetap bekerja; pemilihan tanggal tidak memberi akses absensi |
| Stage 10 usulan, P2 | Rundown Builder, versi/template, BibleMax fleksibel dan pembagian baca-saja | Reorder persisten, template terisolasi, izin publikasi/draf benar; isi metode disetujui |
| Stage 11 usulan, P2 | Sheets satu arah untuk proyeksi event/rundown baru | Mapping/owner/OAuth siap; read-back, retry, konflik dan revokasi teruji |
| Stage 12 usulan, P2 | Profil/penugasan/kehadiran/riwayat/laporan relawan | Penugasan berbeda dari hadir; satu orang tidak dihitung berulang karena banyak peran |
| Stage 13 usulan, P3 | Alur Natal khusus dan kebutuhan lanjutan yang terbukti, termasuk kajian sinkron dua arah | Kebutuhan nyata dan kebijakan konflik/privasi disetujui; bukan target implementasi mendesak |

Fondasi identitas relawan minimal dapat dipakai modul sebelumnya setelah keputusan desain, tetapi bukan alasan mempercepat seluruh Volunteer Management atau menunda alur event sederhana. Tidak ada estimasi tanggal, anggaran, deployment atau komitmen implementasi yang ditetapkan di sini.

## 12. Risiko, dependensi dan keputusan terbuka

Seluruh mitigasi berikut **PLANNED / NOT IMPLEMENTED**; keputusan ini tidak menghalangi penyelesaian dokumen, tetapi dapat menghalangi tahap implementasi terkait.

| Keputusan/risiko | Usulan awal dan pihak yang perlu menyetujui |
|---|---|
| Hubungan ABC Movement dan yayasan; kepemilikan/kerja sama lintas organisasi | Pisahkan batas data secara default; pemilik organisasi menetapkan akses bersama dan siapa yang boleh mengelola organisasi |
| Pemetaan Superadmin/PIC lama ke peran MSA | Pertahankan izin lama; pemilik aplikasi menyetujui tindakan baru dan cakupannya, tanpa kenaikan hak otomatis |
| Satu event terkait beberapa sesi sekolah | Awali pemetaan sederhana; admin domain menetapkan kardinalitas dan cara hitung event/partisipasi agar tidak berulang |
| Jam/zona, durasi dan perulangan | WIB default, waktu selesai opsional, kejadian eksplisit/rentang terbatas; penanggung jawab operasional menyetujui aturan konflik dan edit seri |
| Minimum draf dan publikasi | Lima isian awal tetap minimum; kebutuhan autosave parsial atau persetujuan publikasi tambahan diputuskan pemilik produk |
| Materi/template BibleMax dan metode program lain | Pemilik metodologi menyediakan contoh/versi yang boleh dipakai; tidak menyimpulkan tahapan dari nama metode atau urutan contoh |
| Workbook Sheets aktif, layout, formula, pemilik dan tab keluaran | Konfirmasi ulang dengan pemilik file sebelum mapping; catatan kerja lama belum membuktikan kompatibilitas workbook sekarang |
| OAuth, identitas worker, secret storage dan akses jaringan | Keputusan arsitektur/operasi terpisah; connector cloud tidak boleh membypass safeguard emulator lokal |
| Benturan edit MSA/Sheets, reorder atau penghapusan | Proyeksi satu arah ber-checksum; konflik ditinjau manusia. Bidir menunggu kebijakan per-field dan versi dasar |
| Identitas relawan lintas organisasi dan laporan agregat | Jangan merge otomatis; pemilik data memutuskan izin pemetaan identitas dan unit hitungan |
| Media anak, kontak relawan/mitra dan lokasi sensitif | Persetujuan, proyeksi minimal, akses, retensi dan prosedur insiden ditetapkan pemilik data sebelum data nyata |
| Tautan tamu baca-saja | Mulai dengan pembaca terotorisasi; guest link, masa berlaku, pencabutan dan field publik memerlukan persetujuan |
| Gap rekap/ekspor server dan skala izin/jadwal saat ini | Masuk inventaris P0; jangan menganggap tab placeholder, batas lokal 256 tuple atau XLSX demo sudah menjadi backend MSA yang skalabel |

Rencana dinilai konsisten bila kebutuhan MSA, fleksibilitas BibleMax, pemetaan legacy, batas izin, kebijakan sinkron awal serta keputusan terbuka tercatat tanpa menyatakan fitur telah dibuat. Verifikasi implementasi, migrasi dan penerimaan fitur baru adalah pekerjaan tahap berikutnya; pekerjaan sekarang berhenti pada dokumentasi.
