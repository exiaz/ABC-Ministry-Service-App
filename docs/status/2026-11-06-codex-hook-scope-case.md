# Perbaikan perbandingan huruf scope hook Windows

Agen: Codex · Branch: development · Basis: development @ 6e81d236fe8b394adfa9c50ef3e50b0a7148e677 · Tanggal: 2026-11-06
Status: IMPLEMENTED · Produksi: NO-GO

## Ringkasan
Scope delegasi menyimpan huruf asli, sedangkan path dari hook melalui `canonical()` menjadi huruf kecil pada Windows. Perbandingan yang peka huruf menyebabkan `BRIEF.md` ditolak sebagai `OUT_OF_SCOPE`. Perbandingan scope sekarang mengikuti aturan huruf `canonical()` tanpa migrasi state atau perubahan klaim Claude.

## Perubahan
- `.agents/hooks/coord.mjs`: gunakan pembanding bersama untuk containment scope tetap dan deteksi overlap; perbandingan mengabaikan perbedaan huruf hanya pada Windows, termasuk scope yang sudah tersimpan.
- `.agents/bin/delegate.mjs`: peringatan overlap lintas worktree memakai pembanding bersama yang sama.
- `tests/collab-hooks.test.mjs`: dua tes regresi untuk aturan huruf per platform, batas direktori, scope berkas/direktori, kedua adapter Codex/Claude, serta penolakan konflik klaim.

## Kontrak yang berubah
Pada Windows, scope `docs/UI/BRIEF.md` menerima path `docs/ui/brief.md` dan konflik scope mendeteksi kedua ejaan sebagai path yang sama. Nama error, skema state, lifecycle klaim, API aplikasi, rute, dan teks UI tidak berubah. Pada platform lain, perbandingan tetap peka huruf.

## Kebutuhan integrasi
- Versi cache `sw.js`: tidak perlu naik.
- Modul baru di `server.mjs`: tidak ada.
- `PROJECT_STATUS.md`: tidak diubah; integrasi dokumentasi mengikuti penugasan pengguna.
- Salinan hook di worktree historis tidak diubah; hasil uji berlaku untuk workspace aktif dan salinan fixture tes.

## Verifikasi aktual
- Sebelum patch implementasi: `node --test --test-name-pattern='scope comparisons|Windows fixed scopes' tests/collab-hooks.test.mjs` menghasilkan 0 lulus, 2 gagal; kegagalan membuktikan false negative overlap dan penolakan scope yang sah.
- Sesudah patch: `node --test tests/collab-hooks.test.mjs tests/collab-guard.test.mjs tests/delegation.test.mjs`: 22/22 lulus, 0 gagal, 0 dilewati; sekitar 74 detik. Tes berjalan pada Windows dengan repo Git sementara dan data fiktif.
- `npm.cmd run check`: 249 berkas JS/MJS lulus pemeriksaan sintaks dan impor lokal.
- `node --check` pada ketiga berkas kode yang diubah: lulus.
- `git diff --check` pada path tugas: lulus; Git memberi peringatan normalisasi LF/CRLF.
- Percobaan awal menjalankan suite setelah patch ditahan hook karena Claude masih mengklaim `docs/ui-overhaul/brief.md`. Codex menunggu sampai klaim Claude dilepas secara normal, lalu menjalankan suite. Tidak ada bypass, pelepasan paksa, atau penghentian proses Claude.

## Risiko dan pertanyaan terbuka
- Suite aplikasi penuh, browser/emulator aplikasi, dan runtime non-Windows tidak dijalankan; perubahan terbatas pada koordinasi tool.
- Tidak menguji ulang penugasan desain Claude melalui CLI AI sungguhan; adapter hook Codex/Claude diuji melalui payload native di fixture.

## Serah terima
- Penulis: Codex; implementasi dan verifikasi selesai.
- Baseline: `6e81d236fe8b394adfa9c50ef3e50b0a7148e677`; lingkup: tiga berkas kode/tes di atas serta laporan ini.
- Status awal Git bersih. Perubahan Claude yang muncul selama tugas dipertahankan: `docs/ui-overhaul/BRIEF.md` dan `docs/status/2026-11-06-claude-p0-orkestrasi.md`.
- Codex tidak mengubah branch, index, konfigurasi native hook, state koordinasi secara langsung, atau berkas desain; Codex tidak menjalankan commit/push/deploy.
- Saat pemeriksaan akhir, HEAD berubah melalui operasi di luar tool Codex menjadi `0269a4d99a7d6c64a1b7931932a1ca00005751df` (`docs(ui): jadikan Pil acuan tunggal UI dan catat temuan audit`). Commit tersebut mencakup ketiga berkas patch ini dan dua berkas tugas Claude. Diff ketiga berkas terhadap baseline sama dengan patch yang diuji; commit tidak diubah/dibatalkan. Laporan Codex ini masih untracked saat ditulis.
- Agen penerima membaca ulang status, diff dan isi berkas terbaru sebelum menyunting.

## Usulan commit
Summary: `fix(coord): align Windows scope comparisons with canonical paths`
Description:
- Compare fixed scopes and overlaps using Windows case rules.
- Reuse overlap checks in delegation warnings and add hook regressions.
