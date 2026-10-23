import http from 'node:http';
import {registerLocalService} from '../local-service.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SCOPE_KEYS} from './access-control.mjs';
import {createInMemoryCredentialRepository,createInMemoryRosterRepository,createAuthorizedRosterRepository} from './repositories.mjs';
import {createConfiguredRepositories} from './configured-repositories.mjs';
import {createConfiguredAdminAuthentication} from './admin-auth.mjs';
import {PairingError} from './device-pairing.mjs';
import {requestProof,adminPairingRoute,redeemPairingRoute} from './pairing-http.mjs';
import {localOrigin,mentorCors} from './mentor-origin.mjs';
import {attendanceRoute} from './attendance-http.mjs';
import {AttendanceError} from './attendance.mjs';
import {AdminSessionError,createAdminSessionRoutes} from './admin-session-http.mjs';
import {accountRoute} from './admin-accounts-http.mjs';

// API-only listener: never mount prototype assets, fixtures, or a service worker.
// Default store/repository are empty, so starting this file grants no access.
export function createRosterServer({credentials=createInMemoryCredentialRepository(),repository=createInMemoryRosterRepository(),adminAuthentication,pairing,attendance,mentorOrigin,adminLoginEnabled=false}={}){
  if(mentorOrigin!==undefined)localOrigin(mentorOrigin);
  const adminSessions=createAdminSessionRoutes();
  return http.createServer(async(req,res)=>{
    let corsHeaders={};
    const send=(status,body,headers={})=>{
      res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-ABC-Mode':'test-foundation','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",...corsHeaders,...headers});
      res.end(JSON.stringify(body));
    };
    try{
      const url=new URL(req.url,'http://localhost');
      const authCount=req.rawHeaders.filter((_,i)=>i%2===0&&req.rawHeaders[i].toLowerCase()==='authorization').length;
      const authorization=authCount===1?req.headers.authorization:undefined;
      const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
      const cors=mentorCors(req,url,mentorOrigin);
      if(cors?.denied||cors&&!local){send(403,{error:'Origin mentor tidak diizinkan.'});return;}
      if(cors){corsHeaders=cors.headers;if(req.method==='OPTIONS'){send(204,{});return;}}
      // Every administrative operation must remain inside this guarded branch.
      // Unknown routes/methods never dispatch an administrative action.
      if(url.pathname==='/api/admin'||url.pathname.startsWith('/api/admin/')){
        if(!local||!adminAuthentication){send(503,{error:'Autentikasi admin lokal tidak tersedia.'});return;}
        if(url.pathname==='/api/admin/login'&&adminLoginEnabled){await adminSessions.login({req,url,adminAuthentication,send});return;}
        const result=await adminAuthentication.authorize(authorization);
        if(result.kind==='unauthenticated'){send(401,{error:'Token admin tidak valid atau tidak berlaku.'},{'WWW-Authenticate':'Bearer'});return;}
        if(result.kind!=='ok'){send(403,{error:'Akses admin ditolak.'});return;}
        const stillAuthorized=async()=>{const current=await adminAuthentication.authorize(authorization);return current.kind==='ok'&&current.uid===result.uid;};
        if(url.pathname==='/api/admin/logout'&&adminLoginEnabled){await adminSessions.logout({req,url,authorization,adminAuthentication,send});return;}
        if(await accountRoute({req,url,result,adminAuthentication,stillAuthorized,send}))return;
        if(await adminPairingRoute({req,url,uid:result.uid,pairing,stillAuthorized,send,adminOrigin:adminLoginEnabled?'http://127.0.0.1:'+req.socket.localPort:undefined}))return;
        if(url.pathname!=='/api/admin/session'){send(404,{error:'Tidak ditemukan.'});return;}
        if(req.method!=='GET'){send(405,{error:'Metode tidak diizinkan.'},{Allow:'GET'});return;}
        if(url.search){send(400,{error:'Parameter sesi admin tidak diizinkan.'});return;}
        if(!await stillAuthorized()){send(401,{error:'Sesi admin tidak berlaku. Masuk kembali.'});return;}
        send(200,{uid:result.uid,mode:'emulator-lokal',...(['superadmin','pic'].includes(result.role)?{role:result.role,actions:result.actions??[]}: {})});return;
      }
      if(url.pathname==='/api/pairing/redeem'){
        if(!local){send(503,{error:'Pairing emulator lokal tidak tersedia.'});return;}
        await redeemPairingRoute({req,url,pairing,send,mentorOrigin});return;
      }
      if(await attendanceRoute({req,url,authorization,local,pairing,attendance,mentorOrigin,send}))return;
      const deviceStatus=url.pathname==='/api/device/status';
      const rosterContext=url.pathname==='/api/roster-context';
      if(url.pathname!=='/api/roster'&&!deviceStatus&&!rosterContext){send(404,{error:'Tidak ditemukan.'});return;}
      if(req.method!=='GET'){send(405,{error:'Metode tidak diizinkan.'},{Allow:'GET'});return;}
      const proof=local&&pairing?await pairing.verifyRequest(authorization,requestProof(req)):null;
      const requestCredentials={authenticate:header=>credentials.authenticate(header,proof)};
      if(deviceStatus){
        const principal=await requestCredentials.authenticate(authorization);
        const status=principal&&pairing?await pairing.status(authorization,proof):null;
        if(!status||!await requestCredentials.authenticate(authorization)){send(401,{error:'Kredensial perangkat tidak valid atau tidak berlaku.'});return;}
        if(url.search){send(400,{error:'Parameter perangkat tidak valid.'});return;}
        send(200,status);return;
      }
      const authorized=createAuthorizedRosterRepository({credentials:requestCredentials,repository});
      if(rosterContext){
        const result=await authorized.contextAuthorized(authorization);
        if(result.kind==='unauthenticated'){send(401,{error:'Kredensial perangkat tidak valid atau tidak berlaku.'},{'WWW-Authenticate':'Bearer'});return;}
        if(result.kind!=='ok'){send(403,{error:'Cakupan roster ditolak.'});return;}
        if(url.search){send(400,{error:'Parameter metadata roster tidak diizinkan.'});return;}
        send(200,{contexts:result.contexts});return;
      }
      // Reject ambiguous credentials; cookies, query tokens and client role/device
      // flags never supply an identity. CORS transports only explicitly allowed
      // mentor requests; it never replaces credential/proof or grant checks.
      const validParameters=[...url.searchParams.keys()].every(key=>SCOPE_KEYS.includes(key))&&SCOPE_KEYS.every(key=>url.searchParams.getAll(key).length===1);
      const scope=validParameters?Object.fromEntries(SCOPE_KEYS.map(key=>[key,url.searchParams.get(key)])):null;
      const result=await authorized.readAuthorized(authorization,scope);
      if(result.kind==='unauthenticated'){send(401,{error:'Kredensial uji tidak valid atau tidak berlaku.'},{'WWW-Authenticate':'Bearer'});return;}
      if(result.kind==='invalid-scope'){send(400,{error:'Parameter roster tidak valid.'});return;}
      if(result.kind!=='ok'){send(403,{error:'Akses roster ditolak.'});return;}
      send(200,result.roster);
    }catch(error){
      if(error instanceof PairingError&&error.duplicateSubmission){send(409,{error:error.message,duplicateSubmission:true,pairingId:error.pairingId,expiresAt:error.expiresAt});return;}
      if(error.adminAccountError){send(error.status,{error:error.message});return;}
      if(error instanceof PairingError||error instanceof AttendanceError||error instanceof AdminSessionError){send(error.status,{error:error.message},error.status===429?{'Retry-After':'60'}:error.status===413?{Connection:'close'}:{});return;}
      send(500,{error:req.url.startsWith('/api/admin')?'Permintaan admin tidak dapat diproses.':req.url.startsWith('/api/attendance')?'Absensi tidak dapat diproses.':'Roster tidak dapat dibaca.'});
    }
  });
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.ABC_ROSTER_PORT||4175);
  let adapters,adminAuthentication,server,lifecycle;
  try{
    adminAuthentication=await createConfiguredAdminAuthentication();
    adapters=await createConfiguredRepositories();
    server=createRosterServer({...adapters,adminAuthentication,mentorOrigin:process.env.ABC_MENTOR_ORIGIN});
    const stop=async()=>{await new Promise(resolve=>{server.close(resolve);server.closeIdleConnections();});await adminAuthentication?.close();await adapters.close();await lifecycle?.close();process.exit(0);};
    process.once('SIGINT',stop);process.once('SIGTERM',stop);
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
    lifecycle=await registerLocalService(server,{role:'api',stop});
    console.log(`API roster uji: http://127.0.0.1:${port} (${process.env.ABC_ROSTER_ADAPTER??'in-memory'})`);
  }catch{
    server?.close();
    await adminAuthentication?.close();await adapters?.close();
    console.error('API tidak dimulai: konfigurasi autentikasi, repository atau emulator tidak tersedia.');process.exitCode=1;
  }
}
