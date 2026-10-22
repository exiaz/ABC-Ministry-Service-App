import {escape as esc} from './data.js';
import {calendarGrid} from './service-ui.js';
import {longDate,isFriday} from './scheduling.js';
import {jakartaToday,shiftMonth} from './dates.js';

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
function studentsFrom(value,scope){
  if(!ids.every(k=>value?.[k]===scope[k])||!Array.isArray(value.students))throw Error();
  const seen=new Set();return value.students.map(s=>{
    if(typeof s.id!=='string'||typeof s.name!=='string'||(s.schoolClass!==null&&typeof s.schoolClass!=='string')||seen.has(s.id))throw Error();
    seen.add(s.id);return {id:s.id,name:s.name,schoolClass:s.schoolClass};
  });
}
export function createSecureMentor({client,render,icon,steps,art}){
  let contexts=[],phase='loading-context',schoolId='',selectedDate='',month='',calendarOpen=false,selected=null,students=[],query='',error='',epoch=0;
  const notify=()=>render();
  const schoolRows=()=>[...new Map(contexts.map(c=>[c.schoolId,c])).values()];
  const dates=()=>[...new Set(contexts.filter(c=>c.schoolId===schoolId).map(c=>c.serviceDate))].sort();
  const reset=()=>{epoch++;contexts=[];students=[];selected=null;schoolId='';query='';phase='loading-context';};
  async function loadRoster(scope){
    const current=++epoch;selected=scope;students=[];query='';phase='loading-roster';notify();
    try{
      const rows=studentsFrom(await client.readRoster(scope),scope);
      if(current!==epoch||client.state.phase!=='active')return;
      students=rows;phase='ready';
    }catch(e){if(current!==epoch)return;students=[];phase='roster-error';error=e.message;if(e.status===403){contexts=[];selected=null;schoolId='';phase='context-error';}}
    notify();
  }
  async function refresh(){
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
      html=`<div class="heading"><div><h1>Halo, Kak Mentor!</h1><p>Pilih sekolah sesuai izin perangkat.</p></div><span class="badge excused">API · baca saja</span></div><section class="hero"><div class="hero-copy"><div class="eyebrow">ABC MOVEMENT · GOES TO SCHOOL</div><h2>Langkah kecil.<br>Dampak yang berarti.</h2><p>Daftar siswa dibaca dari API lokal.<br>Pencatatan absensi belum tersedia.</p></div>${art()}</section>${steps(1)}<div class="section-heading"><h2>Melayani di sekolah mana?</h2><span class="count-label">${schoolRows().length} sekolah</span></div><div class="school-grid">${schoolRows().map(c=>`<button class="school-card blue" data-action="select-school" data-id="${esc(c.schoolId)}"><div class="school-icon">${icon('school')}</div>${icon('arrow')}<h3>${esc(c.schoolName)}</h3><p>Sesuai izin perangkat</p><div class="school-meta"><span>${new Set(contexts.filter(row=>row.schoolId===c.schoolId).map(row=>row.groupId)).size} kelompok</span></div></button>`).join('')}</div>`;
    }else if(selected){
      html=`<button class="back-btn" data-action="back-groups">${icon('back')} Pilih kelompok lain</button><div class="heading"><div><h1>Daftar siswa</h1><p>${esc(selected.schoolName)} · ${esc(selected.groupName)}<br>${esc(selected.mentorName)} · ${longDate(selected.serviceDate)}</p></div><span class="badge excused">Baca saja</span></div>${steps(4)}<section class="panel"><div class="panel-head"><h2>Daftar siswa ${phase==='ready'?`· ${students.length}`:''}</h2><span class="muted">API lokal</span></div>${phase==='loading-roster'?message('Memuat daftar siswa…'):phase==='roster-error'?message(error,true):students.length?`<div class="roster-toolbar"><div class="search">${icon('search')}<input id="secure-student-search" aria-label="Cari siswa" placeholder="Cari nama siswa…" value="${esc(query)}" autocomplete="off"></div></div><div id="secure-roster-rows">${rowsView()}</div>`:message('Belum ada siswa pada kelompok dan pelayanan ini.')}</section><p class="calendar-hint">Daftar baca-saja. Tidak ada status kehadiran yang diubah atau disimpan pada tahap ini.</p>`;
    }else if(calendarOpen!==null){
      const school=schoolRows().find(c=>c.schoolId===schoolId);
      html=`<button class="back-btn" data-action="back-schools">${icon('back')} Semua sekolah</button><div class="heading"><div><h1>Pilih Tanggal Pelayanan</h1><p>${esc(school.schoolName)} · Jumat dalam izin perangkat.</p></div></div>${steps(2)}<section class="panel date-picker-panel"><label id="service-date-label" for="service-date-trigger">Pilih Tanggal Pelayanan</label><div class="calendar-anchor"><button id="service-date-trigger" class="date-field" data-action="calendar-toggle" aria-expanded="${calendarOpen}" aria-controls="service-calendar">${icon('calendar')}<span>${longDate(selectedDate)}</span><span>⌄</span></button>${calendarOpen?`<div id="service-calendar" class="calendar-popover" role="dialog" aria-modal="false" aria-labelledby="service-date-label">${calendarGrid(month,selectedDate,icon,dates())}<p class="calendar-hint">Hanya Jumat dalam izin perangkat · WIB</p><button class="btn text small" data-action="calendar-close">Tutup kalender</button></div>`:''}</div><p class="date-selection-note">${dates().includes(selectedDate)?'Pelayanan tersedia dalam cakupan izin.':'Tanggal ini tidak tersedia dalam izin perangkat.'}</p><button class="btn primary" data-action="continue-date" ${dates().includes(selectedDate)?'':'disabled'}>Pilih kelompok ${icon('arrow')}</button><p class="calendar-hint">Tidak membuat pelayanan baru. Izin tetap diperiksa oleh server saat daftar siswa diminta.</p></section>`;
    }else{
      const rows=contexts.filter(c=>c.schoolId===schoolId&&c.serviceDate===selectedDate);
      html=`<button class="back-btn" data-action="back-dates">${icon('back')} Pilih tanggal lain</button><div class="heading"><div><h1>Pilih kelompokmu</h1><p>${esc(rows[0]?.schoolName??'')} · ${longDate(selectedDate)}</p></div></div>${steps(3)}<div class="group-grid">${rows.map(c=>`<button class="group-card" data-action="select-group" data-id="${esc(c.groupId)}"><div class="group-top"><span class="badge excused">Baca saja</span></div><h3>${esc(c.groupName)}</h3><p class="mentor-subtitle">${esc(c.mentorName)}</p><div class="bottom"><span class="muted">Daftar sesuai izin perangkat</span>${icon('arrow')}</div></button>`).join('')}</div>`;
    }
    return `<section id="secure-mentor" data-state="${phase}">${html}</section>`;
  }
  function rowsView(){
    return students.filter(s=>s.name.toLocaleLowerCase('id').includes(query.toLocaleLowerCase('id'))).map(s=>`<div class="student-row"><span class="avatar">${esc(s.name.split(' ').slice(0,2).map(n=>n[0]).join(''))}</span><div class="student-name"><strong>${esc(s.name)}</strong><small>${s.schoolClass?`Kelas ${esc(s.schoolClass)}`:'Kelas belum diisi'}</small></div></div>`).join('')||'<div class="empty">Tidak ada siswa yang cocok dengan pencarian.</div>';
  }
  function action(name,id){
    switch(name){
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
    notify();
  }
  function input(target){
    if(target.id==='secure-student-search'){query=target.value;document.querySelector('#secure-roster-rows').innerHTML=rowsView();}
    if(target.id==='calendar-month'){month=month.slice(0,4)+'-'+target.value;notify();}
    if(target.id==='calendar-year'){const year=Number(target.value);if(Number.isInteger(year)&&year>=1&&year<=9999){month=String(year).padStart(4,'0')+month.slice(4);notify();}}
  }
  return {view,action,input,refresh,reset};
}
