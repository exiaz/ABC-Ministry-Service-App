import http from 'node:http';
import {registerLocalService} from './local-service.mjs';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createLocalAdminAuthentication} from './backend/admin-auth.mjs';
import {createRosterServer} from './backend/server.mjs';
import {requireAdminOrigin} from './backend/admin-session-http.mjs';
import {createConfiguredRepositories} from './backend/configured-repositories.mjs';
import {createPortalSessions} from './backend/msa-portal-session.mjs';
import {visualPublicRoute} from './backend/msa-visual-public.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const assets=new Map([['/','admin.html'],['/index.html','admin.html'],['/admin-client.js','admin-client.js'],['/secure-admin.js','secure-admin.js'],['/styles.css','styles.css'],['/assets/abc-movement-logo.png','assets/abc-movement-logo.png'],['/icon.svg','icon.svg']]);
assets.set('/admin-devices.js','admin-devices.js');
assets.set('/admin-activation.js','admin-activation.js');
assets.set('/admin-accounts.js','admin-accounts.js');
assets.set('/admin-calendar.js','admin-calendar.js');
assets.set('/admin-backup.js','admin-backup.js');
assets.set('/a1.html','a1.html');
assets.set('/msa-users.js','msa-users.js');
assets.set('/msa-brand.js','msa-brand.js');
for(const file of ['msa-visual.js','msa-visual.css','msa-visual.json','assets/msa-visual-default.jpg','assets/msa-visual-welcome.jpg','assets/msa-visual-auth.jpg','assets/msa-visual-dashboard.jpg','assets/msa-visual-program.jpg','assets/msa-visual-campaign.jpg'])assets.set('/'+file,file);
assets.set('/username-login.js','username-login.js');
assets.set('/msa-session.js','msa-session.js');
assets.set('/msa-shell.css','msa-shell.css');
for(const file of ['register.html','identity-review.html','msa-registration-ui.js','msa-intake.css'])assets.set('/'+file,file);
for(const file of ['account-devices-ui.js','account-devices.css'])assets.set('/'+file,file);
for(const file of ['account-recovery.html','account-recovery.js','migration-readiness.html','migration-readiness.js','msa-core.html','msa-core.js','msa-events.html','msa-events.js'])assets.set('/'+file,file);
const apiPaths=new Set(['/api/admin/login','/api/admin/logout','/api/admin/session','/api/admin/pairing-context','/api/admin/pairing-codes','/api/admin/activation-codes','/api/admin/devices','/api/admin/service-sessions']);
apiPaths.add('/api/admin/backup-assignments');
// Same-origin admin shell + existing protected API handler/context. No CORS,
// demo assets/database or public administrative dispatch here. The launcher may
// explicitly opt into the process-local portal cookie adapter below.
export function createAdminServer({adminAuthentication,pairing,portal=false}){
  if(portal&&(!adminAuthentication?.a1||!process.env.ABC_FIRESTORE_NAMESPACE?.startsWith('test-auth-pilot-')))throw Error('Portal hanya untuk launcher emulator fiktif.');
  const sessions=portal?createPortalSessions(adminAuthentication):null;
  const api=createRosterServer({adminAuthentication,pairing,adminLoginEnabled:true});
  const server=http.createServer(async(req,res)=>{
    const send=(status,message)=>{res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(message);};
    try{
      requireAdminOrigin(req);
      let url=new URL(req.url,'http://127.0.0.1');
      if(await visualPublicRoute(req,res,url,adminAuthentication?.a1?.visual))return;
      if(sessions&&url.pathname.startsWith('/api/')){
        // Public onboarding/recovery stays separately testable without a session.
        if(await sessions.handle(req,res,url))return;
        url=new URL(req.url,'http://127.0.0.1');
      }
      if(['/migration-readiness.html','/migration-readiness.js'].includes(url.pathname)){if(!adminAuthentication?.a1?.migration){send(404,'Tidak ditemukan.');return;}adminAuthentication.a1.migration.enabled();}
      if(['/msa-core.html','/msa-core.js'].includes(url.pathname)){if(!adminAuthentication?.a1?.core){send(404,'Tidak ditemukan.');return;}adminAuthentication.a1.core.enabled();}
      if(['/msa-events.html','/msa-events.js'].includes(url.pathname)){if(!adminAuthentication?.a1?.events){send(404,'Tidak ditemukan.');return;}adminAuthentication.a1.events.enabled();}
      const usernamePilot=url.pathname==='/username.html';
      if(['/account-recovery.html','/account-recovery.js'].includes(url.pathname)){
        if(!adminAuthentication?.a1?.recovery){send(404,'Tidak ditemukan.');return;}adminAuthentication.a1.recovery.enabled();
      }
      if(usernamePilot&&(!adminAuthentication?.a1?.legacyPilot||url.search||!['GET','HEAD'].includes(req.method))){send(404,'Tidak ditemukan.');return;}
      if(['/register.html','/identity-review.html','/msa-registration-ui.js','/msa-intake.css','/account-devices-ui.js','/account-devices.css'].includes(url.pathname)){
        if(!adminAuthentication?.a1?.registration||url.search||!['GET','HEAD'].includes(req.method)){send(404,'Tidak ditemukan.');return;}
        adminAuthentication.a1.registration.enabled();
      }
      if(url.pathname.startsWith('/api/a1/')||url.pathname.startsWith('/api/a2-2/')||url.pathname.startsWith('/api/a2-4/')||url.pathname.startsWith('/api/a2-4b/')||url.pathname.startsWith('/api/a2-4c/')||url.pathname.startsWith('/api/stage8/')||url.pathname.startsWith('/api/stage9a/')||url.pathname.startsWith('/api/stage9b1/')||url.pathname.startsWith('/api/stage9b2/')||url.pathname.startsWith('/api/visual/')){api.emit('request',req,res);return;}
      if(['/a1.html','/msa-users.js'].includes(url.pathname)){
        if(!adminAuthentication?.a1||url.search||!['GET','HEAD'].includes(req.method)){send(404,'Tidak ditemukan.');return;}
      }
      if(apiPaths.has(url.pathname)||/^\/api\/admin\/backup-assignments\/[a-f0-9]{64}\/close$/.test(url.pathname)||/^\/api\/admin\/accounts(?:\/[A-Za-z0-9_-]{1,128})?$/.test(url.pathname)||/^\/api\/admin\/devices\/[A-Za-z0-9_-]{1,128}(?:\/revoke)?$/.test(url.pathname)||/^\/api\/admin\/pairing-codes\/[a-f0-9]{64}\/revoke$/.test(url.pathname)){api.emit('request',req,res);return;}
      if(!['GET','HEAD'].includes(req.method)){send(405,'Metode tidak diizinkan.');return;}
      const portalAssets=new Set(['msa-portal.html','msa-portal.js','msa-session.js']);
      const candidate=url.pathname==='/'?'msa-portal.html':url.pathname.slice(1);
      const file=portal&&portalAssets.has(candidate)?candidate:usernamePilot?'admin.html':assets.get(url.pathname);
      if(!file||url.search){send(404,'Tidak ditemukan.');return;}
      let content;try{content=await readFile(path.join(root,file));}catch(e){if(e.code==='ENOENT'){send(404,'Tidak ditemukan.');return;}throw e;}
      if(portal&&file.endsWith('.html'))content=content.toString().replace(/<body\b/, '<body data-msa-portal="true"');
      if(portal&&file.endsWith('.html')&&file!=='msa-portal.html')content=content.toString().replace('</head>','<link rel="stylesheet" href="/msa-shell.css"></head>');
      if(portal&&file.endsWith('.html'))content=content.toString().replace('</head>','<style>body[data-msa-portal] :is(#core-login,#event-login,#msa-login,#review-login,#migration-login,#recovery-login){display:none!important}</style></head>');
      if(portal&&file.endsWith('.html')&&file!=='msa-portal.html')content=content.toString().replace('</main>','<p><a class="btn" href="/">Beranda MSA</a></p></main>');
      if(file==='account-recovery.html')content=content.toString('utf8').replace('__RECOVERY_API__','');
      if(usernamePilot)content=content.toString('utf8').replace('data-admin-mode="authenticated-local"','data-admin-mode="authenticated-local" data-username-pilot="true"');
      if(adminAuthentication?.a1?.recovery&&['admin.html','identity-review.html','a1.html'].includes(file))content=content.toString('utf8').replace('</main>','<p><a class="btn" href="/account-recovery.html">Lupa kata sandi? / Tinjau pemulihan</a></p></main>');
      const type=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.png')?'image/png':file.endsWith('.jpg')?'image/jpeg':file.endsWith('.json')?'application/json; charset=utf-8':'image/svg+xml';
      res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-ABC-Mode':'authenticated-admin-emulator','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"});
      res.end(req.method==='HEAD'?undefined:content);
    }catch(e){send(e.status??500,e.status===403?'Origin admin tidak diizinkan.':'Halaman admin tidak dapat dibuka.');}
  });
  if(sessions)server.once('close',()=>sessions.close());
  return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let adminAuthentication,adapters,server,lifecycle;
  try{
    const port=Number(process.env.ABC_ADMIN_PORT||4177);
    if(!Number.isSafeInteger(port)||port<1||port>65535||[4173,4175,4176].includes(port))throw Error();
    adapters=await createConfiguredRepositories();
    adminAuthentication=await createLocalAdminAuthentication(adapters);
    server=createAdminServer({adminAuthentication,pairing:adapters.pairing});
    const stop=async()=>{await new Promise(resolve=>{server.close(resolve);server.closeIdleConnections();});await adapters.close();await adminAuthentication.close();await lifecycle?.close();process.exit(0);};
    process.once('SIGINT',stop);process.once('SIGTERM',stop);
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
    lifecycle=await registerLocalService(server,{role:'admin',stop});
    console.log(`Admin emulator lokal: http://127.0.0.1:${port}`);
  }catch{server?.close();await adapters?.close();await adminAuthentication?.close();console.error('Admin tidak dimulai: konfigurasi atau emulator tidak tersedia.');process.exitCode=1;}
}
