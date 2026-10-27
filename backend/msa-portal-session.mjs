import {randomBytes,createHash} from 'node:crypto';
import {requireAdminOrigin} from './admin-session-http.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const lifetime=30*60*1000;

// Opt-in, process-local loopback session adapter. The existing authentication
// context remains the sole authority; no bearer is returned to the browser.
export function createPortalSessions(authentication,{now=Date.now}={}){
  const sessions=new Map();
  const cookieName=req=>'msa_session_'+req.socket.localPort;
  const cookie=(req,res,value)=>res.setHeader('Set-Cookie',`${cookieName(req)}=${value}; Path=/api/portal/; HttpOnly; SameSite=Strict; Max-Age=${value?1800:0}`);
  const revoke=s=>{authentication.revoke(s.token);};
  function prune(){for(const [key,s] of sessions)if(s.expiresAt<=now()){revoke(s);sessions.delete(key);}}
  function guard(req){
    requireAdminOrigin(req);
    if(req.headers['x-msa-portal']!=='1'||'authorization' in req.headers||req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin'||!['GET','HEAD'].includes(req.method)&&req.headers.origin!=='http://'+req.headers.host)fail(403,'Permintaan sesi harus berasal dari portal MSA ini.');
  }
  function entry(req){
    prune();const values=(req.headers.cookie??'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(cookieName(req)+'='));
    const value=values.length===1?values[0].slice(cookieName(req).length+1):'';
    const key=/^[A-Za-z0-9_-]{43}$/.test(value)?digest(value):'';
    return {key,s:sessions.get(key)};
  }
  async function actor(s){
    const p=await authentication.a1.authorize('Bearer '+s.token);
    const legacy=await authentication.authorize('Bearer '+s.token);
    // Match msaRoute's trusted actor contract for legacy username sessions.
    const principal=legacy.kind==='ok'?{...p,kind:'legacy',uid:legacy.uid,revision:legacy.revision}:p;
    return {...principal,check:async()=>{try{const current=await authentication.a1.authorize('Bearer '+s.token);if(current.uid!==p.uid||current.revision!==p.revision)return false;if(principal.kind==='legacy'){const fresh=await authentication.authorize('Bearer '+s.token);return fresh.kind==='ok'&&fresh.uid===principal.uid&&fresh.revision===principal.revision;}return true;}catch{return false;}}};
  }
  async function describe(s){
    const a=await actor(s),a1=authentication.a1,modules=[];
    const probe=async(fn,module)=>{try{const result=await fn();if(result!==false)modules.push(module);}catch(e){if(![401,403].includes(e.status))throw e;}};
    if(a1.events)await probe(async()=>{const r=await a1.events.catalog(a);return !!r.organizations.length;},{href:'/msa-events.html',label:'Beranda pelayanan & kalender'});
    if(a1.core)await probe(async()=>{const r=await a1.core.catalog(a);return r.platform||!!r.organizations.length;},{href:'/msa-core.html',label:'Organisasi, program & keanggotaan'});
    await probe(()=>a1.accounts.list(a,{}),{href:'/a1.html',label:'Pengguna & izin akun'});
    if(a1.registration)await probe(async()=>{const r=await a1.registration.queue(a);return r.superadmin||!!r.accounts.length;},{href:'/identity-review.html',label:'Tinjau identitas & perangkat akun'});
    if(a1.recovery)await probe(async()=>{const r=await a1.recovery.queue(a);return r.superadmin||!!r.requests.length;},{href:'/account-recovery.html',label:'Tinjau pemulihan akun'});
    if(a1.migration)await probe(()=>a1.migration.inspect(a),{href:'/migration-readiness.html',label:'Kesiapan migrasi (baca saja)'});
    const legacy=await authentication.authorize('Bearer '+s.token);
    if(legacy.kind==='ok')modules.push({href:'/username.html',label:'Admin, aktivasi & perangkat'});
    if(!await a.check())fail(401,'Sesi berakhir. Masuk kembali.');
    return {uid:a.uid,username:a.username??a.profile?.username??s.username,role:legacy.kind==='ok'?legacy.role:'volunteer',modules,expiresAt:s.expiresAt};
  }
  async function json(req){
    if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type']??''))fail(400,'Permintaan harus berupa JSON.');
    let size=0;const chunks=[];req.setTimeout(5000,()=>req.destroy());
    try{for await(const chunk of req.iterator({destroyOnReturn:false})){size+=chunk.length;if(size>4096){req.resume();fail(413,'Permintaan terlalu besar.');}chunks.push(chunk);}}finally{req.setTimeout(0);}
    let value;try{value=JSON.parse(Buffer.concat(chunks).toString());}catch{fail(400,'JSON tidak valid.');}
    if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Data tidak valid.');return value;
  }
  return {
    async handle(req,res,url){
      const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
      const dispatch=url.pathname.startsWith('/api/portal/dispatch/api/');
      if(dispatch)url=new URL(req.url.slice('/api/portal/dispatch'.length),'http://127.0.0.1');
      const portal=!dispatch&&url.pathname.startsWith('/api/portal/');
      if(!portal&&req.headers['x-msa-portal']!=='1')return false;
      try{
        guard(req);const {key,s}=entry(req);
        if(portal){
          if(url.search)fail(400,'Parameter sesi tidak diizinkan.');
          if(url.pathname==='/api/portal/login'&&req.method==='POST'){
            const value=await json(req);if(Object.keys(value).some(k=>!['username','password'].includes(k)))fail(400,'Parameter login tidak valid.');
            if(s){revoke(s);sessions.delete(key);}cookie(req,res,'');
            let result;try{result=await authentication.a1.login(value);}finally{value.password='';}
            prune();if(sessions.size>=1000){authentication.revoke(result.token);fail(503,'Batas sesi lokal tercapai.');}
            const session={token:result.token,username:value.username,expiresAt:now()+lifetime};
            try{const profile=await describe(session),handle=randomBytes(32).toString('base64url');sessions.set(digest(handle),session);cookie(req,res,handle);send(200,profile);}catch(e){revoke(session);throw e;}return true;
          }
          if(url.pathname==='/api/portal/logout'&&req.method==='POST'){
            if(Object.keys(await json(req)).length)fail(400,'Parameter keluar tidak valid.');
            if(s){revoke(s);sessions.delete(key);}cookie(req,res,'');send(200,{signedOut:true});return true;
          }
          if(url.pathname==='/api/portal/session'&&req.method==='GET'){
            if(!s)fail(401,'Sesi berakhir. Masuk kembali.');send(200,await describe(s));return true;
          }
          fail(405,'Metode sesi tidak diizinkan.');
        }
        // Only same-origin management APIs may consume this cookie. Mentor
        // device authorization and public intake keep their own boundaries.
        if(!dispatch||!/^\/api\/(?:admin|a1|a2-2|a2-4|a2-4b|a2-4c|stage8|stage9a|stage9b1|stage9b2)\//.test(url.pathname))fail(403,'Modul tidak termasuk sesi portal.');
        if(['/api/a1/login','/api/admin/login'].includes(url.pathname))fail(403,'Gunakan login portal MSA.');
        if(!s)fail(401,'Sesi berakhir. Masuk kembali.');await actor(s);
        req.headers.authorization='Bearer '+s.token;
        // The legacy router deliberately counts raw Authorization headers to
        // reject duplicates. Represent this single trusted internal header too.
        req.rawHeaders.push('Authorization',req.headers.authorization);
        req.url=url.pathname+url.search;
        return false;
      }catch(e){send([400,401,403,405,409,413,429,503].includes(e.status)?e.status:503,{error:e.status?e.message:'Sesi belum dapat diperiksa. Coba lagi.'});return true;}
    },
    close(){for(const s of sessions.values())revoke(s);sessions.clear();}
  };
}
