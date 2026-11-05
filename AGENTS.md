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
- Halaman aktif memakai `msa-*.html/js` serta `msa-shell.css`/`msa-visual.css`; halaman legacy (`index.html`, `admin.html`, `mentor.html`, `a1.html`, `styles.css`) di luar lingkup kecuali disebut eksplisit.
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

Berkas ini sumber aturan bersama untuk semua agen. Claude membacanya lewat `CLAUDE.md`; Codex membacanya langsung. Untuk pembagian kerja, pelaporan, dan pelacakan tugas, bagian ini yang berlaku; bila bertentangan dengan blok Beads di akhir berkas, lihat "Catatan Beads" di bawah.

### Peran

- **Codex**: developer utama untuk logika aplikasi, `backend/`, autentikasi, sesi, otorisasi, `firestore.rules`, model data dan absensi, launcher, serta tes terkait.
- **Claude**: UI/UX overhaul (tampilan, CSS, markup, teks UI) dan auditor independen read-only atas branch Codex.
- Peninjau tidak mengubah kode di branch milik agen lain. Perbaikan selalu dikerjakan penulis aslinya.
- Pisahkan usulan desain dari implementasi; tunggu pilihan arah pengguna sebelum menerapkan desain baru. Desain saja dan perbaikan UI kecil dikerjakan tanpa delegasi otomatis.
- Perubahan UI substansial dapat diusulkan untuk tinjauan independen; arsitektur/auth/otorisasi/integritas data dapat diusulkan untuk tinjauan adversarial. Tinjauan atau delegasi dimulai hanya atas permintaan eksplisit pengguna; jangan mengaktifkan review gate otomatis.
- Claude yang menemukan kebutuhan perubahan backend/auth/data di luar tugasnya mencatat kebutuhan tersebut dan menyerahkannya lewat pengguna. `/codex:review` dan `/codex:adversarial-review` read-only; `/codex:rescue` memerlukan permintaan pengguna dan tidak berjalan bersama penulis lain.
- Temuan tinjauan diverifikasi di kode sebelum diterapkan; jawab setiap temuan di laporan status (diterima, ditolak beserta alasan, atau ditunda). Gunakan template tinjauan untuk severity, evidence, reproduksi, koreksi dan missing coverage.

### Workspace dan branch

- Satu workspace aktif untuk Claude dan Codex: `D:\Work\ABC Ministry Service App\abc-ministry-service-app`. Folder `MSA-claude`, `MSA-codex`, `MSA-codex-xlsx`, dan worktree bersarang adalah sumber historis; jangan dipakai untuk pekerjaan baru, dihapus, atau ditimpa.
- Jalankan `git rev-parse --show-toplevel`, `git branch --show-current`, dan `git status --short` sebelum menulis. Pastikan root sama dengan workspace aktif; jangan menimpa perubahan lokal milik tugas lain.
- Pertahankan branch aktif. Bekerja di `development` diizinkan untuk tugas pengguna di workspace ini; jangan membuat/berpindah branch, merge, rebase, reset, commit, atau push tanpa perintah eksplisit pengguna. Branch historis tetap dipertahankan.
- Hanya satu penulis aktif pada workspace bersama. Agen kedua melakukan tinjauan read-only atau menunggu; jangan mengubah branch atau berkas saat penulis pertama bekerja. Pembagian agen paralel hanya atas permintaan pengguna.

### Kepemilikan berkas

| Path | Pemilik tulis |
|---|---|
| `backend/`, `*-server.mjs`, `local-*.mjs`, `firestore.rules`, kode autentikasi/sesi/otorisasi, model data dan absensi, launcher `.cmd`, tes untuk area ini | Codex |
| `ui/`, `msa-*.css`, `docs/ui-overhaul/`, markup tampilan di `msa-*.html`, teks UI | Claude |
| `msa-*.js` yang mencampur UI dan logika, `package.json`, tes lintas area | Ditentukan pengguna per tugas |
| `sw.js` (versi cache), daftar modul di `server.mjs`, `PROJECT_STATUS.md`, `AGENTS.md`, `CLAUDE.md`, `.gitignore`, `.claude/`, `.codex/`, `.agents/` | Hanya saat merge atau atas permintaan pengguna |
| `docs/status/`, `docs/reviews/` | Setiap agen menulis berkasnya sendiri (nama berkas memuat nama agen) |

Jika tugas memerlukan path milik agen lain, jangan menyentuhnya; tulis permintaannya di berkas status. Penulis `sw.js`/`server.mjs` hanya mencatat kebutuhannya (mis. "cache naik, modul X ditambahkan"); integrator yang menerapkannya.

### Berbagi informasi antaragen

- `AGENTS.md` adalah satu sumber aturan; `CLAUDE.md` hanya mengimpornya. Konfigurasi native tetap di `.claude/` dan `.codex/`; implementasi hook bersama ada di `.agents/hooks/`.
- Baca `git status --short`, `git diff`, dan laporan `docs/status/` sebelum melanjutkan tugas agen lain. Perubahan belum di-commit sudah terlihat di workspace yang sama; jangan menganggap branch historis sebagai pekerjaan aktif.
- Penulisan lintas kepemilikan memerlukan penugasan pengguna. Saat konsolidasi yang secara eksplisit diminta pengguna, integrator boleh menggabungkan path lintas area setelah backup dan perbandingan; jangan mengaktifkan flag bypass hook secara permanen.
- Pengujian emulator/browser harus memakai namespace `test-*`, data fiktif, dan port terisolasi. Permintaan validasi aplikasi memberi izin menjalankan runner terisolasi yang sudah ada; di luar itu koordinasikan dengan pengguna. Jangan menghentikan proses atau mengambil alih port milik pihak lain.

### Siklus tugas

1. **Mulai:** periksa root, branch, status dan lingkup tugas; satu penulis aktif.
2. **Kerjakan:** pertahankan pekerjaan lokal dan kontrak aplikasi; perubahan minimal sesuai penugasan pengguna.
3. **Verifikasi:** jalankan tes relevan dan periksa diff. Pisahkan hasil langsung dari klaim laporan historis.
4. **Laporkan:** tulis `docs/status/<tanggal>-<agen>-<tugas>.md`, kontrak yang berubah, kebutuhan integrasi dan usulan Summary/Description. Tinjauan independen hanya bila diminta; laporan di `docs/reviews/` tidak memerlukan pergantian branch.
5. **Integrasi:** pada workspace ini, hanya atas permintaan pengguna; backup dahulu dan jangan melakukan operasi destruktif atau menyelesaikan konflik yang belum jelas tanpa persetujuan. Perbarui `PROJECT_STATUS.md` secara aditif; commit/push/merge/deploy tetap memerlukan izin eksplisit.

### Kontrak antaragen

Berkas status wajib memuat "Kontrak yang berubah" (id, `data-*`, ARIA, rute hash, endpoint, teks yang dipakai tes: lama menjadi baru) dan "Kebutuhan saat merge". Agen yang menerima pekerjaan atau meninjau membaca kedua bagian itu sebelum membaca diff.

### Catatan Beads

Repositori ini belum menginisialisasi Beads (tidak ada `.beads/`). Selama belum, bagian Kolaborasi ini yang berlaku untuk pelacakan tugas dan pelaporan, dan aturan tugas di blok Beads di bawah ditangguhkan. Berkas status adalah laporan, bukan daftar TODO. Jangan menjalankan `bd init` atau `bd setup` tanpa persetujuan pengguna. Setelah Beads aktif dan terbukti dipakai bersama oleh semua worktree, klaim tugas dapat dipindahkan ke `bd`.

<!-- BEGIN BEADS CODEX SETUP: generated by bd setup codex -->
## Beads Issue Tracker

Use Beads (`bd`) for durable task tracking in repositories that include it. Use the `beads` skill at `.agents/skills/beads/SKILL.md` (project install) or `~/.agents/skills/beads/SKILL.md` (global install) for Beads workflow guidance, then use the `bd` CLI for issue operations.

### Quick Reference

```bash
bd ready                # Find available work
bd show <id>            # View issue details
bd update <id> --claim  # Claim work
bd close <id>           # Complete work
bd prime                # Refresh Beads context
```

### Rules

- Use `bd` for all task tracking; do not create markdown TODO lists.
- Run `bd prime` when Beads context is missing or stale. Codex 0.129.0+ can load Beads context automatically through native hooks; use `/hooks` to inspect or toggle them.
- Keep persistent project memory in Beads via `bd remember`; do not create ad hoc memory files.

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.
<!-- END BEADS CODEX SETUP -->

<!-- codebase-memory-mcp:start -->
Untuk penelusuran struktur kode, gunakan skill `codebase-memory` dan indeks yang sudah ada. Jika tidak tersedia, laporkan batasnya lalu periksa sumber terkait; jangan re-index atau mengubah konfigurasi global otomatis.
<!-- codebase-memory-mcp:end -->
