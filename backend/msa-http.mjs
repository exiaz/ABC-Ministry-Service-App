import {requireAdminOrigin} from './admin-session-http.mjs';
import {fail} from './msa-accounts.mjs';

async function json(req,limit=4096){
  if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type']??''))fail(400,'Permintaan harus berupa JSON.');
  const chunks=[];let size=0;req.setTimeout(5000,()=>req.destroy());
  try{for await(const chunk of req.iterator({destroyOnReturn:false})){size+=chunk.length;if(size>limit){req.resume();fail(413,'Permintaan akun terlalu besar.');}chunks.push(chunk);}}finally{req.setTimeout(0);}
  let value;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail(400,'JSON tidak valid.');}
  if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Data akun tidak valid.');return value;
}
export async function msaRoute({req,url,authorization,local,adminAuthentication,send}){
  const intake=url.pathname.startsWith('/api/a2-2/');
  const lifecycle=url.pathname.startsWith('/api/a2-4/');
  const recovery=url.pathname.startsWith('/api/a2-4b/');
  const migration=url.pathname.startsWith('/api/a2-4c/');
  const core=url.pathname.startsWith('/api/stage8/');
  const events=url.pathname.startsWith('/api/stage9a/');
  const calendar=url.pathname.startsWith('/api/stage9b1/');
  const scheduling=url.pathname.startsWith('/api/stage9b2/');
  const visual=url.pathname.startsWith('/api/visual/');
  if(!url.pathname.startsWith('/api/a1/')&&!intake&&!lifecycle&&!recovery&&!migration&&!core&&!events&&!calendar&&!scheduling&&!visual)return false;
  const a1=adminAuthentication?.a1;
  if(!a1||!local){send(404,{error:'Tidak ditemukan.'});return true;}
  requireAdminOrigin(req);
  const path=url.pathname;
  if(visual){if(!a1.visual){send(404,{error:'Tidak ditemukan.'});return true;}a1.visual.enabled();}
  if(scheduling){if(!a1.scheduling){send(404,{error:'Tidak ditemukan.'});return true;}a1.scheduling.enabled();}
  if(calendar){if(!a1.calendar){send(404,{error:'Tidak ditemukan.'});return true;}a1.calendar.enabled();}
  if(events){if(!a1.events){send(404,{error:'Tidak ditemukan.'});return true;}a1.events.enabled();}
  if(core){if(!a1.core){send(404,{error:'Tidak ditemukan.'});return true;}a1.core.enabled();}
  if(migration){if(!a1.migration){send(404,{error:'Tidak ditemukan.'});return true;}a1.migration.enabled();if(url.search||req.method!=='GET'||path!=='/api/a2-4c/preflight')fail(405,'Preflight hanya mendukung pembacaan tanpa parameter.');}
  if(recovery){
    if(!a1.recovery){send(404,{error:'Tidak ditemukan.'});return true;}a1.recovery.enabled();
    if(url.search)fail(400,'Parameter tidak diizinkan.');
    if(path==='/api/a2-4b/request'&&req.method==='POST'){send(202,await a1.recovery.request(await json(req)));return true;}
    if(path==='/api/a2-4b/reset'&&req.method==='POST'){send(200,await a1.recovery.reset(await json(req)));return true;}
  }
  if(lifecycle){if(!a1.deviceLifecycle){send(404,{error:'Tidak ditemukan.'});return true;}a1.deviceLifecycle.enabled();if(url.search)fail(400,'Parameter tidak diizinkan.');}
  if(intake){
    if(!a1.registration){send(404,{error:'Tidak ditemukan.'});return true;}
    a1.registration.enabled();
    if(url.search||!['GET','POST'].includes(req.method))fail(400,'Permintaan identitas tidak valid.');
    if(path==='/api/a2-2/register'&&req.method==='POST'){send(202,await a1.registration.register(await json(req)));return true;}
  }
  if(path==='/api/a1/login'){
    if(req.method!=='POST'||url.search)fail(400,'Permintaan login tidak valid.');
    const value=await json(req);if(Object.keys(value).some(k=>!['username','password'].includes(k)))fail(400,'Parameter login tidak valid.');
    send(200,await a1.login(value));return true;
  }
  const legacy=await adminAuthentication.authorize(authorization);
  let actor;
  if(legacy.kind==='ok')actor={kind:'legacy',uid:legacy.uid,revision:legacy.revision,check:async()=>{const p=await adminAuthentication.authorize(authorization);return p.kind==='ok'&&p.uid===legacy.uid&&p.revision===legacy.revision;}};
  else{
    const p=await a1.authorize(authorization);
    actor={...p,check:async()=>{try{const fresh=await a1.authorize(authorization);return fresh.uid===p.uid&&fresh.revision===p.revision;}catch{return false;}}};
  }
  if(visual){
    if(url.search)fail(400,'Parameter tidak diizinkan.');
    const match=/^\/api\/visual\/(welcome|login|registration|dashboard)(?:\/(draft|preview|publish|revert|history))?$/.exec(path);
    if(!match){send(404,{error:'Tidak ditemukan.'});return true;}
    const [,slot,action]=match,v=a1.visual;
    if(!action&&req.method==='GET'){send(200,await v.status(actor,slot));return true;}
    if(action==='history'&&req.method==='GET'){send(200,await v.history(actor,slot));return true;}
    if(action==='preview'&&req.method==='GET'){send(200,await v.preview(actor,slot));return true;}
    if(action==='draft'&&req.method==='POST'){await v.authorize(actor);send(200,await v.upload(actor,slot,await json(req,7*1024*1024+4096)));return true;}
    if(action==='publish'&&req.method==='POST'){send(200,await v.publish(actor,slot,await json(req)));return true;}
    if(action==='revert'&&req.method==='POST'){send(200,await v.revert(actor,slot,await json(req)));return true;}
    send(405,{error:'Tindakan tidak tersedia.'});return true;
  }
  if(scheduling){
    if(url.search)fail(400,'Parameter tidak diizinkan.');const s=a1.scheduling;
    if(path==='/api/stage9b2/dashboard'&&req.method==='GET'){send(200,await s.dashboard(actor));return true;}
    const match=/^\/api\/stage9b2\/organizations\/([A-Za-z0-9][A-Za-z0-9_-]{0,95})\/(preview|series)(?:\/([A-Za-z0-9][A-Za-z0-9_-]{0,95}))?$/.exec(path);
    if(match&&req.method==='POST'){const [,org,operation,seriesId]=match;if(operation==='preview'&&!seriesId){send(200,await s.preview(actor,org,await json(req)));return true;}if(operation==='series'&&seriesId){send(200,await s.create(actor,org,seriesId,await json(req)));return true;}}
    send(404,{error:'Tidak ditemukan.'});return true;
  }
  if(calendar){
    const c=a1.calendar;
    if(path==='/api/stage9b1/catalog'&&req.method==='GET'&&!url.search){send(200,await c.catalog(actor));return true;}
    if(path==='/api/stage9b1/calendar'&&req.method==='GET'){
      if([...url.searchParams.keys()].some(k=>!['organizationId','programId','from','to','status'].includes(k)||url.searchParams.getAll(k).length!==1))fail(400,'Filter tidak valid.');send(200,await c.agenda(actor,Object.fromEntries(url.searchParams)));return true;
    }
    if(url.search)fail(400,'Parameter tidak diizinkan.');
    const match=/^\/api\/stage9b1\/organizations\/([A-Za-z0-9][A-Za-z0-9_-]{0,95})\/events\/([A-Za-z0-9][A-Za-z0-9_-]{0,95})(?:\/(publish|cancel|export))?$/.exec(path);
    if(match){const [,org,eventId,operation]=match;if(!operation&&req.method==='GET'){send(200,await c.detail(actor,org,eventId));return true;}if(operation==='export'&&req.method==='POST'){send(200,await c.exportEvent(actor,org,eventId,await json(req)));return true;}if(operation&&req.method==='POST'){send(200,await c.transition(actor,org,eventId,operation,await json(req)));return true;}}
    send(404,{error:'Tidak ditemukan.'});return true;
  }
  if(events){
    const match=/^\/api\/stage9a\/organizations(?:\/([A-Za-z0-9][A-Za-z0-9_-]{0,95})\/(events|options)(?:\/([A-Za-z0-9][A-Za-z0-9_-]{0,95}))?)?$/.exec(path);
    if(!match){send(404,{error:'Tidak ditemukan.'});return true;}const [,org,section,eventId]=match,e=a1.events;
    if(url.search&&!(section==='events'&&!eventId&&req.method==='GET'))fail(400,'Parameter tidak diizinkan.');
    if(!org&&req.method==='GET'){send(200,await e.catalog(actor));return true;}
    if(section==='options'&&!eventId&&req.method==='GET'){send(200,await e.options(actor,org));return true;}
    if(section==='events'&&!eventId&&req.method==='GET'){
      if([...url.searchParams.keys()].some(k=>!['programId','from','to'].includes(k)||url.searchParams.getAll(k).length!==1))fail(400,'Filter tidak valid.');send(200,await e.list(actor,org,Object.fromEntries(url.searchParams)));return true;
    }
    if(section==='events'&&eventId&&req.method==='GET'){send(200,await e.detail(actor,org,eventId));return true;}
    if(section==='events'&&eventId&&req.method==='POST'){send(200,await e.save(actor,org,eventId,await json(req)));return true;}
    send(405,{error:'Tindakan tidak tersedia.'});return true;
  }
  if(core){
    const match=/^\/api\/stage8\/organizations(?:\/([A-Za-z0-9][A-Za-z0-9_-]{0,95})(?:\/(programs|memberships|legacy)(?:\/([A-Za-z0-9_-]{1,128}))?)?)?$/.exec(path);
    if(!match){send(404,{error:'Tidak ditemukan.'});return true;}const [,organizationId,section,target]=match,c=a1.core;
    if(url.search&&!(section==='legacy'&&!target&&req.method==='GET'))fail(400,'Parameter tidak diizinkan.');
    if(!organizationId&&req.method==='GET'){send(200,await c.catalog(actor));return true;}
    if(organizationId&&!section&&req.method==='POST'){send(200,await c.saveOrganization(actor,organizationId,await json(req)));return true;}
    if(section==='programs'&&!target&&req.method==='GET'){send(200,await c.listPrograms(actor,organizationId));return true;}
    if(section==='programs'&&target&&req.method==='POST'){send(200,await c.saveProgram(actor,organizationId,target,await json(req)));return true;}
    if(section==='memberships'&&!target&&req.method==='GET'){send(200,await c.listMembers(actor,organizationId));return true;}
    if(section==='memberships'&&target&&req.method==='POST'){send(200,await c.saveMember(actor,organizationId,target,await json(req)));return true;}
    if(section==='legacy'&&!target&&req.method==='GET'){
      if([...url.searchParams.keys()].some(k=>!['schoolId','groupId','serviceSessionId'].includes(k)||url.searchParams.getAll(k).length!==1))fail(400,'Referensi tidak valid.');send(200,await c.legacy(actor,organizationId,Object.fromEntries(url.searchParams)));return true;
    }
    send(405,{error:'Tindakan tidak tersedia.'});return true;
  }
  if(migration){send(200,await a1.migration.inspect(actor));return true;}
  if(recovery){
    if(path==='/api/a2-4b/queue'&&req.method==='GET'){send(200,await a1.recovery.queue(actor));return true;}
    const match=/^\/api\/a2-4b\/requests\/([a-f0-9]{64})\/review$/.exec(path);
    if(match&&req.method==='POST'){send(200,await a1.recovery.review(actor,match[1],await json(req)));return true;}
    send(404,{error:'Tidak ditemukan.'});return true;
  }
  if(lifecycle){
    const match=/^\/api\/a2-4\/accounts\/([A-Za-z0-9_-]{1,128})\/devices(?:\/([A-Za-z0-9_-]{1,128})\/revoke)?$/.exec(path);
    if(match){const [,uid,deviceId]=match;
      if(!deviceId&&req.method==='GET'){send(200,await a1.deviceLifecycle.list(actor,uid));return true;}
      if(deviceId&&req.method==='POST'){send(200,await a1.deviceLifecycle.revoke(actor,uid,deviceId,await json(req)));return true;}
    }
    send(404,{error:'Tidak ditemukan.'});return true;
  }
  if(intake){
    const r=a1.registration;
    if(path==='/api/a2-2/queue'&&req.method==='GET'){send(200,{...await r.queue(actor),...(a1.deviceLifecycle?{deviceManagement:true}:{})});return true;}
    const match=/^\/api\/a2-2\/accounts\/([A-Za-z0-9_-]{1,128})(?:\/(review|delegate|link|defaults))?$/.exec(path);
    if(match){
      const [,uid,operation]=match;
      if(!operation&&req.method==='GET'){send(200,await r.detail(actor,uid));return true;}
      if(operation==='defaults'&&req.method==='GET'){send(200,await r.defaults(actor,uid));return true;}
      if(['review','delegate','link'].includes(operation)&&req.method==='POST'){send(200,await r[operation](actor,uid,await json(req)));return true;}
    }
    send(404,{error:'Tidak ditemukan.'});return true;
  }
  if(path==='/api/a1/session'&&req.method==='GET'&&!url.search){send(200,actor.kind==='legacy'?{uid:actor.uid,legacy:true,role:legacy.role}:actor.profile);return true;}
  if(path==='/api/a1/logout'&&req.method==='POST'&&!url.search){a1.logout(authorization);if(actor.kind==='legacy')adminAuthentication.revoke(authorization.slice(7));send(200,{signedOut:true});return true;}
  if(path==='/api/a1/accounts'&&req.method==='GET'){
    if([...url.searchParams.keys()].some(k=>!['search','state','role'].includes(k)||url.searchParams.getAll(k).length!==1))fail(400,'Filter tidak valid.');
    send(200,await a1.accounts.list(actor,Object.fromEntries(url.searchParams)));return true;
  }
  if(path==='/api/a1/audit'&&req.method==='GET'&&!url.search){send(200,await a1.accounts.audit(actor));return true;}
  const match=/^\/api\/a1\/accounts\/([A-Za-z0-9_-]{1,128})\/change$/.exec(path);
  if(match&&req.method==='POST'&&!url.search){send(200,await a1.accounts.change(actor,match[1],await json(req)));return true;}
  if(path==='/api/a1/access'&&req.method==='POST'&&!url.search&&actor.kind==='msa'){
    const value=await json(req);if(Object.keys(value).some(k=>!['role','scope'].includes(k)))fail(400,'Parameter akses tidak valid.');
    send(200,await a1.accounts.access(actor.uid,actor.revision,value));return true;
  }
  send(404,{error:'Tidak ditemukan.'});return true;
}
