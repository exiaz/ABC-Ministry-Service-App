---
name: msa-coordination
description: Coordinate Claude and Codex writes in the shared ABC MSA workspace, handle busy or stale-file hook denials, and hand off a turn without overwriting another session. Use for workspace lock status, refresh and recovery diagnosis.
---

# Koordinasi workspace MSA

Baca `AGENTS.md`. Hook bersama menjalankan mekanisme lock; skill ini menjelaskan respons terhadap statusnya, tidak memberi izin untuk memperluas tugas atau melewati hook.

- Sesi dikenali oleh pasangan agen dan `session_id` dari konteks `SessionStart`. Jangan meminjam ID sesi lain.
- Sebelum tool penulis, hook mengambil lock workspace dan menolak penulis kedua. Shell selalu diperlakukan sebagai calon penulis; `Read`/`Grep`/`Glob` native tetap bisa dipakai untuk tinjauan. Tool penulis dalam sesi yang sama juga berjalan satu per satu.
- Jika workspace sibuk, tunggu giliran pemilik selesai atau lakukan tinjauan tanpa menyimpan berkas. Jangan mencoba mengambil alih, menghapus state, mengganti session ID atau menjalankan pemulihan sendiri. Jangan melakukan polling rapat.
- Jika hook menyebut versi berubah, baca seluruh keluaran helper di bawah, susun ulang perubahan dari isi terbaru, lalu ulangi edit. Membaca dengan tool biasa tidak otomatis memperbarui observasi hash hook.

Jalankan dari root proyek; ganti ID dan path dengan konteks sesi sendiri:

```powershell
node .agents/hooks/workspace-lock.mjs status
node .agents/hooks/workspace-lock.mjs read codex SESSION_ID AGENTS.md .gitignore
node .agents/hooks/workspace-lock.mjs read claude SESSION_ID ui/absen.css
```

Helper `read` menampilkan isi dan hash teks serta memperbarui hanya observasi path yang diminta. Gunakan path relatif terhadap direktori terminal, atau path absolut. Berkas hilang ditampilkan sebagai `content: null`. Perubahan HEAD/index atau berkas biner memerlukan inspeksi dan sesi baru; jangan me-reset baseline sesi lama.

`PostToolUse` menyelesaikan reservasi tool. `Stop` melepas lock giliran; `SessionEnd`/`Interrupt` meminta pelepasan setelah tool aktif selesai. Jangan meninggalkan shell penulis di background atau menjalankan server yang kemudian menyunting sumber. Sebelum giliran selesai, tulis laporan serah terima sesuai template.

## Pemulihan oleh operator

Lock tidak kedaluwarsa otomatis. Jika sesi crash, laporkan `status` dan token pemilik kepada pengguna. Operator menghentikan sesi beserta tool/proses anaknya dahulu, memeriksa diff, lalu menjalankan dari terminal manual:

```powershell
node .agents/hooks/workspace-lock.mjs recover OWNER_TOKEN --confirmed-session-ended
node .agents/hooks/workspace-lock.mjs recover-mutex MUTEX_TOKEN --confirmed-session-ended
```

`recover` menolak token yang berubah. `recover-mutex` juga mensyaratkan PID pemilik mutex sudah mati; metadata mutex dipindah ke arsip lokal. Jika state rusak atau metadata pemulihan tidak lengkap, hentikan penulisan dan minta diagnosis operator; jangan menghapus direktori runtime sebagai jalan pintas.

## Batas dan referensi

Mekanisme berlaku pada tool yang melewati hook aktif/trusted. Ini koordinasi lokal Windows/Node, bukan OS file lock, kontrol akses aplikasi, lock lintas mesin/network share, atau perlindungan dari penyunting manual/alat yang tidak menjalankan hook. Jangan melaporkan perlindungan aktif pada sesi baru sebelum hook ditinjau lewat `/hooks`.

Claude memakai `onFailure: block` (memerlukan Claude Code 2.1.295+); launcher Codex mengembalikan deny jika script gagal dimulai/keluar nonzero. Kegagalan launcher/runtime native, hook nonaktif, timeout yang mematikan seluruh launcher, atau callback akhir yang hilang tetap perlu ditangani operator; jangan menyimpulkan bahwa semua jalur di OS terlindungi.

Pola yang disesuaikan, tanpa menyalin kode atau memasang paket/server:
- [Agent Mail](https://github.com/Dicklesworthstone/mcp_agent_mail): identitas, reservasi dan pelepasan; reservasinya sendiri bersifat advisory.
- [Agent Vault](https://github.com/ymxlx/agent-vault): satu acuan bersama dan serah terima; dijadikan referensi protokol, bukan jaminan locking.
- [Parallel Feature Development](https://github.com/wshobson/agents/blob/main/plugins/agent-teams/skills/parallel-feature-development/SKILL.md): satu pemilik per berkas dan penerapan perubahan shared secara berurutan; disesuaikan menjadi satu penulis workspace.
- [proper-lockfile](https://github.com/moxystudio/node-proper-lockfile): klaim direktori atomik dan risiko stale takeover; implementasi lokal tidak menggunakan TTL untuk mencuri lock.
- [Codex hooks](https://learn.chatgpt.com/docs/hooks) dan [Claude hooks](https://code.claude.com/docs/en/hooks): lifecycle dan format native yang dipakai.
