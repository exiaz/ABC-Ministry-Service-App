# Rencana: pindahkan UI Admin legacy ke MSA baru

Agen: Claude · 2026-11-05 · Status: **PLANNED / NOT IMPLEMENTED** · Produksi: NO-GO
Rencana ini bukan izin implementasi. Tiap fase dimulai hanya atas persetujuan pengguna.

## Tujuan
Menghapus `admin.html`, `a1.html`, `styles.css`, dan modul `admin-*.js`/`secure-admin.js` lama tanpa menghilangkan fungsi Admin, dengan halaman `msa-*` berkulit `ui/` (`body.ui-admin`, token C10).

## Fakta saat ini (terverifikasi dari kode)
- Semua API yang dipakai UI lama **sudah ada di backend**: `/api/admin/{login,logout,session,pairing-context,pairing-codes,activation-codes,devices,accounts,backup-assignments,service-sessions}` dan `/api/a1/{login,logout,session,accounts,audit}`. Maka migrasi ini murni lapisan tampilan; **tanpa perubahan backend/auth** selama kontrak request/response dipertahankan.
- `admin.html` hanya cangkang (`#admin-root`); isinya dirender `secure-admin.js` + `admin-client.js` + modul per fungsi. Pada pilot, `admin-server.mjs` memetakan semua path non-portal ke `admin.html` (`usernamePilot`).
- `a1.html` + `msa-users.js` = Pengguna & izin akun (daftar, buat, ubah, audit). Ditaut dari `msa-session.js` (nav) dan `backend/msa-portal-session.mjs`.
- `secure-admin.js` memuat enam tab dasbor data (Ringkasan, Riwayat absensi, Jadwal, Data siswa, Kelompok & mentor, Ulang tahun) yang bersandar pada modul klien lama (`data.js`, `reports.js`, `birthdays.js`, dst.). **Belum diverifikasi** apakah tab ini memakai data server atau data seed lokal.
- Halaman `msa-*` yang sudah berkulit baru: `msa-core`, `msa-events`, `identity-review`, `account-recovery`, `migration-readiness`, `visual-studio`, `register`. `styles.css` masih dipakai `admin.html`, `mentor-account.html`.

## Fase (urut, tiap fase bisa berdiri sendiri)
| Fase | Isi | Sumber lama → baru | Risiko |
|---|---|---|---|
| 0 | Keputusan & pembekuan kontrak | daftar endpoint di atas dibekukan; tes kontrak | rendah |
| A | Pengguna & izin | `a1.html` + `msa-users.js` → `msa-users.html` (logika dipakai ulang, kulit `ui-admin`) | rendah: API sudah A1, tes `msa-accounts` ada |
| B | Perangkat & kode | `admin-devices/activation/backup.js` → `msa-devices.html` (kode pairing, aktivasi, daftar perangkat, cadangan penugasan) | sedang: dialog pencabutan, alasan wajib, konfirmasi |
| C | Akun & kalender | `admin-accounts.js`, `admin-calendar.js` → `msa-accounts.html`, gabung ke `msa-events` bila sesuai | sedang |
| D | Dasbor data (6 tab) | **Keputusan pengguna**: bangun ulang di API berizin, atau pensiunkan karena sudah digantikan `msa-core`/`msa-events`/absensi baru | tinggi: privasi siswa hanya lewat API admin berwenang |
| E | Cutover & pembersihan | hapus `admin.html`, `a1.html`, `styles.css` bila tak terpakai; ubah `admin-server.mjs` (asset map, `usernamePilot`), `msa-session.js`, `msa-portal-session.mjs`; sesuaikan tes | sedang: menyentuh server (milik Codex) |

## Aturan per fase
- Pertahankan `id`, `name`, `data-*`, ARIA, rute hash, URL, dan request/response (AGENTS.md). Teks assertion tes diubah bersama tesnya, dicatat lama → baru.
- Mobile-first 360/390/768/1365, target sentuh ≥48 px, kontras AA, status dengan ikon + teks, `prefers-reduced-motion`.
- Pembatasan peran di UI hanya tampilan; otorisasi tetap di server. Tidak menyiratkan izin yang tidak didukung API.
- Data fiktif saja. Tes memakai namespace `test-*` dan port terisolasi.
- Satu penulis aktif; fase E butuh serah terima ke Codex untuk `admin-server.mjs` dan `backend/msa-portal-session.mjs`.

## Verifikasi per fase
`npm.cmd run check`, `npm.cmd test`, `node tests/stage3.mjs --a2-3` (+ `--visual` bila menyentuh Visual Studio), tangkapan Chrome 360/390/768/1365, laporan di `docs/status/`.

## Keputusan terbuka untuk pengguna
1. Fase D: bangun ulang atau pensiunkan enam tab dasbor data lama? (Perlu pembuktian dulu apakah masih memakai data seed lokal.)
2. Boleh Fase E diserahkan ke Codex (server/auth) setelah A–C selesai?
3. Urutan: mulai dari Fase A (usulan, risiko terendah)?

## Yang tidak termasuk
Perubahan backend, auth, `firestore.rules`, model data; modul domain `data.js`/`scheduling.js` dkk. (masih dipakai login Mentor dan pratinjau absen) — dibahas terpisah setelah Fase E.
