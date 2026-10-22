import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminClient} from '../admin-client.js';
const response=(status,value={})=>({status,ok:status>=200&&status<300,async json(){return value;}});
function fixture(){
  const calls=[],token='fictional_header.fictional_payload.',identity={uid:'fictional-admin',mode:'emulator-lokal'};
  let handler=async path=>response(200,path.endsWith('login')?{token,...identity}:path.endsWith('logout')?{signedOut:true}:identity);
  const client=createAdminClient(()=>{},{request:async(path,options)=>{calls.push({path,options});return handler(path,options);}});
  return {client,calls,token,identity,setHandler:fn=>{handler=fn;}};
}
test('Admin login is verified by the protected API, exposes no token in state and logout prevents further requests',async()=>{
  const f=fixture();await f.client.login('fictional@example.invalid','fictional-password');assert.equal(f.client.state.phase,'active');assert.equal(Object.hasOwn(f.client.state,'token'),false);
  assert.deepEqual(f.calls.map(c=>c.path),['/api/admin/login','/api/admin/session']);assert.equal(f.calls[1].options.headers.Authorization,'Bearer '+f.token);
  for(const {options} of f.calls){assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');}
  await f.client.logout();assert.equal(f.client.state.phase,'signed-out');const length=f.calls.length;await f.client.verify();assert.equal(f.calls.length,length);
});
test('Invalid credentials, unauthorized UID, expired/revoked session and API failure never activate admin',async()=>{
  for(const status of [401,403,500]){
    const f=fixture();f.setHandler(async()=>response(status));await f.client.login('fictional@example.invalid','fictional-password');assert.notEqual(f.client.state.phase,'active');assert.equal(f.calls.length,1);
  }
  for(const status of [401,403]){const f=fixture();await f.client.login('fictional@example.invalid','fictional-password');f.setHandler(async()=>response(status));await f.client.verify();assert.equal(f.client.state.phase,'expired');assert.equal(f.client.state.uid,undefined);}
  const f=fixture();await f.client.login('fictional@example.invalid','fictional-password');f.setHandler(async()=>{throw Error('API gagal');});await f.client.verify();assert.equal(f.client.state.phase,'error');assert.equal(f.client.state.uid,undefined);
});
test('Logout errors block login and protected reads until server revocation is confirmed',async()=>{
  const f=fixture();await f.client.login('fictional@example.invalid','fictional-password');f.setHandler(async()=>{throw Error();});await f.client.logout();assert.equal(f.client.state.phase,'logout-error');
  const length=f.calls.length;await f.client.verify();await f.client.login('fictional@example.invalid','fictional-password');assert.equal(f.calls.length,length);
  f.setHandler(async()=>response(200,{signedOut:true}));await f.client.logout();assert.equal(f.client.state.phase,'signed-out');assert.equal(f.calls.at(-1).options.headers.Authorization,'Bearer '+f.token);
});
test('Delayed session responses and duplicate clicks cannot reopen the dashboard after logout',async()=>{
  const f=fixture();let resume;f.setHandler(async path=>path.endsWith('login')?response(200,{token:f.token,...f.identity}):new Promise(resolve=>{resume=()=>resolve(response(200,f.identity));}));
  const login=f.client.login('fictional@example.invalid','fictional-password');await new Promise(resolve=>setImmediate(resolve));
  await f.client.login('fictional@example.invalid','fictional-password');assert.equal(f.calls.filter(c=>c.path.endsWith('login')).length,1);
  f.setHandler(async()=>response(200,{signedOut:true}));await f.client.logout();resume();await login;assert.equal(f.client.state.phase,'signed-out');
});
test('Malformed protected responses fail closed and cannot be replaced by a fresh login without closing the pending session',async()=>{
  const f=fixture();f.setHandler(async path=>response(200,path.endsWith('login')?{token:f.token,...f.identity}:{...f.identity,mode:'production',privateProfile:'PRIVAT'}));
  await f.client.login('fictional@example.invalid','fictional-password');assert.equal(f.client.state.phase,'error');assert.equal(f.client.state.uid,undefined);assert.equal(f.client.state.canVerify,true);
  const length=f.calls.length;await f.client.login('fictional@example.invalid','fictional-password');assert.equal(f.calls.length,length);
});
