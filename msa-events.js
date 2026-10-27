import {msaFetch,resumeMsaSession} from './msa-session.js';
import {msaBrand} from './msa-brand.js';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$('event-brand').innerHTML=msaBrand();let token='',busy=false,organizations=[],options={programs:[],pics:[]},editing=null,pending,focusAfter,calendarOrganizations=[],calendarEvents=[],calendarCurrent,calendarPending,calendarAvailable=false,schedulingAvailable=false,seriesPending;
const calendarWide=matchMedia('(min-width:900px)');$('calendar-filter-details').open=calendarWide.matches;calendarWide.addEventListener('change',e=>{$('calendar-filter-details').open=e.matches;});
const statuses={draft:'Draf',published:'Terbit',cancelled:'Dibatalkan'};
const org=()=>organizations.find(o=>o.id===$('event-org').value),base=()=>'/api/stage9a/organizations/'+$('event-org').value;
const note=message=>{$('feedback').textContent=message;};
function closeForm(){clearRecurrence();if(org())$('event-new').hidden=!org().permissions.includes('events:create');editing=null;pending=undefined;$('event-form').reset();$('event-form').hidden=true;$('event-conflict').hidden=true;$('event-reload').hidden=true;$('draft-optional').open=false;}
function clearOrganization(){closeForm();options={programs:[],pics:[]};$('event-organization').hidden=true;$('event-list').replaceChildren();$('event-detail').replaceChildren();$('event-detail').hidden=true;$('draft-pic').replaceChildren();$('draft-program').replaceChildren();$('draft-org').value='';$('event-filters').reset();$('filter-program').innerHTML='<option value="*">Semua program</option><option value="">Tanpa program</option>';}
function clearCalendar(){calendarEvents=[];calendarCurrent=undefined;calendarPending=undefined;$('calendar-confirm').close();$('calendar-confirm-form').reset();$('calendar-confirm-copy').textContent='';$('calendar-confirm-title').textContent='';$('calendar-operation-feedback').textContent='';$('calendar-detail').replaceChildren();$('calendar-detail').hidden=true;$('calendar-list').replaceChildren();$('calendar-result').textContent='';}
function clearDashboard(){document.body.classList.remove('dashboard-active');$('dashboard-workspace').hidden=true;$('dashboard-content').replaceChildren();$('dashboard-result').textContent='';}
function clear(){schedulingAvailable=false;$('dashboard-show').hidden=true;clearDashboard();token='';organizations=[];clearOrganization();clearCalendar();calendarOrganizations=[];$('calendar-org').replaceChildren();$('calendar-program').replaceChildren();$('calendar-workspace').hidden=true;$('calendar-nav').hidden=true;$('event-org').replaceChildren();$('event-workspace').hidden=true;$('event-login').hidden=false;}
async function request(path,body){const r=await msaFetch(path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)}),v=await r.json();if(!r.ok){if([401,403].includes(r.status))clear();throw Object.assign(Error(v.error??'Permintaan belum dapat diproses.'),{status:r.status});}return v;}
async function action(fn){if(busy)return;busy=true;const controls=[...document.querySelectorAll('input,button,select,textarea')].map(n=>[n,n.disabled]);controls.forEach(([n])=>n.disabled=true);$('event-workspace').setAttribute('aria-busy','true');try{await fn();}catch(e){note(e.name==='TimeoutError'||e instanceof TypeError?'Koneksi terputus. Isian tetap tersedia. Coba simpan lagi untuk melanjutkan pengajuan yang sama.':e.message);if(e.status===409&&!$('event-form').hidden){$('event-conflict').hidden=false;$('event-reload').hidden=!editing;}($('recurrence-confirm').open?$('recurrence-feedback'):$('calendar-confirm').open?$('calendar-operation-feedback'):$('feedback')).focus();}finally{busy=false;controls.forEach(([n,disabled])=>n.disabled=disabled);$('event-workspace').setAttribute('aria-busy','false');if(calendarPending?.sent)$('calendar-dismiss').disabled=true;if(seriesPending)$('recurrence-back').disabled=!!seriesPending.sent;if(focusAfter){$(focusAfter).focus();focusAfter=undefined;}}}
function fillOptions(){
  const programs=options.programs.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');$('draft-program').innerHTML='<option value="">Tanpa program</option>'+programs;$('filter-program').innerHTML='<option value="*">Semua program</option><option value="">Tanpa program</option>'+programs;
  $('draft-pic').innerHTML='<option value="">Pilih PIC internal</option>'+options.pics.map(p=>`<option value="${esc(p.id)}">${esc(p.label)}</option>`).join('');
}
const programName=id=>id===null?'Tanpa program':options.programs.find(p=>p.id===id)?.name??'Program sebelumnya (tidak aktif)';
const picName=id=>options.pics.find(p=>p.id===id)?.label??'PIC sebelumnya · perlu peninjauan';
const when=r=>r.startDate+' · '+r.startTime+' · '+r.timezone;
async function list(){
  $('event-list').textContent='Memuat draf pelayanan…';const filter=new URLSearchParams();if($('filter-program').value!=='*')filter.set('programId',$('filter-program').value);if($('filter-from').value)filter.set('from',$('filter-from').value);if($('filter-to').value)filter.set('to',$('filter-to').value);
  const r=await request(base()+'/events'+(filter.size?'?'+filter:''));$('event-list').innerHTML=r.events.length?r.events.map(e=>`<article><p class="draft-badge">${esc(statuses[e.status])}</p><h3>${esc(e.name)}</h3><p>${esc(when(e))}</p><p>${esc(e.venue)} · ${esc(programName(e.programId))}</p><button class="secondary" data-event="${esc(e.id)}">Lihat detail<span class="sr-only"> ${esc(e.name)}</span></button></article>`).join(''):'<p>Belum ada draf yang sesuai. Buat pelayanan baru atau ubah filter.</p>';
}
async function openOrganization(){
  clearOrganization();if(!org())return;note('Memuat pilihan organisasi…');options=await request(base()+'/options');fillOptions();$('event-organization').hidden=false;$('event-new').hidden=!org().permissions.includes('events:create');$('event-read-only').hidden=org().permissions.includes('events:create')||org().permissions.includes('events:edit');await list();note('');
}
async function load(){clearDashboard();const selected=$('event-org').value;clearOrganization();clearCalendar();calendarOrganizations=[];$('calendar-workspace').hidden=true;$('event-org').replaceChildren();note('Memeriksa izin pelayanan…');const r=await request('/api/stage9a/organizations');organizations=r.organizations;calendarAvailable=r.publishAvailable===true;schedulingAvailable=r.schedulingAvailable===true;$('dashboard-show').hidden=!schedulingAvailable;$('event-org').innerHTML=organizations.map(o=>`<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('');if(organizations.some(o=>o.id===selected))$('event-org').value=selected;$('event-login').hidden=true;$('event-workspace').hidden=false;
  if(calendarAvailable){const c=await request('/api/stage9b1/catalog');calendarOrganizations=c.organizations;$('event-heading').textContent=schedulingAvailable?'Pelayanan':'Pelayanan dan kalender';$('event-intro').textContent=schedulingAvailable?'Pilot lokal · data fiktif.':'Pilot lokal · data fiktif. Jadwal terbit hanya untuk pengguna MSA berwenang.';$('calendar-show').textContent=schedulingAvailable?'Kalender':'Agenda gabungan';fillCalendarFilters();}
  $('calendar-nav').hidden=!calendarAvailable;$('draft-show').hidden=!organizations.length;$('event-empty').hidden=!!(organizations.length||calendarOrganizations.length);if(schedulingAvailable)await showDashboard();else if(calendarAvailable&&calendarOrganizations.length)await showCalendar();else{await openOrganization();if(!organizations.length)note('');}}
function form(row=null){
  closeForm();$('event-detail').hidden=true;editing=row;$('draft-org').value=org().name;$('event-form-title').textContent=row?.status==='published'?'Sunting pelayanan terbit':row?'Sunting draf pelayanan':'Buat Pelayanan Baru';$('draft-state').textContent=statuses[row?.status??'draft'];$('event-save').textContent=row?.status==='published'?'Simpan perubahan':'Simpan draf';
  // Remove placeholders for stale references from an earlier edit.
  $('draft-pic').querySelectorAll('[data-stale]').forEach(n=>n.remove());$('draft-program').querySelectorAll('[data-stale]').forEach(n=>n.remove());
  if(row){for(const [key,value] of Object.entries({name:row.name,date:row.startDate,time:row.startTime,timezone:row.timezone,venue:row.venue,pic:row.picMembershipId,program:row.programId??''})){
    const n=$('draft-'+key);if(n.tagName==='SELECT'&&value&&![...n.options].some(o=>o.value===value)){const option=new Option(key==='pic'?'Pilih ulang PIC yang berizin':'Pilih ulang program / Tanpa program',value);option.dataset.stale='true';option.disabled=true;n.add(option);}n.value=value;
  }$('draft-optional').open=row.programId!==null;}
  $('recurrence-controls').hidden=!schedulingAvailable||!!row;$('recurrence-weekly').hidden=true;$('recurrence-weekday').required=false;$('recurrence-end').required=false;if(schedulingAvailable&&!row)$('event-save').textContent='Tinjau tanggal';$('event-new').hidden=true;$('event-form').hidden=false;if(busy)focusAfter='draft-name';else $('draft-name').focus();
}
async function detail(id,edit=false){
  $('event-detail').hidden=true;$('event-detail').replaceChildren();note('Memuat detail pelayanan…');const r=await request(base()+'/events/'+id),e=r.event;
  if(edit){form(e);note('Versi terbaru dimuat. Silakan sunting kembali.');return;}
  closeForm();const canEdit=!(e.seriesId&&e.startAt<=Date.now())&&org().permissions.includes('events:edit')&&e.status!=='cancelled'&&(e.status==='draft'||calendarAvailable&&org().permissions.includes('events:publish'));$('event-detail').innerHTML=`<p class="draft-badge">${esc(statuses[e.status])} · Revisi ${e.revision}</p><h2>${esc(e.name)}</h2><dl><dt>Penyelenggara</dt><dd>${esc(org().name)}</dd><dt>Program</dt><dd>${esc(programName(e.programId))}</dd><dt>Mulai</dt><dd>${esc(when(e))}</dd><dt>Tempat</dt><dd>${esc(e.venue)}</dd><dt>PIC internal</dt><dd>${esc(picName(e.picMembershipId))}</dd></dl><p>ID pelayanan: ${esc(e.id)}</p>${canEdit?'<button class="secondary" id="event-edit">'+(e.status==='draft'?'Sunting draf':'Sunting pelayanan')+'</button>':''}${calendarAvailable?'<button class="secondary" id="event-calendar-open">Lihat di kalender</button>':''}<details><summary>Riwayat perubahan (${r.history.length})</summary>${r.history.map(h=>`<p>Revisi ${h.revision} · ${esc(new Date(h.at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}))} WIB · Akun ${esc(h.actorReference)} · ${esc(statuses[h.next.status])}<br>${esc(when(h.next))}</p>`).join('')}</details>`;
  $('event-detail').hidden=false;$('event-detail').focus();if($('event-edit'))$('event-edit').onclick=()=>void action(()=>detail(id,true));note('');
  if($('event-calendar-open'))$('event-calendar-open').onclick=()=>void action(async()=>{await showCalendar();await calendarDetail(e.organizationId,e.id);});
}
const calendarPath=(organizationId,eventId)=>'/api/stage9b1/organizations/'+organizationId+'/events/'+eventId;
const shiftDate=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
function currentWeek(){const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());$('calendar-from').value=date;$('calendar-to').value=shiftDate(date,6);}
function calendarPrograms(){
  const selected=$('calendar-program').value,organizationId=$('calendar-org').value,programs=calendarOrganizations.filter(o=>!organizationId||o.id===organizationId).flatMap(o=>o.programs.map(p=>({...p,organizationName:o.name})));
  $('calendar-program').innerHTML='<option value="*">Semua program</option><option value="">Tanpa program</option>'+programs.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.organizationName)}${p.status==='inactive'?' · Nonaktif':''}</option>`).join('');if([...$('calendar-program').options].some(o=>o.value===selected))$('calendar-program').value=selected;
}
function fillCalendarFilters(){
  const selected=$('calendar-org').value;$('calendar-org').innerHTML='<option value="">Semua organisasi Anda</option>'+calendarOrganizations.map(o=>`<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('');if(calendarOrganizations.some(o=>o.id===selected))$('calendar-org').value=selected;calendarPrograms();
  $('calendar-status').innerHTML='<option value="published">Terbit</option><option value="cancelled">Dibatalkan</option><option value="all">Semua status yang diizinkan</option>'+(calendarOrganizations.some(o=>o.permissions.includes('events:read'))?'<option value="draft">Draf (izin internal)</option>':'');currentWeek();
}
function renderCalendar(){
  const groups=new Map();for(const e of calendarEvents){if(!groups.has(e.startDate))groups.set(e.startDate,[]);groups.get(e.startDate).push(e);}
  $('calendar-list').className=$('calendar-view').value==='days'?'calendar-days':'';
  $('calendar-list').innerHTML=[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([date,rows])=>`<section class="calendar-day"><h3>${esc(new Date(date+'T12:00:00Z').toLocaleDateString('id-ID',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'}))}</h3>${rows.map(e=>`<article class="calendar-card"><p class="draft-badge" data-status="${esc(e.status)}">${esc(statuses[e.status])}</p><h4>${esc(e.name)}</h4><p>${esc(e.startTime)} · ${esc(e.timezone)}</p><p><strong>${esc(e.organizationName)}</strong><br>${esc(e.programName??'Tanpa program')}</p><p>${esc(e.venue)}<br>PIC internal: ${esc(e.picLabel)}</p><button class="secondary" data-calendar-org="${esc(e.organizationId)}" data-calendar-event="${esc(e.id)}">Lihat detail<span class="sr-only"> ${esc(e.name)}</span></button></article>`).join('')}</section>`).join('');
}
async function calendarList(){
  calendarEvents=[];$('calendar-list').replaceChildren();$('calendar-result').textContent='Memuat jadwal pelayanan…';$('calendar-detail').replaceChildren();$('calendar-detail').hidden=true;calendarCurrent=undefined;
  const filter=new URLSearchParams({from:$('calendar-from').value,to:$('calendar-to').value,status:$('calendar-status').value});if($('calendar-org').value)filter.set('organizationId',$('calendar-org').value);if($('calendar-program').value!=='*')filter.set('programId',$('calendar-program').value);
  try{const r=await request('/api/stage9b1/calendar?'+filter);calendarEvents=r.events;renderCalendar();$('calendar-result').textContent=r.events.length?r.events.length+' pelayanan sesuai izin Anda.':'Belum ada pelayanan yang sesuai dengan tanggal, filter, dan izin Anda.';note('');}catch(e){$('calendar-result').textContent='Jadwal belum dapat dimuat. Periksa filter atau coba lagi.';throw e;}
}
async function showCalendar(){clearDashboard();closeForm();$('event-organization').hidden=true;$('calendar-workspace').hidden=false;await calendarList();}
async function calendarDetail(organizationId,eventId){
  $('calendar-detail').hidden=true;$('calendar-detail').replaceChildren();calendarCurrent=undefined;note('Memuat detail pelayanan…');const r=await request(calendarPath(organizationId,eventId)),e=r.event;calendarCurrent=r;
  $('calendar-detail').innerHTML=`<p class="draft-badge">${esc(statuses[e.status])} · Revisi ${e.revision}</p><h2>${esc(e.name)}</h2><dl><dt>Penyelenggara</dt><dd>${esc(e.organizationName)}</dd><dt>Program</dt><dd>${esc(e.programName??'Tanpa program')}</dd><dt>Mulai</dt><dd>${esc(when(e))}</dd><dt>Tempat</dt><dd>${esc(e.venue)}</dd><dt>PIC internal</dt><dd>${esc(e.picLabel)}</dd></dl>${e.status==='cancelled'?'<p>Alasan pembatalan: '+esc(e.cancellationReason)+'</p>':''}<p>ID pelayanan: ${esc(e.id)}</p>${r.capabilities.publish?'<button id="calendar-publish">Terbitkan pelayanan</button>':''}${r.capabilities.edit?'<button id="calendar-edit" class="secondary">Sunting pelayanan</button>':''}${r.capabilities.cancel?'<button id="calendar-cancel" class="secondary">Batalkan pelayanan</button>':''}`;
  $('calendar-detail').hidden=false;$('calendar-detail').focus();note('');
  if(e.status==='published'){
    $('calendar-detail').insertAdjacentHTML('beforeend','<section aria-labelledby="calendar-export-title"><h3 id="calendar-export-title">Tambahkan ke kalender</h3><p>Salinan manual ini tidak otomatis mengikuti perubahan atau pembatalan di MSA. Periksa MSA untuk jadwal terbaru.</p><form id="calendar-export-form"><label for="calendar-export-duration">Durasi untuk salinan kalender (menit)</label><input id="calendar-export-duration" type="number" inputmode="numeric" required min="1" step="1" aria-describedby="calendar-export-help"><p id="calendar-export-help">Isi durasi yang sudah Anda pastikan. Waktu selesai dihitung dari durasi ini; tidak ada durasi bawaan dan event MSA tidak diubah. Nama dan tempat memakai data pelayanan terbit, tanpa kontak PIC atau catatan internal.</p><button type="submit" name="format" value="google">Tambahkan ke Google Calendar</button><button class="secondary" type="submit" name="format" value="ics">Unduh .ics</button><p id="calendar-export-result" role="status" aria-live="polite"></p></form></section>');
    $('calendar-export-form').onsubmit=exportCalendar;
  }
  if($('calendar-publish'))$('calendar-publish').onclick=()=>confirmLifecycle('publish');if($('calendar-cancel'))$('calendar-cancel').onclick=()=>confirmLifecycle('cancel');
  if($('calendar-edit'))$('calendar-edit').onclick=()=>void action(async()=>{$('calendar-workspace').hidden=true;$('event-org').value=e.organizationId;await openOrganization();await detail(e.id,true);});
}
function exportCalendar(event){
  event.preventDefault();if(busy||!calendarCurrent)return;const row=calendarCurrent.event,format=event.submitter?.value;if(!['google','ics'].includes(format))return;
  let popup;if(format==='google'){
    popup=window.open('about:blank','_blank');if(!popup){note('Browser memblokir tab baru. Izinkan tab baru untuk membuka Google Calendar.');$('feedback').focus();return;}popup.opener=null;
  }
  void action(async()=>{
    try{
      const v=await request(calendarPath(row.organizationId,row.id)+'/export',{expectedRevision:row.revision,durationMinutes:Number($('calendar-export-duration').value),format});
      if(format==='google')popup.location.replace(v.googleUrl);
      else{const url=URL.createObjectURL(new Blob([v.ics],{type:'text/calendar;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=v.filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),0);}
      note('');
      $('calendar-export-result').textContent='Salinan disiapkan sampai '+new Date(v.endAt).toLocaleString('id-ID',{timeZone:v.timezone})+' ('+v.timezone+'). Perubahan MSA tidak tersinkron otomatis.';
    }catch(error){popup?.close();throw error;}
  });
}
function confirmLifecycle(operation){
  if(busy||!calendarCurrent)return;calendarPending={row:calendarCurrent.event,operation};$('calendar-confirm-form').reset();$('calendar-reason').readOnly=false;$('calendar-reason').value=operation==='publish'?'Pelayanan telah diperiksa dan siap diterbitkan.':'';$('calendar-dismiss').disabled=false;$('calendar-operation-feedback').textContent='';$('calendar-confirm-title').textContent=operation==='publish'?'Terbitkan pelayanan?':'Batalkan pelayanan?';$('calendar-confirm-copy').textContent=calendarCurrent.event.name+(operation==='publish'?'. Jadwal hanya terlihat oleh pengguna MSA berwenang.':'. Riwayat tetap disimpan dan pelayanan tidak dipulihkan otomatis.');$('calendar-apply').textContent=operation==='publish'?'Terbitkan pelayanan':'Batalkan pelayanan';$('calendar-confirm').showModal();$('calendar-dismiss').focus();
}
$('calendar-show').onclick=()=>void action(showCalendar);$('draft-show').onclick=()=>void action(async()=>{clearDashboard();clearCalendar();$('calendar-workspace').hidden=true;await openOrganization();});
$('calendar-filters').onsubmit=e=>{e.preventDefault();void action(async()=>{await calendarList();if(!calendarWide.matches)$('calendar-filter-details').open=false;});};$('calendar-org').onchange=()=>{calendarPrograms();void action(calendarList);};$('calendar-view').onchange=renderCalendar;
for(const [button,days] of [['calendar-prev',-7],['calendar-next',7]])$(button).onclick=()=>void action(async()=>{$('calendar-from').value=shiftDate($('calendar-from').value,days);$('calendar-to').value=shiftDate($('calendar-to').value,days);await calendarList();});$('calendar-today').onclick=()=>void action(async()=>{currentWeek();await calendarList();});
$('calendar-list').onclick=e=>{const b=e.target.closest('[data-calendar-event]');if(b)void action(()=>calendarDetail(b.dataset.calendarOrg,b.dataset.calendarEvent));};
$('calendar-dismiss').onclick=()=>{if(!busy&&!calendarPending?.sent){calendarPending=undefined;$('calendar-confirm').close();$('calendar-detail').focus();}};
$('calendar-confirm').addEventListener('cancel',e=>{if(busy||calendarPending?.sent)e.preventDefault();else calendarPending=undefined;});
$('calendar-confirm-form').onsubmit=e=>{e.preventDefault();void action(async()=>{
  const p=calendarPending;if(!p)return;if(!p.value)p.value={requestId:crypto.randomUUID(),expectedRevision:p.row.revision,reason:$('calendar-reason').value,confirmed:true};p.sent=true;$('calendar-reason').readOnly=true;
  try{await request(calendarPath(p.row.organizationId,p.row.id)+'/'+p.operation,p.value);}catch(error){if(calendarPending){if(error.status&&error.status<500){p.sent=false;p.value=undefined;$('calendar-reason').readOnly=false;$('calendar-dismiss').disabled=false;}$('calendar-operation-feedback').textContent=error.status&&error.status<500?error.message:'Hasil belum dapat dipastikan. Tekan tindakan yang sama untuk melanjutkan pengajuan; alasan dan ID pengajuan tetap.';}throw error;}
  calendarPending=undefined;$('calendar-confirm').close();await calendarList();await calendarDetail(p.row.organizationId,p.row.id);note(p.operation==='publish'?'Pelayanan terbit di kalender MSA.':'Pelayanan dibatalkan. Riwayat tetap tersimpan.');
});};
$('event-login').onsubmit=e=>{e.preventDefault();void action(async()=>{const password=$('event-password').value;$('event-password').value='';const r=await request('/api/a1/login',{username:$('event-username').value,password});token=r.token;await load();});};
$('event-org').onchange=()=>void action(openOrganization);$('event-refresh').onclick=()=>void action(load);$('event-logout').onclick=()=>void action(async()=>{try{await request('/api/a1/logout',{});}finally{clear();note('Anda sudah keluar.');}});
$('event-new').onclick=()=>{if(!busy){form();note('');}};$('event-cancel').onclick=()=>{if(!busy){closeForm();$('event-new').focus();}};
$('event-filters').onsubmit=e=>{e.preventDefault();void action(list);};$('event-list').onclick=e=>{const button=e.target.closest('[data-event]');if(button)void action(()=>detail(button.dataset.event));};
$('event-reload').onclick=()=>{if(editing)void action(()=>detail(editing.id,true));};
$('event-form').onsubmit=e=>{e.preventDefault();void action(async()=>{
  if(schedulingAvailable&&!editing){await previewSeries();return;}
  const value={name:$('draft-name').value,startDate:$('draft-date').value,startTime:$('draft-time').value,timezone:$('draft-timezone').value,venue:$('draft-venue').value,picMembershipId:$('draft-pic').value,programId:$('draft-program').value||null,expectedRevision:editing?.revision??0,reason:editing?.status==='published'?'Perubahan rincian pelayanan terbit oleh pengguna berwenang':editing?'Penyuntingan draf pelayanan oleh pengguna berwenang':'Pembuatan draf pelayanan oleh pengguna berwenang',confirmed:true},key=JSON.stringify([$('event-org').value,editing?.id,value]);
  if(pending?.key!==key)pending={key,id:editing?.id??'event-'+crypto.randomUUID(),value:{...value,requestId:crypto.randomUUID()}};const p=pending,published=editing?.status==='published';await request(base()+'/events/'+p.id,p.value);closeForm();await list();await detail(p.id);note(published?'Perubahan pelayanan terbit tersimpan.':'Draf pelayanan tersimpan. Anda dapat menyuntingnya kembali.');
});};

function clearRecurrence(){seriesPending=undefined;$('recurrence-confirm').close();$('recurrence-dates').replaceChildren();$('recurrence-copy').textContent='';$('recurrence-feedback').textContent='';}
$('recurrence-frequency').onchange=()=>{const weekly=$('recurrence-frequency').value==='weekly';$('recurrence-weekly').hidden=!weekly;$('recurrence-weekday').required=weekly;$('recurrence-end').required=weekly;};
const schedulingPath=()=>'/api/stage9b2/organizations/'+$('event-org').value;
async function previewSeries(){
  const weekly=$('recurrence-frequency').value==='weekly',schedule={name:$('draft-name').value,startDate:$('draft-date').value,startTime:$('draft-time').value,timezone:$('draft-timezone').value,venue:$('draft-venue').value,picMembershipId:$('draft-pic').value,programId:$('draft-program').value||null,frequency:weekly?'weekly':'once',weekday:weekly?Number($('recurrence-weekday').value):new Date($('draft-date').value+'T00:00:00Z').getUTCDay(),endDate:weekly?$('recurrence-end').value:$('draft-date').value};
  const r=await request(schedulingPath()+'/preview',schedule);seriesPending={path:schedulingPath()+'/series/series-'+crypto.randomUUID(),value:{requestId:crypto.randomUUID(),expectedRevision:0,reason:'Pembuatan seri draf setelah pratinjau dan konfirmasi pengguna',confirmed:true,schedule,previewToken:r.previewToken}};
  $('recurrence-copy').textContent=schedule.name+' · '+org().name+' · '+schedule.startTime+' · '+r.timezone+' · '+schedule.venue;
  $('recurrence-dates').innerHTML=r.dates.map(date=>'<li>'+esc(new Date(date+'T12:00:00Z').toLocaleDateString('id-ID',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'}))+'</li>').join('');$('recurrence-feedback').textContent=r.dates.length+' tanggal. Periksa semuanya sebelum mengonfirmasi.';$('recurrence-back').disabled=false;$('recurrence-confirm').showModal();focusAfter='recurrence-back';
}
$('recurrence-back').onclick=()=>{if(!busy&&!seriesPending?.sent){clearRecurrence();$('event-save').focus();}};
$('recurrence-confirm').addEventListener('cancel',e=>{if(busy||seriesPending?.sent)e.preventDefault();else{clearRecurrence();$('event-save').focus();}});
$('recurrence-apply').onclick=()=>void action(async()=>{
  const p=seriesPending;if(!p)return;p.sent=true;
  try{const r=await request(p.path,p.value);clearRecurrence();closeForm();await list();await detail(r.events[0].id);note(r.events.length+' draf pelayanan tersimpan. Setiap tanggal dapat dikelola sendiri.');}
  catch(e){if(seriesPending){if(e.status&&e.status<500)p.sent=false;$('recurrence-feedback').textContent=e.status&&e.status<500?e.message:'Hasil belum dapat dipastikan. Tekan Konfirmasi & buat draf lagi untuk mencoba pengajuan yang sama.';}throw e;}
});
function dashboardCards(rows){return rows.map(e=>`<article class="calendar-card"><p class="draft-badge">${esc(statuses[e.status])}</p><h4>${esc(e.name)}</h4><p>${esc(when(e))}</p><p>${esc(e.venue)}</p><p>${esc(e.organizationName)} · ${esc(e.programName??'Tanpa program')}</p><button class="secondary" data-dashboard-org="${esc(e.organizationId)}" data-dashboard-event="${esc(e.id)}">Lihat detail<span class="sr-only"> ${esc(e.name)}</span></button></article>`).join('');}
async function showDashboard(){
  document.body.classList.add('dashboard-active');closeForm();clearCalendar();$('calendar-workspace').hidden=true;$('event-organization').hidden=true;$('dashboard-workspace').hidden=false;$('dashboard-content').replaceChildren();$('dashboard-new').hidden=true;$('dashboard-result').textContent='Memuat pelayanan sesuai izin Anda…';
  try{const r=await request('/api/stage9b2/dashboard');$('dashboard-new').hidden=!r.organizations.some(o=>o.canCreate);$('dashboard-result').textContent='Jadwal mendatang · 90 hari. Tampil sesuai izin Anda.';
    $('dashboard-content').innerHTML=[['Mendatang',r.upcoming,'Belum ada pelayanan terbit mendatang.'],['PIC Anda',r.assigned,'Belum ada pelayanan mendatang yang menugaskan Anda sebagai PIC.'],['Draf perlu ditinjau',r.drafts,'Tidak ada draf yang memerlukan tindakan sesuai izin Anda.']].map(([title,rows,empty])=>`<section><h3>${title}</h3>${rows.length?dashboardCards(rows.slice(0,3))+(rows.length>3?'<details><summary>Lihat '+(rows.length-3)+' pelayanan lainnya</summary>'+dashboardCards(rows.slice(3))+'</details>':''):'<p>'+empty+'</p>'}</section>`).join('');note('');
  }catch(e){$('dashboard-result').textContent='Beranda belum dapat dimuat. Periksa koneksi atau izin, lalu muat ulang. Kalender tetap tersedia untuk mempersempit hasil.';throw e;}
}
$('dashboard-show').onclick=()=>void action(showDashboard);$('dashboard-retry').onclick=()=>void action(showDashboard);
$('dashboard-new').onclick=()=>void action(async()=>{clearDashboard();clearCalendar();$('calendar-workspace').hidden=true;const first=organizations.find(o=>o.permissions.includes('events:create'));if(!first)return;$('event-org').value=first.id;await openOrganization();form();note('Pastikan organisasi penyelenggara sesuai sebelum menyimpan.');});
$('dashboard-content').onclick=e=>{const b=e.target.closest('[data-dashboard-event]');if(b)void action(async()=>{clearDashboard();$('calendar-workspace').hidden=false;await calendarDetail(b.dataset.dashboardOrg,b.dataset.dashboardEvent);});};

void resumeMsaSession(async(_profile,marker)=>{token=marker;await action(load);});
