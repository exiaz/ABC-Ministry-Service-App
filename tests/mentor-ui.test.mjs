import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createRosterServer} from '../backend/server.mjs';
import {createPrototypeServer} from '../server.mjs';

async function start(t,server){server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));return 'http://127.0.0.1:'+server.address().port;}
test('Mentor CORS is explicit, loopback-only, scoped to redeem/status, and grants no administrative access',async t=>{
  for(const mentorOrigin of ['https://example.invalid','http://localhost:4176','http://127.0.0.1:4173','http://127.0.0.1:65536'])assert.throws(()=>createRosterServer({mentorOrigin}));
  const origin='http://127.0.0.1:4176',base=await start(t,createRosterServer({mentorOrigin:origin}));
  const response=await fetch(base+'/api/pairing/redeem',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,x-device-nonce,x-device-signature,x-device-timestamp'}});
  assert.equal(response.status,204);assert.equal(response.headers.get('access-control-allow-origin'),origin);assert.equal(response.headers.get('access-control-allow-credentials'),null);
  const forbidden=await fetch(base+'/api/pairing/redeem',{method:'OPTIONS',headers:{Origin:'http://127.0.0.1:4173','Access-Control-Request-Method':'POST'}});assert.equal(forbidden.status,403);assert.equal(forbidden.headers.get('access-control-allow-origin'),null);
  const arbitrary=await fetch(base+'/api/device/status',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'DELETE'}});assert.equal(arbitrary.status,403);
  const admin=await fetch(base+'/api/admin/pairing-codes',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});assert.equal(admin.status,503);assert.equal(admin.headers.get('access-control-allow-origin'),null);
  const status=await fetch(base+'/api/device/status',{headers:{Origin:origin}});assert.equal(status.status,401);assert.equal(status.headers.get('access-control-allow-origin'),origin);
});
test('Paired mentor shell and legacy demo remain separate; neither frontend serves the API or backend',async t=>{
  const paired=await start(t,createPrototypeServer({mentorMode:true})),legacy=await start(t,createPrototypeServer());
  const page=await fetch(paired);assert.equal(page.headers.get('x-abc-mode'),'paired-local-fictional-roster');assert.match(await page.text(),/data-mentor-mode="paired-local"/);
  assert.doesNotMatch(await (await fetch(legacy)).text(),/data-mentor-mode="paired-local"/);
  for(const base of [paired,legacy])for(const route of ['/api/admin/pairing-codes','/api/pairing/redeem','/backend/admin-auth.mjs','/tests/emulator/fixture.mjs'])assert.equal((await fetch(base+route)).status,404);
});
