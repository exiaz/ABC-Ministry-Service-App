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
// Kerangka bersama halaman portal: sidebar terang (desktop), navigasi bawah + FAB (ponsel), menu akun, banner pilot.
const spriteHref='/assets/icons/ui-sprite.svg#ui-i-',createKey='msa-can-create',bannerKey='msa-pilot-banner-closed';
const navIcons={'/':'house','/msa-events.html':'clipboard-check','/msa-events.html#kalender':'calendar-days','/msa-core.html':'school','/a1.html':'users','/identity-review.html':'user','/account-recovery.html':'history','/migration-readiness.html':'list-checks','/visual-studio.html':'file-pen','/username.html':'layout-dashboard'};
let navigationMedia,navigationMediaChange,shellCleanup,shellToken=0,createAllowed=false;
const stored=(key,value)=>{try{if(value===undefined)return sessionStorage.getItem(key)==='1';value?sessionStorage.setItem(key,'1'):sessionStorage.removeItem(key);}catch{/* Hanya petunjuk tampilan; server tetap memeriksa izin. */}return false;};
function icon(name,small){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),use=document.createElementNS(ns,'use');
  svg.setAttribute('class','ui-icon'+(small?' ui-icon--sm':''));svg.setAttribute('aria-hidden','true');use.setAttribute('href',spriteHref+name);svg.append(use);return svg;
}
function ensureUiStyles(){
  return Promise.all(['/ui/msa-tokens.css','/ui/msa-components.css'].map(href=>document.querySelector('link[href="'+href+'"]')?undefined:new Promise(resolve=>{
    const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.onload=link.onerror=resolve;document.head.append(link);
  })));
}
function removeShell(){
  shellCleanup?.();shellCleanup=undefined;
  if(navigationMediaChange)navigationMedia.removeEventListener('change',navigationMediaChange);navigationMediaChange=undefined;
  document.getElementById('msa-navigation')?.remove();document.getElementById('msa-skip')?.remove();document.getElementById('msa-pilot-banner')?.remove();document.body.classList.remove('msa-shell-active');
}
export function clearMsaShell(){shellToken++;createAllowed=false;stored(createKey,false);removeShell();}
function updateMsaNavigation(){
  const current=location.pathname==='/'?(location.hash==='#modul'?'/#modul':'/'):location.pathname==='/msa-events.html'&&location.hash==='#kalender'?'/msa-events.html#kalender':location.pathname;
  if(location.hash==='#modul'){const menu=document.getElementById('modul');if(menu)menu.open=true;}
  document.querySelectorAll('#msa-navigation a').forEach(a=>{if(a.getAttribute('href')===current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  const menu=document.getElementById('modul');if(menu)menu.dataset.current=String(Boolean(menu.querySelector('a[aria-current]')));
}
if(typeof window!=='undefined')window.addEventListener('hashchange',updateMsaNavigation);
function navItem(href,label,iconName,extra){
  const a=document.createElement('a'),glyph=document.createElement('span'),text=document.createElement('span');
  a.className='ui-nav__item'+(extra?' '+extra:'');a.href=href;glyph.className='ui-nav__icon msa-nav-icon';glyph.setAttribute('aria-hidden','true');glyph.append(icon(iconName));text.textContent=label;a.append(glyph,text);return a;
}
// Tombol "Buat" hanya muncul bila server menyatakan canCreate; menyembunyikannya bukan kontrol akses.
export function setMsaCreate(allowed){
  createAllowed=allowed===true;stored(createKey,createAllowed);renderCreate();
}
function renderCreate(){
  const nav=document.querySelector('#msa-navigation nav');if(!nav)return;
  const current=document.getElementById('msa-create');
  if(!createAllowed){current?.remove();return;}
  if(current)return;
  const fab=navItem('/msa-events.html#baru','Buat','plus','ui-nav__item--fab');fab.id='msa-create';nav.append(fab);
}
function accountActions(options){
  if(options.accountActions)return options.accountActions;
  const box=document.createElement('div'),refresh=document.createElement('button'),logout=document.createElement('button');box.className='portal-actions';
  refresh.type=logout.type='button';refresh.className='ui-btn ui-btn--tertiary';logout.className='ui-btn ui-btn--secondary';refresh.textContent='Periksa ulang izin';logout.textContent='Keluar';
  refresh.onclick=()=>location.reload();
  logout.onclick=async()=>{
    logout.disabled=true;
    try{const r=await msaFetch('/api/portal/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();window.dispatchEvent(new Event('msa-session-ended'));location.replace('/');}
    catch{logout.disabled=false;logout.textContent='Keluar belum berhasil. Coba lagi.';}
  };
  box.append(refresh,logout);return box;
}
function accountMenu(profile,options){
  const menu=document.createElement('details'),summary=document.createElement('summary'),avatar=document.createElement('span'),who=document.createElement('span'),role=document.createElement('strong'),name=document.createElement('span'),panel=document.createElement('div'),line=document.createElement('p');
  menu.id='msa-account';menu.className='msa-account-menu';summary.setAttribute('aria-label','Menu akun '+profile.username);
  avatar.className='msa-avatar';avatar.setAttribute('aria-hidden','true');avatar.textContent=String(profile.username??'?').replace(/^@/,'').charAt(0).toUpperCase()||'?';
  who.className='msa-account-who';role.textContent=msaRoleLabel(profile.role);name.textContent='@'+profile.username;who.append(role,name);
  const chevron=icon('chevron-down',true);chevron.classList.add('msa-account-chevron');summary.append(avatar,who,chevron);
  panel.className='msa-account-panel';line.className='msa-account-line';line.textContent=msaRoleLabel(profile.role)+' · @'+profile.username;panel.append(line);
  const actions=accountActions(options);
  panel.append(actions);menu.append(summary,panel);return menu;
}
function pilotBanner(){
  if(stored(bannerKey))return undefined;
  const banner=document.createElement('div'),text=document.createElement('span'),close=document.createElement('button');
  banner.id='msa-pilot-banner';banner.className='ui-banner ui-tokens';text.className='ui-banner__text';text.textContent='Pilot lokal · data fiktif';
  close.type='button';close.className='ui-btn ui-btn--icon';close.setAttribute('aria-label','Tutup banner pilot');close.append(icon('x'));
  close.onclick=()=>{stored(bannerKey,true);banner.remove();};banner.append(text,close);return banner;
}
// Navigasi hanya proyeksi modul yang diotorisasi server, bukan otoritas.
// options.accountActions: elemen berisi tombol "Periksa ulang izin" dan "Keluar" milik halaman; dipinjam ke menu akun dan dikembalikan saat shell dilepas.
export async function mountMsaShell(profile,options={}){
  if(!isMsaPortal())return;removeShell();const token=++shellToken;
  await ensureUiStyles();if(token!==shellToken)return;
  const main=document.getElementById('admin-root')??document.querySelector('main');if(!main)return;main.id||='msa-main';main.setAttribute('tabindex','-1');
  const skip=document.createElement('a');skip.id='msa-skip';skip.href='#'+main.id;skip.textContent='Langsung ke isi';
  const shell=document.createElement('aside');shell.id='msa-navigation';shell.className='ui-nav ui-tokens';
  const logo=document.createElement('div');logo.className='msa-shell-brand ui-nav__brand';logo.innerHTML=msaBrand();
  const nav=document.createElement('nav');nav.setAttribute('aria-label','Navigasi utama MSA');
  const events=profile.modules.some(m=>m.href==='/msa-events.html');
  const add=(parent,item)=>parent.append(navItem(item.href,item.label,navIcons[item.href]??'info'));
  const primary=document.createElement('div');primary.className='msa-nav-primary';
  add(primary,{href:'/',label:'Beranda'});if(events){add(primary,{href:'/msa-events.html',label:'Pelayanan'});add(primary,{href:'/msa-events.html#kalender',label:'Kalender'});}nav.append(primary);
  const menu=document.createElement('details');menu.id='modul';menu.className='msa-nav-menu';
  const summary=document.createElement('summary'),summaryIcon=document.createElement('span'),summaryText=document.createElement('span');summary.className='ui-nav__item';summaryIcon.className='ui-nav__icon msa-nav-icon';summaryIcon.setAttribute('aria-hidden','true');summaryIcon.append(icon('layout-dashboard'));summaryText.textContent='Modul';summary.append(summaryIcon,summaryText);menu.append(summary);
  const panel=document.createElement('div');panel.className='msa-nav-panel';menu.append(panel);
  const groups=[['Ruang kerja',['/msa-core.html','/username.html']],['Pengelolaan',['/a1.html','/identity-review.html','/account-recovery.html','/migration-readiness.html','/visual-studio.html']]];
  const remaining=profile.modules.filter(m=>m.href!=='/msa-events.html');menu.hidden=remaining.length===0;
  for(const [title,paths] of groups){const items=remaining.filter(m=>paths.includes(m.href));if(!items.length)continue;const group=document.createElement('div'),heading=document.createElement('p');group.className='msa-nav-group';heading.textContent=title;group.append(heading);items.forEach(item=>add(group,item));panel.append(group);}
  const other=remaining.filter(m=>!groups.some(([,paths])=>paths.includes(m.href)));if(other.length){const group=document.createElement('div');group.className='msa-nav-group';other.forEach(item=>add(group,item));panel.append(group);}
  nav.append(menu);menu.open=matchMedia('(min-width: 900px)').matches||location.hash==='#modul';
  navigationMedia=matchMedia('(min-width: 900px)');navigationMediaChange=()=>{menu.open=navigationMedia.matches;};navigationMedia.addEventListener('change',navigationMediaChange);
  const actions=options.accountActions,home=actions?.parentNode,after=actions?.nextSibling,account=accountMenu(profile,options);
  const close=e=>{if(!account.open)return;if(e.type==='keydown'){if(e.key==='Escape'){account.open=false;account.querySelector('summary').focus();}return;}if(!account.contains(e.target))account.open=false;};
  document.addEventListener('click',close);document.addEventListener('keydown',close);
  shellCleanup=()=>{document.removeEventListener('click',close);document.removeEventListener('keydown',close);if(actions&&home)home.insertBefore(actions,after?.parentNode===home?after:null);};
  const banner=pilotBanner();shell.append(logo,nav,account);
  document.body.prepend(...[skip,shell,banner].filter(Boolean));document.body.classList.add('msa-shell-active');
  createAllowed=stored(createKey);renderCreate();updateMsaNavigation();
}
