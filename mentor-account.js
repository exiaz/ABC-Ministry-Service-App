import {msaBrand} from './msa-brand.js';
import {createPairingClient} from './pairing-client.js';
import {createSecureMentor} from './secure-mentor.js';
import {createAccountDevicesUI} from './account-devices-ui.js';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=document.querySelector('meta[name="abc-api-origin"]').content;
const devicesUI=createAccountDevicesUI({root:$('account-device-management'),request:(path,body)=>request(path,body),base:()=> 'devices',changed:()=>verify()});devicesUI.reset();
let token='',profile=null,busy=false,message='',generation=0,wasActive=false,modalHandler,devicesOpen=false;
$('account-brand').innerHTML=msaBrand();
if(document.body.dataset.adminOrigin){const home=document.createElement('a');home.href=document.body.dataset.adminOrigin+'/';home.className='btn';home.textContent='Beranda aplikasi';$('account-brand').append(home);}
$('account-show-password').onclick=()=>{const show=$('account-password').type==='password';$('account-password').type=show?'text':'password';$('account-show-password').textContent=show?'Sembunyikan kata sandi':'Tampilkan kata sandi';$('account-show-password').setAttribute('aria-pressed',String(show));};
const closeModal=()=>{$('account-modal').close();modalHandler=undefined;};
const icon=name=>{const paths={check:'m5 12 4 4L19 6',back:'m14 6-6 6 6 6M8 12h13',arrow:'m10 6 6 6-6 6M3 12h13',more:'M5 12h1m5 0h1m5 0h1',search:'m16 16 5 5M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14',edit:'m4 16 12-12 4 4-12 12H4z',calendar:'M4 5h16v15H4zM4 10h16M8 2v6m8-6v6',users:'M6 21v-4h12v4M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0'};return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]??paths.arrow}"/></svg>`;};
const client=createPairingClient(api,state=>{
  if(!token)return;
  if(state.phase==='active'&&!wasActive){wasActive=true;void secure.refresh();}
  if(state.phase!=='active'){wasActive=false;secure.reset();}
  render();
},{personalSession:()=>token});
const secure=createSecureMentor({client,render,icon,personal:true,steps:()=>'',art:()=>'',closeModal,openModal:(title,body,buttons,handler)=>{$('account-modal-title').textContent=title;$('account-modal-form').innerHTML=body+'<div class="modal-actions">'+buttons+'</div>';modalHandler=handler;$('account-modal').showModal();}});
function reset(text){generation++;token='';profile=null;wasActive=false;secure.reset();client.resetAccount();message=text;render();}
async function request(path,body){
  const response=await fetch(api+'/api/a2-3/'+path,{method:body===undefined?'GET':'POST',credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000),headers:{'Content-Type':'application/json',...(token?{'X-MSA-Session':'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const value=await response.json();if(!response.ok){if([401,403].includes(response.status)&&token)reset('Akses akun atau penugasan tidak berlaku. Masuk kembali atau hubungi Admin.');throw Error(value.error??'Permintaan belum dapat diproses.');}return value;
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
  $('account-login').hidden=!!token;$('account-profile').hidden=!token;$('account-feedback').textContent=message;
  $('account-device').hidden=!token;$('account-attendance').hidden=true;
  if(!token){$('account-name').textContent='';$('account-groups').replaceChildren();$('account-device').replaceChildren();$('account-attendance').replaceChildren();return;}
  $('account-name').textContent=profile.fullName;
  $('account-groups').innerHTML=profile.groups.map(g=>`<article class="account-group"><p class="eyebrow">KELOMPOK UTAMA</p><h2>${esc(g.groupName)}</h2><p class="mentor-subtitle">${esc(g.mentorName)}</p><p>${esc(g.schoolName)} · ${esc(new Date(g.serviceDate+'T12:00:00+07:00').toLocaleDateString('id-ID',{dateStyle:'long',timeZone:'Asia/Jakarta'}))}</p></article>`).join('')||'<p>Belum ada penugasan yang sesuai. Hubungi Admin sebelum mengaktifkan perangkat.</p>';
  const state=client.state,offline=!navigator.onLine;
  if(offline){$('account-device').innerHTML='<section class="panel" role="status"><h2>Anda sedang offline</h2><p>Hubungkan internet atau jaringan lokal, lalu periksa akses kembali. Absensi tidak dikirim atau disimpan otomatis saat offline.</p></section>';return;}
  if(!profile.groups.length){$('account-device').innerHTML='';return;}
  if(state.phase==='active'){
    $('account-device').innerHTML='<p class="info-box" role="status">Perangkat dan akun terverifikasi untuk pelayanan ini.</p>';$('account-attendance').hidden=devicesOpen;$('account-attendance').innerHTML=secure.view();return;
  }
  const checking=['checking','pairing','associating'].includes(state.phase);
  $('account-device').innerHTML=`<section class="panel"><h2>${state.phase==='association-required'?'Gunakan perangkat berizin ini':checking?'Memeriksa perangkat…':'Aktivasi perangkat diperlukan'}</h2><p role="status" aria-live="polite">${esc(state.message)}</p>${state.phase==='association-required'?'<button class="btn primary" data-account-action="associate">Gunakan perangkat ini</button>':checking?'':`<p>Minta kode sekali pakai kepada Admin untuk penugasan di atas. Setiap perangkat memerlukan aktivasi sendiri.</p><form id="account-activation"><label for="account-code">Kode aktivasi<input id="account-code" type="password" required maxlength="22" autocomplete="off" autocapitalize="none" spellcheck="false"></label><button class="btn primary">Aktifkan perangkat</button></form>`}<div class="pairing-actions"><button class="btn" data-account-action="verify" ${checking?'disabled':''}>Periksa akses</button>${!checking?'<button class="btn" data-account-action="remove">Hapus izin lokal perangkat</button>':''}</div></section>`;
}
async function action(fn){if(busy)return;busy=true;try{await fn();}catch(e){message=e.name==='TimeoutError'||e instanceof TypeError?'Koneksi belum tersedia. Periksa jaringan lalu coba lagi.':e.message;secure.reset();render();}finally{busy=false;}}
$('account-login-form').onsubmit=e=>{e.preventDefault();void action(async()=>{
  const current=++generation,username=$('account-username').value,password=$('account-password').value;$('account-password').value='';$('account-login-form').querySelector('button[type=submit]').disabled=true;
  $('account-password').type='password';$('account-show-password').textContent='Tampilkan kata sandi';$('account-show-password').setAttribute('aria-pressed','false');
  try{const p=await request('login',{username,password});if(current!==generation)return;if(!validProfile(p)||!/^[-\w]{43}$/.test(p.token??''))throw Error('Respons akun belum dapat diperiksa.');profile=p;token=p.token;message='';render();await client.restore();}
  finally{$('account-login-form').querySelector('button[type=submit]').disabled=false;}
});};
$('account-logout').onclick=()=>void action(async()=>{await request('logout',{});reset('Anda telah keluar. Izin perangkat tetap memerlukan login akun yang sah.');});
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
window.addEventListener('offline',()=>{secure.reset();message='Koneksi terputus. Periksa akses kembali setelah terhubung.';render();});
window.addEventListener('online',()=>{if(token)void action(verify);});
window.addEventListener('focus',()=>{if(token&&!busy)void action(verify);});
render();
