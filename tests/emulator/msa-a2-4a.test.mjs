import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {lifecycleFixture,primary,backup} from './msa-a2-4a-fixture.mjs';
import {createEmulatorAttendance} from '../../backend/attendance.mjs';
const root=uid=>'/api/a2-4/accounts/'+uid+'/devices';
const revokeValue=(revision=1,accountRevision=3)=>({expectedRevision:revision,expectedAccountRevision:accountRevision,reason:'Pencabutan perangkat fiktif untuk pengujian',confirmed:true,requestId:randomUUID()});
const change=(f,u,state,expectedRevision)=>f.request('/api/a1/accounts/'+u.uid+'/change',{state,expectedRevision,requestId:randomUUID(),reason:'Perubahan status akun fiktif untuk pengujian'});
const saved=()=>({expectedRevision:0,idempotencyKey:randomUUID(),records:[{studentId:'fictional-1',status:'present'}]});

test('A2.4A own/Admin listing and selected revocation preserve credentials/history, receipts, gates and unresolved legacy boundary',async t=>{
  const f=await lifecycleFixture(t),u=await f.account(),s=await f.login(u),d=await f.activate(),other=await f.activate();
  assert.equal((await f.associate(d,s.token)).status,200);assert.equal((await f.associate(other,s.token)).status,200);
  const legacy=await f.activate(),before=(await f.root.collection('devices').doc(d.deviceId).get()).data();
  const list=await (await f.personalRequest('/api/a2-3/devices',undefined,s.token)).json();assert.equal(list.devices.length,2);assert.ok(list.devices.every(d=>d.state==='active'));assert.equal(list.legacyMigration,'unresolved');
  assert.equal((await f.root.collection('msaDeviceAssociations').doc(legacy.deviceId).get()).exists,false);assert.equal((await f.call(legacy)).status,200);
  const classified=(await (await f.request('/api/admin/devices')).json()).devices;assert.equal(classified.find(v=>v.deviceId===legacy.deviceId).accountLinkState,'unresolved-legacy');assert.equal(classified.find(v=>v.deviceId===d.deviceId).accountLinkState,'account-linked');
  assert.equal((await f.request('/api/admin/devices/'+d.deviceId+'/revoke',{})).status,409);
  const projection=JSON.stringify(list);for(const secret of [d.credential,d.publicKey,s.token,u.password,'credentialId','providerAlias'])assert.ok(!projection.includes(secret));
  assert.equal((await f.request(root(u.uid),undefined,'')).status,401);assert.equal((await f.request(root(u.uid),undefined,s.token)).status,403);
  assert.equal((await f.request(root(u.uid))).status,200);assert.equal((await f.personalRequest('/api/a2-3/devices/'+legacy.deviceId+'/revoke',revokeValue(),s.token)).status,403);
  const v=revokeValue();assert.equal((await f.personalRequest('/api/a2-3/devices/'+d.deviceId+'/revoke',v,s.token)).status,200);
  assert.equal((await f.personalRequest('/api/a2-3/devices/'+d.deviceId+'/revoke',v,s.token)).status,200);
  assert.equal((await f.request(root(u.uid)+'/'+d.deviceId+'/revoke',revokeValue())).status,409);
  for(const token of [s.token,undefined]){assert.equal((await f.call(d,'/api/device/status','GET',undefined,token)).status,401);assert.equal((await f.call(d,f.target(),'PUT',saved(),token)).status,401);}
  assert.equal((await f.call(other,'/api/device/status','GET',undefined,s.token)).status,200);
  const binding=(await f.root.collection('msaDeviceAssociations').doc(d.deviceId).get()).data(),after=(await f.root.collection('devices').doc(d.deviceId).get()).data();
  assert.equal(binding.state,'revoked');assert.equal(binding.revision,2);assert.equal(after.id,before.id);assert.equal(after.publicKey,before.publicKey);assert.deepEqual(after.assignment,before.assignment);
  assert.equal((await f.root.collection('msaDeviceLifecycleReceipts').get()).size,1);assert.equal((await f.root.collection('msaDeviceAssociationEvents').where('event','==','account-device-revoked').get()).size,1);
  delete process.env.ABC_MSA_A2_4A;assert.equal((await f.request(root(u.uid))).status,503);assert.equal((await f.personalRequest('/api/a2-3/devices',undefined,s.token)).status,503);assert.equal((await f.call(d)).status,401);
});

test('A2.4A suspension blocks every linked device, writes/retries and backups; reactivation requires fresh activation and never restores revoked access',async t=>{
  const f=await lifecycleFixture(t),u=await f.account(),s=await f.login(u),a=await f.activate(),b=await f.activate();for(const d of [a,b])assert.equal((await f.associate(d,s.token)).status,200);
  assert.equal((await f.request('/api/admin/backup-assignments',{deviceId:a.deviceId,grants:[backup],reason:'Backup fiktif sebelum suspension',idempotencyKey:randomUUID()})).status,201);
  const body=saved();body.records.push({studentId:'fictional-2',status:'absent'});assert.equal((await f.call(a,f.target(),'PUT',body,s.token)).status,200);
  assert.equal((await f.call(a,f.target(primary,'/api/attendance/finalize'),'POST',{expectedRevision:1,idempotencyKey:randomUUID(),confirm:true},s.token)).status,200);
  assert.equal((await f.call(a,f.target(primary,'/api/attendance/corrections'),'POST',{expectedRevision:2,idempotencyKey:randomUUID(),records:[{studentId:'fictional-1',status:'excused'}],reason:'Koreksi fiktif mempertahankan sejarah'},s.token)).status,200);
  const history=JSON.stringify((await f.root.collection('attendanceHistory').get()).docs.map(d=>d.data())),batch=JSON.stringify((await f.root.collection('sessions').where('serviceSessionId','==',primary.serviceSessionId).get()).docs.map(d=>d.data()));
  assert.equal((await change(f,u,'suspended',3)).status,200);
  for(const d of [a,b])for(const token of [s.token,undefined])for(const path of ['/api/device/status','/api/roster-context',f.target(primary,'/api/roster'),f.target()])assert.equal((await f.call(d,path,'GET',undefined,token)).status,401);
  assert.equal((await f.call(a,f.target(),'PUT',body,s.token)).status,401);assert.equal((await f.call(a,f.target(backup),'GET',undefined,s.token)).status,401);
  for(const token of [s.token,undefined]){
    assert.equal((await f.call(a,f.target(primary,'/api/attendance/finalize'),'POST',{expectedRevision:3,idempotencyKey:randomUUID(),confirm:true},token)).status,401);
    assert.equal((await f.call(a,f.target(primary,'/api/attendance/corrections'),'POST',{expectedRevision:3,idempotencyKey:randomUUID(),records:[{studentId:'fictional-1',status:'absent'}],reason:'Koreksi ditolak saat akun ditangguhkan'},token)).status,401);
  }
  const devices=await (await f.request(root(u.uid))).json();assert.ok(devices.devices.every(d=>d.state==='suspended'));assert.equal((await (await f.request('/api/admin/backup-assignments')).json()).candidates.length,0);
  assert.equal((await f.request(root(u.uid)+'/'+b.deviceId+'/revoke',revokeValue(1,3))).status,409);
  assert.equal((await f.request(root(u.uid)+'/'+b.deviceId+'/revoke',revokeValue(1,4))).status,200);
  assert.equal((await change(f,u,'active',4)).status,200);const fresh=await f.login(u);assert.equal(fresh.response.status,200);
  for(const d of [a,b]){assert.equal((await f.call(d,'/api/device/status','GET',undefined,fresh.token)).status,401);assert.equal((await f.associate(d,fresh.token)).status,403);}
  assert.equal((await f.personalRequest('/api/a2-3/context',undefined,s.token)).status,401);
  const updated=await (await f.request(root(u.uid))).json();assert.deepEqual(updated.devices.map(d=>d.state).sort(),['revoked','stale']);
  const newDevice=await f.activate();assert.equal((await f.associate(newDevice,fresh.token)).status,200);assert.equal((await f.call(newDevice,'/api/device/status','GET',undefined,fresh.token)).status,200);
  assert.equal(JSON.stringify((await f.root.collection('attendanceHistory').get()).docs.map(d=>d.data())),history);assert.equal(JSON.stringify((await f.root.collection('sessions').where('serviceSessionId','==',primary.serviceSessionId).get()).docs.map(d=>d.data())),batch);
  assert.equal((await f.request('/api/admin/backup-assignments',{deviceId:a.deviceId,grants:[backup],reason:'Tidak boleh memulihkan backup lama',idempotencyKey:randomUUID()})).status,403);
  assert.equal((await change(f,u,'rejected',5)).status,200);assert.equal((await f.login(u)).response.status,401);assert.equal((await f.call(newDevice,'/api/device/status','GET',undefined,fresh.token)).status,401);assert.equal((await f.call(newDevice)).status,401);
});

test('A2.4A delegated PIC needs current exact scope and revoke action; personal sessions cannot manage another account',async t=>{
  const f=await lifecycleFixture(t),u=await f.account();
  const email='pic-'+randomUUID()+'@example.invalid',password=randomBytes(24).toString('base64url'),created=await f.request('/api/admin/accounts',{email,password,actions:['pairing:read'],grants:[primary]});assert.equal(created.status,201);const {uid}=await created.json();f.created.push(uid);
  const token=await f.adminAuthentication.signIn({email,password});assert.equal((await f.request(root(u.uid),undefined,token)).status,403);
  assert.equal((await f.request('/api/a2-2/accounts/'+u.uid+'/delegate',{expectedRevision:3,requestId:randomUUID(),reason:'Delegasi tinjauan perangkat fiktif',reviewerUid:uid,scope:primary})).status,200);
  const s=await f.login(u),d=await f.activate();assert.equal((await f.associate(d,s.token)).status,200);
  const own=await (await f.request(root(u.uid),undefined,token)).json();assert.equal(own.devices[0].canRevoke,false);assert.equal((await f.request(root(u.uid)+'/'+d.deviceId+'/revoke',revokeValue(1,4),token)).status,403);
  const stranger=await f.enroll(),other=await f.signIn(stranger);assert.equal((await f.personalRequest('/api/a2-3/devices/'+d.deviceId+'/revoke',revokeValue(1,4),other.token)).status,403);
  assert.equal((await f.request('/api/admin/accounts/'+uid,{state:'active',expectedRevision:1,actions:['pairing:read','pairing:revoke'],grants:[primary]})).status,200);
  const currentToken=await f.adminAuthentication.signIn({email,password});assert.equal((await f.request(root(u.uid),undefined,currentToken)).status,403);
  assert.equal((await f.request('/api/a2-2/accounts/'+u.uid+'/delegate',{expectedRevision:4,requestId:randomUUID(),reason:'Delegasi diperiksa ulang sesudah revisi PIC',reviewerUid:uid,scope:primary})).status,200);
  assert.equal((await f.request(root(u.uid)+'/'+d.deviceId+'/revoke',revokeValue(1,5),currentToken)).status,200);
});

test('A2.4A selected revocation serializes attendance writes/retries and duplicate association/revoke requests without partial history',async t=>{
  const f=await lifecycleFixture(t),u=await f.account(),s=await f.login(u),d=await f.activate();
  const associated=await Promise.all([f.associate(d,s.token),f.associate(d,s.token)]);assert.ok(associated.every(r=>r.status===200));assert.equal((await f.root.collection('msaDeviceAssociations').get()).size,1);
  const personal=await f.adminAuthentication.a1.mentor.resolve('Bearer '+s.token),raw=f.signed(d,f.target(),'PUT',{},s.token),proof=await f.pairing.verifyRequest('Bearer '+d.credential,{method:'PUT',target:f.target(),body:'{}',timestamp:raw.headers['X-Device-Timestamp'],nonce:raw.headers['X-Device-Nonce'],signature:raw.headers['X-Device-Signature']});
  let enter,release;const reached=new Promise(r=>enter=r),hold=new Promise(r=>release=r),body=saved();
  const attendance=createEmulatorAttendance({...f,now:Date.now,credentials:{authenticate:async(...args)=>{enter();await hold;return f.credentials.authenticate(...args);}}});
  const writing=attendance.executeAuthorized({authorization:'Bearer '+d.credential,proof,scope:primary,action:'save',body,personal}).catch(e=>e);await reached;
  const v=revokeValue(),responses=await Promise.all([f.request(root(u.uid)+'/'+d.deviceId+'/revoke',v),f.request(root(u.uid)+'/'+d.deviceId+'/revoke',v)]);assert.ok(responses.every(r=>r.status===200));release();assert.equal((await writing).status,401);
  assert.equal((await f.root.collection('attendanceHistory').get()).size,0);assert.equal((await f.root.collection('attendanceSubmissions').get()).size,0);
  const fresh=await f.activate();assert.equal((await f.associate(fresh,s.token)).status,200);
  const race=await Promise.all([f.call(fresh,f.target(),'PUT',body,s.token),f.request(root(u.uid)+'/'+fresh.deviceId+'/revoke',revokeValue())]);assert.ok([200,401].includes(race[0].status));assert.equal(race[1].status,200);
  assert.equal((await f.call(fresh,f.target(),'PUT',body,s.token)).status,401);assert.equal((await f.root.collection('attendanceHistory').get()).size,race[0].status===200?1:0);
});
