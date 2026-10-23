# Aturan pengembangan ABC Attendance

Acuan aturan bisnis: [MASTER_BRIEF.md](MASTER_BRIEF.md). Baca revisi terbaru [PROJECT_STATUS.md](PROJECT_STATUS.md) untuk status implementasi dan batasan; bagian riwayat bukan status terkini.

- Pertahankan arsitektur JavaScript ES modules/Node.js yang ada kecuali perubahan disetujui pengguna.
- Gunakan bahasa Indonesia untuk seluruh teks yang tampil kepada pengguna.
- Pertahankan ID sekolah, kelompok, mentor, siswa, dan sesi, termasuk ID pelayanan dan batch absensi; reschedule tidak mengganti ID.
- Jangan pernah menghapus atau menimpa catatan absensi historis. Koreksi harus mempertahankan versi sebelumnya dan jejak perubahan.
- Pertahankan mentor tetap per kelompok, pengganti per sesi, dan perubahan tetap bertanggal efektif yang hanya dikelola admin; jaga snapshot riwayat.
- Mentor tidak memerlukan login pribadi, tetapi akses produksi wajib diotorisasi secara aman di server sesuai cakupan izin. Flag perangkat dan kode demo bukan keamanan produksi.
- Informasi privat siswa (tanggal lahir, wali, alamat) hanya boleh diakses admin berwenang, termasuk melalui API dan ekspor. Pemisahan tampilan/localStorage bukan kontrol akses produksi.
- Gunakan hanya data fiktif dalam tes; jangan pernah memakai data pribadi anak nyata.
- Utamakan perubahan kode minimal dan terarah; hindari refaktor di luar lingkup.
- Jalankan tes yang relevan setelah perubahan kode; gunakan `npm.cmd run check` dan `npm.cmd test` sesuai lingkup. Jika npm tidak tersedia, jalankan skrip Node ekuivalen dan laporkan batas verifikasi.
- Catat kemajuan implementasi signifikan, hasil validasi, dan batasan yang tersisa di `PROJECT_STATUS.md`.
- Jangan deploy, mengaktifkan billing, commit, atau push tanpa persetujuan pengguna.

## Penyuntingan teks dengan No AI Slop

- Gunakan [No AI Slop](.agents/skills/no-ai-slop/SKILL.md) saat menulis atau merevisi teks UI Indonesia, instruksi/pesan kesalahan launcher, panduan README, dokumentasi pengguna, ringkasan akhir implementasi, atau meninjau kejelasan dan ungkapan yang terasa tidak alami. Operasi coding saja, tes, dan inspeksi repositori tidak perlu memuat skill lengkap; gunakan hanya untuk bagian teks yang relevan.
- **Edit** (default): pertahankan makna dan suara penulis, ubah seperlunya, periksa hasil sendiri dengan [eval.md](.agents/skills/no-ai-slop/eval.md), lalu jelaskan yang diubah. **Detect**: tunjukkan masalah spesifik dengan kutipan dan usulan perbaikan; jangan otomatis menyunting atau menulis ulang, memberi skor, atau menebak penulisnya AI.
- Pembagian acuan tetap: `MASTER_BRIEF.md` untuk kebutuhan aplikasi/aturan domain; `PROJECT_STATUS.md` untuk status terverifikasi/bukti tes; `README.md` untuk petunjuk operasional pemula; `AGENTS.md` untuk alur kerja Codex; skill untuk mutu bahasa. Penyuntingan wajib menjaga akurasi teknis, sintaks, keamanan, privasi, integritas data dan hasil tes. Jangan menghilangkan istilah teknis/pesan kesalahan yang perlu persis atau mengarang capaian, jumlah tes, benchmark maupun detail implementasi.
- Laporan akhir implementasi memakai bahasa Indonesia yang alami dan ringkas: perubahan, tes lulus/gagal atau belum dijalankan, tindakan pengguna berikutnya, batas penting, serta usulan **Summary** dan **Description** siap salin untuk GitHub Desktop. Pertahankan detail teknis bila diperlukan untuk verifikasi. Usulan commit tidak memberi izin menjalankan commit, push atau deploy.
