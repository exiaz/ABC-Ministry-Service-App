# UI Overhaul MSA: satu sistem Pil

Keputusan pengguna (6 November 2026): **Pil satu-satunya arah visual; C10 historis.** P0 menyelaraskan acuan. P1–P6 berstatus **PLANNED / NOT IMPLEMENTED** dan tiap fase memerlukan penugasan terpisah. Prototipe tidak membuktikan halaman operasional sudah dimigrasi.

## 1. Tahapan dan acuan

| Fase | Hasil yang dituju |
|---|---|
| P0 | Acuan Pil diselaraskan, C10 historis, temuan terbuka dicatat (dokumen ini). |
| P1 | Pustaka komponen Pil bersama `ui/msa-*`, galeri seluruh keadaan, satu modul grafik, audit 4–5 diperbaiki. |
| P2 | Jalur Mentor: beranda dan absensi, controller dan kontrak tetap. |
| P3 | Masuk, daftar, dan pemulihan lewat handler yang ada. |
| P4 | Portal Admin: beranda, Pelayanan, Kalender. |
| P5 | Migrasi Admin B/C/E sesuai `PLAN-migrasi-admin.md`; cutover server oleh penanggung jawabnya. |
| P6 | Dasbor Anak/Volunteer: **terblokir** API agregat berizin dan keputusan Fase D. Fixture bukan data operasional. |

| Acuan | Kedudukan |
|---|---|
| `mockup ui_ux/D0 · Panduan gaya Pil (guideline).pdf` | Sistem visual Pil (bagian 3 diringkas dari berkas ini). |
| Tiga PDF layar lain di `mockup ui_ux/` | Komposisi layar D1–D11 (lihat 3.8). Komposisi layar menang atas aturan umum D0. |
| `ui/msa-tokens.css` | Sumber nilai token di kode. Bila berbeda dari D0, catat dan selaraskan di P1; jangan membuat standar kedua. |
| `index.html` + `ui/pil*` | Referensi implementasi hidup dengan fixture, bukan halaman operasional. |
| `.taste/brand.json`, `.taste/page.json` | Blueprint grid dan catatan pemeriksaan PDF terdahulu. |
| `C10-lembar-komponen.pdf`, `C10-preview.png`, `C10-ADDENDUM.md` | **Historis.** Disimpan, bukan acuan pekerjaan baru. |
| `AGENTS.md`, `MASTER_BRIEF.md` | Aturan kerja/domain; menang bila bertentangan. |
| `INVENTORY.md`, `docs/status/2026-11-06-claude-rencana-ui-ux.md` | Peta hook/teks tes historis dan rencana P0–P6. |
| `PROJECT_STATUS.md` | Baca entri teratas saja. |

PDF berisi gambar JPEG tertanam (bukan teks/vektor). D0 diperiksa visual oleh Claude pada 6 November 2026; tiga PDF layar belum diperiksa ulang pada P0.

## 2. Batas lingkup (wajib)

1. **Hanya lapisan tampilan:** HTML markup, CSS, aset statis, dan kode render di JS (pembuatan elemen, class, teks). Tidak mengubah `backend/`, API, kontrak request/response, autentikasi, sesi, proof perangkat, otorisasi, aturan absensi, histori, atau gate/flag.
2. **Pertahankan hook:** `id`, `name`, `data-*`, atribut ARIA yang dibaca JS/tes, struktur form, rute hash dan URL halaman. Bila hook harus dipindah, catat di laporan.
3. **Teks yang dipakai assertion tes** hanya diubah bersama tesnya di bagian kerja yang sama, dicatat lama → baru.
4. **Server statis** (`server.mjs`, daftar berkas yang diizinkan) hanya untuk mengizinkan CSS/font/ikon baru. Header keamanan, CORS, dan rute API tidak diubah.
5. **Kejujuran data:** tidak menampilkan angka, grafik, atau fitur yang tidak didukung API. Grafik fixture hanya di prototipe/galeri sampai endpoint agregat disetujui. Tujuan navigasi yang belum punya rute (Riwayat, Jadwal Mentor, dll.) disembunyikan dan dicatat.
6. **Halaman legacy** (`admin.html`, `styles.css`) di luar lingkup kecuali dalam P2 (lepas `styles.css` dari jalur Mentor) dan P5.
7. Tanpa dependensi npm, framework, CDN, atau build step. Tetap vanilla HTML/CSS/ES modules.
8. Tidak commit, merge, push, atau deploy tanpa izin eksplisit.

## 3. Sistem visual Pil (dari D0)

Empat prinsip D0: **Putih** (kanvas selalu putih; warna datang dari kartu), **Bulat** (kapsul untuk kontrol dan baris, kartu 32–40, tanpa sudut lancip), **Satu fokus** (satu kartu merah besar per layar; sisanya abu muda atau hitam), **Terbaca** (skala huruf tetap; status dengan ikon dan teks; angka selalu ditulis).

### 3.1 Warna (nilai dari `ui/msa-tokens.css`)

| Peran D0 | Token | Nilai | Pemakaian |
|---|---|---|---|
| Merah · primary | `--primary` / `--primary-hover` | `#c81e1e` / `#a31717` | Kartu fokus, aksi utama; hover/ditekan lebih gelap |
| Hitam · ink | `--ink` / `--ink-muted` | `#231f20` / `#5c5350` | Teks, kartu gelap, FAB, chip aktif / teks sekunder |
| Abu muda 4% | `--surface-soft` | `#f6f6f6` | Kartu, baris, isian, chip tidak aktif |
| Kuning · accent | `--accent-yellow` | `#f8ed32` | Tab aktif, centang, sorotan; teks di atasnya tinta |
| Biru · accent-3 | `--accent-3` / `--accent-3-text` | `#64a4d9` / `#1d5f99` | Data grafik, status Terbit / teks dan cincin fokus biru |
| Putih · kanvas | `--surface-100`, `--surface-200` | `#ffffff` | Latar layar dan navigasi |
| Pendukung | `--blue-pale`, `--line`, `--control-border`, `--logo-red` | `#dae9f6`, `#e8eaec`, `#857a76`, `#ee2525` | Badge Terbit/ubin, pemisah, tepi kontrol, logo saja |

Kuning dan biru muda **tidak pernah** menjadi warna teks. Latar krem dilarang.

### 3.2 Tipografi: delapan ukuran saja

| Peran | Ukuran | Pemakaian | Token sekarang |
|---|---|---|---|
| Hero | Baloo 2 800 48/52 | Satu angka utama di kartu merah | **belum ada** |
| Display | Baloo 2 800 32/36 | Sapaan beranda, angka ubin besar, judul konten desktop | `--type-greeting`, `--type-stat` |
| Judul | Baloo 2 800 28/32 | Judul layar, nama sekolah di kartu | `--type-screen` |
| Subjudul | Baloo 2 700 24/28 | Angka ubin, judul panel | **belum ada** |
| Bagian | Baloo 2 700 20/24 | Judul bagian dan kartu | `--type-title` |
| Isi | Nunito Sans 800/600 16/20 | Nama baris, tombol, isian (min. 16 agar iOS tidak memperbesar) | `--type-button` 800 16/20; `--type-body` **400 16/24 berbeda** |
| Kecil | Nunito Sans 600 14/20 | Keterangan, chip, tab | `--type-caption` |
| Label | Nunito Sans 700 12/16 | Label nav, lencana, sumbu grafik; ukuran terkecil | `--type-label` |

Hindari: judul di atas 32 selain hero 48; teks di bawah 12. Sentence case. Angka yang berubah memakai `tabular-nums`. Font lokal beserta OFL.

### 3.3 Bentuk dan jarak

- Radius: **999** kapsul (tombol, chip, tab, baris, isian, nav); **32** ubin (statistik, tanggal); **40** kartu besar (kartu fokus, grafik, kartu pelayanan, tepi atas sheet). Token `--radius-lg` 32, `--radius-xl` 40 sudah sesuai.
- Jarak kelipatan 4: **8** antar baris, **10** antar kartu, **16** dalam kartu, **24** sisi layar, **48** tinggi sentuh. Desktop: grid 3 kolom jarak 16.
- Kartu diam tanpa bayangan; bayangan hanya untuk nav mengambang dan overlay.

### 3.4 Komponen

- **Tombol:** utama 60 tinggi; ikon bulat 48; varian merah (aksi utama), hitam (mis. Mulai absensi), kuning (mis. Buat pelayanan), abu (Batal). Satu aksi utama per layar.
- **Chip/tab segmen berjumlah** (Semua 24, Hadir 18, Belum 4): aktif hitam, tidak aktif abu. D0 menulis chip 44; **pakai area sentuh 48** (`AGENTS.md`). Label tidak menyusut; gulir horizontal bila sempit.
- **Badge status:** Terbit (biru pucat + centang), Draf (kuning + pensil), Belum diisi (merah + tanda seru), Dibatalkan (garis netral + ikon larangan).
- **Kartu fokus merah** (judul kecil, angka hero, kapsul putih jumlah), **ubin abu** (angka + label), **kartu gelap** (judul kuning di atas hitam).
- **Baris siswa** kapsul abu: avatar inisial putih, nama (Isi) + kelas (Kecil), centang lingkaran 48 (hadir = kuning bertepi tinta). Status Hadir/Izin/Tidak hadir/Belum diisi mengikuti enum controller, tidak hanya warna.
- **Kartu pelayanan:** tinggi 104, radius 40, ubin tanggal (HARI/tanggal) berwarna menurut status (Terbit biru, Draf kuning, Dibatalkan putih bertepi), badge, judul, tempat · PIC. Dibatalkan: judul dicoret, kartu lebih redup, tetap ikon + teks.
- **Formulir:** isian kapsul 56 dengan garis 1,5px; label 14 di atas isian, selalu terlihat. Galat: garis merah 2px + ikon + pesan. Tombol kirim menampilkan pemintal + teks (mis. "Memeriksa…").
- **Bottom sheet:** radius atas 40, pegangan 40×4, latar gelap 55%; tombol bawah sekunder abu : utama merah = 1 : 1,4.

### 3.5 Keadaan

- **Interaksi:** biasa, fokus (**cincin biru dengan celah putih** di sekeliling kontrol), ditekan (lebih gelap), nonaktif (abu, alasan ditulis di dekat tombol).
- **Status sistem:** offline = bilah kuning berikon + jumlah menunggu ("3 menunggu"); galat = bilah bertepi merah berikon + kalimat jelas; kosong = ikon dalam lingkaran kuning, judul, petunjuk, satu aksi. Memuat: bidang abu tanpa shimmer.
- Simpan berhasil hanya setelah konfirmasi server; tanpa antrean otomatis baru. Motion 180ms `cubic-bezier(0.2,0,0,1)`, tanpa entrance/count-up; `prefers-reduced-motion` langsung.

### 3.6 Navigasi

- **Ponsel:** pil putih mengambang tinggi 72, margin 16 dari tepi + safe-area; tab aktif kapsul kuning; FAB hitam 56 di tengah untuk aksi utama (Mentor: absensi; Admin: buat pelayanan). Label 12/14. Mentor: Beranda, Jadwal, ◉, Riwayat, Akun. Admin: Beranda, Pelayanan, ⊕, Kalender, Akun. Tujuan tanpa rute disembunyikan (2.5).
- **Layar detail** (Absensi, Dasbor): ikon kembali bulat kiri atas; bilah aksi bawah menggantikan nav selama tugas berlangsung.
- **Desktop 1440×900:** sidebar putih 272 dengan garis kanan; item kapsul 52, ikon 22, aktif kuning; aksi utama kapsul hitam "Buat pelayanan" di dasar sidebar; konten berjarak 40, judul 32/36 di kiri, kontrol di kanan, lalu kartu grid 3 kolom. Lebar menengah (641–1100) memakai menu sheet (Escape, focus trap, fokus kembali) sesuai blueprint `.taste/page.json`.
- **Masuk desktop:** panel foto bulat lebar 700 di kiri, formulir 440 di tengah kanan; tanpa nav aplikasi.
- Banner "Pilot lokal · data fiktif": bilah biru dengan ikon info dan tombol tutup.

### 3.7 Visualisasi

Cincin untuk proporsi (mis. 18/24 hadir: cincin kuning di atas hitam), batang kapsul untuk tren; periode terakhir kuning bertepi tinta, lainnya biru; angka di dalam atau di bawah. Nilai selalu ditulis sebagai angka. Grafik fixture diberi label contoh; grafik operasional menunggu P6.

### 3.8 Peta layar Pil

| Area | Layar |
|---|---|
| Autentikasi | D6 Welcome · D7 Masuk · D7b galat · D7c memuat · D9 Masuk desktop |
| Mentor | D1 Beranda · D2 Absensi · D2b Absensi offline |
| Admin | D5 Beranda · D8 Kalender · D8b filter · D8c kosong · D10 Beranda desktop |
| Dasbor | D3 Anak · D4 Volunteer · D11 Dasbor desktop |
| **Belum ada desain** | Daftar Volunteer, Tinjauan sebelum selesai, Akun, Riwayat, Jadwal Mentor: pakai alur yang ada, tanpa mengarang fitur |

## 4. Kontras (dihitung ulang Codex, 6 November 2026)

Rumus WCAG; teks biasa ≥4,5:1, teks besar ≥3:1, tepi/indikator kontrol ≥3:1.

| Pasangan (depan / belakang) | Rasio | Keputusan |
|---|---|---|
| ink / putih; muted / putih; muted / soft | 16,30; 7,48; 6,92 | Lulus |
| putih / primary; / primary-hover; / ink | 5,74; 7,80; 16,30 | Lulus |
| ink / kuning; / accent-3; / blue-pale | 13,31; 6,10; 13,17 | Lulus |
| accent-3-text / putih; / blue-pale | 6,67; 5,39 | Lulus |
| control-border / putih; / soft; line / putih | 4,16; 3,85; 1,21 | Tepi kontrol lulus; line hanya dekoratif |
| accent-3 / putih; kuning / putih; logo-red / putih | 2,67; 1,22; 4,26 | Bukan warna teks; mark grafik perlu tepi |
| **fokus biru / ink; / primary** | **2,44; 1,16** | **Gagal 3:1** → cincin dengan celah putih (3.5), audit 4 |

Pasangan baru atau latar berbeda wajib dihitung ulang.

## 5. Temuan terbuka dan beda acuan

| Temuan | Rincian | Fase |
|---|---|---|
| Audit 4 (P2) | Cincin fokus `var(--chart-1)` di `ui/pil.css` hanya 2,44:1 di panel gelap, 1,16:1 di panel merah | P1 |
| Audit 5 (P3) | `.btn.primary` (0,2,0) mengalahkan `button:disabled` (0,1,1): tombol nonaktif tetap merah. D0 menetapkan nonaktif abu + alasan | P1 |
| Token vs D0 | Hero 48/52 dan Subjudul 24/28 belum ada; `--type-body` 400 16/24 vs D0 Isi 600 16/20 | P1 |
| Prototipe vs token | `#868485` (prototipe) vs `--control-border` `#857a76`; warna status prototipe (positif/galat/peringatan) belum jadi token bersama | P1 |
| D0 vs `AGENTS.md` | Chip 44 → area sentuh 48 | P1 |
| D0 vs mockup layar | Komposisi layar menang (mis. fokus gelap pada Absensi tidak dipaksa jadi kartu merah); a11y dan keamanan tetap wajib | semua |

Sumber audit 4–5: laporan `docs/status/2026-11-06-codex-p0-acuan-pil.md`.

## 6. Prototipe lain

`ui-absen.html` (Geist, krem) dan `ui-review.html` **bukan acuan**; status **menunggu keputusan pengguna (pensiun/arsip)**, tidak dihapus. `ui/pil-charts.js`, `ui/absen-charts.js`, `ui/review-charts.js` identik (SHA-256 sama); konsolidasi di P1.

## 7. Verifikasi per fase

- Fase yang mengubah kode: `npm.cmd run check`, `npm.cmd test`, `git diff --check`; plus `node tests/pil-browser.mjs` dan `node --test tests/ui-tokens.test.mjs` sesuai area.
- Suite area: masuk/daftar → `tests/msa-portal-focus*.mjs`, `tests/msa-portal-browser.mjs`, `tests/auth-pilot-browser.mjs`, `node tests/stage3.mjs --a2-2` dan `--visual`; Mentor → `--a2-3`, `--a2-4a`; portal → `--a1`, `--stage8`, `--stage9b2`, `--a2-4b`, `--a2-4c`; akhir → `npm.cmd run test:stage6`.
- Tangkapan Chrome 360/390/768/1365 sebelum/sesudah: tanpa overflow horizontal, target ≥48, cincin fokus terlihat di putih/merah/hitam, label filter utuh, nonaktif jelas, reduced motion, konten tidak tertutup nav/bilah aksi/keyboard. Namespace `test-*`, data fiktif, port terisolasi.
- Tes gagal tidak diatasi dengan menambah timeout atau melemahkan assertion. Catat yang belum diuji: perangkat fisik, Safari/iOS, screen reader, emulator, cache PWA.
- Laporan `docs/status/` mengikuti template: kontrak berubah, kebutuhan integrasi, serah terima, hook/teks tes lama → baru.
