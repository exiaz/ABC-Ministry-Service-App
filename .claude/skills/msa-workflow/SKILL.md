---
name: msa-workflow
description: Menentukan alur kerja Claude + Codex untuk permintaan MSA (desain saja, implementasi kecil, perubahan substansial, atau perubahan sensitif auth/otorisasi/data). Gunakan di awal pekerjaan UI/UX atau pengembangan MSA yang menyentuh lebih dari satu berkas, atau saat pengguna menanyakan perlu tidaknya tinjauan Codex.
---

# Alur kerja MSA: Claude + Codex

Baca `AGENTS.md` (aturan bersama) dan, untuk UI overhaul, `docs/ui-overhaul/BRIEF.md`. Jalankan penjaga awal sesi (folder `MSA-claude`, branch `claude/*`, bukan `development` atau `wip/*`) dan pemeriksaan tumpang tindih dari `AGENTS.md`. Klasifikasikan permintaan **sebelum** bertindak.

## 1. Klasifikasi

1. **Desain saja**: eksplorasi, mockup, kritik, perbandingan opsi. Hasil berupa keluaran visual/usulan. Jangan ubah berkas aplikasi. Tanpa Codex.
2. **Implementasi kecil**: satu berkas/CSS/teks/bug sederhana tanpa efek perilaku. Kerjakan dan jalankan tes relevan. Tanpa Codex.
3. **Perubahan substansial**: banyak berkas, logika baru, atau perubahan perilaku. Implementasi, tes, lalu sarankan `/codex:review`.
4. **Sensitif**: arsitektur, autentikasi, sesi, otorisasi, `firestore.rules`, privasi siswa, absensi/riwayat. Ini wilayah Codex: jangan diimplementasikan Claude. Catat di berkas status dan serahkan lewat pengguna; bila perubahan sudah ada, rekomendasikan `/codex:adversarial-review` (dan `/codex:review`).
5. **Audit branch Codex**: baca `git diff development...codex/<tugas>` dan berkas statusnya lewat `git show`, tulis `docs/reviews/` di branch sendiri. Read-only.

Bila ragu antara dua kelas, pilih yang lebih ringan; tanya pengguna hanya jika risikonya tinggi.

## 2. Langkah

1. Nyatakan klasifikasi dalam satu kalimat.
2. Pisahkan usulan desain dari implementasi: tunggu persetujuan arah sebelum menulis kode dari usulan.
3. Periksa `git status` agar perubahan yang belum di-commit tidak tertimpa, dan pastikan path yang akan disentuh tidak disentuh branch agen lain (pemeriksaan tumpang tindih).
4. Implementasikan minimal dan terarah; pertahankan hook (`id`, `data-*`, ARIA, rute hash).
5. Jalankan `npm.cmd run check`, `npm.cmd test`, dan suite area yang relevan.
6. Untuk kelas 3-4, usulkan perintah tinjauan. Tinjauan Codex read-only; jangan beri Codex akses tulis pada berkas yang sedang Claude sunting.
7. Saat temuan Codex datang: verifikasi tiap temuan di kode, terapkan hanya yang terbukti, laporkan yang ditolak beserta alasannya.

## 3. Pemicu Codex

- **Otomatis:** tidak ada. Gerbang tinjauan saat berhenti nonaktif; jangan aktifkan tanpa diminta.
- **Perlu perintah eksplisit pengguna:** `/codex:review`, `/codex:adversarial-review [fokus]`, `/codex:rescue`, `/codex:status`, `/codex:result`, `/codex:cancel`.

## 4. Laporan

Tulis `docs/status/<tanggal>-claude-<tugas>.md` dari template (termasuk "Kontrak yang berubah" dan "Kebutuhan saat merge"), lalu laporkan ringkas dalam bahasa Indonesia: perubahan, tes yang dijalankan beserta hasil, temuan tinjauan (diterima/ditolak), risiko tersisa, langkah berikutnya, dan usulan Summary/Description commit. Ikuti izin Git di `AGENTS.md` untuk fetch dari `origin`, commit di branch tugas `claude/*`, dan push biasa ke branch yang sama. Minta persetujuan eksplisit sebelum merge ke `development` atau deploy.
