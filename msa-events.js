import {msaBrand} from './msa-brand.js';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$('event-brand').innerHTML=msaBrand();let token='',busy=false,organizations=[],options={programs:[],pics:[]},editing=null,pending,focusAfter;
const org=()=>organizations.find(o=>o.id===$('event-org').value),base=()=>'/api/stage9a/organizations/'+$('event-org').value;
const note=message=>{$('feedback').textContent=message;};
function closeForm(){if(org())$('event-new').hidden=!org().permissions.includes('events:create');editing=null;pending=undefined;$('event-form').reset();$('event-form').hidden=true;$('event-conflict').hidden=true;$('event-reload').hidden=true;$('draft-optional').open=false;}
function clearOrganization(){closeForm();options={programs:[],pics:[]};$('event-organization').hidden=true;$('event-list').replaceChildren();$('event-detail').replaceChildren();$('event-detail').hidden=true;$('draft-pic').replaceChildren();$('draft-program').replaceChildren();$('draft-org').value='';$('event-filters').reset();}
function clear(){token='';organizations=[];clearOrganization();$('event-org').replaceChildren();$('event-workspace').hidden=true;$('event-login').hidden=false;}
async function request(path,body){const r=await fetch(path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)}),v=await r.json();if(!r.ok){if([401,403].includes(r.status))clear();throw Object.assign(Error(v.error??'Permintaan belum dapat diproses.'),{status:r.status});}return v;}
async function action(fn){if(busy)return;busy=true;const controls=[...document.querySelectorAll('input,button,select,textarea')].map(n=>[n,n.disabled]);controls.forEach(([n])=>n.disabled=true);$('event-workspace').setAttribute('aria-busy','true');try{await fn();}catch(e){note(e.name==='TimeoutError'||e instanceof TypeError?'Koneksi terputus. Isian tetap tersedia. Coba simpan lagi untuk melanjutkan pengajuan yang sama.':e.message);if(e.status===409&&!$('event-form').hidden){$('event-conflict').hidden=false;$('event-reload').hidden=!editing;}$('feedback').focus();}finally{busy=false;controls.forEach(([n,disabled])=>n.disabled=disabled);$('event-workspace').setAttribute('aria-busy','false');if(focusAfter){$(focusAfter).focus();focusAfter=undefined;}}}
function fillOptions(){
  const programs=options.programs.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');$('draft-program').innerHTML='<option value="">Tanpa program</option>'+programs;$('filter-program').innerHTML='<option value="*">Semua program</option><option value="">Tanpa program</option>'+programs;
  $('draft-pic').innerHTML='<option value="">Pilih PIC internal</option>'+options.pics.map(p=>`<option value="${esc(p.id)}">${esc(p.label)}</option>`).join('');
}
const programName=id=>id===null?'Tanpa program':options.programs.find(p=>p.id===id)?.name??'Program sebelumnya (tidak aktif)';
const picName=id=>options.pics.find(p=>p.id===id)?.label??'PIC sebelumnya · perlu peninjauan';
const when=r=>r.startDate+' · '+r.startTime+' · '+r.timezone;
async function list(){
  $('event-list').textContent='Memuat draf pelayanan…';const filter=new URLSearchParams();if($('filter-program').value!=='*')filter.set('programId',$('filter-program').value);if($('filter-from').value)filter.set('from',$('filter-from').value);if($('filter-to').value)filter.set('to',$('filter-to').value);
  const r=await request(base()+'/events'+(filter.size?'?'+filter:''));$('event-list').innerHTML=r.events.length?r.events.map(e=>`<article><p class="draft-badge">Draf</p><h3>${esc(e.name)}</h3><p>${esc(when(e))}</p><p>${esc(e.venue)} · ${esc(programName(e.programId))}</p><button class="secondary" data-event="${esc(e.id)}">Lihat detail<span class="sr-only"> ${esc(e.name)}</span></button></article>`).join(''):'<p>Belum ada draf yang sesuai. Buat pelayanan baru atau ubah filter.</p>';
}
async function openOrganization(){
  clearOrganization();if(!org())return;note('Memuat pilihan organisasi…');options=await request(base()+'/options');fillOptions();$('event-organization').hidden=false;$('event-new').hidden=!org().permissions.includes('events:create');$('event-read-only').hidden=org().permissions.includes('events:create')||org().permissions.includes('events:edit');await list();note('');
}
async function load(){const selected=$('event-org').value;clearOrganization();$('event-org').replaceChildren();note('Memeriksa izin pelayanan…');const r=await request('/api/stage9a/organizations');organizations=r.organizations;$('event-org').innerHTML=organizations.map(o=>`<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('');if(organizations.some(o=>o.id===selected))$('event-org').value=selected;$('event-login').hidden=true;$('event-workspace').hidden=false;$('event-empty').hidden=!!organizations.length;await openOrganization();if(!organizations.length)note('');}
function form(row=null){
  closeForm();$('event-detail').hidden=true;editing=row;$('draft-org').value=org().name;$('event-form-title').textContent=row?'Sunting draf pelayanan':'Buat Pelayanan Baru';
  // Remove placeholders for stale references from an earlier edit.
  $('draft-pic').querySelectorAll('[data-stale]').forEach(n=>n.remove());$('draft-program').querySelectorAll('[data-stale]').forEach(n=>n.remove());
  if(row){for(const [key,value] of Object.entries({name:row.name,date:row.startDate,time:row.startTime,timezone:row.timezone,venue:row.venue,pic:row.picMembershipId,program:row.programId??''})){
    const n=$('draft-'+key);if(n.tagName==='SELECT'&&value&&![...n.options].some(o=>o.value===value)){const option=new Option(key==='pic'?'Pilih ulang PIC yang berizin':'Pilih ulang program / Tanpa program',value);option.dataset.stale='true';option.disabled=true;n.add(option);}n.value=value;
  }$('draft-optional').open=row.programId!==null;}
  $('event-new').hidden=true;$('event-form').hidden=false;if(busy)focusAfter='draft-name';else $('draft-name').focus();
}
async function detail(id,edit=false){
  $('event-detail').hidden=true;$('event-detail').replaceChildren();note('Memuat detail pelayanan…');const r=await request(base()+'/events/'+id),e=r.event;
  if(edit){form(e);note('Versi terbaru dimuat. Silakan sunting kembali.');return;}
  closeForm();$('event-detail').innerHTML=`<p class="draft-badge">Draf · Revisi ${e.revision}</p><h2>${esc(e.name)}</h2><dl><dt>Penyelenggara</dt><dd>${esc(org().name)}</dd><dt>Program</dt><dd>${esc(programName(e.programId))}</dd><dt>Mulai</dt><dd>${esc(when(e))}</dd><dt>Tempat</dt><dd>${esc(e.venue)}</dd><dt>PIC internal</dt><dd>${esc(picName(e.picMembershipId))}</dd></dl><p>ID pelayanan: ${esc(e.id)}</p>${org().permissions.includes('events:edit')?'<button class="secondary" id="event-edit">Sunting draf</button>':''}<details><summary>Riwayat perubahan (${r.history.length})</summary>${r.history.map(h=>`<p>Revisi ${h.revision} · ${esc(new Date(h.at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}))} WIB · Akun ${esc(h.actorReference)}<br>${esc(when(h.next))}</p>`).join('')}</details>`;
  $('event-detail').hidden=false;$('event-detail').focus();if($('event-edit'))$('event-edit').onclick=()=>void action(()=>detail(id,true));note('');
}
$('event-login').onsubmit=e=>{e.preventDefault();void action(async()=>{const password=$('event-password').value;$('event-password').value='';const r=await request('/api/a1/login',{username:$('event-username').value,password});token=r.token;await load();});};
$('event-org').onchange=()=>void action(openOrganization);$('event-refresh').onclick=()=>void action(load);$('event-logout').onclick=()=>void action(async()=>{try{await request('/api/a1/logout',{});}finally{clear();note('Anda sudah keluar.');}});
$('event-new').onclick=()=>{if(!busy){form();note('');}};$('event-cancel').onclick=()=>{if(!busy){closeForm();$('event-new').focus();}};
$('event-filters').onsubmit=e=>{e.preventDefault();void action(list);};$('event-list').onclick=e=>{const button=e.target.closest('[data-event]');if(button)void action(()=>detail(button.dataset.event));};
$('event-reload').onclick=()=>{if(editing)void action(()=>detail(editing.id,true));};
$('event-form').onsubmit=e=>{e.preventDefault();void action(async()=>{
  const value={name:$('draft-name').value,startDate:$('draft-date').value,startTime:$('draft-time').value,timezone:$('draft-timezone').value,venue:$('draft-venue').value,picMembershipId:$('draft-pic').value,programId:$('draft-program').value||null,expectedRevision:editing?.revision??0,reason:editing?'Penyuntingan draf pelayanan oleh pengguna berwenang':'Pembuatan draf pelayanan oleh pengguna berwenang',confirmed:true},key=JSON.stringify([$('event-org').value,editing?.id,value]);
  if(pending?.key!==key)pending={key,id:editing?.id??'event-'+crypto.randomUUID(),value:{...value,requestId:crypto.randomUUID()}};const p=pending;await request(base()+'/events/'+p.id,p.value);closeForm();await list();await detail(p.id);note('Draf pelayanan tersimpan. Anda dapat menyuntingnya kembali.');
});};
