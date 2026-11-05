# Aturan pengembangan ABC Attendance

Acuan aturan bisnis: [MASTER_BRIEF.md](MASTER_BRIEF.md). Baca revisi terbaru [PROJECT_STATUS.md](PROJECT_STATUS.md) untuk status implementasi dan batasan; bagian riwayat bukan status terkini.

Rincian arsitektur dan roadmap perluasan MSA yang berstatus **PLANNED / NOT IMPLEMENTED** ada di [MSA_PRODUCT_VISION.md](MSA_PRODUCT_VISION.md); `MASTER_BRIEF.md` tetap acuan kebutuhan. Rencana tersebut bukan izin implementasi tahap berikutnya.

- Pertahankan arsitektur JavaScript ES modules/Node.js yang ada kecuali perubahan disetujui pengguna.
- Gunakan bahasa Indonesia untuk seluruh teks yang tampil kepada pengguna.
- Pertahankan ID sekolah, kelompok, mentor, siswa, dan sesi, termasuk ID pelayanan dan batch absensi; reschedule tidak mengganti ID.
- Jangan pernah menghapus atau menimpa catatan absensi historis. Koreksi harus mempertahankan versi sebelumnya dan jejak perubahan.
- Pertahankan mentor tetap per kelompok, pengganti per sesi, dan perubahan tetap bertanggal efektif yang hanya dikelola admin; jaga snapshot riwayat.
- Jalur Mentor legacy tidak memakai login pribadi. Pilot A2.3 memakai username/password akun fiktif yang ditinjau dan ditautkan; login tidak memberi izin perangkat atau absensi. Akses produksi wajib diotorisasi secara aman di server sesuai cakupan izin; flag perangkat dan kode demo bukan keamanan produksi.
- Informasi privat siswa (tanggal lahir, wali, alamat) hanya boleh diakses admin berwenang, termasuk melalui API dan ekspor. Pemisahan tampilan/localStorage bukan kontrol akses produksi.
- Gunakan hanya data fiktif dalam tes; jangan pernah memakai data pribadi anak nyata.
- Utamakan perubahan kode minimal dan terarah; hindari refaktor di luar lingkup.
- Jalankan tes yang relevan setelah perubahan kode; gunakan `npm.cmd run check` dan `npm.cmd test` sesuai lingkup. Jika npm tidak tersedia, jalankan skrip Node ekuivalen dan laporkan batas verifikasi.
- Catat kemajuan implementasi signifikan, hasil validasi, dan batasan yang tersisa di `docs/status/<tanggal>-<agen>-<tugas>.md` (template: `docs/status/_TEMPLATE.md`). `PROJECT_STATUS.md` diperbarui oleh integrator setelah integrasi yang diminta pengguna.
- Jangan deploy, mengaktifkan billing, commit, merge, atau push tanpa persetujuan pengguna. Persetujuan berlaku untuk sesi yang memberikannya.

## Penyuntingan teks dengan No AI Slop

- Aktifkan [No AI Slop](.agents/skills/no-ai-slop/SKILL.md) hanya jika pengguna meminta penyuntingan, pemolesan, atau audit konten tertulis, atau tugas utama berupa penulisan ulang substansial teks UI Indonesia atau petunjuk penggunaan nonteknis.
- Jangan aktifkan otomatis untuk coding/refaktor, backend/Firebase, autentikasi/keamanan, tes/debugging, pembaruan `PROJECT_STATUS.md`, ringkasan commit/laporan rutin, typo kecil, atau pembaruan dokumentasi teknis biasa.
- Pembagian acuan tetap: `MASTER_BRIEF.md` untuk kebutuhan aplikasi/aturan domain; `PROJECT_STATUS.md` untuk status terverifikasi/bukti tes; `README.md` untuk petunjuk operasional pemula; `AGENTS.md` untuk aturan kerja semua agen (Codex dan Claude); skill untuk mutu bahasa. Penyuntingan wajib menjaga akurasi teknis, sintaks, keamanan, privasi, integritas data dan hasil tes. Jangan menghilangkan istilah teknis/pesan kesalahan yang perlu persis atau mengarang capaian, jumlah tes, benchmark maupun detail implementasi.

## Pelaporan pengembangan rutin

Laporkan secara ringkas dalam bahasa Indonesia (isi lengkapnya ditulis ke berkas status tugas, lihat bagian kolaborasi): perubahan, tes yang benar-benar dijalankan beserta hasilnya (atau belum dijalankan), masalah penting yang tersisa, langkah berikutnya, serta usulan **Summary** dan **Description** siap salin untuk commit di GitHub Desktop. Laporan ini tidak otomatis mengaktifkan skill editorial; usulan commit tidak memberi izin commit, push, atau deploy.

## Arsitektur dan teknologi (fakta repositori)

- Frontend: HTML, CSS, dan ES modules vanilla; tanpa framework, bundler, CDN, atau build step. Tanpa dependensi npm baru kecuali disetujui pengguna.
- Server lokal: Node.js (`server.mjs`, `mentor-server.mjs`, `admin-server.mjs`, `local-*.mjs`) dengan `backend/`, Firebase Admin, `firestore.rules`, dan emulator lokal.
- Halaman aktif memakai `msa-*.html/js` serta `msa-shell.css`/`msa-visual.css`; halaman legacy (`admin.html`, `styles.css`; PWA lama sudah dihapus) di luar lingkup kecuali disebut eksplisit.
- Jangan berasumsi stack di luar ini. Baca kode sebelum menyarankan pola baru.

## Prinsip desain dan UX

- Mobile-first: rancang untuk 360 px lebih dulu, lalu 390/768/1365 px. Tanpa overflow horizontal; konten tidak tertutup navigasi, FAB, atau keyboard.
- Aksesibilitas: kontras WCAG AA, target sentuh ≥48 px, cincin fokus terlihat, label kolom selalu terlihat, status tidak hanya dengan warna (ikon + teks), hormati `prefers-reduced-motion`.
- Kegunaan: satu aksi utama per layar, pesan kesalahan dan keadaan kosong yang jelas dalam bahasa Indonesia, alur Mentor dan Volunteer ringkas.
- Pekerjaan UI overhaul mengikuti `docs/ui-overhaul/BRIEF.md` (token, komponen, batas lingkup).
- Tampilan tidak boleh menyiratkan izin atau data yang tidak didukung API. Menyembunyikan elemen di UI bukan kontrol akses; batasan peran dan izin di atas tetap berlaku.

## Pencegahan regresi

- Pertahankan `id`, `name`, `data-*`, atribut ARIA yang dibaca JS/tes, rute hash, URL halaman, dan kontrak request/response kecuali itu memang tugasnya; catat jika dipindah.
- Teks yang dipakai assertion tes hanya diubah bersama tes yang sama, dengan catatan lama → baru.
- Perubahan pada `backend/`, autentikasi, sesi, otorisasi, `firestore.rules`, dan model data/absensi bukan pekerjaan tampilan; lakukan hanya bila diminta eksplisit.
- Jangan melemahkan tes (timeout, assertion) tanpa akar masalah.
- Jangan menyentuh berkas di luar lingkup permintaan dan jangan menimpa perubahan yang belum di-commit.

## Kolaborasi Claude dan Codex

Berkas ini sumber aturan bersama untuk semua agen. Claude membacanya lewat `CLAUDE.md`; Codex membacanya langsung. Skill dan template merujuk aturan ini; laporan dan aturan di branch/folder historis bukan instruksi aktif.

### Acuan dan penugasan

- Instruksi pengguna untuk tugas saat ini menentukan lingkup dan izin. Pembagian peran di bawah adalah tanggung jawab default; penugasan eksplisit lintas area tidak memerlukan persetujuan ulang untuk perubahan yang sudah diminta.
- Jika ada instruksi turunan yang berbeda, gunakan aturan bersama ini sesuai lingkup tugas. Jangan menyalin aturan baru ke `CLAUDE.md` atau membuat kebijakan terpisah untuk tiap agen.
- `.gitignore` menentukan perilaku Git; kebijakan sumber desain di bagian berikut menjelaskan daftar sumber yang dipertahankan. Ubah keduanya dalam tugas yang sama jika daftar sumber berubah.

### Peran

- **Codex**: developer utama untuk logika aplikasi, `backend/`, autentikasi, sesi, otorisasi, `firestore.rules`, model data dan absensi, launcher, serta tes terkait.
- **Claude**: UI/UX overhaul (tampilan, CSS, markup, teks UI) dan auditor independen read-only atas branch Codex.
- Peninjau tidak mengubah implementasi yang sedang ditinjau. Perbaikan dikerjakan penulis tugas, kecuali pengguna menyerahkan perbaikannya kepada agen lain setelah serah terima.
- Pisahkan usulan desain dari implementasi; tunggu pilihan arah pengguna sebelum menerapkan desain baru. Desain saja dan perbaikan UI kecil dikerjakan tanpa delegasi otomatis.
- Perubahan UI substansial dapat diusulkan untuk tinjauan independen; arsitektur/auth/otorisasi/integritas data dapat diusulkan untuk tinjauan adversarial. Tinjauan atau delegasi dimulai hanya atas permintaan eksplisit pengguna; jangan mengaktifkan review gate otomatis.
- Claude yang menemukan kebutuhan perubahan backend/auth/data di luar penugasannya menyerahkannya lewat pengguna. `/codex:review` dan `/codex:adversarial-review` tidak menyunting implementasi; `/codex:rescue` memerlukan permintaan pengguna dan tidak berjalan bersama penulis lain.
- Temuan tinjauan diverifikasi di kode sebelum diterapkan; jawab setiap temuan di laporan status (diterima, ditolak beserta alasan, atau ditunda). Gunakan template tinjauan untuk severity, evidence, reproduksi, koreksi dan missing coverage.

### Workspace dan branch

- Satu workspace aktif untuk Claude dan Codex: `D:\Work\ABC Ministry Service App\abc-ministry-service-app`. Folder `MSA-claude`, `MSA-codex`, `MSA-codex-xlsx`, dan worktree bersarang adalah sumber historis; jangan dipakai untuk pekerjaan baru, dihapus, atau ditimpa.
- Jalankan `git rev-parse --show-toplevel`, `git branch --show-current`, dan `git status --short` sebelum menulis. Pastikan root sama dengan workspace aktif; jangan menimpa perubahan lokal milik tugas lain.
- Pertahankan branch aktif. Bekerja di `development` diizinkan untuk tugas pengguna di workspace ini; jangan membuat/berpindah branch, merge, rebase, reset, commit, atau push tanpa perintah eksplisit pengguna. Branch historis tetap dipertahankan.
- Hanya satu penulis aktif pada workspace bersama, termasuk penulisan laporan, perubahan konfigurasi oleh alat, dan operasi Git. Agen kedua membaca/meninjau tanpa menyimpan berkas atau menunggu serah terima. Penugasan baru tidak memberi izin menimpa penulis yang masih aktif.
- Sebelum serah terima, penulis menyampaikan baseline commit, lingkup/path tugas, perubahan lokal yang dipertahankan, hasil tes dan pekerjaan tersisa di laporan status. Agen penerima membaca ulang berkas dan diff saat ini sebelum menyunting; jangan menulis dari salinan/konteks sesi lama.
- Periksa isi terbaru sebelum setiap penyuntingan. Jika muncul perubahan tak dikenal atau penulis lain masih aktif, hentikan penulisan pada path tersebut dan koordinasikan; jangan overwrite, reset, stash atau menghapus perubahan agar terlihat bersih.
- Hook bersama memakai lock workspace otomatis per pasangan agen + `session_id`. Penulis kedua dan tool penulis paralel dalam sesi yang sama ditolak; sesi yang memegang lock boleh melanjutkan sampai giliran selesai. Shell diperlakukan sebagai calon penulis agar script tidak melewati koordinasi.
- Observasi hash di awal sesi dan setelah tool penulis sendiri dipakai untuk menolak perubahan berbasis versi lama. Jika ditolak karena versi berubah, ikuti helper `read` pada `.agents/skills/msa-coordination/SKILL.md`, baca hasilnya dan susun ulang edit; jangan mengganti ID atau mereset baseline agar lolos. Resume tidak menyegarkan baseline diam-diam.
- `PostToolUse`/kegagalan tool menyelesaikan reservasi tool; lock giliran dilepas pada `Stop`, atau setelah tool aktif selesai ketika sesi berakhir/diinterupsi. Tunggu tool yang masih berjalan; jangan meninggalkan penulis background. Setelah crash, pemulihan hanya oleh operator dengan token pemilik dan sesi/proses yang sudah dihentikan. Tidak ada pengambilalihan hanya berdasarkan umur lock.
- State lokal berada di `.agents/.runtime/` dan diabaikan Git; jangan menyuntingnya langsung. Hook harus aktif/trusted di kedua agent; tinjau definisi baru lewat `/hooks`. Lock ini bukan OS file lock dan tidak mencakup alat/manual edit yang melewati hook, mesin lain, atau network share. Kerja paralel tetap memerlukan pengaturan terpisah yang disetujui pengguna.

### Kepemilikan berkas

| Path | Penanggung jawab default |
|---|---|
| `backend/`, `*-server.mjs`, `local-*.mjs`, `firestore.rules`, kode autentikasi/sesi/otorisasi, model data dan absensi, launcher `.cmd`, tes untuk area ini | Codex |
| `ui/`, `msa-*.css`, `docs/ui-overhaul/`, markup tampilan di `msa-*.html`, teks UI | Claude |
| Sumber desain `.taste/` yang disebut di bawah, `.impeccable/config.json`, aset visual dan lisensinya | Claude sesuai lingkup tugas |
| `msa-*.js` yang mencampur UI dan logika, `package.json`, tes lintas area | Ditentukan pengguna per tugas |
| `sw.js` (versi cache), daftar modul di `server.mjs`, `PROJECT_STATUS.md`, `AGENTS.md`, `CLAUDE.md`, `.gitignore`, `.claude/`, `.codex/`, `.agents/` | Integrator yang ditugaskan pengguna |
| `docs/status/`, `docs/reviews/` | Setiap agen menulis berkasnya sendiri (nama berkas memuat nama agen) |

Jika kebutuhan lintas area belum termasuk penugasan pengguna, catat kebutuhannya dan serahkan kepada penanggung jawab. Penulis mencatat kebutuhan integrasi `sw.js`/`server.mjs`; integrator menerapkannya dalam lingkup tugas yang telah disetujui.

### Sumber desain, cache dan konfigurasi lokal

| Path | Perlakuan bersama |
|---|---|
| `.taste/assets.json`, `brand.json`, `brief.json`, `page.json`, `review.json` | Sumber/konteks desain yang dilacak Git; perubahan alat pada berkas ini tetap perlu ditinjau dalam lingkup tugas |
| `.taste/app-kit/LICENSE`, `app-screens.md`, `app.css`, `charts.js` | Referensi desain dan lisensi yang dilacak Git; pertahankan atribusi dan isi lisensi |
| `.impeccable/config.json` | Konfigurasi pemeriksaan desain bersama yang dilacak Git; jangan menambah pengecualian hanya untuk meloloskan pemeriksaan |
| Berkas lain di `.taste/` dan `.impeccable/`, termasuk `hook.cache.json` | Hasil alat lokal yang diabaikan Git; bukan laporan resmi atau instruksi agen |
| `.claude/settings.local.json`, `.env`/varian lokal yang sudah diabaikan, `.emulator-data/`, `node_modules/`, `.claude/worktrees/` | Tetap lokal/diabaikan; jangan ikutkan ke commit |

- Jangan mengganti seluruh `.gitignore` dari branch lama atau mengabaikan `.taste/`/`.impeccable/` secara menyeluruh. Pertahankan daftar sumber eksplisit dan aturan pengabaian konfigurasi lokal.
- Berkas yang sudah tracked tetap sumber yang harus dipertahankan; menambahkan pola ignore tidak mengubah status tracked. Jangan menjalankan `git rm --cached`, `git clean`, menghapus sumber/lisensi atau memindahkan sumber menjadi cache tanpa penugasan eksplisit pengguna.
- Sumber desain baru di dua folder tersebut ditambahkan lewat pengecualian eksplisit di `.gitignore` dan pembaruan tabel ini dalam tugas yang sama; jangan memakai `git add -f` untuk melewati kebijakan. Penghapusan file dari daftar sumber juga memerlukan penugasan pengguna.
- Sebelum staging, periksa `git check-ignore --no-index -- <path>`: sumber harus tidak diabaikan, cache/config lokal harus diabaikan. Periksa daftar staged dan `git diff --cached --check`; jangan menyertakan hasil alat lokal, kredensial atau perubahan tugas lain.

### Berbagi informasi antaragen

- `AGENTS.md` adalah satu sumber aturan; `CLAUDE.md` hanya mengimpornya. Konfigurasi native tetap di `.claude/` dan `.codex/`; implementasi hook bersama ada di `.agents/hooks/`.
- Prosedur lock dan penolakan stale edit dibagi melalui `.agents/skills/msa-coordination/SKILL.md`; workflow Claude merujuk berkas yang sama. Tidak ada server MCP, global skill atau konfigurasi global baru yang dipasang.
- Baca `git status --short`, `git diff`, dan laporan `docs/status/` sebelum melanjutkan tugas agen lain. Perubahan belum di-commit sudah terlihat di workspace yang sama; jangan menganggap branch historis sebagai pekerjaan aktif.
- Saat konsolidasi yang secara eksplisit diminta pengguna, integrator boleh menggabungkan path lintas area setelah backup, perbandingan dan serah terima; jangan mengaktifkan flag bypass hook secara permanen.
- Pengujian emulator/browser harus memakai namespace `test-*`, data fiktif, dan port terisolasi. Permintaan validasi aplikasi memberi izin menjalankan runner terisolasi yang sudah ada; di luar itu koordinasikan dengan pengguna. Jangan menghentikan proses atau mengambil alih port milik pihak lain.

### Siklus tugas

1. **Mulai:** periksa root, branch, status dan lingkup tugas; satu penulis aktif.
2. **Kerjakan:** pertahankan pekerjaan lokal dan kontrak aplikasi; perubahan minimal sesuai penugasan pengguna.
3. **Verifikasi:** jalankan tes relevan dan periksa diff. Pisahkan hasil langsung dari klaim laporan historis.
4. **Laporkan:** tulis `docs/status/<tanggal>-<agen>-<tugas>.md`, kontrak yang berubah, kebutuhan integrasi dan usulan Summary/Description. Tinjauan independen hanya bila diminta; laporan di `docs/reviews/` tidak memerlukan pergantian branch.
5. **Integrasi:** pada workspace ini, hanya atas permintaan pengguna; backup dahulu dan jangan melakukan operasi destruktif atau menyelesaikan konflik yang belum jelas tanpa persetujuan. Perbarui `PROJECT_STATUS.md` secara aditif; commit/push/merge/deploy tetap memerlukan izin eksplisit.

### Kontrak antaragen

Berkas status wajib memuat "Kontrak yang berubah", "Kebutuhan integrasi" dan "Serah terima". Agen penerima/peninjau membaca ketiganya sebelum membaca diff. Judul "Kebutuhan saat merge" pada laporan historis dibaca sebagai kebutuhan integrasi, bukan perintah merge.

### Catatan Beads

Skill Beads tersedia, tetapi repositori belum mengaktifkannya (tidak ada `.beads/`). Selama belum diaktifkan secara eksplisit oleh pengguna, gunakan laporan status dan serah terima di atas; jangan menjalankan `bd init`, `bd setup` atau meregistrasikan hook Beads. Jika kemudian diaktifkan, ikuti `.agents/skills/beads/SKILL.md` dan perbarui aturan bersama ini dalam tugas aktivasi yang sama.

<!-- codebase-memory-mcp:start -->
Untuk penelusuran struktur kode, gunakan skill `codebase-memory` dan indeks yang sudah ada. Jika tidak tersedia, laporkan batasnya lalu periksa sumber terkait; jangan re-index atau mengubah konfigurasi global otomatis.
<!-- codebase-memory-mcp:end -->
