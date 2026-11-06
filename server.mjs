import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {localOrigin} from './backend/mentor-origin.mjs';
import {emulatorConfig} from './backend/emulator-config.mjs';
import {assertMentorAccountMode} from './backend/msa-mentor-devices.mjs';
import {visualPublicRoute} from './backend/msa-visual-public.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.md':'text/plain; charset=utf-8','.woff2':'font/woff2','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};
// Hanya modul yang diimpor halaman terlayani (login Mentor, pratinjau absen); PWA lama sudah dihapus.
const allowed=new Set(['data.js','student-data.js','dates.js','group-config.js','service-config.js','scheduling.js','service-ui.js','mentor-config.js','assignments.js','styles.css','icon.svg','assets/abc-movement-logo.png']);
allowed.add('msa-brand.js');
allowed.add('msa-session.js');
// Pratinjau mandiri dengan data fiktif; tidak terhubung ke API absensi.
for(const file of ['ui-absen.html','ui/absen-charts.js','ui/absen-data.js','ui/absen-kit.css','ui/absen.css','ui/absen.js','assets/fonts/geist-variable.ttf','assets/fonts/geist-mono-variable.ttf','assets/fonts/OFL-Geist.txt'])allowed.add(file);
// UI overhaul: token, komponen, font dan ikon self-host (tanpa halaman aplikasi).
for(const file of ['ui/msa-tokens.css','ui/msa-components.css','ui/msa-admin.css','ui/msa-auth.css','assets/fonts/baloo2-latin.woff2','assets/fonts/nunito-sans-latin.woff2','assets/icons/ui-sprite.svg'])allowed.add(file);
for(const file of ['msa-visual.js','msa-visual.css','msa-visual.json','assets/msa-visual-default.jpg','assets/msa-visual-welcome.jpg','assets/msa-visual-auth.jpg','assets/msa-visual-dashboard.jpg','assets/msa-visual-program.jpg','assets/msa-visual-campaign.jpg'])allowed.add(file);
allowed.add('assets/msa-auth-documentation.png');
export function createPrototypeServer({mentorMode=false,review=false,apiOrigin='http://127.0.0.1:4175',visual}={}){
  if(mentorMode)localOrigin(apiOrigin);
  const assets=new Set([...allowed,'pairing-client.js','device-storage.js','secure-mentor.js','mentor-attendance.js']);
  // Tinjauan hanya pada server mandiri; root Mentor dan pemanggil legacy tetap tertutup.
  if(review&&!mentorMode)for(const file of ['index.html','ui-review.html','ui/pil.js','ui/pil-data.js','ui/pil.css','ui/pil-kit.css','ui/pil-charts.js','ui/review.js','ui/review-data.js','ui/review.css','ui/review-kit.css','ui/review-charts.js','docs/ui-overhaul/C10-preview.png','docs/ui-overhaul/BRIEF.md'])assets.add(file);
  return http.createServer(async(req,res)=>{try{
    const url=new URL(req.url,'http://localhost'),name=decodeURIComponent(url.pathname).replace(/^\//,'')||(review&&!mentorMode?'index.html':'');
    if(await visualPublicRoute(req,res,url,mentorMode?visual:undefined))return;
    const recovery=['account-recovery.html','account-recovery.js','msa-intake.css'].includes(name);
    const personal=recovery||['mentor-account.html','mentor-account.js','mentor-session-schedule.js','mentor-account.css','account-devices-ui.js','account-devices.css'].includes(name);
    if(personal){
      try{if(!mentorMode)throw Error();assertMentorAccountMode(emulatorConfig());}catch{res.writeHead(404);res.end('Tidak ditemukan');return;}
      if(recovery&&(process.env.ABC_MSA_A2_4B!=='1'||process.env.ABC_MSA_A2_4A!=='1')){res.writeHead(404);res.end('Tidak ditemukan');return;}
      if(!['GET','HEAD'].includes(req.method)||url.search){res.writeHead(404);res.end('Tidak ditemukan');return;}
    }
    if(!assets.has(name)&&!personal){res.writeHead(404);res.end('Tidak ditemukan');return;}
    let body;try{body=await readFile(path.join(root,name));}catch(e){if(e.code==='ENOENT'){res.writeHead(404);res.end('Tidak ditemukan');return;}throw e;}
    if(personal&&name==='mentor-account.html')body=body.toString('utf8').replace('__API_ORIGIN__',apiOrigin);
    if(personal&&name==='mentor-account.html'&&process.env.ABC_MSA_SESSION_1A==='1')body=body.toString('utf8').replace('<body class="mentor-account">','<body class="mentor-account" data-mentor-session="1">').replace('id="account-login" class="panel"','id="account-login" class="panel" hidden').replace('id="account-session-check" class="panel" hidden','id="account-session-check" class="panel"').replace('<!--MENTOR_SESSION_OPTION-->','<label id="account-remember-option" class="account-remember"><input id="account-remember" type="checkbox" aria-describedby="account-remember-help"> Tetap masuk di perangkat ini</label><p id="account-remember-help" class="muted">Jangan pilih di perangkat bersama; sesi sementara berlaku maksimal 30 menit.</p>');
    if(name==='account-recovery.html')body=body.toString('utf8').replace('content="__RECOVERY_API__"','content="'+apiOrigin+'"');
    if(name==='mentor-account.html'&&process.env.ABC_MSA_A2_4B==='1'&&process.env.ABC_MSA_A2_4A==='1')body=body.toString('utf8').replace('</form>','</form><p><a class="btn" href="/account-recovery.html">Lupa kata sandi?</a></p>');
    const security=mentorMode?{'Content-Security-Policy':`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ${apiOrigin}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,'Referrer-Policy':'no-referrer'}:{};
    res.writeHead(200,{'Content-Type':types[path.extname(name)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','X-ABC-Mode':mentorMode?'paired-local-fictional-roster':'fictional-prototype',...security});res.end(body);
  }catch{res.writeHead(500);res.end('Halaman tidak dapat dibuka');}});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  createPrototypeServer({review:true}).listen(port,'127.0.0.1',()=>console.log(`ABC Ministry Service App: http://127.0.0.1:${port}`));
}
