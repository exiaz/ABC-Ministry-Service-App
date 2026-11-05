# ABC Attendance — status revisi

## 5 November 2026 — Lock otomatis dan koordinasi sesi agent

**IMPLEMENTED / TESTED pada hook lokal dan fixture Windows.** Lock workspace per sesi, penolakan stale edit, lifecycle pelepasan setelah tool selesai, dan pemulihan operator bertoken ditambahkan. Skill koordinasi dibagi oleh Claude/Codex; state runtime diabaikan Git. Unit 249/249, native tambahan 3/3 dan pemeriksaan sintaks/import 249 berkas lulus. Aktivasi/trust pada dua sesi AI interaktif baru belum diuji; tinjau `/hooks` sebelum pemakaian. Batas dan bukti: [laporan workspace lock](docs/status/2026-11-05-codex-workspace-lock.md). Produksi aplikasi: NO-GO.

## 5 November 2026 — Kebijakan ignore dan aturan agent bersama

**IMPLEMENTED / TESTED untuk kebijakan Git dan regresi hook.** Sumber desain/lisensi tetap tracked; hasil alat lokal diabaikan melalui daftar pengecualian eksplisit. `AGENTS.md`, workflow Claude dan template serah terima diselaraskan untuk satu penulis aktif. Tes ignore/hook 6/6 dan pemeriksaan sintaks/import 247 berkas lulus; validator resmi skill belum berjalan karena PyYAML tidak tersedia. Bukti dan batas: [laporan kebijakan agent](docs/status/2026-11-05-codex-agent-ignore-policy.md). Tidak ada file lock otomatis; produksi tetap NO-GO.

## 5 November 2026 — Konsolidasi workspace Claude dan Codex

**IMPLEMENTED untuk integrasi non-destruktif; cleanup destruktif ditunda.** Workspace aktif tunggal `abc-ministry-service-app`; API XLSX pilot, absensi P1, fixture regresi dan pratinjau fiktif digabungkan tanpa mengubah branch/index atau sumber. Hook bersama di `.agents/hooks/`, `CLAUDE.md` mengimpor `AGENTS.md`. Cache v17. Verifikasi dan batas aktual: [laporan konsolidasi](docs/status/2026-11-05-codex-workspace-consolidation.md). Produksi: NO-GO.

## 5 November 2026 — UI-OVERHAUL U6a + U6b: beranda portal, pelayanan, kalender, modul pengelolaan

**IMPLEMENTED (lapisan tampilan saja).** U6a: beranda portal, pelayanan, kalender. U6b: modul pengelolaan (render saja) dan polish komponen bersama. Rincian dan hasil tes: `docs/status/2026-11-04-claude-u6a-beranda-pelayanan-kalender.md`, `docs/status/2026-11-04-claude-u6b-modul-pengelolaan.md`, `docs/status/2026-11-04-claude-polish-komponen-bersama.md`. `sw.js` cache naik ke `abc-school-v16`. `auth-pilot-browser` belum terbukti lulus; kegagalan lama di `development` tetap. Produksi: NO-GO.

## 4 November 2026 — UI-OVERHAUL U4 + U5: kerangka portal; beranda Mentor dan absensi

**IMPLEMENTED (lapisan tampilan saja); diuji pada emulator dan Chrome.** U4: sidebar/nav bawah + FAB, menu akun, banner pilot. U5: beranda Mentor (sapaan, strip hari pelayanan, kartu pelayanan + Mulai absensi, chip perangkat, kartu cadangan) dan absensi (x/y hadir, pencarian, tab segmen, baris siswa ≥64 dengan centang 48, CTA lengket, banner offline). Rincian, kontrak yang berubah dan hasil tes: `docs/status/2026-11-03-claude-u4-kerangka-portal.md` dan `docs/status/2026-11-04-claude-u5-beranda-absensi.md`. `sw.js` cache naik ke `abc-school-v15`. Kegagalan lama di `development` (bukan dari U4/U5): 7 tes `msa-stage9b2.test.mjs`, `device-management-ui`, `msa-stage9b2-ui`. Produksi: NO-GO.

## 3 November 2026 — UI-OVERHAUL U3: layar Welcome, Masuk, Masuk Mentor, Daftar, permintaan pemulihan

**IMPLEMENTED (lapisan tampilan saja); diuji pada pilot emulator dan Chrome.** Layar memakai komponen `ui-*` (U2) lewat `ui/msa-auth.css` (baru): ponsel = foto slot Visual Studio full-bleed di atas dan sheet putih radius-xl; desktop = foto latar penuh dan kartu ±760px (form kiri, panel Petunjuk Mentor kanan). Logika autentikasi, endpoint, rute hash, id dan name tidak diubah. Penggantian string server (`<body class="mentor-account">`, `id="account-login" class="panel"`, `<!--MENTOR_SESSION_OPTION-->`, `</form>` pertama) tetap cocok. Slot foto `welcome` tetap satu elemen: pada layar masuk, `#portal-welcome` dirender (tinggi 0) hanya untuk fotonya, sebab slot ganda membuat `msa-visual.test.mjs` gagal.

**Hook/teks yang berubah:** tidak ada hook dipindah. Kelas lama `.secondary` pada `#portal-show` dan `.btn` pada `#account-show-password` diganti `ui-btn`; kelas `primary` pada tombol Masuk Mentor dipertahankan. Teks: tautan Welcome `Buat Akun Mentor` -> `Daftar sebagai Volunteer`; tombol sandi Mentor `Tampilkan kata sandi` -> `Tampilkan` (aria-label tetap lengkap; `mentor-account.js`). Kelas CSS lama khusus layar auth dihapus dari `msa-visual.css`, `msa-shell.css`, `mentor-account.css`, `msa-intake.css`; aturan generik portal diberi `:not(.ui-btn)`/`:not(.ui-input)`. `ui/msa-components.css`: reduced-motion kini `transition-duration:0s` (diminta `msa-portal-browser.mjs:165`).

**Verifikasi aktual:** `npm.cmd run check` 239 berkas; `npm.cmd test` 224/224. `node tests/stage3.mjs --a2-2`, `--a2-3`, `--a2-4b`, `--visual` lulus. `node --test tests/msa-portal-focus-browser.mjs` dan `tests/msa-portal-browser.mjs` lulus (tangkapan 360/390/768/1365 di `.emulator-data/`). `tests/auth-pilot-browser.mjs`: seluruh alur UI lulus ("PASS pilot browser"), tetapi blok `finally` gagal karena `Stop MSA.cmd` keluar kode 1 (tes baris 83); belum dibandingkan dengan `ui/overhaul` bersih.

**Belum diuji / batas:** perangkat fisik, screen reader, browser selain Chrome. Halaman pemulihan: hanya bagian permintaan yang dirombak (ruang peninjau masih gaya lama, tanpa foto/sheet). Foto memakai placeholder `msa-visual-default.jpg`.
## Arsip

Entri sebelum 3 November 2026 (AUTH-SESSION 1A dan sebelumnya) dipindahkan utuh ke [docs/status/archive/PROJECT_STATUS_RIWAYAT.md](docs/status/archive/PROJECT_STATUS_RIWAYAT.md). Baca hanya bila perlu bukti historis.
