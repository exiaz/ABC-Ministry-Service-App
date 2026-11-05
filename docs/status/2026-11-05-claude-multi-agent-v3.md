# Kolaborasi multi-agen v3 (Claude, Codex, Antigravity)

Tanggal: 2026-11-05 · Agen: Claude · Branch: `development` · Baseline: `fc4bc9a` (perubahan Fase A + hapus PWA tetap belum di-commit, tidak disentuh).

## Akar masalah
1. `collab-guard.mjs` memperlakukan **setiap** perintah Bash sebagai penulis dan mengambil kunci workspace global (`begin(..., null)`), sehingga `git status` pun ditolak selama agen lain memegang kunci, dan pekerja Codex terdelegasi ikut terblokir.
2. Regex Git dijalankan pada **seluruh string perintah** (termasuk teks prompt/heredoc). `codex exec "… git reset …"` ditolak palsu.
3. Alat `PowerShell` (Claude) tidak dikenali sebagai shell, jadi lolos tanpa pemeriksaan (fail-open).
4. Kunci hanya dilepas saat `Stop` sesi induk; tidak ada lease, relasi induk-anak, atau pemulihan kedaluwarsa terverifikasi.
5. Tidak ada adapter Antigravity. Tidak ada hook ganda proyek yang ditemukan: hook global Claude/Codex hanya `codebase-memory-mcp` dan `impeccable` (tujuan berbeda, aditif). `.codex` memakai `hooks.json` saja (`config.toml` hanya `[features] hooks=true`).

## Perubahan
| Berkas | Isi |
|---|---|
| `.agents/hooks/policy.mjs` (baru) | Tokenizer shell: kutipan dan badan heredoc = data. Verdict `read`/`write`/`deny`/`delegate`/`self`; membuka bungkus `bash -c`, `powershell -Command`. |
| `.agents/hooks/coord.mjs` (baru) | Tugas dengan induk, lingkup per worktree, lease 10 menit, kedaluwarsa hanya jika lease habis **dan** pid mati, mutex mkdir atomik + rename, audit `msa-coord/audit.log`. State di `<git-common-dir>/msa-coord/` (dibagi semua worktree). Rilis induk ditolak selagi ada anak aktif. |
| `.agents/hooks/collab-guard.mjs` (ditulis ulang) | Satu adapter untuk `claude`/`codex`/`antigravity`; menerjemahkan skema masuk/keluar masing-masing. |
| `.agents/hooks.json` (baru) | Registrasi Antigravity (skema resmi: `docs/hooks?tab=ide`). |
| `.agents/bin/delegate.mjs` (baru) | Pembungkus delegasi. |
| `tests/collab-hooks.test.mjs` (baru), `tests/fixtures/agent-workspace.mjs`, `tests/workspace-lock.test.mjs` | Tes entrypoint nyata; fixture menyalin modul baru; 3 tes semantik kunci-global dihapus, 1 tes dilanjutkan dengan asersi baru. |

`workspace-lock.mjs` dipertahankan (impor `canonical`/`within`, tesnya) tetapi **tidak lagi dipakai guard**; `.agents/.runtime/` tidak dipakai lagi.

## Matriks kompatibilitas hook
| | Claude | Codex | Antigravity |
|---|---|---|---|
| Registrasi | `.claude/settings.json` (tidak diubah) | `.codex/hooks.json` (tidak diubah) | `.agents/hooks.json` |
| Event event dipetakan | SessionStart, PreToolUse, PostToolUse(+Failure), PermissionDenied, Stop, SessionEnd | idem | SessionStart, PreToolUse, PostToolUse, Stop (event dari argumen CLI, payload tak memuatnya) |
| Input | `session_id`, `tool_name`, `tool_input`, `tool_use_id` | idem | `conversationId`, `toolCall.{name,args}`, `stepIdx` |
| Keluaran tolak | `hookSpecificOutput.permissionDecision=deny` | idem | `{"decision":"deny","reason"}` |
| Alat shell | Bash, PowerShell | exec_command, shell | `run_command` (`CommandLine`,`Cwd`) |
| Alat tulis | Write/Edit/NotebookEdit | apply_patch (header patch) | `write_to_file`, `replace_file_content`, `multi_replace_file_content` (`TargetFile`) |
| Diuji end-to-end | Ya (hook hidup sesi ini + proses nyata) | Ya (`codex exec`) | **Hanya payload sintetis**; IDE tidak dijalankan |

## Delegasi
```
node .agents/bin/delegate.mjs --to codex|claude|antigravity --mode read|write --prompt-file F [--task ID] [--parent ID] [--scope docs/status,ui] [--role R] [--base-ref HEAD] [--timeout 900] [--dry-run]
```
- `read`: jalan di workspace, tanpa klaim; Codex `--sandbox read-only`, Claude `--permission-mode plan`; hook `MSA_MODE=read` menolak penulisan.
- `write`: worktree `..\abc-msa-wt\<task>` + cabang `agent/<task>`, tugas bertingkup tetap; `.agents`/`.codex`/`.claude/settings.json` terkini disalin ke worktree agar hook aktif.
- Pekerja membawa `MSA_DELEGATED=1`: panggilan wrapper/CLI agen/alat Agent ditolak (tidak ada rekursi); path konfigurasi agen terlindungi.
- Laporan JSON ringkas; transkrip penuh di `.git/msa-coord/reports/<task>.log`. Tidak ada merge/push/commit otomatis, tidak ada flag bypass izin.
- Antigravity: **tidak ada CLI** di mesin ini (hanya IDE dan `language_server.exe agentapi`); wrapper menolak dengan `CLI_UNAVAILABLE`/`CLI_UNVERIFIED` sampai `MSA_ANTIGRAVITY_CLI` + `MSA_ANTIGRAVITY_ARGS` diisi.

## Hasil tes
| # | Skenario | Hasil |
|---|---|---|
| 1 | `git status/diff/log/branch --show-current`, `ls` lolos saat tugas lain menulis | PASS (otomatis) |
| 2 | Prompt/heredoc/kutipan berisi "git reset/push/commit" tidak diblokir | PASS (otomatis + dry-run wrapper hidup) |
| 3 | `git reset --hard`, `push`, `commit`, `clean`, `checkout`, `branch -D`, `worktree remove`, `stash`, dibungkus `bash -c`/`powershell -Command`/`&&` ditolak | PASS |
| 4 | Claude → Codex (read) | PASS: 28 dtk; Codex melapor penulisan `zz_probe.txt` diblokir hook; berkas tidak ada |
| 5 | Codex → Claude (read) | PASS dengan konfigurasi sandbox bawaan pengguna (`danger-full-access`). **FAIL** bila `-s workspace-write` (pengguna sandbox tidak dapat mengakses `claude.exe` di profil) |
| 6 | Antigravity → Codex/Claude | **TIDAK DAPAT DIUJI**: tidak ada CLI/hook runtime; hanya payload sintetis lolos |
| 7 | Codex/Claude → Antigravity | **TIDAK DAPAT DIUJI** (tidak ada CLI) — ditolak dengan galat terstruktur |
| 8 | Tulis berkas logis sama dicegah; shell tak dikenal memegang klaim hanya selama tool | PASS |
| 9 | Dua pekerja tulis (Codex + Claude) paralel di worktree terpisah | PASS; kedua berkas `probe-*.txt` hanya di worktree, peringatan lingkup beririsan muncul |
| 10 | Pekerja crash (lease habis + pid mati) tidak memblokir | PASS (state dipalsukan; kill proses sungguhan belum diuji) |
| 11 | Delegasi bersarang (hook dan wrapper) ditolak | PASS |
| 12 | Pekerjaan tak ter-commit utuh | PASS: status Git sebelum/sesudah sama (selain berkas tugas ini); cadangan di `C:\Users\HYPE AMD\.claude\backups\msa-collab-v3-20261105` |
| 13 | `npm.cmd run check`; `npm.cmd test` | PASS: 243 berkas; 256/256 tes |

## Kontrak yang berubah
- Hook tidak lagi menolak Bash karena kunci global; kunci per jalur/worktree. Pesan tolak berformat `[collab-guard:KODE] …` (KODE: `DESTRUCTIVE_GIT`, `SCOPE_CONFLICT`, `READ_ONLY_WORKER`, `NESTED_DELEGATION`, `PROTECTED_PATH`, `FOREIGN_WORKSPACE`, `WORKSPACE`, `MISSING_ID`, `OUT_OF_SCOPE`, `MUTEX_BUSY`).
- State pindah dari `.agents/.runtime/` ke `<git-common-dir>/msa-coord/`; `Stop` tak lagi memblokir.

## Kebutuhan integrasi
- `AGENTS.md` (bagian "Workspace dan branch": lock global, helper `read`, `.agents/.runtime`) dan `.agents/skills/msa-coordination/SKILL.md` kini usang; perbarui oleh integrator.
- Pertimbangkan `.gitignore` untuk `..\abc-msa-wt` (di luar repo, tidak perlu) — tidak ada perubahan `.gitignore`.
- Codex memerlukan trust hook untuk worktree baru; pada `codex exec` hook terlihat aktif, tetapi trust interaktif belum diverifikasi.

## Risiko tersisa
- Shell yang tak dikenal diklasifikasikan `write` dan mengambil klaim seluruh worktree selama tool berjalan → bisa memblokir sebentar penulis lain di worktree yang sama.
- Klasifikasi shell heuristik: skrip (`node x.js`, `npm`) bisa menulis di mana saja; pembatas kuatnya sandbox/worktree, bukan hook. `git add` diperlakukan penulis, tidak ditolak.
- Antigravity: kode keluar non-nol tidak didokumentasikan; guard selalu keluar 0 dengan keputusan JSON. Fail-open/closed saat hook crash tidak terverifikasi. Nama binary CLI belum diketahui.
- Lease 10 menit: agen yang diam >10 menit dan pid induk mati kehilangan klaim; penulis lain bisa mengklaim jalur yang sama.
- Worktree menyalin hook dari workspace tetapi berbasis `HEAD`: pekerjaan tak ter-commit (Fase A) **tidak** ada di worktree.
- Dua worktree tes tertinggal: `..\abc-msa-wt\t-wcodex`, `t-wclaude` (cabang `agent/t-*`).

## Rollback
```bash
git checkout -- .agents/hooks/collab-guard.mjs tests/workspace-lock.test.mjs tests/fixtures/agent-workspace.mjs
```
lalu hapus berkas baru: `.agents/hooks/{policy,coord}.mjs`, `.agents/hooks.json`, `.agents/bin/`, `tests/collab-hooks.test.mjs`. Salinan konfigurasi lama: `C:\Users\HYPE AMD\.claude\backups\msa-collab-v3-20261105\cfg`. Bersihkan tes: `git worktree remove ..\abc-msa-wt\t-wcodex` dan `t-wclaude`, `git branch -D agent/t-wcodex agent/t-wclaude` (butuh persetujuan pengguna).

## Serah terima
Penulis: Claude. Tidak ada commit/push. Penerima membaca ulang diff `.agents/`, `tests/`.

## Usulan commit
**Summary:** `feat(agents): task-scoped hooks, Antigravity adapter, delegation wrapper`

**Description:** Ganti kunci workspace global dengan klaim per tugas/worktree (`coord.mjs`), klasifikasi shell terstruktur (`policy.mjs`) agar baca tidak diblokir dan teks prompt tidak dianggap perintah, satu adapter untuk Claude/Codex/Antigravity, `.agents/hooks.json`, pembungkus `delegate.mjs` (worktree terisolasi, tanpa rekursi), tes `collab-hooks`.
