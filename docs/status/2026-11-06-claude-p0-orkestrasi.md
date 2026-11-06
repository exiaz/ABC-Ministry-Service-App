# P0 selaraskan acuan Pil (orkestrasi Claude + worker Codex)

Agen: Claude (orkestrator) + Codex (worker) · Branch: development · Basis: development @ 1686188 · Tanggal: 2026-11-06
Status: IMPLEMENTED untuk dokumen; integrasi laporan worker tertunda · Produksi: NO-GO

## Ringkasan
Atas permintaan pengguna, P0 didelegasikan ke Codex lewat `.agents/bin/delegate.mjs` (worktree terpisah `../abc-msa-wt/codex-p0-acuan-pil`, branch `agent/codex-p0-acuan-pil`). Codex menyusun draf BRIEF dan menemukan isi audit 4–5, tetapi hook menolak penulisan `BRIEF.md`. Claude memeriksa D0 secara visual, mengoreksi draf, dan menulis `docs/ui-overhaul/BRIEF.md` di workspace utama.

## Perubahan
- `docs/ui-overhaul/BRIEF.md`: ditulis ulang ke sistem Pil (≈150 baris), berdasarkan draf Codex + pemeriksaan visual D0.
- Berkas laporan ini.
- Di worktree worker (belum diintegrasikan): `docs/status/2026-11-06-codex-p0-acuan-pil.md`.

## Koreksi atas draf Codex (dari D0)
Draf Codex bersumber `.taste/` karena PDF tidak bisa dirender di lingkungannya. PDF ternyata berisi JPEG tertanam; Claude mengekstraknya (skrip Node di scratchpad) dan memotongnya dengan System.Drawing untuk dibaca.
- Tipografi: D0 menetapkan delapan ukuran (Hero 48/52, Display 32/36, Judul 28/32, Subjudul 24/28, Bagian 20/24, Isi 16/20 800/600, Kecil 14/20, Label 12/16). Hero dan Subjudul belum ada di token; `--type-body` 400 16/24 berbeda dari Isi D0.
- Radius: baris memakai kapsul 999, bukan 32. 32 untuk ubin statistik/tanggal; 40 untuk kartu fokus, grafik, kartu pelayanan, sheet.
- Jarak: 8 antar baris, 10 antar kartu, 16 dalam kartu, 24 sisi layar (draf: gap 16 dari blueprint).
- Tombol empat varian (merah, hitam, kuning, abu); chip 44 di D0 dinaikkan ke 48 sesuai `AGENTS.md`.
- Fokus D0 = cincin biru dengan celah putih → arah perbaikan audit 4. Nonaktif D0 = abu + alasan → mengonfirmasi audit 5.
- Ditambahkan dari D0: kartu pelayanan (104, Dibatalkan dicoret), formulir (56, garis 1,5px, galat 2px), status sistem (offline/galat/kosong), bottom sheet, sidebar desktop (item 52, ikon 22, aksi hitam di dasar), peta layar D1–D11 dan daftar layar tanpa desain.

## Kontrak yang berubah
Tidak ada perubahan kode, id, rute, endpoint, atau teks tes. Acuan visual resmi berubah: C10 → Pil (dokumen).

## Kebutuhan integrasi
- `sw.js`, `server.mjs`: tidak.
- Salin `docs/status/2026-11-06-codex-p0-acuan-pil.md` dari worktree worker ke workspace utama (dirujuk BRIEF bagian 5). Tertunda: shell Claude diblokir klaim sesi Codex lain (`codex-14cc36174d`, berkas hook) di workspace yang sama.
- Hapus worktree `../abc-msa-wt/codex-p0-acuan-pil` dan branch `agent/codex-p0-acuan-pil` setelah laporan disalin; menunggu persetujuan pengguna.
- **Bug hook (area Codex/integrator):** scope delegasi dibandingkan case-sensitive (`coord.mjs`), sedangkan path tool dinormalisasi huruf kecil (`collab-guard.mjs`), sehingga scope `BRIEF.md` menolak tulis ke `brief.md`. Sesi Codex `codex-14cc36174d` tampaknya sedang menangani berkas ini; belum diverifikasi.
- Baris `PROJECT_STATUS.md` yang disarankan: "6 November 2026 — UI P0: acuan tunggal Pil (D0 diperiksa visual), C10 historis; audit 4–5 tercatat untuk P1. [laporan](docs/status/2026-11-06-claude-p0-orkestrasi.md)."

## Verifikasi aktual
- Worker Codex: exit 0, 526 detik; `git diff --check` lulus di worktree; 27 pasangan kontras dihitung.
- Claude: D0 diperiksa visual (6 potongan dari JPEG 3745×12000). Tiga PDF layar belum diperiksa ulang.
- `git diff --check` di workspace utama belum dijalankan setelah penulisan BRIEF (shell diblokir klaim sesi lain). Belum ada tes kode karena tidak ada perubahan kode.

## Risiko dan pertanyaan terbuka
- Dua penulis aktif di workspace utama saat ini (Claude untuk dokumen, sesi Codex lain untuk hook); path tidak beririsan.
- Keputusan pengguna tertunda: `ui-absen.html`/`ui-review.html` (pensiun/arsip), endpoint agregat P6.

## Serah terima
- Claude selesai untuk P0. Tidak ada commit, push, merge, atau deploy.
- Berikutnya: P1 (pustaka komponen Pil). Inventaris pemetaan komponen Pil → `ui-*` sudah disiapkan Claude dan menjadi bahan brief worker P1.

## Usulan commit
Summary: `docs(ui): jadikan Pil acuan tunggal UI dan catat temuan audit`
Description: Tulis ulang BRIEF.md ke sistem Pil berdasarkan D0 yang diperiksa visual dan draf worker Codex; C10 ditandai historis; audit 4–5 dan selisih token dijadwalkan ke P1.
