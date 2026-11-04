# UI-OVERHAUL U6a — Beranda portal, Pelayanan, Kalender

Agen: Claude · Branch: claude/u6a-portal-pelayanan-kalender · Basis: development @ f9e6c3c · Tanggal: 2026-11-04
Status: IMPLEMENTED · Produksi: NO-GO

## Ringkasan
Beranda portal, daftar/detail/form Pelayanan, dan Kalender (`msa-portal`, `msa-events`) dirender ulang dengan token C10. Hanya render: endpoint, payload, izin, alur simpan/terbit/batal/ekspor, dan seri berulang tidak diubah.

## Perubahan
- `msa-session.js`: ekspor baru `serviceCardHtml` (kartu boarding-pass), `statusBadge` (ikon + teks + warna), `uiIcon`, `uiEsc`.
- `msa-portal.html/.js`: `#portal-stats` (3 ubin: jumlah baris `upcoming`, `assigned`, `drafts` yang dikirim API beranda; tanpa angka lain, tanpa grafik) dan kartu pelayanan. `#portal-new` tidak lagi memakai kelas `msa-primary`.
- `msa-events.html`: memuat token/komponen, body `ui-root`, kontrol memakai `ui-input/ui-select/ui-btn`, tab `ui-tab`. Kalender: strip pekan `#calendar-week`, chip filter `#calendar-chips`, `#calendar-filter-details` menjadi sheet bawah (<900 px) atau panel (≥900 px). Form: label di atas kolom, Program opsional dan jadwal mingguan terbuka bertahap, satu aksi utama (`#event-save`), Batal jadi tombol teks. `#dashboard-retry` kini tombol ikon (`aria-label` sama).
- `msa-events.js`: kartu via `serviceCardHtml` (beranda, daftar, kalender), lencana status, `renderWeek`/`renderChips`, keadaan kosong dan galat (`#calendar-retry`), penutupan sheet (Escape, ketuk latar).
- `msa-intake.css` (blok `.msa-events` lama diganti), `msa-shell.css` (aturan `.msa-events`/`#portal-schedule` lama dibuang; beranda baru; tombol baru dikecualikan dari aturan `button:not(.ui-btn)`), `ui/msa-components.css` (kartu klik penuh), `assets/icons/ui-sprite.svg` (+`refresh-cw`, Lucide ISC).

## Kontrak yang berubah
- Semua `id`, `data-*`, `aria-pressed` tab, rute hash (`#kalender`, `#baru`, `#organization&event`) dipertahankan.
- Teks tampak: tombol rentang "7 hari sebelumnya/berikutnya/mulai hari ini" → "Sebelumnya/Berikutnya/Pekan ini" (nama aksesibel lama dipertahankan lewat `aria-label`; tidak dipakai tes). "Muat ulang beranda" → ikon (`aria-label` sama). Chip filter menampilkan nilai terpilih.
- `<p class="draft-badge">` → `<span class="ui-badge draft-badge" data-status>`; `.calendar-card` tetap pada kartu kalender/beranda; daftar memakai `.event-card`. Baris "Penanggung Jawab Pelayanan" dihapus dari kartu (tetap di detail).
- Kelas `secondary` dan `msa-primary` tidak dipakai lagi di halaman ini.

## Nama PIC (temuan, API tidak diubah)
API hanya mengirim label turunan ID, bukan nama: `picLabel` kalender dan `options.pics[].label` berbentuk "Anggota <8 karakter ID>"; API beranda (`/api/stage9b2/dashboard`) tidak mengirim label sama sekali (hanya `picMembershipId`). Karena itu kartu tidak menampilkan PIC; detail tetap menampilkan label API apa adanya. Perlu keputusan Codex/pengguna: tambahkan nama tampilan anggota di API (`backend/msa-calendar.mjs:26`, `msa-events.mjs:51`, `msa-scheduling.mjs` dashboard).

## Kebutuhan saat merge
- `sw.js`: naik (msa-events.js, msa-portal.js, msa-session.js, CSS, sprite berubah). `server.mjs`: tidak (tanpa berkas baru).
- Indeks `PROJECT_STATUS.md`: "UI-OVERHAUL U6a — beranda portal, pelayanan, kalender (render saja); lihat docs/status/2026-11-04-claude-u6a-beranda-pelayanan-kalender.md".

## Verifikasi aktual
- `npm.cmd run check` lulus; `npm.cmd test` 225/225; `git diff --check` bersih.
- `node tests/stage3.mjs --stage9b2`: bagian integrasi gagal (tes backend `msa-stage9b2.test.mjs`, kegagalan lama yang sama di development; tidak disentuh).
- `node tests/stage3.mjs --from-browser` (Chrome penuh): 32/34. Gagal: `device-management-ui` (lama, sama di development) dan `msa-stage9b2-ui`. Yang terakhir: sebelum perbaikan gagal di pemeriksaan kartu muat di layar ponsel dan di pemeriksaan kontrol ≥44 px/16 px; kini lulus sampai langkah seri berulang. Terhenti oleh fixture tanggal kedaluwarsa (hari ini 2026-11-04; tes mengisi 2026-11-03 → "Jadwal baru harus dimulai setelah waktu sekarang", lalu event "upcoming" fixture di luar jendela 90 hari). Dengan tanggal sementara di salinan lokal tes (dikembalikan), tes maju ke langkah `data-dashboard-event=upcoming` dan berhenti karena alasan fixture yang sama. Langkah offline/pembaca/kosong 9B.2 belum teruji. Stage 9B.1, ekspor kalender, 9A, 8 lulus.
- Suite portal (`msa-portal-browser`, `msa-portal-focus-browser`, `auth-pilot-browser`): 3/3 lulus sebelum perbaikan warna tab; rerun `msa-portal-browser` setelah perbaikan warna tab: lulus (1/1).
- Tangkapan 4 lebar (360/390/768/1365): `.emulator-data/msa-portal-qa/screenshots/` (`pic-*`, `calendar-*`, `new-service-*`, `phase3-admin-*`) dan tangkapan tes 9B.1 (tanpa overflow horizontal, kontrol ≥44 px dan font ≥16 px dipastikan tes).
- Belum diuji: perangkat fisik, screen reader, browser selain Chrome, tes otomatis jebakan fokus sheet filter (tanpa tombol Tutup karena tes memakai `#calendar-filters button` tunggal).

## Risiko dan pertanyaan terbuka
- Fixture 9B.2/device-management perlu tanggal relatif (milik Codex).
- Sheet filter memakai jebakan fokus buatan sendiri, bukan `<dialog>` modal; latar belum `inert`.
- Strip pekan selalu 7 hari dari "Dari tanggal"; rentang lebih panjang tetap tampil di agenda.

## Untuk peninjau
- Fokus: tidak ada perubahan alur data di `msa-events.js` selain render; regresi 360 px; hook tes.
- Diff: `git diff development...claude/u6a-portal-pelayanan-kalender`. Disarankan `/codex:review`.

## Jawaban atas tinjauan
Sumber: `/codex:review --base development` (2026-11-04).
- R1 [P2] fokus keyboard keluar dari sheet filter (`msa-events.js:128-130`): **diterima dan diperbaiki**. Saat sheet terbuka <900 px, Tab/Shift+Tab berputar di dalam `#calendar-filters`, Escape menutup dan mengembalikan fokus ke chip Filter. Sudah diverifikasi di kode: ya. Belum ada tes otomatis untuk jebakan fokus; diuji lewat suite 9B.1 (tidak regresi).

## Usulan commit
Summary: UI overhaul U6a: beranda portal, pelayanan, dan kalender (render saja)
Description: Ubin ringkasan dari data API beranda, kartu pelayanan boarding-pass, kalender dengan strip pekan dan filter sheet, form dengan label di atas dan isian opsional bertahap. Tanpa perubahan API; nama PIC belum tersedia di API (dilaporkan).
