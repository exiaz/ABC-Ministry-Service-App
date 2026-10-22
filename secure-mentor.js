import {escape as esc} from './data.js';
import {calendarGrid} from './service-ui.js';
import {longDate,isFriday} from './scheduling.js';
import {jakartaToday,shiftMonth} from './dates.js';
import {createMentorAttendance,attendanceStatuses as statuses} from './mentor-attendance.js';

const ids=['schoolId','groupId','serviceSessionId'];
const scopeKey=scope=>ids.map(k=>scope[k]).join('|');
function contextsFrom(value){
  if(!Array.isArray(value?.contexts))throw Error();
  const seen=new Set(),dates=new Map();
  return value.contexts.map(row=>{
    if(!ids.every(k=>typeof row[k]==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(row[k]))||!['schoolName','groupName','mentorName'].every(k=>typeof row[k]==='string'&&row[k].trim())||!/^\d{4}-\d{2}-\d{2}$/.test(row.serviceDate))throw Error();
    const key=scopeKey(row),dateKey=row.schoolId+'|'+row.serviceDate;
    if(seen.has(key)||dates.has(dateKey)&&dates.get(dateKey)!==row.serviceSessionId)throw Error();
    seen.add(key);dates.set(dateKey,row.serviceSessionId);
    return Object.fromEntries([...ids,'schoolName','groupName','mentorName','serviceDate'].map(k=>[k,row[k]]));
  }).filter(row=>isFriday(row.serviceDate));
}
export function createSecureMentor({client,render,icon,steps,art,openModal,closeModal}){
  let contexts=[],phase='loading-context',schoolId='',selectedDate='',month='',calendarOpen=false,selected=null,students=[],query='',error='',epoch=0;
  const notify=()=>render();
  const attendance=createMentorAttendance(client,()=>{
    const s=attendance.state;
    if(!selected||!s.scope||scopeKey(selected)!==scopeKey(s.scope))return;
    students=s.students;error=s.message;
    phase=s.phase==='loading'?'loading-roster':s.phase==='load-error'?'roster-error':'ready';
    if(s.errorStatus===403){contexts=[];selected=null;schoolId='';phase='context-error';}
    notify();
  });
  const schoolRows=()=>[...new Map(contexts.map(c=>[c.schoolId,c])).values()];
  const dates=()=>[...new Set(contexts.filter(c=>c.schoolId===schoolId).map(c=>c.serviceDate))].sort();
  const reset=()=>{epoch++;attendance.reset();contexts=[];students=[];selected=null;schoolId='';query='';phase='loading-context';closeModal?.();};
  async function loadRoster(scope){
    epoch++;selected=scope;students=[];query='';await attendance.load(scope);
  }
  async function refresh(){
    if(attendance.state.phase==='saving'||attendance.state.pending||attendance.state.phase==='conflict')return;
    const current=++epoch,prior=selected;students=[];phase='loading-context';notify();
    try{
      const rows=contextsFrom(await client.readContexts());
      if(current!==epoch||client.state.phase!=='active')return;
      contexts=rows;phase='ready';
      if(schoolId&&!rows.some(c=>c.schoolId===schoolId)){schoolId='';selected=null;}
      if(prior){const scope=rows.find(c=>scopeKey(c)===scopeKey(prior));if(scope){void loadRoster(scope);return;}selected=null;}
      if(schoolId&&!dates().includes(selectedDate)){selectedDate=dates()[0];month=selectedDate.slice(0,7);calendarOpen=false;}
    }catch{if(current!==epoch)return;contexts=[];students=[];selected=null;phase='context-error';error='Pilihan dari API belum dapat dimuat. Tidak menggunakan data demo atau penyimpanan lokal.';}
    notify();
  }
  function message(label,retry=false){return `<div class="panel empty" role="${phase.includes('error')?'alert':'status'}"><p>${esc(label)}</p>${retry?'<button class="btn primary small" data-action="secure-retry">Coba lagi</button>':''}</div>`;}
  function view(){
    let html='';
    if(phase==='loading-context')html=message('Memuat sekolah dan izin pelayanan dari API…');
    else if(phase==='context-error')html=message(error,true);
    else if(!contexts.length)html=message('Belum ada sekolah atau pelayanan Jumat yang tersedia dalam izin perangkat. Hubungi admin.');
    else if(!schoolId){
      html=`<div class="heading"><div><h1>Halo, Kak Mentor!</h1><p>Pilih sekolah sesuai izin perangkat.</p></div><span class="badge excused">API lokal</span></div><section class="hero"><div class="hero-copy"><div class="eyebrow">ABC MOVEMENT · GOES TO SCHOOL</div><h2>Langkah kecil.<br>Dampak yang berarti.</h2><p>Catat kehadiran siswa fiktif.<br>Absensi disimpan melalui API lokal.</p></div>${art()}</section>${steps(1)}<div class="section-heading"><h2>Melayani di sekolah mana?</h2><span class="count-label">${schoolRows().length} sekolah</span></div><div class="school-grid">${schoolRows().map(c=>`<button class="school-card blue" data-action="select-school" data-id="${esc(c.schoolId)}"><div class="school-icon">${icon('school')}</div>${icon('arrow')}<h3>${esc(c.schoolName)}</h3><p>Sesuai izin perangkat</p><div class="school-meta"><span>${new Set(contexts.filter(row=>row.schoolId===c.schoolId).map(row=>row.groupId)).size} kelompok</span></div></button>`).join('')}</div>`;
    }else if(selected){
      const s=attendance.state,done=s.data?.state==='completed',editable=['ready','saved'].includes(s.phase),counts=Object.fromEntries(Object.keys(statuses).map(k=>[k,students.filter(r=>r.status===k).length]));
      html=`<button class="back-btn" data-action="back-groups">${icon('back')} Pilih kelompok lain</button><div class="heading"><div><h1>Catat kehadiran</h1><p>${esc(selected.schoolName)} · ${esc(selected.groupName)}<br>${esc(selected.mentorName)} · ${longDate(selected.serviceDate)}</p></div><span class="badge ${done?'present':'excused'}">${done?'Selesai':'Draf'}</span></div>${steps(4)}${phase==='loading-roster'?message('Memuat daftar siswa dan absensi…'):phase==='roster-error'?message(error,true):`
      <div id="attendance-status" data-state="${s.phase}" class="info-box ${['error','conflict'].includes(s.phase)?'warning-box':''}" role="${['error','conflict'].includes(s.phase)?'alert':'status'}" aria-live="polite">${esc(s.message)}${s.phase==='error'&&s.pending?'<button class="btn small" data-action="attendance-retry">Coba simpan lagi</button>':''}${s.phase!=='saving'?'<button class="btn small" data-action="attendance-reload">Muat ulang data server</button>':''}</div>
      ${done&&editable?`<div class="success-panel" role="status"><div class="success-mark">${icon('check')}</div><div><h2>Absensi selesai. Terima kasih, Kak!</h2><p>Hasil dimuat dari server. Koreksi akan membuka draf baru.</p></div><button class="btn small" data-action="secure-correct">${icon('edit')} Koreksi absensi</button></div>`:''}
      <div class="roster-layout"><section class="panel"><div class="panel-head"><div><h2>Daftar siswa · ${students.length}</h2><p>${done?'Hasil absensi dari server':'Ketuk Hadir. Gunakan ⋯ untuk mengubah status.'}</p></div>${icon('users')}</div>${students.length?`<div class="roster-toolbar"><div class="search">${icon('search')}<input id="secure-student-search" aria-label="Cari siswa" placeholder="Cari nama siswa…" value="${esc(query)}" autocomplete="off"></div></div><div class="roster-label"><span>NAMA SISWA</span><span>KEHADIRAN</span></div><div id="secure-roster-rows">${rowsView()}</div>`:message('Belum ada siswa pada kelompok dan pelayanan ini.')}</section><aside class="roster-aside"><div class="panel summary-card"><h3>Ringkasan absensi</h3><p>${students.length-counts.unmarked} dari ${students.length} siswa dicatat</p><div class="summary-stats">${Object.entries(statuses).map(([key,label])=>`<div class="summary-stat"><span><i class="status-dot ${key}"></i>${label}</span><strong>${counts[key]}</strong></div>`).join('')}</div>${!done?`<button class="btn primary" data-action="secure-review" ${editable&&students.length?'':'disabled'}>Tinjau & selesaikan ${icon('arrow')}</button>`:''}<p class="summary-note">Belum Diabsen tetap terpisah dari Tidak Hadir. Setiap perubahan harus dikonfirmasi server.</p>${selected.serviceDate>jakartaToday()?'<p class="calendar-hint">Absensi dapat diselesaikan mulai tanggal pelayanan (WIB).</p>':''}</div></aside></div>`}`;
    }else if(calendarOpen!==null){
      const school=schoolRows().find(c=>c.schoolId===schoolId);
      html=`<button class="back-btn" data-action="back-schools">${icon('back')} Semua sekolah</button><div class="heading"><div><h1>Pilih Tanggal Pelayanan</h1><p>${esc(school.schoolName)} · Jumat dalam izin perangkat.</p></div></div>${steps(2)}<section class="panel date-picker-panel"><label id="service-date-label" for="service-date-trigger">Pilih Tanggal Pelayanan</label><div class="calendar-anchor"><button id="service-date-trigger" class="date-field" data-action="calendar-toggle" aria-expanded="${calendarOpen}" aria-controls="service-calendar">${icon('calendar')}<span>${longDate(selectedDate)}</span><span>⌄</span></button>${calendarOpen?`<div id="service-calendar" class="calendar-popover" role="dialog" aria-modal="false" aria-labelledby="service-date-label">${calendarGrid(month,selectedDate,icon,dates())}<p class="calendar-hint">Hanya Jumat dalam izin perangkat · WIB</p><button class="btn text small" data-action="calendar-close">Tutup kalender</button></div>`:''}</div><p class="date-selection-note">${dates().includes(selectedDate)?'Pelayanan tersedia dalam cakupan izin.':'Tanggal ini tidak tersedia dalam izin perangkat.'}</p><button class="btn primary" data-action="continue-date" ${dates().includes(selectedDate)?'':'disabled'}>Pilih kelompok ${icon('arrow')}</button><p class="calendar-hint">Tidak membuat pelayanan baru. Izin tetap diperiksa oleh server saat daftar siswa diminta.</p></section>`;
    }else{
      const rows=contexts.filter(c=>c.schoolId===schoolId&&c.serviceDate===selectedDate);
      html=`<button class="back-btn" data-action="back-dates">${icon('back')} Pilih tanggal lain</button><div class="heading"><div><h1>Pilih kelompokmu</h1><p>${esc(rows[0]?.schoolName??'')} · ${longDate(selectedDate)}</p></div></div>${steps(3)}<div class="group-grid">${rows.map(c=>`<button class="group-card" data-action="select-group" data-id="${esc(c.groupId)}"><div class="group-top"><span class="badge excused">API lokal</span></div><h3>${esc(c.groupName)}</h3><p class="mentor-subtitle">${esc(c.mentorName)}</p><div class="bottom"><span class="muted">Daftar sesuai izin perangkat</span>${icon('arrow')}</div></button>`).join('')}</div>`;
    }
    return `<section id="secure-mentor" data-state="${phase}">${html}</section>`;
  }
  function rowsView(){
    const a=attendance.state,done=a.data?.state==='completed',disabled=!['ready','saved'].includes(a.phase);
    return students.filter(s=>s.name.toLocaleLowerCase('id').includes(query.toLocaleLowerCase('id'))).map(s=>`<div class="student-row is-${s.status}"><span class="avatar">${esc(s.name.split(' ').slice(0,2).map(n=>n[0]).join(''))}</span><div class="student-name"><strong>${esc(s.name)}</strong><small>${s.schoolClass?`Kelas ${esc(s.schoolClass)} · `:''}${statuses[s.status]}</small></div><div class="status-actions">${done?`<span class="badge ${s.status}">${statuses[s.status]}</span>`:`<button class="present-btn ${s.status==='present'?'selected':''}" data-action="secure-present" data-id="${esc(s.id)}" aria-label="Tandai ${esc(s.name)} hadir" aria-pressed="${s.status==='present'}" ${disabled?'disabled':''}>${icon('check')}Hadir</button><label class="status-select">${icon('more')}<span class="sr-only">Ubah status ${esc(s.name)}</span><select data-secure-status-id="${esc(s.id)}" aria-label="Ubah status ${esc(s.name)}" ${disabled?'disabled':''}>${Object.entries(statuses).map(([key,label])=>`<option value="${key}" ${key===s.status?'selected':''}>${label}</option>`).join('')}</select></label>`}</div></div>`).join('')||'<div class="empty">Tidak ada siswa yang cocok dengan pencarian.</div>';
  }
  function review(correct=false){
    const s=attendance.state,captured=epoch,scope=selected;
    if(!scope||!['ready','saved'].includes(s.phase)||!s.students.length||correct!==(s.data.state==='completed'))return;
    const counts=Object.entries(statuses).map(([k,label])=>`<span class="badge ${k}">${s.students.filter(r=>r.status===k).length} ${label}</span>`).join('');
    const incomplete=s.students.some(r=>r.status==='unmarked'),future=scope.serviceDate>jakartaToday();
    const body=`<p class="modal-copy">${esc(scope.schoolName)} · ${esc(scope.groupName)}<br>${longDate(scope.serviceDate)}</p><div class="confirmation-counts">${counts}</div>`;
    const cancel='<button class="btn" type="button" data-action="close-modal">Batal</button>';
    if(correct){
      openModal('Koreksi absensi',body+`<p class="modal-copy">Pilih satu status yang akan dikoreksi dan alasannya. Versi sebelumnya tetap tersimpan. Draf koreksi wajib diselesaikan kembali.</p><div class="form-row"><label for="correction-student">Siswa</label><select id="correction-student" name="studentId">${s.students.map(r=>`<option value="${esc(r.id)}">${esc(r.name)} · ${statuses[r.status]}</option>`).join('')}</select></div><div class="form-row"><label for="correction-status">Status koreksi</label><select id="correction-status" name="status">${Object.entries(statuses).map(([k,label])=>`<option value="${k}">${label}</option>`).join('')}</select></div><div class="form-row"><label for="correction-reason">Alasan koreksi</label><input id="correction-reason" name="reason" required maxlength="500" autocomplete="off"></div>`,cancel+'<button class="btn primary" type="submit">Simpan koreksi & buka draf</button>',form=>{
        if(!form.get('reason').trim())return;
        closeModal();if(captured!==epoch||scope!==selected)return;
        void attendance.mutate('correct',{records:[{studentId:form.get('studentId'),status:form.get('status')}],reason:form.get('reason').trim()},s.data.revision);
      });
    }else{
      openModal('Tinjau dan selesaikan absensi',body+`<div class="info-box ${incomplete||future?'warning-box':''}">${incomplete?'Masih ada siswa Belum Diabsen. Pilih status setiap siswa secara eksplisit sebelum menyelesaikan. Tidak ada perubahan otomatis menjadi Tidak Hadir.':future?'Tanggal pelayanan belum tiba. Draf tetap tersimpan.':'Semua siswa sudah ditandai. Konfirmasikan untuk menyelesaikan absensi di server.'}</div>`,cancel+`<button class="btn primary" type="submit" ${incomplete||future?'disabled':''}>Ya, selesaikan absensi</button>`,()=>{
        closeModal();if(captured!==epoch||scope!==selected)return;
        void attendance.mutate('finalize',{confirm:true},s.data.revision);
      });
    }
  }
  function action(name,id){
    switch(name){
      case 'secure-present':if(students.some(s=>s.id===id))void attendance.mutate('save',{records:[{studentId:id,status:'present'}]});return;
      case 'secure-review':review();return;
      case 'secure-correct':review(true);return;
      case 'attendance-retry':void attendance.retry();return;
      case 'attendance-reload':void attendance.reload();return;
      case 'secure-retry':if(selected)void loadRoster(selected);else void refresh();return;
      case 'mentor':case 'back-schools':epoch++;students=[];selected=null;schoolId='';if(contexts.length)phase='ready';break;
      case 'select-school':if(!contexts.some(c=>c.schoolId===id))return;schoolId=id;selected=null;selectedDate=dates().filter(d=>d<=jakartaToday()).at(-1)||dates()[0];month=selectedDate.slice(0,7);calendarOpen=false;break;
      case 'calendar-toggle':calendarOpen=!calendarOpen;break;
      case 'calendar-close':calendarOpen=false;break;
      case 'calendar-prev':case 'calendar-next':{const next=shiftMonth(month,name==='calendar-prev'?-1:1);if(/^\d{4}-\d{2}$/.test(next))month=next;break;}
      case 'calendar-date':if(!dates().includes(id))return;selectedDate=id;calendarOpen=false;break;
      case 'continue-date':if(!dates().includes(selectedDate))return;calendarOpen=null;break;
      case 'back-dates':epoch++;students=[];selected=null;calendarOpen=false;break;
      case 'back-groups':epoch++;students=[];selected=null;phase='ready';calendarOpen=null;break;
      case 'select-group':{const scope=contexts.find(c=>c.schoolId===schoolId&&c.serviceDate===selectedDate&&c.groupId===id);if(scope)void loadRoster(scope);return;}
      default:return;
    }
    if(!selected)attendance.reset();
    notify();
  }
  function input(target){
    if(target.dataset.secureStatusId){if(Object.hasOwn(statuses,target.value)&&students.some(s=>s.id===target.dataset.secureStatusId))void attendance.mutate('save',{records:[{studentId:target.dataset.secureStatusId,status:target.value}]});return;}
    if(target.id==='secure-student-search'){query=target.value;document.querySelector('#secure-roster-rows').innerHTML=rowsView();}
    if(target.id==='calendar-month'){month=month.slice(0,4)+'-'+target.value;notify();}
    if(target.id==='calendar-year'){const year=Number(target.value);if(Number.isInteger(year)&&year>=1&&year<=9999){month=String(year).padStart(4,'0')+month.slice(4);notify();}}
  }
  return {view,action,input,refresh,reset};
}
