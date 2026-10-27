import {msaFetch,resumeMsaSession} from './msa-session.js';
import {msaBrand} from './msa-brand.js';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),labels={ready:'Siap untuk lingkup diperiksa',review:'Perlu ditinjau',blocked:'Terblokir'};
$('migration-brand').innerHTML=msaBrand();let token='',busy=false;
function clear(){token='';$('migration-report').hidden=true;for(const id of ['migration-records','migration-blockers','migration-checklist'])$(id).replaceChildren();$('migration-verdict').textContent='';$('migration-summary').textContent='';$('migration-consistency').textContent='';$('migration-login').hidden=false;}
async function request(path,body){const r=await msaFetch(path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)}),v=await r.json();if(!r.ok)throw Error(v.error??'Pemeriksaan belum dapat diselesaikan.');return v;}
async function load(){
  $('migration-report').hidden=true;const r=await request('/api/a2-4c/preflight');
  $('migration-verdict').textContent='Cutover produksi: '+r.productionVerdict;$('migration-summary').textContent=`Pemeriksaan struktur saat ini: ${r.dryRunVerdict}. Siap ${r.summary.ready}; perlu ditinjau ${r.summary.review}; terblokir ${r.summary.blocked}.`;$('migration-consistency').textContent=r.consistency;
  $('migration-blockers').innerHTML=r.productionBlockers.map(b=>`<article><h3>${esc(b.reason)}</h3><p>${esc(b.remediation)}</p></article>`).join('');
  $('migration-checklist').innerHTML=r.checklist.map(b=>`<article><h3>${esc(labels[b.status])}</h3><p>${esc(b.reason)}</p></article>`).join('');
  $('migration-records').innerHTML=r.records.map(b=>`<article><h3>${esc(labels[b.status])}</h3><p>${esc(b.reference)}</p><p>${esc(b.reason)}</p><p>${esc(b.remediation)}</p></article>`).join('');$('migration-report').hidden=false;$('migration-login').hidden=true;
}
async function action(fn){if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();$('feedback').textContent='Hasil baca-saja diterima. Tidak ada migrasi atau perubahan akun.';}catch(e){clear();$('feedback').textContent=e instanceof TypeError||e.name==='TimeoutError'?'Koneksi belum tersedia. Masuk kembali untuk memeriksa data terbaru.':e.message;}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);$('feedback').focus();}}
$('migration-login').onsubmit=e=>{e.preventDefault();void action(async()=>{const password=$('migration-password').value;$('migration-password').value='';const r=await request('/api/a1/login',{username:$('migration-username').value,password});token=r.token;await load();});};
$('migration-refresh').onclick=()=>void action(load);
$('migration-logout').onclick=()=>void action(async()=>{try{await request('/api/a1/logout',{});}finally{clear();location.reload();}});

void resumeMsaSession(async(_profile,marker)=>{token=marker;await action(load);});
