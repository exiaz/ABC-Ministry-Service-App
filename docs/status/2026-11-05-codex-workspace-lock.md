# Lock otomatis workspace Claude dan Codex

Agen: Codex · Branch: development · Baseline: 0edd878 + perubahan aturan ignore yang belum di-commit · Tanggal: 2026-11-05
Status: IMPLEMENTED / TESTED pada hook lokal dan fixture Windows · Produksi aplikasi: NO-GO

## Ringkasan

Hook bersama kini memakai satu penulis workspace per pasangan agen dan session ID, serta observasi hash untuk menolak edit dari versi lama. Claude dan Codex dapat bergantian menulis; proses hook kedua yang berebut lock ditolak sebelum tool dijalankan. Perubahan aturan ignore/serah terima dari tugas sebelumnya dipertahankan.

## Perubahan

- `.agents/hooks/workspace-lock.mjs`: state lokal, mutex direktori atomik, sesi, reservasi tool, hash berkas, identitas HEAD/staged entries, helper baca ulang, status dan pemulihan operator. Hanya hash/metadata disimpan; isi berkas tidak disimpan dalam state. Pengambilalihan berdasarkan umur lock tidak digunakan.
- `.agents/hooks/collab-guard.mjs`: memanggil coordinator pada lifecycle native; mempertahankan penjaga Git, folder historis dan metadata, serta melindungi state runtime dari edit langsung. Shell diserialkan sebagai calon penulis; `Read`, `Grep`, `Glob` native tetap dapat digunakan untuk tinjauan tanpa menyimpan.
- `.claude/settings.json`, `.codex/hooks.json`: masing-masing satu handler per event `SessionStart`, `PreToolUse`, `PostToolUse`, `Stop`, `SessionEnd`. Claude juga menangani `PostToolUseFailure`/`PermissionDenied`; Codex menangani `Interrupt`. Matcher tool mencakup tool native dan tool ber-path yang dapat dikenali.
- Claude `PreToolUse` memakai `onFailure: block` (Claude Code 2.1.295+). Launcher Codex menangkap kegagalan startup/exit script dan mengembalikan keputusan deny; override Windows memakai PowerShell.
- `.agents/skills/msa-coordination/SKILL.md`: prosedur bersama untuk busy/stale/recovery dan batas mekanisme. Workflow Claude dan `AGENTS.md` merujuk sumber yang sama. `CLAUDE.md` tetap hanya `@AGENTS.md`.
- `.gitignore`: state `.agents/.runtime/` tetap lokal; kebijakan sumber desain tracked dari tugas sebelumnya dipertahankan. Tidak ada sumber/lisensi yang dihapus atau di-untrack.
- `tests/workspace-lock.test.mjs`, fixture `tests/fixtures/agent-workspace.mjs` dan regresi hook/ignore: tes lintas proses, stale write, callback hilang/salah, pemulihan dan command native dalam repositori sementara. Tes tidak membuat lock atau commit pada repositori target; commit fixture hanya berada di direktori tes fiktif.

## Cara kerja

1. `SessionStart` mendaftarkan observasi berkas serta HEAD/staged entries. Resume sesi yang sama mempertahankan observasi lama.
2. Sebelum penulisan, hook mengklaim mutex atomik, memeriksa pemilik dan observasi, lalu mencatat tool aktif. Sesi lain ditolak; tool penulis paralel dalam sesi yang sama juga ditolak.
3. `PostToolUse` yang cocok memperbarui observasi perubahan sendiri dan menyelesaikan reservasi tool. Callback yang salah tidak melepas reservasi. Kegagalan tool tidak menyegarkan observasi sehingga perubahan parsial harus dibaca ulang.
4. `Stop` melepas lock giliran bila tidak ada tool aktif. `SessionEnd`/`Interrupt` menandai penutupan; bila tool masih berjalan, pelepasan menunggu callback akhirnya. `Stop` diblokir ketika tool belum selesai.
5. Sesi yang tertinggal harus membaca ulang lewat helper `read` sebelum menyunting path berubah. Helper memperbarui hanya path yang diminta dan menampilkan isinya; HEAD/index berbeda memerlukan inspeksi lalu sesi baru.
6. Lock crash dipulihkan oleh operator setelah sesi beserta proses penulisnya dihentikan, memakai token tepat. Pemulihan mutex juga memeriksa PID sudah mati; metadata lama dikarantina untuk audit. State rusak atau metadata tidak lengkap tidak dihapus otomatis.

## Penelitian skill/repo

Pencarian dilakukan lewat GitHub connector, browser skills.sh dan `npx.cmd --no skills find 'multi-agent coordination'` menggunakan CLI yang sudah tersedia. Tidak menjalankan installer atau menambah dependensi/server/global skill. Kandidat berinstalasi kecil tidak dianggap teruji hanya karena muncul dalam pencarian.

- [wshobson/agents — Parallel Feature Development](https://github.com/wshobson/agents/blob/main/plugins/agent-teams/skills/parallel-feature-development/SKILL.md): kepemilikan berkas dan penerapan perubahan shared berurutan; disesuaikan ke satu penulis workspace.
- [Agent Mail](https://github.com/Dicklesworthstone/mcp_agent_mail): identitas dan reservasi/pelepasan advisory. Server dan installer tidak digunakan; kebutuhan lokal ini memakai penolakan hook sebelum tool.
- [Agent Vault](https://github.com/ymxlx/agent-vault): acuan bersama dan handoff; referensi protokol, bukan sumber jaminan locking.
- [proper-lockfile](https://github.com/moxystudio/node-proper-lockfile): direktori atomik dan risiko stale takeover; tidak memasang paket atau menyalin kodenya.
- [Codex hooks](https://learn.chatgpt.com/docs/hooks), [Claude hooks](https://code.claude.com/docs/en/hooks): format event/output dan lifecycle. Definisi baru perlu ditinjau/trusted lewat `/hooks` pada sesi interaktif kedua agent.

## Kontrak yang berubah

Tidak ada perubahan API aplikasi, auth, data absensi atau UI. Tool penulis yang tercakup hook memerlukan session ID, tool ID dan baseline sesi. Shell memegang giliran penulis walaupun perintahnya hanya membaca. Tool yang masih aktif menahan lock; penulis background yang hidup melampaui giliran tidak didukung.

State runtime diabaikan Git dan tidak boleh disunting langsung. Prosedur pemakaian, helper baca ulang dan recovery berada di skill bersama; pemulihan hanya dari terminal manual operator setelah menghentikan sesi/tool pemilik, bukan tindakan otomatis agent.

## Verifikasi aktual

- `npm.cmd test`: lulus 249/249, 0 gagal/skip; log `.emulator-data/workspace-lock-2026-11-05/unit-validation.log`. Termasuk 10 tes coordinator dan 6 tes regresi hook/ignore.
- Setelah penguatan launcher native, `node --test --test-name-pattern=Native tests/workspace-lock.test.mjs tests/collab-guard.test.mjs`: lulus 3/3, termasuk script Codex hilang yang menghasilkan deny. Suite lengkap tidak diulang setelah perubahan konfigurasi launcher ini.
- `npm.cmd run check`: lulus 249 berkas JS/MJS. Kedua modul hook juga lulus `node --check` secara langsung.
- Perlombaan dua proses hook nyata menghasilkan satu pemenang; SID lain termasuk agent sejenis ditolak. Handoff mempertahankan hash lama sampai helper read dipakai. Tidak ada expiry yang mencuri lock aktif, bahkan dengan timestamp lama.
- Lifecycle command native benar-benar dijalankan melalui PowerShell/Git Bash dari subfolder fixture, dengan SessionStart → PreToolUse → penulisan → PostToolUse → Stop. Ini smoke command/protokol; tidak sama dengan membuka dua sesi AI interaktif baru.
- Tes state rusak, mutex tertinggal, token salah, PID masih hidup, HEAD/staged drift, refresh stat-cache Git, dan tool gagal dijalankan. Kegagalan fixture pemetaan path Windows pada iterasi awal diperbaiki; assertion tidak dilemahkan.
- Metadata/frontmatter dan referensi lokal kedua skill diperiksa manual. Validator resmi skill tidak dijalankan ulang: pada tugas sebelumnya terblokir `ModuleNotFoundError: No module named 'yaml'`; tidak memasang PyYAML global.
- Codebase Memory CLI tersedia tetapi `cli list_projects` gagal dengan `could not load saved runtime settings`. Penelusuran dibatasi ke sumber hook, konfigurasi dan tes terkait; tidak re-index atau mengubah MCP/global config.

## Kebutuhan integrasi

- Cache `sw.js`: tidak naik; modul aplikasi/server: tidak ada.
- Indeks `PROJECT_STATUS.md` merujuk laporan ini secara aditif.
- Cadangan sebelum perubahan ada di `.emulator-data/workspace-lock-2026-11-05/`; perubahan aturan sebelumnya memiliki cadangan sendiri.
- Commit/push belum dilakukan pada tugas ini; perubahan lokal sebelumnya tetap dipertahankan.

## Serah terima dan batas

- Baseline Git tetap `0edd878`; scope penulis Codex: hook coordinator, config native, skill bersama/workflow, aturan ignore, tes fixture/regresi dan laporan status. Setelah laporan akhir, giliran dapat diserahkan melalui sesi agent baru pada root workspace utama.
- **Langkah operator sebelum pemakaian:** tinjau definisi hook di `/hooks` pada Claude dan Codex, lalu mulai/resume sesi dengan SessionStart aktif. Trust global tidak diubah otomatis. Penegakan pada dua sesi AI interaktif baru belum diuji.
- Ini lock kooperatif lokal pada jalur hook aktif/trusted, bukan OS file lock atau kontrol akses. Penyunting manual, alat yang melewati hook, remote machine/network share dan operasi file opaque yang tidak dikenali tidak dijamin terlindungi.
- Hook/runtime yang nonaktif atau mematikan seluruh launcher saat timeout dapat membiarkan tool lewat sesuai batas runtime native. Launcher/error handler mengurangi kegagalan biasa; jangan mengklaim perlindungan OS menyeluruh.
- Callback akhir yang hilang, izin ditolak tanpa callback, state/mutex yang rusak atau sesi crash dapat meninggalkan lock. Hentikan sesi/tool dan gunakan pemulihan operator dengan token yang sesuai; jangan menghapus state sebagai jalan pintas. Metadata yang tidak lengkap perlu diagnosis manual.
- Emulator/browser aplikasi penuh tidak diulang karena tidak ada kode aplikasi yang diubah. Produksi aplikasi tetap NO-GO.

## Usulan commit

Summary: `feat(agents): prevent conflicting workspace writes`

Description:
- Serialize session writes and reject stale file observations.
- Integrate native hook lifecycle and fenced operator recovery.
- Share coordination guidance and test races, handoff and failure paths.
