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

- Aktifkan [No AI Slop](.agents/skills/no-ai-slop/SKILL.md) hanya jika pengguna meminta penyuntingan, pemolesan, atau audit konten tertulis, atau tugas utama berupa penulisan ulang substansial teks UI Indonesia atau petunjuk penggunaan nonteknis.
- Jangan aktifkan otomatis untuk coding/refaktor, backend/Firebase, autentikasi/keamanan, tes/debugging, pembaruan `PROJECT_STATUS.md`, ringkasan commit/laporan rutin, typo kecil, atau pembaruan dokumentasi teknis biasa.
- Pembagian acuan tetap: `MASTER_BRIEF.md` untuk kebutuhan aplikasi/aturan domain; `PROJECT_STATUS.md` untuk status terverifikasi/bukti tes; `README.md` untuk petunjuk operasional pemula; `AGENTS.md` untuk alur kerja Codex; skill untuk mutu bahasa. Penyuntingan wajib menjaga akurasi teknis, sintaks, keamanan, privasi, integritas data dan hasil tes. Jangan menghilangkan istilah teknis/pesan kesalahan yang perlu persis atau mengarang capaian, jumlah tes, benchmark maupun detail implementasi.

## Pelaporan pengembangan rutin

Laporkan secara ringkas dalam bahasa Indonesia: perubahan, tes yang benar-benar dijalankan beserta hasilnya (atau belum dijalankan), masalah penting yang tersisa, langkah berikutnya, serta usulan **Summary** dan **Description** siap salin untuk commit di GitHub Desktop. Laporan ini tidak otomatis mengaktifkan skill editorial; usulan commit tidak memberi izin commit, push, atau deploy.
