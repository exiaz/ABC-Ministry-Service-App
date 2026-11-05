# <Judul tugas>

Agen: Codex | Claude · Branch: <nama> · Basis: development @ <hash> · Tanggal: <YYYY-MM-DD>
Status: IMPLEMENTED | PARTIAL | BLOCKED · Produksi: NO-GO

Salin menjadi `docs/status/<YYYY-MM-DD>-<agen>-<tugas>.md`. Tulis hanya yang benar-benar terjadi; pisahkan yang diuji, yang tidak diuji, dan yang diasumsikan. Ini laporan, bukan daftar TODO.

## Ringkasan
Satu sampai tiga kalimat: apa yang berubah dan mengapa.

## Perubahan
- `<berkas>`: <apa dan mengapa>

## Kontrak yang berubah (wajib, untuk agen lain)
`id`, `name`, `data-*`, atribut ARIA, rute hash, URL halaman, endpoint, atau teks yang dipakai assertion tes: lama -> baru. Tulis "tidak ada" bila memang tidak ada.

## Kebutuhan integrasi (untuk integrator)
- Versi cache `sw.js`: naik / tidak
- Modul baru di `server.mjs`: <daftar> / tidak
- Baris indeks `PROJECT_STATUS.md` yang disarankan: <satu baris>

## Verifikasi aktual
- Perintah yang benar-benar dijalankan dan hasilnya (angka lulus/gagal). Contoh: `npm.cmd test` 224/224.
- Belum diuji: <perangkat fisik, browser selain Chrome, screen reader, dll.>

## Risiko dan pertanyaan terbuka
- ...

## Serah terima
- Penulis tugas dan status giliran: <aktif / diserahkan kepada agen pengguna tunjuk>.
- Baseline commit: <hash>; lingkup/path tugas: <daftar>.
- Perubahan lokal milik tugas lain yang dipertahankan: <daftar> / tidak ada.
- Pekerjaan tersisa, kebutuhan lintas area, atau konflik yang belum terselesaikan: <daftar> / tidak ada.
- Agen penerima membaca ulang status, diff dan isi berkas terbaru sesuai `AGENTS.md` sebelum mulai menulis.

## Untuk peninjau
- Fokus yang diminta: <mis. otorisasi, integritas absensi, regresi UI 360 px>
- Diff: `git diff <baseline-commit> -- <path-tugas>`; sebutkan berkas untracked yang juga perlu dibaca. Jangan berpindah branch untuk review.

## Jawaban atas tinjauan
Diisi penulis setelah membaca `docs/reviews/<berkas>.md` (dari `docs/reviews/<berkas>.md` di workspace bersama).
- R1: diterima | ditolak (alasan) | ditunda (alasan). Sudah diverifikasi di kode: ya/tidak.

## Usulan commit
Summary: <satu baris>
Description: <beberapa baris>
