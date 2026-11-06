# P0: selaraskan acuan UI ke Pil

Agen: Codex · Branch: agent/codex-p0-acuan-pil · Basis: 6e81d236fe8b394adfa9c50ef3e50b0a7148e677 · Tanggal: 2026-11-06
Status: **PARTIAL / BLOCKED oleh hook untuk BRIEF.md** · Produksi: NO-GO

## Ringkasan

Draf lengkap brief Pil disiapkan dalam lampiran laporan ini, mengikuti keputusan pengguna: Pil satu-satunya sistem visual, C10 historis dan dipertahankan. **BRIEF.md belum berubah**: penulisan ditolak hook karena perbedaan kapitalisasi scope. Temuan audit 4–5 ditemukan dalam sesi audit Codex dan diverifikasi terbatas melalui sumber CSS/hitungan kontras.

## Perubahan

- `docs/status/2026-11-06-codex-p0-acuan-pil.md`: laporan dan draf pengganti BRIEF siap diterapkan orkestrator setelah scope diperbaiki.
- `docs/ui-overhaul/BRIEF.md`: **belum ditulis**. Percobaan patch ditolak PreToolUse sebelum dijalankan; tidak ada penghapusan/perubahan berkas.
- Tidak menyunting kode, CSS, HTML, tes, `.taste/`, `PROJECT_STATUS.md`, `AGENTS.md`, konfigurasi agen, atau state koordinasi. Tidak commit/merge/push/deploy atau mendelegasikan lagi.

## Kontrak yang berubah (wajib, untuk agen lain)

Tidak ada perubahan kontrak aplikasi: ID, name, data-*, ARIA, rute, URL, endpoint, model data atau teks assertion tes. Penggantian acuan C10/U1–U7 ke Pil/P0–P6 masih berupa draf lampiran, bukan perubahan aktif BRIEF.

## Kebutuhan integrasi (untuk integrator)

- Versi cache `sw.js`: tidak naik; modul baru `server.mjs`: tidak ada.
- **Orkestrator perlu memperbaiki kecocokan scope**, lalu menerapkan lampiran ke `docs/ui-overhaul/BRIEF.md`. Jangan menandai P0 selesai sebelum draf diterapkan dan diperiksa ulang.
- `PROJECT_STATUS.md` tidak disunting. Setelah penerapan, baris yang disarankan: “6 November 2026 — UI P0: acuan tunggal Pil; C10 historis; audit 4–5 ditemukan dan tetap terbuka; verifikasi visual PDF belum diulang.”
- P1: pustaka bersama, perbedaan token prototipe, konsolidasi grafik, tindak lanjut audit 4–5; bukan implementasi P0.

## Sumber yang benar-benar diperiksa

- `AGENTS.md`, BRIEF lama termasuk bagian 2/perintah verifikasi, `docs/status/_TEMPLATE.md`, `docs/status/2026-11-06-claude-rencana-ui-ux.md`, `docs/status/2026-11-06-codex-pil-filter-focus.md`.
- `ui/msa-tokens.css`, `ui/pil-kit.css`, `ui/pil.css`, `ui/absen-kit.css`; `.taste/brand.json`, `.taste/page.json`, `.taste/review.json`. Review JSON berisi `findings: []` untuk tangkapan autentikasi; tidak membuktikan audit 4–5 selesai.
- Empat nama/ukuran PDF dalam `mockup ui_ux/` diperiksa. **PDF tidak dibuka/render visual pada tugas ini**: `pdftoppm`, `pdfinfo`, `mutool` tidak ditemukan; Python tidak menyediakan `fitz`, `pypdf`, `pypdfium2`, `pdfplumber`. Tidak memasang alat/dependensi. Catatan pemeriksaan PDF pada Brand adalah sumber sekunder, bukan hasil visual P0.
- Hash tiga modul grafik diperiksa langsung: SHA-256 semuanya `83DF129393E338C90423E0924D228A490684DAA627F862952FB231423C2FD1F6`.
- Pencarian terarah pada root/dokumen repo, `.taste/`, dan berkas teks `.emulator-data/` yang tersedia awalnya hanya menemukan penyebutan audit. `rg` tidak tersedia; fallback `Select-String`/parser JSON Python.
- Pesan pengguna/asisten sesi Codex 5–6 November diperiksa; isi audit ditemukan pada sesi `01a1af42-7233-75d3-a231-c81924783a96`, baris JSONL 265. Tidak menggunakan data pribadi anak nyata.
- Diagnosis hook membaca `.agents/skills/msa-coordination/SKILL.md` dan bagian terkait `.agents/hooks/{collab-guard,coord,policy}.mjs` secara read-only.

## Temuan terbuka

Sumber primer historis: `C:/Users/HYPE AMD/.codex/sessions/2026/11/06/rollout-2026-11-06T12-08-50-01a1af42-7233-75d3-a231-c81924783a96.jsonl:265`, pesan final audit, bagian “Temuan berdasarkan dampak”, nomor 4 dan 5. Status terbuka juga disebut pada `docs/status/2026-11-06-codex-pil-filter-focus.md`, bagian “Kebutuhan integrasi”.

| Temuan | Isi audit dan bukti saat ini | Tindak lanjut |
|---|---|---|
| **4 · P2: cincin fokus kurang kontras pada panel berwarna** | Audit: cincin biru 2,44:1 pada panel gelap Dasbor dan 1,16:1 pada panel merah Mentor. `ui/pil.css:5` masih memakai outline `var(--chart-1)`; token `#1d5f99` di `ui/pil-kit.css`. Hitungan ulang terhadap `#231f20` dan `#c81e1e`: **2,44:1 dan 1,16:1**, gagal 3:1. | Fokus terang/kombinasi cincin teruji pada panel berwarna; biru dapat dipertahankan pada putih. Uji keyboard/tangkapan putih, merah, gelap di P1. Belum diperbaiki. |
| **5 · P3: tombol nonaktif tampak seperti aksi utama aktif** | Audit: “Tinjau & selesaikan” memiliki `disabled=true` tetapi tetap merah-putih. `ui/pil.css:5` masih memuat `.btn.primary` (specificity 0,2,0) yang mengungguli `button:disabled` (0,1,1) untuk background/color/border. Perilaku browser dari audit historis, belum direproduksi pada P0. | Keadaan disabled khusus primary memakai token nonaktif/alasan existing; uji aktif/nonaktif pada P1. Belum diperbaiki. |

Kedua temuan ditemukan dari pesan audit, bukan dugaan. Hitungan kontras/cascade diperiksa saat ini; hasil browser historis bukan hasil pengujian baru.

## Verifikasi aktual

- Root/branch/status, `git rev-parse HEAD`, `node .agents/hooks/coord.mjs status`: sesuai worktree delegasi, klaim dua path tugas. Penugasan eksplisit menjadi dasar bekerja di worktree ini.
- Skrip Node stdin menghitung **27 pasangan warna** memakai rumus WCAG dan nilai CSS aktual; hasil relevan ada pada draf lampiran. Dua pasangan fokus gagal 3:1.
- Draf brief **114 baris**, memenuhi target ≤150; pemeriksaan Python memastikan tiga bagian kontrak/integrasi/serah terima tersedia dan tidak ada trailing whitespace.
- `git diff --check`: **lulus, exit 0**. Karena laporan baru belum tracked, `git diff --no-index --check -- NUL docs/status/2026-11-06-codex-p0-acuan-pil.md` juga dijalankan: **lulus, exit 0**. Diff BRIEF kosong, sesuai penolakan hook. Git hanya memberi peringatan normalisasi LF/CRLF untuk berkas lokal yang sudah berubah; tidak mengubah konfigurasinya.
- Tidak menjalankan suite runtime/unit, `npm.cmd run check`, emulator/browser atau tangkapan 360/390/768/1365 karena dokumen saja.

## Risiko dan pertanyaan terbuka

- **Hook memblokir BRIEF:** penolakan `collab-guard:OUT_OF_SCOPE` menyebut `docs/ui-overhaul/brief.md`, sedangkan scope tugas `codex-p0-acuan-pil` tersimpan `docs/ui-overhaul/BRIEF.md`. Pemeriksaan fixed scope di `.agents/hooks/coord.mjs:109` memakai perbandingan string case-sensitive; path tool dinormalisasi melalui canonical di `collab-guard.mjs:113`. Ini diagnosis ketidakcocokan kapitalisasi, bukan perluasan lingkup pengguna.
- Tidak mencoba melewati hook, mengganti ID/PID, memaksa pelepasan, atau mengubah state/config. Skill koordinasi tidak memberi izin bypass.
- PDF/D0/komposisi layar belum diperiksa ulang secara visual; rekonsiliasi lampiran bersumber catatan Brand/blueprint. Perlu pemeriksaan visual sebelum menerapkan P1.
- Audit 4–5 tetap terbuka; prototipe lain menunggu keputusan pensiun/arsip; P6 tetap terblokir API agregat.
- Git memperingatkan tidak dapat membaca `C:/Users/HYPE AMD/.config/git/ignore`; perintah baca tetap selesai, konfigurasi tidak diubah.

## Serah terima

- Codex menyerahkan laporan/draf kepada orkestrator Claude; **P0 belum lengkap**, menunggu scope diperbaiki dan BRIEF diterapkan.
- Baseline `6e81d236fe8b394adfa9c50ef3e50b0a7148e677`; branch `agent/codex-p0-acuan-pil`; lingkup dua path yang diminta.
- Perubahan lokal sebelumnya dipertahankan: `.agents/bin/delegate.mjs`, `.agents/hooks.json`, `.agents/hooks/{collab-guard,coord,policy,workspace-lock}.mjs`, `.agents/skills/beads/{SKILL.md,agents/openai.yaml}`, `.agents/skills/msa-coordination/SKILL.md`, `.agents/skills/no-ai-slop/{SKILL.md,eval.md}`, `.codex/config.toml`. Tidak disentuh.
- Agen penerima membaca ulang status/diff/isi terbaru sebelum menulis. Tidak ada proses server/background dari tugas ini.

## Untuk peninjau

- Fokus: keakuratan sumber/kontras/temuan, hierarki acuan, pelestarian bagian 2 lama, batas bukti PDF dan status terblokir.
- Laporan ini baru/untracked; baca langsung. `git diff 6e81d236fe8b394adfa9c50ef3e50b0a7148e677 -- docs/ui-overhaul/BRIEF.md` seharusnya kosong.

## Jawaban atas tinjauan

Belum ada tinjauan independen yang diminta untuk P0 ini.

## Usulan commit

Summary: `docs(ui): record the Pil brief draft and open audit findings`
Description:

- Prepare the Pil brief draft and record the scope hook blocker.
- Recalculate color contrast and recover the two open audit findings.
- Document source verification limits and the orchestrator handoff.

## Lampiran: pengganti BRIEF.md siap diterapkan

Draf berikut belum aktif; salin isinya secara utuh ke BRIEF setelah scope diperbaiki, lalu jalankan diff check. Bukan izin menerobos hook.

```markdown
# UI Overhaul MSA: satu sistem Pil

Keputusan pengguna: **Pil satu-satunya arah visual; C10 historis.** P0 menyelaraskan acuan; P1–P6 masih **PLANNED / NOT IMPLEMENTED oleh tugas ini**, masing-masing memerlukan penugasan terpisah. Prototipe tidak membuktikan migrasi halaman operasional selesai.

## 1. Tujuan, tahapan, dan acuan

| Fase | Hasil yang dituju |
|---|---|
| P0 | Selaraskan acuan Pil, tandai C10 historis, dokumentasikan temuan terbuka. |
| P1 | Pustaka komponen Pil bersama `ui/msa-*`, galeri seluruh keadaan, konsolidasi grafik. |
| P2 | Jalur Mentor: beranda dan absensi, mempertahankan controller/kontrak yang ada. |
| P3 | Masuk, daftar, dan pemulihan melalui handler yang ada. |
| P4 | Portal Admin, Pelayanan, dan Kalender. |
| P5 | Migrasi Admin B/C/E sesuai `PLAN-migrasi-admin.md`; cutover server oleh penanggung jawab yang ditugaskan. |
| P6 | Dasbor kehadiran/Volunteer: **terblokir API agregat berizin** dan keputusan Fase D; fixture bukan data operasional. |

| Acuan | Kedudukan |
|---|---|
| `mockup ui_ux/D0 · Panduan gaya Pil (guideline).pdf` | Sistem visual Pil. |
| `mockup ui_ux/ABC Ministry Service App · Mockup UI-Dashboard Mentor.pdf` | Komposisi layar Mentor, absensi, dan dasbor. |
| `mockup ui_ux/ABC Ministry Service App · Mockup UI-Dekstop sign-in, homepage admin.pdf` | Komposisi masuk desktop dan Admin; ejaan berkas dipertahankan. |
| `mockup ui_ux/ABC Ministry Service App · Mockup UI-Welcome, Sign-in, absensi.pdf` | Komposisi welcome, masuk, absensi, kalender, dan keadaan antarmuka. |
| `ui/msa-tokens.css` | **Sumber kebenaran nilai token bersama**; jangan menjadikan token prototipe yang berbeda sebagai standar kedua. |
| `index.html` + `ui/pil*` | Referensi implementasi hidup dengan fixture; bukan halaman operasional. |
| `.taste/brand.json`, `.taste/page.json` | Catatan pemeriksaan PDF terdahulu dan blueprint komposisi/grid; bukan hasil tes saat ini. |
| `docs/ui-overhaul/C10-lembar-komponen.pdf`, `C10-preview.png`, `C10-ADDENDUM.md` | **Historis**, tetap disimpan di `docs/ui-overhaul/`; bukan acuan pekerjaan baru. |
| `AGENTS.md`, `MASTER_BRIEF.md` | Aturan kerja/domain mengungguli brief ini. |
| `docs/ui-overhaul/INVENTORY.md`, `docs/status/2026-11-06-claude-rencana-ui-ux.md` | Peta hook/teks tes historis dan rencana P0–P6; cocokkan dengan sumber saat implementasi. |
| `PROJECT_STATUS.md` | Baca status terkini di bagian teratas, bukan seluruh riwayat. |

**Batas bukti P0:** empat PDF ditemukan, tetapi belum dibuka/render visual pada tugas ini (renderer lokal tidak tersedia). Uraian D0/mockup berasal dari `.taste/brand.json`/`page.json` serta rencana induk, bukan verifikasi PDF langsung. Nilai token, CSS prototipe, dan hash modul grafik diperiksa langsung; kontras dihitung ulang.

## 2. Batas lingkup (wajib)

1. **Hanya lapisan tampilan:** HTML markup, CSS, aset statis, dan kode render di JS (pembuatan elemen, class, teks). Tidak mengubah `backend/`, API, kontrak request/response, autentikasi, sesi, proof perangkat, otorisasi, aturan absensi, histori, atau gate/flag.
2. **Pertahankan hook:** `id`, `name`, `data-*`, atribut ARIA yang dibaca JS/tes, struktur form, rute hash (`/#masuk` dan lainnya) dan URL halaman. Bila hook harus dipindah, catat di laporan.
3. **Teks yang dipakai assertion tes** boleh diubah hanya bila tes yang sama diperbarui di bagian kerja yang sama dan dicatat (lama → baru).
4. **Perubahan server statis** (`server.mjs` atau daftar file yang diizinkan) hanya sebatas mengizinkan berkas CSS/font/ikon baru. Tidak mengubah header keamanan, CORS, atau rute API.
5. **Kejujuran data:** tidak menampilkan angka, grafik, atau fitur yang tidak didukung API. Grafik Pil dengan fixture hanya di prototipe/galeri P1 sampai ada endpoint agregat yang disetujui. Menu "Riwayat" Mentor hanya dipasang bila rutenya sudah ada; jika belum, hilangkan dan catat.
6. **Halaman legacy** (`admin.html` dengan `styles.css`; sedang dimigrasikan, lihat `PLAN-migrasi-admin.md`) di luar lingkup kecuali disebut eksplisit dalam P5.
7. Tidak menambah dependensi npm, framework, CDN, atau build step. Tetap vanilla HTML/CSS/ES modules.
8. Tidak commit, merge, push, atau deploy tanpa izin eksplisit.

P0 **dokumen saja**; batas tampilan di atas tidak memberi izin menyunting implementasi pada P0.

## 3. Sistem visual Pil

Nilai berikut dibaca dari `ui/msa-tokens.css`; peran komposisi mengikuti catatan D0/mockup tersebut.

| Token | Nilai | Peran |
|---|---|---|
| `--surface-200`, `--surface-100` / `--surface-soft` | `#ffffff` / `#f6f6f6` | Kanvas/kartu/nav putih; isian dan bidang sekunder abu muda. |
| `--ink`, `--ink-muted` | `#231f20`, `#5c5350` | Teks utama, fokus gelap / teks sekunder. |
| `--primary`, `--primary-hover`, `--on-primary` | `#c81e1e`, `#a31717`, `#ffffff` | Aksi/fokus merah dengan teks putih. |
| `--accent-yellow`, `--accent-3`, `--on-accent` | `#f8ed32`, `#64a4d9`, `#231f20` | Pil aktif/Draf/Izin; Terbit/grafik biru; keduanya memakai tinta. |
| `--accent-3-text`, `--focus-ring` / `--blue-pale` | `#1d5f99` / `#dae9f6` | Biru teks/fokus pada permukaan terang / bidang biru pucat. |
| `--line`, `--control-border` | `#e8eaec`, `#857a76` | Pemisah dekoratif / batas kontrol yang dapat dikenali. |
| `--disabled-bg`, `--disabled-ink` / `--logo-red` | `#f6f6f6`, `#5c5350` / `#ee2525` | Nonaktif dengan alasan / logo asli, bukan teks kecil. |

**Bentuk dan ukuran:** pil 999px, ubin/baris 32px, kartu besar/sheet 40px, avatar lingkaran. Tombol utama 60px, kontrol/target sentuh minimal 48px, input 56px, baris siswa minimal 64px, centang 48px, avatar token 44px. Nav 72px, clearance 112px ditambah safe-area; konten terakhir dan kontrol bebas nav/keyboard. Kartu diam tanpa bayangan; bayangan hanya overlay/nav mengambang.

**Tipografi:** Baloo 2: judul layar 800 28/32, sapaan/angka 800 32/36, judul bagian 700 20/24. Nunito Sans: tombol 800 16/20, isi/input 400 16/24, keterangan 600 14/20, label 700 12/16; sentence case, tanpa tracking kapital. Font lokal beserta OFL; angka berubah memakai `tabular-nums`. Logo asli dan ikon Lucide lokal beserta lisensi dipertahankan.

**Jarak dan grid** (`.taste/page.json`): skala token 4/8/12/16/24/32px; baris terkait 8px, gap kolom 16px, kelompok 24px, padding kartu 16–24px. Desktop 1440 = sidebar 272 + gutter 40 + kanvas 1088 + gutter 40; 12×76 + 11×16 = 1088; tiga kolom 352, dua kolom 536, atau pasangan 720+16+352. Pada 1365 kanvas 1013px memakai `fr`. Masuk tanpa sidebar: media 700 + gap 80 + form 440 + sisa kanan 140 dalam kanvas 1360. Ponsel sisi 24px, boleh 16–20px pada 360 jika diperlukan; tanpa overflow halaman.

**Navigasi:** desktop >1100 memakai sidebar putih 272px, item aktif pil kuning; 641–1100 memakai menu sheet (Escape, focus trap, fokus kembali). Ponsel ≤640 memakai nav pil putih mengambang inset 16px + safe-area, aktif kuning, aksi pusat gelap sesuai peran. Absensi mengganti nav dengan bilah aksi tugas; autentikasi tanpa nav aplikasi. Tujuan disaring menurut capabilities/rute nyata; hash prototipe tidak mengganti rute operasional.

**Komponen P1:** tombol merah atau gelap sesuai layar (satu aksi utama), sekunder putih/abu, ikon 48px; input kapsul dengan label tetap; tab segmen berjumlah dengan target utuh dan scroll internal; kartu pelayanan bertanggal (hari/tanggal/bulan, sekolah/program, judul, tempat, PIC, status); baris siswa berinisial + status berikon/teks; ubin statistik berunit/cakupan jelas. Draf kuning, Terbit biru, Dibatalkan netral; Hadir/Izin/Tidak hadir/Belum diisi mengikuti enum controller, bukan warna saja.

**Keadaan dan grafik:** header/konteks tetap saat kosong, memuat (bidang abu tanpa shimmer), galat berikon/pesan/pemulihan, nol, nonaktif, dan offline. Nol berbeda dari belum tersedia; simpan berhasil hanya setelah konfirmasi server, tanpa antrean otomatis baru. Grafik fixture berlabel contoh, nilai/skala/cakupan tertulis; biru muda berbatas gelap, periode terpilih kuning bertepi tinta. Grafik operasional menunggu P6. Feedback 180ms `cubic-bezier(0.2,0,0,1)`, tanpa entrance/count-up; reduced motion langsung. Teks Indonesia, istilah **Volunteer** dipertahankan; foto mengikuti slot Visual Studio, placeholder PDF bukan aset final.

## 4. Kontras Pil (dihitung ulang 6 November 2026)

Rumus WCAG: kanal sRGB `c=kanal/255`; linear `c/12,92` bila `c≤0,04045`, selainnya `((c+0,055)/1,055)^2,4`; `L=0,2126R+0,7152G+0,0722B`; rasio `(Lterang+0,05)/(Lgelap+0,05)`. Dua desimal; teks biasa ≥4,5:1, teks besar ≥3:1, batas/indikator kontrol ≥3:1 terhadap warna bersebelahan.

| Pasangan depan / belakang | Rasio | Keputusan |
|---|---|---|
| ink / putih; muted / putih; muted / soft | 16,30; 7,48; 6,92 | Lulus teks biasa, termasuk token nonaktif. |
| putih / primary; / primary-hover; / ink | 5,74; 7,80; 16,30 | Lulus teks biasa pada fokus merah/gelap. |
| ink / kuning; / biru muda; / blue-pale | 13,31; 6,10; 13,17 | Lulus teks biasa. |
| biru teks/fokus / putih; / blue-pale | 6,67; 5,39 | Lulus pada permukaan terang ini. |
| control-border / putih; / soft; line / putih | 4,16; 3,85; 1,21 | Control-border lulus; line hanya pemisah dekoratif. |
| biru muda / putih; kuning / putih; logo-red / putih | 2,67; 1,22; 4,26 | Biru/kuning bukan teks di putih dan perlu batas mark; logo-red bukan teks kecil. |
| fokus biru / ink; / primary | **2,44; 1,16** | Gagal 3:1; wajib fokus terang/kombinasi cincin teruji di panel berwarna (audit 4 terbuka). |
| putih / primary (tombol disabled prototipe) | 5,74 | Lulus kontras tidak membuktikan keadaan nonaktif jelas; audit 5 terbuka. |
| Prototipe: control `#868485` / putih; / soft | 3,71; 3,44 | Lulus batas; berbeda dari token bersama, selaraskan P1. |
| Prototipe: positif `#1e7b4f`, galat `#c4242a`, peringatan `#92400e` / putih | 5,25; 5,78; 7,09 | Lulus teks; bukan token bersama baru yang disetujui. |
| Prototipe: `#04250e/#dcfae5`; `#831c1e/#ffedea`; `#353736/#ebedee` | 14,77; 8,63; 10,21 | Pasangan status lulus; hanya bila keadaan sistem mendukung. |

Pasangan baru/latar berbeda wajib dihitung lagi. Rasio token bukan audit a11y seluruh layar. Isi audit 4–5 beserta sumber sesi dicatat di laporan P0.

## 5. Beda D0 vs mockup layar

Rekonsiliasi berikut bersumber **catatan pemeriksaan terdahulu** `.taste/brand.json`/`page.json`; belum diverifikasi ulang dari PDF pada P0.

| Beda | Keputusan |
|---|---|
| Aturan umum satu kartu merah vs fokus gelap pada Absensi/Volunteer di mockup | Komposisi layar menang; jangan memaksakan kartu merah. Tetap satu fokus utama. |
| Pola navigasi umum vs masuk tanpa sidebar dan absensi dengan bilah tugas | Ikuti komposisi layar; jangan menambah nav/FAB yang bersaing dengan tugas. |
| Peta D0 belum memuat Jadwal Mentor, Riwayat, Akun, Daftar Volunteer, Tinjauan sebelum selesai; blueprint memiliki tujuan/tautan | Tautan bukan desain lengkap; pakai alur existing/minimal sesuai tugas, tanpa mengarang fitur. |
| Ukuran/warna visual vs a11y dan keamanan | Komposisi layar menang atas aturan umum D0; target ≥48px, kontras, fokus, label, otorisasi server, privasi/histori tetap wajib. |

## 6. Prototipe lain

`ui-absen.html` (Geist, krem `#f8f5ec`) dan `ui-review.html` **bukan acuan**; status **menunggu keputusan pengguna (pensiun/arsip)**. Tidak dihapus pada P0. `ui/pil-charts.js`, `ui/absen-charts.js`, `ui/review-charts.js` identik SHA-256; konsolidasi dijadwalkan P1.

## 7. Verifikasi dan laporan per fase

- **P0 dokumen:** `git diff --check`; hitung kontras, periksa sumber/batas bukti. Tidak perlu suite runtime.
- **P1–P6 yang mengubah kode:** `npm.cmd run check`, `npm.cmd test`, `git diff --check`; tambahan `node tests/pil-browser.mjs`, `node --test tests/ui-tokens.test.mjs` sesuai area.
- Suite brief lama: masuk/daftar → `tests/msa-portal-focus*.mjs`, `tests/msa-portal-browser.mjs`, `tests/auth-pilot-browser.mjs`, `node tests/stage3.mjs --a2-2` dan `--visual`; Mentor → `--a2-3`, `--a2-4a`; portal → `--a1`, `--stage8`, `--stage9b2`, `--a2-4b`, `--a2-4c`; akhir → `npm.cmd run test:stage6`. Flag singkat merujuk `node tests/stage3.mjs`; cocokkan runner aktual saat fase dimulai.
- Tangkapan Chrome **360/390/768/1365px** sebelum/sesudah layar yang diubah: tanpa overflow, target ≥48px, fokus kontras/utuh setelah render, label filter utuh, disabled jelas, reduced motion, konten bebas nav/bilah aksi/keyboard. Namespace `test-*`, data fiktif, port terisolasi.
- Tes gagal tidak diatasi dengan menambah timeout/melemahkan assertion tanpa akar masalah. Pisahkan hasil langsung/historis; catat perangkat fisik, Safari/iOS, screen reader, emulator, cache PWA yang belum diuji.
- Laporan `docs/status/` mengikuti template/`AGENTS.md`: kontrak berubah, kebutuhan integrasi, serah terima, hook/teks tes lama → baru. Integrator menangani `sw.js`, daftar statis `server.mjs`, `PROJECT_STATUS.md` setelah integrasi yang diminta; worker P0 tidak menyuntingnya.
```
