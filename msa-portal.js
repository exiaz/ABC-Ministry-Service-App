import {msaBrand} from './msa-brand.js';
import {msaFetch,mountMsaShell,clearMsaShell,setMsaCreate,msaRoleLabel,serviceCardHtml,uiEsc} from './msa-session.js';
import {mountVisuals} from './msa-visual.js';
const $=id=>document.getElementById(id);
$('portal-brand').innerHTML=msaBrand();
void mountVisuals();
let busy=false,expiry,generation=0;
const note=text=>{$('portal-feedback').textContent=text;};
function route(){
  if(!$('portal-workspace').hidden)return;
  const login=location.hash==='#masuk'||location.hash==='#portal-login';
  $('portal-welcome').hidden=login;$('portal-heading').hidden=!login;$('portal-login').hidden=!login;document.body.dataset.authScreen=login?'login':'welcome';
  document.title='ABC Ministry Service App | '+(login?'Masuk':'Selamat datang');
}
function clear(){
  if(!$('portal-workspace').hidden)history.replaceState(null,'',location.pathname+'#masuk');
  generation++;clearTimeout(expiry);clearMsaShell();
  $('portal-workspace').hidden=true;$('portal-account').textContent='';$('portal-personal').hidden=true;
  $('portal-schedule').replaceChildren();$('portal-stats').replaceChildren();$('portal-services').hidden=true;$('portal-new').hidden=true;
  $('portal-title').textContent='Selamat datang kembali';$('portal-eyebrow').textContent='SELAMAT DATANG';$('portal-back').hidden=false;
  $('portal-intro').textContent='Masuk untuk melihat jadwal dan ruang pelayanan Anda.';
  $('portal-local').hidden=false;$('portal-password').value='';route();
  $('portal-password').type='password';$('portal-show').textContent='Tampilkan';$('portal-show').setAttribute('aria-label','Tampilkan kata sandi');$('portal-show').setAttribute('aria-pressed','false');
}
async function show(profile){
  const current=++generation;clearTimeout(expiry);
  $('portal-login').hidden=true;$('portal-welcome').hidden=true;$('portal-heading').hidden=false;$('portal-back').hidden=true;$('portal-workspace').hidden=false;$('portal-local').hidden=true;delete document.body.dataset.authScreen;
  $('portal-title').textContent='Beranda';$('portal-eyebrow').textContent=msaRoleLabel(profile.role);
  $('portal-intro').textContent='Selamat melayani. Mulai dari jadwal atau ruang pelayanan Anda.';$('portal-account').textContent='@'+profile.username;
  document.title='ABC Ministry Service App | Beranda';void mountMsaShell(profile,{accountActions:$('portal-actions')});
  const modules=profile.modules;
  note(modules.length?'':'Belum ada modul pengelolaan yang diizinkan. Hubungi Admin.');
  $('portal-personal').hidden=modules.length>0;
  expiry=setTimeout(()=>{clear();note('Sesi berakhir. Masuk kembali.');},Math.max(0,profile.expiresAt-Date.now()));
  if(!modules.some(m=>m.href==='/msa-events.html')){setMsaCreate(false);return;}
  $('portal-services').hidden=false;$('portal-service-state').textContent='Memuat jadwal pelayanan…';$('portal-schedule').replaceChildren();$('portal-stats').replaceChildren();$('portal-new').hidden=true;
  try{
    const r=await request('dispatch/api/stage9b2/dashboard');if(current!==generation)return;
    const canCreate=r.organizations.some(o=>o.canCreate);$('portal-new').hidden=!canCreate;setMsaCreate(canCreate);
    $('portal-service-state').textContent='Jadwal mendatang dalam '+r.horizonDays+' hari.';
    const groups=[['Mendatang',r.upcoming,'Belum ada pelayanan terbit mendatang.',''],['Tanggung jawab Anda',r.assigned,'Belum ada pelayanan yang menugaskan Anda.','yellow'],['Draf perlu ditinjau',r.drafts,'Tidak ada draf yang perlu Anda tindak lanjuti.','blue']];
    // Ubin hanya menghitung baris yang sudah dikirim API beranda; tidak ada angka lain.
    $('portal-stats').innerHTML=groups.map(([title,rows,,tone])=>'<div class="ui-stat'+(tone?' ui-stat--'+tone:'')+'"><p class="ui-stat__value">'+rows.length+'</p><p class="ui-stat__label">'+uiEsc(title)+'</p></div>').join('');
    $('portal-schedule').replaceChildren(...groups.map(([title,rows,empty])=>{
      const section=document.createElement('section'),heading=document.createElement('h3');heading.textContent=title;section.append(heading);
      if(!rows.length){const p=document.createElement('p');p.className='msa-empty';p.textContent=empty;section.append(p);}
      section.insertAdjacentHTML('beforeend',rows.slice(0,2).map(row=>serviceCardHtml(row,{className:'portal-event',action:'<a class="ui-btn ui-btn--tertiary" href="/msa-events.html#'+uiEsc(new URLSearchParams({organization:row.organizationId,event:row.id}))+'">Lihat pelayanan<span class="ui-sr-only"> '+uiEsc(row.name)+'</span></a>'})).join(''));
      if(rows.length>2){const a=document.createElement('a');a.className='ui-btn ui-btn--text';a.href='/msa-events.html';a.textContent='Lihat semua '+rows.length+' pelayanan';section.append(a);}
      return section;
    }));
  }catch(e){if(current===generation){setMsaCreate(false);}if(current===generation)$('portal-service-state').textContent='Jadwal belum dapat dimuat. '+e.message+' Gunakan Periksa ulang izin untuk mencoba kembali.';}

}
async function request(path,body){
  const r=await msaFetch('/api/portal/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)}),v=await r.json();
  if(!r.ok){if(r.status===401)clear();throw Error(v.error??'Permintaan belum berhasil.');}return v;
}
async function action(fn){
  if(busy)return;busy=true;$('portal-login').setAttribute('aria-busy','true');$('portal-workspace').setAttribute('aria-busy','true');
  document.querySelectorAll('main button,#msa-account button').forEach(n=>n.disabled=true);$('portal-submit').textContent='Memeriksa…';
  try{await fn();}catch(e){note(e.name==='TimeoutError'||e instanceof TypeError?'Koneksi belum tersedia. Coba lagi.':e.message);$('portal-feedback').focus();}
  finally{busy=false;document.querySelectorAll('main button,#msa-account button').forEach(n=>n.disabled=false);$('portal-submit').textContent='Masuk';$('portal-login').setAttribute('aria-busy','false');$('portal-workspace').setAttribute('aria-busy','false');}
}
$('portal-show').onclick=()=>{const show=$('portal-password').type==='password';$('portal-password').type=show?'text':'password';$('portal-show').textContent=show?'Sembunyikan':'Tampilkan';$('portal-show').setAttribute('aria-label',show?'Sembunyikan kata sandi':'Tampilkan kata sandi');$('portal-show').setAttribute('aria-pressed',String(show));};
$('portal-login').onsubmit=e=>{e.preventDefault();void action(async()=>{note('Memeriksa akun dan izin…');let password=$('portal-password').value;$('portal-password').value='';try{await show(await request('login',{username:$('portal-username').value,password}));note('');}finally{password='';}});};
$('portal-refresh').onclick=()=>void action(async()=>{clear();await show(await request('session'));});
$('portal-logout').onclick=()=>void action(async()=>{await request('logout',{});clear();note('Anda sudah keluar.');});
const link=document.createElement('a');link.href=document.body.dataset.mentorOrigin+'/';link.textContent='Buka akun Mentor / Volunteer';$('portal-mentor').append(link);
const mentorEntry=link.cloneNode(true);mentorEntry.textContent='Masuk sebagai Mentor';$('portal-mentor-entry').append(mentorEntry);
const mentorLogin=mentorEntry.cloneNode(true);$('portal-mentor-login').append(mentorLogin);
const personal=link.cloneNode(true);$('portal-personal').append('Untuk akses Mentor, masuk kembali di halaman perangkat. Aktivasi dan bukti kunci tetap wajib. ',personal);
void action(async()=>{try{await show(await request('session'));}catch{clear();note('Gunakan username dan kata sandi akun fiktif Anda.');}});
window.addEventListener('focus',()=>{if(!$('portal-workspace').hidden)void action(async()=>{await show(await request('session'));});});
window.addEventListener('pageshow',e=>{if(e.persisted){clear();void action(async()=>show(await request('session')));}});
window.addEventListener('hashchange',()=>{route();note('');if($('portal-workspace').hidden)$(location.hash==='#masuk'||location.hash==='#portal-login'?'portal-title':'welcome-title').focus();});
