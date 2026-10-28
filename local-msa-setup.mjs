import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {requireAdminOrigin} from './backend/admin-session-http.mjs';

const digest=value=>createHash('sha256').update(value).digest();
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};

// HTTP callers only request the native dialog; they cannot supply bootstrap
// passwords, UIDs, roles or grants. Passwords travel over an owned anonymous pipe.
export function nativePasswordDialog({username,established,signal}){
  if(process.platform!=='win32')throw Error('Penyiapan akun memerlukan Windows.');
  return new Promise((resolve,reject)=>{
    const executable=path.join(process.env.SystemRoot??'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
    const child=spawn(executable,['-NoProfile','-NonInteractive','-STA','-File',fileURLToPath(new URL('./local-msa-password.ps1',import.meta.url))],{windowsHide:true,stdio:['pipe','pipe','ignore']});
    let raw='',done=false;
    const stop=()=>child.kill(),timer=setTimeout(stop,15*60000);
    const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',stop);raw='';error?reject(error):resolve(value);};
    signal?.addEventListener('abort',stop,{once:true});
    child.stdout.on('data',d=>{raw+=d;if(raw.length>4096)stop();});child.stdin.on('error',()=>{});
    child.once('error',()=>finish(Error('Dialog Windows tidak dapat dibuka.')));
    child.once('exit',code=>{
      if(code!==0||signal?.aborted)return finish(Error('Dialog Windows ditutup atau tidak tersedia.'));
      try{const value=JSON.parse(raw);finish(null,value);}catch{finish(Error('Penyiapan dibatalkan atau respons dialog tidak valid.'));}
    });
    child.stdin.end(JSON.stringify({username,established}));if(signal?.aborted)stop();
  });
}

export function createLocalMsaSetup({context,auth,authentication,accounts,check,prompt=nativePasswordDialog,now=Date.now}){
  check();if(!context.config.namespace.startsWith('test-auth-pilot-'))throw Error('Setup hanya untuk pilot terisolasi.');
  const established=new Set(),passwords=new Map(),salt=randomBytes(32).toString('hex'),abort=new AbortController();
  const statuses=new Map([...accounts.keys()].map(username=>[username,{state:'idle',message:'Belum disiapkan. Buka dialog Windows untuk menetapkan kata sandi.'}]));
  let busy=false,window=0,attempts=0,work,closed=false;
  async function configure(username){
    const target=accounts.get(username);let value;
    try{
      check();value=await prompt({username,established:established.has(username),signal:abort.signal});check();
      if(closed||!value||value.cancelled)throw Error();
      if(established.has(username)){
        const login=await authentication.a1.login({username,password:value.currentPassword});
        try{if(login.uid!==target.uid)fail(403,'UID akun berubah.');}finally{authentication.revoke(login.token);}
      }
      const bound=await authentication.a1.legacyPilot.resolve(username);
      if(bound.uid!==target.uid||bound.policy.role!==target.role)fail(403,'Pengikatan atau izin akun berubah.');
      const provider=await auth.getUser(target.uid);if(provider.disabled||provider.email!==target.email)fail(403,'Identitas provider berubah.');
      if(typeof value.password!=='string'||value.password.length<12||value.password.length>128)fail(400,'Kata sandi harus 12–128 karakter.');
      const next=digest(salt+value.password);
      for(const [name,hash] of passwords)if(name!==username&&timingSafeEqual(hash,next))fail(400,'Kata sandi Admin dan Superadmin harus berbeda.');
      check();await auth.updateUser(target.uid,{password:value.password});
      value.password='';value.currentPassword='';
      passwords.set(username,next);established.add(username);
      // Emulator auth_time/revocation timestamps have second precision.
      await new Promise(resolve=>setTimeout(resolve,1010));check();
      await auth.revokeRefreshTokens(target.uid);check();
      statuses.set(username,{state:'ready',message:'Kata sandi tersimpan untuk run ini. Masuk kembali melalui portal MSA.'});
    }catch(error){statuses.set(username,{state:'error',message:[400,401,403].includes(error.status)?error.message:'Penyiapan dibatalkan atau belum terkonfirmasi. Periksa dialog Windows dan layanan; coba login dengan kata sandi baru sebelum mengulang.'});}
    finally{if(value){value.password='';value.currentPassword='';}busy=false;}
  }
  return {
    async close(){closed=true;abort.abort();await work;established.clear();passwords.clear();},
    async handle(req,res){
      const url=new URL(req.url,'http://127.0.0.1');
      if(!['/local-account-setup.html','/local-account-setup.js','/api/local-account-setup'].includes(url.pathname))return false;
      const send=(status,value,type='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"});res.end(type.startsWith('application/json')?JSON.stringify(value):value);};
      try{
        check();requireAdminOrigin(req);if(closed)fail(503,'Setup sudah ditutup.');
        if(req.method==='GET'&&url.pathname!=='/api/local-account-setup'){
          if(url.search)fail(400,'Parameter tidak diizinkan.');
          send(200,await readFile(new URL('.'+url.pathname,import.meta.url),'utf8'),url.pathname.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');return true;
        }
        if((req.method!=='GET'||req.headers.origin)&&req.headers.origin!=='http://127.0.0.1:'+req.socket.localPort||req.headers['x-msa-local-setup']!=='1')fail(403,'Permintaan harus berasal dari aplikasi lokal.');
        if(req.method==='GET'&&[...url.searchParams.keys()].every(k=>k==='username')){
          const status=statuses.get(url.searchParams.get('username'));if(!status)fail(403,'Akun tidak termasuk setup pilot.');send(200,status);return true;
        }
        if(req.method!=='POST'||url.search)fail(405,'Metode tidak diizinkan.');
        if(req.headers['content-type']!=='application/json')fail(400,'JSON diperlukan.');
        const current=Math.floor(now()/60000);if(window!==current){window=current;attempts=0;}if(++attempts>6)fail(429,'Tunggu satu menit sebelum mencoba lagi.');
        let size=0,raw='';req.setTimeout(5000,()=>req.destroy());
        try{for await(const chunk of req.iterator({destroyOnReturn:false})){size+=chunk.length;if(size>256){req.resume();fail(413,'Permintaan terlalu besar.');}raw+=chunk;}}finally{req.setTimeout(0);}
        let value;try{value=JSON.parse(raw);}catch{fail(400,'JSON tidak valid.');}
        if(!value||Array.isArray(value)||Object.keys(value).length!==1||!accounts.has(value.username))fail(400,'Hanya pilihan akun pilot yang diterima.');
        if(busy)fail(409,'Selesaikan atau tutup dialog Windows yang sedang terbuka.');
        busy=true;statuses.set(value.username,{state:'pending',message:'Isi kata sandi pada dialog ABC MSA di Windows. Browser tidak menerima kata sandi setup.'});
        work=configure(value.username);send(202,statuses.get(value.username));
      }catch(error){send([400,401,403,405,409,413,429].includes(error.status)?error.status:503,{error:error.status?error.message:'Penyiapan Windows belum tersedia. Periksa launcher.'});}
      return true;
    }
  };
}

export function wrapLocalMsaSetup(inner,setup){
  return http.createServer((req,res)=>{void setup.handle(req,res).then(handled=>{if(!handled)inner.emit('request',req,res);}).catch(()=>{if(!res.headersSent)res.writeHead(503);res.end();});});
}
