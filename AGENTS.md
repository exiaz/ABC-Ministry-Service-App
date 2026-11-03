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
- Catat kemajuan implementasi signifikan, hasil validasi, dan batasan yang tersisa di `docs/status/<tanggal>-<agen>-<tugas>.md` (template: `docs/status/_TEMPLATE.md`). `PROJECT_STATUS.md` hanya diperbarui oleh integrator saat merge.
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

### Folder dan branch

- Setiap agen bekerja hanya di worktree miliknya: Codex di `MSA-codex`, Claude di `MSA-claude`. Folder `abc-ministry-service-app` adalah folder integrasi, khusus merge.
- Branch integrasi: `development`. Tugas bercabang dari `development` dengan nama `codex/<tugas>` atau `claude/<tugas>`. Jangan memakai branch lama (`wip/*`, `*/setup`) untuk tugas.
- **Penjaga awal sesi (wajib sebelum menulis berkas apa pun):** jalankan `git rev-parse --show-toplevel` dan `git branch --show-current`. Berhenti dan tanyakan kepada pengguna jika folder bukan worktree milik agen ini, atau branch aktif adalah `development`, `wip/*`, atau berprefiks agen lain.
- Jangan berpindah branch, checkout, mengedit, me-reset, atau me-rebase branch di luar tugas sendiri. Jangan membuat worktree baru tanpa diminta.
- Sebelum meminta merge, perbarui branch tugas dari `development` (`git merge development`).

### Kepemilikan berkas

| Path | Pemilik tulis |
|---|---|
| `backend/`, `*-server.mjs`, `local-*.mjs`, `firestore.rules`, kode autentikasi/sesi/otorisasi, model data dan absensi, launcher `.cmd`, tes untuk area ini | Codex |
| `ui/`, `msa-*.css`, `docs/ui-overhaul/`, markup tampilan di `msa-*.html`, teks UI | Claude |
| `msa-*.js` yang mencampur UI dan logika, `package.json`, tes lintas area | Ditentukan pengguna per tugas |
| `sw.js` (versi cache), daftar modul di `server.mjs`, `PROJECT_STATUS.md`, `AGENTS.md`, `CLAUDE.md`, `.gitignore`, `.codex/`, `.agents/` | Hanya saat merge atau atas permintaan pengguna |
| `docs/status/`, `docs/reviews/` | Setiap agen menulis berkasnya sendiri (nama berkas memuat nama agen) |

Jika tugas memerlukan path milik agen lain, jangan menyentuhnya; tulis permintaannya di berkas status. Penulis `sw.js`/`server.mjs` hanya mencatat kebutuhannya (mis. "cache naik, modul X ditambahkan"); integrator yang menerapkannya.

### Berbagi informasi antaragen

Worktree terpisah, tetapi semuanya berbagi satu repositori Git. Yang sudah di-commit terlihat oleh agen lain tanpa checkout; yang belum di-commit tidak terlihat. Karena itu laporan status harus di-commit (setelah persetujuan pengguna) agar dapat dipakai agen lain.

- Tugas aktif: `git branch --list "codex/*" "claude/*" -vv` dan `git worktree list`.
- Berkas yang disentuh agen lain: `git diff --name-only development...<branch>`.
- Laporan agen lain tanpa checkout: `git show <branch>:docs/status/<berkas>.md`.
- Pemeriksaan tumpang tindih (sebelum mulai dan sebelum meminta merge): untuk tiap branch dari `git for-each-ref --format="%(refname:short)" refs/heads/codex/ refs/heads/claude/`, jalankan `git diff --name-only development...<branch>`. Jika ada berkas yang juga disentuh branch agen lain, berhenti dan tanyakan kepada pengguna.
- Pengguna adalah koordinator emulator dan suite browser (`Start MSA.cmd`, `node tests/stage3.mjs`, `tests/*-browser.mjs`): tanyakan sebelum menjalankannya, karena port dan data dipakai bersama. Tes unit tanpa emulator aman dijalankan paralel.

### Siklus tugas

1. **Mulai.** Penjaga awal sesi, buat branch tugas dari `development`, lalu pemeriksaan tumpang tindih.
2. **Kerjakan** hanya di path milik sendiri; terapkan aturan pencegahan regresi di atas.
3. **Selesai.** Tulis `docs/status/<tanggal>-<agen>-<tugas>.md` dari template dan siapkan usulan Summary dan Description commit. Commit ke branch sendiri setelah pengguna menyetujui.
4. **Tinjauan silang (read-only).** Branch Codex ditinjau Claude; branch Claude ditinjau Codex. Peninjau membaca `git diff development...<branch>` dan berkas statusnya, lalu menulis `docs/reviews/<branch-dengan-garis-miring-jadi-strip>.md` **di branch miliknya sendiri** (`<agen>/review-<tugas>`), bukan di branch yang ditinjau. Penulis membacanya dengan `git show`, memverifikasi tiap temuan di kode, dan menjawabnya (diterima, ditolak beserta alasan, atau ditunda) di bagian "Jawaban atas tinjauan" pada berkas statusnya.
5. **Merge.** Di folder integrasi, hanya atas persetujuan eksplisit pengguna dan setelah tinjauan silang selesai: `git switch development`, `git merge --no-ff <branch>`, `npm.cmd run check`, `npm.cmd test`. Integrator menerapkan kebutuhan `sw.js`/`server.mjs` dari berkas status dan menambah satu baris indeks di `PROJECT_STATUS.md` yang merujuk berkas status.
6. **Setelah merge**, agen lain memperbarui branch tugasnya dari `development` sebelum melanjutkan.

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
