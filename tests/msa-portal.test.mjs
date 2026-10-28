import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createPortalSessions} from '../backend/msa-portal-session.mjs';
import {listen} from '../local-demo.mjs';

test('Portal cookie preserves trusted admission, origin/CSRF boundary, revocation, expiry and logout',async()=>{
  let now=1000,valid=true,revoked=0;
  const token='a'.repeat(43),denied=()=>{throw Object.assign(Error('Ditolak'),{status:403});};
  const authentication={revoke:t=>{assert.equal(t,token);revoked++;},authorize:async()=>({kind:'ok',role:'pic',uid:'fictional-pic',revision:1}),a1:{
    login:async v=>{assert.deepEqual(v,{username:'fictional.pic',password:'fictional-password'});return {token};},
    authorize:async header=>{assert.equal(header,'Bearer '+token);if(!valid)throw Object.assign(Error('Sesi berakhir'),{status:401});return {uid:'fictional-pic',revision:1,username:'fictional.pic'};},
    accounts:{list:denied},registration:{queue:denied},recovery:{queue:denied},
    core:{catalog:async()=>({organizations:[{}]})},events:{catalog:async()=>({organizations:[{}]})}
  }};
  const sessions=createPortalSessions(authentication,{now:()=>now});
  const server=await listen(http.createServer(async(req,res)=>{if(await sessions.handle(req,res,new URL(req.url,'http://127.0.0.1')))return;res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({authorized:req.headers.authorization==='Bearer '+token&&req.rawHeaders.filter((v,i)=>i%2===0&&v.toLowerCase()==='authorization').length===1}));}),0);
  const origin='http://127.0.0.1:'+server.address().port;
  const request=(path,{cookie,body,headers={}}={})=>fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{'X-MSA-Portal':'1',Origin:origin,...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  try{
    assert.equal((await request('/api/portal/session')).status,401);
    const login=async()=>{const r=await request('/api/portal/login',{body:{username:'fictional.pic',password:'fictional-password'}});assert.equal(r.status,200);const c=r.headers.get('set-cookie');assert.match(c,/HttpOnly; SameSite=Strict/);const profile=await r.json();assert.equal(profile.token,undefined);assert.equal(profile.role,'pic');assert.ok(!JSON.stringify(profile).includes(token));assert.deepEqual(profile.modules.map(m=>m.href),['/msa-events.html','/msa-core.html','/username.html']);return c.split(';')[0];};
    const cookie=await login();
    assert.equal((await request('/api/portal/session',{cookie})).status,200);
    assert.deepEqual(await (await request('/api/portal/dispatch/api/stage8/organizations',{cookie})).json(),{authorized:true});
    assert.deepEqual(await (await request('/api/portal/dispatch/api/visual/login',{cookie})).json(),{authorized:true});
    assert.equal((await request('/api/portal/dispatch/api/visual/login/draft',{cookie,body:{},headers:{Origin:'http://evil.invalid'}})).status,403);
    assert.equal((await request('/api/portal/dispatch/api/visual/login/preview')).status,401);
    for(const headers of [{Origin:'http://evil.invalid'},{'Sec-Fetch-Site':'cross-site'},{'X-MSA-Portal':''},{Authorization:'Bearer portal-session'}])assert.equal((await request('/api/portal/session',{cookie,headers})).status,403);
    assert.equal((await request('/api/portal/logout',{cookie,body:{},headers:{Origin:''}})).status,403);
    assert.equal((await request('/api/portal/session?token=ignored',{cookie})).status,400);
    valid=false;assert.equal((await request('/api/portal/session',{cookie})).status,401);assert.equal((await request('/api/portal/dispatch/api/stage8/organizations',{cookie})).status,401);valid=true;
    now+=1800001;assert.equal((await request('/api/portal/session',{cookie})).status,401);assert.equal(revoked,1);
    const fresh=await login();assert.equal((await request('/api/portal/logout',{cookie:fresh,body:{}})).status,200);assert.equal((await request('/api/portal/session',{cookie:fresh})).status,401);assert.equal(revoked,2);
    assert.equal((await request('/api/portal/session',{cookie:'msa_session_'+server.address().port+'=forged'})).status,401);
  }finally{sessions.close();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
});
