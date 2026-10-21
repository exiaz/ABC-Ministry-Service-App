import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {createRosterServer} from '../backend/server.mjs';
import {createTestCredentialStore} from '../backend/access-control.mjs';
import {createRosterRepository} from '../backend/roster.mjs';
import {createPrototypeServer} from '../server.mjs';
import {scope,fictionalRosterData} from './fixtures/roster.mjs';

const route=values=>'/api/roster?'+new URLSearchParams(values);
async function start(t,server){
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeAllConnections();}));
  return 'http://127.0.0.1:'+server.address().port;
}
async function setup(t){
  let time=1000;
  const credentials=createTestCredentialStore({now:()=>time});
  const token=credentials.issue({grants:[scope],ttlMs:100});
  const data=fictionalRosterData(),before=structuredClone(data);
  const base=await start(t,createRosterServer({credentials,repository:createRosterRepository(data)}));
  const request=(path=route(scope),options={})=>fetch(base+path,{...options,headers:{Authorization:'Bearer '+token,...options.headers}});
  return {base,request,credentials,token,data,before,expire:()=>{time=1100;}};
}

test('Authorized roster returns only the minimum fields, without cache or CORS permission',async t=>{
  const {request,data,before}=await setup(t),response=await request();
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'),null);
  assert.equal(response.headers.get('x-abc-mode'),'test-foundation');
  assert.deepEqual(await response.json(),{...scope,students:[{id:'fictional-1',name:'Siswa Fiktif Snapshot',schoolClass:'4A'}]});
  assert.deepEqual(data,before);
});

test('Missing and spoofed browser identities are rejected without a valid server credential',async t=>{
  const {base,token}=await setup(t);
  for(const headers of [{},{Authorization:'Bearer ABC2026'},{Authorization:'Bearer '+'x'.repeat(43)},{'X-Admin':'true','X-Device-Authorized':'true',Cookie:'authorized=true; adminUnlocked=true'},{Cookie:'token='+token}]){
    const response=await fetch(base+route(scope),{headers});
    assert.equal(response.status,401);assert.equal(response.headers.get('www-authenticate'),'Bearer');
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.deepEqual(Object.keys(await response.json()),['error']);
  }
  const response=await fetch(base+route({...scope,admin:'true',authorized:'true',code:'ABC2026'}));
  assert.equal(response.status,401);
  assert.equal((await fetch(base+route({...scope,token}))).status,401);
});

test('Expiry is checked at the boundary on every request',async t=>{
  const {request,expire}=await setup(t);
  assert.equal((await request()).status,200);expire();
  assert.equal((await request()).status,401);
});

test('Revocation takes effect on the next request without restarting the listener',async t=>{
  const {request,credentials,token}=await setup(t);
  assert.equal((await request()).status,200);credentials.revoke(token);
  assert.equal((await request()).status,401);
});

test('A valid token cannot select another school, group, session or nonexistent scope',async t=>{
  const {request}=await setup(t);
  for(const changes of [{schoolId:'s2'},{groupId:'g2'},{serviceSessionId:'demo-pakel-2026-10-23'},{serviceSessionId:'unknown'}]){
    const response=await request(route({...scope,...changes}));
    assert.equal(response.status,403);assert.deepEqual(await response.json(),{error:'Akses roster ditolak.'});
  }
});

test('Invalid or ambiguous scope parameters and browser escalation flags are rejected',async t=>{
  const {request}=await setup(t);
  for(const target of [route({...scope,admin:'true'}),route({...scope,groupId:'*'}),route({...scope,serviceSessionId:''}),route(scope)+'&groupId=g2','/api/roster?schoolId=s1']){
    assert.equal((await request(target)).status,400);
  }
});

test('Even server grants cannot bypass school/group/session relationship validation',async t=>{
  const {request,credentials}=await setup(t);
  const badScope={...scope,schoolId:'s2'},token=credentials.issue({grants:[badScope]});
  assert.equal((await request(route(badScope),{headers:{Authorization:'Bearer '+token}})).status,403);
});

test('Only GET roster exists: writes, registration, private APIs, and direct static access are denied',async t=>{
  const {request,base,token}=await setup(t);
  for(const method of ['POST','PUT','PATCH','DELETE','HEAD','OPTIONS']){
    const response=await request(route(scope),{method});assert.equal(response.status,405);assert.equal(response.headers.get('allow'),'GET');
  }
  for(const target of ['/','/index.html','/data.js','/app.js','/sw.js','/student-data.js','/backend/access-control.mjs','/backend/roster.mjs','/tests/fixtures/roster.mjs','/MASTER_BRIEF.md','/.env','/.git/config','/%2e%2e/data.js','/api/register-device','/api/credentials','/api/students/private']){
    for(const headers of [{},{Authorization:'Bearer '+token}]){
      const response=await fetch(base+target,{headers});assert.equal(response.status,404,target);
      assert.equal(response.headers.get('cache-control'),'no-store');
      assert.deepEqual(await response.json(),{error:'Tidak ditemukan.'});
    }
  }
});

test('Duplicate Authorization headers cannot supply an ambiguous identity',async t=>{
  const {base,token}=await setup(t);
  const status=await new Promise((resolve,reject)=>{
    const req=http.get(base+route(scope),{headers:{Authorization:['Bearer '+token,'Bearer '+token]}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);
  });
  assert.equal(status,401);
});

test('Unconfigured startup denies all access; internal errors do not leak data or credentials',async t=>{
  const base=await start(t,createRosterServer());
  assert.equal((await fetch(base+route(scope),{headers:{Authorization:'Bearer ABC2026'}})).status,401);
  const credentials=createTestCredentialStore(),token=credentials.issue({grants:[scope]});
  const errorBase=await start(t,createRosterServer({credentials,repository:{read(){throw Error('WALI_FIKTIF_PRIVAT '+token);}}}));
  const response=await fetch(errorBase+route(scope),{headers:{Authorization:'Bearer '+token}});
  assert.equal(response.status,500);assert.deepEqual(await response.json(),{error:'Roster tidak dapat dibaca.'});
  const malformed=fictionalRosterData();malformed.sessions[0].records[0].name={guardianName:'WALI_FIKTIF_PRIVAT'};
  const malformedBase=await start(t,createRosterServer({credentials,repository:createRosterRepository(malformed)}));
  const invalid=await fetch(malformedBase+route(scope),{headers:{Authorization:'Bearer '+token}});
  assert.equal(invalid.status,500);assert.deepEqual(await invalid.json(),{error:'Roster tidak dapat dibaca.'});
});

test('Legacy frontend remains fictional and insecure, and cannot serve backend modules or API fixtures',async t=>{
  const base=await start(t,createPrototypeServer());
  const home=await fetch(base+'/');assert.equal(home.status,200);assert.equal(home.headers.get('x-abc-mode'),'fictional-prototype');
  const data=await fetch(base+'/data.js');assert.equal(data.status,200);assert.match(await data.text(),/Alya Putri/);
  const app=await (await fetch(base+'/app.js')).text();
  assert.match(app,/localStorage\.getItem/);assert.match(app,/ABC2026/);assert.match(app,/studentPrivateProfiles/);
  assert.equal((await fetch(base+'/sw.js')).status,200);
  for(const target of [route(scope),'/backend/access-control.mjs','/backend/roster.mjs','/tests/fixtures/roster.mjs','/.env','/.git/config']){
    assert.equal((await fetch(base+target)).status,404,target);
  }
});
