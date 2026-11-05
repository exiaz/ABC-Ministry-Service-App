# API ekspor dan impor XLSX MSA

Agen Codex · Branch `codex/msa-xlsx-import-export` · Basis `development@f9e6c3c` · 2026-11-04
Status IMPLEMENTED pada API pilot · Produksi NO-GO

## Ringkasan

Superadmin dapat mengekspor siswa aktif serta meninjau dan mengonfirmasi impor siswa untuk satu cakupan roster. Mentor dengan perangkat terverifikasi dapat mengekspor siswa atau absensi dari snapshot batch yang diizinkan. Ekspor dan impor yang berhasil tercatat di `msaXlsxAudit`.

## Perubahan

- `backend/msa-xlsx.mjs` menerapkan revisi roster, tanda tangan pratinjau dan receipt idempotensi. Konfirmasi menyimpan perubahan siswa, audit, dan receipt dalam satu transaksi. ID, cakupan, status aktif siswa lama, profil privat, riwayat absensi, dan penugasan dipertahankan.
- `xlsx-reader.js` dan `xlsx.js` dipakai ulang untuk ZIP/OOXML. `backend/workbook-xml.mjs` menyediakan pembaca XML terbatas untuk Node. Sel yang dapat diawali formula dinetralkan saat ekspor. Formula dalam worksheet impor ditolak.
- `backend/msa-auth.mjs`, `backend/msa-http.mjs`, `backend/attendance.mjs`, `backend/attendance-http.mjs`, `backend/mentor-origin.mjs`, dan `backend/server.mjs` menghubungkan API ke autentikasi yang sudah ada dan mengirim XLSX sebagai lampiran biner dengan `Cache-Control: no-store`.

## Kontrak yang berubah

API tersedia pada emulator lokal namespace `test-*` dengan `ABC_MSA_XLSX=1`. Jalur Superadmin juga memakai `ABC_MSA_A1=1`. Cakupan memakai tepat `schoolId`, `groupId`, dan `serviceSessionId`.

| Endpoint | Kontrak |
|---|---|
| `POST /api/a1/xlsx/students/export` | Superadmin. JSON `{scope}` mengembalikan `{revision}`. JSON `{scope, expectedRevision}` mengunduh `siswa.xlsx` jika revisi cocok. |
| `POST /api/a1/xlsx/students/preview` | Superadmin. Cakupan pada query string, body biner dengan tipe MIME XLSX. Respons memuat `previewId`, `revision`, `created`, `updated`, `unchanged`, dan `rows`. |
| `POST /api/a1/xlsx/students/confirm` | Superadmin. Kirim ulang XLSX dan cakupan yang sama serta header `X-MSA-Expected-Revision`, `X-MSA-Preview-Id`, dan `Idempotency-Key` (16–128 karakter ASCII huruf, angka, garis bawah atau tanda hubung). Respons memuat jumlah baru, diperbarui dan tetap. Konflik revisi, pratinjau, atau kunci mengembalikan 409. |
| `POST /api/attendance/export` | Mentor. Cakupan pada query string, bearer dan proof perangkat yang sama dengan API absensi. JSON `{format, expectedRevision}` menerima `students` atau `attendance`; gunakan revisi numerik batch. Batch yang belum ada atau revisi usang mengembalikan 409. |

Tipe MIME unggah `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. Gunakan worksheet pertama, maksimal 20 MB dan 5000 baris siswa. Header berurutan `ID siswa`, `Nama siswa`, `Kelas sekolah`, `Jenis kelamin`. ID wajib berupa teks dan unik. Pembuatan atau perubahan profil memerlukan kelas dan gender eksplisit. Profil lama dengan nilai kosong dapat diimpor ulang jika nilainya sama. Kolom privat dan perubahan status aktif tidak didukung. Snapshot Mentor memuat ID, nama dan kelas, dengan status serta konteks pelayanan untuk ekspor absensi.

## Kebutuhan saat merge

- Versi cache `sw.js` tidak perlu naik untuk API ini.
- Daftar modul statis di `server.mjs` tidak perlu berubah. Modul baru hanya untuk backend.
- Usulan indeks `PROJECT_STATUS.md` — 4 November 2026 · API XLSX pilot untuk ekspor roster/absensi dan impor siswa atomik dua tahap, lihat laporan tugas ini.

## Verifikasi aktual

- `npm.cmd ci --offline --no-audit --no-fund` selesai memasang dependensi yang sudah tercatat di lockfile.
- `node --test tests/msa-xlsx.test.mjs` lulus 3/3. Mencakup ID teks, formula, otorisasi cakupan, revisi, pratinjau, replay, audit, dan ekspor HTTP Mentor dengan adapter tes.
- `npm.cmd run check` lulus 243 berkas JS/MJS. `npm.cmd test` lulus 228/228.
- `git diff --check` bersih. Pemeriksaan perubahan API terhadap branch Codex dan Claude lain tidak menemukan path yang sama.

## Risiko dan batasan

- Impor memproses satu kelompok per workbook. Penambahan mengikuti batas absensi 300 siswa aktif per kelompok. Kapasitas transaksi Firestore pada 5000 baris belum diuji dengan emulator.
- Pratinjau yang belum dikonfirmasi kedaluwarsa saat proses API restart. Receipt konfirmasi yang sudah tersimpan tetap dapat menangani percobaan ulang dengan perintah dan otorisasi yang sama.
- Format API MSA mencakup field roster di atas. Workbook demo dengan kolom tambahan memerlukan pemetaan sebelum diunggah. UI, kompatibilitas aplikasi spreadsheet, dan integrasi Firebase/Chrome belum diverifikasi.

## Untuk peninjau

Periksa isolasi cakupan, parser input XLSX, integritas transaksi, serta replay impor. Perubahan masih di worktree `MSA-codex-xlsx`.

## Usulan commit

Summary: feat(msa): add scoped XLSX export and two-step student import

Description:
- Export revision-checked attendance and student workbooks with audit records.
- Validate student imports and commit changes atomically with idempotent receipts.
- Cover workbook safety, import conflicts, and scoped Mentor downloads.
