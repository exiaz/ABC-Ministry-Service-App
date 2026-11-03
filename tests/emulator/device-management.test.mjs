import test from 'node:test';
import assert from 'node:assert/strict';
import {GROUP_CONFIG,SCHOOL_CONFIG} from '../../group-config.js';
import {deviceManagementFixture,hagai} from './device-management-fixture.mjs';
const issue=async(f,grants=[hagai],extra={})=>{const r=await f.admin('/api/admin/pairing-codes',{grants,...extra});assert.equal(r.status,201);return r.json();};
test('Pairing context returns the three canonical schools, 16 stable groups and effective mentor subtitles without student data',async t=>{
  const f=await deviceManagementFixture(t),r=await f.admin('/api/admin/pairing-context');assert.equal(r.status,200);const {contexts}=await r.json();
  assert.equal(contexts.length,16);assert.deepEqual([...new Set(contexts.map(s=>s.schoolId))],SCHOOL_CONFIG.map(s=>s.id));
  assert.deepEqual(contexts.map(s=>s.groupId),GROUP_CONFIG.map(g=>g.id));
  assert.equal(contexts.find(s=>s.groupId==='g13').mentorName,'Kak Louis');assert.equal(contexts.find(s=>s.groupId==='g13').groupName,'Hagai');
  assert.deepEqual(Object.keys(contexts[0]).sort(),['schoolId','groupId','serviceSessionId','schoolName','groupName','mentorName','serviceDate'].sort());
  assert.equal(JSON.stringify(contexts).includes('PRIVAT_DILARANG'),false);assert.equal((await f.root.collection('devices').get()).size,0);assert.equal((await f.root.collection('sessions').get()).size,0);
  await f.root.collection('adminPairingPermissions').doc(f.uid).set({active:true,grants:[{...hagai,schoolId:'s2'}]});assert.equal((await f.admin('/api/admin/pairing-context')).status,403);
});
test('Authorized issuance is single-use, mentor proof/scopes remain compatible, and device listing projects minimal audit only',async t=>{
  const f=await deviceManagementFixture(t),code=await issue(f);assert.equal(/^[A-Za-z0-9_-]{22}$/.test(code.code),true);
  assert.equal((await f.admin('/api/admin/devices')).status,200);
  const redeemed=await f.redeem(code.code);assert.equal(redeemed.status,201);const device=await redeemed.json();
  assert.equal((await f.redeem(code.code)).status,400);assert.equal((await f.mentor(device.credential)).status,200);assert.equal((await f.mentor(device.credential,{...hagai,groupId:'g1'})).status,403);
  await f.root.collection('devices').doc(device.deviceId).update({rawCode:'SHOULD_NOT_LEAK',guardianName:'PRIVAT_DILARANG'});
  const r=await f.admin('/api/admin/devices');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('access-control-allow-origin'),null);
  const list=await r.json();assert.equal(list.devices.length,1);assert.deepEqual(list.devices[0].grants,[hagai]);assert.equal(list.devices[0].state,'active');assert.equal(list.devices[0].lastEvent.event,'pairing-redeemed');
  assert.deepEqual(Object.keys(list.devices[0]).sort(),['deviceId','state','expiresAt','createdAt','revokedAt','grants','lastEvent'].sort());
  const text=JSON.stringify(list);for(const secret of [code.code,device.credential,'SHOULD_NOT_LEAK','PRIVAT_DILARANG','publicKey','credentialId'])assert.equal(text.includes(secret),false);
  const revoked=await f.admin('/api/admin/devices/'+device.deviceId+'/revoke',{});assert.equal(revoked.status,200);assert.equal((await f.mentor(device.credential)).status,401);
  const after=await (await f.admin('/api/admin/devices')).json();assert.equal(after.devices[0].state,'revoked');assert.equal(after.devices[0].lastEvent.actor,f.uid);assert.ok(Number.isSafeInteger(after.devices[0].revokedAt));
  assert.equal((await f.root.collection('students').get()).size,1);assert.equal((await f.root.collection('sessions').get()).size,0);
});
test('Unauthenticated, unauthorized and partially scoped operators cannot issue or revoke another scope',async t=>{
  const f=await deviceManagementFixture(t),other={...hagai,groupId:'g1'},code=await issue(f,[hagai,other]),r=await f.redeem(code.code);assert.equal(r.status,201);const device=await r.json();
  for(const target of ['/api/admin/pairing-context','/api/admin/devices'])assert.equal((await f.admin(target,undefined,'Bearer ABC2026')).status,401);
  for(const [target,body] of [['/api/admin/pairing-codes',{grants:[hagai]}],['/api/admin/devices/'+device.deviceId+'/revoke',{}]])assert.equal((await f.admin(target,body,'Bearer ABC2026')).status,401);
  const permission=f.root.collection('adminPairingPermissions').doc(f.uid);await permission.set({active:true,grants:[hagai]});
  const list=await f.admin('/api/admin/devices');assert.equal(list.status,200);assert.deepEqual((await list.json()).devices,[]);
  assert.equal((await f.admin('/api/admin/devices/'+device.deviceId+'/revoke',{})).status,403);
  assert.equal((await f.admin('/api/admin/pairing-codes',{grants:[other]})).status,403);
  for(const bad of [{...hagai,schoolId:'s2'},{...hagai,groupId:'g18'},{...hagai,serviceSessionId:'unknown'}])assert.equal((await f.admin('/api/admin/pairing-codes',{grants:[bad]})).status,403);
  await permission.set({active:false,grants:[hagai]});for(const target of ['/api/admin/pairing-context','/api/admin/devices'])assert.equal((await f.admin(target)).status,403);
  assert.equal((await f.mentor(device.credential)).status,200);
});
test('Expired and cancelled codes cannot be redeemed; device expiry and revocation are visible without exposing secrets',async t=>{
  const f=await deviceManagementFixture(t),expired=await issue(f,[hagai],{codeTtlMs:1000});f.advance(1000);assert.equal((await f.redeem(expired.code)).status,400);
  const cancelled=await issue(f);assert.equal((await f.admin('/api/admin/pairing-codes/'+cancelled.pairingId+'/revoke',{})).status,200);assert.equal((await f.redeem(cancelled.code)).status,400);
  const active=await issue(f,[hagai],{grantTtlMs:1000}),r=await f.redeem(active.code);assert.equal(r.status,201);const device=await r.json();f.advance(1000);
  const list=await f.admin('/api/admin/devices');assert.equal(list.status,200);assert.equal((await list.json()).devices[0].state,'expired');assert.equal((await f.mentor(device.credential)).status,401);
  assert.equal((await f.admin('/api/admin/devices/'+device.deviceId+'/revoke',{})).status,200);
});
test('Admin logout/expiry and authorization lost during issuance or listing deny access without partial issuance',async t=>{
  const f=await deviceManagementFixture(t),authorize=f.adminAuthentication.authorize;let calls=0;
  f.adminAuthentication.authorize=async header=>{const result=await authorize(header);if(++calls===1)f.adminAuthentication.revoke(f.token);return result;};
  assert.equal((await f.admin('/api/admin/pairing-codes',{grants:[hagai]})).status,401);assert.equal((await f.root.collection('pairingCodes').get()).size,0);
  f.adminAuthentication.authorize=authorize;const login=await f.login();assert.equal(login.status,200);const token=(await login.json()).token;
  const logout=await f.request(token,'/api/admin/logout','POST');assert.equal(logout.status,200);for(const target of ['/api/admin/pairing-context','/api/admin/devices'])assert.equal((await f.admin(target,undefined,'Bearer '+token)).status,401);
  const next=await f.login();assert.equal(next.status,200);const current=(await next.json()).token,now=Date.now;
  try{Date.now=()=>now()+3700000;assert.equal((await f.admin('/api/admin/devices',undefined,'Bearer '+current)).status,401);}finally{Date.now=now;}
});
