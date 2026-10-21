# ABC Goes to School — Prototipe lokal

Jalankan `npm start` atau `node server.mjs`, lalu buka **http://127.0.0.1:4173** pada komputer yang sama. Tidak perlu memasang dependensi. Jangan membuka `index.html` langsung melalui `file://` karena aplikasi memakai ES modules dan service worker.

Mentor: pilih sekolah → aktifkan perangkat demo → **kalender Jumat pelayanan** → kelompok → catat status → tinjau dan selesaikan. Admin: buka **Admin**, kode demo **ABC2026**. Menu **Jadwal Pelayanan** digunakan untuk memilih Jumat serta kelompok terkait. Direktori sekolah/kelompok/mentor mengikuti pemetaan pengguna; siswa, jadwal awal dan absensi tetap simulasi. Jumat tak terjadwal memerlukan konfirmasi menjadi pelayanan sementara; pengiriman tanggal mendatang baru tersedia pada tanggal pelayanan WIB. Gunakan **Tentang demo → Atur ulang demo** hanya bila ingin menghapus perubahan dan kembali ke contoh awal.

Penyimpanan hanya pada browser/origin yang sama. Tidak ada akun aman, sinkronisasi, atau backend produksi. XLSX adalah berkas yang bisa diunduh dengan isi simulasi berlabel data fiktif. Prototipe tidak dipublikasikan.

Mentor tetap dikelola melalui **Admin → Kelompok & mentor → Ubah penugasan**. Pilih **Pengganti sementara** untuk satu sesi atau **Penugasan tetap** dengan tanggal efektif. Tersedia 16 kelompok aktif dengan nama mentor sebagai subtitle; sesi lampau dan absensi siswa dipertahankan.

Lihat [MASTER_BRIEF.md](MASTER_BRIEF.md) untuk aturan dan batasan; [QA.md](QA.md) untuk hasil pengujian. Jalankan `node --test tests/*.test.mjs` (atau `npm test` bila npm tersedia) untuk seluruh pemeriksaan konfigurasi, pelestarian data, dan struktur ekspor.

Pemeriksaan kode: `npm run check` atau `node tests/check.mjs`. Aplikasi buildless JavaScript, tanpa compiler TypeScript. QA browser opsional: `node tests/browser.mjs`, memerlukan Playwright yang sudah tersedia serta Chrome (dapat diatur melalui CHROME_PATH). Skrip memakai profil browser terisolasi dan server sementara port 4174, tanpa mengubah data browser pengguna.

Jika port 4173 sedang dipakai server versi lama, mulai ulang server tersebut untuk menyajikan modul baru atau pilih port lain melalui variabel lingkungan PORT. Data localStorage berbeda antarport/origin, sehingga gunakan origin lama untuk melanjutkan data lama. Tidak perlu mengatur ulang demo untuk migrasi.
