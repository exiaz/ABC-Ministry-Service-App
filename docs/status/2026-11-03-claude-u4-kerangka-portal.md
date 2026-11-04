# UI-OVERHAUL U4 — kerangka bersama portal

Agen: Claude · Branch: claude/u4-portal-shell · Basis: development @ 8a9e4bf · Tanggal: 2026-11-03
Status: IMPLEMENTED · Produksi: NO-GO

## Ringkasan
`mountMsaShell` dibangun ulang: sidebar putih dengan item aktif kapsul kuning (desktop), navigasi bawah terang + FAB "Buat" (ponsel, ruang bawah 96px + safe-area), menu akun (Periksa ulang izin, Keluar), satu banner pilot yang dapat ditutup. Isi modul tidak didesain ulang (U6).

## Perubahan
- `msa-session.js`: shell memakai ikon sprite Lucide, kelas `ui-nav`, grup "Ruang kerja"/"Pengelolaan" tetap dari `profile.modules`. Ekspor baru `setMsaCreate(bool)`; FAB hanya bila canCreate (petunjuk di sessionStorage, dihapus saat `clearMsaShell`). `mountMsaShell` kini async dan memuat `ui/msa-tokens.css` + `ui/msa-components.css` bila belum ada (halaman modul). Menu akun di halaman modul: Periksa ulang = muat ulang; Keluar = POST `/api/portal/logout` yang sama dengan Beranda.
- `msa-shell.css`: aturan nav lama dibuang, blok U4 ditambah; kanvas krem; tautan "Beranda MSA" sisipan server disembunyikan lewat CSS (`:has`).
- `msa-portal.html/.js`: `#portal-actions` (berisi `#portal-refresh`, `#portal-logout`) dipinjam ke menu akun lalu dikembalikan saat shell dilepas; `action()` juga mengunci/membuka `#msa-account button`; `setMsaCreate` dipanggil dari hasil dashboard.
- `msa-events.js`: satu baris `setMsaCreate(canCreate)`.
- Tes: `msa-portal-browser.mjs` membuka `#msa-account > summary` sebelum klik `#portal-refresh`/`#portal-logout`; stub `msa-portal-focus.test.mjs` +`setMsaCreate`.

## Kontrak yang berubah
- Dihapus: `.msa-shell-name`, `.msa-shell-account`, `.msa-shell-local` (tidak dipakai tes). Ditambah: `#msa-account`, `#msa-create`, `#msa-pilot-banner`.
- `#portal-refresh`/`#portal-logout` kini di dalam `#msa-account` (perlu membuka menu dulu).
- `#msa-navigation a` tetap; `.msa-nav-primary a` tetap 3; `.msa-nav-group a` tetap 7 (Superadmin).

## Kebutuhan saat merge
- `sw.js`: tidak. `server.mjs`: tidak.
- Permintaan ke Codex/integrator (admin-server.mjs): hentikan sisipan `<p><a class="btn" href="/">Beranda MSA</a></p>`; kini hanya disembunyikan CSS.

## Verifikasi aktual
- `npm.cmd run check` lulus; `npm.cmd test` 224/224; `node --test tests/msa-portal-browser.mjs` 1/1 (Chrome, 4 lebar di `.emulator-data/msa-portal-qa/screenshots`).
- Belum diuji: suite `--stage8/--stage9b2/--a2-4b/--a2-4c`, `test:stage6`, perangkat fisik, screen reader, browser selain Chrome.

## Risiko dan pertanyaan terbuka
- Di Beranda `#portal-new` (diwajibkan tes tampak di 390px) ganda dengan FAB.
- Halaman modul masih punya tombol "Periksa ulang izin"/"Keluar" dan tab (`#calendar-nav`) sendiri; menyentuhnya = U6 (id dipakai tes).
- Banner pilot hanya di kerangka setelah masuk; layar masuk/selamat datang belum.
- Logout dari menu akun halaman modul memakai endpoint existing; mohon dicek Codex.

## Untuk peninjau
- Diff: `git diff development...claude/u4-portal-shell`

## Usulan commit
Summary: UI overhaul U4: kerangka portal (sidebar, nav bawah + FAB, menu akun, banner pilot)
Description: Shell portal dibangun ulang dengan token C10, FAB Buat hanya bila canCreate, Periksa ulang izin/Keluar dipindah ke menu akun, navigasi ganda dihapus. Tes portal diperbarui.
