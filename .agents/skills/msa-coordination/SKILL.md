---
name: msa-coordination
description: Diagnose active task-scoped claims, distinguish legacy workspace locks, and coordinate Claude and Codex handoffs without overwriting another session.
---

# Koordinasi workspace MSA

Baca `AGENTS.md`. Hook bersama menjalankan mekanisme lock; skill ini menjelaskan respons terhadap statusnya, tidak memberi izin untuk memperluas tugas atau melewati hook.

- Sesi dikenali oleh pasangan agen dan `session_id` dari konteks `SessionStart`. Jangan meminjam ID sesi lain.
- Hook aktif adalah `.agents/hooks/collab-guard.mjs` dengan `.agents/hooks/coord.mjs`. Klaim path yang bertumpang tindih dalam worktree yang sama ditolak (`SCOPE_CONFLICT`). Perintah baca yang dikenali dan `Read`/`Grep`/`Glob` tidak mengambil klaim; shell penulis yang tidak diketahui mengambil klaim sementara seluruh worktree.
- Jika ada konflik klaim aktif, tunggu pemilik selesai atau lakukan tinjauan tanpa menyimpan berkas. Jangan mengambil alih, menghapus state, mengganti session ID/PID, atau memaksa pelepasan. Jangan melakukan polling rapat. Aturan satu penulis workspace tetap berlaku kecuali pengguna mengatur kerja paralel secara eksplisit.
- Baca ulang isi dan diff terbaru sebelum menyunting. Hook aktif tidak menjalankan pemeriksaan hash observasi dari mekanisme lama.

Jalankan dari root proyek untuk memeriksa koordinasi yang benar:

```powershell
node .agents/hooks/coord.mjs status
```

Keluaran `mode: "task-scoped"` menunjukkan `statePath`, tugas dan lingkupnya (`scopes`/`ephemeral`), PID, lease, serta keberadaan mutex. Ini snapshot terakhir: perintah status tidak membuat state, mengambil mutex, memperpanjang lease, atau membersihkan tugas. Cleanup berjalan pada transaksi hook berikutnya.

`PostToolUse` dan callback kegagalan yang terdaftar melepas klaim shell sementara. Claude juga memakai `PostToolBatch` agar klaim tool yang selesai/ditolak tidak tertinggal sampai `Stop`. Klaim file bertahan sampai tugas dilepas melalui `Stop`/`SessionEnd`/`Interrupt` yang didukung. Tugas induk tidak dilepas selagi ada tugas anak. Jangan meninggalkan shell penulis di background atau menjalankan server yang kemudian menyunting sumber. Sebelum giliran selesai, tulis laporan serah terima sesuai template.

## Cleanup otomatis dan diagnosis konflik

- Tugas crash dibersihkan otomatis pada transaksi berikutnya hanya jika lease 10 menit sudah habis, PID pemilik sudah mati, dan tidak ada tugas anak. Lease habis dengan proses masih hidup tetap dilindungi.
- Jika tool berhenti atau izin ditolak, biarkan callback selesai; jangan melepas klaim yang masih dipakai tool lain.
- Jika konflik aktif tetap ada, laporkan task ID, scope, PID dan lease dari status. Minta pemilik menyelesaikan/menghentikan sesi dan tool anaknya dengan normal. Bila kematian proses tidak dapat dipastikan atau state rusak, perlu diagnosis operator; jangan menghapus direktori koordinasi atau memakai force release.

## State lama dan Taste Code Desktop

- `.agents/.runtime/` dan `workspace-lock.mjs status/read/recover` adalah mekanisme lama; hook aktif tidak membacanya. Status CLI lama diberi `mode: "legacy"` dan petunjuk ke status aktif. Sisa `owner` lama bukan bukti workspace sedang sibuk dan bukan alasan menolak build/desain.
- Jangan menjalankan recovery, menghapus state lama, atau mengganti session ID hanya agar Design mode berjalan. Periksa status aktif dan penolakan hook yang benar terlebih dahulu.
- Setelah instruksi/registrasi hook berubah, selesaikan atau hentikan tool dengan normal, lalu buka sesi baru di Taste Code/Claude/Codex dan tinjau `/hooks` jika didukung. Sesi lama dapat membawa instruksi/registrasi sebelumnya. Jangan melaporkan hook Taste Code aktif hanya berdasarkan file konfigurasi; perlu bukti runtime.

## Batas dan referensi

Mekanisme berlaku pada tool yang melewati hook aktif/trusted. Ini koordinasi lokal Windows/Node, bukan OS file lock, kontrol akses aplikasi, lock lintas mesin/network share, atau perlindungan dari penyunting manual/alat yang tidak menjalankan hook. Jangan melaporkan perlindungan aktif pada sesi baru sebelum hook ditinjau lewat `/hooks`.

Claude memakai `onFailure: block` (memerlukan Claude Code 2.1.295+); launcher Codex mengembalikan deny jika script gagal dimulai/keluar nonzero. Kegagalan launcher/runtime native, hook nonaktif, timeout yang mematikan seluruh launcher, atau callback akhir yang hilang tetap perlu ditangani operator; jangan menyimpulkan bahwa semua jalur di OS terlindungi.

Pola yang disesuaikan, tanpa menyalin kode atau memasang paket/server:
- [Agent Mail](https://github.com/Dicklesworthstone/mcp_agent_mail): identitas, reservasi dan pelepasan; reservasinya sendiri bersifat advisory.
- [Agent Vault](https://github.com/ymxlx/agent-vault): satu acuan bersama dan serah terima; dijadikan referensi protokol, bukan jaminan locking.
- [Parallel Feature Development](https://github.com/wshobson/agents/blob/main/plugins/agent-teams/skills/parallel-feature-development/SKILL.md): satu pemilik per berkas dan penerapan perubahan shared secara berurutan; disesuaikan menjadi satu penulis workspace.
- [proper-lockfile](https://github.com/moxystudio/node-proper-lockfile): klaim direktori atomik dan risiko stale takeover; implementasi lokal tidak menggunakan TTL untuk mencuri lock.
- [Codex hooks](https://learn.chatgpt.com/docs/hooks) dan [Claude hooks](https://code.claude.com/docs/en/hooks): lifecycle dan format native yang dipakai.
