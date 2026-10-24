import {deviceContextsFrom} from './admin-devices.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=v=>new Date(v).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB';
const labels={active:'Aktif',expired:'Kedaluwarsa',invalid:'Tidak berlaku',ended:'Selesai',revoked:'Dicabut'};
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
function assignment(row){
  const context=deviceContextsFrom({contexts:[row]})[0];if(!id(row.mentorId))throw Error();
  return {...context,mentorId:row.mentorId,...(typeof row.defaultMentorName==='string'?{defaultMentorName:row.defaultMentorName}:{})};
}
function backupData(value){
  if(!Array.isArray(value?.candidates)||!Array.isArray(value.assignments))throw Error();
  const candidates=value.candidates.map(d=>{if(!id(d.deviceId)||!Number.isSafeInteger(d.expiresAt))throw Error();return {deviceId:d.deviceId,expiresAt:d.expiresAt,assignment:assignment(d.assignment)};});
  const assignments=value.assignments.map(r=>{
    if(!/^[a-f0-9]{64}$/.test(r.id)||!id(r.deviceId)||!id(r.actor)||!Object.hasOwn(labels,r.state)||!Number.isSafeInteger(r.createdAt)||!Number.isSafeInteger(r.expiresAt)||r.expiresAt<=r.createdAt||typeof r.reason!=='string'||!r.reason.trim()||!Array.isArray(r.assignments)||!r.assignments.length||r.assignments.length>15||!(r.closedAt===null||Number.isSafeInteger(r.closedAt)))throw Error();
    return {id:r.id,deviceId:r.deviceId,actor:r.actor,state:r.state,reason:r.reason,createdAt:r.createdAt,expiresAt:r.expiresAt,closedAt:r.closedAt,closedBy:r.closedBy,closeReason:r.closeReason,primary:assignment(r.primary),assignments:r.assignments.map(assignment)};
  });return {candidates,assignments};
}
export function createBackupPanel(client,notify){
  let phase='idle',contexts=[],candidates=[],assignments=[],visit='',deviceId='',groups=[],message='',generation=0,pending=null;
  const can=a=>client.state.role==='superadmin'||client.state.actions?.includes(a);
  const fail=()=>{phase='error';message='Hasil belum dapat dipastikan. Muat ulang dari server; bila penugasan belum terkonfirmasi, coba lagi permintaan yang sama.';notify();};
  async function load(){
    const g=++generation;phase='loading';message='Memuat penugasan backup…';notify();
    try{const [c,b]=await Promise.all([client.readPairingContext(),client.readBackups()]);if(g!==generation)return;
      contexts=deviceContextsFrom(c);const data=backupData(b);
      candidates=data.candidates;assignments=data.assignments;phase='ready';visit='';deviceId='';groups=[];message='Izin backup diperiksa server. Kelompok dan mentor tetap dipertahankan.';notify();
    }catch{if(g===generation)fail();}
  }
  async function save(command){
    const g=++generation;phase='saving';pending=command;message='Menyimpan penugasan backup…';notify();
    try{await client.saveBackup(command);if(g!==generation)return;pending=null;await load();}catch(error){if(g===generation){if([400,403,409,429].includes(error.status))pending=null;fail();}}
  }
  return {
    get phase(){return phase;},load,
    reset({preserveIntent=false}={}){generation++;phase='idle';contexts=[];candidates=[];assignments=[];if(!preserveIntent)pending=null;visit='';deviceId='';groups=[];},
    choose(kind,value,checked){
      if(phase!=='ready')return;
      if(kind==='visit'){visit=value;deviceId='';groups=[];}
      if(kind==='device'){deviceId=value;groups=[];}
      if(kind==='group')groups=checked?[...new Set([...groups,value])]:groups.filter(g=>g!==value);
      notify();
    },
    submit(form){
      if(phase!=='ready'||pending||!can('pairing:issue'))return;
      const device=candidates.find(d=>d.deviceId===deviceId),reason=new FormData(form).get('reason')?.trim(),grants=contexts.filter(c=>c.serviceSessionId===visit&&c.schoolId===device?.assignment.schoolId&&c.groupId!==device?.assignment.groupId&&groups.includes(c.groupId));
      if(!device||!reason||!grants.length||grants.length!==groups.length)return;
      if(!globalThis.confirm(`Tugaskan ${device.assignment.mentorName} untuk backup ${grants.map(g=>g.groupName).join(', ')} sampai ${time(device.expiresAt)}?`))return;
      void save({deviceId,grants:grants.map(({schoolId,groupId,serviceSessionId})=>({schoolId,groupId,serviceSessionId})),reason,idempotencyKey:crypto.randomUUID()});
    },
    async click(button){
      const action=button.dataset.backup;
      if(action==='reload'){if(!['loading','saving'].includes(phase))return load();return;}
      if(action==='retry'){if(pending&&!['loading','saving'].includes(phase))return save(pending);return;}
      if(!['revoke','end'].includes(action)||phase!=='ready'||!can('pairing:revoke'))return;
      const row=assignments.find(r=>r.id===button.dataset.backupId);if(!['active','invalid'].includes(row?.state))return;
      const why=globalThis.prompt(action==='end'?'Alasan mengakhiri backup:':'Alasan mencabut backup:');if(!why?.trim()||why.length>500)return;
      if(!globalThis.confirm('Akses backup akan ditutup pada permintaan server berikutnya. Lanjutkan?'))return;
      const g=++generation;phase='saving';notify();
      try{await client.closeBackup(row.id,{status:action==='end'?'ended':'revoked',reason:why.trim()});if(g===generation)await load();}catch{if(g===generation)fail();}
    },
    view(){
      const busy=['loading','saving'].includes(phase),disabled=phase!=='ready',device=candidates.find(d=>d.deviceId===deviceId),visits=[...new Map(contexts.map(c=>[c.serviceSessionId,c])).values()],options=candidates.filter(d=>d.assignment.serviceSessionId===visit),rows=contexts.filter(c=>c.serviceSessionId===visit&&c.schoolId===device?.assignment.schoolId&&c.groupId!==device?.assignment.groupId);
      return `<section id="admin-backup" data-state="${phase}"><h2>Backup Mentor / Gabung Kelompok Sementara</h2><p class="info-box" role="status">${esc(message)}</p><button class="btn small" data-backup="reload" ${busy?'disabled':''}>Muat ulang backup</button>${pending?`<button class="btn small" data-backup="retry" ${busy?'disabled':''}>Coba lagi penugasan yang sama</button>`:''}${phase==='ready'?`<form id="backup-form" class="panel"><div class="form-row"><label for="backup-visit">Pelayanan</label><select id="backup-visit" data-backup-field="visit" required><option value="">Pilih pelayanan</option>${visits.map(c=>`<option value="${esc(c.serviceSessionId)}" ${visit===c.serviceSessionId?'selected':''}>${esc(c.schoolName)} · ${esc(c.serviceDate)} · ${esc(c.serviceSessionId)}</option>`).join('')}</select></div><div class="form-row"><label for="backup-device">Mentor / perangkat backup aktif</label><select id="backup-device" data-backup-field="device" required><option value="">Pilih perangkat</option>${options.map(d=>`<option value="${esc(d.deviceId)}" ${d.deviceId===deviceId?'selected':''}>${esc(d.assignment.mentorName)} · ${esc(d.assignment.groupName)} · ${esc(d.deviceId)}</option>`).join('')}</select></div><fieldset class="schedule-groups"><legend>Kelompok backup</legend>${rows.map(c=>`<label><input type="checkbox" data-backup-field="group" value="${esc(c.groupId)}" ${groups.includes(c.groupId)?'checked':''}><span>${esc(c.groupName)}<small class="mentor-subtitle">${esc(c.mentorName)}</small></span></label>`).join('')||'<p>Pilih perangkat yang sudah diaktivasi dengan kode mentor untuk sesi ini.</p>'}</fieldset><div class="form-row"><label for="backup-reason">Alasan penugasan</label><input id="backup-reason" name="reason" maxlength="500" required></div><p class="calendar-hint">Akses berakhir bersama izin perangkat${device?': '+esc(time(device.expiresAt)):''}. Siswa dan absensi tetap terpisah per kelompok. Maksimal 15 kelompok backup per perangkat.</p><button class="btn primary" type="submit" ${disabled||pending||!groups.length||!can('pairing:issue')?'disabled':''}>Konfirmasi penugasan backup</button></form>`:''}<section class="panel"><h3>Penugasan backup</h3>${assignments.map(r=>`<article class="device-card"><strong>${esc(r.primary.mentorName)} · ${labels[r.state]}</strong><p>Kelompok utama: ${esc(r.primary.groupName)}<br>${esc(r.primary.serviceDate)} · ${esc(r.primary.serviceSessionId)}<br>Perangkat: ${esc(r.deviceId)}</p><ul>${r.assignments.map(a=>`<li>${esc(a.groupName)} · mentor awal ${esc(a.mentorName)} · mentor tetap ${esc(a.defaultMentorName)}</li>`).join('')}</ul><p>Alasan: ${esc(r.reason)}<br>Oleh ${esc(r.actor)} · ${time(r.createdAt)}<br>Berakhir: ${time(r.expiresAt)}${r.closedAt?`<br>${labels[r.state]} oleh ${esc(r.closedBy)} · ${time(r.closedAt)} · ${esc(r.closeReason)}`:''}</p>${['active','invalid'].includes(r.state)?`<button class="btn small" data-backup="end" data-backup-id="${esc(r.id)}" ${disabled||!can('pairing:revoke')?'disabled':''}>Akhiri backup</button> <button class="btn danger small" data-backup="revoke" data-backup-id="${esc(r.id)}" ${disabled||!can('pairing:revoke')?'disabled':''}>Cabut backup</button>`:''}</article>`).join('')||'<p>Belum ada penugasan backup dalam cakupan Anda.</p>'}</section></section>`;
    }
  };
}
