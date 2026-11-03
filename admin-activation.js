const ids=['schoolId','groupId','serviceSessionId'],key=row=>ids.map(id=>row[id]).join('|');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=value=>new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(value)+' WIB';
const labels={pending:'Belum dipakai',redeemed:'Sudah dipakai',expired:'Kedaluwarsa',revoked:'Dicabut',invalid:'Penugasan berubah','service-ended':'Pelayanan berakhir'};
export function activationCodesFrom(value){
  if(!Array.isArray(value?.codes))throw Error();const seen=new Set();
  return value.codes.map(row=>{
    const a=row.assignment,stamp=Date.parse(a?.serviceDate+'T12:00:00Z');
    if(!/^[a-f0-9]{64}$/.test(row.pairingId)||seen.has(row.pairingId)||!Number.isSafeInteger(row.createdAt)||row.expiresAt!==row.createdAt+172800000||!Object.hasOwn(labels,row.state)||!a||![...ids,'mentorId'].every(id=>/^[A-Za-z0-9_-]{1,128}$/.test(a[id]))||!['schoolName','groupName','mentorName'].every(id=>typeof a[id]==='string'&&a[id].trim())||!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==a.serviceDate)throw Error();
    seen.add(row.pairingId);return {pairingId:row.pairingId,createdAt:row.createdAt,expiresAt:row.expiresAt,state:row.state,assignment:Object.fromEntries([...ids,'mentorId','schoolName','groupName','mentorName','serviceDate'].map(id=>[id,a[id]]))};
  });
}
export function createAdminActivation(client,notify){
  const enabled=typeof client.issueActivationCodes==='function'&&typeof client.readActivationCodes==='function';
  let rows=[],secrets=new Map(),pending=null,phase='idle',message='',generation=0,uncertain=[];
  const active=g=>g===generation&&client.state.phase==='active';
  const hide=(refresh=true)=>{secrets.clear();if(refresh)notify();};
  const fail=()=>{hide(false);phase='error';message='Hasil belum dapat dipastikan. Muat ulang atau ulangi penerbitan dengan permintaan yang sama.';notify();};
  async function load(){
    if(!enabled)return;const g=++generation;hide(false);phase='loading';
    try{const value=activationCodesFrom(await client.readActivationCodes());if(!active(g))return;rows=value;uncertain=uncertain.filter(id=>rows.some(row=>row.pairingId===id&&row.state==='pending'));phase='ready';message=pending?'Penerbitan belum dipastikan. Coba lagi memakai permintaan yang sama.':'Daftar kode 48 jam dimuat dari server.';}
    catch{if(active(g)){fail();throw Error('Daftar kode belum dimuat.');}}finally{if(active(g))notify();}
  }
  async function send(){
    if(!pending||phase==='issuing')return;const g=generation;phase='issuing';hide(false);message='Menerbitkan satu kode per kelompok…';notify();
    try{
      const value=await client.issueActivationCodes(structuredClone(pending));if(!active(g))return;
      const metadata=activationCodesFrom(value),expected=new Set(pending.grants.map(key));
      if(metadata.length!==expected.size||metadata.some(row=>!expected.delete(key(row.assignment))||row.state!=='pending'||row.expiresAt<=Date.now())||value.codes.some(row=>!/^[A-Za-z0-9_-]{22}$/.test(row.code)))throw Error();
      secrets=new Map(value.codes.map(row=>[row.pairingId,row.code]));rows=[...metadata,...rows.filter(row=>!metadata.some(item=>item.pairingId===row.pairingId))];pending=null;uncertain=[];phase='ready';message=metadata.length+' kode diterbitkan. Bagikan tiap kode hanya kepada mentor pada barisnya.';notify();
    }catch(error){if(!active(g))return;if(error.duplicateSubmission&&error.codes){try{const metadata=activationCodesFrom({codes:error.codes});uncertain=metadata.map(row=>row.pairingId);pending=null;rows=[...metadata,...rows.filter(row=>!uncertain.includes(row.pairingId))];phase='ready';message='Penerbitan sudah diproses. Kode tidak ditampilkan ulang. Periksa atau cabut kode sebelum membuat pengganti.';notify();return;}catch{}}if([400,401,403,409].includes(error.status))pending=null;fail();}
  }
  return {
    get enabled(){return enabled;},get canIssue(){return enabled&&!this.busy&&!pending&&!uncertain.length&&!secrets.size;},get busy(){return ['loading','issuing','revoking'].includes(phase);},get rows(){return structuredClone(rows);},hide,
    reset({preserveIntent=false}={}){generation++;hide(false);rows=[];phase='idle';message='';if(!preserveIntent){pending=null;uncertain=[];}},
    load,retry:send,
    async issue(grants){if(!enabled||this.busy||pending||secrets.size||uncertain.length||!grants.length)return;pending={grants:grants.map(row=>Object.fromEntries(ids.map(id=>[id,row[id]]))),idempotencyKey:crypto.randomUUID()};return send();},
    async revoke(pairingId,confirmed=false){
      if(!confirmed||this.busy||!rows.some(row=>row.pairingId===pairingId&&['pending','invalid','service-ended'].includes(row.state)))return;
      const g=generation;hide(false);phase='revoking';message='Mencabut kode…';notify();
      try{const value=await client.revokePairingCode(pairingId);if(!active(g))return;if(value.pairingId!==pairingId||!['revoked','redeemed'].includes(value.state))throw Error();const updated=activationCodesFrom(await client.readActivationCodes());if(!active(g))return;if(!updated.some(row=>row.pairingId===pairingId&&['revoked','redeemed'].includes(row.state)))throw Error();rows=updated;uncertain=uncertain.filter(id=>rows.some(row=>row.pairingId===id&&row.state==='pending'));phase='ready';message=value.state==='redeemed'?'Kode sudah dipakai. Cabut perangkat melalui daftar perangkat bila diperlukan.':'Kode dicabut oleh server.';notify();}
      catch{if(active(g))fail();}
    },
    expire(){let changed=false;for(const row of rows)if(row.state==='pending'&&row.expiresAt<=Date.now()){row.state='expired';secrets.delete(row.pairingId);uncertain=uncertain.filter(id=>id!==row.pairingId);changed=true;}if(changed)notify();},
    view(){if(!enabled)return '';return `<section id="admin-activation" class="panel" data-state="${phase}"><div class="panel-head"><h2>Kode aktivasi 48 jam</h2></div><p class="calendar-hint">Pilih sekolah, tanggal dan kelompok pada form di atas. Satu kode untuk satu kelompok dan satu perangkat. Untuk perangkat lain, terbitkan kode baru. Kode dapat ditebus selama 48 jam. Akses perangkat maksimal 1 jam sejak penebusan dan berakhir paling lambat pada akhir tanggal pelayanan WIB.</p><div class="info-box ${phase==='error'?'warning-box':''}" role="status" aria-live="polite">${esc(message)}</div><div class="student-actions"><button type="button" class="btn primary" data-activation="issue" ${this.busy||pending||uncertain.length||secrets.size||client.state.role==='pic'&&!client.state.actions?.includes('pairing:issue')?'disabled':''}>Terbitkan 48 jam · satu kode per kelompok</button>${pending?'<button class="btn small" type="button" data-activation="retry">Coba lagi penerbitan 48 jam</button>':''}${secrets.size?'<button class="btn small" type="button" data-activation="hide">Sembunyikan semua kode</button>':''}</div>${rows.map(row=>`<article class="device-card"><strong>${esc(row.assignment.schoolName)} · ${esc(row.assignment.groupName)}</strong><p>${esc(row.assignment.mentorName)} · ${esc(row.assignment.serviceDate)}</p><span class="badge ${row.state==='pending'?'excused':'absent'}">${labels[row.state]}</span><p class="calendar-hint">Diterbitkan: ${time(row.createdAt)}<br>Batas penebusan: ${time(row.expiresAt)}</p>${secrets.has(row.pairingId)?`<div class="info-box"><strong>Kode tampil sekali</strong><p><output data-activation-code>${esc(secrets.get(row.pairingId))}</output></p><p>Bagikan secara privat. Kode tidak dapat ditampilkan ulang.</p></div>`:''}<button class="btn danger small" type="button" data-activation="revoke" data-pairing-id="${row.pairingId}" ${this.busy||!['pending','invalid','service-ended'].includes(row.state)||client.state.role==='pic'&&!client.state.actions?.includes('pairing:revoke')?'disabled':''}>Cabut kode</button></article>`).join('')||'<p class="calendar-hint">Belum ada kode 48 jam dalam cakupan izin.</p>'}</section>`;}
  };
}
