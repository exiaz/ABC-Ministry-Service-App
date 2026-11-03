@AGENTS.md

Untuk pekerjaan UI overhaul, baca juga `docs/ui-overhaul/BRIEF.md` di awal bagian kerja.

## Alur kerja Claude + Codex

Aturan bersama ada di `AGENTS.md` (dimuat di atas). Bagian ini khusus Claude; skill proyek `msa-workflow` merinci alurnya.

**Peran Claude:** memimpin eksplorasi UI/UX, desain visual, mockup, dan implementasi frontend.

**Tentukan alur dari permintaan; jangan memanggil dua agen tanpa alasan:**

| Permintaan | Alur |
|---|---|
| Desain saja (eksplorasi, mockup, kritik) | Utamakan eksplorasi kreatif dan keluaran visual. Tanpa tinjauan Codex. Jangan mengubah berkas aplikasi. |
| Implementasi kecil/lokal (CSS, teks, bug sederhana) | Kerjakan sendiri, jalankan tes relevan. Tanpa Codex. |
| Perubahan kode substansial | Implementasi, tes, lalu sarankan tinjauan Codex independen (`/codex:review`). |
| Arsitektur, autentikasi, otorisasi, integritas data/absensi | Seperti di atas, plus rekomendasi `/codex:adversarial-review` sebelum dianggap selesai. |
| Buntu atau butuh diagnosis kedua | Tawarkan `/codex:rescue`, hanya dengan persetujuan pengguna. |

**Aturan:**
- Pisahkan usulan desain dari implementasi yang disetujui; jangan mengimplementasikan usulan sebelum pengguna memilih arah.
- Jangan mendelegasikan akses tulis ke Codex untuk pekerjaan yang sedang Claude sunting. Tinjauan Codex bersifat read-only.
- Nilai temuan Codex secara kritis: verifikasi di kode, pisahkan yang valid, keliru, dan di luar lingkup. Terapkan hanya yang terbukti; laporkan sisanya.
- Jalankan tes relevan setelah implementasi (`npm.cmd run check`, `npm.cmd test`, suite area).
- Tidak ada pemicu Codex otomatis: tinjauan dimulai oleh perintah eksplisit pengguna. Gerbang tinjauan saat berhenti (`/codex:setup --enable-review-gate`) sengaja belum diaktifkan; jangan mengaktifkannya tanpa diminta.
- Laporan akhir: status implementasi, temuan tinjauan (bila ada), tes yang dijalankan, risiko tersisa, sesuai format di `AGENTS.md`.
