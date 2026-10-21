import {birthdayView} from './birthday-ui.js';
import {readWorkbook} from './xlsx-reader.js';
import {planStudentImport,commitStudentImport} from './student-import.js';
import {applyStudentSchema,studentGroups,initialStudentContext,attendanceStudentContext,addTemporaryStudent,saveRegisteredStudent,GENDERS} from './student-data.js';
import {jakartaToday,recentFriday,shiftMonth} from './dates.js';
import {activeGroups} from './group-config.js';
import {CURRENT,KEY,statuses,seed,getSession,count,dateLabel,escape as esc,applyGroupConfiguration,groupDisplayName,schoolDisplayName} from './data.js';
import {exportWorkbook} from './xlsx.js';
import {applyServiceConfiguration,saveService,longDate,isFriday,selectFridayService,canSubmitAttendance,submitAttendance,mentorGroups} from './scheduling.js';
import {dateSelectionView,attendanceReportView,scheduleAdminView,scheduleGroupFields} from './service-ui.js';
import {attendanceExportData,studentExportData} from './reports.js';
import {applyMentorConfiguration,defaultMentorAt,effectiveMentor,setTemporaryMentor,setPermanentMentor,addInitialDefault,selectableMentors} from './assignments.js';
import {groupsWithAssignmentsView,mentorSelectionLabel,mentorSelect,assignmentControls,assignmentHistory} from './assignment-ui.js';

const app=document.querySelector('#app'), modal=document.querySelector('#modal');
let db,storageOK=true,corrupt=false;
try {const raw=localStorage.getItem(KEY);db=raw?JSON.parse(raw):seed();if(db.version!==1||!Array.isArray(db.sessions)||!Array.isArray(db.groups)||!Array.isArray(db.students)||!Array.isArray(db.provisionals)||!Array.isArray(db.schools))throw Error('invalid');}
catch {db=seed();storageOK=false;corrupt=true;}
let configurationIssues=[];
if(!corrupt){
  const previous=JSON.stringify(db),migration=applyGroupConfiguration(db);
  configurationIssues=migration.issues;
  if(migration.changed){try{
    const backupKey=KEY+'-before-group-config-2';
    if(!localStorage.getItem(backupKey))localStorage.setItem(backupKey,previous);
    localStorage.setItem(KEY,JSON.stringify(db));
  }catch{storageOK=false;}}
}
if(!corrupt){
  const previous=JSON.stringify(db),migration=applyServiceConfiguration(db);
  configurationIssues.push(...migration.issues);
  db.serviceSessions ||= [];
  if(migration.changed){try{
    const backupKey=KEY+'-before-service-config-1';
    if(!localStorage.getItem(backupKey))localStorage.setItem(backupKey,previous);
    localStorage.setItem(KEY,JSON.stringify(db));
  }catch{storageOK=false;}}
}
if(!corrupt){
  const previous=JSON.stringify(db),migration=applyMentorConfiguration(db);
  configurationIssues.push(...migration.issues);
  if(migration.changed){try{
    const backupKey=KEY+'-before-mentor-config-3';
    if(!localStorage.getItem(backupKey))localStorage.setItem(backupKey,previous);
    localStorage.setItem(KEY,JSON.stringify(db));
  }catch{storageOK=false;}}
}
if(!corrupt){
  const previous=JSON.stringify(db),migration=applyStudentSchema(db);
  configurationIssues.push(...migration.issues);
  if(migration.changed){try{
    const backupKey=KEY+'-before-student-schema-2';
    if(!localStorage.getItem(backupKey))localStorage.setItem(backupKey,previous);
    localStorage.setItem(KEY,JSON.stringify(db));
  }catch{storageOK=false;}}
}
let groupFilters={schoolId:'',groupId:''},birthdayFilters={month:Number(jakartaToday().slice(5,7)),schoolId:'',groupId:''};
let pendingImport=null;
let assignmentGroupId='';
let selectedDate=recentFriday(),calendarMonth=selectedDate.slice(0,7),calendarOpen=false;
let serviceId='',dateSelectionOpen=false,adminMonth=CURRENT.slice(0,7);
let view='mentor',schoolId='',groupId='',adminTab='overview',adminUnlocked=false,adminDate='',adminSchool='',adminGroup='',query='',studentQuery='',toastTimer,installPrompt;
if(db.authorized&&db.mentorPreferences&&db.schools.some(s=>s.id===db.mentorPreferences.schoolId)){schoolId=db.mentorPreferences.schoolId;dateSelectionOpen=true;}
const uid=()=>globalThis.crypto?.randomUUID?.()||`id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const icon=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${({
 home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
 check:'<path d="m5 12 4 4L19 6"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-13 5h2m4 0h2"/>',
 school:'<path d="m2 10 10-7 10 7M4 9v12h16V9M9 21v-6h6v6M9 10h6M12 8v4"/>',
 users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',back:'<path d="M19 12H5m5 5-5-5 5-5"/>',chevron:'<path d="m9 5 7 7-7 7"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',plus:'<path d="M12 5v14M5 12h14"/>',more:'<circle cx="5" cy="12" r=".8"/><circle cx="12" cy="12" r=".8"/><circle cx="19" cy="12" r=".8"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',edit:'<path d="m16 3 5 5-12 12-6 1 1-6Zm-2 2 5 5"/>',heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',logout:'<path d="M9 21H3V3h6m6 5 4 4-4 4m-8-4h12"/>'
})[name]||''}</svg>`;
const brand=()=>`<div class="brand"><img class="brand-logo" src="./assets/abc-movement-logo.png" alt="ABC Movement" width="94" height="40"><span class="brand-copy">GOES TO<br>SCHOOL</span></div>`;
const initials=name=>esc(name.split(' ').slice(0,2).map(n=>n[0]).join(''));
const provisionalLabel=id=>({pending:'Siswa sementara · menunggu tinjauan',approved:'Siswa tambahan · disetujui admin',rejected:'Siswa sementara · tidak masuk daftar tetap'})[db.provisionals.find(p=>p.id===id)?.state]||'Siswa sementara';
const badge=(state,label)=>`<span class="badge ${state}">${label||({completed:'Selesai',draft:'Berlangsung',pending:'Belum dimulai'}[state])||statuses[state]}</span>`;
function save(){try{localStorage.setItem(KEY,JSON.stringify(db));storageOK=true;}catch{storageOK=false;toast('Penyimpanan tidak tersedia. Perubahan hanya bertahan selama halaman terbuka.');}}
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),4200);}
function openModal(title,body,actions='',onSubmit){modal.innerHTML=`<div class="modal-top"><h2 id="modal-title">${title}</h2><button class="close" data-action="close-modal" aria-label="Tutup dialog">×</button></div><form id="modal-form">${body}${actions?`<div class="modal-actions">${actions}</div>`:''}</form>`;modal.setAttribute('aria-labelledby','modal-title');if(!modal.open)modal.showModal();if(onSubmit)document.querySelector('#modal-form').onsubmit=e=>{e.preventDefault();onSubmit(new FormData(e.target));};else document.querySelector('#modal-form').onsubmit=e=>e.preventDefault();}
const cancel=()=>'<button class="btn" type="button" data-action="close-modal">Batal</button>';
const field=(label,name,value='',placeholder='',type='text')=>`<div class="form-row"><label for="field-${name}">${label}</label><input id="field-${name}" name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}" type="${type}" required maxlength="70" autocomplete="off"></div>`;
const art=()=>`<svg class="hero-art" viewBox="0 0 320 240" aria-hidden="true"><circle cx="198" cy="138" r="100" fill="#d4e6ff"/><circle cx="277" cy="44" r="14" fill="#f6cb55"/><path d="m73 51 5-12 5 12 13 5-13 5-5 12-5-12-13-5Z" fill="#7facf0"/><path d="m280 182 5-10 5 10 10 5-10 5-5 10-5-10-10-5Z" fill="#80adee"/><g transform="rotate(-10 165 130)"><rect x="100" y="44" width="121" height="163" rx="15" fill="#8db6f3"/><rect x="91" y="36" width="121" height="163" rx="13" fill="white"/><rect x="124" y="29" width="55" height="18" rx="6" fill="#337adf"/><rect x="108" y="65" width="68" height="7" rx="3" fill="#cee0f9"/><g fill="none" stroke="#72ae96" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m109 91 4 4 8-9m-12 30 4 4 8-9m-12 30 4 4 8-9"/></g><g fill="#e7edf6"><rect x="132" y="87" width="57" height="6" rx="3"/><rect x="132" y="112" width="45" height="6" rx="3"/><rect x="132" y="137" width="53" height="6" rx="3"/></g><rect x="109" y="163" width="78" height="17" rx="5" fill="#e8f2ff"/></g><circle cx="232" cy="152" r="32" fill="#f6c953"/><path d="m217 152 10 10 21-23" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/><g transform="rotate(22 80 180)"><rect x="66" y="139" width="17" height="68" rx="5" fill="#ed7770"/><path d="m66 201 9 20 8-20" fill="#eabf94"/><path d="m72 215 3 6 3-6" fill="#52637f"/><path d="M66 150h17" stroke="#ffd9d0" stroke-width="6"/></g></svg>`;

function render(){
  app.innerHTML=`<aside class="sidebar">${brand()}<p class="workspace-label">RUANG PELAYANAN</p><nav aria-label="Navigasi utama"><button class="nav-btn ${view==='mentor'?'active':''}" data-action="mentor">${icon('check')}Absensi mentor</button><button class="nav-btn ${view==='admin'?'active':''}" data-action="admin">${icon('grid')}Dasbor admin ${icon('lock')}</button></nav><div class="sidebar-bottom"><div class="sidebar-note"><strong>${icon('info')} Ruang coba, bebas eksplorasi</strong>Seluruh data siswa fiktif.<br>Tersimpan di browser ini saja.<button class="btn text small" data-action="about">Tentang prototipe ${icon('arrow')}</button></div><div class="profile"><span class="avatar">${view==='admin'?'AD':'M'}</span><div><strong>${view==='admin'?'Admin demo':'Halo, Kak Mentor!'}</strong><small>ABC Movement · Surabaya</small></div></div></div></aside><div class="shell"><header class="topbar"><div class="breadcrumb">ABC Movement <span>/</span><strong>${view==='mentor'?'Absensi mentor':'Dasbor admin'}</strong></div><div class="mobile-brand">${brand()}</div><div class="top-right"><span class="date-top">${dateLabel(CURRENT)}</span><small class="local-label muted"><i class="local-dot"></i>Lokal</small><span class="demo-tag">PROTOTIPE</span></div></header>${!storageOK?`<div class="storage-alert" role="alert">${corrupt?'Data lokal tidak dapat dibaca. Contoh data ditampilkan; gunakan Atur ulang di Tentang demo untuk memulihkan penyimpanan.':'Penyimpanan browser tidak tersedia. Perubahan akan hilang ketika halaman ditutup.'}</div>`:''}<main class="content">${configurationIssues.length?`<div class="storage-alert" role="alert">Pemetaan kelompok perlu ditinjau. Data lama tetap dipertahankan. ${configurationIssues.map(esc).join(' ')}</div>`:''}${view==='mentor'?mentorView():adminView()}<footer class="footer"><span>${icon('heart')} Setiap kehadiran berarti.</span><span>ABC Movement © 2026 · Data fiktif</span></footer></main></div><nav class="mobile-nav" aria-label="Navigasi seluler"><button class="${view==='mentor'?'active':''}" data-action="mentor">${icon('check')}Absensi</button><button class="${view==='admin'?'active':''}" data-action="admin">${icon('grid')}Admin</button><button data-action="about">${icon('info')}Tentang demo</button></nav>`;
}
function steps(n){return `<div class="steps" aria-label="Langkah ${n} dari 4">${['Sekolah','Tanggal','Kelompok','Absensi'].map((s,i)=>`${i?'<span class="step-line"></span>':''}<span class="step ${i+1===n?'active':i+1<n?'done':''}"><b>${i+1<n?'✓':i+1}</b>${s}</span>`).join('')}</div>`;}
function mentorView(){
  if(groupId)return rosterView();
  if(schoolId&&(!serviceId||dateSelectionOpen))return dateSelectionView(db,schoolId,selectedDate,icon,steps,{month:calendarMonth,open:calendarOpen});
  if(schoolId){const school=db.schools.find(s=>s.id===schoolId);return `<button class="back-btn" data-action="back-dates">${icon('back')} Pilih tanggal lain</button><div class="heading"><div><h1>Pilih kelompokmu</h1><p>${esc(school.name)} · ${longDate(db.serviceSessions.find(v=>v.id===serviceId).date)}</p></div></div>${steps(3)}${db.serviceSessions.find(v=>v.id===serviceId).provisional?'<div class="info-box warning-box">Menunggu Verifikasi Admin</div>':''}<div class="section-heading"><div><h2>Siap menemani adik-adik?</h2><p>Pilih kelompok sesuai penugasan mentor.</p></div></div><div class="group-grid">${mentorGroups(db,serviceId).map(g=>{const session=db.sessions.find(s=>s.groupId===g.id&&s.serviceSessionId===serviceId);return `<button class="group-card ${db.mentorPreferences?.groupId===g.id?'remembered':''}" data-action="select-group" data-id="${g.id}"><div class="group-top">${badge(session?.state||'pending')}</div><h3>${esc(g.name)}</h3><p class="mentor-subtitle">${mentorSelectionLabel(db,g.id,serviceId)}</p><div class="bottom"><span class="muted" style="font-size:11px">${icon('users')} ${db.students.filter(s=>s.groupId===g.id&&s.active).length} siswa terdaftar</span>${icon('arrow')}</div></button>`;}).join('')}</div><div class="help-strip"><p>Penugasan di prototipe ini masih simulasi. Semua kelompok dapat dipilih untuk mencoba alur.</p></div>`;}
  return `<div class="heading"><div><h1>Halo, Kak Mentor! <span style="font-size:25px">☀️</span></h1><p>Mari catat kehadiran, lalu hadir sepenuh hati.</p></div><span class="badge excused">${icon('calendar')} Jadwal fiktif</span></div><section class="hero"><div class="hero-copy"><div class="eyebrow">ABC MOVEMENT · GOES TO SCHOOL</div><h2>Langkah kecil.<br>Dampak yang berarti.</h2><p>Absensi lebih mudah, lebih banyak waktu<br>untuk bertumbuh bersama adik-adik.</p><span class="pill">${icon('check')} Satu ketuk untuk mencatat hadir</span></div>${art()}</section>${steps(1)}<section><div class="section-heading"><div><h2>Melayani di sekolah mana?</h2><p>Pilih sekolah, lalu Jumat pelayanan di kalender.</p></div><span class="count-label">3 sekolah</span></div><div class="school-grid">${db.schools.map(s=>`<button class="school-card ${s.color}" data-action="select-school" data-id="${s.id}"><div class="school-icon">${icon('school')}</div>${icon('arrow')}<h3>${esc(s.name)}</h3><p>${esc(s.area)}</p><div class="school-meta"><span>${activeGroups(db).filter(g=>g.schoolId===s.id).length} kelompok</span><span>·</span><span>${db.students.filter(st=>st.active&&db.groups.some(g=>g.id===st.groupId&&g.schoolId===s.id)).length} siswa</span></div></button>`).join('')}</div></section><div class="help-strip"><div class="help-left"><span class="help-icon">${icon('info')}</span><p><strong>Pertama kali menggunakan?</strong><br>Pilih sekolah, tanggal pelayanan, dan kelompok; lalu ketuk Hadir.</p></div><button class="btn text small" data-action="guide">Lihat panduan ${icon('arrow')}</button></div>`;
}
function rosterView(){
  const session=getSession(db,groupId,serviceId),g=db.groups.find(g=>g.id===groupId),c=count(session.records),done=session.state==='completed';
  const marked=session.records.length-c.unmarked,percent=session.records.length?Math.round(marked/session.records.length*100):0;
  return `<button class="back-btn" data-action="back-groups">${icon('back')} Pilih kelompok lain</button><div class="heading"><div><h1>Catat kehadiran</h1><p>${esc(schoolDisplayName(db,session))} · ${esc(groupDisplayName(db,session))}<br>${esc(effectiveMentor(db,session.groupId,session.serviceSessionId).name)} · ${longDate(session.date)}</p></div>${badge(session.state)}</div>${session.date>jakartaToday()?'<div class="info-box warning-box">Absensi dapat dikirim mulai tanggal pelayanan (WIB).</div>':''}${db.serviceSessions.find(v=>v.id===serviceId).provisional?'<div class="info-box warning-box">Menunggu Verifikasi Admin</div>':''}${done?`<div class="success-panel" role="status"><div class="success-mark">${icon('check')}</div><div><h2>Absensi selesai. Terima kasih, Kak!</h2><p>${session.records.length} siswa telah dicatat. Hasil tersedia di dasbor admin pada browser ini.</p></div><button class="btn small" data-action="correct">${icon('edit')} Koreksi absensi</button></div>`:''}<div class="roster-layout"><section class="panel"><div class="panel-head"><div><h2>Daftar siswa <span class="muted">· ${session.records.length}</span></h2><p>${done?'Hasil pertemuan hari ini':'Ketuk Hadir. Gunakan ⋯ untuk izin atau koreksi.'}</p></div>${icon('users')}</div><div class="roster-toolbar"><div class="search">${icon('search')}<input id="student-search" aria-label="Cari siswa" placeholder="Cari nama siswa…" value="${esc(query)}" autocomplete="off"></div>${!done?`<button class="btn small" data-action="add-provisional">${icon('plus')} Tambah siswa</button>`:''}</div><div class="roster-label"><span>NAMA SISWA</span><span>KEHADIRAN</span></div><div id="roster-rows">${rosterRows(session)}</div></section><aside class="roster-aside"><div class="panel summary-card"><h3>Ringkasan absensi</h3><div class="progress-label"><span>${marked} dari ${session.records.length} siswa dicatat</span><strong>${percent}%</strong></div><div class="progress" role="progressbar" aria-label="Kemajuan absensi" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><div style="width:${percent}%"></div></div><div class="summary-stats">${['present','excused',...(done?['absent']:['unmarked'])].map(s=>`<div class="summary-stat"><span><i class="status-dot ${s}"></i>${statuses[s]}</span><strong>${c[s]}</strong></div>`).join('')}${!done&&c.absent?`<div class="summary-stat"><span><i class="status-dot absent"></i>Tidak Hadir</span><strong>${c.absent}</strong></div>`:''}</div>${!done?`<button class="btn primary" data-action="finalize" ${session.records.length&&canSubmitAttendance(db,session)?'':'disabled'}>Selesaikan absensi ${icon('arrow')}</button><p class="summary-note">${storageOK?'Draf disimpan otomatis di browser ini.':'Draf hanya tersimpan selama halaman terbuka.'}</p>`:`<button class="btn soft" data-action="admin">Lihat di dasbor admin ${icon('arrow')}</button><p class="summary-note">Tersimpan lokal · belum tersinkron ke cloud</p>`}</div><div class="mentor-note"><strong>${icon('heart')} Hadir, menemani, bertumbuh.</strong>Siswa belum ada di daftar? Tambahkan sebagai siswa sementara untuk ditinjau admin.</div></aside></div>`;
}
function rosterRows(session){const filtered=session.records.filter(r=>r.name.toLocaleLowerCase('id').includes(query.toLocaleLowerCase('id')));return filtered.length?filtered.map(r=>`<div class="student-row is-${r.status}"><span class="avatar">${initials(r.name)}</span><div class="student-name"><strong>${esc(r.name)}</strong><small>${r.schoolClass?`Kelas ${esc(r.schoolClass)} · `:''}${r.provisional?provisionalLabel(r.studentId):statuses[r.status]}</small></div><div class="status-actions">${session.state==='completed'?badge(r.status):`<button class="present-btn ${r.status==='present'?'selected':''}" data-action="present" data-id="${r.studentId}" aria-label="Tandai ${esc(r.name)} hadir" aria-pressed="${r.status==='present'}">${icon('check')}${'Hadir'}</button><label class="status-select">${icon('more')}<span class="sr-only">Ubah status ${esc(r.name)}</span><select data-status-id="${r.studentId}" aria-label="Ubah status ${esc(r.name)}">${Object.entries(statuses).map(([key,label])=>`<option value="${key}" ${key===r.status?'selected':''}>${label}</option>`).join('')}</select></label>`}</div></div>`).join(''):`<div class="empty">${icon('search')}Nama tidak ditemukan.<br>Coba kata kunci lain${session.state!=='completed'?' atau tambahkan siswa sementara':''}.</div>`;}

function adminView(){return `<div class="heading admin-heading"><div><h1>${({overview:'Dasbor kehadiran',schedule:'Jadwal Pelayanan',history:'Riwayat absensi',students:'Data siswa',groups:'Kelompok & mentor',birthdays:'Ulang Tahun Siswa'})[adminTab]}</h1><p>${({overview:'Lihat kabar kehadiran dari setiap sekolah.',schedule:'Tentukan Jumat pelayanan untuk setiap sekolah.',history:'Catatan setiap pertemuan, tersimpan di satu tempat.',students:'Kelola daftar siswa dan tinjau siswa sementara.',groups:'Atur kelompok belajar dan penugasan mentor.',birthdays:'Ulang tahun dan kelengkapan tanggal lahir siswa aktif.'})[adminTab]}</p></div><div style="display:flex;gap:8px"><button class="btn" data-action="export">${icon('download')} Ekspor XLSX <span class="muted">(simulasi)</span></button><button class="btn" data-action="logout" aria-label="Keluar admin">${icon('logout')}</button></div></div><nav class="admin-tabs" aria-label="Bagian admin">${[['overview','Ringkasan'],['history','Riwayat absensi'],['schedule','Jadwal Pelayanan'],['students','Data siswa'],['groups','Kelompok & mentor'],['birthdays','Ulang Tahun Siswa']].map(([id,title])=>`<button class="${adminTab===id?'active':''}" data-action="admin-tab" data-id="${id}" ${adminTab===id?'aria-current="page"':''}>${title}</button>`).join('')}</nav>${adminTab==='overview'||adminTab==='history'?attendanceAdmin():adminTab==='schedule'?scheduleAdminView(db,adminMonth,adminSchool,icon):adminTab==='students'?studentsAdmin():adminTab==='birthdays'?birthdayView(db,birthdayFilters,icon):groupsAdmin()}`;}
function attendanceFilters(){return {schoolId:adminSchool,month:adminMonth,serviceSessionId:adminDate,groupId:adminGroup};}
function attendanceAdmin(){return attendanceReportView(db,attendanceFilters(),icon,adminTab==='overview');}
function scheduleForm(id){
  const visit=id?db.serviceSessions.find(v=>v.id===id):null;
  const sid=visit?.schoolId||adminSchool||db.schools[0].id;
  const groupIds=visit?.groupIds||activeGroups(db).filter(g=>g.schoolId===sid&&db.students.some(st=>st.active&&st.groupId===g.id)).map(g=>g.id);
  const started=visit&&db.sessions.some(s=>s.serviceSessionId===visit.id);
  openModal(visit?'Ubah jadwal pelayanan':'Tambah jadwal pelayanan',
    `<p class="modal-copy">Semua jadwal di prototipe ini fiktif. Pilih Jumat secara eksplisit; frekuensi bulanan tidak menentukan pekan tertentu.</p><div class="form-row"><label for="schedule-school">Sekolah</label><select id="schedule-school" name="schoolId" ${started?'disabled':''}>${db.schools.map(s=>`<option value="${s.id}" ${s.id===sid?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>${field('Tanggal pelayanan (Jumat)','date',visit?.date||'','','date')}<div id="schedule-group-options">${scheduleGroupFields(db,sid,groupIds)}</div><p class="form-error" id="schedule-error" role="alert"></p>${started?'<div class="info-box warning-box">Absensi sudah dimulai. Mengubah tanggal akan memindahkan label tanggal pada pelayanan yang sama; ID, siswa, dan status kehadiran tetap. Tanggal sebelumnya disimpan dalam riwayat perubahan lokal.</div>':''}`,
    `${cancel()}<button class="btn primary" type="submit">${visit?.provisional?'Verifikasi & simpan jadwal':'Simpan jadwal'}</button>`,form=>{
      try{
        const saved=saveService(db,{schoolId:started?sid:form.get('schoolId'),date:form.get('date'),groupIds:form.getAll('groupIds')},id);
        if(serviceId===saved.id&&schoolId!==saved.schoolId){schoolId='';serviceId='';groupId='';dateSelectionOpen=false;}
        if(visit?.provisional)saved.provisional=false;
        adminMonth=saved.date.slice(0,7);adminDate='';save();modal.close();render();toast('Jadwal fiktif disimpan. Absensi tetap terhubung ke ID pelayanan yang sama.');
      }catch(error){document.querySelector('#schedule-error').textContent=error.message;}
    });
}
function studentsAdmin(){const pending=db.provisionals.filter(p=>p.state==='pending'),students=db.students.filter(s=>s.active&&s.name.toLowerCase().includes(studentQuery.toLowerCase())&&(!adminSchool||db.groups.find(g=>g.id===s.groupId)?.schoolId===adminSchool));return `${pending.length?`<div class="provisional-callout"><span><strong>${pending.length} siswa sementara</strong> menunggu ditinjau sebelum masuk daftar tetap.</span><button class="btn small" data-action="review-provisionals">Tinjau siswa ${icon('arrow')}</button></div>`:''}<div class="filters"><div class="search">${icon('search')}<input id="admin-search" placeholder="Cari siswa…" aria-label="Cari data siswa" value="${esc(studentQuery)}"></div><select id="filter-school" aria-label="Filter sekolah"><option value="">Semua sekolah</option>${db.schools.map(s=>`<option value="${s.id}" ${s.id===adminSchool?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div><section class="panel"><div class="panel-head"><div><h2>Siswa terdaftar</h2><p>${students.length} siswa aktif · ${students.filter(s=>!GENDERS[s.gender]).length} perlu melengkapi jenis kelamin</p></div><div class="student-actions"><button class="btn small" data-action="import-students">${icon('plus')} Impor XLSX</button><button class="btn primary small" data-action="student-form" data-school="${esc(adminSchool)}" data-group="${esc(adminGroup)}">${icon('plus')} Tambah siswa</button></div></div><div class="table-scroll"><table><thead><tr><th>Nama siswa</th><th>Sekolah</th><th>Kelompok</th><th><span class="sr-only">Aksi</span></th></tr></thead><tbody>${studentTableRows(students)}</tbody></table></div><div class="panel-caption">Perubahan daftar berlaku untuk pertemuan baru. Catatan pertemuan yang sudah dibuat tetap dipertahankan.</div></section>`;}
function studentTableRows(students){return students.map(s=>{const g=db.groups.find(g=>g.id===s.groupId);return `<tr><td><strong>${esc(s.name)}</strong>${!GENDERS[s.gender]?'<small>Lengkapi jenis kelamin</small>':`<small>${GENDERS[s.gender]} · Kelas ${esc(s.schoolClass||'belum diisi')}</small>`}</td><td>${esc(db.schools.find(s=>s.id===g.schoolId).name)}</td><td>${esc(g.name)}</td><td><button class="btn text small" data-action="student-form" data-id="${s.id}">${icon('edit')} Ubah</button></td></tr>`;}).join('')||'<tr><td colspan="4" class="empty">Tidak ada siswa yang cocok.</td></tr>';}
function groupsAdmin(){return groupsWithAssignmentsView(db,icon,groupFilters);}
function assignmentForm(id,mode='permanent',selection={}){
  if(!adminUnlocked)return;
  assignmentGroupId=id;
  const group=db.groups.find(g=>g.id===id);
  openModal('Penugasan mentor · '+esc(group.name),
    `<p class="modal-copy">Mentor tetap saat ini: <strong>${esc(defaultMentorAt(db,id).name)}</strong>. Pilih jenis perubahan; absensi siswa tidak akan diubah.</p><fieldset class="assignment-modes"><legend>Jenis penugasan</legend><label><input id="assignment-type-temporary" type="radio" name="assignmentType" value="temporary" ${mode==='temporary'?'checked':''}><span>Pengganti sementara<small>Satu tanggal pelayanan saja</small></span></label><label><input id="assignment-type-permanent" type="radio" name="assignmentType" value="permanent" ${mode==='permanent'?'checked':''}><span>Penugasan tetap<small>Berlaku mulai tanggal tertentu</small></span></label></fieldset><div id="assignment-controls">${assignmentControls(db,id,mode,selection)}</div><p class="form-error" id="assignment-error" role="alert"></p>${assignmentHistory(db,id)}`,
    `${cancel()}<button id="save-assignment" class="btn primary" type="submit">Simpan penugasan</button>`,form=>{
      if(!adminUnlocked)return;
      try{
        const values={groupId:id,mentorId:form.get('mentorId')},existingId=form.get('existingAssignmentId')||null;
        if(form.get('assignmentType')==='temporary')setTemporaryMentor(db,{...values,serviceSessionId:form.get('serviceSessionId')},existingId);
        else setPermanentMentor(db,{...values,effectiveFrom:form.get('effectiveFrom')},existingId);
        save();modal.close();render();toast(form.get('assignmentType')==='temporary'?'Pengganti sesi disimpan. Mentor tetap tidak berubah.':'Penugasan tetap disimpan sesuai tanggal efektif. Riwayat dan absensi siswa dipertahankan.');
      }catch(error){document.querySelector('#assignment-error').textContent=error.message;}
    });
  document.querySelector('#save-assignment').disabled=mode==='temporary'&&!document.querySelector('#assignment-service');
}
function refreshAssignmentControls(target){
  if(!adminUnlocked)return;
  const mode=document.querySelector('[name="assignmentType"]:checked').value;
  const selection=target.id==='assignment-service'?{serviceSessionId:target.value}:target.id==='assignment-effective'?{effectiveFrom:target.value}:{};
  document.querySelector('#assignment-controls').innerHTML=assignmentControls(db,assignmentGroupId,mode,selection);
  document.querySelector('#assignment-error').textContent='';
  document.querySelector('#save-assignment').disabled=mode==='temporary'&&!document.querySelector('#assignment-service');
  if(target.id==='assignment-effective')document.querySelector('#assignment-effective').focus();
}


function rememberSelection(){if(db.authorized){db.mentorPreferences={schoolId,groupId:groupId||((db.mentorPreferences?.schoolId===schoolId&&db.mentorPreferences?.groupId)||'')};save();}}
function chooseSchool(school){schoolId=school;serviceId='';groupId='';selectedDate=recentFriday();calendarMonth=selectedDate.slice(0,7);calendarOpen=false;dateSelectionOpen=true;query='';rememberSelection();render();window.scrollTo(0,0);}
function continueDate(){
  const chosen=selectedDate,school=schoolId;
  if(!isFriday(chosen))return;
  const proceed=confirmed=>{
    const visit=selectFridayService(db,school,chosen,{confirmed});
    serviceId=visit.id;groupId='';dateSelectionOpen=false;calendarOpen=false;query='';save();render();window.scrollTo(0,0);
  };
  if(db.serviceSessions.some(v=>v.schoolId===school&&v.date===chosen)){proceed(false);return;}
  openModal('Buat pelayanan sementara?',`<p class="modal-copy">${esc(db.schools.find(s=>s.id===school).name)}<br>${longDate(chosen)} belum dijadwalkan admin.</p><div class="info-box warning-box">Pelayanan ini akan diberi label <strong>Menunggu Verifikasi Admin</strong>. Simulasi lokal; belum ada notifikasi atau sinkronisasi ke admin.</div>`,`${cancel()}<button class="btn primary" type="submit">Ya, buat pelayanan sementara</button>`,()=>{proceed(true);modal.close();});
}

function authorize(school){if(db.authorized){chooseSchool(school);return;}openModal('Selamat datang, Kak!',`<p class="modal-copy">Pada versi final, perangkat mentor perlu mendapat izin admin. Untuk mencoba prototipe, aktifkan perangkat demo ini.</p><div class="info-box">${icon('lock')} <strong>Simulasi otorisasi perangkat</strong><br>Tidak memverifikasi identitas dan tidak memberikan perlindungan akses. Tanpa email atau kata sandi.</div>`,`${cancel()}<button class="btn primary" type="submit">Aktifkan perangkat demo</button>`,()=>{db.authorized=true;save();modal.close();chooseSchool(school);});}
function adminEntry(){if(adminUnlocked){view='admin';query='';render();window.scrollTo(0,0);return;}openModal('Masuk ke dasbor admin',`<p class="modal-copy">Akses ini hanya <strong>simulasi</strong>, belum melindungi data. Gunakan kode demo <strong>ABC2026</strong>.</p>${field('Kode admin demo','code','','Masukkan ABC2026')}<p class="form-error" id="login-error" role="alert"></p><div class="info-box">Gunakan data fiktif saja. Kode terlihat di prototipe dan bukan sistem keamanan.</div>`,`${cancel()}<button class="btn primary" type="submit">Buka dasbor ${icon('arrow')}</button>`,data=>{if(data.get('code').trim()!=='ABC2026'){document.querySelector('#login-error').textContent='Kode belum sesuai. Gunakan ABC2026.';return;}adminUnlocked=true;view='admin';modal.close();render();window.scrollTo(0,0);});}
function setAttendance(id,status){const s=getSession(db,groupId,serviceId);if(s.state==='completed'||!Object.hasOwn(statuses,status))return;const r=s.records.find(r=>r.studentId===id);if(!r)return;r.status=status;s.updatedAt=new Date().toISOString();save();const focus=document.activeElement?.dataset?.statusId;const focusPresent=document.activeElement?.dataset?.action==='present';const y=window.scrollY;render();window.scrollTo(0,y);if(focus)document.querySelector(`[data-status-id="${focus}"]`)?.focus({preventScroll:true});else if(focusPresent)document.querySelector(`[data-action="present"][data-id="${id}"]`)?.focus({preventScroll:true});}
function finalize(){const s=getSession(db,groupId,serviceId);if(s.state==='completed'||!s.records.length)return;if(!canSubmitAttendance(db,s)){toast('Absensi dapat dikirim mulai tanggal pelayanan (WIB).');return;}const c=count(s.records);openModal('Selesaikan absensi?',`<p class="modal-copy">${esc(groupDisplayName(db,s))} · ${esc(schoolDisplayName(db,s))}<br>${longDate(s.date)}</p><div class="confirmation-counts">${badge('present',`${c.present} Hadir`)}${badge('excused',`${c.excused} Izin`)}${badge('absent',`${c.absent} Tidak Hadir`)}</div>${c.unmarked?`<div class="info-box warning-box"><strong>${c.unmarked} siswa belum diabsen.</strong><br>Dengan menyelesaikan absensi, seluruh siswa tersebut akan ditandai <strong>Tidak Hadir</strong>.</div>`:'<div class="info-box">Semua siswa sudah dicatat. Hasil akan tersimpan di browser ini dan dapat dikoreksi kembali.</div>'}`,`${cancel()}<button class="btn primary" type="submit">${c.unmarked?'Ya, tandai & selesaikan':'Ya, selesaikan absensi'}</button>`,()=>{if(!canSubmitAttendance(db,s)){modal.close();render();toast('Absensi dapat dikirim mulai tanggal pelayanan (WIB).');return;}submitAttendance(db,s);save();modal.close();render();window.scrollTo(0,0);toast(storageOK?'Absensi selesai dan tersimpan di browser ini.':'Absensi selesai sementara. Penyimpanan lokal tidak tersedia.');});}
const genderFields=(value=null)=>`<fieldset class="gender-fields"><legend>Jenis Kelamin (*)</legend>${Object.entries(GENDERS).map(([id,label])=>`<label><input type="radio" name="gender" value="${id}" required ${value===id?'checked':''}> ${label}</label>`).join('')}</fieldset>`;
const studentField=(label,name,value='',{required=false,type='text',limit=70}={})=>`<div class="form-row"><label for="field-${name}">${label}${required?' *':' (opsional)'}</label><input id="field-${name}" name="${name}" value="${esc(value??'')}" type="${type}" ${required?'required':''} ${type==='date'?`max="${jakartaToday()}"`:`maxlength="${limit}"`} autocomplete="off"></div>`;
function addProvisional(){
  if(!db.authorized||view!=='mentor'||!schoolId||!groupId||!serviceId)return;
  const s=getSession(db,groupId,serviceId);
  const context={schoolId,groupId,serviceSessionId:serviceId,sessionId:s.id,serviceDate:s.date};
  const {school,group,visit,defaultMentor,mentor}=attendanceStudentContext(db,context);
  if(s.state==='completed')return;
  openModal('Tambahkan siswa sementara',`<div class="info-box student-context"><strong>${esc(school.name)}</strong><br>${esc(group.name)} · ${esc(defaultMentor.name)}<br>${longDate(visit.date)}${mentor.source==='temporary'?`<br>Pengganti sesi: ${esc(mentor.name)}`:''}</div><p class="modal-copy">Sekolah, kelompok dan pelayanan mengikuti absensi ini. Siswa tetap sementara sampai ditinjau admin. Gunakan data fiktif.</p>${studentField('Nama Lengkap','name','',{required:true})}${studentField('Kelas Sekolah','schoolClass','',{required:true,limit:20})}${genderFields()}<p class="form-error" id="form-error" role="alert"></p>`,`${cancel()}<button class="btn primary" type="submit">Tambahkan siswa</button>`,form=>{
    try{
      if(!db.authorized||view!=='mentor'||schoolId!==context.schoolId||groupId!==context.groupId||serviceId!==context.serviceSessionId)throw Error('Pilihan absensi sudah berubah. Buka kembali formulir siswa.');
      addTemporaryStudent(db,context,{name:form.get('name'),schoolClass:form.get('schoolClass'),gender:form.get('gender')});
      save();query='';modal.close();render();toast('Siswa sementara ditambahkan ke pelayanan ini dan menunggu tinjauan admin.');
    }catch(error){document.querySelector('#form-error').textContent=error.message;}
  });
}

function sessionDetail(id,visitId){const g=db.groups.find(g=>g.id===id),s=db.sessions.find(s=>s.groupId===id&&s.serviceSessionId===visitId);if(!s){openModal('Belum ada catatan',`<p class="modal-copy">${esc(g.name)} · ${longDate(db.serviceSessions.find(v=>v.id===visitId).date)}<br>Mentor: ${esc(effectiveMentor(db,g.id,visitId).name)}<br>Mentor belum memulai absensi kelompok ini.</p>`,'<button class="btn primary" type="button" data-action="close-modal">Mengerti</button>');return;}const c=count(s.records);openModal('Detail absensi',`<p class="modal-copy"><strong>${esc(schoolDisplayName(db,s))} · ${esc(groupDisplayName(db,s))}</strong><br>${longDate(s.date)} · ${esc(effectiveMentor(db,s.groupId,s.serviceSessionId).name)}<br>${s.state==='completed'?'Absensi selesai':'Draf · belum selesai'}</p><div class="confirmation-counts">${Object.entries(c).filter(([,v])=>v).map(([k,v])=>badge(k,`${v} ${statuses[k]}`)).join('')}</div><div class="history-list">${s.records.map(r=>`<div class="history-row"><span>${esc(r.name)}${r.provisional?'<small class="muted"> · sementara</small>':''}</span>${badge(r.status)}</div>`).join('')}</div><div class="info-box">Catatan lokal dengan data fiktif. ${s.updatedAt?`Terakhir diperbarui: ${new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(s.updatedAt))} WIB.`:''}</div>`,'<button class="btn primary" type="button" data-action="close-modal">Tutup detail</button>');}
function studentGroupOptions(school,selected=''){
  return `<option value="">Pilih kelompok mentor</option>${studentGroups(db,school,selected).map(g=>`<option value="${g.id}" ${g.id===selected?'selected':''}>${esc(g.name)}${g.retired?' · arsip':''}</option>`).join('')}`;
}
function refreshStudentMentor(){
  const school=document.querySelector('#student-school').value,gid=document.querySelector('#student-group').value;
  const group=db.groups.find(g=>g.id===gid&&g.schoolId===school);
  document.querySelector('#student-mentor').textContent=group?'Mentor tetap: '+defaultMentorAt(db,group.id).name:'Mentor tetap mengikuti kelompok yang dipilih.';
}
function studentForm(id,context={}){
  if(!adminUnlocked)return;
  const st=id?db.students.find(s=>s.id===id):null,pending=context.provisionalId?db.provisionals.find(p=>p.id===context.provisionalId&&p.state==='pending'):null;
  if((id&&!st)||(context.provisionalId&&!pending))return;
  const initial=initialStudentContext(db,{student:st,...(pending?{schoolId:pending.schoolId,groupId:pending.groupId}:context)});
  const profile=st?db.studentPrivateProfiles?.[st.id]||{}:{};
  openModal(st?'Ubah data siswa':pending?'Tinjau & daftarkan siswa':'Tambah siswa terdaftar',`
    <p class="modal-copy">Gunakan data fiktif. Kelas Sekolah berbeda dari Kelompok Mentor ABC.${pending?' Periksa kecocokan dengan siswa terdaftar sebelum menyetujui. Catatan pelayanan asal akan dipertahankan.':''}</p>
    ${studentField('Nama Lengkap','name',st?.name||pending?.name||'',{required:true})}
    ${studentField('Kelas Sekolah','schoolClass',st?.schoolClass||pending?.schoolClass||'',{required:true,limit:20})}${genderFields(st?.gender||pending?.gender)}
    <div class="form-row"><label for="student-school">Sekolah *</label><select id="student-school" name="schoolId" required><option value="">Pilih sekolah</option>${db.schools.map(s=>`<option value="${s.id}" ${s.id===initial.schoolId?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>
    <div class="form-row"><label for="student-group">Kelompok Mentor *</label><select id="student-group" name="groupId" required ${initial.schoolId?'':'disabled'}>${studentGroupOptions(initial.schoolId,initial.groupId)}</select><p id="student-mentor" class="calendar-hint"></p></div>
    ${studentField('Tanggal Lahir','dateOfBirth',profile.dateOfBirth,{type:'date'})}
    ${studentField('Nama Orang Tua/Wali','guardianName',profile.guardianName,{limit:100})}
    <div class="form-row"><label for="field-address">Alamat Rumah (opsional)</label><textarea id="field-address" name="address" rows="3" maxlength="300">${esc(profile.address||'')}</textarea></div>
    <p class="form-error" id="form-error" role="alert"></p><div class="info-box">Profil opsional hanya ditampilkan pada formulir admin. Prototipe lokal belum memiliki perlindungan akses produksi. Perubahan profil berlaku untuk pertemuan baru; riwayat absensi tetap.</div>`,
    `${st?`<button class="btn danger" type="button" data-action="deactivate-student" data-id="${id}">Nonaktifkan</button>`:cancel()}<button class="btn primary" type="submit">${pending?'Setujui & daftarkan':'Simpan siswa'}</button>`,form=>{
      try{
        saveRegisteredStudent(db,Object.fromEntries(form),{id:st?.id,provisionalId:pending?.id,admin:adminUnlocked});
        save();modal.close();render();if(pending)reviewProvisionals();toast(pending?'Siswa disetujui. Kehadiran pelayanan asal tetap tersimpan.':'Profil siswa disimpan untuk pertemuan baru.');
      }catch(error){document.querySelector('#form-error').textContent=error.message;}
    });
  refreshStudentMentor();
}

function groupForm(id){const g=db.groups.find(g=>g.id===id);openModal(g?'Ubah kelompok':'Tambah kelompok',`${field('Nama kelompok','name',g?.name||'','Nama kelompok')}<div class="form-row"><label for="field-school">Sekolah</label><select id="field-school" name="schoolId" ${g?'disabled':''}>${db.schools.map(s=>`<option value="${s.id}" ${s.id===g?.schoolId?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>${g?`<div class="info-box">Mentor tetap: <strong>${esc(defaultMentorAt(db,g.id).name)}</strong>. Gunakan Ubah penugasan untuk pengganti sementara atau penugasan tetap bertanggal.</div>`:mentorSelect(db,selectableMentors(db)[0]?.id,'new-group-mentor')}<p class="form-error" id="form-error" role="alert"></p><div class="info-box">Mengubah nama kelompok tidak mengubah mentor atau kehadiran siswa. Akses perangkat tetap simulasi.</div>`,`${cancel()}<button class="btn primary" type="submit">Simpan kelompok</button>`,form=>{const name=form.get('name').trim(),mentorId=form.get('mentorId'),sid=g?.schoolId||form.get('schoolId');if(!name||(!g&&!selectableMentors(db).some(m=>m.id===mentorId))||db.groups.some(x=>x.id!==id&&x.schoolId===sid&&x.name.toLowerCase()===name.toLowerCase())){document.querySelector('#form-error').textContent='Isi nama kelompok unik dan pilih mentor tetap untuk kelompok baru.';return;}if(g)g.name=name;else{const created={id:uid(),schoolId:sid,name};db.groups.push(created);addInitialDefault(db,created.id,mentorId);}save();modal.close();render();toast('Data kelompok disimpan.');});}
function reviewProvisionals(){const pending=db.provisionals.filter(p=>p.state==='pending');openModal('Tinjau siswa sementara',`<p class="modal-copy">Setujui untuk menambahkan siswa ke daftar tetap. Menolak tidak menghapus catatan kehadiran pertemuan asal.</p>${pending.map(p=>{const g=db.groups.find(g=>g.id===p.groupId);return `<div style="padding:16px 0;border-top:1px solid #edf0f5"><strong style="font-size:13px">${esc(p.name)}</strong><p class="muted" style="font-size:11px;margin:6px 0 12px">${esc(db.schools.find(s=>s.id===g.schoolId).name)} · ${esc(g.name)} · Kelas ${esc(p.schoolClass||'belum diisi')}</p><div style="display:flex;gap:8px"><button type="button" class="btn soft small" data-action="approve-provisional" data-id="${p.id}">${icon('check')} Setujui</button><button type="button" class="btn small" data-action="reject-provisional" data-id="${p.id}">Tolak</button></div></div>`;}).join('')||'<div class="empty">Semua siswa sementara sudah ditinjau.</div>'}`,'<button class="btn" type="button" data-action="close-modal">Tutup</button>');}
function about(){openModal('Tentang prototipe ini',`<p class="modal-copy">ABC Goes to School membantu mentor mencatat kehadiran dan admin merekap pertemuan.</p><div class="info-box"><strong>Data fiktif · penyimpanan lokal</strong><br>Data hanya ada pada browser dan alamat yang sama. Menghapus data browser akan menghapus perubahan. Tidak ada cadangan atau sinkronisasi antarperangkat.</div><div class="info-box warning-box"><strong>Fitur simulasi</strong><br>Otorisasi perangkat dan kode admin tidak aman untuk data nyata. Ekspor berisi data demo. Jadwal Jumat adalah contoh fiktif, bukan jadwal nyata ABC. Arsip demo lama tetap pada tanggal aslinya.</div><p class="modal-copy" style="margin:18px 0 0">Aplikasi dapat bekerja offline setelah pernah dibuka dan cache siap. Pemasangan bergantung pada dukungan browser.</p>`,`<button type="button" class="btn danger" data-action="reset-confirm">Atur ulang demo</button><button type="button" class="btn primary" data-action="install">Pasang aplikasi</button>`);}
function savedDatabase(){
  const source=JSON.parse(localStorage.getItem(KEY)||'null');
  if(!source||!Array.isArray(source.students)||!Array.isArray(source.sessions))throw Error('Data tersimpan tidak tersedia. Simpan perubahan dan coba lagi.');
  return source;
}
function studentExportFilters(){
  if(adminTab==='birthdays')return {...birthdayFilters,birthMonth:birthdayFilters.month};
  if(adminTab==='groups')return groupFilters;
  return {schoolId:adminSchool,groupId:adminGroup,query:adminTab==='students'?studentQuery:''};
}
function exportDataset(type,scope){
  if(!adminUnlocked)throw Error('Akses admin diperlukan.');
  const source=savedDatabase();
  return type==='attendance'?attendanceExportData(source,attendanceFilters(),scope):studentExportData(source,{...studentExportFilters(),scope,admin:true,privateProfiles:type==='private-students'});
}
function refreshExportSummary(){
  try{
    const type=document.querySelector('#export-type').value,scope=document.querySelector('#export-scope').value,data=exportDataset(type,scope);
    document.querySelector('#export-summary').textContent=`${data.count} ${type==='attendance'?'catatan kehadiran':'siswa'} · ${scope==='all'?'semua data tersimpan':type==='attendance'?'filter Ringkasan/Riwayat':adminTab==='birthdays'?'siswa aktif pada bulan ulang tahun dan filter sekolah/kelompok':'siswa aktif sesuai filter sekolah/kelompok/pencarian'}${data.pending?' · '+data.pending+' baris kelompok kosong/belum dimulai':''}.`;
    document.querySelector('#export-private-note').hidden=type!=='private-students';
  }catch(error){document.querySelector('#export-summary').textContent=error.message;}
}
function exportForm(){
  if(!adminUnlocked)return;
  const studentTab=['students','birthdays'].includes(adminTab);
  openModal('Ekspor XLSX',`<div class="form-row"><label for="export-type">Data yang diekspor</label><select id="export-type" name="type"><option value="attendance" ${studentTab?'':'selected'}>Absensi</option><option value="students" ${studentTab?'selected':''}>Siswa — tanpa profil privat</option><option value="private-students">Siswa — termasuk profil privat (admin)</option></select></div><div class="form-row"><label for="export-scope">Cakupan</label><select id="export-scope" name="scope"><option value="filtered">Sesuai filter saat ini</option><option value="all">Semua data tersimpan</option></select></div><p id="export-summary" class="modal-copy" role="status"></p><div id="export-private-note" class="info-box warning-box" hidden>Anda memilih ekspor profil privat: tanggal lahir, nama wali dan alamat ikut diunduh. Simpan berkas dengan hati-hati. Akses admin prototipe masih simulasi.</div><p class="form-error" id="export-error" role="alert"></p>`,`${cancel()}<button class="btn primary" type="submit">Unduh XLSX</button>`,form=>{
    try{const type=form.get('type'),scope=form.get('scope'),data=exportDataset(type,scope);exportWorkbook(data.rows,`ABC_${type}_${scope}_${jakartaToday()}.xlsx`);modal.close();toast(`${data.count} ${type==='attendance'?'catatan kehadiran':'siswa'} diekspor dari data tersimpan.`);}catch(error){document.querySelector('#export-error').textContent=error.message;}
  });refreshExportSummary();
}
function importStudentForm(){
  if(!adminUnlocked)return;pendingImport=null;
  openModal('Impor siswa dari XLSX',`<p class="modal-copy">Worksheet pertama: Nama lengkap, Kelas sekolah, Jenis kelamin, Sekolah dan Kelompok ABC wajib. ID siswa dipakai untuk pembaruan tanpa duplikasi. Ekspor siswa dapat dipakai sebagai format acuan. Simpan ID sebagai teks di Excel agar angka nol di depan tetap utuh. Tidak mengimpor absensi atau mengubah mentor.</p><div class="form-row"><label for="student-import-file">Berkas XLSX (maksimal 20 MB, 5000 siswa)</label><input id="student-import-file" type="file" accept=".xlsx" required></div><div id="import-preview" class="info-box" role="status">Pilih berkas untuk memeriksa data sebelum menyimpan.</div><p class="form-error" id="import-error" role="alert"></p><p class="calendar-hint">Penyimpanan lokal belum memiliki keamanan produksi. Gunakan salinan data fiktif untuk mencoba. Seluruh baris diperiksa; tidak ada perubahan sebelum konfirmasi.</p>`,`${cancel()}<button id="commit-import" class="btn primary" type="submit" disabled>Konfirmasi impor</button>`,()=>{
    try{
      if(!pendingImport)throw Error('Pilih dan periksa berkas dahulu.');
      const source=savedDatabase();
      if(JSON.stringify(source)!==pendingImport.source)throw Error('Data berubah setelah pratinjau. Pilih ulang berkas untuk memeriksa kembali.');
      const result=commitStudentImport(source,pendingImport.plan,{admin:adminUnlocked});
      localStorage.setItem(KEY+'-before-student-import',pendingImport.source);localStorage.setItem(KEY,JSON.stringify(source));db=source;storageOK=true;pendingImport=null;modal.close();render();toast(`Impor selesai: ${result.created} baru, ${result.updated} diperbarui, ${result.skipped} tetap.`);
    }catch(error){document.querySelector('#import-error').textContent=error.message;}
  });
}
async function previewStudentImport(file){
  pendingImport=null;document.querySelector('#commit-import').disabled=true;
  if(!file)return;
  const input=document.querySelector('#student-import-file');
  document.querySelector('#import-preview').textContent='Memeriksa berkas…';document.querySelector('#import-error').textContent='';
  try{
    if(!/\.xlsx$/i.test(file.name))throw Error('Pilih berkas .xlsx.');
    const workbook=await readWorkbook(file);
    if(!adminUnlocked||!modal.open||document.querySelector('#student-import-file')!==input||input.files[0]!==file)return;
    const source=savedDatabase(),plan=planStudentImport(source,workbook,{admin:true});pendingImport={source:JSON.stringify(source),plan};
    document.querySelector('#import-preview').innerHTML=`<strong>${plan.created} baru · ${plan.updated} diperbarui · ${plan.skipped} tetap · ${plan.errors.length} bermasalah</strong>${plan.changes.slice(0,20).map(row=>`<div>Baris ${row.row}: ${esc(row.name)} · ${row.kind==='create'?'baru':'perbarui'}</div>`).join('')}${plan.changes.length>20?'<p>Pratinjau menampilkan 20 baris pertama; semua baris tetap divalidasi.</p>':''}${plan.errors.slice(0,20).map(error=>`<div class="form-error">Baris ${error.row}: ${esc(error.message)}</div>`).join('')}`;
    document.querySelector('#commit-import').disabled=plan.errors.length>0;
  }catch(error){if(document.querySelector('#student-import-file')===input)document.querySelector('#import-error').textContent=error.message;}
}



document.addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(!button)return;const action=button.dataset.action,id=button.dataset.id;
  if(action==='close-modal'){modal.close();return;}
  if(['export','logout','admin-tab','session-detail','student-form','deactivate-student','group-form','review-provisionals','approve-provisional','reject-provisional','schedule-form','assignment-edit','assignment-plan-edit','import-students'].includes(action)&&!adminUnlocked)return;
  switch(action){
    case 'mentor':view='mentor';render();window.scrollTo(0,0);break;
    case 'admin':adminEntry();break;
    case 'logout':adminUnlocked=false;view='mentor';adminTab='overview';render();toast('Keluar dari sesi admin demo.');break;
    case 'select-school':authorize(id);break;
    case 'back-schools':schoolId='';serviceId='';groupId='';dateSelectionOpen=false;query='';render();window.scrollTo(0,0);break;
    case 'back-dates':groupId='';dateSelectionOpen=true;query='';render();window.scrollTo(0,0);break;
    case 'calendar-toggle':calendarOpen=!calendarOpen;render();if(calendarOpen)document.querySelector('.calendar-day.selected:not(:disabled),.calendar-day:not(:disabled)')?.focus();else document.querySelector('#service-date-trigger')?.focus();break;
    case 'calendar-close':calendarOpen=false;render();document.querySelector('#service-date-trigger')?.focus();break;
    case 'calendar-prev':case 'calendar-next':{const next=shiftMonth(calendarMonth,action==='calendar-prev'?-1:1);if(next.length===7&&next>='0001-01'&&next<='9999-12')calendarMonth=next;render();document.querySelector(`[data-action="${action}"]`)?.focus();break;}
    case 'calendar-date':if(isFriday(id)){selectedDate=id;calendarOpen=false;render();document.querySelector('#service-date-trigger')?.focus();}break;
    case 'continue-date':continueDate();break;
    case 'select-date':{const visit=db.serviceSessions.find(v=>v.id===id&&v.schoolId===schoolId&&!v.legacy);if(!visit)break;serviceId=id;groupId='';dateSelectionOpen=false;query='';render();window.scrollTo(0,0);break;}
    case 'back-groups':groupId='';query='';render();break;
    case 'select-group':if(!db.authorized||!mentorGroups(db,serviceId).some(g=>g.id===id))break;groupId=id;query='';getSession(db,groupId,serviceId);rememberSelection();save();render();window.scrollTo(0,0);break;
    case 'present':setAttendance(id,'present');break;
    case 'finalize':finalize();break;
    case 'correct':openModal('Koreksi absensi',`<p class="modal-copy">Absensi akan dibuka sebagai draf agar status siswa bisa diperbaiki. Selesaikan kembali setelah perubahan agar masuk ke ringkasan admin.</p>`,`${cancel()}<button class="btn primary" type="submit">Buka koreksi</button>`,()=>{getSession(db,groupId,serviceId).state='draft';save();modal.close();render();toast('Mode koreksi dibuka. Selesaikan kembali setelah mengubah data.');});break;
    case 'add-provisional':addProvisional();break;
    case 'admin-tab':adminTab=id;studentQuery='';render();break;
    case 'session-detail':sessionDetail(id,button.dataset.visit);break;
    case 'student-form':studentForm(id,{schoolId:button.dataset.school||'',groupId:button.dataset.group||''});break;
    case 'deactivate-student':{const s=db.students.find(s=>s.id===id);openModal('Nonaktifkan siswa?',`<p class="modal-copy"><strong>${esc(s.name)}</strong> tidak akan muncul dalam daftar pertemuan baru. Riwayat kehadirannya tetap tersimpan.</p>`,`${cancel()}<button class="btn danger" type="submit">Ya, nonaktifkan</button>`,()=>{s.active=false;s.studentStatus='inactive';save();modal.close();render();toast('Siswa dinonaktifkan. Riwayat tetap tersimpan.');});break;}
    case 'group-form':groupForm(id);break;
    case 'assignment-edit':assignmentForm(id);break;
    case 'assignment-plan-edit':{const plan=db.defaultMentorAssignments.find(a=>a.id===id);if(plan)assignmentForm(plan.groupId,'permanent',{effectiveFrom:plan.effectiveFrom});break;}
    case 'schedule-form':scheduleForm(id);break;
    case 'review-provisionals':reviewProvisionals();break;
    case 'approve-provisional':{studentForm(null,{provisionalId:id});break;}
    case 'reject-provisional':{const p=db.provisionals.find(p=>p.id===id&&p.state==='pending');if(!p)break;p.state='rejected';p.studentStatus='rejected';save();render();reviewProvisionals();toast('Pengajuan ditolak. Catatan absensi tetap disimpan.');break;}

    case 'export':exportForm();break;
    case 'import-students':importStudentForm();break;
    case 'about':about();break;
    case 'guide':openModal('Alur absensi mentor',`<div class="modal-copy"><p><strong>1. Pilih sekolah dan tanggal pelayanan.</strong><br>Buka kalender dan pilih Jumat, lalu kelompok sesuai penugasan. Jumat yang belum dijadwalkan memerlukan konfirmasi.</p><br><p><strong>2. Catat kehadiran.</strong><br>Ketuk Hadir, atau buka ⋯ untuk Izin dan koreksi. Siswa baru dapat ditambahkan sementara.</p><br><p><strong>3. Selesaikan absensi.</strong><br>Periksa ringkasan. Siswa yang belum diabsen akan ditandai Tidak Hadir setelah konfirmasi.</p></div>`,'<button type="button" class="btn primary" data-action="close-modal">Siap, mulai!</button>');break;
    case 'reset-confirm':openModal('Atur ulang data demo?',`<p class="modal-copy">Seluruh perubahan absensi, siswa, kelompok, dan otorisasi lokal akan dihapus dan diganti dengan contoh awal. Tindakan ini tidak dapat dibatalkan.</p>`,`${cancel()}<button class="btn danger" type="submit">Ya, atur ulang</button>`,()=>{db=seed();view='mentor';schoolId='';serviceId='';dateSelectionOpen=false;groupId='';adminUnlocked=false;adminTab='overview';adminSchool='';adminGroup='';adminDate='';adminMonth=CURRENT.slice(0,7);query='';studentQuery='';corrupt=false;save();modal.close();render();toast('Data demo dikembalikan ke kondisi awal.');});break;
    case 'install':if(installPrompt){installPrompt.prompt();installPrompt.userChoice.then(()=>{installPrompt=null;});}else toast('Buka menu browser → Instal aplikasi atau Tambahkan ke layar utama, jika tersedia.');break;
  }
});
document.addEventListener('change',e=>{
  if(e.target.id==='groups-school'&&adminUnlocked){groupFilters={schoolId:e.target.value,groupId:''};render();return;}
  if(e.target.id==='groups-group'&&adminUnlocked){groupFilters.groupId=e.target.value;render();return;}
  if(e.target.id==='birthday-school'&&adminUnlocked){birthdayFilters.schoolId=e.target.value;birthdayFilters.groupId='';render();return;}
  if(e.target.id==='birthday-group'&&adminUnlocked){birthdayFilters.groupId=e.target.value;render();return;}
  if(e.target.id==='birthday-month'&&adminUnlocked){birthdayFilters.month=Number(e.target.value);render();return;}
  if(['export-type','export-scope'].includes(e.target.id)){refreshExportSummary();return;}
  if(e.target.id==='student-import-file'&&adminUnlocked){previewStudentImport(e.target.files[0]);return;}

  if(e.target.id==='student-school'&&adminUnlocked){
    const select=document.querySelector('#student-group');
    select.innerHTML=studentGroupOptions(e.target.value);select.disabled=!e.target.value;
    refreshStudentMentor();return;
  }
  if(e.target.id==='student-group'&&adminUnlocked){refreshStudentMentor();return;}

  if(e.target.id==='calendar-month'){calendarMonth=calendarMonth.slice(0,4)+'-'+e.target.value;render();document.querySelector('#calendar-month')?.focus();return;}
  if(e.target.id==='calendar-year'){const year=Number(e.target.value);if(Number.isInteger(year)&&year>=1&&year<=9999)calendarMonth=String(year).padStart(4,'0')+calendarMonth.slice(4);render();document.querySelector('#calendar-year')?.focus();return;}

  if(['assignment-type-temporary','assignment-type-permanent','assignment-service','assignment-effective'].includes(e.target.id)){refreshAssignmentControls(e.target);return;}
  if(e.target.dataset.statusId){setAttendance(e.target.dataset.statusId,e.target.value);return;}
  if(e.target.id==='schedule-school'){
    document.querySelector('#schedule-group-options').innerHTML=scheduleGroupFields(db,e.target.value,activeGroups(db).filter(g=>g.schoolId===e.target.value&&db.students.some(st=>st.active&&st.groupId===g.id)).map(g=>g.id));return;
  }
  if(e.target.id==='filter-month'){if(!e.target.value)return;adminMonth=e.target.value;adminDate='';render();}
  if(e.target.id==='filter-date'){adminDate=e.target.value;render();}
  if(e.target.id==='filter-school'){adminSchool=e.target.value;adminGroup='';adminDate='';render();}
  if(e.target.id==='filter-group'){adminGroup=e.target.value;render();}
});

document.addEventListener('input',e=>{if(e.target.id==='student-search'){query=e.target.value;document.querySelector('#roster-rows').innerHTML=rosterRows(getSession(db,groupId,serviceId));}if(e.target.id==='admin-search'){studentQuery=e.target.value;const rows=db.students.filter(s=>s.active&&s.name.toLowerCase().includes(studentQuery.toLowerCase())&&(!adminSchool||db.groups.find(g=>g.id===s.groupId)?.schoolId===adminSchool));document.querySelector('tbody').innerHTML=studentTableRows(rows);}});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
window.addEventListener('offline',()=>toast('Sedang offline. Perubahan tetap di browser ini, tanpa sinkronisasi.'));
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>toast('Cache offline belum tersedia. Prototipe tetap dapat dicoba selama terhubung.'));
render();





document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&calendarOpen){calendarOpen=false;render();document.querySelector('#service-date-trigger')?.focus();}
});
document.addEventListener('click',e=>{
  if(calendarOpen&&!e.target.closest('.calendar-anchor')&&!e.target.closest('[data-action^="calendar-"]')){calendarOpen=false;render();}
});
