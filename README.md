# ABC Goes to School — Prototipe lokal

## M2B.2 — API pairing perangkat mentor lokal

Fondasi M2B.1 dan adapter Firestore Emulator digunakan kembali; in-memory dan frontend lama tetap tersedia tanpa pairing. Seluruh API ini hanya untuk `demo-abc-attendance`, Auth/Firestore loopback, dan data fiktif. Jalankan emulator dan context autentikasi sebagaimana M2B.1 di bawah. `createConfiguredRepositories()` pada mode Firestore kini menyediakan `pairing`; `createRosterServer({...adapters, adminAuthentication})` mengaktifkan route berikut. Tanpa adapter Firestore, route pairing tidak tersedia (503), tanpa fallback penyimpanan.

Operator server tepercaya perlu memberi izin tambahan di `emulatorNamespaces/{namespace}/adminPairingPermissions/{uid}` dengan bentuk `{active:true, grants:[{schoolId,groupId,serviceSessionId}]}`. UID tetap harus allowlisted dan token admin tetap harus lolos M2B.1. **Tidak ada izin pairing bawaan**, wildcard, atau endpoint publik untuk menulis izin ini. Izin mencocokkan tepat sekolah/kelompok/pelayanan yang valid; mencakup seluruh grants yang diminta, bukan hanya salah satunya. Izin admin ini terpisah dari penugasan mentor tetap/pengganti; pairing tidak mengubah keduanya.

| Endpoint | Perilaku |
|---|---|
| `POST /api/admin/pairing-codes` | Admin terotorisasi mengirim `{grants,codeTtlMs?,grantTtlMs?}`; 201 mengembalikan `{pairingId,code,expiresAt}` satu kali. |
| `POST /api/admin/pairing-codes/{pairingId}/revoke` | Admin yang memiliki seluruh cakupan kode mengirim `{}`; mencabut kode pending. Bila penebusan sudah menang, state tetap `redeemed`; cabut perangkat secara terpisah. |
| `POST /api/pairing/redeem` | Tanpa akun mentor: kirim `{code,publicKey}` dengan bukti tanda tangan perangkat. 201 mengembalikan `{deviceId,credential,expiresAt}`. Tidak menerima grants/deviceId/peran dari klien. |
| `GET /api/device/status` | Kredensial serta bukti perangkat sah memberikan `{deviceId,state:"active",expiresAt,grants}`. Kredensial expired/revoked atau bukti tidak sah memberi 401. |
| `GET /api/admin/devices/{deviceId}` | Admin dengan seluruh cakupan perangkat dapat membaca ID, grants, expiry dan state `active`/`expired`/`revoked`. Hanya perangkat hasil pairing. |
| `POST /api/admin/devices/{deviceId}/revoke` | Admin terotorisasi mengirim `{}`; mencabut seluruh akses perangkat, idempoten. Tidak menghapus kredensial/riwayat. |

Kode memakai 128 bit acak (`randomBytes(16)`, 22 karakter base64url); default berlaku 5 menit, batas 1 detik–10 menit. Hanya hash SHA-256 yang disimpan sebagai ID/hash dokumen; tidak menyimpan atau mencatat kode mentah. Credential memakai mekanisme M2A.3 yang sama (256 bit acak, hash di database), bukan jenis token baru. Grant default 1 jam, batas 1 detik–1 jam **sejak penebusan**. Respons berisi rahasia hanya dikirim no-store, tanpa CORS; jangan mencatatnya atau memasukkannya ke URL/file. Body JSON maksimal 8192 byte, query/field tambahan/origin browser tidak diterima pada mutasi pairing.

Transaksi Firestore memeriksa ulang izin server/relasi, state/expiry kode, lalu sekaligus mengonsumsi kode, membuat ID perangkat UUID server, device/key binding, credential/grants, dan audit. Satu kode menghasilkan paling banyak satu perangkat/kredensial, termasuk saat request serentak. Kode revoked/expired/reused/unknown memberi pesan 400 yang sama. Jika respons sukses terputus setelah commit, kode tetap habis; admin perlu menerbitkan kode baru, bukan menebus ulang. Permission pairing yang dicabut atau issuer yang dihapus dari allowlist menolak penebusan kode pending. Otorisasi admin diperiksa ulang sesudah I/O sebelum transaksi tulis commit.

**Bukti perangkat:** perangkat membuat pasangan kunci ECDSA P-256; private key sebaiknya nonextractable dalam Web Crypto dan tidak dikirim ke server. `publicKey` adalah SPKI DER dalam base64url tanpa padding. Device dan credential hasil pairing memiliki penanda `binding:"p256-v1"`; penanda/kunci yang hilang atau rusak menolak akses, tidak menurunkannya menjadi bearer-only. Pada penebusan dan setiap request memakai credential pairing (roster maupun status), sertakan tepat satu header `X-Device-Timestamp` (epoch milidetik, 13 digit), `X-Device-Nonce` (16 byte acak, 22 karakter base64url), dan `X-Device-Signature` (ECDSA SHA-256, format IEEE-P1363 64 byte, base64url tanpa padding). Format signature diverifikasi dengan [API kriptografi Node](https://nodejs.org/docs/latest/api/crypto.html#cryptoverifyalgorithm-data-key-signature-callback). Pesan UTF-8 yang ditandatangani adalah tujuh baris berikut, tanpa newline penutup:

```text
ABC-DEVICE-V1
METHOD
/path?query-persis-request
sha256(token-atau-kode)-hex
sha256(body-UTF8-persis)-hex
timestamp
nonce
```

Untuk redeem, token pada pesan adalah kode pairing dan body berisi JSON persis yang dikirim. Untuk GET roster/status, token adalah credential dan body kosong. Toleransi waktu ±60 detik. Nonce per perangkat disimpan atomik di Firestore sampai jendela replay berlalu; replay ditolak termasuk setelah restart API. Penyimpanan dibatasi 120 nonce aktif per perangkat; budget habis memberi penolakan 401 sampai nonce kedaluwarsa. `device-proof.mjs` mendefinisikan format; tes memakai private key Web Crypto nonextractable. Token yang dicuri tanpa kunci tidak cukup. ID perangkat kiriman klien, localStorage atau fingerprint browser bukan bukti otorisasi.

Limiter persisten memakai transaksi dan jendela menit server: maksimal **10 percobaan redeem/menit per alamat socket** (termasuk request gagal), serta **20 operasi pairing admin/menit per UID**. Header proxy/ID klien diabaikan. Dalam mode loopback, perangkat uji berbagi budget alamat lokal. Limit menghasilkan 429 dan `Retry-After: 60`; restart context/API tidak mereset counter. Kode berentropi tinggi tetap menjadi perlindungan utama terhadap tebakan. State credential, device revocation, permissions, code consumption, audit, limiter dan nonce bertahan selama emulator yang sama/data snapshot yang sama dipakai. Admission token admin M2B.1 tetap harus dibuat ulang setelah restart API.

Verifikasi terarah: `npm.cmd run test:pairing`; regresi final: `npm.cmd run check`, `npm.cmd test`, `npm.cmd run test:emulator`. Identitas/penugasan/siswa tes seluruhnya fiktif. Tes juga memastikan roster, ID, absensi, profil privat dan penugasan mentor tidak diubah.

Batas: ini pengikatan ke kunci, bukan attestasi perangkat fisik. Proses lokal tepercaya, malware/XSS yang bisa memakai kunci, pembagian kode sebelum redeem, dan hilangnya penyimpanan kunci tetap menjadi batas web/platform. Belum ada UI pairing/login, pemulihan kunci/credential, sinkronisasi otomatis perubahan penugasan, TLS publik atau proteksi rollback eksternal. Pemilik emulator dapat mengubah data; restore snapshot lama dapat menghidupkan kembali kode/izin/counter sebelum konsumsi/pencabutan. Jangan buka emulator/API ke LAN/internet atau gunakan data anak nyata. Prototipe demo tetap tidak aman dan terpisah dari API. Siap menjadi fondasi M2B.3, belum produksi.

## M2B.1 — autentikasi admin khusus emulator lokal

`firebase.json` dan runner menjalankan **Auth (127.0.0.1:9099) serta Firestore (127.0.0.1:8080)** pada project `demo-abc-attendance`. Tidak ada project Firebase produksi, service account, signing key, login Google, SDK browser baru, atau login UI. Jalankan `npm.cmd run emulators:start` dengan prasyarat Java/TCP lokal yang dijelaskan di bawah. Snapshot baru dari runner dapat memuat kedua emulator; snapshot lama tetap tidak ditimpa. Bagian milestone sebelumnya di bawah merupakan riwayat.

Untuk mengaktifkan fondasi admin pada proses Node tepercaya, atur konfigurasi server berikut sebelum membuat context autentikasi:

```powershell
$env:ABC_ADMIN_AUTH_MODE='firebase-auth-emulator'
$env:ABC_FIREBASE_PROJECT_ID='demo-abc-attendance'
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
$env:ABC_ADMIN_UIDS='["fictional-admin-uid"]'
```

UID harus sudah merupakan identitas fiktif di Auth Emulator dan diotorisasi operator melalui allowlist server. `ABC_ADMIN_UIDS` wajib berupa array JSON dengan UID unik berkarakter huruf/angka/underscore/tanda minus (1–128 karakter); `[]` menolak semua admin. Tidak ada UID bawaan, promosi melalui email, endpoint pendaftaran/role, atau kepercayaan pada custom claim `admin`. Penghapusan/perubahan allowlist dilakukan operator server dan memerlukan restart context; perubahan environment saat context aktif langsung menutup akses.

`backend/admin-auth.mjs` menyediakan `createLocalAdminAuthentication()` dan `createConfiguredAdminAuthentication()`. Gunakan context yang sama sebagai `createRosterServer({...adapters, adminAuthentication})`. Dari **kode server/operator lokal tepercaya saja**, `await adminAuthentication.signIn({email, password})` melakukan login password ke Auth Emulator dan mengembalikan ID token untuk klien uji lokal. Akun tidak dibuat otomatis. Jangan menulis password/token ke kode, log, file, URL, shell history, atau snapshot; tes memakai nilai acak di memori. Helper ini tidak dipublikasikan melalui HTTP dan CLI API tidak melakukan login otomatis. Contoh penggunaan lengkap dengan identitas fiktif sementara ada di `tests/emulator/admin-auth.test.mjs`.

**Alasan admission token:** [Auth Emulator menerbitkan ID token tanpa tanda tangan](https://firebase.google.com/docs/emulator-suite/connect_auth). Verifikasi SDK emulator saja tidak dapat membuktikan bahwa token benar-benar diterbitkan emulator. Context karena itu menyimpan hanya hash SHA-256 token hasil login tepercaya. Pada setiap request, server memakai `verifyIdToken(token, true)` (project/issuer, expiry, account existence, disabled/revocation), memeriksa waktu secara ketat, allowlist UID, serta kecocokan hash token. Token dengan UID/klaim yang dipalsukan tetap ditolak. Token dari login langsung klien ke emulator belum diterima sampai login melalui context server tersebut; refresh juga harus melalui helper tepercaya. `revoke(token)` menghapus admission lokal. Restart context/API menghapus semua admission; token lama memerlukan login ulang. Tidak ada refresh token atau password yang disimpan oleh context.

- `GET /api/admin/session`, dengan tepat satu header `Authorization: Bearer <ID token>`, mengembalikan hanya `{uid, mode:"emulator-lokal"}` setelah seluruh pemeriksaan. Semua jalur `/api/admin/*` melewati guard yang sama. Belum ada operasi tulis admin/perangkat/absensi atau pembacaan profil privat.
- Konfigurasi admin tidak diaktifkan: jalur admin memberi 503. Token hilang/invalid/expired/forged/revoked/tidak di-admit memberi 401; identitas terautentikasi di luar allowlist memberi 403. Query/cookie/flag browser/localStorage/kode demo/peran klien tidak memberikan izin. Header ganda ditolak. Jalur/metode yang belum tersedia tetap 404/405 setelah otorisasi.
- Mode harus eksplisit, host wajib literal `127.0.0.1:port`, project hanya demo. Konfigurasi hilang/invalid/berubah, emulator tidak tersedia, project bertentangan, environment berkredensial cloud, atau `NODE_ENV=production` menutup akses; tidak ada fallback cloud. CLI tidak dimulai bila konfigurasi admin eksplisit invalid. Listener CLI dan akses admin dibatasi loopback.
- Respons tidak di-cache, tanpa izin CORS atau session cookie; tidak menambahkan alur cookie/CSRF. Otorisasi mentor tetap menggunakan kredensial/grant perangkat yang sudah ada. Token admin tidak menjadi kredensial roster mentor, dan sebaliknya.

Verifikasi: `npm.cmd run test:admin-auth` untuk Auth Emulator terarah; `npm.cmd run test:emulator` untuk seluruh kontrak/regresi emulator; `npm.cmd run check` dan `npm.cmd test` untuk regresi biasa. Seluruh identitas/siswa tes fiktif. Runner memakai project/port lokal tetap, tanpa login cloud/deployment/billing.

**Batas keamanan:** emulator dan pemilik proses/komputer lokal tetap tepercaya; emulator tanpa tanda tangan bukan sistem identitas produksi. Admission tambahan melindungi boundary API dari token buatan klien, tetapi tidak melindungi dari operator lokal yang mengubah kode, allowlist, atau akun emulator. Admission tidak persisten dan tidak ikut snapshot recovery. Belum ada login UI/endpoint, pairing UI, rate limiting produksi, audit admin terpusat, TLS publik, atau integrasi frontend. Prototipe port 4173 tetap memakai kode demo/localStorage dan **tidak menjadi aman** karena API ini tersedia. Tetap gunakan data fiktif dan origin terpisah. Siap untuk pekerjaan M2B.2 sesuai scope berikutnya, bukan penggunaan produksi.

## M2A.3 — otorisasi perangkat persisten dan recovery lokal

Bagian yang sudah tersedia pada M2A.2 (token acak 256 bit/hash SHA-256, grants, expiry, revocation, filter roster, guard demo/loopback) dipakai kembali. Adapter Firestore kini mengaitkan setiap kredensial ke dokumen `devices/{deviceId}`. Perangkat hilang, dicabut atau tidak valid membuat autentikasi ditolak; seluruh kredensial perangkat dicabut melalui satu perubahan state.

- Hanya dari **kode server/operator lokal tepercaya** pada context Firestore: `await adapters.deviceAuthorization.issue({deviceId, grants, ttlMs})`. Gunakan ID perangkat opaque seperti UUID, bukan nama/identitas anak. Setiap grant harus mengacu sekolah/kelompok/pelayanan yang benar-benar ada; helper menggunakan pembacaan roster yang sama, bukan resolver baru.
- `await adapters.credentials.revoke(token)` mencabut satu kredensial; `await adapters.deviceAuthorization.revoke(deviceId)` mencabut seluruh akses perangkat dan menolak penerbitan ulang ke ID perangkat itu. Tidak ada endpoint grant/admin/audit publik; kredensial tidak diberikan berdasarkan flag browser. Factory in-memory dan format respons API tetap.
- `authorizationEvents` hanya menyimpan `event`, `deviceId`, `credentialId` (hash), `at`, dan actor tetap `local-trusted-process`. Issuance/revocation dan audit ditulis atomik. Pembacaan dan penolakan autentikasi tidak menulis log per request. Tidak ada token mentah, nama siswa, alamat, DOB, atau isi roster pada audit. Log ini bukan audit tahan manipulasi terhadap pemilik SDK lokal.
- Kredensial lama yang tidak memiliki pengaitan perangkat ditolak tanpa dihapus/dimigrasikan. Terbitkan izin baru melalui helper tepercaya bila diperlukan. Tidak ada perubahan absensi atau profil lama.

Recovery: `npm.cmd run emulators:start` sekarang mengekspor ke snapshot baru di `.emulator-data/snapshot-*` saat shutdown normal; snapshot sebelumnya tidak ditimpa. Untuk memuat snapshot fiktif yang sudah ada, set `$env:ABC_EMULATOR_IMPORT_DIR='.emulator-data/snapshot-...'`, lalu jalankan perintah start yang sama. Import dibatasi ke snapshot di bawah `.emulator-data` dengan metadata export; akses API tetap hanya ke demo/loopback. Jangan menyimpan data nyata di folder ini atau memasukkannya ke Git. Force-kill tidak menjamin export selesai.

`npm.cmd run test:emulator:recovery` menguji dua masa hidup emulator terpisah: seed fiktif, export, shutdown, import, lalu verifikasi grant valid, pencabutan kredensial/perangkat, expiry, roster/ID, dan audit. Nilai bearer uji acak hanya berada di memori/environment anak proses; snapshot hanya memuat hash. Gunakan JAVA_HOME dan opsi TCP Windows yang sama seperti M2A.2.

**Batas recovery:** snapshot merefleksikan keadaan saat export. Restore snapshot sebelum suatu pencabutan dapat mengembalikan izin lama yang belum kedaluwarsa; cabut/terbitkan ulang izin setelah restore lama. Belum ada proteksi rollback dari sumber revocation eksternal. M2B masih perlu autentikasi admin, provisioning/pairing yang aman dan integrasi frontend; proyek ini tetap hanya untuk data fiktif.

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
