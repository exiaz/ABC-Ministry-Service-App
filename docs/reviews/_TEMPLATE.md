# Tinjauan <branch yang ditinjau>

Peninjau: Codex | Claude · Diff: `development...<branch>` @ <hash> · Tanggal: <YYYY-MM-DD>
Berkas status yang dibaca: `docs/status/<berkas>.md`

Salin menjadi `docs/reviews/<branch-dengan-garis-miring-jadi-strip>.md` dan simpan di workspace bersama tanpa berpindah branch; jangan menyunting implementasi yang ditinjau. Peninjau read-only: tidak mengubah kode branch yang ditinjau. Pisahkan temuan terkonfirmasi, risiko potensial, dan hipotesis yang belum diverifikasi. Sebutkan apa yang tidak dapat diverifikasi.

## Temuan

### R1. <judul>
- Severity: Critical | High | Medium | Low
- Category:
- Evidence: <berkas:fungsi/baris>
- Expected:
- Actual / potential failure:
- Reproduksi:
- Koreksi terkecil yang disarankan:
- Regression test yang disarankan:
- Confidence:

## Penutup
1. Confirmed defects
2. Suspected defects requiring verification
3. Missing test coverage
4. Pertanyaan tentang spesifikasi
5. Kesiapan merge: SIAP | SIAP DENGAN CATATAN | TIDAK SIAP

Penulis menjawab tiap temuan di bagian "Jawaban atas tinjauan" pada berkas statusnya.
