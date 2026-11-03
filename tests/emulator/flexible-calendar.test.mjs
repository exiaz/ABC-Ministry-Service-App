import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {activationFixture,hagai} from './activation-fixture.mjs';

const command=(patch={})=>({schoolId:'s1',date:'2026-11-01',groupIds:['g13'],expectedRevision:0,idempotencyKey:randomUUID(),...patch});
async function save(f,body,token){const r=await f.admin('/api/admin/service-sessions',body,token);assert.equal(r.status,200);return (await r.json()).service;}
const attendance=v=>'/api/attendance?'+new URLSearchParams({schoolId:v.schoolId,groupId:'g13',serviceSessionId:v.id});
test('Calendar writes fail closed for forged clients or authorization lost during I/O, without extending grants',async t=>{
  const f=await activationFixture(t),before=JSON.stringify(await Promise.all(['serviceSessions','adminPairingPermissions','serviceSubmissions'].map(async name=>(await f.root.collection(name).get()).docs.map(d=>d.data()))));
  assert.equal((await f.admin('/api/admin/service-sessions',undefined,'forged-token')).status,401);assert.equal((await f.admin('/api/admin/service-sessions',command({role:'superadmin'}))).status,400);
  await assert.rejects(f.pairing.saveService(f.uid,command(),async()=>false),e=>e.status===401);await assert.rejects(f.pairing.listServices(f.uid,async()=>false),e=>e.status===401);
  assert.equal(JSON.stringify(await Promise.all(['serviceSessions','adminPairingPermissions','serviceSubmissions'].map(async name=>(await f.root.collection(name).get()).docs.map(d=>d.data())))),before);
});
test('Explicit Sunday sessions use random stable IDs; same-date sessions and retried creation never merge or duplicate',async t=>{
  const f=await activationFixture(t),before=(await f.root.collection('sessions').get()).size,body=command(),a=await save(f,body),b=await save(f,command());assert.notEqual(a.id,b.id);assert.notEqual(a.id,a.date);assert.equal((await save(f,body)).id,a.id);assert.equal((await f.root.collection('serviceSessions').get()).size,5);assert.equal((await f.root.collection('sessions').get()).size,before);
  assert.equal((await f.admin('/api/admin/service-sessions',{...body,date:'2026-11-02'})).status,409);const p=(await f.root.collection('adminPairingPermissions').doc(f.uid).get()).data();assert.ok(p.grants.some(g=>g.serviceSessionId===a.id));assert.ok(p.grants.some(g=>g.serviceSessionId===b.id));
  const audit=(await f.root.collection('authorizationEvents').where('event','==','service-created').get()).docs;assert.equal(audit.length,2);
});
test('PIC can explicitly schedule and issue new device codes only for assigned school/groups; read-only PIC cannot extend access',async t=>{
  const f=await activationFixture(t),email='calendar-'+randomUUID()+'@example.invalid',password=randomBytes(24).toString('base64url'),create=await f.admin('/api/admin/accounts',{email,password,actions:['pairing:read','pairing:issue','pairing:revoke'],grants:[hagai]});assert.equal(create.status,201);const {uid}=await create.json(),token=(await (await f.login({email,password})).json()).token;
  for(const patch of [{schoolId:'s2',groupIds:['g4']},{groupIds:['g1']}])assert.equal((await f.admin('/api/admin/service-sessions',command(patch),token)).status,403);
  const v=await save(f,command(),token),scope={...hagai,serviceSessionId:v.id};const list=await (await f.admin('/api/admin/service-sessions',undefined,token)).json();assert.equal(list.services.every(s=>s.schoolId==='s1'&&s.groupIds.every(g=>g==='g13')),true);
  f.setTime('2026-11-01T10:00:00Z');const issued=await f.issue([scope],randomUUID(),token);assert.equal(issued.status,201);const code=(await issued.json()).codes[0];assert.equal(code.expiresAt-code.createdAt,172800000);assert.equal(code.assignment.serviceDate,v.date);assert.equal(code.assignment.mentorName,'Kak Louis');const d=await f.redeem(code.code);assert.equal((await f.call(d)).status,200);assert.equal(d.expiresAt,f.now()+3600000);
  const row=(await f.root.collection('adminAccounts').doc(uid).get()).data();assert.ok(row.grants.some(s=>s.serviceSessionId===v.id));assert.equal((await f.admin('/api/admin/accounts/'+uid,{expectedRevision:row.revision,state:'active',actions:['pairing:read'],grants:row.grants})).status,200);const readOnly=(await (await f.login({email,password})).json()).token;assert.equal((await f.admin('/api/admin/service-sessions',command(),readOnly)).status,403);assert.equal((await f.issue([scope],randomUUID(),readOnly)).status,403);
});
test('Concurrent rescheduling has one revision winner, invalidates Stage 4 access and retains IDs/attendance/history',async t=>{
  const f=await activationFixture(t);f.setTime('2026-11-01T10:00:00Z');const v=await save(f,command()),scope={...hagai,serviceSessionId:v.id},a=(await (await f.issue([scope])).json()).codes[0],b=(await (await f.issue([scope])).json()).codes[0],d=await f.redeem(a.code),path=attendance(v),saved=await f.call(d,path,'PUT',{expectedRevision:0,idempotencyKey:randomUUID(),records:[{studentId:'fictional-hagai',status:'present'}]});assert.equal(saved.status,200);
  const before=JSON.stringify(await Promise.all(['sessions','attendanceHistory','attendanceSubmissions','mentorAssignmentSnapshots'].map(async c=>(await f.root.collection(c).get()).docs.map(d=>d.data()))));
  const responses=await Promise.all(['2026-11-02','2026-11-03'].map(date=>f.admin('/api/admin/service-sessions',command({id:v.id,date,expectedRevision:1}))));assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);const latest=(await f.root.collection('serviceSessions').doc(v.id).get()).data();assert.equal(latest.id,v.id);assert.equal(latest.dateHistory.length,1);assert.equal(latest.dateHistory[0].from,v.date);assert.equal(latest.revision,2);
  await assert.rejects(f.redeem(b.code),error=>error.codeState==='invalid');assert.equal((await f.call(d,path)).status,401);assert.equal(JSON.stringify(await Promise.all(['sessions','attendanceHistory','attendanceSubmissions','mentorAssignmentSnapshots'].map(async c=>(await f.root.collection(c).get()).docs.map(d=>d.data())))),before);
  assert.equal((await f.admin('/api/admin/service-sessions',command({id:v.id,date:latest.date,groupIds:['g1'],expectedRevision:2}))).status,409);
});
test('Non-Friday attendance finalization/correction remain versioned and two same-date sessions stay isolated',async t=>{
  const f=await activationFixture(t);f.setTime('2026-11-01T10:00:00Z');const a=await save(f,command()),b=await save(f,command()),devices=[];for(const v of [a,b])devices.push(await f.redeem((await (await f.issue([{...hagai,serviceSessionId:v.id}])).json()).codes[0].code));
  const path=attendance(a),write={expectedRevision:0,idempotencyKey:randomUUID(),records:[{studentId:'fictional-hagai',status:'present'}]};assert.equal((await f.call(devices[0],path,'PUT',write)).status,200);assert.equal((await f.call(devices[0],path,'PUT',write)).status,200);assert.equal((await f.call(devices[0],path.replace(a.id,b.id))).status,403);
  assert.equal((await f.call(devices[0],path.replace('/api/attendance','/api/attendance/finalize'),'POST',{expectedRevision:1,idempotencyKey:randomUUID(),confirm:true})).status,200);
  assert.equal((await f.call(devices[0],path.replace('/api/attendance','/api/attendance/corrections'),'POST',{expectedRevision:2,idempotencyKey:randomUUID(),records:[{studentId:'fictional-hagai',status:'excused'}],reason:'Koreksi fiktif'})).status,200);
  assert.equal((await f.call(devices[0],path.replace('/api/attendance','/api/attendance/finalize'),'POST',{expectedRevision:3,idempotencyKey:randomUUID(),confirm:true})).status,200);const other=await (await f.call(devices[1],attendance(b))).json();assert.equal(other.state,'not-started');assert.equal(other.records[0].status,'unmarked');assert.equal((await f.root.collection('attendanceHistory').get()).size,4);
});
test('Non-Friday access stops at the WIB service-day boundary and missing/malformed/provisional sessions never confer access',async t=>{
  const f=await activationFixture(t);f.setTime('2026-11-01T16:59:59.999Z');const v=await save(f,command()),scope={...hagai,serviceSessionId:v.id},a=(await (await f.issue([scope])).json()).codes[0],b=(await (await f.issue([scope])).json()).codes[0],d=await f.redeem(a.code);assert.equal(d.expiresAt,f.now()+1);f.advance(1);assert.equal((await f.call(d)).status,401);await assert.rejects(f.redeem(b.code),e=>e.codeState==='service-ended');assert.ok(b.expiresAt>f.now());
  assert.equal((await f.issue([{...scope,serviceSessionId:v.date}])).status,403);for(const date of ['2026-02-29','0000-01-01','2026-13-01'])assert.equal((await f.admin('/api/admin/service-sessions',command({date}))).status,400);
  await f.root.collection('serviceSessions').doc(hagai.serviceSessionId).update({provisional:true});assert.equal((await f.issue()).status,403);const raw=(await f.root.collection('serviceSessions').get()).docs.map(d=>d.data());assert.equal(raw.some(v=>v.id==='2026-11-01'),false);
});
