import {msaBrand} from './msa-brand.js';
// This marker only controls local UI state. It is never accepted as a bearer;
// the opt-in launcher server authenticates its HttpOnly cookie independently.
export const portalMarker='portal-session';
export const isMsaPortal=()=>typeof document!=='undefined'&&document.body.dataset.msaPortal==='true';
export async function msaFetch(path,options={}){
  if(!isMsaPortal())return fetch(path,options);
  const url=new URL(path,location.href);
  if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))return fetch(path,options);
  const headers=new Headers(options.headers);
  if(headers.get('Authorization')==='Bearer '+portalMarker)headers.delete('Authorization');
  if(headers.has('Authorization'))return fetch(path,options);
  // Public submission must not require a management session.
  if(['/api/a2-2/register','/api/a2-4b/request','/api/a2-4b/reset'].includes(url.pathname))return fetch(path,options);
  if(['/api/a1/logout','/api/admin/logout'].includes(url.pathname))path='/api/portal/logout';
  if(url.pathname==='/api/a1/login')path='/api/portal/login';
  if(!String(path).startsWith('/api/portal/'))path='/api/portal/dispatch'+url.pathname+url.search;
  headers.set('X-MSA-Portal','1');
  const response=await fetch(path,{...options,headers,credentials:'same-origin',cache:'no-store',redirect:'error'});
  if(url.pathname==='/api/a1/login'&&response.ok){const profile=await response.json();return new Response(JSON.stringify({...profile,token:portalMarker}),{status:200,headers:{'Content-Type':'application/json'}});}
  return response;
}
export async function resumeMsaSession(ready,{redirect=true}={}){
  if(!isMsaPortal())return;
  try{
    const response=await msaFetch('/api/portal/session',{signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error();
    const profile=await response.json();
    if(location.pathname!=='/'&&!profile.modules.some(m=>m.href===location.pathname)){
      if(redirect)location.replace('/');return;
    }
    await ready(profile,portalMarker);
    mountMsaShell(profile);
    setTimeout(()=>{clearMsaShell();document.querySelector('main').hidden=true;location.replace('/');},Math.max(0,profile.expiresAt-Date.now()));
    const verify=async()=>{
      try{const r=await msaFetch('/api/portal/session',{signal:AbortSignal.timeout(15000)});const allowed=r.ok&&(await r.json()).modules.some(m=>m.href===location.pathname);if(r.status===401||r.ok&&!allowed){document.querySelector('main').hidden=true;location.replace('/');}}catch{/* Existing page requests still fail closed on connectivity loss. */}
    };
    window.addEventListener('focus',verify);
    window.addEventListener('pageshow',e=>{if(e.persisted){document.querySelector('main').hidden=true;location.reload();}});
  }catch{if(redirect)location.replace('/');}
}

export const msaRoleLabel=role=>({superadmin:'Superadmin',admin:'Admin',pic:'Admin',volunteer:'Mentor / Volunteer'}[role]??'Akun pelayanan');
export function clearMsaShell(){
  document.getElementById('msa-navigation')?.remove();document.getElementById('msa-skip')?.remove();document.body.classList.remove('msa-shell-active');
}
function updateMsaNavigation(){
  const current=location.pathname==='/'?(location.hash==='#modul'?'/#modul':'/'):location.pathname==='/msa-events.html'&&location.hash==='#kalender'?'/msa-events.html#kalender':location.pathname;
  document.querySelectorAll('#msa-navigation a').forEach(a=>{if(a.getAttribute('href')===current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
}
if(typeof window!=='undefined')window.addEventListener('hashchange',updateMsaNavigation);
// Navigation is a projection of server-authorized modules, never an authority.
export function mountMsaShell(profile){
  if(!isMsaPortal())return;clearMsaShell();
  const main=document.getElementById('admin-root')??document.querySelector('main');if(!main)return;main.id||='msa-main';main.setAttribute('tabindex','-1');
  const skip=document.createElement('a');skip.id='msa-skip';skip.href='#'+main.id;skip.textContent='Langsung ke isi';
  const shell=document.createElement('aside');shell.id='msa-navigation';
  const logo=document.createElement('div');logo.className='msa-shell-brand';logo.innerHTML=msaBrand();
  const brand=document.createElement('p');brand.className='msa-shell-name';brand.textContent='ABC Ministry Service App';
  const account=document.createElement('p');account.className='msa-shell-account';account.textContent=msaRoleLabel(profile.role)+' · @'+profile.username;
  const nav=document.createElement('nav');nav.setAttribute('aria-label','Navigasi utama MSA');
  const events=profile.modules.some(m=>m.href==='/msa-events.html');
  const entries=[{href:'/',label:'Beranda'},...(events?[{href:'/msa-events.html',label:'Pelayanan'},{href:'/msa-events.html#kalender',label:'Kalender'}]:[]),{href:'/#modul',label:'Modul'}];
  const add=(item,extra=false)=>{const a=document.createElement('a');a.href=item.href;a.textContent=item.label;if(extra)a.className='msa-extra-module';
    if(location.pathname===item.href.split('#')[0]&&(item.href.includes('#')?location.hash===('#'+item.href.split('#')[1]):!location.hash))a.setAttribute('aria-current','page');nav.append(a);};
  entries.forEach(item=>add(item));profile.modules.filter(m=>m.href!=='/msa-events.html').forEach(item=>add(item,true));
  const local=document.createElement('p');local.className='msa-shell-local';local.textContent='Uji lokal · data fiktif';shell.append(logo,brand,account,nav,local);
  document.body.prepend(skip,shell);document.body.classList.add('msa-shell-active');
  updateMsaNavigation();
}
