import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SCOPE_KEYS} from './access-control.mjs';
import {createInMemoryCredentialRepository,createInMemoryRosterRepository,createAuthorizedRosterRepository} from './repositories.mjs';
import {createConfiguredRepositories} from './configured-repositories.mjs';

// API-only listener: never mount prototype assets, fixtures, or a service worker.
// Default store/repository are empty, so starting this file grants no access.
export function createRosterServer({credentials=createInMemoryCredentialRepository(),repository=createInMemoryRosterRepository()}={}){
  const authorized=createAuthorizedRosterRepository({credentials,repository});
  return http.createServer(async(req,res)=>{
    const send=(status,body,headers={})=>{
      res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-ABC-Mode':'test-foundation','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",...headers});
      res.end(JSON.stringify(body));
    };
    try{
      const url=new URL(req.url,'http://localhost');
      if(url.pathname!=='/api/roster'){send(404,{error:'Tidak ditemukan.'});return;}
      if(req.method!=='GET'){send(405,{error:'Metode tidak diizinkan.'},{Allow:'GET'});return;}
      // Reject ambiguous credentials; cookies, query tokens and client role/device
      // flags never supply an identity. No CORS or credential issuance endpoint.
      const authCount=req.rawHeaders.filter((_,i)=>i%2===0&&req.rawHeaders[i].toLowerCase()==='authorization').length;
      const validParameters=[...url.searchParams.keys()].every(key=>SCOPE_KEYS.includes(key))&&SCOPE_KEYS.every(key=>url.searchParams.getAll(key).length===1);
      const scope=validParameters?Object.fromEntries(SCOPE_KEYS.map(key=>[key,url.searchParams.get(key)])):null;
      const result=await authorized.readAuthorized(authCount===1?req.headers.authorization:undefined,scope);
      if(result.kind==='unauthenticated'){send(401,{error:'Kredensial uji tidak valid atau tidak berlaku.'},{'WWW-Authenticate':'Bearer'});return;}
      if(result.kind==='invalid-scope'){send(400,{error:'Parameter roster tidak valid.'});return;}
      if(result.kind!=='ok'){send(403,{error:'Akses roster ditolak.'});return;}
      send(200,result.roster);
    }catch{
      send(500,{error:'Roster tidak dapat dibaca.'});
    }
  });
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.ABC_ROSTER_PORT||4175);
  try{
    const adapters=await createConfiguredRepositories();
    const server=createRosterServer(adapters);
    const stop=()=>server.close(async()=>{await adapters.close();process.exit(0);});
    process.once('SIGINT',stop);process.once('SIGTERM',stop);
    server.listen(port,'127.0.0.1',()=>console.log(`API roster uji: http://127.0.0.1:${port} (${process.env.ABC_ROSTER_ADAPTER??'in-memory'})`));
  }catch{
    console.error('API roster tidak dimulai: konfigurasi repository atau emulator tidak tersedia.');process.exitCode=1;
  }
}
