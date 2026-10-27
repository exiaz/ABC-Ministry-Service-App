import {msaBrand} from './msa-brand.js';
import {msaFetch} from './msa-session.js';
const $=id=>document.getElementById(id);$('portal-brand').innerHTML=msaBrand();let busy=false;
const note=text=>{$('portal-feedback').textContent=text;};
function clear(){ $('portal-workspace').hidden=true;$('portal-modules').replaceChildren();$('portal-account').textContent='';$('portal-title').textContent='Masuk MSA';$('portal-login').hidden=false;}
function show(profile){
  $('portal-login').hidden=true;$('portal-workspace').hidden=false;$('portal-title').textContent=profile.role==='pic'?'Pelayanan Anda':'Beranda MSA';$('portal-account').textContent='@'+profile.username;
  $('portal-modules').replaceChildren(...profile.modules.map(m=>{const a=document.createElement('a');a.href=m.href;a.textContent=m.label;a.className='secondary';return a;}));
  note(profile.modules.length?'Pilih modul sesuai izin Anda.':'Belum ada modul pengelolaan yang diizinkan. Hubungi peninjau.');
}
async function request(path,body){const r=await msaFetch('/api/portal/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)}),v=await r.json();if(!r.ok){if(r.status===401)clear();throw Error(v.error??'Permintaan belum berhasil.');}return v;}
async function action(fn){if(busy)return;busy=true;$('portal-login').setAttribute('aria-busy','true');document.querySelectorAll('button').forEach(n=>n.disabled=true);try{await fn();}catch(e){note(e.name==='TimeoutError'||e instanceof TypeError?'Koneksi belum tersedia. Coba lagi.':e.message);$('portal-feedback').focus();}finally{busy=false;document.querySelectorAll('button').forEach(n=>n.disabled=false);$('portal-login').setAttribute('aria-busy','false');}}
$('portal-show').onclick=()=>{const show=$('portal-password').type==='password';$('portal-password').type=show?'text':'password';$('portal-show').textContent=show?'Sembunyikan kata sandi':'Tampilkan kata sandi';$('portal-show').setAttribute('aria-pressed',String(show));};
$('portal-login').onsubmit=e=>{e.preventDefault();void action(async()=>{note('Memeriksa akun dan izin…');let password=$('portal-password').value;$('portal-password').value='';try{show(await request('login',{username:$('portal-username').value,password}));}finally{password='';}});};
$('portal-refresh').onclick=()=>void action(async()=>{clear();show(await request('session'));});
$('portal-logout').onclick=()=>void action(async()=>{await request('logout',{});clear();note('Anda sudah keluar.');});
const mentor=$('portal-mentor'),link=document.createElement('a');link.href=document.body.dataset.mentorOrigin+'/';link.textContent='Masuk Mentor / aktivasi perangkat';mentor.append(link);
void action(async()=>{try{show(await request('session'));}catch{clear();note('Gunakan username dan kata sandi akun fiktif Anda.');}});
window.addEventListener('focus',()=>{if(!$('portal-workspace').hidden)void action(async()=>{clear();show(await request('session'));});});
window.addEventListener('pageshow',e=>{if(e.persisted){clear();void action(async()=>show(await request('session')));}});
