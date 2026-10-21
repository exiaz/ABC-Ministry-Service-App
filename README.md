# ABC Goes to School — Prototipe lokal

## M2A.2 — adapter Firestore Emulator lokal

Prasyarat: Node >=22, npm, JDK 21+ (`JAVA_HOME` atau PATH). Dependency dipatok pada `firebase-admin@14.5.0` dan devDependency `firebase-tools@15.34.0`; lockfile disertakan. Tidak ada SDK Firebase browser, login Google, key service account, atau project cloud.

- `npm.cmd run test:emulator`: CLI menjalankan **hanya Firestore**, project `demo-abc-attendance`, menjalankan tes kontrak/integrasi, kemudian mematikan emulator. Fixture fiktif memakai namespace `test-<UUID>` dan dibersihkan per tes; tidak membaca localStorage/file siswa pengguna.
- `npm.cmd run emulators:start`: menjalankan emulator lokal kosong. `firebase.json` mengikat service ke loopback, menonaktifkan UI, dan memakai Security Rules yang menolak semua akses client. SDK Admin tetap melewati rules; otorisasi API wajib. Emulator bukan batas keamanan terhadap proses lokal tepercaya yang dapat memakai akses owner emulator; jangan buka port ke LAN/internet.
- Pada PowerShell mesin ini, set `$env:JAVA_HOME='C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot'`. Jika npm belum di PATH, gunakan `& 'C:\Program Files\nodejs\npm.cmd' run test:emulator`.
- Khusus sandbox Windows yang mengalami `Unable to establish loopback connection` pada Java, set `$env:ABC_JAVA_TCP_FALLBACK='1'` sebelum perintah emulator. Runner memakai opsi JVM `jdk.net.unixdomain.tmpdir` menuju direktori tidak tersedia agar pipe internal JDK beralih ke TCP. Opsi hanya berlaku pada subprocess emulator; tidak mengubah OS, instalasi Java, atau PATH sistem.

Aktivasi API (terminal terpisah setelah emulator berjalan):

```powershell
$env:ABC_ROSTER_ADAPTER='firestore-emulator'
$env:ABC_FIREBASE_PROJECT_ID='demo-abc-attendance'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
$env:ABC_FIRESTORE_NAMESPACE='development'
node backend/server.mjs
```

Tanpa `ABC_ROSTER_ADAPTER`, API tetap memakai adapter in-memory kosong. Mode emulator menolak host hilang/non-loopback, project lain, namespace tidak valid, kredensial cloud di environment, atau emulator tidak tersedia, tanpa fallback. Target gRPC dipatok ke host lokal; universe SDK diatur eksplisit untuk mencegah penemuan ADC/metadata otomatis. Tidak ada endpoint untuk menerbitkan token atau mengisi database.

Data berada di `emulatorNamespaces/{namespace}/...`: schools, groups, students, serviceSessions, sessions (snapshot roster), credentials (ID hash SHA-256, expiresAt, revokedAt, grant sekolah/kelompok/sesi). Fixture profil privat berada terpisah dan tidak dibaca oleh adapter roster. ID asli disimpan pada field dan document ID; membaca tidak menulis absensi. API menampilkan field minimum yang sama seperti Milestone 1.

Restart **API** mempertahankan kredensial, pencabutan dan roster selama emulator yang sama tetap berjalan. Restart **emulator** tanpa export/import mengosongkan data; durability/backup produksi belum tersedia. Frontend masih prototipe localStorage dan tidak dihubungkan ke adapter. Jangan gunakan data anak nyata.

Verifikasi tambahan: `npm.cmd run check`, `npm.cmd test`. Suite emulator dijalankan terpisah agar regresi biasa tetap bekerja tanpa Java/emulator. Audit runtime saat implementasi: 0 advisori; audit lengkap: 7 temuan pada rantai devDependency Firebase CLI (4 moderate, 3 high). Tidak menjalankan `audit fix` atau mengganti versi yang disetujui; perlu evaluasi versi CLI sebelum penggunaan produksi.

## M2A.1 — kontrak repository asinkron

Server roster kini memakai adapter in-memory berbasis Promise sebagai default. Kontrak JavaScript/JSDoc ada di `backend/repository-contracts.mjs`; factory dan boundary otorisasi ada di `backend/repositories.mjs`:

- `createInMemoryCredentialRepository()`: gunakan `await issue({grants, ttlMs})`, `await authenticate(authorization)`, dan `await revoke(token)`. Pemeriksaan kedaluwarsa/pencabutan tetap dilakukan server pada setiap autentikasi.
- `createInMemoryRosterRepository(source)`: `await read(scope)` adalah operasi data internal tanpa mutasi; bukan pengganti pemeriksaan izin.
- `createAuthorizedRosterRepository({credentials, repository})`: `await readAuthorized(authorization, scope)` memeriksa identitas dan grant sebelum membaca, memeriksa ulang izin setelah I/O, lalu mengembalikan hasil berjenis `ok`, `unauthenticated`, `invalid-scope`, atau `forbidden`. Field privat tidak diteruskan, sekalipun adapter mengembalikannya. Kegagalan penyimpanan menolak Promise dan dipetakan API menjadi error umum 500, tanpa fallback.

Adapter mendatang diinjeksikan ke `createRosterServer({credentials, repository})` melalui kontrak yang sama. Factory sinkron Milestone 1 tetap tersedia; endpoint, format/status HTTP, dan frontend tidak berubah. Tes kontrak: `node --test tests/repository-contracts.test.mjs`; tambahkan adapter mendatang ke daftar factory pada suite yang sama. Belum ada Firebase, emulator, dependensi baru, atau autentikasi produksi; gunakan data fiktif saja.

## Milestone 1 — fondasi otorisasi roster server (uji lokal)

**Seluruh proyek masih hanya untuk data fiktif.** Autentikasi produksi belum tersedia. Prototipe di port 4173 tetap memakai kode demo/localStorage dan tidak dihubungkan ke API ini.

- API terpisah: `node backend/server.mjs`, default `http://127.0.0.1:4175` (opsional `ABC_ROSTER_PORT`). Startup tidak memuat roster atau menerbitkan kredensial; semua permintaan roster ditolak tanpa kredensial sah.
- Satu endpoint: `GET /api/roster?schoolId=...&groupId=...&serviceSessionId=...`, dengan header `Authorization: Bearer <kredensial-uji>`. Parameter hanya memilih sumber daya, bukan bukti izin.
- Respons sukses hanya berisi tiga ID konteks dan `students: [{id, name, schoolClass}]`. Snapshot batch digunakan bila ada; membaca roster tidak membuat batch atau menulis absensi. Tidak ada DOB, wali, alamat, gender, status absensi, atau profil privat dalam respons mentor.
- `createTestCredentialStore()` hanya dapat dioperasikan dari kode server tepercaya. `issue({grants: [{schoolId, groupId, serviceSessionId}], ttlMs})` membuat token acak 256 bit; default berlaku 5 menit, maksimal 1 jam. Store menyimpan hash token, memeriksa kedaluwarsa setiap request, dan `revoke(token)` langsung mencabut akses. Restart menghapus seluruh kredensial. Token tidak ditulis ke berkas/log.
- Tidak ada endpoint login, penerbitan token, registrasi perangkat, perubahan data, atau akses profil privat. Tidak ada kode akses produksi, layanan cloud, billing, atau dependensi baru. Fixture hanya disuntikkan oleh tes melalui kode server; identitas admin/perangkat produksi belum diimplementasikan.
- API menolak secara default, memeriksa cakupan tepat sekolah/kelompok/pelayanan dan relasi datanya, tidak menerima flag admin/perangkat/kode demo/cookie/query token sebagai identitas, tidak mengaktifkan CORS, dan memberi `Cache-Control: no-store` pada semua respons.

**Batas akses legacy:** `/data.js` pada server prototipe tetap publik dan berisi seed roster fiktif; `/app.js` membuka mekanisme kode demo. Profil privat, ekspor/impor, backup, dan seluruh data yang dimasukkan lewat UI tetap dapat diakses dari runtime/localStorage browser (`abc-school-prototype-v1` dan backup-nya). Service worker menyimpan shell prototipe. Ini bukan perlindungan data anak, sekalipun API baru menolak akses tanpa izin.

Server API tidak menyajikan HTML, JS frontend, service worker, modul backend, atau fixture. Server prototipe memakai allowlist aset dan tidak menyajikan modul backend/fixture/API. Pertahankan origin/port terpisah; jangan gabungkan API dan prototipe lama pada origin yang sama atau memasukkan data nyata ke salah satunya. Izin uji adalah grant eksplisit dari proses tepercaya, belum otomatis disinkronkan dengan penugasan mentor/admin produksi.

Validasi: `node --test tests/access-control.test.mjs tests/roster-api.test.mjs`, lalu `node tests/check.mjs` dan `node --test tests/*.test.mjs`. Tes HTTP memerlukan izin koneksi localhost. Semua fixture fiktif berada di `tests/fixtures/roster.mjs`, terpisah dari data prototipe dan tidak dilayani lewat HTTP.

## Menjalankan prototipe yang sudah ada

Jalankan `npm start` atau `node server.mjs`, lalu buka **http://127.0.0.1:4173** pada komputer yang sama. Tidak perlu memasang dependensi. Jangan membuka `index.html` langsung melalui `file://` karena aplikasi memakai ES modules dan service worker.

Mentor: pilih sekolah → aktifkan perangkat demo → **kalender Jumat pelayanan** → kelompok → catat status → tinjau dan selesaikan. Admin: buka **Admin**, kode demo **ABC2026**. Menu **Jadwal Pelayanan** digunakan untuk memilih Jumat serta kelompok terkait. Direktori sekolah/kelompok/mentor mengikuti pemetaan pengguna; siswa, jadwal awal dan absensi tetap simulasi. Jumat tak terjadwal memerlukan konfirmasi menjadi pelayanan sementara; pengiriman tanggal mendatang baru tersedia pada tanggal pelayanan WIB. Gunakan **Tentang demo → Atur ulang demo** hanya bila ingin menghapus perubahan dan kembali ke contoh awal.

Penyimpanan hanya pada browser/origin yang sama. Tidak ada akun aman, sinkronisasi, atau backend produksi. XLSX adalah berkas yang bisa diunduh dengan isi simulasi berlabel data fiktif. Prototipe tidak dipublikasikan.

Mentor tetap dikelola melalui **Admin → Kelompok & mentor → Ubah penugasan**. Pilih **Pengganti sementara** untuk satu sesi atau **Penugasan tetap** dengan tanggal efektif. Tersedia 16 kelompok aktif dengan nama mentor sebagai subtitle; sesi lampau dan absensi siswa dipertahankan.

Lihat [MASTER_BRIEF.md](MASTER_BRIEF.md) untuk aturan dan batasan; [QA.md](QA.md) untuk hasil pengujian. Jalankan `node --test tests/*.test.mjs` (atau `npm test` bila npm tersedia) untuk seluruh pemeriksaan konfigurasi, pelestarian data, dan struktur ekspor.

Pemeriksaan kode: `npm run check` atau `node tests/check.mjs`. Aplikasi buildless JavaScript, tanpa compiler TypeScript. QA browser opsional: `node tests/browser.mjs`, memerlukan Playwright yang sudah tersedia serta Chrome (dapat diatur melalui CHROME_PATH). Skrip memakai profil browser terisolasi dan server sementara port 4174, tanpa mengubah data browser pengguna.

Jika port 4173 sedang dipakai server versi lama, mulai ulang server tersebut untuk menyajikan modul baru atau pilih port lain melalui variabel lingkungan PORT. Data localStorage berbeda antarport/origin, sehingga gunakan origin lama untuk melanjutkan data lama. Tidak perlu mengatur ulang demo untuk migrasi.
