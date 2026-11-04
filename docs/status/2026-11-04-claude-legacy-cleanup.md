# Pembersihan legacy tahap aman

Agen: Claude · Branch: claude/legacy-cleanup · Basis: development @ f9e6c3c · Tanggal: 2026-11-04
Status: PARTIAL (hanya bagian aman; sisanya diserahkan ke Codex) · Produksi: NO-GO

## Ringkasan
Berkas tanpa pemakai dihapus dan AGENTS.md diperbaiki supaya agen tidak lagi menjadikan PWA "ABC Attendance" lama sebagai acuan UI. Kode aplikasi, server, tes, dan `sw.js` tidak disentuh.

## Perubahan
- `SKILL.md`, `eval.md` (root): dihapus. Salinan lama skill no-ai-slop (`0387fcc`); versi berlaku ada di `.agents/skills/no-ai-slop/`. Tidak dirujuk kode atau dokumen lain.
- `screenshots/mentor-pairing-{activation,active,desktop}.png`: dihapus. Tidak dipakai tes atau kode; hanya disebut di riwayat PROJECT_STATUS (masih ada di riwayat Git).
- `AGENTS.md` baris 34: daftar halaman aktif dibuat eksplisit. `admin.html`, `a1.html`, `styles.css` ternyata masih aktif. Ditambahkan juga bahwa UI Mentor aktif ada di `/mentor-account.html`, sedangkan `/` pada 4176 dan 4173 masih PWA lama.
- Branch lokal tanpa commit unik terhadap `development` dihapus (`git branch -d`): `claude/collab-codex-hook`, `claude/collab-guard-hook`, `claude/collab-v2`, `claude/u4-portal-shell`, `claude/u5-mentor-attendance`. Branch remote tidak disentuh.

## Kontrak yang berubah
Tidak ada.

## Kebutuhan saat merge (untuk integrator)
- Versi cache `sw.js`: tidak
- Modul baru di `server.mjs`: tidak
- Baris indeks `PROJECT_STATUS.md`: "Pembersihan legacy aman: hapus salinan skill root dan 3 tangkapan lama, AGENTS.md menunjuk UI Mentor aktif (`docs/status/2026-11-04-claude-legacy-cleanup.md`)."

## Verifikasi aktual
- `npm.cmd run check`: 240 berkas JS/MJS lulus.
- `npm.cmd test`: 225/225 lulus.
- Belum diuji: suite emulator/browser (tidak relevan, tidak ada kode yang berubah).

## Diserahkan ke Codex (tidak dikerjakan Claude: path server/tes)
1. `server.mjs:33`: mode mentor memetakan `/` ke `mentor.html` (PWA lama). Arahkan ke `mentor-account.html`, lalu hapus `mentor.html`.
2. Berkas yang hanya dimuat PWA lama (dari `index.html`/`mentor.html`/`app.js`, tidak dimuat halaman atau server aktif): `index.html`, `mentor.html`, `app.js`, `assignment-ui.js`, `birthday-ui.js`, `birthdays.js`, `pairing-ui.js`, `reports.js`, `student-import.js`, `xlsx-reader.js`, `xlsx.js`, plus `sw.js` dan `manifest.webmanifest`. Tes unit dan rute untuk berkas-berkas ini harus ikut disesuaikan.
3. **Ralat** untuk `docs/status/2026-11-04-claude-permintaan-hapus-pwa-lama.md` (branch `claude/u6b-modul-admin`): `data.js`, `student-data.js`, `dates.js`, `group-config.js`, `service-config.js`, `scheduling.js`, `service-ui.js`, `assignments.js`, `pairing-client.js`, `device-storage.js`, `secure-mentor.js`, `mentor-attendance.js` **jangan dihapus**. Semuanya dimuat `mentor-account.js` atau `backend/`.
4. Allowlist `assets/msa-visual-{welcome,auth,dashboard,program,campaign}.jpg` (`server.mjs`, `admin-server.mjs`, `msa-visual.js`, `visual-studio.js`): berkasnya tidak ada di repo. Perlu dipastikan ini slot unggahan atau rujukan mati.

## Risiko dan pertanyaan terbuka
- Skrip `test:stage4`/`test:stage5` (alias stage3) dibiarkan karena masih dirujuk di bagian riwayat QA.md.
- `Test ABC Attendance.cmd` dibiarkan; nama dan teksnya usang, tetapi masih dirujuk QA.md.
- Branch remote yang sudah ter-merge dan PR #2/#3 (OPEN ke `main`) menunggu keputusan pengguna.

## Untuk peninjau
- Diff: `git diff development...claude/legacy-cleanup`

## Jawaban atas tinjauan
-

## Usulan commit
Summary: Bersihkan berkas legacy tanpa pemakai dan perjelas UI aktif di AGENTS.md
Description: Hapus salinan lama skill no-ai-slop di root (SKILL.md, eval.md) dan tiga tangkapan mentor-pairing yang tidak dipakai. AGENTS.md kini menyebut halaman aktif secara eksplisit dan menandai rute / Mentor 4176 sebagai PWA lama. Tidak ada perubahan kode aplikasi. check 240 berkas, test 225/225.
