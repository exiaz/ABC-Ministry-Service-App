# Stabilisasi fixture tanggal dan clock tes rate limit

Agen: Codex · Branch: codex/regression-stabilization · Basis: development @ f9e6c3c · Tanggal: 2026-11-04
Status: PARTIAL · Produksi: NO-GO

## Ringkasan
Fixture Stage 9B.2 dan aktivasi perangkat memakai tanggal relatif. Tes rate limit memakai clock terkendali tanpa mengubah batas anggaran, assertion keamanan, timeout, atau aturan waktu aplikasi. Unit sudah lulus; penutupan regresi integrasi/browser belum terverifikasi karena pengguna menyatakan emulator masih dipakai Claude.

## Diagnosis dan perubahan
- `tests/fixtures/scheduling-dates.mjs` (baru), `tests/emulator/msa-stage9b2-fixture.mjs`: tanggal Selasa mendatang dihitung sekali per fixture, sedikitnya dua tanggal UTC setelah waktu acuan agar aman untuk WIB/WITA/WIT. Jadwal empat kejadian, draf beranda, dan rentang kalender memakai acuan yang sama. Sebelumnya tanggal awal tetap 2026-11-03 bertabrakan dengan penolakan `startAt <= now()` di `backend/msa-scheduling.mjs:39`. Beranda juga menyaring publikasi sebelum sekarang. Ini diagnosis sumber, bukan reproduksi ulang tujuh kegagalan emulator.
- `tests/emulator/msa-stage9b2.test.mjs`, `msa-stage9b2-ui.mjs`: tanggal akhir, batas 12/13 kejadian, rentang berlebih, reschedule, histori awal, dan isian browser mengikuti tanggal fixture. Kasus penolakan jadwal lampau tetap memakai 2020-01-07. Uji batas 90 hari tetap memakai pukul 18:00 UTC (03:00 WIT) pada tanggal relatif agar tujuan batas tanggal lokalnya dipertahankan.
- `tests/emulator/device-management-ui.mjs`: tanggal pelayanan pada kasus bulk aktivasi berubah dari 2026-10-30 menjadi dua hari setelah clock fixture; ID pelayanan tetap. `activationAccessEnd` memakai akhir tanggal pelayanan WIB sehingga fixture lama memproyeksikan `Pelayanan berakhir`, bukan `Belum dipakai`. Tes kalender historis yang menyimpan absensi tetap memakai tanggal historis.
- `backend/admin-auth.mjs`: factory meneruskan opsi `now` ke layanan MSA yang sudah mendukung injeksi clock. Bawaan tetap `Date.now`; verifikasi token provider dan limiter HTTP Admin tetap menggunakan waktu nyata. Tidak ada opsi clock dari HTTP, perubahan kuota, aturan kedaluwarsa, atau grant.
- `tests/emulator/admin-login-fixture.mjs`, `msa-a1-fixture.mjs`, `msa-a2-2-fixture.mjs`, `msa-a2-2.test.mjs`: clock diteruskan hanya ketika diminta. Kasus rate limit registrasi memakai satu clock pada backend awal, backend baru, dan dokumen anggaran review. Pemeriksaan 8 respons 202, respons berikutnya 429, persistensi 429 pada backend baru, Retry-After, Origin, body, namespace, dan gate tetap dipertahankan.
- `tests/msa-registration.test.mjs`: dua unit memakai layanan registrasi asli dengan penyimpanan counter sederhana dalam memori, memeriksa kuota username 8, kuota global 60, instansiasi ulang, dan reset menit 59999 → 60000. Tidak menguji konkurensi Firestore/provider.
- `tests/msa-scheduling.test.mjs`: unit tanggal relatif pada tujuh hari acuan di sekitar pergantian tahun dan tahun kabisat, masa mendatang WIT, empat kejadian, sekali, batas 12/13 kejadian, dan rentang 90 hari yang ditolak.
- `tests/admin-login.test.mjs`: tes anggaran login memakai clock tetap; unit tambahan memeriksa reset pada batas menit tanpa mengubah validasi input. Ini menutup asumsi bahwa seluruh permintaan selalu selesai dalam menit yang sama.

## Bukti dan ketidakpastian rate limit
Limiter registrasi menggunakan `Math.floor(now()/60000)`, dengan namespace unik per fixture. Skenario unit membuktikan bahwa reset saat menit berganti memang perilaku yang diharapkan. Tes sebelumnya tidak mengendalikan batas menit tersebut, termasuk saat mengisi counter review. Penyebab spesifik kegagalan A2.2 pada suite penuh belum direproduksi; tidak ada bukti bahwa state antar-tes bocor.

Run `npm.cmd test` pertama pada tugas ini: 227/228, gagal `tests/admin-login.test.mjs:28`, `400 !== 429`. Run terarah sebelum perbaikan: `node --test tests/admin-login.test.mjs` 3/3. Tidak ada rekaman timestamp tiap permintaan dari run gagal; penyebab historisnya tidak boleh diklaim pasti. Unit baru menunjukkan mekanisme pergantian menit secara deterministik, dan clock tes dipatok tanpa melemahkan assertion.

## Kontrak yang berubah (wajib, untuk agen lain)
Tidak ada perubahan id, name, data-*, ARIA, rute, endpoint, payload, atau teks UI/assertion. Tanggal fixture tetap → tanggal relatif dengan hubungan waktu dan jumlah kejadian yang sama. Opsi internal `createLocalAdminAuthentication({now})` bersifat opsional dan diteruskan ke factory MSA; bawaan waktu nyata dipertahankan. Helper fixture Stage 9B.2 menambah `date(offset)` serta menyesuaikan default `save` dan `agenda`.

## Kebutuhan saat merge (untuk integrator)
- Versi cache `sw.js`: tidak perlu naik (tidak ada perubahan aset aplikasi).
- Modul baru di `server.mjs`: tidak ada.
- Indeks `PROJECT_STATUS.md` yang disarankan: Stabilisasi regresi fixture Stage 9B.2/perangkat dan clock rate limit; unit 229/229, sintaks/import 241; integrasi/browser belum dijalankan, lihat laporan ini.

## Verifikasi aktual
- `node --test tests/msa-scheduling.test.mjs tests/msa-registration.test.mjs`: 8/8.
- `node --test tests/msa-scheduling.test.mjs tests/msa-registration.test.mjs tests/admin-auth.test.mjs`: 10/10.
- `npm.cmd test`: run awal 227/228; run final setelah perbaikan tes login Admin 229/229, 0 gagal/dilewati.
- `npm.cmd run check`: 241 berkas JS/MJS lulus sintaks dan import lokal. Setelah penyesuaian terakhir default agenda fixture, `node --check tests/emulator/msa-stage9b2-fixture.mjs` diperiksa terpisah.
- `git diff --check`: lulus; diff ditinjau untuk batas scope dan assertion.
- Emulator, suite browser, `test:stage9b2`, `test:msa-a2-2`, `test:admin-devices`, dan `test:stage6` tidak dijalankan atas arahan pengguna karena Claude masih memakai emulator. Tujuh kegagalan integrasi belum dinyatakan tertutup.

## Risiko dan pertanyaan terbuka
- Injeksi clock melalui factory autentikasi dan wiring fixture belum diuji dengan Auth/Firestore Emulator; unit tidak menggantikannya.
- Pada basis development ini, laporan Claude masih mencatat kegagalan layout kartu Stage 9B.2 di viewport ponsel. Perubahan U6a yang menangani layout belum masuk branch ini. Assertion tersebut dipertahankan; uji browser dapat tetap berhenti di layout sebelum mencapai alur recurrence/offline/pembaca/kosong.
- Tidak ada pengujian perangkat fisik, screen reader, atau browser lain. Tidak ada perubahan UI, commit, merge, push, deploy, atau penghapusan branch pada tugas ini.
- Setelah emulator bebas dan pengguna mengizinkan: jalankan suite terarah berurutan, lalu `npm.cmd run test:stage6`; bedakan kegagalan layout milik Claude dari fixture/backend dan jangan mengubah assertion untuk menghindarinya.

## Untuk peninjau
- Fokus: preservasi batas waktu/keamanan, persistensi limiter di backend baru, tanggal relatif dan rentang kalender yang tidak membuat assertion kosong secara kebetulan, serta isolasi perubahan dari U6a/U6b.
- Diff saat belum di-commit: `git diff` di worktree Codex. Setelah commit disetujui: `git diff development...codex/regression-stabilization`.

## Jawaban atas tinjauan
Belum ada tinjauan silang untuk perubahan ini.

## Usulan commit
Summary: test(msa): stabilize date fixtures and rate-limit clocks
Description:
- Derive Stage 9B.2 and bulk activation dates from fixture time.
- Pass the existing MSA clock through local authentication fixtures.
- Cover minute rollover and scheduling boundaries without relaxing checks.
