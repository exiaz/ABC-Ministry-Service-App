# Rencana ulang UI/UX MSA setelah Taste/Pil

Agen: Claude · Branch: development · Basis: development @ 1686188 · Tanggal: 2026-11-06
Status: PLANNED / NOT IMPLEMENTED (laporan dan rencana saja, tanpa perubahan kode) · Produksi: NO-GO

## Ringkasan

Arah visual sudah berganti dari C10 ke gaya **Pil** (`mockup ui_ux/`, empat PDF), tetapi repositori kini memuat empat lapisan visual yang berjalan sendiri-sendiri dan dokumen acuan yang masih menyebut C10. Hasil terbaik Taste/Codex (`index.html` + `ui/pil*`) baru berupa prototipe dengan data fiktif; halaman operasional yang benar-benar dipakai Mentor dan Admin belum memakainya. Rencana di bawah menyatukan semuanya ke satu sistem Pil, lalu memindahkan layar satu per satu, dimulai dari jalur Mentor.

## Temuan (diperiksa di kode dan browser)

### 1. Empat lapisan visual paralel

| Lapisan | Berkas | Dipakai oleh | Gaya |
|---|---|---|---|
| Komponen bersama `ui-*` (U2–U6b) | `ui/msa-tokens.css`, `msa-components.css`, `msa-admin.css`, `msa-auth.css` | Semua halaman operasional `msa-*`, `register`, `account-recovery`, `identity-review`, `visual-studio`, `mentor-account` | Token sudah diubah Codex ke Pil (kanvas putih, radius 32/40, judul 28px), komponen masih bentuk C10 |
| Prototipe Pil | `index.html`, `ui/pil.css`, `pil.js`, `pil-kit.css`, `pil-data.js` | Root server pratinjau saja, 13 view, data fiktif | Paling dekat ke mockup; hanya `/api/portal/login` yang tersambung |
| Prototipe absen | `ui-absen.html`, `ui/absen*` | Tidak dipakai halaman aktif | Geist + krem, berbeda dari Pil dan C10 |
| Ruang tinjauan | `ui-review.html`, `ui/review*` | Arsip | Kit tinjauan |

`ui/pil-charts.js`, `ui/absen-charts.js`, `ui/review-charts.js` identik byte-per-byte (masing-masing 59 KB, diperiksa dengan `cmp`).

### 2. Dokumen acuan tidak selaras
- `docs/ui-overhaul/BRIEF.md` masih menetapkan C10 (kanvas krem `#fff8d6`, radius 28/36, judul 56px), sedangkan `ui/msa-tokens.css` sudah Pil dan `.taste/brief.json` mencatat "Kita tinggalkan C10".
- `PROJECT_STATUS.md` entri teratas 5 November; pekerjaan Pil (build, repair 1–2, perbaikan 6 November) belum tercatat di sana.
- Temuan audit 4 dan 5 dari tinjauan Pil disebut "tetap terbuka" di laporan Codex, tetapi isinya tidak saya temukan di `docs/status/` atau `docs/reviews/`.

### 3. Jalur Mentor masih campuran
`mentor-account.html` (jalur yang paling sering dipakai: masuk, beranda, absensi) masih memuat `styles.css` legacy lalu menimpanya dengan token Pil dan `msa-auth.css`. Absensi sungguhan di `mentor-attendance.js`/`secure-mentor.js` belum memakai pola layar Absensi Pil.

### 4. Admin legacy belum selesai
`admin.html` + `secure-admin.js` + `styles.css` masih menjadi halaman utama `admin-server.mjs`. Rencana `PLAN-migrasi-admin.md`: Fase A selesai (`msa-users.html`), Fase B–E belum.

### 5. Kejujuran data
Prototipe Pil menampilkan Dasbor kehadiran (82%, enam pekan) dan Dasbor Volunteer dari fixture. Belum ada endpoint agregat; view ini tidak boleh dipindah ke halaman operasional sebelum API disetujui (BRIEF bagian 2.5).

## Arah yang diusulkan

**Satu sistem: Pil.** Komponen dari prototipe dinaikkan ke pustaka bersama `ui/msa-*`, lalu halaman operasional memakainya. Prototipe `index.html` menjadi referensi hidup sampai semua layarnya punya padanan operasional.

## Yang harus dikerjakan (urut, tiap fase butuh persetujuan terpisah)

| Fase | Isi | Pemilik | Risiko | Tes utama |
|---|---|---|---|---|
| **P0 Selaraskan acuan** | Tulis ulang `BRIEF.md` ke Pil (token dari `msa-tokens.css` + D0, catat beda D0 vs mockup layar); C10 ditandai historis. Putuskan nasib `ui-absen.html` dan `ui-review.html`. Cari/tulis ulang temuan audit 4–5. | Claude (dokumen) | rendah | tidak ada kode |
| **P1 Pustaka komponen Pil** | Pindahkan komponen Pil (kartu pelayanan bertanggal, baris siswa + pilihan status, tab segmen, ubin statistik, sidebar 272px, nav pil ponsel, keadaan kosong/muat/galat) ke `ui/msa-components.css` dengan nama `ui-*`. `pil.css` jadi pemakai. Satu `charts.js`. `ui-gallery.html` menampilkan semua komponen dan keadaannya. | Claude | sedang: halaman aktif ikut berubah | `npm.cmd test`, `tests/ui-tokens.test.mjs`, `tests/pil-browser.mjs`, `--a2-2`, `--visual` |
| **P2 Jalur Mentor** | `mentor-account.html` lepas dari `styles.css`. Beranda Mentor dan Absensi memakai pola Pil (ringkasan x/y, filter status, baris siswa, aksi simpan lengket, banner offline). Hook dan kontrak absensi tidak berubah. | Claude; `mentor-attendance.js` ditentukan pengguna | sedang–tinggi: alur inti | `--a2-3`, `--a2-4a`, `auth-pilot-browser` |
| **P3 Masuk dan pemulihan** | Welcome/Masuk/Daftar sudah sebagian Pil; rapikan sisa, termasuk ruang peninjau pemulihan yang masih gaya lama. | Claude | rendah | `msa-portal-focus*`, `msa-portal-browser` |
| **P4 Portal Admin** | Beranda Admin, Pelayanan, Kalender (`msa-portal`, `msa-events`, `msa-core`) memakai pola Pil. | Claude | sedang | `--a1`, `--stage8`, `--a2-4b`, `--a2-4c` |
| **P5 Migrasi Admin B, C, E** | Perangkat & kode → `msa-devices.html`; akun & kalender. Fase E (cutover `admin-server.mjs`, hapus `admin.html`/`styles.css`) diserahkan ke Codex. | Claude, lalu Codex | sedang | sesuai `PLAN-migrasi-admin.md` |
| **P6 Dasbor** | Dasbor kehadiran dan Volunteer. **Terblokir**: perlu endpoint agregat berizin (Codex) dan keputusan Fase D. | Codex dulu | tinggi: privasi siswa | — |

Lintas fase: uji perangkat fisik (Android + iPhone), screen reader (TalkBack/VoiceOver), Safari; versi cache `sw.js` dan daftar `server.mjs` oleh integrator; `PROJECT_STATUS.md` diperbarui integrator setelah tiap integrasi.

## Keputusan yang dibutuhkan dari pengguna
1. Pil resmi menjadi satu-satunya arah, dan C10 menjadi historis?
2. `ui-absen.html` (Geist, krem): pensiunkan, atau ambil pola yang berguna lalu hapus?
3. Prototipe `index.html`: tetap sebagai referensi sampai P4 selesai, atau root pratinjau dikembalikan ke halaman lain?
4. P6: minta Codex merancang endpoint agregat kehadiran?
5. Mulai dari P0?

## Kontrak yang berubah
Tidak ada. Tidak ada berkas kode, id, rute, endpoint, atau teks tes yang disunting.

## Kebutuhan integrasi
- `sw.js`: tidak. `server.mjs`: tidak.
- Baris `PROJECT_STATUS.md` yang disarankan: "6 November 2026 — Rencana ulang UI/UX: Pil sebagai satu sistem, fase P0–P6. PLANNED. [laporan](docs/status/2026-11-06-claude-rencana-ui-ux.md)."

## Verifikasi aktual
- Dibaca: `PROJECT_STATUS.md`, `BRIEF.md`, `PLAN-migrasi-admin.md`, laporan Codex Taste/Pil 5–6 November, laporan Claude layar absen dan Fase A, `.taste/brief.json`, `.taste/page.json`, `ui/msa-tokens.css`.
- Dipetakan: CSS yang dimuat tiap halaman `*.html` (grep).
- Browser: `node server.mjs` di port 4199 (sementara, sudah dihentikan). Dilihat `#/beranda` dan `#/absensi` prototipe Pil serta `ui-absen.html` pada ±800px. `msa-portal.html` 404 di server ini (butuh `admin-server.mjs` + emulator), jadi halaman operasional tidak dilihat langsung.
- Tidak menjalankan `npm.cmd test`/`check`: tidak ada perubahan kode.
- Belum diperiksa: isi visual empat PDF mockup (hanya diketahui dari laporan Codex), halaman operasional di emulator, perangkat fisik.

## Risiko dan pertanyaan terbuka
- P1 mengubah tampilan semua halaman aktif sekaligus; perlu tangkapan sebelum/sesudah per halaman.
- Isi temuan audit 4–5 tidak diketahui.
- `mentor-attendance.js` mencampur render dan logika absensi; pembagian kepemilikan perlu ditetapkan sebelum P2.

## Serah terima
- Penulis: Claude, selesai. Baseline 1686188; satu berkas baru (laporan ini). Tidak ada perubahan lokal lain.
- Tidak ada commit, push, atau deploy.

## Usulan commit
Summary: `docs(ui): rencana ulang UI/UX menuju satu sistem Pil`
Description: Laporan temuan empat lapisan visual dan acuan C10 yang usang, serta fase P0–P6 untuk menyatukan tampilan MSA ke gaya Pil.
