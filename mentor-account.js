import {msaBrand} from './msa-brand.js';
import {createPairingClient} from './pairing-client.js';
import {createSecureMentor} from './secure-mentor.js';
import {createAccountDevicesUI} from './account-devices-ui.js';
import {mountVisuals} from './msa-visual.js';
import {renewalPlan,renewalFailure} from './mentor-session-schedule.js';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=document.querySelector('meta[name="abc-api-origin"]').content;
const devicesUI=createAccountDevicesUI({root:$('account-device-management'),request:(path,body)=>request(path,body),base:()=> 'devices',changed:()=>verify()});devicesUI.reset();
const persistentMode=document.body.dataset.mentorSession==='1';let sessionExpiresAt=0;
let token='',profile=null,busy=false,message='',generation=0,wasActive=false,modalHandler,devicesOpen=false,checking=persistentMode,checkMessage='Mohon tunggu.',logoutPending=false,accessExpiresAt=0,renewTimer,expirationTimer,deniedCheckPending=false;
if(persistentMode)$('account-remember-option').hidden=false;
$('account-brand').innerHTML=msaBrand();
void mountVisuals();
if(document.body.dataset.adminOrigin){const home=document.createElement('a');home.href=document.body.dataset.adminOrigin+'/';home.className='btn';home.textContent='Beranda aplikasi';$('account-brand').append(home);}
$('account-show-password').onclick=()=>{const show=$('account-password').type==='password';$('account-password').type=show?'text':'password';$('account-show-password').textContent=show?'Sembunyikan':'Tampilkan';$('account-show-password').setAttribute('aria-label',show?'Sembunyikan kata sandi':'Tampilkan kata sandi');$('account-show-password').setAttribute('aria-pressed',String(show));};
const closeModal=()=>{$('account-modal').close();$('account-modal-title').textContent='';$('account-modal-form').replaceChildren();modalHandler=undefined;};
function showAssignmentWeek(groups){
  const root=$('account-dates');root.replaceChildren();
  const first=groups[0]?.serviceDate;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(first??''))return;
  const date=new Date(first+'T12:00:00Z');if(Number.isNaN(date.valueOf())||date.toISOString().slice(0,10)!==first)return;
  const heading=document.createElement('p');heading.className='account-week-heading';heading.textContent='Minggu penugasan pertama · '+date.toLocaleDateString('id-ID',{month:'long',year:'numeric',timeZone:'UTC'});root.append(heading);
  const list=document.createElement('ol');list.className='account-week';const start=new Date(date);start.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));
  for(let i=0;i<7;i++){const d=new Date(start);d.setUTCDate(start.getUTCDate()+i);const item=document.createElement('li'),day=document.createElement('span'),number=document.createElement('strong');day.textContent=d.toLocaleDateString('id-ID',{weekday:'short',timeZone:'UTC'});number.textContent=String(d.getUTCDate());item.append(day,number);if(d.toISOString().slice(0,10)===first){item.className='account-week-selected';item.setAttribute('aria-label',d.toLocaleDateString('id-ID',{dateStyle:'full',timeZone:'UTC'})+', penugasan pertama');}list.append(item);}
  root.append(list);
}
function markNavigation(){const links=[...$('account-navigation').querySelectorAll('a:not([hidden])')],active=links.find(a=>a.hash===location.hash)||links[0];for(const link of links){if(link===active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');}}
$('account-navigation').addEventListener('click',e=>{const link=e.target.closest('a');if(link){for(const other of $('account-navigation').querySelectorAll('a'))other.removeAttribute('aria-current');link.setAttribute('aria-current','location');}});
window.addEventListener('hashchange',markNavigation);
const icon=name=>{const paths={check:'m5 12 4 4L19 6',back:'m14 6-6 6 6 6M8 12h13',arrow:'m10 6 6 6-6 6M3 12h13',more:'M5 12h1m5 0h1m5 0h1',search:'m16 16 5 5M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14',edit:'m4 16 12-12 4 4-12 12H4z',calendar:'M4 5h16v15H4zM4 10h16M8 2v6m8-6v6',users:'M6 21v-4h12v4M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0'};return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]??paths.arrow}"/></svg>`;};
const client=createPairingClient(api,state=>{
  if(!token)return;
  if(state.phase==='active'&&!wasActive){wasActive=true;void secure.refresh();}
  if(state.phase!=='active'){wasActive=false;secure.reset();}
  if(persistentMode&&state.phase==='revoked'&&!deniedCheckPending){deniedCheckPending=true;setTimeout(checkDeniedAccount,0);}
  render();
},{personalSession:()=>token});
const secure=createSecureMentor({client,render,icon,personal:true,steps:()=>'',art:()=>'',closeModal,openModal:(title,body,buttons,handler)=>{$('account-modal-title').textContent=title;$('account-modal-form').innerHTML=body+'<div class="modal-actions">'+buttons+'</div>';modalHandler=handler;$('account-modal').showModal();}});
function reset(text){generation++;clearTimeout(renewTimer);clearTimeout(expirationTimer);token='';profile=null;accessExpiresAt=0;sessionExpiresAt=0;wasActive=false;secure.reset();client.resetAccount();message=text;render();}
function unavailable(text){checking=true;checkMessage=text;reset('');$('account-session-retry').hidden=false;}
async function sessionRequest(path,body={}){
  const response=await fetch(api+'/api/mentor-session/'+path,{method:'POST',credentials:'include',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000),headers:{'Content-Type':'application/json','X-MSA-Mentor-Session':'1'},body:JSON.stringify(body)});
  const value=await response.json();if(!response.ok){const error=Error(value.error??'Sesi belum dapat diperiksa.');error.status=response.status;throw error;}return value;
}
// sessionExpiresAt from the server is the final limit: when the access token is already bounded by it there is nothing left to renew.
function scheduleRenewal(){
  clearTimeout(renewTimer);clearTimeout(expirationTimer);const current=generation,plan=renewalPlan({now:Date.now(),accessExpiresAt,sessionExpiresAt});
  expirationTimer=setTimeout(()=>{if(current!==generation||!token||Date.now()<accessExpiresAt)return;if(plan.onExpire==='signed-out'){checking=false;reset('Sesi berakhir. Masuk kembali.');}else unavailable('Sesi belum dapat diperiksa. Periksa koneksi lalu coba lagi.');},plan.expireIn);
  if(plan.renewIn===null)return;
  renewTimer=setTimeout(()=>{if(busy){renewTimer=setTimeout(scheduleRenewal,5000);return;}void action(renewSession);},plan.renewIn);
}
function retryRenewal(delay){clearTimeout(renewTimer);const current=generation;renewTimer=setTimeout(()=>{if(current!==generation||!token)return;if(busy){retryRenewal(1000);return;}void action(renewSession);},delay);}
const validSession=p=>validProfile(p)&&/^[-\w]{43}$/.test(p.token??'')&&Number.isSafeInteger(p.accessExpiresAt)&&p.accessExpiresAt>Date.now()&&Number.isSafeInteger(p.sessionExpiresAt)&&p.sessionExpiresAt>Date.now();
async function acceptSession(p,current){
  if(current!==generation)return;if(!validSession(p))throw Error('Respons akun belum dapat diperiksa.');
  profile=p;token=p.token;accessExpiresAt=p.accessExpiresAt;sessionExpiresAt=p.sessionExpiresAt;checking=false;message='';$('account-session-retry').hidden=true;render();scheduleRenewal();await client.restore();
}
async function restoreSession(){
  const current=++generation;checking=true;checkMessage='Memeriksa sesi akun…';reset('');const expected=generation;
  try{const p=await sessionRequest('restore');if(current+1!==generation)return;await acceptSession(p,expected);}
  catch(e){if(expected!==generation)return;if(e.status===401||e.status===403){checking=false;reset('Sesi tidak berlaku. Masuk kembali.');}else unavailable(e.status===429?'Terlalu banyak pemeriksaan sesi. Tunggu beberapa menit lalu coba lagi.':'Sesi belum dapat diperiksa. Periksa koneksi lalu coba lagi.');}
}
async function renewSession(){
  if(!token||Date.now()>=accessExpiresAt)return restoreSession();
  const current=generation;
  try{const p=await sessionRequest('restore');if(current!==generation)return;if(!validSession(p))throw Error('Respons akun belum dapat diperiksa.');const changed=JSON.stringify([profile.fullName,profile.mentorId,profile.groups,profile.deviceManagement])!==JSON.stringify([p.fullName,p.mentorId,p.groups,p.deviceManagement]);profile=p;token=p.token;accessExpiresAt=p.accessExpiresAt;sessionExpiresAt=p.sessionExpiresAt;message='';scheduleRenewal();if(changed)render();else $('account-feedback').textContent='';}
  catch(e){
    if(current!==generation)return;const failure=renewalFailure({status:e.status,now:Date.now(),accessExpiresAt});
    if(failure.action==='signed-out'){checking=false;reset('Sesi tidak berlaku. Masuk kembali.');}
    else if(failure.action==='keep'){message='Pemeriksaan sesi ditunda. Mencoba lagi sebentar lagi.';$('account-feedback').textContent=message;retryRenewal(failure.retryIn);}
    else unavailable('Sesi belum dapat diperiksa. Periksa koneksi lalu coba lagi.');
  }
}
async function logoutSession(){
  logoutPending=true;checking=true;checkMessage='Memastikan Anda keluar…';reset('');
  try{await sessionRequest('logout');logoutPending=false;checking=false;reset('Anda telah keluar. Izin perangkat tetap memerlukan login akun yang sah.');}
  catch{unavailable('Keluar belum dapat dipastikan. Periksa koneksi lalu coba lagi.');}
}
async function request(path,body){
  const response=await fetch(api+'/api/a2-3/'+path,{method:body===undefined?'GET':'POST',credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000),headers:{'Content-Type':'application/json',...(token?{'X-MSA-Session':'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const value=await response.json();if(!response.ok){if([401,403].includes(response.status)&&token){if(persistentMode){unavailable('Memeriksa kembali sesi akun…');$('account-session-retry').hidden=true;setTimeout(()=>{if(checking&&!logoutPending)void action(restoreSession);},0);}else reset('Akses akun atau penugasan tidak berlaku. Masuk kembali atau hubungi Admin.');}const error=Error(value.error??'Permintaan belum dapat diproses.');error.status=response.status;throw error;}return value;
}
function validProfile(p){return p&&typeof p.fullName==='string'&&typeof p.mentorId==='string'&&Array.isArray(p.groups)&&p.groups.every(g=>['schoolId','groupId','serviceSessionId','groupName','schoolName','mentorName','serviceDate'].every(k=>typeof g[k]==='string'));}
function render(){
  if(!token)devicesOpen=false;
  $('account-device-management').hidden=!token||!profile?.deviceManagement||!devicesOpen;
  $('account-manage-devices').hidden=!token||!profile?.deviceManagement;
  $('account-manage-devices').textContent=devicesOpen?'Kembali':'Perangkat saya';
  if(!token)devicesUI.reset();
  document.body.classList.toggle('account-authorized',!!token&&client.state.phase==='active');
  document.body.classList.toggle('account-signed-in',!!token);
  $('account-navigation').hidden=!token;
  $('account-nav-attendance').hidden=!token||client.state.phase!=='active'||devicesOpen||!navigator.onLine;
  $('account-session-check').hidden=!checking;$('account-session-message').textContent=checkMessage;
  $('account-login').hidden=!!token||checking;$('account-profile').hidden=!token;$('account-feedback').textContent=message;
  $('account-device').hidden=!token;$('account-attendance').hidden=true;
  if(!token){$('account-name').textContent='';$('account-dates').replaceChildren();$('account-groups').replaceChildren();$('account-device').replaceChildren();$('account-attendance').replaceChildren();return;}
  $('account-name').textContent=profile.fullName;
  showAssignmentWeek(profile.groups);markNavigation();
  $('account-groups').innerHTML=profile.groups.map(g=>`<article class="account-group"><p class="eyebrow">KELOMPOK UTAMA</p><h2>${esc(g.groupName)}</h2><p class="mentor-subtitle">${esc(g.mentorName)}</p><p>${esc(g.schoolName)} · ${esc(new Date(g.serviceDate+'T12:00:00+07:00').toLocaleDateString('id-ID',{dateStyle:'long',timeZone:'Asia/Jakarta'}))}</p></article>`).join('')||'<p>Belum ada penugasan yang sesuai. Hubungi Admin sebelum mengaktifkan perangkat.</p>';
  const state=client.state,offline=!navigator.onLine;
  if(offline){$('account-device').innerHTML='<section class="panel" role="status"><h2>Anda sedang offline</h2><p>Hubungkan internet atau jaringan lokal, lalu periksa akses kembali. Absensi tidak dikirim atau disimpan otomatis saat offline.</p></section>';return;}
  if(!profile.groups.length){$('account-device').innerHTML='';return;}
  if(state.phase==='active'){
    $('account-device').innerHTML='<p class="info-box account-verified" role="status">Perangkat dan akun terverifikasi untuk pelayanan ini.</p>';$('account-attendance').hidden=devicesOpen;$('account-attendance').innerHTML=secure.view();return;
  }
  const deviceChecking=['checking','pairing','associating'].includes(state.phase);
  $('account-device').innerHTML=`<section class="panel account-activation-panel"><p class="eyebrow">AKSES PERANGKAT</p><h2>${state.phase==='association-required'?'Gunakan perangkat berizin ini':deviceChecking?'Memeriksa perangkat…':'Aktivasi perangkat diperlukan'}</h2><p role="status" aria-live="polite">${esc(state.message)}</p>${state.phase==='association-required'?'<p>Konfirmasikan pemakaian perangkat ini dengan akun Anda. Absensi terbuka setelah pemeriksaan berhasil.</p><button class="btn primary" data-account-action="associate">Gunakan perangkat ini</button>':deviceChecking?'':`<p>Setiap perangkat memerlukan aktivasi sendiri untuk penugasan di atas. Masuk saja belum membuka akses absensi.</p><form id="account-activation"><label for="account-code">Kode aktivasi<input id="account-code" type="password" required maxlength="22" autocomplete="off" autocapitalize="none" spellcheck="false"></label><button class="btn primary">Aktifkan perangkat</button></form>`}<div class="pairing-actions"><button class="btn" data-account-action="verify" ${deviceChecking?'disabled':''}>Periksa akses</button>${!deviceChecking?'<button class="btn" data-account-action="remove">Hapus izin lokal perangkat</button>':''}</div></section>`;
}
async function action(fn){if(busy)return;busy=true;try{await fn();}catch(e){if(persistentMode&&(e.name==='TimeoutError'||e instanceof TypeError||e.status>=500))unavailable('Sesi belum dapat diperiksa. Periksa koneksi lalu coba lagi.');else{message=e.name==='TimeoutError'||e instanceof TypeError?'Koneksi belum tersedia. Periksa jaringan lalu coba lagi.':e.message;secure.reset();render();}}finally{busy=false;}}
function checkDeniedAccount(){if(!token){deniedCheckPending=false;return;}if(busy){setTimeout(checkDeniedAccount,100);return;}void action(async()=>{try{await request('context');}finally{deniedCheckPending=false;}});}
$('account-login-form').onsubmit=e=>{e.preventDefault();void action(async()=>{
  const current=++generation,username=$('account-username').value,password=$('account-password').value;$('account-password').value='';const submit=$('account-login-form').querySelector('button[type=submit]');submit.disabled=true;submit.textContent='Memeriksa akun…';$('account-login-form').setAttribute('aria-busy','true');
  $('account-password').type='password';$('account-show-password').textContent='Tampilkan';$('account-show-password').setAttribute('aria-label','Tampilkan kata sandi');$('account-show-password').setAttribute('aria-pressed','false');
  try{const p=persistentMode?await sessionRequest('login',{username,password,persistent:$('account-remember').checked}):await request('login',{username,password});if(current!==generation)return;if(persistentMode)await acceptSession(p,current);else{if(!validProfile(p)||!/^[-\w]{43}$/.test(p.token??''))throw Error('Respons akun belum dapat diperiksa.');profile=p;token=p.token;message='';render();await client.restore();}}
  finally{submit.disabled=false;submit.textContent='Masuk';$('account-login-form').removeAttribute('aria-busy');}
});};
$('account-logout').onclick=()=>void action(async()=>{if(persistentMode)await logoutSession();else{await request('logout',{});reset('Anda telah keluar. Izin perangkat tetap memerlukan login akun yang sah.');}});
$('account-session-retry').onclick=()=>void action(logoutPending?logoutSession:restoreSession);
$('account-manage-devices').onclick=()=>{devicesOpen=!devicesOpen;render();if(devicesOpen)void devicesUI.load().then(()=>$('account-device-management').scrollIntoView({block:'start'}));};
async function verify(){const current=generation,p=await request('context');if(current!==generation)return;if(!validProfile(p))throw Error('Penugasan belum dapat diperiksa.');profile=p;message='';await client.restore();if(client.state.phase==='active')await secure.refresh();render();}
$('account-device').onsubmit=e=>{if(e.target.id!=='account-activation')return;e.preventDefault();const code=$('account-code').value.trim();$('account-code').value='';devicesOpen=false;void action(()=>client.activate(code));};
document.addEventListener('click',e=>{
  const a=e.target.closest('[data-account-action]')?.dataset.accountAction;if(a){void action(()=>a==='associate'?client.associate():a==='remove'?client.remove():verify());return;}
  const node=e.target.closest('[data-action]');if(!node)return;if(node.dataset.action==='close-modal'){closeModal();return;}secure.action(node.dataset.action,node.dataset.id,node.dataset.visit);
});
document.addEventListener('change',e=>{if(e.target.matches('[data-secure-status-id]'))secure.input(e.target);});
document.addEventListener('input',e=>{if(e.target.id==='secure-student-search')secure.input(e.target);});
$('account-modal-form').onsubmit=e=>{e.preventDefault();modalHandler?.(new FormData(e.target));};
window.addEventListener('offline',()=>{if(persistentMode)unavailable('Koneksi terputus. Hubungkan kembali untuk memeriksa sesi.');else{secure.reset();message='Koneksi terputus. Periksa akses kembali setelah terhubung.';render();}});
window.addEventListener('online',()=>{if(persistentMode&&checking)void action(logoutPending?logoutSession:restoreSession);else if(token)void action(verify);});
window.addEventListener('focus',()=>{if(token&&!busy)void action(persistentMode&&Date.now()>=accessExpiresAt-60000?renewSession:verify);});
window.addEventListener('pagehide',e=>{if(persistentMode&&e.persisted){checking=true;checkMessage='Memeriksa sesi akun…';reset('');}});
window.addEventListener('pageshow',e=>{if(persistentMode&&e.persisted)void action(restoreSession);});
render();
if(persistentMode)void action(restoreSession);
