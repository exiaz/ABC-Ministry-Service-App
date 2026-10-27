import {msaFetch,resumeMsaSession} from './msa-session.js';
import {msaBrand} from './msa-brand.js';
import {usernameFields} from './username-login.js';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$('msa-brand').innerHTML=msaBrand();
const legacyFields=$('msa-fields').innerHTML;
$('msa-mode').onchange=()=>{$('msa-fields').innerHTML=$('msa-mode').value==='username'?usernameFields({nameId:'msa-name',passwordId:'msa-password'}):legacyFields;};
const labels={superadmin:'Superadmin',admin:'Admin / Pengelola Tim',pic:'PIC',volunteer:'Mentor / Relawan',active:'Aktif',pending:'Menunggu',rejected:'Ditolak',suspended:'Ditangguhkan',disabled:'Nonaktif',revoked:'Dicabut'};
let token='',data={accounts:[],organizations:[]},selected='',busy=false,pending;
const feedback=text=>{$('msa-feedback').textContent=text;};
async function request(path,body){
  const response=await msaFetch(path,{method:body===undefined?'GET':'POST',credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000),headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const value=await response.json();
  if(!response.ok){if(response.status===401&&token){token='';$('msa-management').hidden=true;$('msa-session').hidden=true;$('msa-login').hidden=false;$('msa-detail').innerHTML='';$('msa-history').innerHTML='';data={accounts:[],organizations:[]};}throw Error(value.error??'Permintaan gagal.');}return value;
}
const orgName=id=>id===null?'Seluruh sistem':data.organizations.find(o=>o.id===id)?.name??id;
const scopeText=s=>`${orgName(s.organizationId)}${s.programId?' · Program '+s.programId:''}${s.eventId?' · Pelayanan '+s.eventId:''}`;
async function load(){
  const params=new URLSearchParams({search:$('msa-query').value,state:$('msa-state-filter').value,role:$('msa-role-filter').value});
  data=await request('/api/a1/accounts?'+params);$('msa-management').hidden=false;
  $('msa-list').innerHTML=data.accounts.map(a=>`<article class="account-card"><h3>${esc(a.fullName)}</h3><p>@${esc(a.username)} · ${esc(labels[a.state])}</p><p>Identitas: ${a.identity.state==='verified'?'Terverifikasi':'Belum terverifikasi'}</p><ul>${a.roles.filter(g=>g.status==='active').map(g=>`<li>${esc(labels[g.role])} · ${esc(scopeText(g.scope))}</li>`).join('')||'<li>Belum memiliki peran aktif</li>'}</ul><button class="btn" data-user="${esc(a.uid)}">Kelola ${esc(a.username)}</button></article>`).join('')||'<p>Tidak ada akun yang cocok.</p>';
  if(selected)detail(selected);
}
function detail(uid){
  selected=uid;const a=data.accounts.find(a=>a.uid===uid);if(!a){$('msa-detail').innerHTML='';return;}
  $('msa-detail').innerHTML=`<article><h2>Profil ${esc(a.fullName)}</h2><p>@${esc(a.username)} · ${esc(labels[a.state])} · Revisi ${a.revision}</p><p>Identitas: ${a.identity.state==='verified'?'Terverifikasi':'Belum terverifikasi'} · Nomor HP: ${a.phoneState==='supplied'?'Diberikan, belum terverifikasi':a.phoneState==='verified'?'Terverifikasi':'Belum diberikan'}</p><p>Kelayakan: ${esc(a.eligibleRoles.map(r=>labels[r]).join(', ')||'Belum ditetapkan')}</p><p>Akses Mentor dan perangkat memerlukan otorisasi terpisah.</p><h3>Izin saat ini</h3><ul>${a.roles.map(g=>`<li>${esc(labels[g.role])} · ${esc(scopeText(g.scope))} · ${esc(labels[g.status])} <button class="btn" data-grant="${esc(g.id)}">Pilih penugasan ini</button></li>`).join('')||'<li>Belum ada penugasan</li>'}</ul><form id="msa-change"><fieldset><legend>Kontrol izin</legend><label for="msa-kind">Jenis perubahan<select id="msa-kind"><option value="role">Penugasan peran</option><option value="state">Status akun</option></select></label><div id="msa-role-fields" class="grid"><label for="msa-role">Peran<select id="msa-role">${Object.keys(labels).slice(0,4).map(r=>`<option value="${r}"${r==='pic'?' selected':''}>${esc(labels[r])}</option>`).join('')}</select></label><label for="msa-org">Organisasi<select id="msa-org"><option value="">Pilih organisasi</option>${data.organizations.map(o=>`<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('')}</select></label><label for="msa-program">Program<select id="msa-program"></select></label><label for="msa-event">Pelayanan<select id="msa-event"></select></label><label for="msa-grant-state">Status penugasan<select id="msa-grant-state"><option value="active">Berikan / aktifkan</option><option value="revoked">Cabut / turunkan</option></select></label></div><label for="msa-account-state" id="msa-state-label" hidden>Status akun<select id="msa-account-state">${['pending','active','rejected','suspended','disabled'].map(s=>`<option value="${s}"${s===a.state?' selected':''}>${labels[s]}</option>`).join('')}</select></label><label for="msa-reason">Alasan perubahan<textarea id="msa-reason" required minlength="5" maxlength="300"></textarea></label><button class="btn primary">Tinjau perubahan</button></fieldset></form></article>`;
  updateScopes();
}
function updateScopes(){
  const global=$('msa-role').value==='superadmin',org=data.organizations.find(o=>o.id===$('msa-org').value);
  $('msa-org').disabled=global;$('msa-program').disabled=global;$('msa-event').disabled=global;
  $('msa-program').innerHTML='<option value="">Semua program</option>'+(org?.programIds??[]).map(id=>`<option value="${esc(id)}">${esc(id)}</option>`).join('');updateEvents();
}
function updateEvents(){const org=data.organizations.find(o=>o.id===$('msa-org').value),program=$('msa-program').value;$('msa-event').innerHTML='<option value="">Semua pelayanan</option>'+(org?.events??[]).filter(e=>!program||e.programId===program).map(e=>`<option value="${esc(e.id)}">${esc(e.id)}</option>`).join('');}
async function action(fn){if(busy)return;busy=true;try{await fn();}catch(e){feedback(e.message);}finally{busy=false;}}
$('msa-login-form').onsubmit=e=>{e.preventDefault();void action(async()=>{const name=$('msa-name').value,password=$('msa-password').value;$('msa-password').value='';const legacy=$('msa-mode').value==='legacy';const result=await request(legacy?'/api/admin/login':'/api/a1/login',legacy?{email:name,password}:{username:name,password});token=result.token;const actor=await request('/api/a1/session');$('msa-actor').textContent=actor.legacy?'Sesi Admin lama · '+(labels[actor.role]??actor.role):'Sesi @'+actor.username;$('msa-login').hidden=true;$('msa-session').hidden=false;await load();feedback('Daftar pengguna diperiksa oleh server.');});};
$('msa-logout').onclick=()=>void action(async()=>{try{await request('/api/a1/logout',{});}finally{token='';location.reload();}});
$('msa-search').onsubmit=e=>{e.preventDefault();void action(load);};
$('msa-list').onclick=e=>{const id=e.target.closest('[data-user]')?.dataset.user;if(id)detail(id);};
$('msa-detail').onchange=e=>{if(e.target.id==='msa-kind'){$('msa-role-fields').hidden=e.target.value==='state';$('msa-state-label').hidden=e.target.value!=='state';}if(['msa-role','msa-org'].includes(e.target.id))updateScopes();if(e.target.id==='msa-program')updateEvents();};
$('msa-detail').onclick=e=>{const key=e.target.closest('[data-grant]')?.dataset.grant;if(!key)return;const a=data.accounts.find(a=>a.uid===selected),g=a.roles.find(g=>g.id===key);$('msa-kind').value='role';$('msa-role-fields').hidden=false;$('msa-state-label').hidden=true;$('msa-role').value=g.role;$('msa-org').value=g.scope.organizationId??'';updateScopes();$('msa-program').value=g.scope.programId??'';updateEvents();$('msa-event').value=g.scope.eventId??'';$('msa-grant-state').value='revoked';$('msa-reason').focus();};
$('msa-detail').onsubmit=e=>{e.preventDefault();if(busy)return;const a=data.accounts.find(a=>a.uid===selected),scope=$('msa-role').value==='superadmin'?{organizationId:null}:{organizationId:$('msa-org').value,...($('msa-program').value?{programId:$('msa-program').value}:{}),...($('msa-event').value?{eventId:$('msa-event').value}:{})};
  const value={expectedRevision:a.revision,requestId:crypto.randomUUID(),reason:$('msa-reason').value,...($('msa-kind').value==='state'?{state:$('msa-account-state').value}:{role:$('msa-role').value,scope,status:$('msa-grant-state').value})};
  pending={uid:a.uid,value};$('msa-confirm-copy').textContent=`${a.fullName} (@${a.username}): ${value.state?'ubah status menjadi '+labels[value.state]:labels[value.status]+' — '+labels[value.role]+' — '+scopeText(scope)}. Alasan: ${value.reason}`;$('msa-confirm').showModal();
};
$('msa-cancel').onclick=()=>{$('msa-confirm').close();pending=undefined;};
$('msa-apply').onclick=()=>void action(async()=>{if(!pending)return;const p=pending;await request('/api/a1/accounts/'+p.uid+'/change',p.value);pending=undefined;$('msa-confirm').close();await load();feedback('Perubahan tersimpan. Sesi lama akun tersebut tidak berlaku lagi.');});
$('msa-audit').onclick=()=>void action(async()=>{const result=await request('/api/a1/audit');$('msa-history').innerHTML='<h3>Audit perubahan terakhir</h3>'+result.events.map(e=>`<article><p>${esc(new Date(e.at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}))} WIB</p><p>Pelaku: <code>${esc(e.actorUid)}</code><br>Target: <code>${esc(e.targetUid)}</code></p><p>${esc(e.reason)}</p><pre>${esc(JSON.stringify({sebelum:e.previous,sesudah:e.next},null,2))}</pre></article>`).join('');});
const verify=()=>{if(token&&!busy)void action(()=>request('/api/a1/session'));};
window.addEventListener('focus',verify);setInterval(verify,45000);

void resumeMsaSession(async(profile,marker)=>{token=marker;$('msa-actor').textContent='@'+profile.username;$('msa-login').hidden=true;$('msa-session').hidden=false;await action(load);});
