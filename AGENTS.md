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
- Catat kemajuan implementasi signifikan, hasil validasi, dan batasan yang tersisa di `PROJECT_STATUS.md`.
- Jangan deploy, mengaktifkan billing, commit, atau push tanpa persetujuan pengguna.

## Penyuntingan teks dengan No AI Slop

- Aktifkan [No AI Slop](.agents/skills/no-ai-slop/SKILL.md) hanya jika pengguna meminta penyuntingan, pemolesan, atau audit konten tertulis, atau tugas utama berupa penulisan ulang substansial teks UI Indonesia atau petunjuk penggunaan nonteknis.
- Jangan aktifkan otomatis untuk coding/refaktor, backend/Firebase, autentikasi/keamanan, tes/debugging, pembaruan `PROJECT_STATUS.md`, ringkasan commit/laporan rutin, typo kecil, atau pembaruan dokumentasi teknis biasa.
- Pembagian acuan tetap: `MASTER_BRIEF.md` untuk kebutuhan aplikasi/aturan domain; `PROJECT_STATUS.md` untuk status terverifikasi/bukti tes; `README.md` untuk petunjuk operasional pemula; `AGENTS.md` untuk alur kerja Codex; skill untuk mutu bahasa. Penyuntingan wajib menjaga akurasi teknis, sintaks, keamanan, privasi, integritas data dan hasil tes. Jangan menghilangkan istilah teknis/pesan kesalahan yang perlu persis atau mengarang capaian, jumlah tes, benchmark maupun detail implementasi.

## Pelaporan pengembangan rutin

Laporkan secara ringkas dalam bahasa Indonesia: perubahan, tes yang benar-benar dijalankan beserta hasilnya (atau belum dijalankan), masalah penting yang tersisa, langkah berikutnya, serta usulan **Summary** dan **Description** siap salin untuk commit di GitHub Desktop. Laporan ini tidak otomatis mengaktifkan skill editorial; usulan commit tidak memberi izin commit, push, atau deploy.

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

Berkas ini sumber bersama untuk Claude (lewat `CLAUDE.md`) dan Codex.

- **Claude**: eksplorasi UI/UX, desain visual, mockup, implementasi frontend.
- **Codex**: peninjau independen (read-only) atas perubahan kode; tidak diberi akses tulis pada pekerjaan yang sedang disunting Claude.
- Usulan desain dipisahkan dari implementasi yang disetujui; implementasi dimulai setelah pengguna menyetujui arah.
- Temuan peninjau dinilai secara kritis dan diverifikasi terhadap kode sebelum diterapkan.
- Perubahan arsitektur, autentikasi, otorisasi, atau integritas data: sarankan peninjauan Codex tambahan.

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
