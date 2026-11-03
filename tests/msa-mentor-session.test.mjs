import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {createMentorSessions} from '../backend/msa-mentor-session.mjs';
import {mentorCors} from '../backend/mentor-origin.mjs';
import {renewalPlan,renewalFailure} from '../mentor-session-schedule.js';
import {createPrototypeServer} from '../server.mjs';
import {createAdminServer} from '../admin-server.mjs';
import {pilotEnvironment} from '../local-auth-pilot.mjs';

test('Mentor session enforces lifetime, cookie isolation, CSRF and transient failure without revocation',async t=>{
  const prior=process.env.ABC_MSA_SESSION_1A;process.env.ABC_MSA_SESSION_1A='1';t.after(()=>{if(prior===undefined)delete process.env.ABC_MSA_SESSION_1A;else process.env.ABC_MSA_SESSION_1A=prior;});
  let now=1000000,unavailable=false,pause=false,entered,release;const revoked=[],origin='http://127.0.0.1:4276',token=()=>randomBytes(32).toString('base64url');
  const mentor={enabled(){},async persistentLogin(){return {uid:'fictional',revision:1,refreshToken:'private-provider-token',token:token(),expiresAt:now+1800000,profile:{fullName:'Fiktif',mentorId:'m',groups:[]}};},async persistentRefresh(v){if(unavailable)throw Object.assign(Error('offline'),{status:503,adminAccountError:true});if(pause){entered();await new Promise(resolve=>{release=resolve;});}v.onRefresh('rotated-provider-token');return {uid:v.uid,revision:v.revision,refreshToken:'rotated-provider-token',token:token(),expiresAt:Math.min(now+1800000,v.sessionExpiresAt),profile:{fullName:'Fiktif',mentorId:'m',groups:[]}};},async revokeIssued(_uid,t){revoked.push(t);},forgetIssued(t){revoked.push(t);}};
  let sessions=createMentorSessions(mentor,{origin,now:()=>now});
  const server=http.createServer(async(req,res)=>{const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};try{if(!await sessions.handle(req,res,new URL(req.url,'http://127.0.0.1'),send))send(404,{});}catch(e){send(e.status??500,{error:e.message});}});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(async()=>{sessions.close();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});});
  const base='http://127.0.0.1:'+server.address().port;
  const call=(action,body,cookie,headers={})=>fetch(base+'/api/mentor-session/'+action,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-MSA-Mentor-Session':'1',...(cookie?{Cookie:cookie}:{}),...headers},body:JSON.stringify(body)});
  const a=await call('login',{username:'fiktif',password:'fiktif',persistent:true}),cookie=a.headers.get('set-cookie').split(';')[0],first=await a.json();assert.equal(a.status,200);assert.match(a.headers.get('set-cookie'),/HttpOnly; SameSite=Strict; Max-Age=2592000/);assert.ok(!JSON.stringify(first).includes('provider-token'));
  assert.equal((await call('restore',{},cookie,{Origin:'http://127.0.0.1:4277'})).status,403);assert.equal((await call('restore',{},cookie,{'X-MSA-Mentor-Session':'0'})).status,403);
  assert.equal((await call('restore',{},'msa_session_'+server.address().port+'='+randomBytes(32).toString('base64url'))).status,401);
  unavailable=true;assert.equal((await call('restore',{},cookie)).status,503);unavailable=false;const second=await call('restore',{},cookie);assert.equal(second.status,200);const current=await second.json();assert.ok(current.accessExpiresAt<=current.sessionExpiresAt);
  assert.equal((await call('logout',{},cookie)).status,200);assert.ok(revoked.includes(first.token)&&revoked.includes(current.token));assert.equal((await call('restore',{},cookie)).status,401);
  const race=await call('login',{username:'fiktif',password:'fiktif',persistent:true}),raceCookie=race.headers.get('set-cookie').split(';')[0];pause=true;const started=new Promise(resolve=>{entered=resolve;}),inFlight=call('restore',{},raceCookie);await started;assert.equal((await call('logout',{},raceCookie)).status,200);release();assert.equal((await inFlight).status,401);pause=false;assert.equal((await call('restore',{},raceCookie)).status,401);
  const b=await call('login',{username:'fiktif',password:'fiktif',persistent:false}),shared=b.headers.get('set-cookie');assert.doesNotMatch(shared,/Max-Age=/);now+=1800001;assert.equal((await call('restore',{},shared.split(';')[0])).status,401);
  const c=await call('login',{username:'fiktif',password:'fiktif',persistent:true}),longCookie=c.headers.get('set-cookie').split(';')[0];now+=30*24*60*60*1000+1;assert.equal((await call('restore',{},longCookie)).status,401);
  const old=await call('login',{username:'fiktif',password:'fiktif',persistent:true}),oldCookie=old.headers.get('set-cookie').split(';')[0],oldToken=(await old.json()).token;sessions.close();sessions=createMentorSessions(mentor,{origin,now:()=>now});assert.ok(revoked.includes(oldToken));assert.equal((await call('restore',{},oldCookie)).status,401);
});

test('Mentor session limit holds under concurrent logins and expired sessions are released without a new login',async t=>{
  const prior=process.env.ABC_MSA_SESSION_1A;process.env.ABC_MSA_SESSION_1A='1';t.after(()=>{if(prior===undefined)delete process.env.ABC_MSA_SESSION_1A;else process.env.ABC_MSA_SESSION_1A=prior;});
  let now=1000000,gate;const revoked=[],origin='http://127.0.0.1:4276',token=()=>randomBytes(32).toString('base64url'),opened=new Promise(resolve=>{gate=resolve;});
  const mentor={enabled(){},async persistentLogin(){await opened;return {uid:'fictional',revision:1,refreshToken:'private-provider-token',token:token(),expiresAt:now+1800000,profile:{fullName:'Fiktif',mentorId:'m',groups:[]}};},async revokeIssued(_uid,t){revoked.push(t);},forgetIssued(t){revoked.push(t);}};
  const sessions=createMentorSessions(mentor,{origin,now:()=>now,limit:2});
  const server=http.createServer(async(req,res)=>{const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};try{if(!await sessions.handle(req,res,new URL(req.url,'http://127.0.0.1'),send))send(404,{});}catch(e){send(e.status??500,{error:e.message});}});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(async()=>{sessions.close();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});});
  const base='http://127.0.0.1:'+server.address().port,call=(action,body,persistent=false)=>fetch(base+'/api/mentor-session/'+action,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-MSA-Mentor-Session':'1'},body:JSON.stringify(action==='login'?{username:'fiktif',password:'fiktif',persistent,...body}:body)});
  const pending=[1,2,3,4,5].map(()=>call('login',{}));await new Promise(resolve=>setTimeout(resolve,200));gate();
  const statuses=(await Promise.all(pending)).map(r=>r.status).sort();assert.deepEqual(statuses,[200,200,503,503,503]);
  const settled=await Promise.all([call('login',{})]);assert.equal(settled[0].status,503);
  now+=1800001;assert.equal(revoked.length,0);assert.equal((await call('restore',{})).status,401);assert.equal(revoked.length,2);
  assert.equal((await call('login',{})).status,200);
});

test('Visual Studio login preview includes the same enabled session option as the Mentor page',async()=>{
  const prior={...process.env};Object.assign(process.env,pilotEnvironment({},{unified:true}));
  const mentor=createPrototypeServer({mentorMode:true}),admin=createAdminServer({portal:true,adminAuthentication:{a1:{visual:{enabled(){}}},revoke(){}}});
  mentor.listen(0,'127.0.0.1');admin.listen(0,'127.0.0.1');await Promise.all([once(mentor,'listening'),once(admin,'listening')]);
  try{
    const live=await fetch('http://127.0.0.1:'+mentor.address().port+'/mentor-account.html'),preview=await fetch('http://127.0.0.1:'+admin.address().port+'/visual-preview-source/login');assert.equal(live.status,200);assert.equal(preview.status,200);
    for(const body of [await live.text(),await preview.text()]){assert.match(body,/id="account-remember"/);assert.match(body,/Tetap masuk di perangkat ini/);assert.match(body,/data-visual-slot="login"/);}
  }finally{await Promise.all([mentor,admin].map(s=>new Promise(resolve=>{s.close(resolve);s.closeAllConnections();})));for(const key of Object.keys(process.env))if(!(key in prior))delete process.env[key];Object.assign(process.env,prior);}
});

// Deterministic harness: real session routes, simulated clock, no timers.
async function sessionHarness(t,{limit}={}){
  const prior=process.env.ABC_MSA_SESSION_1A;process.env.ABC_MSA_SESSION_1A='1';t.after(()=>{if(prior===undefined)delete process.env.ABC_MSA_SESSION_1A;else process.env.ABC_MSA_SESSION_1A=prior;});
  const clock={now:1000000},revoked=[],origin='http://127.0.0.1:4276',token=()=>randomBytes(32).toString('base64url');
  // Like the real login, the access expiry is computed first and the session expiry a little later (Firestore round trips in between).
  const mentor={enabled(){},async persistentLogin(){const issuedAt=clock.now;clock.now+=250;return {uid:'fictional',revision:1,refreshToken:'private-provider-token',token:token(),expiresAt:issuedAt+1800000,profile:{fullName:'Fiktif',mentorId:'m',groups:[]}};},async persistentRefresh(v){v.onRefresh('rotated-provider-token');return {uid:v.uid,revision:v.revision,refreshToken:'rotated-provider-token',token:token(),expiresAt:Math.min(clock.now+1800000,v.sessionExpiresAt),profile:{fullName:'Fiktif',mentorId:'m',groups:[]}};},async revokeIssued(_uid,t){revoked.push(t);},forgetIssued(t){revoked.push(t);}};
  const sessions=createMentorSessions(mentor,{origin,now:()=>clock.now,...(limit?{limit}:{})});
  const server=http.createServer(async(req,res)=>{const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};try{if(!await sessions.handle(req,res,new URL(req.url,'http://127.0.0.1'),send))send(404,{});}catch(e){send(e.status??500,{error:e.message});}});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(async()=>{sessions.close();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});});
  const base='http://127.0.0.1:'+server.address().port,call=(action,body,cookie)=>fetch(base+'/api/mentor-session/'+action,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-MSA-Mentor-Session':'1',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(action==='login'?{username:'fiktif',password:'fiktif',persistent:false,...body}:body)});
  const login=async persistent=>{const response=await call('login',{persistent});assert.equal(response.status,200);return {cookie:response.headers.get('set-cookie').split(';')[0],...await response.json()};};
  return {clock,revoked,call,login};
}
// Mirrors mentor-account.js: renew only when the plan says so, stop once the server's session limit bounds the access token.
async function followPlan(h,first){
  let access=first.accessExpiresAt,end=first.sessionExpiresAt;const restores=[];
  for(let step=0;step<5000;step++){
    const plan=renewalPlan({now:h.clock.now,accessExpiresAt:access,sessionExpiresAt:end});if(plan.renewIn===null)return {restores,end,access,plan};
    h.clock.now+=plan.renewIn;const response=await h.call('restore',{},first.cookie);assert.equal(response.status,200);const value=await response.json();restores.push(h.clock.now);access=value.accessExpiresAt;end=value.sessionExpiresAt;
  }
  assert.fail('Jadwal pembaruan tidak berhenti.');
}

test('Renewal cadence stops at the server session limit and the UI fails closed at expiry',{timeout:120000},async t=>{
  const shared=await sessionHarness(t),start=shared.clock.now,a=await shared.login(false);
  const sharedRun=await followPlan(shared,a);
  assert.equal(sharedRun.restores.length,1,'sesi bersama 30 menit hanya perlu satu pembaruan');assert.equal(sharedRun.restores[0]-start,29*60000);
  assert.equal(sharedRun.plan.final,true);assert.equal(sharedRun.plan.onExpire,'signed-out');assert.equal(sharedRun.access,sharedRun.end);assert.equal(sharedRun.restores.filter(at=>at>sharedRun.end-60000).length,0);
  shared.clock.now=sharedRun.end;assert.equal((await shared.call('restore',{},a.cookie)).status,401);
  const long=await sessionHarness(t),begin=long.clock.now,b=await long.login(true),longRun=await followPlan(long,b);
  assert.ok(longRun.restores.length<=Math.ceil(30*24*60/29)+1,'jumlah pembaruan 30 hari wajar: '+longRun.restores.length);assert.ok(longRun.restores.length>1000);
  assert.equal(longRun.restores.filter(at=>at>longRun.end-60000).length,0,'tidak ada pembaruan di menit terakhir');assert.equal(longRun.plan.onExpire,'signed-out');assert.ok(longRun.end-begin<=30*24*60*60*1000+1000);
  long.clock.now=longRun.end;assert.equal((await long.call('restore',{},b.cookie)).status,401);
});

test('Renewal plan and failure mapping keep private data fail-closed',()=>{
  const now=1000000;
  assert.deepEqual(renewalPlan({now,accessExpiresAt:now+1800000,sessionExpiresAt:now+86400000}),{final:false,expireIn:1800000,renewIn:1740000,onExpire:'unavailable'});
  assert.deepEqual(renewalPlan({now,accessExpiresAt:now+30000,sessionExpiresAt:now+86400000}),{final:false,expireIn:30000,renewIn:1000,onExpire:'unavailable'});
  assert.deepEqual(renewalPlan({now,accessExpiresAt:now+60000,sessionExpiresAt:now+60000}),{final:true,expireIn:60000,renewIn:null,onExpire:'signed-out'});
  assert.equal(renewalPlan({now,accessExpiresAt:now-5,sessionExpiresAt:now+60000}).expireIn,0);
  for(const status of [401,403])assert.equal(renewalFailure({status,now,accessExpiresAt:now+1000}).action,'signed-out');
  assert.deepEqual(renewalFailure({status:429,now,accessExpiresAt:now+600000}),{action:'keep',retryIn:30000});
  assert.deepEqual(renewalFailure({status:429,now,accessExpiresAt:now+5000}),{action:'keep',retryIn:5000});
  assert.equal(renewalFailure({status:429,now,accessExpiresAt:now}).action,'unavailable');assert.equal(renewalFailure({status:429,now,accessExpiresAt:now-1}).action,'unavailable');
  for(const status of [500,503,undefined])assert.equal(renewalFailure({status,now,accessExpiresAt:now+600000}).action,'unavailable');
});

test('Bearer cap answers 429 without revoking valid bearers and recovers once they expire',async t=>{
  const h=await sessionHarness(t),first=await h.login(true),issued=[first.token];
  for(let i=0;i<63;i++){const response=await h.call('restore',{},first.cookie);assert.equal(response.status,200);issued.push((await response.json()).token);}
  assert.equal(new Set(issued).size,64);
  const limited=await h.call('restore',{},first.cookie);assert.equal(limited.status,429);assert.match((await limited.json()).error,/Terlalu banyak/);
  assert.equal(h.revoked.length,0,'429 tidak boleh mencabut bearer yang masih valid');
  assert.equal((await h.call('restore',{},first.cookie)).status,429,'tetap dibatasi selama bearer lama aktif');assert.equal(h.revoked.length,0);
  h.clock.now+=1800001;const recovered=await h.call('restore',{},first.cookie);assert.equal(recovered.status,200,'sesi tetap sah dan pulih setelah bearer lama kedaluwarsa');assert.equal(h.revoked.length,0);
  const other=await sessionHarness(t),second=await other.login(true),live=[second.token];
  for(let i=0;i<63;i++)live.push((await (await other.call('restore',{},second.cookie)).json()).token);
  assert.equal((await other.call('restore',{},second.cookie)).status,429);assert.equal((await other.call('logout',{},second.cookie)).status,200);
  assert.deepEqual([...other.revoked].sort(),[...live].sort(),'logout mencabut semua 64 bearer aktif');assert.equal((await other.call('restore',{},second.cookie)).status,401);
});

test('Session CORS never widens the shared header allow-list and only the session routes carry credentials',t=>{
  const prior=process.env.ABC_MSA_SESSION_1A;t.after(()=>{if(prior===undefined)delete process.env.ABC_MSA_SESSION_1A;else process.env.ABC_MSA_SESSION_1A=prior;});
  const origin='http://127.0.0.1:4276',preflight=(pathname,header,personal,method='POST',from=origin)=>mentorCors({method:'OPTIONS',headers:{origin:from,'access-control-request-method':method,'access-control-request-headers':header}},new URL('http://127.0.0.1'+pathname),origin,personal);
  process.env.ABC_MSA_SESSION_1A='1';
  assert.equal(preflight('/api/roster','x-msa-mentor-session',false,'GET').denied,true);
  assert.equal(preflight('/api/mentor-session/login','content-type, x-msa-mentor-session',false),null,'tanpa mode akun pribadi rute sesi tidak ada');
  assert.equal(preflight('/api/roster','x-msa-mentor-session',false,'GET').denied,true,'request sesi tidak mengubah daftar header bersama');
  assert.equal(preflight('/api/attendance','x-msa-mentor-session',true,'GET').denied,true);
  const allowed=preflight('/api/mentor-session/login','content-type, x-msa-mentor-session',true);
  assert.equal(allowed.headers['Access-Control-Allow-Credentials'],'true');assert.equal(allowed.headers['Access-Control-Allow-Origin'],origin);assert.match(allowed.headers['Access-Control-Allow-Headers'],/x-msa-mentor-session/);
  assert.equal(preflight('/api/a2-3/context','x-msa-mentor-session',true,'GET').denied,true,'header sesi tidak bocor ke rute lain setelah rute sesi dipakai');
  assert.equal(preflight('/api/a2-3/login','content-type',true).headers['Access-Control-Allow-Credentials'],undefined);
  assert.equal(preflight('/api/mentor-session/restore','content-type, x-msa-mentor-session',true,'POST','http://127.0.0.1:4277').denied,true);
  assert.equal(preflight('/api/mentor-session/restore','x-unlisted-header',true).denied,true,'header di luar daftar ditolak pada rute sesi');
  assert.equal(preflight('/api/roster','x-msa-mentor-session',false,'GET').denied,true);
  delete process.env.ABC_MSA_SESSION_1A;assert.equal(preflight('/api/mentor-session/login','content-type, x-msa-mentor-session',true),null,'flag mati: rute sesi tidak tersedia');
});
