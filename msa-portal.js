import {msaBrand} from './msa-brand.js';
import {msaFetch,mountMsaShell,clearMsaShell,msaRoleLabel} from './msa-session.js';
import {mountVisuals} from './msa-visual.js';
const $=id=>document.getElementById(id);
$('portal-brand').innerHTML=msaBrand();
void mountVisuals();
let busy=false,expiry,generation=0;
const note=text=>{$('portal-feedback').textContent=text;};
function clear(){
  generation++;clearTimeout(expiry);clearMsaShell();
  $('portal-workspace').hidden=true;$('portal-account').textContent='';$('portal-personal').hidden=true;
  $('portal-schedule').replaceChildren();$('portal-services').hidden=true;$('portal-new').hidden=true;
  $('portal-title').textContent='ABC Ministry Service App';$('portal-eyebrow').textContent='SELAMAT DATANG';
  $('portal-intro').textContent='Masuk untuk melihat jadwal dan mengelola pelayanan Anda.';
  $('portal-login').hidden=false;$('portal-welcome').hidden=false;$('portal-local').hidden=false;$('portal-password').value='';
  $('portal-password').type='password';$('portal-show').textContent='Tampilkan kata sandi';$('portal-show').setAttribute('aria-pressed','false');
  document.title='ABC Ministry Service App | Masuk';
}
async function show(profile){
  const current=++generation;clearTimeout(expiry);
  $('portal-login').hidden=true;$('portal-welcome').hidden=true;$('portal-workspace').hidden=false;$('portal-local').hidden=true;
  $('portal-title').textContent='Beranda';$('portal-eyebrow').textContent=msaRoleLabel(profile.role);
  $('portal-intro').textContent='Selamat melayani. Mulai dari jadwal atau ruang pelayanan Anda.';$('portal-account').textContent='@'+profile.username;
  document.title='ABC Ministry Service App | Beranda';mountMsaShell(profile);
  const modules=profile.modules;
  note(modules.length?'':'Belum ada modul pengelolaan yang diizinkan. Hubungi Admin.');
  $('portal-personal').hidden=modules.length>0;
  expiry=setTimeout(()=>{clear();note('Sesi berakhir. Masuk kembali.');},Math.max(0,profile.expiresAt-Date.now()));
  if(!modules.some(m=>m.href==='/msa-events.html'))return;
  $('portal-services').hidden=false;$('portal-service-state').textContent='Memuat jadwal pelayanan…';$('portal-schedule').replaceChildren();$('portal-new').hidden=true;
  try{
    const r=await request('dispatch/api/stage9b2/dashboard');if(current!==generation)return;
    $('portal-new').hidden=!r.organizations.some(o=>o.canCreate);
    $('portal-service-state').textContent='Jadwal mendatang dalam '+r.horizonDays+' hari.';
    const groups=[['Mendatang',r.upcoming,'Belum ada pelayanan terbit mendatang.'],['Tanggung jawab Anda',r.assigned,'Belum ada pelayanan yang menugaskan Anda.'],['Draf perlu ditinjau',r.drafts,'Tidak ada draf yang perlu Anda tindak lanjuti.']];
    $('portal-schedule').replaceChildren(...groups.map(([title,rows,empty])=>{
      const section=document.createElement('section'),heading=document.createElement('h3');heading.textContent=title;section.append(heading);
      if(!rows.length){const p=document.createElement('p');p.className='msa-empty';p.textContent=empty;section.append(p);}
      for(const row of rows.slice(0,2)){
        const card=document.createElement('article'),date=document.createElement('div'),day=document.createElement('strong'),month=document.createElement('span'),content=document.createElement('div'),status=document.createElement('p'),name=document.createElement('h4'),venue=document.createElement('p'),a=document.createElement('a');
        const eventDate=new Date(row.startDate+'T12:00:00Z');
        card.className='portal-event';date.className='portal-date';day.textContent=eventDate.toLocaleDateString('id-ID',{timeZone:'UTC',day:'numeric'});month.textContent=eventDate.toLocaleDateString('id-ID',{timeZone:'UTC',month:'short'});date.append(day,month);
        content.className='portal-event-content';status.className='msa-event-date';status.textContent=(row.status==='draft'?'Draf':'Terbit')+' · '+row.startTime+' · '+row.timezone;
        name.textContent=row.name;venue.textContent=row.organizationName+' · '+row.venue;
        a.href='/msa-events.html#'+new URLSearchParams({organization:row.organizationId,event:row.id});a.textContent='Lihat pelayanan →';content.append(status,name,venue,a);card.append(date,content);section.append(card);
      }
      if(rows.length>2){const a=document.createElement('a');a.href='/msa-events.html';a.textContent='Lihat semua '+rows.length+' pelayanan';section.append(a);}
      return section;
    }));
  }catch(e){if(current===generation)$('portal-service-state').textContent='Jadwal belum dapat dimuat. '+e.message+' Gunakan Periksa ulang izin untuk mencoba kembali.';}

}
async function request(path,body){
  const r=await msaFetch('/api/portal/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)}),v=await r.json();
  if(!r.ok){if(r.status===401)clear();throw Error(v.error??'Permintaan belum berhasil.');}return v;
}
async function action(fn){
  if(busy)return;busy=true;$('portal-login').setAttribute('aria-busy','true');$('portal-workspace').setAttribute('aria-busy','true');
  document.querySelectorAll('main button').forEach(n=>n.disabled=true);$('portal-submit').textContent='Memeriksa…';
  try{await fn();}catch(e){note(e.name==='TimeoutError'||e instanceof TypeError?'Koneksi belum tersedia. Coba lagi.':e.message);$('portal-feedback').focus();}
  finally{busy=false;document.querySelectorAll('main button').forEach(n=>n.disabled=false);$('portal-submit').textContent='Masuk';$('portal-login').setAttribute('aria-busy','false');$('portal-workspace').setAttribute('aria-busy','false');}
}
$('portal-show').onclick=()=>{const show=$('portal-password').type==='password';$('portal-password').type=show?'text':'password';$('portal-show').textContent=show?'Sembunyikan kata sandi':'Tampilkan kata sandi';$('portal-show').setAttribute('aria-pressed',String(show));};
$('portal-login').onsubmit=e=>{e.preventDefault();void action(async()=>{note('Memeriksa akun dan izin…');let password=$('portal-password').value;$('portal-password').value='';try{await show(await request('login',{username:$('portal-username').value,password}));note('');}finally{password='';}});};
$('portal-refresh').onclick=()=>void action(async()=>{clear();await show(await request('session'));});
$('portal-logout').onclick=()=>void action(async()=>{await request('logout',{});clear();note('Anda sudah keluar.');});
const link=document.createElement('a');link.href=document.body.dataset.mentorOrigin+'/';link.textContent='Buka akun Mentor / Volunteer';$('portal-mentor').append(link);
const mentorEntry=link.cloneNode(true);mentorEntry.textContent='Masuk sebagai Mentor';$('portal-mentor-entry').append(mentorEntry);
const personal=link.cloneNode(true);$('portal-personal').append('Untuk akses Mentor, masuk kembali di halaman perangkat. Aktivasi dan bukti kunci tetap wajib. ',personal);
void action(async()=>{try{await show(await request('session'));}catch{clear();note('Gunakan username dan kata sandi akun fiktif Anda.');}});
window.addEventListener('focus',()=>{if(!$('portal-workspace').hidden)void action(async()=>{clear();await show(await request('session'));});});
window.addEventListener('pageshow',e=>{if(e.persisted){clear();void action(async()=>show(await request('session')));}});
