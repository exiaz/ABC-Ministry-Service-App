import {msaFetch,resumeMsaSession} from './msa-session.js';
import {msaBrand} from './msa-brand.js';
import {mountVisuals} from './msa-visual.js';
import {createAccountDevicesUI} from './account-devices-ui.js';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$('brand').innerHTML=msaBrand();
if($('registration')&&document.body.hasAttribute('data-msa-portal')){
  void msaFetch('/api/portal/session',{cache:'no-store',signal:AbortSignal.timeout(10000)})
    .then(response=>{if(response.ok)location.replace('/');}).catch(()=>{});
}
if($('registration'))void mountVisuals();
let token='',busy=false,selected,pending,requestId=crypto.randomUUID(),inputKey='';
const deviceRoot=$('review-devices'),devicesUI=deviceRoot?createAccountDevicesUI({root:deviceRoot,request:(path,body)=>request(path,body),base:()=>'/api/a2-4/accounts/'+selected.uid+'/devices'}):null;
let deviceManagement=false;
const feedback=text=>{$('feedback').textContent=text;};
const labels={pending:'Menunggu',active:'Disetujui',rejected:'Ditolak',suspended:'Ditangguhkan',disabled:'Nonaktif'};
async function request(path,body){
  const response=await msaFetch(path,{method:body===undefined?'GET':'POST',credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const value=await response.json();if(!response.ok){if([401,403].includes(response.status)&&token){token='';devicesUI?.reset();if(deviceRoot)deviceRoot.hidden=true;$('review-workspace').hidden=true;$('review-login').hidden=false;$('queue').replaceChildren();$('detail').hidden=true;$('account-info').textContent='';$('history').replaceChildren();selected=undefined;pending=undefined;$('confirmation').close();}throw Error(value.error??'Permintaan belum dapat diproses.');}return value;
}
async function action(fn){if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){feedback(e.name==='TimeoutError'?'Koneksi terputus. Coba lagi dengan pengajuan yang sama.':e.message);}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
if($('registration')){
  $('registration').onsubmit=e=>{e.preventDefault();void action(async()=>{
    const value={fullName:$('full-name').value,phone:$('phone').value,username:$('username').value,password:$('password').value},key=JSON.stringify([value.fullName,value.phone,value.username]);
    if(key!==inputKey){requestId=crypto.randomUUID();inputKey=key;}
    try{const result=await request('/api/a2-2/register',{...value,requestId});feedback(result.message);$('registration').reset();requestId=crypto.randomUUID();inputKey='';}finally{$('password').value='';}
  });};
}else{
  void resumeMsaSession(async(_profile,marker)=>{token=marker;await action(async()=>{await load();$('review-login').hidden=true;});});
  const base=uid=>'/api/a2-2/accounts/'+uid;
  async function load(){const data=await request('/api/a2-2/queue');deviceManagement=!!data.deviceManagement;$('delegate-option').disabled=!data.superadmin;$('review-workspace').hidden=false;$('queue').innerHTML=data.accounts.map(a=>`<article><h3>${esc(a.fullName)}</h3><p>@${esc(a.username)} · <span class="review-state">${esc(labels[a.state])}</span></p><button data-account="${esc(a.uid)}">Tinjau akun</button></article>`).join('')||'<p>Tidak ada akun dalam cakupan tinjauan Anda.</p>';}
  async function detail(uid){
    devicesUI?.reset();if(deviceRoot)deviceRoot.hidden=!deviceManagement;
    const data=await request(base(uid)),a=data.account;selected=a;$('detail').hidden=false;$('account-title').textContent=a.fullName+' (@'+a.username+')';
    $('account-info').textContent=`${labels[a.state]} · Revisi ${a.revision} · HP ${a.phone.normalized} · ${a.phone.state==='verified'?'Nomor terverifikasi':'Nomor diberikan, belum terverifikasi'}`;
    $('duplicate-warning').textContent=`Peringatan duplikat: ${data.warnings.sameName} nama serupa; ${data.warnings.samePhone} nomor sama. Perlu pemeriksaan independen.`;
    const scope=a.reviewAssignment?.scope??a.identity.scope??a.mentorLink?.scope;
    for(const [field,key] of [['school','schoolId'],['group','groupId'],['service','serviceSessionId']])$(field).value=scope?.[key]??'';
    $('history').innerHTML=data.events.map(e=>`<p>${esc(new Date(e.at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}))} WIB · Pelaku ${esc(e.actorUid)} · Revisi ${e.revision}<br>${esc(e.reason)}</p>`).join('');
    $('defaults').textContent='';if(a.mentorLink){const r=await request(base(uid)+'/defaults');$('defaults').textContent=`Penugasan tetap yang cocok: ${r.assignments.length}. Akses absensi dan perangkat tetap memerlukan otorisasi terpisah.`;}
    $('reason').value='';$('evidence-reference').value='';$('evidence-confirmed').checked=false;$('operation').value='pending';operation();
  }
  function operation(){const op=$('operation').value,proof=['approve','link'].includes(op);$('evidence-fields').hidden=!proof;$('evidence-reference').required=proof;$('evidence-confirmed').required=proof;$('mentor-field').hidden=op!=='link';$('mentor-id').required=op==='link';$('reviewer-field').hidden=op!=='delegate';$('reviewer-id').required=op==='delegate';}
  $('operation').onchange=operation;
  $('review-login').onsubmit=e=>{e.preventDefault();void action(async()=>{const username=$('login-name').value,password=$('login-password').value;$('login-password').value='';const legacy=$('login-mode').value==='legacy',r=await request(legacy?'/api/admin/login':'/api/a1/login',legacy?{email:username,password}:{username,password});token=r.token;await load();$('review-login').hidden=true;feedback('Cakupan peninjau telah diperiksa oleh server.');});};
  $('queue').onclick=e=>{const uid=e.target.closest('[data-account]')?.dataset.account;if(uid)void action(()=>detail(uid));};
  $('refresh').onclick=()=>void action(async()=>{await load();if(selected)await detail(selected.uid);});
  $('logout').onclick=()=>void action(async()=>{try{await request('/api/a1/logout',{});}finally{token='';location.reload();}});
  $('review-form').onsubmit=e=>{
    e.preventDefault();if(busy||!selected)return;const op=$('operation').value,value={requestId:crypto.randomUUID(),expectedRevision:selected.revision,reason:$('reason').value,scope:{schoolId:$('school').value,groupId:$('group').value,serviceSessionId:$('service').value}};
    if(['approve','link'].includes(op))value.evidence={method:$('evidence-method').value,reference:$('evidence-reference').value,confirmed:$('evidence-confirmed').checked};
    if(op==='link')value.mentorId=$('mentor-id').value;else if(op==='delegate')value.reviewerUid=$('reviewer-id').value;else value.decision=op;
    const key=JSON.stringify([selected.uid,value.expectedRevision,op,{...value,requestId:null}]);if(pending?.key!==key)pending={uid:selected.uid,value,op,key};
    $('confirmation-copy').textContent=`${$('operation').selectedOptions[0].textContent}: ${selected.fullName}. Cakupan ${value.scope.schoolId} / ${value.scope.groupId} / ${value.scope.serviceSessionId}. Alasan: ${value.reason}`;$('confirmation').showModal();
  };
  $('cancel').onclick=()=>{$('confirmation').close();pending=undefined;};
  $('apply').onclick=()=>void action(async()=>{if(!pending)return;const p=pending;await request(base(p.uid)+'/'+(['link','delegate'].includes(p.op)?p.op:'review'),p.value);pending=undefined;$('confirmation').close();await load();await detail(p.uid);feedback('Tinjauan tersimpan. Tidak ada akses pelayanan yang diberikan otomatis.');});
}
