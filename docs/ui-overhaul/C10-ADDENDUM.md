# C10 Addendum: state, responsif, dan kriteria penerimaan

Status: **USULAN** (belum disetujui untuk implementasi) · Disusun: 2026-11-04 · Penyusun: Claude
Berlaku sebagai pelengkap `docs/ui-overhaul/BRIEF.md`. BRIEF, `AGENTS.md` dan `MASTER_BRIEF.md` tetap menang bila bertentangan.

Sumber: telaah dua dokumen riset eksternal (GPT, 4 Nov 2026: `ABC_MSA_Riset_UIUX_PWA_2026-11-04.md` dan `Laporan Riset UI_UX dan Arsitektur PWA untuk ABC Ministry Service App.pdf`), dicocokkan dengan kode di worktree `MSA-claude` pada 4 Nov 2026 setelah U6a. Setiap temuan menyebut lokasi kode. Yang belum direproduksi ditandai **dugaan**.

Dokumen ini tidak mengubah berkas aplikasi dan tidak menyentuh pekerjaan U6b yang sedang berjalan. Setiap butir dikerjakan hanya lewat bagian kerja yang diminta pengguna.

---

## 1. Rekomendasi riset yang ditolak atau ditunda

| Usulan riset | Keputusan | Alasan |
|---|---|---|
| Vite, Workbox, TanStack Query, IndexedDB, Storybook, Lighthouse CI (PDF) | Ditolak untuk overhaul | BRIEF §2.7: tanpa dependensi, framework, CDN, atau build step |
| Antrean absensi offline `local-pending/syncing/conflict` (PDF) | Di luar lingkup | Perubahan produk/data. `mentor-attendance.js:16-17` sengaja tidak menyimpan perintah di storage atau antrean |
| "Riwayat" di navigasi global (PDF) | Ditolak | Rute belum ada; BRIEF §2.5 |
| Target metrik (≥95% sukses, −15% waktu, <2% salah ketuk, ≥99% sinkron) (PDF) | Ditolak | Tanpa baseline MSA. Laporkan hasil uji sebagai jumlah absolut |
| Cookie HttpOnly, CSP `worker-src`, Clear-Site-Data (PDF) | Serahkan ke Codex | Arsitektur dan autentikasi, bukan lapisan tampilan |
| Layout list-detail/supporting pane di desktop (PDF) | Ditunda (P2) | Valid, tetapi perubahan struktur halaman; baru setelah P0/P1 selesai |

## 2. Sudah terpenuhi (pertahankan sebagai regresi)

- Lencana status berbasis status, bukan nama warna: `statusBadge` + `data-status` (U6a, `msa-session.js`).
- Label di atas kolom, satu aksi utama di form (`#event-save`), Batal sebagai tombol teks (U6a).
- Label terlihat "Cari siswa", perbaikan fokus filter, pembukaan kartu kelompok yang benar (U5).
- Baris siswa ≥64, centang 48, kontrol ≥48 (token `--student-row-min`, `--check-size`, `--tap-min`).
- Judul layar sudah turun ke 40/44 dan sapaan ke 30/34 di ≤600 px (`ui/msa-components.css:17`).
- Reduced-motion dihormati (`ui/msa-components.css:196`, `ui/msa-admin.css:82`).
- Safe-area: `--safe-bottom` (`ui/msa-tokens.css:39`).
- "Belum Diabsen" terpisah dari "Tidak Hadir"; finalisasi ditolak bila masih ada `unmarked` (`mentor-attendance.js` `mutate`, `secure-mentor.js:109`).

## 3. Temuan terbuka

| ID | Temuan | Bukti | Pemilik |
|---|---|---|---|
| A1 | Dua aksi "Buat" tampil bersamaan bagi pengguna berizin | `msa-portal.js:39` menampilkan `#portal-new` (`ui-btn--primary`) dan memanggil `setMsaCreate(canCreate)` yang memasang FAB `#msa-create` (`msa-session.js:77-85`) | Claude |
| A2 | Cincin fokus di atas panel `--accent-3` di bawah 3:1 | `--focus-ring` #1d5f99 vs #64a4d9 = 2,49:1 (dihitung, rumus WCAG). Di atas krem 6,24, putih 6,67, blue-pale 5,39, kuning 5,45: aman | Claude |
| A3 | Angka ubin statistik belum `tabular-nums` | `--type-stat` tanpa `font-variant-numeric` (`ui/msa-tokens.css:32`) | Claude |
| A4 | Belum ada token durasi motion | Tidak ada `--motion-*` di `ui/msa-tokens.css` | Claude |
| A5 | Sheet filter bukan `<dialog>`, latar belum `inert` | Risiko tercatat di status U6a | Claude |
| A6 | Ruang bawah saat keyboard terbuka hanya dideteksi lewat fokus input | Tidak ada pemakaian `visualViewport` di JS | Claude (uji dulu) |
| B1 | Halaman portal tidak mendaftarkan service worker dan tidak menautkan manifest | Registrasi hanya di `app.js`; `msa-portal.html`/`msa-events.html` tanpa `<link rel="manifest">` | Codex/integrator |
| B2 | **Dugaan:** offline di portal jatuh ke aplikasi lama | `sw.js:12` fallback navigasi ke `./index.html`, scope `./`. Berlaku bila SW sudah terpasang lewat `index.html` | Codex/integrator |
| B3 | Warna manifest masih tema lama | `manifest.webmanifest`: `#f5f7fb` / `#1463e5`; halaman portal `theme-color #fff8d6` | Codex/integrator |
| B4 | `skipWaiting` + `clients.claim` dapat mengganti worker di tengah penyimpanan | `sw.js:3-4` | Codex/integrator |

## 4. Matriks state absensi (presentasi saja)

Dipetakan ke state yang **sudah ada** di `mentor-attendance.js` dan `mentor-account.js`. Tidak ada state, endpoint, atau perilaku penyimpanan baru. Teks di kolom "Teks existing" adalah string kode saat ini. Bila diubah, tes yang mengasertnya diperbarui di bagian kerja yang sama dan dicatat.

| State kode | Pertanyaan pengguna | Teks existing | Presentasi yang diusulkan | Larangan |
|---|---|---|---|---|
| `phase:'loading'` | Apakah data sudah ada? | "Memuat daftar siswa dan absensi…" | Konteks sekolah/kelompok/tanggal tetap tampil; roster berupa kerangka; penghitung x/y disembunyikan | Jangan tampilkan "0/0" |
| `phase:'load-error'` (non-403) | Kenapa kosong? | "Daftar siswa dan absensi belum dapat dimuat. Tidak menggunakan data lokal." | Panel galat + tombol muat ulang existing | Jangan menyerupai kelompok tanpa siswa |
| `phase:'load-error'` (403) | Apakah saya berhak? | "Cakupan pelayanan tidak diizinkan. Hubungi admin." | Ikon kunci + teks; tanpa tombol coba lagi | Jangan sebut koneksi |
| `ready`, siswa `unmarked` | Siapa yang belum diabsen? | "Belum Diabsen" | Centang kosong tepi `--control-border` + teks status pada baris; tab "Belum diabsen" dengan jumlah | Jangan ditampilkan sebagai Tidak Hadir |
| `phase:'saving'` | Apakah ketukan saya diterima? | "Menyimpan ke server…" | Baris yang diubah `aria-busy`; status singkat di live region; aksi lain dinonaktifkan sesuai aturan existing (`mutate` menolak saat `pending`) | Jangan beri centang final sebelum respons |
| `phase:'saved'` | Apakah tersimpan? | "Tersimpan di server. Data terbaru telah dimuat." | Pesan singkat di live region `polite`; tidak memindahkan fokus | Jangan tampilkan timestamp yang tidak dikirim server |
| `phase:'error'` + `pending` | Apakah tersimpan atau tidak? | "Hasil penyimpanan belum dapat dipastikan. …" | Banner peringatan dekat roster + tombol "Coba lagi" (memanggil `retry()`, kunci idempotensi sama) dan "Muat ulang data" | Jangan buat kiriman baru; jangan tampilkan sebagai gagal pasti |
| `phase:'conflict'` (409) | Apa yang berubah? | "Data atau ketentuan absensi berubah. …" | Panel menonjol + "Muat ulang data server"; pemilihan kelompok terkunci (sudah di `secure-mentor.js`) | Jangan menimpa diam-diam |
| `data.state:'draft'`, semua tertandai | Apakah sudah selesai? | Modal "Tinjau dan selesaikan absensi" | Label "Draf" tetap terlihat di kepala roster sampai finalisasi; CTA lengket = "Tinjau dan selesaikan" | "Semua ditandai" ≠ "selesai" |
| `data.state:'completed'` | Apakah sudah final? | Koreksi lewat modal "Koreksi absensi" | Lencana "Selesai" (ikon + teks); baris hanya-baca; aksi koreksi sekunder | Jangan tampilkan CTA simpan |
| Offline (`mentor-account.js:96,105,157`) | Bisa lanjut? | "Hubungkan internet dulu. Absensi tidak tersedia saat offline." | Banner offline existing; CTA mulai dinonaktifkan dengan alasan tertulis | Jangan menjanjikan antrean atau "tersimpan lokal" |
| Sesi berakhir (`mentor-account.js:51`) | Kenapa keluar? | "Sesi berakhir. Masuk kembali." | Layar masuk dengan pesan tersebut; data privat sudah dibersihkan | Jangan sisakan roster di DOM |

Catatan: `phase:'error'` saat ini mencakup semua kegagalan simpan selain 403/409, termasuk putus jaringan. Pesan "belum dapat dipastikan" sudah tepat untuk semuanya; jangan dipecah menjadi pesan "gagal" tanpa dukungan kontrak.

## 5. Spesifikasi komponen yang diusulkan

### 5.1 Aksi "Buat" (A1)
Satu aksi dominan per viewport, hook tetap.
- **Usulan (perubahan terkecil):** `#portal-new` tetap ada dan tetap terlihat (tes `tests/msa-portal-browser.mjs:100` mengasert terlihat di 390 px), tetapi varian diturunkan ke `ui-btn--secondary` pada <900 px karena FAB `#msa-create` sudah menjadi aksi utama di nav bawah. Pada ≥900 px (sidebar, tanpa FAB menonjol), `#portal-new` tetap `ui-btn--primary`.
- Alternatif (perlu ubah tes): sembunyikan `#portal-new` di <900 px. Mengubah assertion baris 100; harus dicatat lama → baru.

### 5.2 Judul layar (sudah responsif, tinggal diuji)
`.ui-h-screen` 40/44 di ≤600 px. Usulan: **tidak mengubah token** sampai pengujian menunjukkan masalah. Kriteria uji: pada 360×640, judul terpanjang yang nyata (nama sekolah/pelayanan) maksimal 2 baris dan aksi utama layar terlihat tanpa gulir. Bila gagal, kandidat langkah berikutnya 32/36 khusus layar tugas (absensi, form), bukan seluruh judul.

### 5.3 Fokus (A2)
Hanya untuk permukaan `--accent-3` (panel biru, isi grafik): cincin dua lapis.
```css
/* usulan, belum diterapkan */
.ui-panel:not(.ui-panel--pale) :focus-visible{outline:3px solid var(--ink);outline-offset:3px;box-shadow:0 0 0 2px var(--surface-100)}
```
ink vs #64a4d9 = 6,1:1. `.ui-panel` berlatar `--accent-3` (`ui/msa-components.css:25`); `--pale` tidak perlu karena #1d5f99 di atas blue-pale 5,39:1. Periksa juga permukaan `--accent-3` lain (isi grafik di galeri).

### 5.4 Token tambahan (A3, A4)
```css
/* usulan, belum diterapkan */
--motion-fast:120ms;--motion-base:180ms;
.ui-stat__value{font-variant-numeric:tabular-nums}
```
Dipakai hanya untuk transisi `opacity`/`transform` yang sudah ada; tidak menambah animasi baru.

### 5.5 Sheet filter (A5)
Prioritas rendah. Bila dikerjakan: latar `inert` saat terbuka; `<dialog>` hanya bila tes 9B.1 yang memakai `#calendar-filters button` tetap lulus.

### 5.6 Area bawah layar
Jumlahkan ruang yang benar-benar terpakai per keadaan: nav 72 + FAB lift 28 + CTA lengket 56 + banner offline + `--safe-bottom`. `--nav-clearance:96px` hanya cukup untuk nav + FAB. Layar absensi dengan CTA lengket dan banner perlu clearance sendiri. Verifikasi dengan tangkapan, bukan hitungan saja.

## 6. Kriteria penerimaan per bagian kerja berikutnya

Ditambahkan ke BRIEF §4, tidak menggantikan:
1. Tidak ada pesan sukses yang muncul sebelum `phase:'saved'`.
2. "Belum Diabsen", status kehadiran, "Draf" dan "Selesai" dapat dibedakan tanpa warna (ikon + teks).
3. Fokus terlihat pada setiap permukaan, termasuk panel `--accent-3` (≥3:1 terhadap warna di sebelahnya).
4. Reflow 320 px (atau zoom 400% dari 1280) tanpa gulir horizontal, selain empat lebar proyek.
5. Zoom teks 200%: nama siswa panjang membungkus, tidak terpotong sampai sulit dibedakan.
6. Satu aksi dominan per viewport.
7. Kontrol dan pesan galat tidak tertutup nav/FAB/CTA/keyboard pada kombinasi yang diuji.
8. Live region hanya untuk hasil aksi; fokus tidak dipindah kecuali modal.

## 7. Rencana uji perangkat (koordinasi pengguna)

Android Chrome dan iPhone Safari, mode tab dan standalone:
1. Buka pencarian siswa, ketik nama panjang, gulir ke hasil terakhir.
2. Tutup keyboard lewat tombol sistem; nav/CTA kembali benar.
3. Putar perangkat; kembali dari aplikasi lain; refresh di halaman turunan.
4. Matikan jaringan saat menyimpan; pastikan muncul "belum dapat dipastikan" dan "Coba lagi" bekerja.
5. Keyboard eksternal: Tab melewati seluruh roster; fokus tidak tertutup CTA lengket.

Uji pengguna kualitatif 5–8 orang (Mentor dan PIC/Admin) dengan data fiktif, skenario sesuai §11 riset .md. Penilaian estetika ditanyakan setelah tugas.

## 8. Usulan urutan

| Prio | Butir | Catatan |
|---|---|---|
| P0 | §4 matriks state absensi, diterapkan pada render `secure-mentor.js` | Setelah U6b selesai; render saja |
| P0 | §5.1 aksi Buat | Kecil, tanpa ubah tes (opsi usulan) |
| P1 | §5.3, §5.4 | Kecil, satu bagian kerja |
| P1 | §5.2, §5.6, §7 | Butuh uji perangkat |
| P1 | B1–B4 | Tugas Codex terpisah; Claude hanya mencatat permintaan di berkas status |
| P2 | §5.5, layout desktop list-detail | Setelah P0/P1 |

## 9. Keputusan yang menunggu pengguna

1. Aksi Buat: opsi usulan (turunkan `#portal-new` ke sekunder di <900 px) atau alternatif (sembunyikan, ubah tes)?
2. Judul layar: biarkan 40/44 sampai uji 360 px, atau langsung token khusus layar tugas?
3. B1–B4: diteruskan ke Codex sekarang, atau setelah overhaul selesai?
