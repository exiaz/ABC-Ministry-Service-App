# P1 ? Pustaka komponen Pil bersama

Agen: Codex (worker Claude) ? Branch: agent/codex-p1-komponen-pil ? Basis: 3aab2fb54d9ea35244b9df678b7f6e0e2377f442 ? Tanggal: 2026-11-06
Status: IMPLEMENTED; verifikasi integrasi PARTIAL ? Produksi: NO-GO

## Ringkasan
Lapisan komponen bersama diselaraskan ke Pil D0 tanpa migrasi layar operasional. Audit fokus dan nonaktif ditutup pada CSS ui-* dan prototipe Pil; galeri memakai data fiktif, satu h1, dan contoh pada latar putih/merah/hitam. Tidak ada dependensi baru, commit, merge, push, atau perubahan konfigurasi agen oleh worker.

## Perubahan
- ui/msa-tokens.css: Hero 800 48/52, Subjudul 700 24/28, nama baris/isian 600 16/20; gap-row 8, gap-card 10, pad-card 16, pad-screen 24. Nilai warna bersama tidak berubah.
- Penyimpangan D0 yang disengaja: type-body tetap Nunito Sans 400 16/24 untuk keterbacaan paragraf panjang; isian dan nama baris memakai type-row.
- ui/msa-components.css: tombol merah 60/hitam/kuning/abu, tab/chip aktif hitam, badge status, panel, baris siswa, kartu pelayanan radius 40 dengan ubin tanggal, isian 56 dan galat 2px, keadaan kosong/galat/offline, sheet 55% dan pegangan 40?4, nav putih/FAB hitam, serta komposisi kepala halaman/filter/bilah aksi.
- ui/pil-kit.css dan ui/pil.css: hanya audit fokus/nonaktif; control prototipe menjadi alias control-border #857a76 (kontras putih 4,16:1, soft 3,85:1). Warna status prototipe yang lain dipertahankan; konsolidasi grafik ditunda sesuai tugas.
- ui-gallery.html, ui/ui-gallery.css, ui/ui-gallery.js: contoh dan teks ukuran/nilai Pil, keadaan pada tiga latar, formulir/badge/baris/kartu/banner tambahan, sheet mengurung Tab dan mengembalikan fokus, penutupan banner lokal pada masing-masing contoh. aria-disabled contoh tidak menjalankan navigasi.
- tests/ui-tokens.test.mjs: assertion token baru dan kontras fokus; assertion kontras lama dipertahankan.
- tests/pil-browser.mjs: galeri empat ukuran, ukuran target/isian/kartu/centang/pegangan, warna aktif/nonaktif, fokus tiga latar, trap Tab/Escape/fokus kembali, serta nonaktif primary/dark/yellow dengan disabled dan aria-disabled prototipe. Menggunakan port server acak terisolasi.

## Selector yang berubah / ditambah
Selector lama tetap tersedia; daftar berikut mencakup perubahan deklarasi dan tambahan:
- Fokus: :is(.ui-root,.ui-tokens) :focus-visible; .ui-service-card:has(:focus-visible); :focus-visible prototipe; a/button/input/select/summary:focus-visible pada pil.css.
- Tipografi: .ui-h-screen, .ui-h-greeting (override mobile 40/30 dihapus agar mengikuti token); tambahan .ui-h-hero, .ui-h-subtitle.
- Tombol: .ui-btn; .ui-btn--primary, --secondary, --tertiary dan hover; --fab; tambahan --dark, --yellow, --gray; .ui-btn:is(:disabled,[aria-disabled="true"]) dan hover; padanan .btn prototipe.
- Panel: .ui-panel; tambahan .ui-panel--focus, --dark dan warna judul/keterangan turunannya.
- Form: .ui-input, .ui-select, .ui-textarea; [aria-invalid="true"] pada ketiganya; .ui-field__error::before.
- Filter/status: .ui-tabs, .ui-tab, .ui-tab[aria-selected="true"], .ui-chip, .ui-chip-row, .ui-chip[aria-pressed="true"], .ui-chip.is-selected; .ui-badge, --published, --cancelled; tambahan --unmarked.
- Statistik/baris: .ui-stat, .ui-stat__value, .ui-student-row, .ui-avatar, .ui-student-row__name strong.
- Pelayanan: .ui-service-card, article.ui-service-card, __stub, __body, __action :is(a,button)::after; --cancelled dan stub; .ui-service-list.
- Nav: .ui-nav, .ui-nav__item, [aria-current="page"], .ui-nav__icon, .ui-nav__item--fab dan ikonnya; varian desktop serta ikon desktop 22.
- Sheet/keadaan: .ui-sheet-backdrop, .ui-sheet__grip, .ui-sheet__actions dan anaknya; .ui-state__icon, .ui-state--error; tambahan .ui-state--offline; .ui-skeleton; .ui-donut, ::before, __value; .ui-bar (label minimal 12).
- Komposisi tambahan: .ui-page-head, .ui-filter-bar dan field/search turunannya, .ui-savebar.
- Galeri saja: .ui-type-sample, .ui-nav-demo dan turunannya; tambahan .ui-gallery-states, .ui-gallery-surface, --red, --dark, .ui-gallery-controls, .ui-gallery-pressed, .ui-gallery-badges serta penyesuaian field/search/banner/card di permukaan contoh.

## Kontrak yang berubah (wajib, untuk agen lain)
Tidak ada untuk hook yang sudah ada: id/name/data-*/ARIA/rute/URL/endpoint dan teks assertion halaman operasional tidak diganti/dihapus. Semua selector lama dipertahankan. Galeri menambah id label yang unik, kelas varian, dan data-focus-sample khusus verifikasi. h1 galeri dan keterangan C10/ukuran lama diganti menjadi Pil; tidak ada assertion teks lama yang bergantung padanya. CSS tetap memerlukan pembungkus ui-root/ui-tokens.

## Hitungan kontras fokus
Rumus luminansi relatif WCAG (sRGB linear; (Lmax + 0,05)/(Lmin + 0,05)), dihitung dan diassert dalam tes token:
- Cincin biru #1d5f99 / putih #ffffff = **6,67:1**.
- Celah putih #ffffff / primary #c81e1e = **5,74:1**.
- Celah putih #ffffff / ink #231f20 = **16,30:1**.
Ketiganya melewati 3:1. Implementasi outline biru 3px, offset 2px, box-shadow putih 2px. Kontras biru langsung terhadap merah/hitam tidak diklaim lulus.

## Kebutuhan integrasi (untuk integrator)
- Versi cache sw.js: integrator perlu menaikkan versi saat CSS ini diintegrasikan; worker tidak menyentuh sw.js.
- Modul baru di server.mjs: tidak ada. Server prototipe tidak membuka galeri; tes mengintersep hanya tiga fixture galeri yang eksplisit. Gate admin ABC_MSA_UI_GALLERY tetap utuh.
- Baris indeks PROJECT_STATUS.md yang disarankan: P1 komponen Pil dan galeri diterapkan; token 5/5 dan Chrome lulus; regresi penuh 267/273, emulator belum berjalan; produksi NO-GO.
- P2?P4 perlu memverifikasi halaman operasional beserta CSS layar masing-masing. P1 tidak mengubah HTML/renderer layar, msa-auth.css, msa-admin.css, backend, atau kontrak data.
- Konsolidasi chart serta ui-absen/ui-review tetap ditunda.
- Breakpoint sidebar lama 900px dipertahankan; menu sheet menengah memerlukan alur/renderer P2?P4 dan tidak diimplementasikan dalam pekerjaan CSS/galeri ini.

## Verifikasi aktual
- npm.cmd run check: **249 berkas JS/MJS lulus** sintaks/import lokal (runner tidak mencakup ui/).
- node --check ui/ui-gallery.js: **lulus** secara terpisah.
- npm.cmd test (run terakhir): **273 tes, 267 lulus, 6 gagal, 0 skipped**. Log lokal: %TEMP%/msa-p1-unit-output.txt. Enam kegagalan:
  1. collab-guard.test.mjs ? Shared hook admits both agents...: keluaran worker tidak cocok assertion workspace kanonis.
  2. collab-guard.test.mjs ? Native registrations...: mengharapkan "Workspace bersama: OK", menerima identitas worker.
  3. local-demo.test.mjs ? unknown occupied port: prasyarat dependensi gagal sebelum pemeriksaan port.
  4. local-msa-setup.test.mjs ? native password dialog: proses keluar lebih cepat dari assertion; belum didiagnosis lebih jauh.
  5. stage3-launcher.test.mjs ? missing Java: dependensi belum lengkap muncul sebelum pesan JDK 21.
  6. workspace-lock.test.mjs ? native lifecycle: akses path fixture backend ditolak di PowerShell.
  Berkas tersebut di luar lingkup dan tidak diperbaiki/dilemahkan. Tidak menyatakan baseline bersih pernah lulus.
- node --test tests/ui-tokens.test.mjs setelah edit akhir: **5/5 lulus**.
- node tests/pil-browser.mjs setelah edit akhir: **lulus**, counter runner **360 assertion**, prototipe 13 rute ? 6 lebar (360/390/768/1100/1365/1440), galeri 4 lebar (360/390/768/1365). Tidak ada overflow horizontal, seluruh kontrol terukur ?48px, fokus 3 latar, nonaktif abu; font lokal dan reduced-motion lulus.
- Tangkapan setelah perubahan: .emulator-data/pil-build/gallery-{360,390,768,1365}.png, gallery-focus-{white,red,dark}-{360,390,768,1365}.png. Hasil mesin: .emulator-data/pil-build/results.json.
- Inspeksi visual PNG belum selesai: view_image ditolak hook OUT_OF_SCOPE untuk .emulator-data/pil-build/gallery-360.png; tidak mengubah konfigurasi atau melewati hook. Hasil Chrome di atas berasal dari pengukuran/assertion computed style, bukan penilaian visual gambar. Tidak ada tangkapan baseline sebelum perubahan.
- node tests/stage3.mjs --a2-2 --visual --a2-3: dicoba, keluar 1 saat prasyarat "Dependensi proyek belum lengkap"; **suite emulator tidak dijalankan**. node_modules tidak tersedia di worktree. Tidak memasang dependensi atau mengambil port pihak lain. Runner saat ini menerima satu flag per eksekusi: integrator menjalankan --a2-2, --visual, --a2-3 secara terpisah pada runner port acak yang sudah tersedia.
- git diff --check: setelah membersihkan baris kosong EOF galeri, **lulus**; warning CRLF pada konfigurasi agen lokal yang sudah ada tetap muncul.
- Belum diuji: halaman operasional dengan server/emulator, PWA/cache, perangkat fisik, Safari/iOS, screen reader, keyboard ponsel, tinjauan visual tangkapan. Suite penuh berjalan sebelum perubahan akhir CSS/galeri; tes token/Chrome/sintaks galeri diulang setelah perubahan akhir.

## Risiko dan pertanyaan terbuka
Perubahan CSS bersama otomatis memengaruhi pemakai lama; CSS layar bisa mengalahkan deklarasi P1. Galeri dan prototipe lulus pemeriksaan terukur, tetapi bukan bukti semua layar operasional sudah sesuai Pil. Verifikasi integrasi dan visual tetap diperlukan; produksi NO-GO.

## Serah terima
- Penulis tugas: Codex; pekerjaan diserahkan kepada orkestrator Claude.
- Baseline: 3aab2fb54d9ea35244b9df678b7f6e0e2377f442. Lingkup diubah: ui/msa-tokens.css, ui/msa-components.css, ui/pil.css, ui/pil-kit.css, ui-gallery.html, ui/ui-gallery.css, ui/ui-gallery.js, tests/ui-tokens.test.mjs, tests/pil-browser.mjs, laporan ini. Tidak membuat ui-components.test.mjs karena coverage ditambahkan ke runner yang ada.
- Perubahan lokal pihak lain dipertahankan: .agents/bin/delegate.mjs, .agents/hooks.json, .agents/hooks/{collab-guard,coord,policy,workspace-lock}.mjs, .agents/skills/beads/{SKILL.md,agents/openai.yaml}, .agents/skills/msa-coordination/SKILL.md, .agents/skills/no-ai-slop/{SKILL.md,eval.md}, .codex/config.toml.
- Kebutuhan tersisa: validasi emulator/integrasi, visual PNG dan bump cache oleh integrator. Tidak ada konflik path implementasi yang ditemukan.
- Agen penerima wajib membaca ulang status, diff dan isi terbaru sebelum menulis.

## Untuk peninjau
Fokus: regresi CSS bersama dan interaksi galeri, penilaian visual pada empat lebar, CSS layar yang mengalahkan token/komponen.
Diff: git diff 3aab2fb54d9ea35244b9df678b7f6e0e2377f442 -- ui/msa-tokens.css ui/msa-components.css ui/pil.css ui/pil-kit.css ui-gallery.html ui/ui-gallery.css ui/ui-gallery.js tests/ui-tokens.test.mjs tests/pil-browser.mjs
Berkas untracked yang perlu dibaca: laporan ini. Tidak berpindah branch.

## Jawaban atas tinjauan
Belum ada tinjauan independen yang diminta/dijalankan.

## Usulan commit
Summary: feat(ui): align shared components and gallery with Pil
Description:
- Align shared tokens and components with the approved Pil specification.
- Fix two-color focus rings and disabled button variant precedence.
- Expand gallery states and Chrome regression coverage.
