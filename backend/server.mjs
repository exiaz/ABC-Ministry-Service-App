import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTestCredentialStore,canReadRoster,SCOPE_KEYS,validRosterScope} from './access-control.mjs';
import {createRosterRepository} from './roster.mjs';

// API-only listener: never mount prototype assets, fixtures, or a service worker.
// Default store/repository are empty, so starting this file grants no access.
export function createRosterServer({credentials=createTestCredentialStore(),repository=createRosterRepository()}={}){
  return http.createServer((req,res)=>{
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
      const principal=authCount===1?credentials.authenticate(req.headers.authorization):null;
      if(!principal){send(401,{error:'Kredensial uji tidak valid atau tidak berlaku.'},{'WWW-Authenticate':'Bearer'});return;}
      if([...url.searchParams.keys()].some(key=>!SCOPE_KEYS.includes(key))||SCOPE_KEYS.some(key=>url.searchParams.getAll(key).length!==1)){
        send(400,{error:'Parameter roster tidak valid.'});return;
      }
      const scope=Object.fromEntries(SCOPE_KEYS.map(key=>[key,url.searchParams.get(key)]));
      if(!validRosterScope(scope)){send(400,{error:'Parameter roster tidak valid.'});return;}
      if(!canReadRoster(principal,scope)){send(403,{error:'Akses roster ditolak.'});return;}
      const roster=repository.read(scope);
      if(!roster){send(403,{error:'Akses roster ditolak.'});return;}
      send(200,roster);
    }catch{
      send(500,{error:'Roster tidak dapat dibaca.'});
    }
  });
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.ABC_ROSTER_PORT||4175);
  createRosterServer().listen(port,'127.0.0.1',()=>console.log(`API roster uji tertutup: http://127.0.0.1:${port} (tanpa kredensial/data awal)`));
}
