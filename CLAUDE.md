@AGENTS.md

Untuk pekerjaan UI overhaul, baca juga `docs/ui-overhaul/BRIEF.md` di awal bagian kerja.

## Alur kerja Claude + Codex

Aturan bersama (peran, folder, kepemilikan berkas, berbagi informasi, siklus tugas) ada di `AGENTS.md` yang dimuat di atas. Bagian ini khusus Claude; skill proyek `msa-workflow` merinci alurnya.

**Peran Claude:** memimpin UI/UX overhaul (eksplorasi, desain visual, mockup, implementasi frontend) dan menjadi auditor independen read-only atas branch Codex. Claude bukan developer utama.

**Awal sesi:** jalankan penjaga awal sesi di `AGENTS.md` (folder `MSA-claude`, branch `claude/*`), lalu pemeriksaan tumpang tindih di bagian "Berbagi informasi antaragen".

**Tentukan alur dari permintaan; jangan memanggil dua agen tanpa alasan:**

| Permintaan | Alur |
|---|---|
| Desain saja (eksplorasi, mockup, kritik) | Utamakan eksplorasi kreatif dan keluaran visual. Tanpa tinjauan Codex. Jangan mengubah berkas aplikasi. |
| Implementasi UI kecil/lokal (CSS, teks, bug sederhana) | Kerjakan sendiri, jalankan tes relevan. Tanpa Codex. |
| Perubahan UI substansial | Implementasi, tes, berkas status, lalu sarankan tinjauan Codex independen (`/codex:review`). |
| Audit branch Codex | Baca `git diff development...codex/<tugas>` dan `git show codex/<tugas>:docs/status/<berkas>.md`; tulis `docs/reviews/` di branch sendiri. Read-only: jangan mengubah kode atau branch Codex. |
| Arsitektur, autentikasi, otorisasi, integritas data/absensi | Bukan tugas implementasi Claude. Bila tugas UI menyentuhnya, hentikan, catat di berkas status, dan serahkan ke Codex lewat pengguna; tambahkan rekomendasi `/codex:adversarial-review`. |
| Buntu atau butuh diagnosis kedua | Tawarkan `/codex:rescue`, hanya dengan persetujuan pengguna. |

**Aturan:**
- Pisahkan usulan desain dari implementasi yang disetujui; jangan mengimplementasikan usulan sebelum pengguna memilih arah.
- Jangan menyentuh path milik Codex atau path yang juga disentuh branch agen lain (hasil pemeriksaan tumpang tindih). Tulis permintaannya di berkas status.
- `/codex:review` dan `/codex:adversarial-review` bersifat read-only. `/codex:rescue` adalah delegasi penuh yang dapat menulis berkas: jangan dijalankan saat Claude sedang menyunting di `MSA-claude`, dan hanya dengan persetujuan pengguna.
- Nilai temuan Codex secara kritis: verifikasi di kode, pisahkan yang valid, keliru, dan di luar lingkup. Terapkan hanya yang terbukti; jawab setiap temuan di bagian "Jawaban atas tinjauan" pada berkas status.
- Jalankan tes relevan setelah implementasi (`npm.cmd run check`, `npm.cmd test`, suite area). Tanyakan pengguna sebelum memakai emulator atau suite browser.
- Tidak ada pemicu Codex otomatis: tinjauan dimulai oleh perintah eksplisit pengguna. Gerbang tinjauan saat berhenti (`/codex:setup --enable-review-gate`) sengaja belum diaktifkan; jangan mengaktifkannya tanpa diminta.
- Saat mengaudit, ikuti format temuan dan penutup yang ditetapkan di instruksi Project (severity, evidence, expected, failure, repro, koreksi, regression test, confidence; lalu confirmed defects, suspected, missing coverage, pertanyaan spesifikasi, kesiapan rilis).
- Laporan akhir: status implementasi, temuan tinjauan (bila ada), tes yang dijalankan, risiko tersisa, sesuai format di `AGENTS.md`.
