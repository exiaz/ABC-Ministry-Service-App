import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {createMentorSessions} from '../backend/msa-mentor-session.mjs';
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
