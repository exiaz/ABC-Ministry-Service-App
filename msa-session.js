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
    setTimeout(()=>{window.dispatchEvent(new Event('msa-session-ended'));clearMsaShell();document.querySelector('main').hidden=true;location.replace('/');},Math.max(0,profile.expiresAt-Date.now()));
    const verify=async()=>{
      try{const r=await msaFetch('/api/portal/session',{signal:AbortSignal.timeout(15000)});const allowed=r.ok&&(await r.json()).modules.some(m=>m.href===location.pathname);if(r.status===401||r.status===403||r.ok&&!allowed){window.dispatchEvent(new Event('msa-session-ended'));document.querySelector('main').hidden=true;location.replace('/');}}catch{/* Existing page requests still fail closed on connectivity loss. */}
    };
    window.addEventListener('focus',verify);
    window.addEventListener('pageshow',e=>{if(e.persisted){document.querySelector('main').hidden=true;location.reload();}});
  }catch{if(redirect)location.replace('/');}
}

export const msaRoleLabel=role=>({superadmin:'Superadmin',admin:'Admin',pic:'Admin',volunteer:'Mentor / Volunteer'}[role]??'Akun pelayanan');
let navigationMedia, navigationMediaChange;
export function clearMsaShell(){
  if(navigationMediaChange)navigationMedia.removeEventListener('change',navigationMediaChange);navigationMediaChange=undefined;
  document.getElementById('msa-navigation')?.remove();document.getElementById('msa-skip')?.remove();document.body.classList.remove('msa-shell-active');
}
function updateMsaNavigation(){
  const current=location.pathname==='/'?(location.hash==='#modul'?'/#modul':'/'):location.pathname==='/msa-events.html'&&location.hash==='#kalender'?'/msa-events.html#kalender':location.pathname;
  if(location.hash==='#modul'){const menu=document.getElementById('modul');if(menu)menu.open=true;}
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
  const icons={'/':'⌂','/msa-events.html':'▤','/msa-events.html#kalender':'▦','/msa-core.html':'◇','/a1.html':'♙','/identity-review.html':'✓','/account-recovery.html':'↻','/migration-readiness.html':'≡','/username.html':'▣'};
  const add=(parent,item)=>{const a=document.createElement('a'),icon=document.createElement('span'),label=document.createElement('span');a.href=item.href;icon.className='msa-nav-icon';icon.setAttribute('aria-hidden','true');icon.textContent=icons[item.href]??'•';label.textContent=item.label;a.append(icon,label);parent.append(a);};
  const primary=document.createElement('div');primary.className='msa-nav-primary';
  add(primary,{href:'/',label:'Beranda'});if(events){add(primary,{href:'/msa-events.html',label:'Pelayanan'});add(primary,{href:'/msa-events.html#kalender',label:'Kalender'});}nav.append(primary);
  const menu=document.createElement('details');menu.id='modul';menu.className='msa-nav-menu';
  const summary=document.createElement('summary');summary.textContent='Modul';menu.append(summary);
  const panel=document.createElement('div');panel.className='msa-nav-panel';menu.append(panel);
  const groups=[['Ruang kerja',['/msa-core.html','/username.html']],['Pengelolaan',['/a1.html','/identity-review.html','/account-recovery.html','/migration-readiness.html','/visual-studio.html']]];
  const remaining=profile.modules.filter(m=>m.href!=='/msa-events.html');menu.hidden=remaining.length===0;
  for(const [title,paths] of groups){const items=remaining.filter(m=>paths.includes(m.href));if(!items.length)continue;const group=document.createElement('div'),heading=document.createElement('p');group.className='msa-nav-group';heading.textContent=title;group.append(heading);items.forEach(item=>add(group,item));panel.append(group);}
  const other=remaining.filter(m=>!groups.some(([,paths])=>paths.includes(m.href)));if(other.length){const group=document.createElement('div');group.className='msa-nav-group';other.forEach(item=>add(group,item));panel.append(group);}
  nav.append(menu);menu.open=matchMedia('(min-width: 900px)').matches||location.hash==='#modul';
  navigationMedia=matchMedia('(min-width: 900px)');navigationMediaChange=()=>{menu.open=navigationMedia.matches;};navigationMedia.addEventListener('change',navigationMediaChange);
  const local=document.createElement('p');local.className='msa-shell-local';local.textContent='Uji lokal · data fiktif';shell.append(logo,brand,account,nav,local);
  document.body.prepend(skip,shell);document.body.classList.add('msa-shell-active');
  updateMsaNavigation();
}
