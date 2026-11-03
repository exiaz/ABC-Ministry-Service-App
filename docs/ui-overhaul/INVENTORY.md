# UI Overhaul MSA — INVENTORY (U1)

Hasil baca-saja atas `ui/overhaul` @ f77858d. Tidak ada kode yang diubah. Acuan: `BRIEF.md`.
Catatan metode: peta hook bagian 2 dihasilkan dengan pencocokan teks (id/data-*/class di HTML+JS halaman vs. isi `tests/**/*.mjs`). Id generik (`x`, `group`, `refresh`, `reason`, `history`, `cancel`) bisa cocok palsu di halaman lain; verifikasi dengan grep sebelum memindahkan.

## 0. Temuan yang mengubah rencana (baca dulu)

1. **Worktree sesi ini awalnya di `main` lama (3 commit)**; saya `git reset --hard ui/overhaul` pada cabang kosong `claude/ui-overhaul-inventory-9d07d6` agar isi sama dengan `ui/overhaul`. Tidak ada commit hilang.
2. **`mentor-account.html` memuat `styles.css` (stylesheet legacy)** bersama `mentor-account.css`, `account-devices.css`, `msa-visual.css`. Class seperti `.btn`, `.panel`, `.school-card`, `.group-card`, `.student-row`, `.hero` dipakai bersama halaman legacy (`index.html`, `mentor.html`, `admin.html`) lewat `secure-mentor.js`, `service-ui.js`, `account-devices-ui.js`. Mengubah `styles.css` mengubah halaman legacy (di luar lingkup). CSS baru harus dicakup (`body.mentor-account`, `body[data-msa-portal]`) atau berkas baru.
3. **Server menyisipkan/mengganti markup lewat string** (bagian 6). Penggantian gagal diam-diam bila markup berubah.
4. **Font/ikon baru butuh tipe MIME**: `server.mjs` `types` tidak punya `.woff2`/`.ttf` (jadi `application/octet-stream`); `admin-server.mjs` memberi `image/svg+xml` untuk ekstensi tak dikenal (woff2 akan salah label). Perlu penambahan di kedua tempat (diizinkan BRIEF 2.4).
5. **Pemetaan tes di BRIEF perlu koreksi** (bagian 5).
6. Tes memaksa **tidak ada overflow horizontal di 360/390/768/1365**, `input:visible` font ≥16px, dan `button/a/summary:visible` tinggi ≥44px (`tests/msa-portal-browser.mjs:38`, juga bagi halaman login/daftar di `msa-portal-focus-browser.mjs:50`). Tautan teks inline juga terhitung.

## 1. Halaman HTML non-legacy

Legacy (di luar lingkup): `index.html`, `admin.html`, `mentor.html`, `a1.html` (`styles.css`). Halaman non-legacy:

| Halaman | Rute / hash | CSS dimuat | Modul JS (entry → impor penting) | Peran |
|---|---|---|---|---|
| `msa-portal.html` | `/` di origin Admin-portal; `#masuk` / `#portal-login` = login; tanpa hash = Selamat datang; setelah login = Beranda (`#modul` membuka menu) | `msa-intake.css`, `msa-shell.css`, `msa-visual.css` | `msa-portal.js` → `msa-brand.js`, `msa-session.js`, `msa-visual.js` | Publik (welcome/login); Beranda: Superadmin, Admin/PIC, volunteer tanpa modul |
| `register.html` | `/register.html` | `msa-intake.css`, `msa-visual.css` (+`msa-shell.css` disisipkan server bila portal) | `msa-registration-ui.js` → `msa-session.js`, `msa-brand.js`, `msa-visual.js`, `account-devices-ui.js` | Publik (daftar Volunteer). Bila sesi portal aktif, redirect ke `/` |
| `identity-review.html` | `/identity-review.html` | `msa-intake.css`, `account-devices.css` (+`msa-shell.css` server) | `msa-registration-ui.js` (cabang tanpa `#registration`) | Superadmin / peninjau yang ditugaskan; Admin tanpa antrean ditolak (redirect `/`) |
| `account-recovery.html` | `/account-recovery.html` (flag `ABC_MSA_A2_4B`; di origin Mentor juga + A2_4A) | `msa-intake.css` (+`msa-shell.css` server) | `account-recovery.js` → `msa-session.js`, `msa-brand.js` | Publik untuk ajukan; peninjau (Superadmin/delegasi) untuk antrean |
| `migration-readiness.html` | `/migration-readiness.html` (flag A1 migration) | `msa-intake.css` (+shell) | `migration-readiness.js` | Superadmin saja (baca-saja) |
| `msa-core.html` | `/msa-core.html` (flag core) | `msa-intake.css` (+shell) | `msa-core.js` | Superadmin, Admin dengan keanggotaan organisasi |
| `msa-events.html` | `/msa-events.html`; hash `#kalender`, `#baru`, `#organization=…&event=…` | `msa-intake.css` (+shell) | `msa-events.js` | Superadmin, Admin/PIC dengan izin pelayanan |
| `visual-studio.html` | `/visual-studio.html` (flag visual + portal) | `msa-intake.css`, `visual-studio.css` (+shell) | `visual-studio.js` → `visual-image-client.js`, `msa-brand.js` | Superadmin saja (PIC dapat 403) |
| `mentor-account.html` | `/mentor-account.html`; origin Mentor `/` dipetakan ke sini di pilot; hash `#account-profile`, `#account-device`, `#account-attendance` | **`styles.css`**, `mentor-account.css`, `account-devices.css`, `msa-visual.css` (+`msa-shell.css` bila portal) | `mentor-account.js` → `pairing-client.js`, `secure-mentor.js` (→ `data.js`, `service-ui.js`, `scheduling.js`, `dates.js`, `mentor-attendance.js`), `account-devices-ui.js`, `msa-visual.js`, `msa-brand.js`, `mentor-session-schedule.js` | Mentor/Volunteer (akun ditautkan, perangkat aktif untuk absensi) |
| `local-account-setup.html` | `/local-account-setup.html` | `msa-shell.css` | `local-account-setup.js` (script di `<head>`) | Operator pilot lokal (Superadmin/Admin fiktif) |
| `pilot.html` (dibuat server, bukan berkas) | `/pilot.html` | CSS inline (`local-auth-pilot-ui.mjs`) | – | Operator pilot |

Kelas body penting: `msa-portal`, `msa-registration`, `identity-review`, `account-recovery`, `msa-core`, `msa-events`, `mentor-account`; `data-msa-portal="true"` disisipkan server; `data-authScreen` (`login|welcome`) diset `msa-portal.js:12`; `data-visual-preset` oleh `msa-visual.js`; `account-signed-in`/`account-authorized` oleh `mentor-account.js`; `msa-shell-active` oleh `msa-session.js`.

Navigasi runtime (bukan di HTML): `msa-session.js` `mountMsaShell` membangun `aside#msa-navigation` (skip link `#msa-skip`, `.msa-nav-primary` 3 item, `details#modul` + `.msa-nav-group`) di halaman non-portal-utama dan Beranda. Mentor punya `nav#account-navigation` statis di `mentor-account.html` (3 tautan hash). Ikon nav sekarang karakter Unicode (`⌂ ▤ ▦ ◇ ♙ ✓ ↻ ≡ ▣`, `msa-session.js:66`; `⌂ ▣ ☷` di mentor-account.html).

## 2. Hook yang dibaca JS dan tes (per halaman)

Format: hook ← tes yang menyentuhnya. “JS” = dibaca/ditulis kode halaman. Singkatan: `pb`=tests/msa-portal-browser.mjs, `pf`=msa-portal-focus-browser.mjs, `pft`=msa-portal-focus.test.mjs, `apb`=auth-pilot-browser.mjs, `e/…`=tests/emulator/.

### 2.1 msa-portal.html
- id (JS semua): `portal-brand, portal-welcome, welcome-title, portal-heading, portal-back, portal-eyebrow, portal-title, portal-intro, portal-login, portal-username, portal-password, portal-show, portal-submit, portal-mentor-login, portal-feedback, portal-workspace, portal-account, portal-services, portal-services-title, portal-service-state, portal-schedule, portal-new, portal-personal, portal-refresh, portal-logout, portal-local, portal-mentor, portal-mentor-entry, msa-main`.
- Diuji: `portal-welcome, portal-mentor-entry, portal-eyebrow, portal-title (fokus, teks), portal-login, portal-username, portal-password, portal-show (aria-pressed, type), portal-submit, portal-feedback, portal-workspace, portal-new, portal-service-state, portal-schedule, portal-personal, portal-refresh, portal-logout` (pb, pf, pft; `portal-title` juga e/msa-visual.test).
- name: `username`, `password` (input). Atribut: `aria-pressed`, `aria-label`, `aria-busy` pada `#portal-login`/`#portal-workspace`, `aria-live`, `role=status`.
- Selector kelas/struktur dalam tes: `#portal-welcome .msa-visual img`, `#portal-welcome a[href="/register.html"]`, `#portal-welcome a[href="#masuk"]`, `#portal-login button[type=submit]`, `#portal-login input` (**tepat 2**, jadi tidak boleh menambah input/checkbox), `#portal-login button:visible` (semua ≥44), `.auth-switch a`, `#portal-schedule .msa-empty` (**tepat 3**), `#portal-schedule article` (0 saat error), `#portal-schedule a[href*="event="]`, `select` count 0 di halaman, `#msa-navigation .msa-nav-group a` (7 untuk Superadmin; 0 untuk modul kosong), `#msa-navigation .msa-nav-primary a:visible` (3 di 390px), `#modul summary` (terlihat & dapat diklik), `#msa-navigation a[href="…"]`, `transitionDuration==='0s'` pada tautan nav di reduced-motion.
- Class dipakai JS: `msa-empty, portal-event, portal-date, portal-event-content, msa-event-date, msa-visual`. Slot: `[data-visual-slot="welcome"]`, `data-visual-headline/description="welcome"` (diganti isi oleh `msa-visual.js`).
- Pemicu stub tes unit: `msa-portal-focus.test.mjs` menjalankan `msa-portal.js` di `vm` dengan `document` palsu (hanya `getElementById`, `querySelectorAll`→[], `createElement`, `body.dataset`). **Jangan menambah API DOM lain (querySelector, classList, dsb.) di `msa-portal.js`** tanpa memperbarui stub.

### 2.2 register.html
- id: `brand, feedback, registration, full-name, phone, phone-help, username, username-help, password, password-help`. name: `fullName, phone, username, password`. Kelas: `auth-nav, msa-registration, registration-intro, registration-pilot, auth-switch, msa-visual`. `[data-visual-slot="registration"]`.
- Diuji: semua id isian (apb, e/msa-a2-2-ui, pf); `#registration h1` (teks); **`#registration button` harus tepat satu** (`pf:55`); `getByRole('status')` dengan teks “Permintaan diterima” (`#feedback`); `.auth-nav a[href="/"]`; `.auth-switch a`; `#registration.checkValidity()` false saat kosong (atribut `required/minlength/pattern` harus dipertahankan).

### 2.3 identity-review.html (+ cabang non-registrasi di `msa-registration-ui.js`)
- id (JS): `brand, feedback, review-login, login-mode, login-name, login-password, review-workspace, refresh, logout, queue, detail, account-title, account-info, duplicate-warning, review-form, school, group, service, operation, delegate-option, mentor-field, mentor-id, reviewer-field, reviewer-id, evidence-fields, evidence-method, evidence-reference, evidence-confirmed, reason, review-devices, history, defaults, confirmation, confirmation-title, confirmation-copy, cancel, apply`.
- data: `data-account` (tombol “Tinjau akun” di `#queue`), `data-devices-open, data-device-revoke, data-device-cancel, data-device-result` (dari `account-devices-ui.js`).
- Kelas: `review-toolbar, review-history, review-state, check, grid, account-device-list, account-device-card, account-device-confirm, device-state, danger`.
- Diuji: hampir semua (apb, e/msa-a2-2-ui, e/msa-a2-4a-ui, pb: `#queue` childElementCount>0, `#review-workspace` tak hidden). `<dialog id="confirmation">` dengan `showModal()`/`close()`; `autofocus` pada `#cancel`.
- Catatan: `msa-registration-ui.js` menonaktifkan semua `button` selama `action()` (`querySelectorAll('button')`), jadi tombol baru ikut dimatikan.

### 2.4 account-recovery.html
- id (JS): `recovery-brand, feedback, request-screen, recovery-request, recovery-username, request-pending, recovery-back, reviewer-entry, recovery-login, review-username, review-password, review-workspace, recovery-refresh, recovery-logout, recovery-queue, recovery-review, review-title, review-state, recovery-decision, recovery-delegate, recovery-reason, recovery-evidence, recovery-method, recovery-reference, recovery-evidence-confirmed, recovery-delegate-field, recovery-reviewer, recovery-confirm, recovery-confirm-title, recovery-confirm-copy, recovery-cancel, recovery-apply`; `data-recovery-id`; meta `recovery-api`.
- Diuji: hampir semua yang di atas (apb, e/msa-a2-4b-ui, pb). `querySelector('h1')` dipakai JS (judul fokus). `<details id="reviewer-entry">`. Kelas `account-recovery, recovery-layout, review-toolbar, check, review-state`.

### 2.5 migration-readiness.html
- id: `migration-brand, feedback, migration-login, migration-username, migration-password, migration-report, migration-refresh, migration-logout, migration-verdict, migration-summary, migration-consistency, migration-blockers, migration-checklist, migration-records`. Kelas `grid`. Diuji: lihat daftar di `apb`, `e/msa-a2-4c-ui`, `pb` (`#migration-verdict` mulai “Cutover produksi:” dan memuat `NO-GO`).

### 2.6 msa-core.html
- id: `core-brand, core-login, core-username, core-password, core-workspace, core-refresh, core-logout, core-empty, core-organization, core-org, core-role, core-org-name, core-org-note, core-program-heading, core-program-access, core-program-list, core-program, core-program-info, core-members, core-members-heading, core-member-list, core-program-form, core-program-name, core-program-description, core-reason, core-platform, core-platform-list, core-confirm, core-confirm-title, core-confirm-copy, core-cancel, core-apply, feedback`.
- Atribut: `aria-busy` pada `#core-workspace`, `hidden` toggles, `data-state` pada `.core-status`. Selector tes: `#core-program-list li` (>0), `#core-program option`, `#core-program-form button`, `getByRole('dialog',{name:'Tambahkan program?'})` (nama dari `aria-labelledby`/`h2`), fokus pada `#core-cancel`.
- Kelas: `msa-core, core-intro, core-account-actions, secondary, core-context, core-context-help, core-sections, core-status, core-empty-state, core-member, grid`.

### 2.7 msa-events.html (hook terbanyak: 95 id)
- id (JS): seluruh daftar di HTML (lihat `msa-events.html`); yang diuji: `event-login/username/password/workspace/refresh/logout/empty/org/new/organization/filters/detail/form/form-title/list/save/cancel/reload/edit/conflict/calendar-open`, `dashboard-show/workspace/result/new/retry/content`, `calendar-show/draft-show/workspace/filter-details/filters/org/program/status/from/to/view/prev/today/next/range/result/detail/confirm-copy/reason/operation-feedback/dismiss/apply/publish/edit/cancel/back/export-form/export-duration/export-result`, `filter-program/from/to`, `draft-name/date/time/timezone/venue/pic/optional/program`, `recurrence-frequency/weekday/end/confirm/dates/feedback/back/apply`.
- data: `data-event`, `data-calendar-event`, `data-calendar-org`, `data-dashboard-event`, `data-dashboard-org`, `data-stale`, `data-status` (pada `.draft-badge`).
- Kelas: `calendar-card` (diuji), `calendar-day, calendar-date-nav, event-layout, event-inspector, event-account-actions, draft-badge, secondary, sr-only, grid, dashboard-active` (classList di JS).
- Selector struktur tes: `#dashboard-content>section` (**tepat 3**), `#calendar-detail h2`, `#calendar-export-form button[value=ics]`, `getByRole('button',{name:'Unduh .ics'})`, `{name:'Tambahkan ke Google Calendar'}`; `aria-pressed` pada `#calendar-show`/`#draft-show`; fokus ke `#calendar-detail` dan `#draft-name`; hash `#kalender`, `#baru`.

### 2.8 visual-studio.html
- id (JS/tes): `studio, slot, revision, reload, image-edit, image-thumb, image, headline, description, image-info, alt, mode, layout-preview, cancel, save, retry, image-editor, crop-stage, crop-image, x, y, zoom, zoom-value, position-reset, crop-apply, save-result, save-message, save-result-close, published-state, preview-state, save-state, compression-size, copy-settings, section-title, editor`. data: `data-slot` (tombol `.slot-navigation`). Kelas: `advanced, preview-wrap, quiet, sr-only`. Ikon `<symbol id="i-image|i-upload|i-refresh">` dirujuk `<use href>`.
- **Pratinjau**: `visual-studio.js:61-90` memuat HTML sumber halaman lain (`/visual-preview-source/<slot>` = `msa-portal.html`, `register.html`, `mentor-account.html`) lalu memanipulasi DOM-nya dengan selector: `#portal-brand,#account-brand,#brand`, `#portal-mentor-entry`, `#account-login`, `#account-profile`, `#account-navigation`, `#account-name`, `#account-dates`, `#account-groups`, `[data-visual-slot="<slot>"]`, serta menambahkan `link /msa-shell.css`. Merombak ketiga halaman itu **harus mempertahankan selector tersebut** atau memperbarui `visual-studio.js` (di lingkup tampilan).
- Teks diuji (e/msa-visual.test): “Revisi slot: N”, dialog “Berhasil disimpan”, “Perubahan tersimpan.”, “Sesi berakhir. Masuk kembali.”, “Pratinjau draf privat; belum diterbitkan.”, “Tidak ada draf; menampilkan publikasi saat ini.”, `getByRole('heading',{name:'Akun Mentor / Volunteer'})`.

### 2.9 mentor-account.html (+ UI yang dirender JS)
- id HTML/JS: `account-brand, account-feedback, account-session-check, account-session-message, account-session-retry, account-login, account-login-form, account-username, account-password, account-show-password, account-remember-option/-remember/-remember-help (disisipkan server), account-profile, account-name, account-logout, account-dates, account-groups, account-device, account-manage-devices, account-device-management, account-attendance, account-modal(-title/-form), account-navigation, account-nav-attendance, account-activation, account-code`.
- id dirender JS: `attendance-status, secure-mentor, secure-student-search, secure-roster-rows, service-date-trigger, service-date-label, service-calendar, calendar-month, calendar-year, correction-student, correction-status, correction-reason`.
- data: `data-account-action` (`associate|verify|remove`), `data-action` (≈20 nilai: `select-school, select-group, back-*, calendar-*, continue-date, secure-present, secure-review, secure-correct, secure-retry, secure-context-refresh, attendance-retry, attendance-reload, close-modal`), `data-id`, `data-visit`, `data-secure-status-id`, `data-state` (`#secure-mentor`, `#attendance-status`), `data-devices-open`, `data-device-revoke`, `data-device-cancel`, `data-device-result`, `data-visual-slot|headline|description="login|dashboard"`, `data-mentor-session`, `data-mentor-origin`, `data-admin-origin`.
- Kelas diuji: `.school-card, .group-card, .success-panel, .mentor-subtitle, .backup-groups, .account-group-choice(+[aria-current=true]), .account-nav-icon, .account-week-selected, .account-device-card, .account-device-list, .account-device-confirm, .eyebrow, .hero, .search, .bottom, .badge, .heading, .panel-head, .student-name, .btn, .primary`; selector gabungan `[data-action=select-group][data-id=g2]`, `#account-groups h2`, `#account-login h1` (teks), `#account-dates`.
- Kelas lain dipakai CSS/JS (tidak diuji): `account-group, account-heading, account-week, account-week-heading, account-activation-panel, account-verified, pairing-actions, info-box, panel, empty, small, excused, hero-copy, section-heading, count-label, school-grid, school-icon, school-meta, calendar-hint, back-btn, roster-layout, roster-toolbar, roster-label, roster-aside, summary-card, summary-stats, summary-stat, summary-note, date-picker-panel, calendar-anchor, date-field, calendar-popover, group-grid, group-top, student-row (is-<status>), avatar, status-actions, present-btn(selected), status-select, status-dot, modal-actions, confirmation-counts, form-row, success-mark, account-switcher, account-access-groups`.
- Atribut: `aria-current` (nav & grup), `aria-pressed` (`present-btn`, `account-show-password`), `aria-expanded`/`aria-controls` (`service-date-trigger`), `role=status|alert`.
- Tes juga memakai tombol “Hadir” per siswa lewat `data-action=secure-present`, `<select data-secure-status-id>`; **status dibedakan oleh teks + `.badge.<status>`**, bukan hanya warna.

### 2.10 local-account-setup.html
- id: `setup-form, setup-username, setup-status` (pb: tombol `#setup-form button`, teks status memuat “Kata sandi tersimpan”). `role=status`.

## 3. Teks UI yang dipakai assertion tes (berkas:baris)

**Teks Inggris yang harus diganti (BRIEF §3) dan tes yang mengikatnya:**

| Teks lama | Lokasi sumber | Tes yang mengikat | Teks baru (BRIEF) |
|---|---|---|---|
| `Welcome back` (`#portal-title`) | `msa-portal.html:6`, `msa-portal.js:20` | `tests/msa-portal-browser.mjs:98`, `tests/msa-portal-focus-browser.mjs:49` | Selamat datang kembali |
| `Enter your credentials to continue.` | `msa-portal.html:6`, `msa-portal.js:21` | tidak ada | Masuk untuk melihat jadwal dan ruang pelayanan Anda. |
| `Log in` (submit) | `msa-portal.html:7`, `msa-portal.js:67` (di-reset setelah “Memeriksa…”) | tidak ada | Masuk |
| `Sign up`, `Don't have an account?` | `msa-portal.html:7` | tidak ada (`.auth-switch a` dipakai) | Daftar; “Belum punya akun?” |
| `Show` / `Hide`, `aria-label` `Show password`/`Hide password` | `msa-portal.html:7`, `msa-portal.js:23,69` | tidak ada teksnya; `aria-pressed`/`type` diuji (pb:96, pf:51) | Tampilkan / Sembunyikan; aria-label “Tampilkan kata sandi” / “Sembunyikan kata sandi” (sama dengan halaman Mentor) |
| `Forgot password?` (`a.portal-recovery`) | `msa-portal.html:7` | tidak ada di portal; **tautan Mentor** “Lupa kata sandi?” diuji (`e/msa-a2-4b-ui.mjs:18`, `apb:68`) — beda halaman | Lupa kata sandi? |
| placeholder `Username` / `Password`, label `Password` | `msa-portal.html:7` | tidak ada | Username / Kata sandi |
| `Create an account` (`#registration h1`) | `register.html:4` | **`msa-portal-focus-browser.mjs:53`** | Buat Akun Volunteer (selaras dengan tautan “Buat Akun Mentor” di Selamat datang dan judul tab “Pendaftaran Volunteer”; istilah Volunteer dipertahankan) |
| `Password` (label), `Create account`, `Already have an account? Log in` | `register.html:8` | tidak ada | Kata sandi; Daftar (tombol tunggal, tetap satu `button`); “Sudah punya akun? Masuk” |
| `Headline`, `Mobile`, `Desktop`, `Pratinjau tata letak Opsi G` | `visual-studio.html:5` | tidak langsung (id tetap) | Judul utama; Ponsel; Komputer; Pratinjau tata letak halaman |

Padanan lain di halaman yang sama: placeholder `Username` tetap “Username”, placeholder/label `Password` menjadi “Kata sandi” (konsisten dengan halaman Mentor dan pemulihan). Nada: sapaan hangat dan ringkas ala “Selamat melayani”, tanpa istilah teknis.

Catatan: `msa-portal.js:67` menimpa teks submit lagi di `finally` — kedua tempat harus diubah bersama. `portal-title` `Welcome back` juga ditulis ulang `clear()` (`msa-portal.js:20`).

**Teks lain yang diuji (tetap, jangan diubah tanpa memperbarui tes; berkas:baris):**
- Portal/login: `Jadwal mendatang…` (`#portal-service-state` startsWith, pb:43,50,99,156), `Jadwal belum dapat dimuat` (pb:48) dan `Periksa ulang izin` (pb:49), `tidak valid` (pb:97, pesan server), `Memuat` (pb:160), label peran `#portal-eyebrow` = `Superadmin` / `Admin` (pb:100,157), tautan mentor = `f.options.mentorOrigin+'/'`.
- Pilot/umum: `#account-login h1` = `ABC Ministry Service App` (`apb:31`, `pb:184`), tautan `Panduan pilot`, `Daftar Volunteer`, `Lupa kata sandi?` (apb:32,33,68), `PILOT LOKAL` (`auth-pilot.test.mjs:79`), `Permintaan diterima`, `Disetujui`, `belum diizinkan`, `Penugasan tetap yang cocok: 1`, `NO-GO`, `tersimpan`, `terbit di kalender`, `Pelayanan dibatalkan`, `Kata sandi harus`, `<title>` memuat `ABC | Ministry Service App` (`msa-branding.test.mjs:12` hanya halaman legacy; `e/msa-a2-1-ui.mjs:21`), `.brand-copy` ≈ `MINISTRY…SERVICE APP`, `msaBrand()` harus memuat `assets/abc-movement-logo.png` dan `MINISTRY<br>SERVICE APP` (`msa-branding.test.mjs:11`).
- Mentor: `Tetap masuk di perangkat ini` (`msa-mentor-session.test.mjs:52`, juga di pratinjau Visual Studio), `Minggu penugasan pertama`, `Kelompok utama`, `Kelompok backup`, `Sedang dipilih`, `Mentor Fiktif`, `Anda sedang offline`, `Dicabut`, `Hasil belum dapat dipastikan`, `Hosea Fiktif`, `Tidak ada akun`.
- Core/Events: `Tambahkan program?` (nama dialog), `Belum ada program`, `baca saja`, `tidak memiliki izin`, `Program tersimpan`, `pelayanan sesuai izin`, `Belum ada…` (mulai kalender kosong), `belum dapat dimuat`, `Sunting pelayanan terbit`, `Dibatalkan`, `sudah berubah`, `belum dapat dipastikan`, `Draf Perlu Ditinjau` (**`e/msa-stage9b2-ui.mjs:17` memakai huruf kapital P/T, sedangkan sumber `msa-events.js:150` menulis “Draf perlu ditinjau”** — periksa apakah regex memakai flag `i` sebelum menyentuh), `4 draf pelayanan tersimpan`, `Pelayanan Mingguan`, `event MSA tidak diubah`, `Unduh .ics`, `Tambahkan ke Google Calendar`.
- Visual Studio: lihat §2.8.

## 4. File statis yang diizinkan server dan cache `sw.js`

Tiga server statis berbeda; BRIEF 2.4 hanya mengizinkan penambahan berkas CSS/font/ikon.

1. **`server.mjs`** (origin demo legacy dan origin Mentor): 
   - `types` (baris 10): `.html .js .css .svg .png .jpg .json .webmanifest .md` — **tanpa woff2/ttf/webp**.
   - `allowed` (baris 11–16): `index.html, app.js, data.js, student-data.js, birthdays.js, birthday-ui.js, xlsx-reader.js, student-import.js, dates.js, group-config.js, service-config.js, scheduling.js, service-ui.js, reports.js, mentor-config.js, assignments.js, assignment-ui.js, xlsx.js, styles.css, sw.js, icon.svg, manifest.webmanifest, assets/abc-movement-logo.png` + `msa-brand.js, msa-session.js` + `msa-visual.js, msa-visual.css, msa-visual.json, assets/msa-visual-{default,welcome,auth,dashboard,program,campaign}.jpg`.
   - `assets` (baris ±19): `allowed` + `pairing-client.js, pairing-ui.js, device-storage.js, secure-mentor.js, mentor-attendance.js`.
   - `personal` (halaman akun Mentor, hanya `mentorMode`, GET tanpa query): `mentor-account.html, mentor-account.js, mentor-session-schedule.js, mentor-account.css, account-devices-ui.js, account-devices.css`; ditambah `recovery` (`account-recovery.html/.js`, `msa-intake.css`) bila `ABC_MSA_A2_4B` & `A2_4A`.
   - Berkas baru (font, ikon sprite, CSS) harus ditambahkan ke `allowed`/`personal`, lalu ke `types`.
2. **`admin-server.mjs`** (origin portal/Admin): `assets` Map (baris 14–30): `/`→`admin.html` (portal: `msa-portal.html`), `admin-client.js, secure-admin.js, styles.css, assets/abc-movement-logo.png, icon.svg, admin-devices.js, admin-activation.js, admin-accounts.js, admin-calendar.js, admin-backup.js, a1.html, msa-users.js, msa-brand.js, msa-visual.{js,css,json}, assets/msa-visual-*.jpg, username-login.js, msa-session.js, msa-shell.css, register.html, identity-review.html, msa-registration-ui.js, msa-intake.css, account-devices-ui.js, account-devices.css, account-recovery.{html,js}, migration-readiness.{html,js}, msa-core.{html,js}, msa-events.{html,js}, visual-studio.{html,js,css}, visual-image-client.js`; `msa-portal.html/.js` lewat `portalAssets` (baris 83); `mentor-account.css` ditangani khusus (baris 67, 85). Tipe respons ditentukan baris 94 (`html js css png jpg json`, selain itu `image/svg+xml`). Gerbang flag per halaman di baris 64–76 (404 bila flag mati, GET/HEAD tanpa query saja).
   - **Catatan**: `mentor-account.html` tidak ada di `assets` admin; halaman itu dilayani origin Mentor (`server.mjs`), dan hanya dibaca sebagai sumber pratinjau lewat `/visual-preview-source/login|dashboard`.
3. **`local-auth-pilot-ui.mjs`** `wrapPilotServer`: `/pilot.html` dibuat dari string; membungkus semua respons HTML (lihat bagian 6).
4. CSP (admin & mentor): `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src …; object-src 'none'; …` ⇒ font self-host diizinkan (default-src), **gambar `data:` tidak** (kecuali `blob:` di `visual-studio.html`); ikon harus inline SVG atau berkas self. `font-src` tidak disebut ⇒ jatuh ke `default-src 'self'`.
5. **`sw.js`** (`CACHE='abc-school-v14'`) men-cache: `msa-brand.js, ./, index.html, styles.css, app.js, pairing-client.js, pairing-ui.js, device-storage.js, secure-mentor.js, mentor-attendance.js, data.js, student-data.js, birthdays.js, birthday-ui.js, xlsx-reader.js, student-import.js, dates.js, group-config.js, service-config.js, scheduling.js, service-ui.js, reports.js, mentor-config.js, assignments.js, assignment-ui.js, xlsx.js, icon.svg, manifest.webmanifest, assets/abc-movement-logo.png`. Hanya `app.js` (legacy) yang mendaftarkan service worker; **halaman non-legacy tidak ter-cache** dan tidak memakai `sw.js`. Berkas non-legacy (`msa-*.css`, `msa-visual.js`, font baru) tidak perlu ada di sw. Bila `msa-brand.js`/`secure-mentor.js`/`service-ui.js` (bersama dengan legacy) diubah, naikkan `CACHE` hanya jika halaman legacy terpengaruh; `msa-branding.test.mjs:14` mewajibkan `sw.js` memuat `msa-brand.js`.

## 5. Pemetaan halaman → komponen C10 → suite tes

Komponen C10 (dari `C10-preview.png` dan BRIEF §3): Bentuk/radius, Tipografi, Warna, Tombol (utama/sekunder/tersier/nonaktif/teks/FAB/ikon), Input (label di atas, kapsul, pencarian), Tab segmen + chip + status (ikon+teks+warna), Ubin statistik, Baris siswa (avatar+centang 48), Baris tautan, Kartu pelayanan boarding-pass, Navigasi bawah (Mentor/Admin) + sidebar desktop, Banner “Pilot lokal · data fiktif”, Grafik (hanya galeri U2).

| Halaman | Komponen C10 yang relevan | Suite tes (jalankan) |
|---|---|---|
| `msa-portal.html` Selamat datang | hero foto (radius-xl), tombol utama + sekunder, tipografi 56/36, banner pilot | `pf`, `pb`, `apb`, `--visual` (pratinjau) |
| `msa-portal.html` login | input kapsul + label di atas, tombol ikon (tampilkan/sembunyikan), tombol utama 56, teks tombol | `pf` (+`pft` unit), `pb`, `apb` |
| `msa-portal.html` Beranda (workspace) | ubin statistik (tidak ada data agregat ⇒ jangan dibuat), **kartu pelayanan** (`.portal-event`), baris tautan, nav (aside `#msa-navigation`) | `pb`, `--stage9b2` (dashboard) |
| Nav `msa-session.js` (semua halaman portal) | navigasi bawah (mobile) / sidebar desktop terang, `active="none"` | `pb` (`#msa-navigation`, `#modul`), tiap `*-ui` yang `waitForSelector('#msa-navigation')` |
| `register.html` | input, tombol utama, hero kecil, tautan teks | `pf`, `pb`, `apb`, `--a2-2` |
| `identity-review.html` | input/select kapsul, tombol sekunder/tersier, baris tautan (antrean), status (Menunggu/Disetujui…), dialog sheet | `--a2-2`, `--a2-4a`, `apb`, `pb` |
| `account-recovery.html` | idem + status | `--a2-4b`, `apb`, `pb` |
| `migration-readiness.html` | kartu, status ikon+teks (GO/NO-GO) | `--a2-4c`, `apb`, `pb` |
| `msa-core.html` | input, chip status Aktif/Nonaktif, baris tautan/anggota, dialog | `--stage8`, `pb` |
| `msa-events.html` | tab segmen (`#calendar-nav`), **kartu pelayanan** (`.calendar-card`, `.draft-badge`), chip status Draf/Terbit/Dibatalkan, input, FAB “Buat”, dialog | `--stage9a`, `--stage9b1`, `--stage9b2`, `pb`, `apb` |
| `visual-studio.html` | input, tombol, panel (radius-xl), dialog editor | `--visual`, `node --test tests/visual-image-client-browser.mjs`, `pb` |
| `mentor-account.html` login | input, tombol, hero | `--a2-3`, `--a2-4a`, `session1a` (dalam `--a2-3`), `apb`, `pb` (mentor-login) |
| `mentor-account.html` profil & penugasan | kartu kelompok, penanda pekan (lingkaran), nav bawah Mentor | `--a2-3` (`msa-a2-3-ui`, `msa-session1a-ui`) |
| `mentor-account.html` absensi (`secure-mentor.js`) | **baris siswa** + centang, tab segmen status, ubin ringkasan, kartu sekolah/kelompok, kalender popover | `--a2-3`, `--a2-4a`; **berbagi kode dengan legacy** ⇒ juga `mentor-attendance-ui`, `mentor-pairing-ui`, `device-management-ui`, `backup-ui`, `tests/browser.mjs` (jalur `test:stage6`) |
| `local-account-setup.html`, `pilot.html` | formulir sederhana, banner pilot | `pb` (setup), `auth-pilot.test.mjs`, `apb` |

### Koreksi pemetaan tes di BRIEF §4

1. **`tests/msa-portal-focus-browser.mjs`, `msa-portal-browser.mjs`, `auth-pilot-browser.mjs` (dan `visual-image-client-browser.mjs`) tidak termasuk `npm test` maupun satu pun flag `stage3.mjs`.** `npm test` = `node --test tests/*.test.mjs` (hanya `msa-portal-focus.test.mjs`, versi unit). Berkas `*-browser.mjs` harus dijalankan eksplisit: `node --test tests/msa-portal-focus-browser.mjs`, `node --test tests/msa-portal-browser.mjs`, `node --test tests/auth-pilot-browser.mjs` (dalam PROJECT_STATUS memang dijalankan demikian). Tambahkan di BRIEF.
2. **`stage3.mjs --visual` hanya menjalankan `tests/emulator/msa-visual.test.mjs` (integrasi); langkah Chrome dilewati** (`if(!visualOnly)` pada langkah browser). Jadi `--visual` tidak menguji login/daftar dalam Chrome; ia menguji Visual Studio + pratinjau dan `#portal-title`/`#account-login` dari sisi markup.
3. **`--a1` menguji `a1.html` (halaman legacy)** lewat `msa-a1-ui.mjs`; bukan portal. Pindahkan ke “di luar lingkup / hanya regresi”. `--a2-1` (`msa-a1-ui` + `msa-a2-1-ui`) menguji login Admin legacy (`admin.html`, “Masuk dengan email”, `.hero .eyebrow`), juga bukan portal.
4. **Tambah `--stage9a`** untuk `msa-events.html` (form draf) — tidak ada di daftar “portal” BRIEF. `--stage9b2` memang menjalankan 9b1 + 9b2 (integrasi dan Chrome), jadi `--stage9b1` tercakup.
5. `--a2-2` → `register.html` + `identity-review.html` (benar). `--a2-3` → `mentor-account.html` + `msa-session1a` (benar). `--a2-4a` → perangkat akun (identity-review + mentor) (benar, “Mentor”). `--a2-4b` → pemulihan (benar). `--a2-4c` → kesiapan migrasi (benar). `--stage8` → `msa-core.html` (benar).
6. **`npm.cmd run test:stage6` identik dengan `test:stage3/4/5` = `node tests/stage3.mjs` tanpa flag**: semua unit `*.test.mjs`, semua integrasi emulator, semua UI Chrome (`admin-accounts-ui … msa-stage9b2-ui`), `tests/browser.mjs` (kalender demo/offline legacy), dan recovery dingin. Menjalankannya pada akhir sudah benar, tetapi memerlukan emulator Firebase + Java + Chrome.
7. `tests/msa-portal-browser.mjs` menguji **seluruh** rute dan tangkapan 4 lebar (bukan hanya login): wajib lulus setelah U-bagian apa pun yang menyentuh nav, Beranda, events, core, a1, visual-studio.

## 6. Risiko: markup dibuat di JS atau disisipkan server (ikut berubah)

**A. Disisipkan/diganti server (string-match rapuh):**
- `server.mjs:27-30`: `replace('<body class="mentor-account">', …data-mentor-session="1">)`, `replace('id="account-login" class="panel"','… hidden')`, `replace('id="account-session-check" class="panel" hidden','id="account-session-check" class="panel"')`, `replace('<!--MENTOR_SESSION_OPTION-->', <label id="account-remember-option" …>)`, `replace('</form>', …<a class="btn" href="/account-recovery.html">Lupa kata sandi?</a>)` (mengganti **`</form>` pertama** di `mentor-account.html`), `__API_ORIGIN__`, `content="__RECOVERY_API__"`. Dua salinan: `admin-server.mjs:50-52` (pratinjau login). Mengubah urutan atribut, kelas `panel`, penghapusan komentar, atau menambah `<form>` sebelum `#account-login-form` merusak mode sesi 30 menit dan tautan pemulihan secara diam-diam.
- `admin-server.mjs:86-91`: `replace(/<body\b/, '<body data-msa-portal="true"')`, `replace('</head>', '<link …msa-shell.css></head>')`, `replace('</head>','<style>body[data-msa-portal] :is(#core-login,#event-login,#msa-login,#review-login,#migration-login,#recovery-login){display:none!important}</style></head>')` (menyembunyikan form login halaman manajemen; id itu tak boleh diganti), `replace('</main>','<p><a class="btn" href="/">Beranda MSA</a></p></main>')` (menambah tautan `.btn` di akhir `<main>` setiap halaman non-portal; **butuh `</main>` literal** dan menambah tautan yang kena aturan tinggi ≥44), `replace('</main>', …Lupa kata sandi? / Tinjau pemulihan…)` untuk `admin.html/identity-review.html/a1.html`.
- `local-auth-pilot-ui.mjs:23-40`: regex `/<body\b[^>]*>/i` → menambah atribut `data-admin-origin`/`data-mentor-origin` (mode unified; **dibaca `msa-portal.js:73`, `mentor-account.js:15`**) atau menyisipkan blok `.pilot-nav` (teks “PILOT LOKAL · DATA FIKTIF SEMENTARA”) tepat setelah `<body>` di halaman Mentor; CSS-nya inline. Tidak boleh ada dua `<body` sebelum body asli.
- Pilot guide `/pilot.html` berisi markup dan CSS sendiri (`local-auth-pilot-ui.mjs:4-14`; teks diuji `auth-pilot.test.mjs:81`).

**B. Dibuat di JS (akan berubah/mesti ikut dirombak, dan dibaca tes):**
- `msa-brand.js` (innerHTML string; dipakai 8 halaman + `msa-session.js`): `.brand.msa-brand > img.brand-logo + span.brand-copy`; tes memeriksa string, `.brand-copy`, `.msa-brand`.
- `msa-session.js:56-82` `mountMsaShell`: seluruh `aside#msa-navigation` dengan `createElement` (`msa-shell-brand/-name/-account/-local`, `msa-nav-primary/-menu/-panel/-group/-icon`, `details#modul`, `#msa-skip`); ikon karakter Unicode; label nav (`Beranda`, `Pelayanan`, `Kalender`, `Modul`, `Ruang kerja`, `Pengelolaan`, `Langsung ke isi`). Diuji jumlah tautan (7, 3), `a[href]`, `#modul summary`, `aria-current`.
- `msa-portal.js:42-55`: kartu pelayanan Beranda (`article.portal-event > div.portal-date(strong,span) + div.portal-event-content(p.msa-event-date,h4,p,a)`), `section > h3 + p.msa-empty`; tautan mentor dikloning (`#portal-mentor`, `#portal-mentor-entry`, `#portal-mentor-login`, `#portal-personal`).
- `msa-visual.js:30-35`: `<img>` slot `[data-visual-slot]`; `visual-studio.js` memakai ulang (lihat §2.8).
- `mentor-account.js:15,101-109,102,109`: template string untuk `.account-group`, kartu aktivasi perangkat (`.account-activation-panel`, form `#account-activation`, `.pairing-actions`), panel offline, `info-box account-verified`; `showAssignmentWeek` (`ol.account-week`, `li.account-week-selected`); ikon SVG inline `icon()`.
- `secure-mentor.js:55-106`: seluruh UI absensi (pilih sekolah/tanggal/kelompok, baris siswa `.student-row.is-<status>` dengan `.avatar`, `.present-btn`, `<select data-secure-status-id>`, ringkasan, modal tinjau/koreksi, kalender via `calendarGrid` di `service-ui.js`). **Berbagi dengan legacy `index.html`/`mentor.html`** (kelas sama). Baris siswa C10 (≥64, centang 48) harus dicapai lewat CSS tercakup atau perubahan template yang tetap kompatibel dengan tes legacy (`mentor-attendance-ui`, `browser.mjs`, `student-forms-browser`).
- `account-devices-ui.js:8`: panel perangkat (`.account-device-list.panel`, `.account-device-card`, `<dialog>` konfirmasi, `data-device-*`), dipakai di `mentor-account.html` dan `identity-review.html` (juga `admin-devices.js`? tidak; `admin-devices.js` memakai UI legacy).
- `msa-registration-ui.js:31-41`: antrean (`#queue article > h3,p,button[data-account]`), riwayat.
- `account-recovery.js:13`, `migration-readiness.js:10-12`, `msa-core.js:14-25` (opsi `<select>`, `ul li span.core-status`, `article.core-member`, `data-state`), `msa-events.js` (≈15 innerHTML: daftar `article`, `p.draft-badge[data-status]`, detail `<dl>`, kartu kalender/dashboard, tombol `#event-edit`, `#calendar-publish/-edit/-cancel/-back`, form ekspor `#calendar-export-form`, `<details>`, `#recurrence-dates li`): sebagian besar id tombol **dibuat di JS** dan diuji.
- `visual-studio.js:81-82`: data pratinjau Mentor palsu (`.account-week-heading`, `.account-week`, `.account-group`) harus konsisten dengan markup `mentor-account.js`.
- Teks di JS (bukan HTML) yang ikut diganti saat terjemah: lihat §3.

**C. Risiko lintas-lapis:**
- `msa-shell.css` memakai selector `body[data-msa-portal], body.mentor-account` (token `--msa-*`) — pendefinisian token C10 di sini berlaku portal+Mentor; `msa-intake.css` mengatur reset `*{box-sizing}` dan `body` untuk semua halaman manajemen; jangan menghapus tanpa mengecek `visual-studio.css`.
- Warna lama hardcoded: `<meta name="theme-color">` `#20314d` (portal), `#1463e5` (mentor-account); `local-auth-pilot-ui.mjs` CSS `#fff5ce` / `#173252`.
- Navigasi gelap/ikon Unicode saat ini bertentangan dengan BRIEF (“tidak ada nav gelap”); `msa-shell.css` kemungkinan memuatnya (belum ditelaah rinci; tugas U-bagian nav).
- BRIEF 2.5 “menu Riwayat Mentor hanya bila rute ada”: `mentor-account.html` hanya punya tab Jadwal saya / Perangkat / Absensi; tidak ada rute riwayat ⇒ jangan tambah “Riwayat”.
- `data-authScreen` (`login|welcome`) diset oleh `route()` dan dapat dipakai CSS `msa-shell.css`; pertahankan.
