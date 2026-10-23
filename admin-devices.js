import {createAdminActivation} from './admin-activation.js';
const ids=['schoolId','groupId','serviceSessionId'];
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
const key=s=>ids.map(k=>s[k]).join('|');
const scope=s=>{if(!s||!ids.every(k=>id(s[k])))throw Error();return Object.fromEntries(ids.map(k=>[k,s[k]]));};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=value=>new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(value))+' WIB';
const labels={active:'Aktif',expired:'Kedaluwarsa',revoked:'Dicabut'};
export function deviceContextsFrom(value){
  if(!Array.isArray(value?.contexts)||value.contexts.length>256)throw Error();
  const seen=new Set();
  return value.contexts.map(row=>{
    const result=scope(row),stamp=Date.parse(row.serviceDate+'T12:00:00Z');
    if(seen.has(key(result))||!['schoolName','groupName','mentorName'].every(k=>typeof row[k]==='string'&&row[k].trim())||!/^\d{4}-\d{2}-\d{2}$/.test(row.serviceDate)||!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==row.serviceDate)throw Error();
    seen.add(key(result));return {...result,...Object.fromEntries(['schoolName','groupName','mentorName','serviceDate'].map(k=>[k,row[k]]))};
  });
}
export function devicesFrom(value){
  if(!Array.isArray(value?.devices))throw Error();const seen=new Set();
  return value.devices.map(d=>{
    if(!id(d.deviceId)||seen.has(d.deviceId)||!Object.hasOwn(labels,d.state)||!Number.isSafeInteger(d.createdAt)||!Number.isSafeInteger(d.expiresAt)||!(d.revokedAt===null||Number.isSafeInteger(d.revokedAt))||!Array.isArray(d.grants)||!d.grants.length||d.grants.length>16)throw Error();
    seen.add(d.deviceId);const grants=d.grants.map(scope);if(new Set(grants.map(key)).size!==grants.length)throw Error();
    const event=d.lastEvent;
    if(event!==null&&(!event||!['pairing-redeemed','pairing-device-revoked','device-revoked'].includes(event.event)||!Number.isSafeInteger(event.at)||typeof event.actor!=='string'))throw Error();
    return {deviceId:d.deviceId,state:d.state,createdAt:d.createdAt,expiresAt:d.expiresAt,revokedAt:d.revokedAt,grants,lastEvent:event?{event:event.event,at:event.at,actor:event.actor}:null};
  });
}

export function createAdminDevices(client,onChange){
  let state={phase:'idle',contexts:[],devices:[],school:'',visit:'',groups:[],message:''},generation=0,secret=null,issued=null,pendingIssue=null,uncertainDuplicate=false;
  const notify=()=>onChange();
  const activation=createAdminActivation(client,notify);
  const busy=()=>['loading','issuing','revoking'].includes(state.phase)||activation.busy;
  const current=g=>g===generation&&client.state.phase==='active';
  const clearCode=()=>{secret=null;activation.hide(false);};
  const error=(e,action)=>{
    if(action==='issue'&&e.duplicateSubmission===true){clearCode();pendingIssue=null;uncertainDuplicate=true;issued={pairingId:e.pairingId,expiresAt:e.expiresAt};state={...state,phase:'ready',message:'Permintaan sudah diproses; kode tidak ditampilkan ulang. Batalkan kode terakhir atau tunggu kedaluwarsa sebelum menerbitkan lagi.'};notify();return;}
    if([401,403,409].includes(e.status))pendingIssue=null;
    clearCode();state={...state,phase:'error',devices:[],message:e.status===403?'Izin pengelolaan perangkat tidak tersedia atau cakupannya berubah. Hubungi operator.':action==='issue'?'Penerbitan kode belum dapat dipastikan. Tidak diulang otomatis; kode yang tidak terlihat akan kedaluwarsa. Muat ulang sebelum mencoba lagi.':'Data atau hasil perubahan belum dapat dipastikan. Muat ulang dari server sebelum melanjutkan.'};notify();
  };
  async function load(){
    if(busy())return;
    const g=++generation;clearCode();if(issued?.expiresAt<=Date.now())issued=null;state={...state,phase:'loading',contexts:[],devices:[],groups:[],message:'Memuat izin dan perangkat mentor…'};notify();
    try{
      const [rawContexts,rawDevices]=await Promise.all([client.readPairingContext(),client.readDevices(),activation.load()]);
      if(!current(g))return;
      const contexts=deviceContextsFrom(rawContexts),devices=devicesFrom(rawDevices),keys=new Set(contexts.map(key));
      if(devices.some(d=>d.grants.some(s=>!keys.has(key(s)))))throw Error();
      state={phase:pendingIssue?'error':'ready',contexts,devices,school:'',visit:'',groups:[],message:pendingIssue?'Penerbitan sebelumnya belum dipastikan. Gunakan Coba lagi penerbitan; permintaan yang sama tidak membuat kode kedua.':'Data perangkat dimuat dari server.'};notify();
    }catch(e){if(current(g))error(e,'load');}
  }
  async function issue(){
    if(state.phase!=='ready'||!state.groups.length||secret||issued&&uncertainDuplicate||pendingIssue)return;
    const grants=state.contexts.filter(s=>s.schoolId===state.school&&s.serviceSessionId===state.visit&&state.groups.includes(s.groupId)).map(scope);
    if(grants.length!==state.groups.length)return;
    pendingIssue={grants,codeTtlMs:300000,grantTtlMs:3600000,idempotencyKey:crypto.randomUUID()};
    return sendIssue();
  }
  async function sendIssue(){
    if(!pendingIssue||state.phase==='issuing')return;
    const g=generation,command=structuredClone(pendingIssue);state={...state,phase:'issuing',message:'Menerbitkan kode sekali pakai…'};notify();
    try{
      const value=await client.issuePairingCode(command);
      if(!current(g))return;
      if(typeof value.code!=='string'||!/^[A-Za-z0-9_-]{22}$/.test(value.code)||typeof value.pairingId!=='string'||!/^[a-f0-9]{64}$/.test(value.pairingId)||!Number.isSafeInteger(value.expiresAt)||value.expiresAt<=Date.now())throw Error();
      pendingIssue=null;uncertainDuplicate=false;secret=value.code;issued={pairingId:value.pairingId,expiresAt:value.expiresAt};state={...state,phase:'ready',message:'Kode berhasil diterbitkan. Bagikan secara privat kepada mentor sekarang.'};notify();
    }catch(e){if(current(g))error(e,'issue');}
  }
  async function revoke(deviceId,confirmed=false){
    const device=state.devices.find(d=>d.deviceId===deviceId);
    if(!confirmed||state.phase!=='ready'||!device||device.state==='revoked')return;
    const g=generation;clearCode();state={...state,phase:'revoking',message:'Mencabut akses perangkat…'};notify();
    try{
      const result=await client.revokeDevice(deviceId);
      if(!current(g))return;
      if(result?.deviceId!==deviceId||result.state!=='revoked')throw Error();
      const rows=devicesFrom(await client.readDevices());
      if(!current(g))return;
      const keys=new Set(state.contexts.map(key));
      if(rows.some(d=>d.grants.some(s=>!keys.has(key(s))))||!rows.some(d=>d.deviceId===deviceId&&d.state==='revoked'))throw Error();
      state={...state,phase:'ready',devices:rows,message:'Akses perangkat dicabut oleh server.'};notify();
    }catch(e){if(current(g))error(e,'revoke');}
  }
  async function cancelCode(confirmed=false){
    if(!confirmed||state.phase!=='ready'||!issued)return;
    const g=generation,pairingId=issued.pairingId;clearCode();state={...state,phase:'revoking',message:'Membatalkan kode…'};notify();
    try{
      const value=await client.revokePairingCode(pairingId);if(!current(g))return;
      if(value.pairingId!==pairingId||!['revoked','redeemed'].includes(value.state))throw Error();
      issued=null;pendingIssue=null;uncertainDuplicate=false;state={...state,phase:'ready',message:value.state==='redeemed'?'Kode sudah ditebus. Cabut perangkat melalui daftar bila diperlukan.':'Kode dibatalkan oleh server.'};notify();
    }catch(e){if(current(g))error(e,'cancel');}
  }
  function choose(kind,value,checked){
    if(state.phase!=='ready'||busy())return;clearCode();
    if(kind==='school'){if(value&&!state.contexts.some(s=>s.schoolId===value))return;state={...state,school:value,visit:'',groups:[]};}
    if(kind==='visit'){if(value&&!state.contexts.some(s=>s.schoolId===state.school&&s.serviceSessionId===value))return;state={...state,visit:value,groups:[]};}
    if(kind==='group'){
      if(!state.contexts.some(s=>s.schoolId===state.school&&s.serviceSessionId===state.visit&&s.groupId===value))return;
      state={...state,groups:checked?[...new Set([...state.groups,value])]:state.groups.filter(g=>g!==value)};
    }
    notify();
  }
  const can=action=>client.state?.role!=='pic'||client.state.actions?.includes(action);
  function view(){
    const disabled=state.phase!=='ready'||activation.busy,schools=[...new Map(state.contexts.map(s=>[s.schoolId,s])).values()],visits=[...new Map(state.contexts.filter(s=>s.schoolId===state.school).map(s=>[s.serviceSessionId,s])).values()].sort((a,b)=>a.serviceDate.localeCompare(b.serviceDate));
    const groups=state.contexts.filter(s=>s.schoolId===state.school&&s.serviceSessionId===state.visit),metadata=new Map(state.contexts.map(s=>[key(s),s]));
    const code=secret&&issued?`<section class="info-box" aria-label="Kode sekali pakai"><strong>Kode aktivasi · tampil sekali</strong><p><output id="pairing-code-once">${esc(secret)}</output></p><p>Berlaku sampai ${time(issued.expiresAt)}. Setelah disembunyikan, kode tidak dapat ditampilkan ulang.</p><button class="btn small" data-device="hide-code">Sembunyikan kode</button></section>`:'';
    return `<section id="admin-devices" data-state="${state.phase}"><div class="info-box ${state.phase==='error'?'warning-box':''}" role="${state.phase==='error'?'alert':'status'}" aria-live="polite">${esc(state.message)}</div><div class="student-actions"><button class="btn small" data-device="reload" ${busy()?'disabled':''}>Muat ulang perangkat</button>${state.phase==='error'&&pendingIssue?'<button class="btn small" data-device="retry-issue">Coba lagi penerbitan</button>':''}${issued?`<button class="btn small" data-device="cancel-code" ${disabled||!can('pairing:revoke')?'disabled':''}>Batalkan kode terakhir</button>`:''}</div>${code}<section class="panel device-issue"><div class="panel-head"><h2>Terbitkan kode aktivasi</h2></div><form id="device-issue-form"><div class="form-row"><label for="device-school">Sekolah</label><select id="device-school" data-device-field="school" required ${disabled?'disabled':''}><option value="">Pilih sekolah</option>${schools.map(s=>`<option value="${esc(s.schoolId)}" ${s.schoolId===state.school?'selected':''}>${esc(s.schoolName)}</option>`).join('')}</select></div><div class="form-row"><label for="device-visit">Tanggal pelayanan</label><select id="device-visit" data-device-field="visit" required ${disabled||!state.school?'disabled':''}><option value="">Pilih tanggal pelayanan</option>${visits.map(s=>`<option value="${esc(s.serviceSessionId)}" ${s.serviceSessionId===state.visit?'selected':''}>${esc(s.serviceDate)} · ${esc(s.serviceSessionId)}</option>`).join('')}</select></div><fieldset class="schedule-groups"><legend>Kelompok yang diizinkan</legend>${groups.map(s=>`<label><input type="checkbox" data-device-field="group" value="${esc(s.groupId)}" ${state.groups.includes(s.groupId)?'checked':''} ${disabled?'disabled':''}><span>${esc(s.groupName)}<small class="mentor-subtitle">${esc(s.mentorName)}</small></span></label>`).join('')||'<p class="calendar-hint">Pilih sekolah dan tanggal sesuai izin server.</p>'}</fieldset><button class="btn primary" type="submit" ${disabled||!can('pairing:issue')||!state.groups.length||['superadmin','pic'].includes(client.state.role)&&!activation.canIssue||secret||issued&&uncertainDuplicate?'disabled':''}>${state.phase==='issuing'?'Menerbitkan…':(['superadmin','pic'].includes(client.state.role)?'Terbitkan kode 48 jam per kelompok':'Terbitkan kode sekali pakai')}</button><p class="calendar-hint">${['superadmin','pic'].includes(client.state.role)?'Satu kode per kelompok, berlaku tepat 48 jam dan hanya sekali pakai. Akses perangkat maksimal 1 jam dan berakhir paling lambat pada akhir tanggal pelayanan WIB.':'Pairing lama: kode berlaku 5 menit, sekali pakai; akses perangkat 1 jam untuk cakupan yang dipilih.'}</p></form></section>${activation.view()}<section class="panel"><div class="panel-head"><h2>Perangkat terdaftar · ${state.devices.length}</h2></div>${state.devices.map(d=>`<article class="device-card"><div class="student-actions"><strong>Perangkat ${esc(d.deviceId)}</strong><span class="badge ${d.state==='active'?'present':'absent'}">${labels[d.state]}</span></div><ul>${d.grants.map(s=>{const c=metadata.get(key(s));return `<li>${esc(c?.schoolName??s.schoolId)} · ${esc(c?.groupName??s.groupId)}<small class="mentor-subtitle">${esc(c?.mentorName??'')} · ${esc(c?.serviceDate??s.serviceSessionId)}</small></li>`;}).join('')}</ul><p class="calendar-hint">Didaftarkan: ${time(d.createdAt)}<br>Akses berakhir: ${time(d.expiresAt)}${d.revokedAt!==null?`<br>Dicabut: ${time(d.revokedAt)}`:''}${d.lastEvent?`<br>Jejak terakhir: ${d.lastEvent.event==='pairing-redeemed'?'Aktivasi perangkat':'Pencabutan akses'} · ${time(d.lastEvent.at)} · ${esc(d.lastEvent.actor)}`:''}</p><button class="btn danger small" data-device="revoke" data-device-id="${esc(d.deviceId)}" ${disabled||!can('pairing:revoke')||d.state==='revoked'?'disabled':''}>Cabut akses perangkat</button></article>`).join('')||'<div class="empty">Belum ada perangkat dalam cakupan izin, atau data belum dimuat.</div>'}</section></section>`;
  }
  return {
    get state(){return structuredClone({...state,issued});},view,load,issue,revoke,cancelCode,choose,activation,
    issueActivation(){if(state.phase!=='ready'||busy()||!activation.canIssue||!state.groups.length)return;const grants=state.contexts.filter(row=>row.schoolId===state.school&&row.serviceSessionId===state.visit&&state.groups.includes(row.groupId));if(grants.length===state.groups.length){clearCode();return activation.issue(grants);}},
    retryIssue(){if(state.phase==='error'&&pendingIssue)return sendIssue();},
    hideCode(){clearCode();state={...state,message:'Kode disembunyikan dan tidak dapat ditampilkan ulang.'};notify();},
    expireCode(){activation.expire();if(issued&&issued.expiresAt<=Date.now()){clearCode();issued=null;pendingIssue=null;uncertainDuplicate=false;state={...state,message:'Kode kedaluwarsa. Terbitkan kode baru bila diperlukan.'};notify();}},
    reset({preserveIntent=false}={}){generation++;clearCode();activation.reset({preserveIntent});if(!preserveIntent){issued=null;pendingIssue=null;uncertainDuplicate=false;}state={phase:'idle',contexts:[],devices:[],school:'',visit:'',groups:[],message:''};}
  };
}
