import http from 'node:http';
import {registerLocalService} from './local-service.mjs';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createLocalAdminAuthentication} from './backend/admin-auth.mjs';
import {createRosterServer} from './backend/server.mjs';
import {requireAdminOrigin} from './backend/admin-session-http.mjs';
import {createConfiguredRepositories} from './backend/configured-repositories.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const assets=new Map([['/','admin.html'],['/index.html','admin.html'],['/admin-client.js','admin-client.js'],['/secure-admin.js','secure-admin.js'],['/styles.css','styles.css'],['/assets/abc-movement-logo.png','assets/abc-movement-logo.png'],['/icon.svg','icon.svg']]);
assets.set('/admin-devices.js','admin-devices.js');
assets.set('/admin-accounts.js','admin-accounts.js');
const apiPaths=new Set(['/api/admin/login','/api/admin/logout','/api/admin/session','/api/admin/pairing-context','/api/admin/pairing-codes','/api/admin/devices']);
// Same-origin admin shell + existing protected API handler/context. No CORS,
// cookie session, demo assets/database or public administrative dispatch here.
export function createAdminServer({adminAuthentication,pairing}){
  const api=createRosterServer({adminAuthentication,pairing,adminLoginEnabled:true});
  return http.createServer(async(req,res)=>{
    const send=(status,message)=>{res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(message);};
    try{
      requireAdminOrigin(req);
      const url=new URL(req.url,'http://127.0.0.1');
      if(apiPaths.has(url.pathname)||/^\/api\/admin\/accounts(?:\/[A-Za-z0-9_-]{1,128})?$/.test(url.pathname)||/^\/api\/admin\/devices\/[A-Za-z0-9_-]{1,128}(?:\/revoke)?$/.test(url.pathname)||/^\/api\/admin\/pairing-codes\/[a-f0-9]{64}\/revoke$/.test(url.pathname)){api.emit('request',req,res);return;}
      if(!['GET','HEAD'].includes(req.method)){send(405,'Metode tidak diizinkan.');return;}
      const file=assets.get(url.pathname);
      if(!file||url.search){send(404,'Tidak ditemukan.');return;}
      const content=await readFile(path.join(root,file));
      const type=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.png')?'image/png':'image/svg+xml';
      res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-ABC-Mode':'authenticated-admin-emulator','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"});
      res.end(req.method==='HEAD'?undefined:content);
    }catch(e){send(e.status??500,e.status===403?'Origin admin tidak diizinkan.':'Halaman admin tidak dapat dibuka.');}
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let adminAuthentication,adapters,server,lifecycle;
  try{
    const port=Number(process.env.ABC_ADMIN_PORT||4177);
    if(!Number.isSafeInteger(port)||port<1||port>65535||[4173,4175,4176].includes(port))throw Error();
    adminAuthentication=await createLocalAdminAuthentication();
    adapters=await createConfiguredRepositories();
    server=createAdminServer({adminAuthentication,pairing:adapters.pairing});
    const stop=async()=>{await new Promise(resolve=>{server.close(resolve);server.closeIdleConnections();});await adapters.close();await adminAuthentication.close();await lifecycle?.close();process.exit(0);};
    process.once('SIGINT',stop);process.once('SIGTERM',stop);
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
    lifecycle=await registerLocalService(server,{role:'admin',stop});
    console.log(`Admin emulator lokal: http://127.0.0.1:${port}`);
  }catch{server?.close();await adapters?.close();await adminAuthentication?.close();console.error('Admin tidak dimulai: konfigurasi atau emulator tidak tersedia.');process.exitCode=1;}
}
