import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {activationFixture,hagai} from './activation-fixture.mjs';
import {createFirestoreEmulatorRepositories} from '../../backend/firestore-emulator.mjs';

const one={...hagai,groupId:'g1'},two={...hagai,groupId:'g2'},path='/api/admin/backup-assignments';
const target=(scope,kind='attendance')=>'/api/'+kind+'?'+new URLSearchParams(scope);
const body=(device,grants=[one],patch={})=>({deviceId:device.deviceId,grants,reason:'Mentor berhalangan hadir',idempotencyKey:randomUUID(),...patch});
async function setup(t,date='2026-11-01',clock='2026-11-01T10:00:00Z'){
  const f=await activationFixture(t);f.setTime(clock);
  await f.root.collection('serviceSessions').doc(hagai.serviceSessionId).update({date});
  for(const scope of [one,two])await f.root.collection('students').doc('fictional-'+scope.groupId).create({id:'fictional-'+scope.groupId,schoolId:'s1',groupId:scope.groupId,name:'Siswa Backup Fiktif '+scope.groupId,schoolClass:'3A',active:true});
  const activate=async(scope=hagai)=>{const r=await f.issue([scope]);assert.equal(r.status,201);const issued=(await r.json()).codes[0];return {...await f.redeem(issued.code),assignment:issued.assignment};};
  const device=await activate();return {...f,device,activate};
}
async function assign(f,command=body(f.device),token){const r=await f.admin(path,command,token);assert.equal(r.status,201,JSON.stringify(await r.clone().json()));return r.json();}
async function snapshot(f,names){return JSON.stringify(await Promise.all(names.map(async name=>(await f.root.collection(name).get()).docs.map(d=>({id:d.id,...d.data()})))));}
async function pic(f,grants,actions=['pairing:read','pairing:issue','pairing:revoke']){
  const email='backup-'+randomUUID()+'@example.invalid',password=randomBytes(24).toString('base64url');const r=await f.admin('/api/admin/accounts',{email,password,actions,grants});assert.equal(r.status,201);const account=await r.json(),token=(await (await f.login({email,password})).json()).token;return {...account,token};
}
const mutate=(f,d,s,revision,status='present')=>f.call(d,target(s),'PUT',{records:[{studentId:s.groupId==='g13'?'fictional-hagai':'fictional-'+s.groupId,status}],expectedRevision:revision,idempotencyKey:randomUUID()});

test('Superadmin assigns multiple backup groups atomically and idempotently; revoke/end immediately deny while primary and identifiers remain intact',async t=>{
  const f=await setup(t),names=['students','groups','defaultMentorAssignments','sessionMentorOverrides','mentorAssignmentSnapshots','serviceSessions'],before=await snapshot(f,names),command=body(f.device,[one,two]);
  const [a,b]=await Promise.all([assign(f,command),assign(f,command)]);assert.equal(a.id,b.id);assert.equal((await f.root.collection('backupAssignments').get()).size,1);assert.equal(a.expiresAt,f.device.expiresAt);assert.equal(a.assignments.length,2);assert.ok(a.assignments.every(s=>typeof s.defaultMentorId==='string'));assert.equal(a.primary.mentorId,f.device.assignment.mentorId);
  const contexts=await (await f.call(f.device,'/api/roster-context')).json();assert.equal(contexts.contexts.length,3);assert.equal(contexts.contexts.filter(s=>s.accessKind==='backup').length,2);
  for(const s of [hagai,one,two])assert.equal((await f.call(f.device,target(s,'roster'))).status,200);
  assert.equal((await f.admin(path,body(f.device))).status,409);assert.equal((await f.admin(path,{...command,reason:'Alasan berbeda'})).status,409);
  const stored=(await f.root.collection('devices').doc(f.device.deviceId).get()).data();assert.deepEqual(stored.grants,[hagai]);
  const list=await (await f.admin(path)).json();assert.equal(list.assignments[0].state,'active');assert.equal(JSON.stringify(list).includes(f.device.credential),false);assert.equal(JSON.stringify(list).includes('credentialId'),false);
  const close=await f.admin(path+'/'+a.id+'/close',{reason:'Mentor utama kembali',status:'revoked'});assert.equal(close.status,200);
  for(const s of [one,two])assert.equal((await f.call(f.device,target(s))).status,403);assert.equal((await f.call(f.device,target(hagai))).status,200);
  const replay=await assign(f,command);assert.equal(replay.state,'revoked');assert.equal((await f.call(f.device,target(one))).status,403);
  const next=await assign(f);assert.notEqual(next.id,a.id);assert.equal((await f.admin(path+'/'+next.id+'/close',{reason:'Pelayanan selesai',status:'ended'})).status,200);assert.equal((await f.call(f.device,target(one))).status,403);
  assert.equal(await snapshot(f,names),before);assert.equal((await f.root.collection('sessions').get()).size,0);
  const events=(await f.root.collection('authorizationEvents').where('assignmentId','==',a.id).get()).docs.map(d=>d.data());assert.deepEqual(events.map(e=>e.event).sort(),['backup-assigned','backup-revoked']);assert.ok(events.every(e=>e.actor===f.uid&&e.deviceId===f.device.deviceId&&e.assignments.length===2&&e.reason));
});
test('PIC actions and exact primary/target scopes are enforced; forged clients, missing actions and cross-session/school grants fail closed',async t=>{
  const f=await setup(t),p=await pic(f,[hagai,one]),readOnly=await pic(f,[hagai,one],['pairing:read']),narrow=await pic(f,[one]);
  assert.equal((await f.admin(path,body(f.device),readOnly.token)).status,403);assert.equal((await f.admin(path,body(f.device),narrow.token)).status,403);
  assert.deepEqual((await (await f.admin(path,undefined,narrow.token)).json()).candidates,[]);
  for(const grants of [[two],[f.grants.find(s=>s.schoolId==='s2')],[{...one,serviceSessionId:'unassigned-session'}],[hagai]])assert.equal((await f.admin(path,body(f.device,grants),p.token)).status,403);
  assert.equal((await f.admin(path,body(f.device),f.device.credential)).status,401);assert.equal((await f.admin(path,body(f.device),'forged')).status,401);
  assert.equal((await f.admin(path,body(f.device,[one],{role:'superadmin'}),p.token)).status,400);
  const a=await assign(f,body(f.device),p.token);assert.equal((await f.admin(path+'/'+a.id+'/close',{reason:'Dilarang',status:'revoked'},readOnly.token)).status,403);
  assert.equal((await f.admin(path+'/'+a.id+'/close',{reason:'Sudah hadir',status:'revoked'},p.token)).status,200);
  const active=await assign(f,body(f.device),p.token);await f.root.collection('adminPairingPermissions').doc(p.uid).update({active:false});assert.equal((await f.call(f.device,target(one))).status,403);assert.equal((await f.call(f.device,target(hagai))).status,200);
  assert.equal((await (await f.admin(path)).json()).assignments.find(r=>r.id===active.id).state,'invalid');
});
test('Backup requires an active bound activation device and live login; malformed/legacy/unpaired devices never receive grants',async t=>{
  const f=await setup(t);for(const patch of [{deviceId:'unpaired'},{reason:''},{grants:[]},{grants:[one,one]},{idempotencyKey:'short'}])assert.ok([400,403].includes((await f.admin(path,body(f.device,[one],patch))).status));
  await assert.rejects(f.pairing.saveBackup(f.uid,body(f.device),async()=>false),e=>e.status===401);assert.equal((await f.root.collection('backupAssignments').get()).size,0);
  await f.credentials.issue({grants:[hagai],deviceId:'legacy-credential'});assert.equal((await f.admin(path,body(f.device,[one],{deviceId:'legacy-credential'}))).status,403);
  await f.pairing.adminDevice(f.uid,f.device.deviceId,true);assert.equal((await f.admin(path,body(f.device))).status,403);
});
test('Non-Friday service boundary caps backup at exclusive WIB midnight without extending redemption or device expiry',async t=>{
  const f=await setup(t,'2026-11-01','2026-11-01T16:59:59.000Z'),a=await assign(f);assert.equal(a.expiresAt,Date.parse('2026-11-01T17:00:00Z'));assert.equal(a.expiresAt,f.device.expiresAt);f.advance(999);assert.equal((await f.call(f.device,target(one))).status,200);f.advance(1);assert.equal((await f.call(f.device,target(one))).status,401);assert.equal((await f.admin(path,body(f.device))).status,403);assert.equal((await (await f.admin(path)).json()).assignments[0].state,'expired');
});
test('An expired backup grant is rejected even while its primary device remains active',async t=>{
  const f=await setup(t),a=await assign(f);await f.root.collection('backupAssignments').doc(a.id).update({expiresAt:f.now()+1000});f.advance(999);assert.equal((await f.call(f.device,target(one))).status,200);f.advance(1);assert.equal((await f.call(f.device,target(one))).status,403);assert.equal((await f.call(f.device,target(hagai))).status,200);
});
test('Primary and backup writes share conflict/idempotency protections, independent group finalization/corrections and immutable history',async t=>{
  const f=await setup(t),primary=await f.activate(one);await assign(f,body(f.device,[one,two]));
  const responses=await Promise.all([mutate(f,primary,one,0),mutate(f,f.device,one,0,'absent')]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
  const command={records:[{studentId:'fictional-g1',status:'present'}],expectedRevision:1,idempotencyKey:randomUUID()};const saved=await f.call(f.device,target(one),'PUT',command);assert.equal(saved.status,200);const receipt=await saved.json();assert.deepEqual(await (await f.call(f.device,target(one),'PUT',command)).json(),receipt);
  const different=await Promise.all([mutate(f,f.device,hagai,0),mutate(f,f.device,two,0)]);assert.deepEqual(different.map(r=>r.status),[200,200]);
  const finalize=await f.call(f.device,target(one).replace('/attendance?','/attendance/finalize?'),'POST',{expectedRevision:2,idempotencyKey:randomUUID(),confirm:true});assert.equal(finalize.status,200);assert.equal((await (await f.call(f.device,target(two))).json()).state,'draft');
  const original=(await f.root.collection('attendanceHistory').where('batchId','==',receipt.batchId).get()).docs.map(d=>({id:d.id,value:d.data()}));
  const correct=await f.call(primary,target(one).replace('/attendance?','/attendance/corrections?'),'POST',{records:[{studentId:'fictional-g1',status:'excused'}],expectedRevision:3,idempotencyKey:randomUUID(),reason:'Konfirmasi wali fiktif'});assert.equal(correct.status,200);
  const sessions=(await f.root.collection('sessions').get()).docs.map(d=>d.data());assert.equal(sessions.length,3);assert.equal(new Set(sessions.map(s=>s.id)).size,3);for(const s of sessions)assert.equal(s.records.length,1);assert.equal(sessions.find(s=>s.groupId==='g1').records[0].studentId,'fictional-g1');
  for(const row of original)assert.deepEqual((await f.root.collection('attendanceHistory').doc(row.id).get()).data(),row.value);assert.ok(original.some(r=>r.value.backupAssignmentId&&r.value.backupMentorId===f.device.assignment.mentorId));
  const a=(await (await f.admin(path)).json()).assignments[0];await f.admin(path+'/'+a.id+'/close',{reason:'Selesai',status:'ended'});assert.equal((await f.call(f.device,target(one),'PUT',command)).status,403);assert.equal((await f.call(primary,target(one))).status,200);
});
test('Revocation racing a write is serialized; no request or idempotent replay after revocation can mutate attendance',async t=>{
  const f=await setup(t),a=await assign(f),cmd={records:[{studentId:'fictional-g1',status:'present'}],expectedRevision:0,idempotencyKey:randomUUID()};
  const [write,revoke]=await Promise.all([f.call(f.device,target(one),'PUT',cmd),f.admin(path+'/'+a.id+'/close',{reason:'Darurat selesai',status:'revoked'})]);assert.ok([200,403].includes(write.status));assert.equal(revoke.status,200);const before=await snapshot(f,['sessions','attendanceHistory','attendanceSubmissions']);assert.equal((await f.call(f.device,target(one),'PUT',cmd)).status,403);assert.equal(await snapshot(f,['sessions','attendanceHistory','attendanceSubmissions']),before);
});
test('Reopening adapters preserves backup and revocation; changed target mentor or rescheduled service invalidates delegation without rewriting attendance',async t=>{
  const f=await setup(t),a=await assign(f);const reopened=await createFirestoreEmulatorRepositories({now:f.now});try{
    assert.equal((await reopened.credentials.authenticate('Bearer '+f.device.credential,{deviceId:f.device.deviceId})).grants.length,2);
    await f.root.collection('sessionMentorOverrides').doc('fictional-override').create({id:'fictional-override',groupId:'g1',serviceSessionId:hagai.serviceSessionId,mentorId:f.device.assignment.mentorId});assert.equal((await f.call(f.device,target(one))).status,403);assert.equal((await f.call(f.device,target(hagai))).status,200);
    await f.admin(path+'/'+a.id+'/close',{reason:'Penugasan berubah',status:'revoked'});assert.equal((await reopened.credentials.authenticate('Bearer '+f.device.credential,{deviceId:f.device.deviceId})).grants.length,1);
    await f.root.collection('serviceSessions').doc(hagai.serviceSessionId).update({date:'2026-11-02'});assert.equal((await f.call(f.device)).status,401);assert.equal((await f.root.collection('sessions').get()).size,0);
  }finally{await reopened.close();}
});
