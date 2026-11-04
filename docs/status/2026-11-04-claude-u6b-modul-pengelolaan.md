# UI-OVERHAUL U6b — modul pengelolaan

Agen: Claude · Branch: claude/u6b-modul-admin (dari claude/u6a-portal-pelayanan-kalender @ cae39b6; U6a belum di-merge) · Basis: development @ f9e6c3c · Tanggal: 2026-11-04
Status: IMPLEMENTED · Produksi: NO-GO

## Ringkasan
Organisasi & program, Pengguna & izin, Perangkat akun, Tinjauan identitas, Kesiapan migrasi, dan Visual Studio memakai token C10 lewat satu kulit bersama `ui/msa-admin.css` (dicakup `body.ui-admin`). Pemulihan sudah dikerjakan di U3 (antrean peninjau memakai `ui-*`); tidak ada perubahan. Hanya tampilan: alur, dialog konfirmasi, revisi/konflik, audit, dan kontrak API tidak diubah.

## Perubahan
- `ui/msa-admin.css` (baru): label di atas, kolom kapsul, tombol (bawaan = utama; `.secondary`/`.quiet`/`.btn` polos = sekunder; tombol batal di dialog = sekunder), kartu, dialog sheet, status (teks + bentuk; warna pendukung), centang 48 px, daftar padat di desktop dan satu kolom di ponsel. Memakai selektor elemen/kelas lama agar markup alur tidak berubah.
- `server.mjs`, `admin-server.mjs`: hanya menambah `ui/msa-admin.css` ke daftar berkas statis (BRIEF 2.4).
- `msa-core.html`, `a1.html`, `identity-review.html`, `migration-readiness.html`: link token/komponen/admin dan kelas body `ui-root ui-admin`. `a1.html`: `<style>` inline dan `styles.css` diganti kulit bersama (`styles.css` hanya dipakai untuk `.btn`); body `a1-users`. `migration-readiness.html`: `#migration-logout` diberi `class="secondary"`.
- `account-devices.css` ditulis ulang dengan token (cadangan nilai untuk halaman tanpa `.ui-root`); dipakai halaman Mentor dan Tinjauan identitas.
- `visual-studio.html/.css`: token C10 menimpa warna/bentuk lama; tata letak, id, dan pratinjau tidak diubah.
- `msa-shell.css`: aturan portal lama untuk Organisasi dan Pengguna dibuang (diganti kulit bersama).

## Kontrak yang berubah
- Semua `id`, `data-*`, ARIA, rute, dan teks yang dipakai tes dipertahankan; tidak ada JS alur yang diubah di bagian ini.
- `a1.html` tidak lagi memuat `styles.css` (halaman legacy lain tidak terpengaruh) maupun CSS inline lama.
- Centang/radio di halaman `ui-admin` kini lingkaran 48 px (`appearance:none`, tanda ✓ lewat CSS); tes mengharuskan kontrol ≥44 px.

## Kebutuhan saat merge
- `sw.js`: naik. `server.mjs` / `admin-server.mjs`: sudah menambah `ui/msa-admin.css` (periksa saat merge; bagian dari daftar berkas statis).
- Indeks `PROJECT_STATUS.md`: "UI-OVERHAUL U6b — modul pengelolaan (render saja); lihat docs/status/2026-11-04-claude-u6b-modul-pengelolaan.md".

## Verifikasi aktual
- `npm.cmd run check` lulus; `npm.cmd test` 225/225.
- Per modul (integrasi + Chrome di dalam suite): `--stage8` (Organisasi) lulus; `--a1` (Pengguna) lulus; `--a2-4a` (Perangkat) lulus; `--a2-2` (Tinjauan identitas) lulus; `--a2-4b` (Pemulihan, tanpa perubahan) lulus; `--a2-4c` (Migrasi) lulus; `--visual` lulus (tidak menjalankan Chrome) dan `tests/visual-image-client-browser.mjs` lulus.
- `node --test tests/msa-portal-browser.mjs` (semua rute portal, 4 lebar, tangkapan di `.emulator-data/msa-portal-qa/screenshots`) lulus. `msa-portal-focus-browser` lulus. `auth-pilot-browser` (pilot interaktif, memakai otorisasi kata sandi Windows asli) **tidak diselesaikan**: dua kali dijalankan, sekali gagal seketika saat paralel dengan suite lain (konflik port) dan sekali menggantung >20 menit lalu saya hentikan; belum dibuktikan lulus/gagal akibat U6b.
- Pemeriksaan visual manual (server tiruan, data fiktif) di 390 px: Organisasi dan Visual Studio, tanpa overflow dan kontrol ≥44 px.
- Belum diuji: Chrome nyata untuk Visual Studio (suite hanya `--visual`), tampilan desktop 1365 px halaman Pengguna/Migrasi secara visual (hanya lewat tes kontrol), perangkat fisik, screen reader, browser selain Chrome.

## Risiko dan pertanyaan terbuka
- `ui/msa-admin.css` memakai selektor elemen dengan spesifisitas dinaikkan (`.ui-admin` berulang) untuk mengalahkan aturan `button:not(.ui-btn)` di `msa-shell.css`; halaman admin baru sebaiknya memakai `ui-btn`/`ui-input` langsung.
- Status di Organisasi/Pengguna hanya teks berwarna pil (tanpa ikon) karena ikon harus ditambah di JS; teks status tetap menyampaikan arti.
- Visual Studio: kontrol di tampilan besar belum ditinjau visual selain 390 px.

## Untuk peninjau
- Fokus: tidak ada perubahan alur/dialog; regresi tombol (bawaan = utama) di dialog konfirmasi; legacy `a1.html` tanpa `styles.css`.
- Diff: `git diff claude/u6a-portal-pelayanan-kalender...claude/u6b-modul-admin`. Disarankan `/codex:review`.

## Jawaban atas tinjauan
Sumber: `/codex:review --base claude/u6a-portal-pelayanan-kalender` (2026-11-04).
- R1 [P2] tanda centang checkbox tampil `¹3` (`ui/msa-admin.css:29`): **diterima dan diperbaiki**. Escape `¹3` rusak saat file ditulis (menjadi U+00B9 + `3`); kini `content:"¹3"` benar. Sudah diverifikasi di kode (byte dicek): ya. Tidak ada tes otomatis untuk indikator centang (tes hanya memeriksa ukuran).
- Catatan Codex: `npm test` tidak dapat dikonfirmasi di sandbox peninjau (EPERM); di sini 225/225.

## Usulan commit
Summary: UI overhaul U6b: modul pengelolaan (render saja)
Description: Kulit bersama ui/msa-admin.css untuk Organisasi, Pengguna, Perangkat, Tinjauan identitas, Kesiapan migrasi, dan Visual Studio. Label di atas, kolom kapsul, daftar padat di desktop, satu kolom di ponsel. Alur, dialog konfirmasi, revisi/konflik, dan audit tidak diubah.
