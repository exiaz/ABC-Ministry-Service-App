# Tinjauan <tugas yang ditinjau>

Peninjau: Codex | Claude · Baseline: <hash> · Diff: `git diff <baseline-commit> -- <path-tugas>` · Tanggal: <YYYY-MM-DD>
Berkas status yang dibaca: `docs/status/<berkas>.md`

Sampaikan temuan langsung selama penulis lain masih aktif. Setelah giliran tulis diserahkan, simpan sebagai `docs/reviews/<agen>-<tugas>.md` di workspace bersama tanpa berpindah branch; jangan menyunting implementasi yang ditinjau. Ikuti aturan satu penulis dan serah terima di `AGENTS.md`. Sertakan berkas untracked dalam lingkup tinjauan. Pisahkan temuan terkonfirmasi, risiko potensial, dan hipotesis yang belum diverifikasi; sebutkan apa yang tidak dapat diverifikasi.

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
5. Kesiapan integrasi: SIAP | SIAP DENGAN CATATAN | TIDAK SIAP

Penulis menjawab tiap temuan di bagian "Jawaban atas tinjauan" pada berkas statusnya.
