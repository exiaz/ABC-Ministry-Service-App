import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {ACTIVATION_CODE_TTL_MS} from '../../backend/device-pairing.mjs';
import {createFirestoreEmulatorRepositories} from '../../backend/firestore-emulator.mjs';
import {activationFixture as fixture,hagai} from './activation-fixture.mjs';

test('Individual and atomic bulk issuance bind each code to one server-resolved assignment for exactly 48 hours and store no plaintext',async t=>{
  const f=await fixture(t),scopes=[hagai,{...hagai,groupId:'g1'}],key=randomUUID(),response=await f.issue(scopes,key);assert.equal(response.status,201);const value=await response.json();assert.equal(value.codes.length,2);assert.notEqual(value.codes[0].code,value.codes[1].code);
  for(const row of value.codes){assert.equal(row.expiresAt-row.createdAt,ACTIVATION_CODE_TTL_MS);assert.equal(row.createdAt,f.now());assert.equal(typeof row.assignment.mentorId,'string');assert.equal(row.assignment.serviceDate,'2026-10-30');assert.equal(row.assignment.schoolId,'s1');}
  const stored=await f.root.collection('pairingCodes').get();assert.equal(stored.size,2);assert.equal(stored.docs.every(row=>row.data().grants.length===1),true);
  const encoded=JSON.stringify(await Promise.all(['pairingCodes','pairingSubmissions','authorizationEvents'].map(async name=>(await f.root.collection(name).get()).docs.map(row=>row.data()))));for(const row of value.codes)assert.equal(encoded.includes(row.code),false);
  const duplicate=await f.issue([...scopes].reverse(),key);assert.equal(duplicate.status,409);const receipt=await duplicate.json();assert.equal(receipt.duplicateSubmission,true);assert.equal(receipt.codes.length,2);assert.equal(JSON.stringify(receipt).includes(value.codes[0].code),false);assert.equal((await f.root.collection('pairingCodes').get()).size,2);
  const list=await f.admin('/api/admin/activation-codes');assert.equal(list.status,200);assert.equal((await list.json()).codes.length,2);
  await f.admin('/api/admin/pairing-codes/'+value.codes[0].pairingId+'/revoke',{});const latest=await (await f.issue(scopes,key)).json();assert.equal(latest.codes.find(row=>row.pairingId===value.codes[0].pairingId).state,'revoked');assert.equal(JSON.stringify(latest).includes(value.codes[0].code),false);
});
test('PIC issue/read/revoke actions and full scope protect bulk issuance, with no partial writes or client TTL override',async t=>{
  const f=await fixture(t),email='pic-'+randomUUID()+'@example.invalid',password=randomBytes(24).toString('base64url');
  const created=await f.admin('/api/admin/accounts',{email,password,actions:['pairing:read','pairing:issue','pairing:revoke'],grants:[hagai]});assert.equal(created.status,201);const account=await created.json();
  const logged=await f.login({email,password}),pic=(await logged.json()).token;
  assert.equal((await f.issue([hagai,{...hagai,groupId:'g1'}],randomUUID(),pic)).status,403);assert.equal((await f.root.collection('pairingCodes').get()).size,0);
  const code=await f.issue([hagai],randomUUID(),pic);assert.equal(code.status,201);const issued=(await code.json()).codes[0];
  assert.equal((await f.admin('/api/admin/activation-codes',undefined,pic)).status,200);
  const other=(await (await f.issue([{...hagai,groupId:'g1'}])).json()).codes[0];assert.equal((await (await f.admin('/api/admin/activation-codes',undefined,pic)).json()).codes.length,1);assert.equal((await f.admin('/api/admin/pairing-codes/'+other.pairingId+'/revoke',{},pic)).status,403);
  assert.equal((await f.admin('/api/admin/pairing-codes/'+issued.pairingId+'/revoke',{},pic)).status,200);const outstanding=(await (await f.issue([hagai],randomUUID(),pic)).json()).codes[0];
  assert.equal((await f.admin('/api/admin/activation-codes',{grants:[hagai],idempotencyKey:randomUUID(),codeTtlMs:1000},pic)).status,400);
  assert.equal((await f.admin('/api/admin/accounts/'+account.uid,{expectedRevision:1,state:'active',actions:['pairing:read'],grants:[hagai]})).status,200);
  assert.equal((await f.issue([hagai],randomUUID(),pic)).status,401);
  const next=(await (await f.login({email,password})).json()).token;assert.equal((await f.issue([hagai],randomUUID(),next)).status,403);assert.equal((await f.admin('/api/admin/pairing-codes/'+issued.pairingId+'/revoke',{},next)).status,403);
  await assert.rejects(f.redeem(outstanding.code),error=>error.codeState==='invalid');
});
test('Bulk generation preserves the existing per-code rate budget without partial issuance',async t=>{
  const f=await fixture(t);assert.equal((await f.issue(f.grants)).status,201);assert.equal((await f.root.collection('pairingCodes').get()).size,16);assert.equal((await f.issue(f.grants.slice(0,5))).status,429);assert.equal((await f.root.collection('pairingCodes').get()).size,16);
});
test('48-hour redemption boundary is independent of the one-hour device access boundary',async t=>{
  const f=await fixture(t),codes=[];for(let n=0;n<2;n++)codes.push((await (await f.issue()).json()).codes[0]);
  f.advance(ACTIVATION_CODE_TTL_MS-1);const device=await f.redeem(codes[0].code);assert.equal(device.expiresAt,f.now()+3600000);assert.equal((await f.call(device)).status,200);
  f.advance(1);await assert.rejects(f.redeem(codes[1].code),error=>error.codeState==='expired');assert.equal((await f.call(device)).status,200);
  f.advance(3599999);assert.equal((await f.call(device)).status,401);
});
test('Revoked, used, changed assignment and unknown codes never authorize additional devices',async t=>{
  const f=await fixture(t);
  const revoke=(await (await f.issue()).json()).codes[0];assert.equal((await f.admin('/api/admin/pairing-codes/'+revoke.pairingId+'/revoke',{})).status,200);await assert.rejects(f.redeem(revoke.code),error=>error.codeState==='revoked');
  const used=(await (await f.issue()).json()).codes[0];await f.redeem(used.code);await assert.rejects(f.redeem(used.code),error=>error.codeState==='used');
  const changed=(await (await f.issue()).json()).codes[0];await f.root.collection('defaultMentorAssignments').doc('fictional-default-g13').update({mentorId:'mentor-eva'});await assert.rejects(f.redeem(changed.code),error=>error.codeState==='invalid');await assert.rejects(f.redeem(randomBytes(16).toString('base64url')),error=>error.status===400);assert.equal((await f.root.collection('devices').get()).size,1);
});
test('Event-aware access ends at midnight WIB, including redemption one millisecond before and after the boundary',async t=>{
  const f=await fixture(t);f.setTime('2026-10-30T16:30:00Z');const a=(await (await f.issue()).json()).codes[0],b=(await (await f.issue()).json()).codes[0],c=(await (await f.issue()).json()).codes[0];
  const first=await f.redeem(a.code);assert.equal(first.expiresAt,Date.parse('2026-10-30T17:00:00Z'));f.setTime('2026-10-30T16:59:59.999Z');const last=await f.redeem(b.code);assert.equal(last.expiresAt,f.now()+1);assert.equal((await f.call(last)).status,200);
  f.advance(1);assert.equal((await f.call(first)).status,401);assert.equal((await f.call(last)).status,401);await assert.rejects(f.redeem(c.code),error=>error.codeState==='service-ended');assert.ok(c.expiresAt>f.now());
  const list=await (await f.admin('/api/admin/activation-codes')).json();assert.equal(list.codes.find(row=>row.pairingId===c.pairingId).state,'service-ended');
});
test('Concurrent redemption has one winner; new codes support separate devices, replay is denied and revocation is device-specific',async t=>{
  const f=await fixture(t),code=(await (await f.issue()).json()).codes[0],command=f.command(code.code),results=await Promise.allSettled([f.pairing.redeem(command.body,command.proof),f.redeem(code.code)]);assert.equal(results.filter(row=>row.status==='fulfilled').length,1);assert.equal(results.filter(row=>row.status==='rejected'&&row.reason.codeState==='used').length,1);await assert.rejects(f.pairing.redeem(command.body,command.proof),error=>error.codeState==='used');assert.equal((await f.root.collection('devices').get()).size,1);
  const one=await f.redeem((await (await f.issue()).json()).codes[0].code),two=await f.redeem((await (await f.issue()).json()).codes[0].code);
  const status=await (await f.call(one)).json();assert.deepEqual(status.grants,[hagai]);assert.equal(status.assignment.mentorName,'Kak Louis');assert.equal(status.assignment.serviceDate,'2026-10-30');assert.equal(JSON.stringify(status).includes('PRIVAT_DILARANG'),false);
  const target='/api/roster?'+new URLSearchParams(hagai),options=f.request(two,'GET',target);assert.equal((await fetch(f.base+target,options)).status,200);assert.equal((await fetch(f.base+target,options)).status,401);
  const stolen=f.request({...one,keys:two.keys},'GET','/api/device/status');assert.equal((await fetch(f.base+'/api/device/status',stolen)).status,401);
  assert.equal((await f.call(two,'/api/roster?'+new URLSearchParams({...hagai,groupId:'g1'}))).status,403);
  await f.pairing.adminDevice((await f.root.collection('adminAccounts').where('role','==','superadmin').get()).docs[0].id,one.deviceId,true);assert.equal((await f.call(one)).status,401);assert.equal((await f.call(two)).status,200);
});
test('Activation access and attendance persist across repository restart; rescheduling invalidates access without rewriting attendance',async t=>{
  const f=await fixture(t);f.setTime('2026-10-30T10:00:00Z');const d=await f.redeem((await (await f.issue()).json()).codes[0].code),path='/api/attendance?'+new URLSearchParams(hagai),command={expectedRevision:0,idempotencyKey:randomUUID(),records:[{studentId:'fictional-hagai',status:'present'}]};
  const saved=await f.call(d,path,'PUT',command);assert.equal(saved.status,200);const batch=await saved.json();assert.equal(batch.records[0].status,'present');assert.equal((await f.call(d,path,'PUT',command)).status,200);
  const restored=await createFirestoreEmulatorRepositories({now:f.now});try{const target='/api/device/status',options=f.request(d,'GET',target),headers=options.headers,proof={method:'GET',target,body:'',timestamp:headers['X-Device-Timestamp'],nonce:headers['X-Device-Nonce'],signature:headers['X-Device-Signature']},verified=await restored.pairing.verifyRequest(headers.Authorization,proof);assert.equal(verified.deviceId,d.deviceId);assert.ok(await restored.credentials.authenticate(headers.Authorization,verified));}finally{await restored.close();}
  const before=JSON.stringify((await f.root.collection('sessions').get()).docs.map(row=>row.data()));await f.root.collection('serviceSessions').doc(hagai.serviceSessionId).update({date:'2026-11-06'});assert.equal((await f.call(d,path)).status,401);assert.equal(JSON.stringify((await f.root.collection('sessions').get()).docs.map(row=>row.data())),before);
});
