# Perbaikan kepemilikan delegasi dan verifikasi hook native

Agen: Codex · Branch: development · Baseline: `1658bf7d2e449b78053efdd9b347f133776f4b3d` · Tanggal: 2026-11-05
Status: IMPLEMENTED · Kesiapan produksi aplikasi tidak dievaluasi ulang.

## Akar masalah

1. Wrapper menerima `--parent`/`MSA_TASK_ID` tanpa verifikasi sesi pemanggil. `coord.open()` menyimpan relasi tersebut tanpa memastikan parent terdaftar, aktif, atau berwenang. Hook hanya membuat task saat menulis; sesi read-only tidak mempunyai catatan sesi. Pembentukan ID task juga berada hanya di adapter.
2. Verifikasi lama tidak membedakan penolakan hook dari penolakan izin native Claude. Percobaan native pertama dalam tugas ini membuktikan PowerShell ditolak mode `dontAsk`, tetapi klaim shell bertahan sampai `Stop`: tidak ada callback `PermissionDenied` atau `PostToolUseFailure`. Menurut [referensi Claude](https://code.claude.com/docs/en/hooks#permissiondenied), `PermissionDenied` hanya berjalan dalam mode `auto`, bukan penolakan manual/deny rule. [PostToolBatch](https://code.claude.com/docs/en/hooks#posttoolbatch) menyediakan batas setelah seluruh tool dalam batch selesai.

## Perubahan dan berkas persis

| Berkas | Perubahan |
|---|---|
| `.agents/hooks/coord.mjs` | Registry sesi native aditif pada state versi 2; ID task bersama; validasi parent sesi/agen/worktree/lease/status delegasi; validasi ulang atomik saat membuka child; menolak self-parent. Parent dengan child aktif tidak direap/dilepas; mutex tanpa pemilik terverifikasi tidak diambil alih. Audit pelepasan klaim. |
| `.agents/hooks/collab-guard.mjs` | Mendaftarkan/memperbarui sesi pada SessionStart/PreToolUse; mengakhiri sesi pada SessionEnd; meneruskan identitas Claude lewat CLAUDE_ENV_FILE; audit event/deny tanpa isi perintah; membersihkan klaim shell per tool ID pada PostToolBatch. |
| `.agents/bin/delegate.mjs` | Menurunkan parent dari identitas native dan memverifikasi registry sebelum probe CLI/worktree/worker; `--parent` menjadi assertion raw session ID atau task ID yang cocok. Memvalidasi ulang sebelum worker; membersihkan identitas parent dari environment child; melepas child dalam finally tanpa force. |
| `.claude/settings.json` | Satu registrasi PostToolBatch ke adapter bersama. Hook keamanan lain tetap aktif. |
| `tests/delegation.test.mjs` | Enam tes registry/wrapper/lifecycle, dengan subkasus parent tidak sah dan CLI fixture berpenanda start. |
| `tests/collab-native.mjs` | Runner manual Claude native di repo sementara, assertion enforcement/permission-denial/cleanup/fail-closed/duplikasi, menyimpan bukti lokal. |
| `tests/collab-guard.test.mjs` | Memastikan tepat satu registrasi PostToolBatch Claude. |
| `tests/fixtures/agent-workspace.mjs` | Menyalin wrapper ke fixture Git terisolasi. |
| `docs/status/2026-11-05-codex-delegation-ownership-hooks.md` | Laporan tugas ini. |

Tidak ada dependensi baru, perubahan fitur aplikasi, Phase B, perubahan branch workspace, commit, push, merge, atau deploy.

## Audit registrasi native dan global

- Claude Code `2.1.302`; Codex CLI `0.166.0`. Sesi Codex desktop saat ini juga menjalankan hook native secara langsung.
- Proyek Claude: `.claude/settings.json`, satu guard per event; PreToolUse tetap `onFailure: block`. `.claude/settings.local.json` hanya berisi izin lokal, tanpa registrasi hook tambahan. Entry `.claude/hooks/collab-guard.mjs` hanya compatibility import dan tidak terdaftar native.
- Proyek Codex: `.codex/config.toml` hanya mengaktifkan fitur hooks; `.codex/hooks.json` berisi satu adapter per event. Launcher PreToolUse Windows/Bash tetap gagal tertutup. Kedua bentuk command benar-benar dijalankan oleh tes lifecycle yang ada.
- Global Claude: `C:/Users/HYPE AMD/.claude/settings.json` memuat codebase-memory dan Impeccable; hook plugin Codex Companion/Ponytail juga diperiksa. Debug native mencatat hook global/plugin dan guard proyek aktif. Tidak ditemukan registrasi guard kolaborasi global kedua. Managed settings pada lokasi Windows yang diperiksa tidak ada.
- Global Codex: `C:/Users/HYPE AMD/.codex/config.toml` memuat hook codebase-memory SessionStart/SubagentStart dan trust metadata; plugin Ponytail mempunyai lifecycle tersendiri. `C:/Users/HYPE AMD/.codex/hooks.json` tidak ada; trust entry historis untuk path itu bukan registrasi aktif.
- Konfigurasi hook global tidak diubah. Runner native kedua membatasi MCP menjadi kosong agar konektor yang tidak terkait tidak dimuat; semua hook user/proyek/plugin tetap aktif.

## Verifikasi aktual

| Skenario | Hasil | Bukti yang dieksekusi |
|---|---|---|
| Parent sah → delegasi berhasil | PASS | Wrapper native Codex → Claude: task `test-parent-valid-20261105`, parent `codex-8dab561dc8`, exit 0, 17 detik. Claude menjalankan Git status/diff. |
| Parent dihilangkan/raw session/task ID sah | PASS | Tes wrapper fixture menjalankan ketiga bentuk; exit 0; parent tersimpan konsisten. |
| Parent mismatched, unknown, expired, ended, delegated, foreign workspace; identitas hilang | PASS | Tujuh subkasus `tests/delegation.test.mjs`: exit 1 dengan kode terkait; marker probe versi/worker tidak ada, child tidak terdaftar. Parent lain yang terdaftar pun ditolak ketika tidak cocok dengan pemanggil. |
| Parent invalid pada workspace nyata | PASS | `--parent invalid-parent` menghasilkan `PARENT_MISMATCH`; audit/state tidak mempunyai child `test-parent-rejected-20261105`, tidak ada transkrip worker. Exit nonzero juga dipastikan dalam tes wrapper. |
| Read-only Git selama klaim penulis aktif | PASS | Tes hook menjalankan payload status/diff/log/branch/worktree; baca diterima. Claude native benar-benar menjalankan PowerShell `git status --short`; PostToolUse tercatat. |
| Write tanpa izin pada repo sementara | PASS | Claude native dalam environment worker read-only memanggil Write; audit `READ_ONLY_WORKER`, `probe.txt` tidak terbentuk. |
| Penolakan izin native dan pelepasan klaim sebelum Stop | PASS setelah perbaikan | Native dontAsk menolak PowerShell `Set-Content`; tool ID `toolu_017NbUmbSn7wZM84HKTamCH2`: PostToolBatch 08:13:57.470Z → unclaim 08:13:57.511Z → Stop 08:14:00.151Z. Berkas tidak terbentuk. |
| Runtime hook gagal → penulisan diblokir | PASS | Di repo sementara, hook tambahan menunjuk `missing-guard.mjs`, exit 1 dengan `onFailure: block`; Write dicoba, `probe.txt` tidak terbentuk. Guard asli tetap aktif. |
| Worker selesai → kepemilikan dilepas | PASS | Wrapper native mengembalikan `released: true`; audit open/release cocok dan task worker tidak lagi ada. Tes fixture memeriksa parent tetap sah serta child aktif mencegah parent dilepas/reap. |
| Tidak ada hook guard ganda | PASS | Assertion audit 52 event native Codex dengan tool ID: 0 pasangan event/tool ID duplikat. Ketiga probe Claude: 0 duplikasi event/tool ID; SessionStart/Stop/SessionEnd masing-masing tepat sekali per probe. Registrasi proyek diuji otomatis. |
| Mutex tanpa pemilik | PASS | Fixture membuat mutex tanpa owner; registry mengembalikan MUTEX_BUSY dan mempertahankan mutex. Tidak ada lock pengguna dihapus manual. |
| Git dan pekerjaan MSA tetap utuh | PASS | Status awal bersih; root/branch/HEAD tetap sama. Diff akhir hanya berisi sembilan berkas tugas di tabel. Fitur dan perubahan MSA yang sudah berada di baseline tidak diubah. |

Perintah akhir:

- `node --test tests/delegation.test.mjs tests/collab-hooks.test.mjs tests/collab-guard.test.mjs tests/workspace-lock.test.mjs`: **27/27 PASS**, 0 gagal/skip.
- `node tests/collab-native.mjs`: **3/3 PASS**, exit 0. Percobaan pertama sebelumnya FAIL pada assertion callback PermissionDenied; bukti tersebut dipertahankan dan menjadi dasar perbaikan PostToolBatch.
- `node --check` untuk ketiga modul `.agents` yang diubah: **PASS**.
- `npm.cmd run check`: **245 berkas PASS**, sintaks dan impor lokal.
- `git diff --check`: **PASS**, tanpa whitespace error. Git memberi peringatan normalisasi LF→CRLF pada berkas yang diedit.
- Assertion audit/state native: **PASS**, child sah dilepas, child invalid tidak ada, duplikasi guard 0.

Bukti lokal (diabaikan Git):

- `.git/msa-coord/reports/test-parent-valid-20261105.log`: transkrip delegasi native sah.
- `.git/msa-coord/audit.log`: open/release worker serta callback native Codex.
- `.git/msa-coord/reports/native-1793866170985/`: probe awal, termasuk kegagalan callback sebelum perbaikan.
- `.git/msa-coord/reports/native-1793866419186/results.json`: hasil native akhir; `*.audit.jsonl`, `*.debug.log`, `*.stdout.jsonl`, `*.stderr.log` dalam folder yang sama menyimpan detail tiap probe.

## Kontrak yang berubah

- Delegasi memerlukan identitas native pemanggil yang cocok dengan registry sesi aktif. Codex menggunakan CODEX_THREAD_ID/CODEX_SESSION_ID; Claude menggunakan MSA_NATIVE_SESSION_ID/MSA_NATIVE_AGENT dari CLAUDE_ENV_FILE. Pemanggilan manual tanpa identitas native tidak boleh memakai --parent sebagai pengganti otorisasi.
- `--parent` opsional; bila diberikan harus berupa session ID atau task ID milik sesi pemanggil. Parent ditolak sebelum CLI worker dengan PARENT_IDENTITY/PARENT_UNKNOWN/PARENT_EXPIRED/PARENT_UNAUTHORIZED/PARENT_MISMATCH.
- `coord.open()` dengan parent memerlukan parentIdentity dan memvalidasinya dalam transaksi yang sama. State versi 2 mendapat field sessions secara aditif; task/claim lama tetap dipertahankan.
- Claude mempunyai callback PostToolBatch tambahan untuk membersihkan hanya klaim sementara dengan tool ID yang sudah selesai. Klaim file persisten tidak dilepas oleh callback batch.
- Tidak ada kontrak aplikasi yang berubah.

## Kebutuhan integrasi

- Tidak perlu perubahan sw.js/server.mjs atau integrasi fitur. PROJECT_STATUS.md tidak diubah.
- Instruksi koordinasi lama masih mendeskripsikan mekanisme lock global historis; pembaruan menyeluruh dokumen tersebut berada di luar perbaikan terarah ini. Gunakan kontrak implementasi dan bukti tugas ini untuk perbaikan parent/batch.
- Sesi Claude yang sudah berjalan sebelum perubahan registrasi perlu memuat konfigurasi terbaru; pengujian di sini memakai proses print native baru dengan hook global tetap aktif. Tidak menambahkan review gate atau izin Git baru.

## Batas verifikasi dan risiko tersisa

- Full suite aplikasi, emulator, browser, Phase B, dan Antigravity native tidak dijalankan. Lingkup perubahan hanya kolaborasi.
- Penolakan native diuji pada dontAsk, read-only guard, dan kegagalan hook. Dialog izin interaktif dan classifier auto-mode PermissionDenied belum dijalankan; payload handler event tersebut diuji otomatis.
- Registry/environment merupakan koordinasi lokal berbasis hook yang dipercaya, bukan batas keamanan terhadap proses dengan akun OS sama yang sengaja memalsukan environment/state atau melewati hook. Sandbox dan izin native tetap diperlukan.
- Hook/process yang dihentikan sebelum callback akhir tetap memerlukan prosedur lifecycle/pemulihan; tidak ada pengambilalihan lock pengguna berdasarkan umur. Native CLI dapat memperbarui metadata/cache lokalnya sendiri selama pengujian.

## Serah terima

- Pekerjaan selesai; task penulis Codex sesi `01a1aaba-a064-7720-97a5-fb12e3a5904f` dilepas oleh lifecycle Stop normal setelah giliran ini. Semua proses runner yang dimulai sudah selesai; child delegasi native telah dilepas.
- Baseline: `1658bf7d2e449b78053efdd9b347f133776f4b3d`, branch development, workspace aktif yang diminta pengguna.
- Status awal tidak mempunyai perubahan lokal. Tidak ada pekerjaan pengguna yang di-reset/stash/ditimpa; worktree/branch historis tidak diubah.
- Belum commit/stage/push. Penerima membaca ulang status, diff, dan isi terbaru sebelum menyunting.

## Usulan commit

Summary: `fix(agents): verify delegation ownership and Claude hook cleanup`

Description:
- Validate delegation parents against active native sessions before spawning.
- Release denied Claude shell claims after tool batches without bypassing hooks.
- Add isolated regression and native enforcement tests with recorded evidence.
