# UI-OVERHAUL U5 — beranda Mentor dan absensi

Agen: Claude · Branch: claude/u5-mentor-attendance (dari claude/u4-portal-shell @ 0f58e87) · Basis: development @ 8a9e4bf · Tanggal: 2026-11-04
Status: IMPLEMENTED · Produksi: NO-GO

## Ringkasan
Beranda Mentor (`mentor-account.html`) dan tampilan absensi (cabang `personal` di `secure-mentor.js`) dirender ulang dengan token C10. Hanya render: status yang dikirim, payload, receipt, retry, finalisasi, aturan siswa sementara, kelompok utama/cadangan, dan perilaku offline tidak diubah. Jalur legacy (`app.js`) tetap memakai markup lama.

## Perubahan
- `mentor-account.html`: profil dibungkus `.ui-tokens.ui-mentor`; sapaan "Hai, Kak <span id=account-name>"; `#account-device-chip` dan `#account-backup` baru; navigasi bawah menjadi `ui-nav` (Beranda, Absensi sebagai FAB, Perangkat) dengan ikon SVG inline. Tag `<body>` dan string yang diganti server tidak disentuh.
- `mentor-account.js`: `showAssignmentWeek` hanya menampilkan hari pelayanan aktif; `renderHome` membuat kartu pelayanan (boarding pass) dengan "Mulai absensi" (tautan ke `#account-attendance`, nonaktif beserta alasan bila perangkat belum aktif/offline/halaman Perangkat terbuka), chip status perangkat (ikon + teks), dan kartu kelompok cadangan terpisah; blok offline diberi ikon dan gaya banner (teks sama).
- `secure-mentor.js` (hanya `personal===true`): `personalRoster` (penghitung "x/y hadir" + progres, pencarian berlabel, tab segmen dengan jumlah, baris siswa ≥64 dengan centang 48 dan menu ⋯, CTA lengket); state `tab` + aksi `roster-tab` (filter tampilan saja, direset bersama `query`); getter baca-saja `backupGroups()`.
- `mentor-account.css`: aturan nav lama (fixed/sidebar 200px) dibuang; blok U5 dicakup `body.mentor-account`. Keyboard terbuka: nav disembunyikan dan CTA tidak lengket saat `#secure-student-search` fokus.
- `visual-studio.js`: data pratinjau dasbor Mentor disesuaikan dengan markup baru.
- `tests/mentor-selection.test.mjs` (baru): unit `selection(g)`.
- `tests/emulator/msa-a2-3-ui.mjs`: jumlah `#account-dates li` 7 → 1 (hanya hari pelayanan aktif); tambah pemeriksaan keyboard terbuka (viewport 360/390 × 380) + tangkapan `msa-a2-3-keyboard-<lebar>.png`.

## Kontrak yang berubah
- `#account-name`: dari `<h1>` menjadi `<span>` di dalam `<h1>` "Hai, Kak …"; `textContent` tetap nama lengkap.
- `#account-dates li`: 7 hari → hanya hari pelayanan aktif (tes diperbarui 7 → 1). Heading "Minggu penugasan pertama", `.account-week-selected`, `aria-label` tetap.
- Teks nav: "Jadwal saya" → "Beranda" (tidak dipakai tes). `href`, `aria-current="location"`, `.account-nav-icon`, `#account-nav-attendance` tetap.
- `.present-btn`: tombol berisi ikon centang saja (teks "Hadir" terlihat dihapus); `aria-label` "Tandai <nama> hadir", `aria-pressed`, `data-action=secure-present` tetap. Status tetap tertulis di baris ("Kelas … · Hadir").
- Label pencarian: `aria-label` diganti `<label for>` terlihat "Cari siswa"; placeholder dan id tetap.
- Dihapus di jalur personal: ringkasan samping (`.summary-card`, `.summary-stats`) dan `.roster-label`; jumlah per status kini di tab. Teks "Belum Diabsen tetap terpisah dari Tidak Hadir…" dipertahankan.
- Baru: `#account-device-chip`, `#account-backup`, `.mentor-roster`, `.mentor-tabs`, `[data-action=roster-tab]`, `.mentor-cta`.
- Aturan CSS `.account-authorized #account-groups{display:none}` dihapus: kartu pelayanan kini tetap tampil saat perangkat aktif.

## Kebutuhan saat merge
- Versi cache `sw.js`: **naik** (`secure-mentor.js` ikut di-cache `sw.js`; perubahan hanya aktif untuk jalur personal, tetapi berkas yang di-cache berubah).
- Modul baru di `server.mjs`: tidak (tanpa berkas baru).
- Baris indeks `PROJECT_STATUS.md`: "UI-OVERHAUL U5 — beranda Mentor + absensi (render saja); lihat docs/status/2026-11-04-claude-u5-beranda-absensi.md".

## Tidak diimplementasikan (dan alasannya)
- **Baris tambah siswa sementara**: tidak ada fitur atau API siswa sementara di alur Mentor (tidak ada kode `sementara|temporary|addStudent` di `secure-mentor.js`, `mentor-attendance.js`, `mentor-account.js`, `pairing-client.js`). Larangan menyentuh aturannya + BRIEF 2.5 (kejujuran data): tidak dibuat tombol tanpa fungsi.
- **Menu Riwayat**: tidak ada rute riwayat Mentor; tidak dipasang.

## Verifikasi aktual
- Baseline sebelum perubahan: `npm.cmd run check` lulus; `npm.cmd test` 224/224; `--a2-3` dan `--a2-4a` PASS.
- Setelah perubahan: `npm.cmd run check` lulus; `npm.cmd test` 224/224; `node tests/stage3.mjs --a2-3` PASS (termasuk `msa-session1a-ui` dan pemeriksaan keyboard baru); `--a2-4a` PASS; `git diff --check` bersih.
- Tangkapan Chrome 360/390/768/1365: dihasilkan tes (`msa-a2-3-{login,activation-required,association-required,authorized,backup-selected,offline}-<lebar>.png`) di `.emulator-data/stage3-tests/run-*/screenshots/`; tes menegaskan tanpa overflow horizontal. Keyboard terbuka: `msa-a2-3-keyboard-{360,390}.png`.
- `npm.cmd run test:stage6` (suite penuh) di branch ini: 158/166 lulus, 8 gagal, semuanya tes integrasi backend (`msa-a2-2.test.mjs:115` rate limit registrasi; 7 tes `msa-stage9b2.test.mjs`). Pembanding di `development` @ 8a9e4bf (worktree sementara, sudah dihapus): 7 tes `stage9b2` **gagal juga** (kegagalan lama, bukan dari U5). `--a2-2` lulus sendiri-sendiri di `development` **dan** di branch ini; kegagalan A2.2 hanya muncul di jalankan suite penuh, jadi diduga bergantung urutan/state, bukan dari U5 (belum diselidiki akar masalahnya).
- Suite Chrome penuh (`node tests/stage3.mjs --from-browser`): branch ini 32/34 lulus, `development` 32/34 lulus; dua kegagalan **sama persis di keduanya**: `device-management-ui` ("48-hour bulk codes…": 'Pelayanan berakhir' ≠ 'Belum dipakai', diduga tanggal fixture kedaluwarsa) dan `msa-stage9b2-ui` ("Upcoming card should fit in the first mobile viewport"). Yang lulus di branch ini termasuk `mentor-attendance-ui`, pairing/device UI, `backup-ui`, `--a2-3`, `--a2-4a`: regresi jalur legacy `secure-mentor.js` tidak ditemukan.
- `node tests/browser.mjs` (kalender legacy, roster, koreksi, offline; 360/390/1365): lulus.
- Tinjauan Codex (`/codex:review`, terhadap `main`): 2 temuan, lihat "Jawaban atas tinjauan".
- Belum diuji: keyboard virtual asli di perangkat fisik (diemulasikan lewat viewport 380px), screen reader, browser selain Chrome, kontras pasangan warna di luar daftar BRIEF (semua memakai pasangan token BRIEF).

## Risiko dan pertanyaan terbuka
- Tab segmen memakai `aria-pressed` pada grup tombol (bukan pola `tablist`) agar tidak mengklaim navigasi panah yang tidak diimplementasikan.
- `#account-device:has(.mentor-offline){order:-1}` memindahkan banner offline ke atas; bergantung dukungan `:has` (Chrome/Safari/Firefox modern; sudah dipakai di repo).
- Strip pekan kini hanya hari aktif; bila produk ingin 7 hari penuh dengan hari aktif ditandai, perlu keputusan desain dan tes diubah kembali.

## Untuk peninjau
- Fokus yang diminta: pastikan tidak ada perubahan status/payload/retry/finalisasi di `secure-mentor.js` (hanya `personalRoster`, `rowsView` cabang personal, `tab`, `roster-tab`, `backupGroups`); regresi jalur legacy; 360 px dengan keyboard.
- Diff: `git diff claude/u4-portal-shell...claude/u5-mentor-attendance` (terhadap development ikut memuat U4). Disarankan `/codex:review`.

## Jawaban atas tinjauan
Sumber: keluaran `/codex:review` (sesi 2026-11-04, tanpa berkas `docs/reviews/`).
- R1 [P2] modul kalender untuk akun `events:calendar:read` (`backend/msa-portal-session.mjs:36`): **di luar lingkup U5**. Berkas ini tidak ada di diff branch (Codex membandingkan dengan `main`). Kode memang hanya memeriksa `events.catalog()`; ini otorisasi/backend milik Codex, diserahkan lewat pengguna (saran `/codex:adversarial-review`). Sudah diverifikasi di kode: ya.
- R2 [P2] "Mulai absensi" tidak memilih kelompok kartu (`mentor-account.js:93`): **diterima dan diperbaiki**. `secure.selection(g)` (getter baca-saja) memberi `{other, canOpen, locked}`. Bila kelompok lain sedang dipilih, tombol kartu membawa `data-action=select-group` + `data-id` + `data-visit` (jalur `select-group` yang sudah ada). Tombol nonaktif beserta alasan bila perangkat belum diaktifkan untuk kelompok kartu itu (`canOpen` salah, mis. dua kelompok utama dengan satu penugasan aktif) atau saat penyimpanan/retry/konflik menahan perpindahan. Tes: `tests/mentor-selection.test.mjs` (baru) dan langkah baru di `msa-a2-3-ui.mjs` (kartu utama membuka roster utama setelah backup dipilih). Sudah diverifikasi di kode: ya.
- R3 [P2] fokus dan posisi gulir hilang saat filter status diganti (`secure-mentor.js:120`, tinjauan kedua `/codex:review --base development`): **diterima dan diperbaiki**. `roster-tab` tidak lagi memanggil `notify()`: hanya `aria-pressed` tombol tab dan `#secure-roster-rows` yang diperbarui (pola sama dengan pencarian), jadi tombol fokus dan posisi gulir tab tidak diganti. Tes: langkah keyboard baru di `msa-a2-3-ui.mjs` (Enter pada tab Hadir, `activeElement` tetap tombol itu dan `aria-pressed=true`). Sudah diverifikasi di kode: ya.
- Catatan tinjauan Claude sendiri (`/ponytail:ponytail-review`): temuan "kartu non-aktif membuka roster yang salah" (kelompok utama kedua) sudah ditutup lewat `canOpen`; temuan "tes keadaan terkunci" belum ada tes UI-nya (hanya `locked` idle diuji di unit).

## Usulan commit
Summary: UI overhaul U5: beranda Mentor dan absensi (render saja)
Description: Beranda dengan sapaan, strip hari pelayanan, kartu pelayanan + Mulai absensi, chip status perangkat, kartu cadangan, nav bawah Mentor. Absensi dengan penghitung x/y hadir, pencarian, tab segmen, baris siswa ≥64 dengan centang 48, CTA lengket, banner offline, keyboard terbuka. Tanpa perubahan perilaku/payload; siswa sementara dan Riwayat tidak dibuat karena belum ada dukungan.
