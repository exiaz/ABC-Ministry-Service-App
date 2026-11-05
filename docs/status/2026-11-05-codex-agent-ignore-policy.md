# Kebijakan sumber desain, ignore dan kolaborasi agent

Agen: Codex · Branch: development · Baseline: 0edd878 · Tanggal: 2026-11-05
Status: IMPLEMENTED / TESTED untuk aturan Git dan regresi hook · Produksi: NO-GO

## Ringkasan

`AGENTS.md` menjadi acuan bersama yang membedakan sumber desain tracked, hasil alat lokal, tanggung jawab default dan penugasan eksplisit pengguna. `.gitignore`, skill workflow Claude dan template laporan diselaraskan dengan aturan tersebut. Tidak ada sumber desain, lisensi atau konfigurasi bersama yang dihapus/untrack.

## Perubahan

- `.gitignore`: pertahankan aturan lama dan konfigurasi lokal; abaikan isi baru `.taste/` dan `.impeccable/` kecuali daftar eksplisit sepuluh sumber/config yang sudah tracked. Daftar juga berlaku bagi checkout baru, sehingga sumber baru memerlukan pengecualian yang ditinjau, tanpa `git add -f`.
- `AGENTS.md`: satu acuan aktif; penugasan pengguna mengatasi pembagian peran default sesuai lingkup. Satu penulis aktif mencakup laporan, perubahan alat dan operasi Git. Serah terima memuat baseline, path tugas, perubahan lokal dan hasil verifikasi; agen penerima membaca ulang sebelum menulis.
- `AGENTS.md`: sumber desain/lisensi tetap tracked; jangan mengganti `.gitignore` dari branch lama atau untrack sumber sebagai cleanup cache. Instruksi Beads yang sudah ditangguhkan diringkas menjadi satu aturan kondisional tanpa mengaktifkan Beads.
- `.claude/skills/msa-workflow/SKILL.md`: rujuk kebijakan bersama; hilangkan duplikasi workflow dan larangan lintas peran yang mengabaikan penugasan eksplisit. Review dapat dibaca saat penulis lain aktif; laporan baru disimpan setelah giliran tulis diserahkan.
- `docs/status/_TEMPLATE.md`, `docs/reviews/_TEMPLATE.md`: serah terima dan diff berdasarkan baseline commit di workspace yang sama, termasuk berkas untracked; tidak mengharuskan pergantian branch atau merge.
- `tests/agent-ignore.test.mjs`: verifikasi perilaku Git dalam repositori sementara untuk sumber/lisensi, hasil alat, konfigurasi native bersama dan konfigurasi lokal. Index target tidak disentuh.

## Kontrak yang berubah

Tidak ada kontrak aplikasi, endpoint, otorisasi, UI atau data yang berubah. Kebijakan Git membedakan berkas desain yang dibagikan dari hasil alat lokal; `CLAUDE.md` tetap hanya `@AGENTS.md`. Implementasi hook dan registrasi native tidak diubah.

## Kebutuhan integrasi

- Versi cache `sw.js`: tidak naik.
- Modul statis/server: tidak ada.
- Indeks `PROJECT_STATUS.md`: kebijakan sumber desain dan aturan agent diselaraskan, merujuk laporan ini.
- Commit/push belum dilakukan untuk tugas ini.

## Verifikasi aktual

- `node --test tests/agent-ignore.test.mjs tests/collab-guard.test.mjs`: lulus 6/6 (2 tes Git ignore dan 4 tes hook yang ada).
- `npm.cmd run check`: lulus 247 berkas JS/MJS, sintaks dan import lokal.
- Metadata skill diperiksa manual: frontmatter `name`/`description`, nama folder, referensi aturan/brief/template dan import `CLAUDE.md` valid.
- SHA-256 sepuluh sumber desain/config sama dengan sebelum perubahan; semuanya tetap tracked. Cadangan aturan dan hash tersimpan di `.emulator-data/agent-policy-2026-11-05/` yang diabaikan Git.
- `git diff --check`: lulus. Branch tetap `development`, index kosong; tidak ada perubahan backend atau berkas sumber historis.
- Validator resmi `quick_validate.py` gagal berjalan dengan `ModuleNotFoundError: No module named 'yaml'`. Tidak memasang dependensi atau mengubah Python global.

## Serah terima

- Penulis: Codex; setelah laporan akhir, giliran dapat diserahkan kepada agen yang ditunjuk pengguna.
- Baseline: `0edd878`; lingkup: aturan ignore, `AGENTS.md`, skill workflow Claude, dua template, tes ignore, indeks status dan laporan ini.
- Perubahan lokal milik tugas lain: tidak ada pada awal tugas. Seluruh sumber desain/config tracked tetap dipertahankan.
- Pekerjaan tersisa: review dan commit/push bila ditugaskan. Sesi agent baru harus membaca aturan terbaru sebelum menulis.

## Risiko dan batas

- Ini aturan kerja bergantian; tidak membuat file lock atau mendeteksi penulis aktif otomatis. Dua agen yang mengabaikan aturan masih dapat saling menimpa.
- Pemuatan skill/aturan pada sesi interaktif baru belum diuji. Validator resmi skill memerlukan PyYAML bila hendak dijalankan terpisah.
- Tes aplikasi lengkap/emulator/browser tidak diulang karena tidak ada perubahan runtime aplikasi. Regresi hook yang relevan dijalankan langsung, bukan mengandalkan laporan lama.

## Untuk peninjau

Periksa bahwa sepuluh sumber desain/config tetap dapat dilacak, hasil alat/config lokal diabaikan, dan satu penulis/serah terima berlaku sama bagi Claude dan Codex. Diff: `git diff 0edd878 -- .gitignore AGENTS.md .claude/skills/msa-workflow/SKILL.md docs/status/_TEMPLATE.md docs/reviews/_TEMPLATE.md PROJECT_STATUS.md`; baca juga tes ignore dan laporan baru yang belum tracked.

## Usulan commit

Summary: `chore(agents): align shared rules and design ignore policy`

Description:
- Preserve tracked design sources while ignoring generated local output.
- Align agent ownership, handoff rules and workflow templates.
- Verify Git ignore behavior and shared hook compatibility.
