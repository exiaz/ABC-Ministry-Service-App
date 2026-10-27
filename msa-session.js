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
    const verify=async()=>{
      try{const r=await msaFetch('/api/portal/session',{signal:AbortSignal.timeout(15000)});const allowed=r.ok&&(await r.json()).modules.some(m=>m.href===location.pathname);if(r.status===401||r.ok&&!allowed){document.querySelector('main').hidden=true;location.replace('/');}}catch{/* Existing page requests still fail closed on connectivity loss. */}
    };
    window.addEventListener('focus',verify);
    window.addEventListener('pageshow',e=>{if(e.persisted){document.querySelector('main').hidden=true;location.reload();}});
  }catch{if(redirect)location.replace('/');}
}
