# Polish komponen bersama (lapisan CSS)

Agen: Claude. Branch: `claude/u6b-modul-admin`. Status: IMPLEMENTED (CSS saja), diuji unit; belum diuji di browser.

## Keputusan lingkup
Tampilan masuk (U3), beranda Mentor dan absensi (U4/U5), dan komponen bersama (U2) sudah memakai sistem C10. Blueprint Build meminta SPA baru dengan rute `#/beranda`, `#/absensi`, dan token "achromatic ledger". Itu ditolak karena membuat aplikasi kedua, memutus rute `/#masuk`, dan bertentangan dengan BRIEF.md (token merek dilindungi, tanpa framework baru). Kit `.taste/app-kit/` tidak disalin untuk alasan yang sama.

## Perubahan (`ui/msa-components.css`)
- `.ui-skeleton`: gradien shimmer diganti batang datar `--blue-pale`, keyframes `ui-shimmer` dihapus (aturan "tanpa gradien", loading datar).
- Umpan balik tekan 1px pada `.ui-btn`, `.ui-check`, `.ui-tab`, `.ui-chip`, dengan satu pasangan durasi/easing (160ms, `cubic-bezier(.23,1,.32,1)`). Mati lewat aturan `prefers-reduced-motion` yang sudah ada.

## Kontrak yang berubah
Tidak ada id, `data-*`, ARIA, rute, endpoint, atau teks tes yang berubah.

## Kebutuhan saat merge
- `sw.js`: naikkan versi cache karena `ui/msa-components.css` berubah (diterapkan integrator).

## Tes
- `npm.cmd run check`: 240 berkas lulus.
- `npm.cmd test`: 225/225 lulus.
- `git diff --check`: bersih.

## Belum dijalankan
Tangkapan 390/768/1280, suite emulator dan Chrome (perlu persetujuan pengguna), audit Impeccable.

## Catatan untuk keputusan pengguna
`.ui-card` dan `.ui-service-card` masih memakai bayangan `--shadow-card` saat diam (spesifikasi C10). Brand phase meminta kartu datar bergaris 1px. Tidak diubah tanpa persetujuan karena memengaruhi semua layar U3-U6b.

## Jawaban atas tinjauan
Belum ada tinjauan.

## Usulan commit
Summary: UI overhaul: skeleton datar dan umpan balik tekan komponen bersama
Description: Hapus shimmer gradien pada skeleton, tambah pergeseran 1px saat ditekan dengan satu durasi dan easing. CSS saja; sw.js perlu naik versi saat merge.
