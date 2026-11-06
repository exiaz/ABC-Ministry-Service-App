# Perbaikan pencarian Pelayanan pada mobile

Agen: Codex | Branch: development | Basis: 12fd9f92590871f0941ee7804a129c519fee301d | Tanggal: 2026-11-06
Status: IMPLEMENTED / TESTED pada Chrome emulasi mobile. Produksi: NO-GO.

## Ringkasan
Menangani temuan audit 1 saja: kolom pencarian Pelayanan bertumpuk dengan tombol Filter pada mobile. Pada lebar maksimal 740px, pencarian sekarang menempati satu baris penuh; Filter dan Atur ulang berada di bawahnya. Minimum lebar input 200px dilepas pada breakpoint tersebut.

## Perubahan
- `ui/pil.css`: override layout filter mobile, tanpa perubahan desktop atau controller.
- `tests/pil-browser.mjs`: assertion input berada dalam filter bar dan tidak beririsan dengan tombol pada enam viewport; menambahkan screenshot Pelayanan mobile.

## Kontrak yang berubah
Tidak ada perubahan ID, name, data-*, ARIA, rute, API, teks, atau data. Hanya susunan visual mobile.

## Kebutuhan integrasi
Tidak ada modul, dependency, perubahan server atau versi cache `sw.js`. `PROJECT_STATUS.md` tidak diubah. Cache PWA operasional belum diverifikasi ulang.

## Verifikasi aktual
- Runner `tests/pil-browser.mjs` melalui Node, cwd artefak di luar repositori: 246 assertion lulus pada 360/390/768/1100/1365/1440px, 13 view per viewport. Termasuk target minimal 48px, tanpa overflow horizontal, interaksi existing, font dan reduced motion.
- `node --test tests/pil.test.mjs`: 3/3 lulus.
- `npm.cmd run check`: 249 berkas JS/MJS lulus sintaks dan local import.
- Pemeriksaan sentuh tambahan memakai Chrome dengan isMobile/hasTouch: 320x740, 360x800, 390x844, 430x932, 640x800, 740x800, 741x800, 768x900, 844x390 dan 390x420. Seluruhnya lulus mengetik DRAMA (1 hasil), Atur ulang (7), Filter Draf (3), dan Atur ulang (7). Fokus input tetap saat mengetik; hit-test pusat input tidak terhalang setelah scroll; tanpa overflow halaman atau pageerror.
- Screenshot hasil 390px diperiksa visual: label dan input utuh, kedua aksi terpisah di bawah input. Bukti di `C:/Users/HYPE AMD/.codex/visualizations/2026/11/06/01a1af42-7233-75d3-a231-c81924783a96/pelayanan-fixed-390.png`.
- `git diff --check` lulus sebelum laporan ditambahkan. Server pengujian ditutup setelah selesai.

## Risiko dan batas verifikasi
Emulasi tinggi 420px bukan pengujian keyboard virtual nyata. Perangkat fisik, Safari/iOS, screen reader, integrasi emulator dan cache PWA belum diuji. Temuan audit 2–5 belum diperbaiki, termasuk label tab dan kesinambungan fokus kontrol setelah render. Tidak menjalankan suite unit penuh untuk perubahan CSS terbatas ini.

## Serah terima
Codex selesai; baseline 12fd9f9. Lingkup hanya tiga berkas di atas termasuk laporan ini. Seluruh perubahan lokal Taste Code dan pekerjaan sebelumnya dipertahankan; kedua berkas implementasi/tes sudah untracked sebelum tugas ini. Agen berikut membaca isi terkini, laporan dan diff; jangan menganggap seluruh isi berkas untracked sebagai perubahan tugas ini. Tidak ada commit, push, deploy atau perpindahan branch.

## Usulan commit
Summary: `fix(ui): prevent mobile service search overlap`
Description:
- Place mobile service search above filter and reset actions.
- Check search containment and action overlap across viewports.
