import {randomBytes} from 'node:crypto';
import {hash,fail} from './msa-accounts.mjs';

const path='/api/mentor-session/';
const maximum=30*24*60*60*1000,sharedLifetime=30*60*1000;

// Process-local and gated to the fictional emulator. Refresh credentials never
// leave this process and are lost when the pilot namespace is restarted.
export function createMentorSessions(mentor,{origin,now=Date.now,limit=1000}={}){
  const sessions=new Map();let reserved=0;
  const name=req=>'msa_mentor_'+req.socket.localPort;
  const cookie=(req,res,value,persistent)=>res.setHeader('Set-Cookie',`${name(req)}=${value}; Path=${path}; HttpOnly; SameSite=Strict${value?(persistent?'; Max-Age='+Math.floor(maximum/1000):''):'; Max-Age=0'}`);
  const guard=req=>{
    mentor.enabled();
    const count=name=>req.rawHeaders.filter((_,i)=>i%2===0&&req.rawHeaders[i].toLowerCase()===name).length;
    if(process.env.ABC_MSA_SESSION_1A!=='1'||req.socket.remoteAddress!=='127.0.0.1'&&req.socket.remoteAddress!=='::ffff:127.0.0.1'||count('host')!==1||count('origin')!==1||count('x-msa-mentor-session')!==1||count('authorization')!==0||count('x-msa-session')!==0||req.headers.host!=='127.0.0.1:'+req.socket.localPort||req.headers.origin!==origin||req.headers['x-msa-mentor-session']!=='1')fail(403,'Permintaan sesi Mentor tidak diizinkan.');
  };
  const lookup=req=>{
    const values=(req.headers.cookie??'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(name(req)+'='));
    const handle=values.length===1?values[0].slice(name(req).length+1):'',key=/^[A-Za-z0-9_-]{43}$/.test(handle)?hash(handle):'';
    return {key,session:sessions.get(key)};
  };
  const revoke=async(key,s)=>{
    if(!s)return;s.revoked=true;sessions.delete(key);s.refreshToken='';
    await Promise.allSettled(s.issued.map(row=>mentor.revokeIssued(s.uid,row.token)));s.issued=[];
  };
  // Expired sessions must not keep refresh tokens in memory until the next login.
  const prune=async()=>{for(const [key,s] of [...sessions])if(s.expiresAt<=now())await revoke(key,s);};
  const sweep=setInterval(()=>{void prune().catch(()=>{});},60000);sweep.unref();
  const read=async req=>{
    if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type']??''))fail(400,'Permintaan harus berupa JSON.');
    let size=0;const chunks=[];req.setTimeout(5000,()=>req.destroy());
    try{for await(const c of req.iterator({destroyOnReturn:false})){size+=c.length;if(size>2048){req.resume();fail(413,'Permintaan terlalu besar.');}chunks.push(c);}}finally{req.setTimeout(0);}
    let value;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail(400,'JSON tidak valid.');}
    if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Data tidak valid.');return value;
  };
  return {
    async handle(req,res,url,send){
      if(!url.pathname.startsWith(path))return false;
      guard(req);if(url.search)fail(400,'Parameter sesi tidak diizinkan.');
      await prune();
      const {key,session:s}=lookup(req);
      if(url.pathname===path+'login'&&req.method==='POST'){
        const v=await read(req);if(Object.keys(v).some(k=>!['username','password','persistent'].includes(k))||typeof v.persistent!=='boolean')fail(400,'Parameter login tidak valid.');
        // Reserve a slot before the awaited login so concurrent logins cannot exceed the limit.
        if(sessions.size+reserved>=limit)fail(503,'Batas sesi lokal tercapai.');
        reserved++;
        try{
          let result;try{result=await mentor.persistentLogin({username:v.username,password:v.password});}finally{v.password='';}
          if(s)await revoke(key,s);
          const handle=randomBytes(32).toString('base64url'),expiresAt=now()+(v.persistent?maximum:sharedLifetime);
          sessions.set(hash(handle),{uid:result.uid,revision:result.revision,providerStamp:result.providerStamp,refreshToken:result.refreshToken,expiresAt,issued:[{token:result.token,expiresAt:result.expiresAt}],revoked:false,pending:null});
          cookie(req,res,handle,v.persistent);send(200,{...result.profile,token:result.token,accessExpiresAt:result.expiresAt,sessionExpiresAt:expiresAt});
        }finally{reserved--;}
        return true;
      }
      if(url.pathname===path+'logout'&&req.method==='POST'){
        if(Object.keys(await read(req)).length)fail(400,'Parameter keluar tidak valid.');
        await revoke(key,s);cookie(req,res,'');send(200,{signedOut:true});return true;
      }
      if(url.pathname===path+'restore'&&req.method==='POST'){
        if(Object.keys(await read(req)).length)fail(400,'Parameter sesi tidak valid.');
        if(!s||s.revoked||s.expiresAt<=now()){if(s)await revoke(key,s);cookie(req,res,'');fail(401,'Sesi berakhir. Masuk kembali.');}
        s.issued=s.issued.filter(row=>row.expiresAt>now());
        if(!s.pending&&s.issued.length>=64)fail(429,'Terlalu banyak pemeriksaan sesi. Coba lagi nanti.');
        if(!s.pending)s.pending=(async()=>{
          const result=await mentor.persistentRefresh({uid:s.uid,revision:s.revision,providerStamp:s.providerStamp,sessionExpiresAt:s.expiresAt,refreshToken:s.refreshToken,onRefresh:value=>{if(!s.revoked)s.refreshToken=value;}});
          if(s.revoked){await mentor.revokeIssued(s.uid,result.token);fail(401,'Sesi berakhir. Masuk kembali.');}
          s.refreshToken=result.refreshToken;s.issued=s.issued.filter(row=>row.expiresAt>now());s.issued.push({token:result.token,expiresAt:result.expiresAt});
          return {...result.profile,token:result.token,accessExpiresAt:result.expiresAt,sessionExpiresAt:s.expiresAt};
        })().finally(()=>{s.pending=null;});
        try{send(200,await s.pending);}catch(e){if(e.adminAccountError&&[401,403].includes(e.status)){await revoke(key,s);cookie(req,res,'');fail(401,'Akses akun tidak berlaku. Masuk kembali.');}throw e;}return true;
      }
      fail(405,'Metode sesi tidak diizinkan.');
    },
    close(){clearInterval(sweep);for(const s of sessions.values()){s.revoked=true;s.refreshToken='';for(const row of s.issued)mentor.forgetIssued(row.token);s.issued=[];}sessions.clear();}
  };
}
