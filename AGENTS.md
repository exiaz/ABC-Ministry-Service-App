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
