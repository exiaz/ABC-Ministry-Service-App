# Migrasi Admin Fase A: Pengguna & izin (a1.html → msa-users.html)

Agen: Claude · Branch: development · 2026-11-05 · Status: IMPLEMENTED (rename + rujukan) · Produksi: NO-GO
Rencana induk: [PLAN-migrasi-admin.md](../ui-overhaul/PLAN-migrasi-admin.md)

## Temuan yang mengubah rencana
`a1.html` sudah berkulit baru sejak U6b (`ui-root ui-admin`, tanpa `styles.css`). Fase A karena itu hanya penggantian nama halaman dan semua rujukannya, bukan penulisan ulang UI. Logika `msa-users.js` dan API `/api/a1/*` tidak diubah.

## Perubahan
- `a1.html` → `msa-users.html` (isi tidak berubah).
- Rujukan diganti: `admin-server.mjs` (asset map, gate A1, tautan pemulihan), `backend/msa-portal-session.mjs` (href nav, satu string), `msa-session.js` (ikon + grup nav), `secure-admin.js` (tautan), `local-auth-pilot-ui.mjs`, README, `MSA_ACCOUNT_ARCHITECTURE.md`, `AGENTS.md` dan `docs/ui-overhaul/BRIEF.md` (daftar halaman legacy), dan tes: `tests/msa-branding.test.mjs`, `tests/msa-portal-browser.mjs`, `tests/emulator/msa-a1.test.mjs`, `msa-a1-ui.mjs`, `msa-a2-2-ui.mjs` (hanya path `/a1.html` → `/msa-users.html`).
- Tidak diubah: id/name/data-*, ARIA, endpoint `/api/a1/*`, nama file `msa-users.js`, kelas CSS `a1-users` (jargon tahap lama; ganti nanti bila perlu).

## Kontrak yang berubah
URL halaman Pengguna & izin: `/a1.html` → `/msa-users.html` (origin Admin/portal). `/a1.html` kini 404. Href nav portal ikut berubah.

## Kebutuhan integrasi
- `admin-server.mjs` dan `backend/msa-portal-session.mjs` (area Codex) hanya disentuh pada string path; mohon ditinjau saat integrasi.
- `PROJECT_STATUS.md` belum diperbarui.

## Verifikasi aktual
- `npm.cmd run check` 242 berkas lulus; `npm.cmd test` 249/249.
- `node tests/stage3.mjs --a1` dan `--a2-2` lulus (Chrome + emulator).
- `node --test tests/msa-portal-browser.mjs` lulus 1/1 (±460 detik; navigasi superadmin/admin ke `/msa-users.html` ikut diuji). Percobaan pertama dengan batas 240 detik habis waktu karena tes memang panjang, bukan karena kegagalan.
- Investigasi baca-saja oleh Codex (Fase D): Jadwal memakai API server; Ringkasan, Riwayat, Data siswa, Kelompok, dan Ulang tahun hanya placeholder di `secure-admin.js` (saya memeriksa sebagian: baris 40–44 menunjukkan panel nyata hanya untuk perangkat, jadwal, akun, backup). Belum diverifikasi lewat browser/runtime.

## Batas
Tidak ada uji perangkat fisik/screen reader/browser selain Chrome. Dokumen historis (`docs/status/*`, `INVENTORY.md`, `PLAN`) masih menyebut `a1.html` sebagai catatan masa lalu.

## Serah terima
Baseline development @ fc4bc9a + perubahan lokal (penghapusan PWA tahap 1 masih ter-stage). Tidak ada commit/push/deploy.

## Usulan commit
Summary: Ganti nama halaman Pengguna a1.html menjadi msa-users.html
Description: Pindahkan rute dan semua rujukan (server admin, nav portal, tautan, dokumentasi, tes). Isi halaman dan API /api/a1 tidak diubah.
