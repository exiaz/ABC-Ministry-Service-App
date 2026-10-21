import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {emulatorFixture} from './fixture.mjs';
import {fictionalRosterData,scope} from '../fixtures/roster.mjs';
import {createAuthorizedRosterRepository} from '../../backend/repositories.mjs';
import {createRosterServer} from '../../backend/server.mjs';

async function fixture(t,now=Date.now){const c=await emulatorFixture({source:fictionalRosterData(),now});t.after(c.close);return c;}
const hash=token=>createHash('sha256').update(token).digest('hex');

test('Trusted device issuance validates relations, hashes credentials and atomically appends minimal audit',async t=>{
  const c=await fixture(t),deviceId='fictional-device-1';
  for(const grants of [[],[{...scope,schoolId:'s2'}],[{...scope,groupId:'g4'}],[{...scope,serviceSessionId:'unknown'}],[{...scope,groupId:'*'}]]){
    await assert.rejects(c.deviceAuthorization.issue({deviceId,grants}));
  }
  assert.equal((await c.root.collection('credentials').get()).size,0);assert.equal((await c.root.collection('authorizationEvents').get()).size,0);
  const token=await c.deviceAuthorization.issue({deviceId,grants:[scope]});
  assert.ok(await c.credentials.authenticate('Bearer '+token));
  const entry=(await c.root.collection('credentials').doc(hash(token)).get()).data();
  assert.equal(entry.deviceId,deviceId);assert.equal(JSON.stringify(entry).includes(token),false);
  const events=await c.root.collection('authorizationEvents').get();assert.equal(events.size,1);
  assert.deepEqual(Object.keys(events.docs[0].data()).sort(),['actor','at','credentialId','deviceId','event']);
  assert.equal(events.docs[0].data().event,'credential-issued');assert.equal(events.docs[0].data().credentialId,hash(token));
  assert.equal(JSON.stringify(events.docs[0].data()).includes(token),false);
});

test('Device revocation blocks every credential and reissuance; credential revocation is idempotent',async t=>{
  const c=await fixture(t),deviceId='fictional-device-2';
  const a=await c.deviceAuthorization.issue({deviceId,grants:[scope]}),b=await c.deviceAuthorization.issue({deviceId,grants:[scope]});
  assert.equal(await c.credentials.revoke(a),true);assert.equal(await c.credentials.revoke(a),false);
  assert.equal(await c.credentials.authenticate('Bearer '+a),null);assert.ok(await c.credentials.authenticate('Bearer '+b));
  assert.equal(await c.deviceAuthorization.revoke(deviceId),true);assert.equal(await c.deviceAuthorization.revoke(deviceId),false);
  assert.equal(await c.credentials.authenticate('Bearer '+b),null);
  await assert.rejects(c.deviceAuthorization.issue({deviceId,grants:[scope]}));
  assert.equal((await c.root.collection('authorizationEvents').get()).size,4);
});

test('Expiry, missing device and legacy unbound credentials deny without private fields or per-request audit growth',async t=>{
  let time=1000;const c=await fixture(t,()=>time),deviceId='fictional-device-3';
  const token=await c.deviceAuthorization.issue({deviceId,grants:[scope],ttlMs:100});
  const authorized=createAuthorizedRosterRepository(c);
  assert.deepEqual((await authorized.readAuthorized('Bearer '+token,scope)).roster.students,[{id:'fictional-1',name:'Siswa Fiktif Snapshot',schoolClass:'4A'}]);
  for(const change of [{schoolId:'s2'},{groupId:'g2'},{serviceSessionId:'unknown'}])assert.equal((await authorized.readAuthorized('Bearer '+token,{...scope,...change})).kind,'forbidden');
  time=1100;assert.equal((await authorized.readAuthorized('Bearer '+token,scope)).kind,'unauthenticated');
  const current=await c.deviceAuthorization.issue({deviceId,grants:[scope]});
  await c.root.collection('devices').doc(deviceId).delete();
  assert.equal(await c.credentials.authenticate('Bearer '+current),null);
  const legacy='L'.repeat(43);await c.root.collection('credentials').doc(hash(legacy)).create({expiresAt:99999,revokedAt:null,grants:[scope]});
  assert.equal(await c.credentials.authenticate('Bearer '+legacy),null);
  assert.equal((await c.root.collection('authorizationEvents').get()).size,2);
});

test('Device revocation persists across a real API process restart',async t=>{
  const c=await fixture(t),token=await c.deviceAuthorization.issue({deviceId:'fictional-restart-device',grants:[scope]});
  async function start(){
    const child=fork(fileURLToPath(new URL('./server-process.mjs',import.meta.url)),[],{env:{...process.env,ABC_FIRESTORE_NAMESPACE:c.config.namespace},stdio:['ignore','ignore','inherit','ipc'],windowsHide:true});
    const ready=await Promise.race([once(child,'message'),once(child,'exit').then(()=>{throw Error('API uji berhenti sebelum siap.');})]);
    const stop=async()=>{if(child.exitCode!==null)return;const done=once(child,'exit');child.send('stop');await done;};
    t.after(stop);return {base:'http://127.0.0.1:'+ready[0].port,stop};
  }
  const first=await start(),path='/api/roster?'+new URLSearchParams(scope),headers={Authorization:'Bearer '+token};
  assert.equal((await fetch(first.base+path,{headers})).status,200);await first.stop();
  await c.deviceAuthorization.revoke('fictional-restart-device');
  const second=await start();assert.equal((await fetch(second.base+path,{headers})).status,401);
});

test('Neither unauthenticated nor mentor requests can access grant, device admin or audit endpoints',async t=>{
  const c=await fixture(t),token=await c.deviceAuthorization.issue({deviceId:'fictional-http-device',grants:[scope]});
  const server=createRosterServer(c);server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  for(const path of ['/api/grants','/api/devices','/api/admin/grants','/api/audit','/backend/firestore-emulator.mjs']){
    for(const headers of [{},{Authorization:'Bearer '+token}]){
      assert.equal((await fetch('http://127.0.0.1:'+server.address().port+path,{method:'POST',headers})).status,404);
    }
  }
});
