import {requireAdminOrigin} from './admin-session-http.mjs';
import {fail} from './msa-accounts.mjs';

async function json(req){
  if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type']??''))fail(400,'Permintaan harus berupa JSON.');
  const chunks=[];let size=0;req.setTimeout(5000,()=>req.destroy());
  try{for await(const chunk of req.iterator({destroyOnReturn:false})){size+=chunk.length;if(size>4096){req.resume();fail(413,'Permintaan akun terlalu besar.');}chunks.push(chunk);}}finally{req.setTimeout(0);}
  let value;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail(400,'JSON tidak valid.');}
  if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Data akun tidak valid.');return value;
}
export async function msaRoute({req,url,authorization,local,adminAuthentication,send}){
  const intake=url.pathname.startsWith('/api/a2-2/');
  const lifecycle=url.pathname.startsWith('/api/a2-4/');
  const recovery=url.pathname.startsWith('/api/a2-4b/');
  const migration=url.pathname.startsWith('/api/a2-4c/');
  if(!url.pathname.startsWith('/api/a1/')&&!intake&&!lifecycle&&!recovery&&!migration)return false;
  const a1=adminAuthentication?.a1;
  if(!a1||!local){send(404,{error:'Tidak ditemukan.'});return true;}
  requireAdminOrigin(req);
  const path=url.pathname;
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
