import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminDevices,deviceContextsFrom,devicesFrom} from '../admin-devices.js';
import {createAdminClient} from '../admin-client.js';
const scope={schoolId:'s1',groupId:'g13',serviceSessionId:'demo-pakel-2026-10-09'};
const context={...scope,schoolName:'SDN Pacarkeling V',groupName:'Hagai',mentorName:'Kak Louis',serviceDate:'2026-10-09'};
const device={deviceId:'fictional-device',state:'active',createdAt:1,expiresAt:Date.now()+3600000,revokedAt:null,grants:[scope],lastEvent:{event:'pairing-redeemed',at:1,actor:'device-pairing'}};
function fixture(){
  const calls=[],code='x'.repeat(22),client={state:{phase:'active'},async readPairingContext(){return {contexts:[context]};},async readDevices(){return {devices:[device]};},async issuePairingCode(body){calls.push(body);return {code,pairingId:'a'.repeat(64),expiresAt:Date.now()+300000};},async revokeDevice(id){calls.push(id);return {deviceId:id,state:'revoked'};},async revokePairingCode(id){return {pairingId:id,state:'revoked'};}};
  const panel=createAdminDevices(client,()=>{}),select=()=>{panel.choose('school','s1');panel.choose('visit',scope.serviceSessionId);panel.choose('group','g13',true);};
  return {client,panel,calls,code,select};
}
test('Device projections discard keys, codes and private extras and reject malformed scope/audit data',()=>{
  assert.deepEqual(deviceContextsFrom({contexts:[{...context,privateProfile:'PRIVAT'}]}),[context]);
  assert.deepEqual(devicesFrom({devices:[{...device,code:'SECRET',publicKey:'SECRET',credential:'SECRET',privateProfile:'PRIVAT'}]}),[device]);
  for(const patch of [{deviceId:'../private'},{state:'unknown'},{expiresAt:{}},{grants:[scope,scope]},{lastEvent:{...device.lastEvent,actor:{secret:'PRIVAT'}}}])assert.throws(()=>devicesFrom({devices:[{...device,...patch}]}));
  assert.throws(()=>deviceContextsFrom({contexts:[context,context]}));
});
test('Issuance selects exact permitted scope, blocks duplicate clicks and reveals code once without putting it in state',async()=>{
  const f=fixture();await f.panel.load();f.select();let resume;const issue=f.client.issuePairingCode;
  f.client.issuePairingCode=async body=>{await new Promise(r=>{resume=r;});return issue(body);};
  const pending=f.panel.issue();assert.equal(f.panel.state.phase,'issuing');await f.panel.issue();assert.equal(f.calls.length,0);resume();await pending;
  assert.deepEqual(f.calls,[{grants:[scope],codeTtlMs:300000,grantTtlMs:3600000}]);assert.equal(f.panel.view().includes(f.code),true);assert.equal(JSON.stringify(f.panel.state).includes(f.code),false);
  f.panel.hideCode();assert.equal(f.panel.view().includes(f.code),false);f.panel.choose('group','g13',true);assert.equal(f.panel.view().includes(f.code),false);
  f.panel.choose('group','g1',true);assert.deepEqual(f.panel.state.groups,['g13']);
});
test('Expired/hidden codes cannot reappear, and logout/reset drops delayed issuance results',async()=>{
  const f=fixture();await f.panel.load();f.select();await f.panel.issue();const now=Date.now;
  try{Date.now=()=>now()+300001;f.panel.expireCode();assert.equal(f.panel.view().includes(f.code),false);}finally{Date.now=now;}
  let resume;f.client.issuePairingCode=async()=>{await new Promise(r=>{resume=r;});return {code:f.code,pairingId:'a'.repeat(64),expiresAt:Date.now()+300000};};
  const pending=f.panel.issue();f.client.state.phase='signed-out';f.panel.reset();resume();await pending;assert.equal(f.panel.state.phase,'idle');assert.equal(f.panel.view().includes(f.code),false);
});
test('Revocation requires explicit confirmation, waits for server readback, and API failure does not claim success',async()=>{
  const f=fixture();await f.panel.load();await f.panel.revoke(device.deviceId);assert.equal(f.calls.length,0);
  f.client.readDevices=async()=>({devices:[{...device,state:'revoked',revokedAt:Date.now()}]});await f.panel.revoke(device.deviceId,true);assert.equal(f.panel.state.devices[0].state,'revoked');
  const other=fixture();await other.panel.load();other.client.revokeDevice=async()=>{throw Error('SECRET');};await other.panel.revoke(device.deviceId,true);assert.equal(other.panel.state.phase,'error');assert.deepEqual(other.panel.state.devices,[]);assert.equal(other.panel.view().includes('SECRET'),false);
});
test('Permission/API failures clear device data and never fall back to local or canonical demo data',async()=>{
  const f=fixture();await f.panel.load();f.client.readDevices=async()=>{throw Object.assign(Error(),{status:403});};await f.panel.load();assert.equal(f.panel.state.phase,'error');assert.deepEqual(f.panel.state.devices,[]);
  const g=fixture();g.client.readDevices=async()=>({devices:[{...device,grants:[{...scope,groupId:'g1'}]}]});await g.panel.load();assert.equal(g.panel.state.phase,'error');
});
test('Admin device requests reuse the in-memory bearer, treat permission denial separately and stop after logout/expiry',async()=>{
  const calls=[];let status=200;
  const client=createAdminClient(()=>{},{request:async(path,options)=>{calls.push({path,options});return {status,ok:status===200,async json(){return path.endsWith('/login')?{token:'header.payload.',uid:'fictional-admin'}:path.endsWith('/session')?{uid:'fictional-admin',mode:'emulator-lokal'}:path.endsWith('/logout')?{signedOut:true}:{contexts:[context]};}};}});
  await client.login('fictional@example.invalid','fictional');await client.readPairingContext();assert.equal(calls.at(-1).options.headers.Authorization,'Bearer header.payload.');
  status=403;await assert.rejects(client.issuePairingCode({grants:[scope]}),e=>e.status===403);assert.equal(client.state.phase,'active');
  status=401;await assert.rejects(client.readDevices());assert.equal(client.state.phase,'expired');const count=calls.length;await assert.rejects(client.readDevices());assert.equal(calls.length,count);
});
