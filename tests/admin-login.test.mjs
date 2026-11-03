import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import http from 'node:http';
import {createAdminServer} from '../admin-server.mjs';
import {createRosterServer} from '../backend/server.mjs';
async function start(t,server){server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));return 'http://127.0.0.1:'+server.address().port;}
test('Admin shell exposes only its own assets and protected API, without demo or service worker',async t=>{
  const base=await start(t,createAdminServer({adminAuthentication:{async authorize(){return {kind:'unauthenticated'};}}}));
  const response=await fetch(base);assert.equal(response.status,200);assert.match(await response.text(),/data-admin-mode="authenticated-local"/);assert.equal(response.headers.get('cache-control'),'no-store');
  for(const path of ['/app.js','/data.js','/sw.js','/mentor.html','/backend/admin-auth.mjs','/api/admin/students','/api/attendance','/local-demo.mjs','/provision-demo.mjs','/Reset%20Admin%20Password.cmd','/api/admin/recover-password'])assert.equal((await fetch(base+path)).status,404);
  for(const path of ['/api/admin/pairing-codes','/api/admin/devices','/api/admin/pairing-context'])assert.equal((await fetch(base+path)).status,401);
  assert.equal((await fetch(base+'/api/admin/session')).status,401);
  const cross=await fetch(base+'/api/admin/login',{method:'POST',headers:{Origin:'http://127.0.0.1:4173','Content-Type':'application/json'},body:'{}'});assert.equal(cross.status,403);assert.equal(cross.headers.get('access-control-allow-origin'),null);
  const hostStatus=await new Promise((resolve,reject)=>{const request=http.get(base,{headers:{Host:'example.invalid'}},r=>{r.resume();resolve(r.statusCode);});request.once('error',reject);});
  assert.equal(hostStatus,403);
  const api=await start(t,createRosterServer({adminAuthentication:{async authorize(){return {kind:'unauthenticated'};}}}));
  assert.equal((await fetch(api+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
});
test('Login/logout enforce input limits, origin, methods and a bounded attempt budget',async t=>{
  let issued=0;
  const base=await start(t,createAdminServer({adminAuthentication:{async signIn(){issued++;throw Error();},async authorize(){return {kind:'unauthenticated'};}}}));
  const request=(body,headers={})=>fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json',...headers},body});
  assert.equal((await fetch(base+'/api/admin/login')).status,405);
  assert.equal((await request('x')).status,400);assert.equal((await request('{}',{'Content-Type':'text/plain'})).status,400);assert.equal((await request(JSON.stringify({password:'x'.repeat(4200)}))).status,413);
  assert.equal((await request(JSON.stringify({email:'fictional@example.invalid',password:'fictional',uid:'admin',role:'admin'}))).status,400);assert.equal(issued,0);
  for(let n=0;n<6;n++)assert.equal((await request(JSON.stringify({email:'fictional@example.invalid',password:'fictional'}))).status,401);
  assert.equal((await request('{}')).status,429);assert.equal(issued,6);
});
test('Unavailable authentication and a revoked token during login return safe errors without a bearer',async t=>{
  let unavailable=true,revoked=false;
  const base=await start(t,createAdminServer({adminAuthentication:{async signIn(){if(unavailable)throw Object.assign(Error('UPSTREAM_SECRET'),{status:503});return 'fictional-token';},async authorize(){return {kind:'unauthenticated'};},revoke(){revoked=true;}}}));
  const request=()=>fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'fictional@example.invalid',password:'fictional'})});
  const offline=await request();assert.equal(offline.status,503);assert.equal((await offline.json()).token,undefined);
  unavailable=false;const response=await request();assert.equal(response.status,401);assert.equal((await response.json()).token,undefined);assert.equal(revoked,true);
});
