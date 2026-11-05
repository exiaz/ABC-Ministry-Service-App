---
name: msa-workflow
description: Menentukan alur kerja Claude + Codex untuk permintaan MSA (desain saja, implementasi kecil, perubahan substansial, atau perubahan sensitif auth/otorisasi/data). Gunakan di awal pekerjaan UI/UX atau pengembangan MSA yang menyentuh lebih dari satu berkas, atau saat pengguna menanyakan perlu tidaknya tinjauan Codex.
---

# Alur kerja MSA: Claude + Codex

Baca `AGENTS.md` di root workspace aktif sebagai satu-satunya acuan penugasan, kepemilikan, Git, sumber desain/cache dan serah terima. Jangan mengambil aturan dari worktree historis atau menyalin kebijakan sendiri ke `CLAUDE.md`. Untuk UI overhaul, baca juga `docs/ui-overhaul/BRIEF.md`.

Untuk lock otomatis, penolakan versi lama dan serah terima sesi, ikuti `.agents/skills/msa-coordination/SKILL.md` di workspace yang sama. Jangan menghapus lock atau menjalankan pemulihan operator sebagai agen.

## 1. Klasifikasi

1. **Desain saja**: eksplorasi, mockup, kritik, perbandingan opsi. Hasil berupa keluaran visual/usulan. Jangan ubah berkas aplikasi. Tanpa Codex.
2. **Implementasi kecil**: satu berkas/CSS/teks/bug sederhana tanpa efek perilaku. Kerjakan dan jalankan tes relevan. Tanpa Codex.
3. **Perubahan substansial**: banyak berkas, logika baru, atau perubahan perilaku. Implementasi, tes, lalu sarankan `/codex:review`.
4. **Sensitif**: arsitektur, autentikasi, sesi, otorisasi, `firestore.rules`, privasi siswa, absensi/riwayat. Ikuti penanggung jawab dan penugasan pengguna di `AGENTS.md`; kebutuhan di luar tugas diserahkan lewat pengguna. Bila perubahan sudah ada, rekomendasikan `/codex:adversarial-review`.
5. **Audit implementasi Codex**: baca baseline, diff dan laporan tugas di workspace bersama; jangan menyunting implementasi. Sampaikan temuan langsung selama penulis lain aktif; simpan laporan hanya setelah giliran tulis diserahkan.

Bila ragu antara dua kelas, pilih yang lebih ringan; tanya pengguna hanya jika risikonya tinggi.

## 2. Pelaksanaan

Nyatakan klasifikasi, lalu ikuti siklus tugas dan serah terima di `AGENTS.md`. Klasifikasi tidak memberi izin menulis saat agen lain masih aktif atau memperluas penugasan pengguna. Usulan arah desain baru memerlukan pilihan pengguna; perubahan yang sudah ditugaskan tidak perlu persetujuan ulang.

Untuk sumber desain dan hasil alat, gunakan tabel sumber desain serta aturan `.gitignore` di `AGENTS.md`; jangan menganggap seluruh `.taste/` atau `.impeccable/` sebagai cache.

## 3. Pemicu Codex

- **Otomatis:** tidak ada. Gerbang tinjauan saat berhenti nonaktif; jangan aktifkan tanpa diminta.
- **Perlu perintah eksplisit pengguna:** `/codex:review`, `/codex:adversarial-review [fokus]`, `/codex:rescue`, `/codex:status`, `/codex:result`, `/codex:cancel`.

## 4. Laporan

Gunakan `docs/status/_TEMPLATE.md` dan, untuk review, `docs/reviews/_TEMPLATE.md`. Ketentuan izin, pelaporan dan serah terima mengikuti `AGENTS.md`.
