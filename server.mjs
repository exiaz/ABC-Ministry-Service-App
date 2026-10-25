import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {localOrigin} from './backend/mentor-origin.mjs';
import {emulatorConfig} from './backend/emulator-config.mjs';
import {assertMentorAccountMode} from './backend/msa-mentor-devices.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.md':'text/plain; charset=utf-8'};
const allowed=new Set(['index.html','app.js','data.js','student-data.js','birthdays.js','birthday-ui.js','xlsx-reader.js','student-import.js','dates.js','group-config.js','service-config.js','scheduling.js','service-ui.js','reports.js','mentor-config.js','assignments.js','assignment-ui.js','xlsx.js','styles.css','sw.js','icon.svg','manifest.webmanifest','assets/abc-movement-logo.png']);
// Legacy fictional prototype only. The protected roster API runs separately.
allowed.add('msa-brand.js');
export function createPrototypeServer({mentorMode=false,apiOrigin='http://127.0.0.1:4175'}={}){
  if(mentorMode)localOrigin(apiOrigin);
  const assets=new Set([...allowed,'pairing-client.js','pairing-ui.js','device-storage.js','secure-mentor.js','mentor-attendance.js']);
  return http.createServer(async(req,res)=>{try{
    const url=new URL(req.url,'http://localhost'),name=decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html';
    const recovery=['account-recovery.html','account-recovery.js','msa-intake.css'].includes(name);
    const personal=recovery||['mentor-account.html','mentor-account.js','mentor-account.css','account-devices-ui.js','account-devices.css'].includes(name);
    if(personal){
      try{if(!mentorMode)throw Error();assertMentorAccountMode(emulatorConfig());}catch{res.writeHead(404);res.end('Tidak ditemukan');return;}
      if(recovery&&(process.env.ABC_MSA_A2_4B!=='1'||process.env.ABC_MSA_A2_4A!=='1')){res.writeHead(404);res.end('Tidak ditemukan');return;}
      if(!['GET','HEAD'].includes(req.method)||url.search){res.writeHead(404);res.end('Tidak ditemukan');return;}
    }
    if(!assets.has(name)&&!personal){res.writeHead(404);res.end('Tidak ditemukan');return;}
    let body=await readFile(path.join(root,mentorMode&&name==='index.html'?'mentor.html':name));
    if(mentorMode&&name==='index.html')body=body.toString('utf8').replace('__API_ORIGIN__',apiOrigin);
    if(personal&&name==='mentor-account.html')body=body.toString('utf8').replace('__API_ORIGIN__',apiOrigin);
    if(name==='account-recovery.html')body=body.toString('utf8').replace('content="__RECOVERY_API__"','content="'+apiOrigin+'"');
    if(name==='mentor-account.html'&&process.env.ABC_MSA_A2_4B==='1'&&process.env.ABC_MSA_A2_4A==='1')body=body.toString('utf8').replace('</form>','</form><p><a class="btn" href="/account-recovery.html">Lupa kata sandi?</a></p>');
    const security=mentorMode?{'Content-Security-Policy':`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ${apiOrigin}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,'Referrer-Policy':'no-referrer'}:{};
    res.writeHead(200,{'Content-Type':types[path.extname(name)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','X-ABC-Mode':mentorMode?'paired-local-fictional-roster':'fictional-prototype',...security});res.end(body);
  }catch{res.writeHead(500);res.end('Halaman tidak dapat dibuka');}});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  createPrototypeServer().listen(port,'127.0.0.1',()=>console.log(`ABC Ministry Service App: http://127.0.0.1:${port}`));
}
