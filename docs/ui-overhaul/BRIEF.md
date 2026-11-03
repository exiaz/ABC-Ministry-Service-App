# UI Overhaul MSA — brief bersama

Dibaca di awal setiap bagian kerja U1–U7. Status: **PLANNED**, setiap bagian memerlukan prompt terpisah dari pengguna.

## 1. Sumber acuan

| Acuan | Isi |
|---|---|
| `docs/ui-overhaul/C10-lembar-komponen.pdf` (+ `C10-preview.png`) | Sumber kebenaran visual: bentuk, warna, tipografi, tombol, input, status, kartu, navigasi, grafik, Lakukan/Hindari |
| Bagian 3 dokumen ini | Ringkasan C10 dalam bentuk token, dipakai saat menulis CSS |
| `AGENTS.md`, `MASTER_BRIEF.md` | Aturan pengembangan dan aturan domain. Menang bila bertentangan dengan dokumen ini |
| `docs/ui-overhaul/INVENTORY.md` | Hasil U1: peta halaman, CSS, JS hook dan teks yang dipakai tes |
| `PROJECT_STATUS.md` | Baca **entri teratas saja** (sekitar 60 baris pertama). Jangan baca seluruh berkas (±370 KB) |

Jangan membaca `README.md` utuh, log `.emulator-data/`, atau `node_modules/`. Pakai grep untuk mencari.

## 2. Batas lingkup (wajib)

1. **Hanya lapisan tampilan:** HTML markup, CSS, aset statis, dan kode render di JS (pembuatan elemen, class, teks). Tidak mengubah `backend/`, API, kontrak request/response, autentikasi, sesi, proof perangkat, otorisasi, aturan absensi, histori, atau gate/flag.
2. **Pertahankan hook:** `id`, `name`, `data-*`, atribut ARIA yang dibaca JS/tes, struktur form, rute hash (`/#masuk` dan lainnya) dan URL halaman. Bila hook harus dipindah, catat di laporan.
3. **Teks yang dipakai assertion tes** boleh diubah hanya bila tes yang sama diperbarui di bagian kerja yang sama dan dicatat (lama → baru).
4. **Perubahan server statis** (`server.mjs` atau daftar file yang diizinkan) hanya sebatas mengizinkan berkas CSS/font/ikon baru. Tidak mengubah header keamanan, CORS, atau rute API.
5. **Kejujuran data:** tidak menampilkan angka, grafik, atau fitur yang tidak didukung API. Komponen grafik C10 hanya dibuat di galeri U2 sampai ada endpoint agregat yang disetujui. Menu "Riwayat" Mentor hanya dipasang bila rutenya sudah ada; jika belum, hilangkan dan catat.
6. **Halaman legacy** (`index.html`, `admin.html`, `mentor.html`, `a1.html` dengan `styles.css`) di luar lingkup kecuali disebut eksplisit.
7. Tidak menambah dependensi npm, framework, CDN, atau build step. Tetap vanilla HTML/CSS/ES modules.
8. Tidak commit, push, atau deploy.

## 3. Ringkasan sistem visual C10

**Token** (nilai dari design system ABC, tema `ceria`; nama variabel tetap):

| Token | Nilai | Peran |
|---|---|---|
| `--surface-200` | #fff8d6 | Kanvas halaman (krem) |
| `--surface-100` | #ffffff | Kartu, nav, kolom isian |
| `--ink` / `--ink-muted` | #231f20 / #5c5350 | Teks utama / sekunder |
| `--primary` / `--primary-hover` / `--on-primary` | #c81e1e / #a31717 / #fff | Tombol utama, satu per layar |
| `--accent-yellow` | #f8ed32 | Aktif, FAB, hadir. Teks di atasnya `--on-accent` #231f20 |
| `--accent-3` | #64a4d9 | Panel dan isi grafik. Teks di atasnya `--on-accent` |
| `--accent-3-text` | #1d5f99 | Teks/ikon biru, `--focus-ring` |
| `--line` / `--control-border` | #e6ddd2 / #857a76 | Pemisah / tepi kolom isian (1,5px) dan centang kosong |
| `--blue-pale` (turunan baru) | #dae9f6 = 24% accent-3 di atas putih | Trek, ubin, avatar, tombol tersier, panel terang |
| `--logo-red` | #ee2525 | Hanya bentuk besar atau teks ≥24px |

**Radius:** `--radius-pill` 999 (tombol, kolom isian, chip, tab, FAB, bilah status, batang grafik); `--radius-lg` 28 (ubin statistik, baris siswa, kartu pelayanan, kartu kelompok); `--radius-xl` **36 (token baru = lg + 8)** untuk hero foto, panel berwarna, sheet bawah, kartu grafik; lingkaran untuk centang, tombol ikon, avatar, penanda pekan. **Tidak ada sudut 8/16px pada tombol, kolom isian, atau chip.**

**Tipografi:** Baloo 2 800 56/60 (judul layar), 800 36/40 (sapaan), 700 20/24 (judul kartu/bagian). Nunito Sans 800 17/24 (teks tombol), 400 16/24 (isi dan kolom isian), 700 13/18 (keterangan, label ubin), 800 12/16 +6% huruf kapital (label seksi). Font di-self-host (`woff2`, lisensi OFL disertakan), bukan dari Google Fonts.

**Komponen:**
- Tombol: tinggi 56 untuk aksi utama, 48 lainnya. Varian utama (primary), sekunder (garis primary), tersier (biru pucat), nonaktif (alasan ditulis dekat tombol), teks, FAB kuning, tombol ikon. Semua ≥48.
- Input: label selalu terlihat di atas kolom; kolom isian kapsul; pencarian dengan ikon.
- Tab segmen dengan jumlah (Semua 24, Hadir 18, ...). Chip program. Status Draf/Terbit/Dibatalkan = **ikon + teks + warna**.
- Ubin statistik (angka Baloo 2 + label), baris siswa ≥64 dengan avatar inisial dan centang 48×48 (hadir = kuning bercentang tepi ink; belum = putih tepi `control-border`), baris tautan dengan ikon dan chevron.
- Kartu pelayanan boarding-pass: stub tanggal (hari/tanggal/bulan) berwarna menurut status, organisasi · program, judul, tempat, PIC, badge status.
- Navigasi bawah terang: bar putih 72, FAB kuning 56 menonjol dengan label di bawahnya, item aktif = pil kuning di belakang ikon + label tebal, `active="none"` untuk layar tanpa menu aktif, sisakan 96px ruang bawah konten, hormati safe-area. Sidebar desktop memakai bahasa yang sama: latar putih, item aktif kapsul kuning. **Tidak ada navigasi atau sidebar gelap.**
- Banner "Pilot lokal · data fiktif" satu komponen, bisa ditutup.
- Grafik (galeri saja, lihat 2.5): trek biru pucat, isi accent-3, pekan terakhir kuning bertepi ink, nilai selalu tertulis.

**Kontras (dihitung dengan rumus WCAG, 3 Nov 2026):** ink/accent-3 6,1; putih/primary 5,74; ink/accent-yellow 13,3; ink/blue-pale 13,2; ink-muted/blue-pale 6,0; accent-3-text/blue-pale 5,4; primary/surface-200 5,4; primary/blue-pale 4,64; ink-muted/surface-200 7,0; control-border/putih 4,16 (≥3 untuk tepi kontrol). Biru 2,67 dan kuning 1,22 di atas putih hanya untuk bentuk grafis, bukan teks.

**Ikon:** satu set gaya Lucide (lisensi ISC, sertakan berkas lisensi), inline SVG atau sprite lokal, stroke seragam.

**Bahasa:** seluruh teks UI Bahasa Indonesia. Pertahankan istilah **Volunteer**. Ganti teks Inggris (Welcome back, Log in, Sign up, Show, Forgot password?) dengan padanan Indonesia: Selamat datang kembali, Masuk, Daftar, Tampilkan, Lupa kata sandi?

**Foto hero:** memakai slot Visual Studio yang ada. Placeholder dokumentasi tanpa wajah anak.

## 4. Verifikasi per bagian

- Selalu: `npm.cmd run check`, `npm.cmd test`, `git diff --check`.
- Suite area (konfirmasi pemetaan di U1): masuk/daftar → `tests/msa-portal-focus*.mjs`, `tests/msa-portal-browser.mjs`, `tests/auth-pilot-browser.mjs`, `node tests/stage3.mjs --a2-2` dan `--visual`; Mentor → `--a2-3`, `--a2-4a`; portal → `--a1`, `--stage8`, `--stage9b2`, `--a2-4b`, `--a2-4c`; akhir → `npm.cmd run test:stage6`.
- Tangkapan Chrome di 360/390/768/1365 px untuk layar yang diubah: tanpa overflow horizontal, kontrol ≥48, cincin fokus terlihat, `prefers-reduced-motion` dihormati, konten tidak tertutup nav/FAB atau keyboard.
- Pasangan warna baru di luar daftar di atas wajib dihitung kontrasnya.
- Tes gagal tidak boleh diatasi dengan menambah timeout atau melemahkan assertion tanpa akar masalah.

## 5. Laporan

Ikuti format AGENTS.md. Tambahkan entri teratas di `PROJECT_STATUS.md` dengan label bagian (misalnya "UI-OVERHAUL U2"). Sertakan daftar hook atau teks tes yang berubah. Bedakan diimplementasikan, diuji, dan belum diuji (perangkat fisik, screen reader, browser selain Chrome).
