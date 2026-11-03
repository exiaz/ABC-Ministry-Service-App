import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mentorAccountFixture,primary,backup} from './msa-a2-3-fixture.mjs';
import {createEmulatorAttendance} from '../../backend/attendance.mjs';
import {createLocalAdminAuthentication} from '../../backend/admin-auth.mjs';
import {createRosterServer} from '../../backend/server.mjs';
import {once} from 'node:events';

test('A2.3 verified identity login resolves existing scope; pending/rejected/unlinked/legacy tokens grant no personal access',async t=>{
  const f=await mentorAccountFixture(t),u=await f.account(),session=await f.login(u);assert.equal(session.response.status,200);assert.equal(session.groups.length,1);assert.equal(session.groups[0].groupId,'g1');assert.equal(session.mentorId,'fictional-mentor');
  assert.equal(session.response.headers.get('access-control-allow-origin'),f.mentorBase);const preflight=await fetch(f.apiBase+'/api/a2-3/login',{method:'OPTIONS',headers:{Origin:f.mentorBase,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),f.mentorBase);
  for(const state of ['pending','rejected']){const p=await f.register();if(state==='rejected')assert.equal((await f.review(p,{decision:'reject',scope:primary,evidence:undefined})).status,200);assert.equal((await f.login(p)).response.status,401);}
  const unlinked=await f.enroll();assert.equal((await f.login(unlinked)).response.status,403);
  assert.equal((await f.personalRequest('/api/a2-3/context',undefined,f.token)).status,401);
  assert.equal((await f.personalRequest('/api/a2-3/context',undefined,session.token,{Origin:'https://evil.example'})).status,403);
  assert.equal((await f.personalRequest('/api/a2-3/context?schoolId=s2',undefined,session.token)).status,400);
  assert.equal((await f.request('/api/admin/session')).status,200);
  const old=await f.activate();assert.equal((await f.call(old)).status,200);assert.equal((await f.root.collection('msaDeviceAssociations').get()).size,0);
  const serialized=JSON.stringify(session);assert.equal(serialized.includes('@msa.example.invalid'),false);assert.equal(serialized.includes(u.password),false);
});

test('A2.3 association needs real device proof and matching primary; retries are idempotent, no grants or history copied',async t=>{
  const f=await mentorAccountFixture(t),u=await f.account(),s=await f.login(u),d=await f.activate(),other=await f.activate(backup);
  const before=(await f.root.collection('credentials').get()).docs.map(r=>[r.id,r.data()]),defaults=(await f.root.collection('defaultMentorAssignments').get()).docs.map(r=>r.data()),history=(await f.root.collection('sessions').get()).docs.map(r=>r.data());
  const check=await f.call(d,'/api/a2-3/device-status','GET',undefined,s.token);assert.equal(check.status,200);assert.equal((await check.json()).associated,false);
  assert.equal((await f.call(d,f.target(),undefined,undefined,s.token)).status,401); // login + unlinked device is insufficient in the personal flow
  assert.equal((await f.personalRequest('/api/a2-3/associate',{requestId:randomUUID()},s.token,{Authorization:'Bearer '+d.credential})).status,403);
  assert.equal((await f.associate(other,s.token)).status,403);
  assert.equal((await f.associate(d,undefined)).status,401);
  const requestId=randomUUID();assert.deepEqual((await Promise.all([f.associate(d,s.token,requestId),f.associate(d,s.token,requestId)])).map(r=>r.status),[200,200]);
  assert.equal((await f.root.collection('msaDeviceAssociationEvents').get()).size,1);assert.equal((await f.root.collection('msaDeviceAssociations').get()).size,1);
  assert.deepEqual((await f.root.collection('credentials').get()).docs.map(r=>[r.id,r.data()]),before);assert.deepEqual((await f.root.collection('defaultMentorAssignments').get()).docs.map(r=>r.data()),defaults);assert.deepEqual((await f.root.collection('sessions').get()).docs.map(r=>r.data()),history);
  assert.equal((await f.call(d)).status,401);assert.equal((await f.call(d,'/api/device/status','GET',undefined,s.token)).status,200);
  assert.equal((await f.personalRequest(f.target(),undefined,s.token,{Authorization:'Bearer '+d.credential})).status,401);
  assert.equal((await f.call(other)).status,200); // unlinked legacy remains valid
  const roster=await f.call(d,f.target(primary,'/api/roster'),'GET',undefined,s.token);assert.equal(roster.status,200);const text=await roster.text();assert.equal(/WALI_FIKTIF_PRIVAT|ALAMAT_FIKTIF_PRIVAT|dateOfBirth|guardianName/.test(text),false);
  const replay=f.signed(d,f.target(),'GET',undefined,s.token);assert.equal((await fetch(f.apiBase+f.target(),replay)).status,200);assert.equal((await fetch(f.apiBase+f.target(),replay)).status,401);
  assert.equal((await f.personalRequest('/api/a2-3/associate',{requestId:randomUUID(),deviceId:other.deviceId,role:'superadmin'},s.token)).status,400);
});

test('A2.3 another Mentor cannot claim/access a device; overrides and snapshots remain authoritative',async t=>{
  const f=await mentorAccountFixture(t),a=await f.account(),b=await f.account({scope:backup,mentorId:'fictional-substitute'}),sa=await f.login(a),sb=await f.login(b),d=await f.activate();assert.equal((await f.associate(d,sa.token)).status,200);
  assert.equal((await f.associate(d,sb.token)).status,403);assert.equal((await f.call(d,f.target(),'GET',undefined,sb.token)).status,401);assert.equal((await f.call(d,f.target(backup),'GET',undefined,sa.token)).status,403);
  const cross={schoolId:'s2',groupId:'g4',serviceSessionId:'demo-airlangga-2026-10-16'};assert.equal((await f.call(d,f.target(cross,'/api/roster'),'GET',undefined,sa.token)).status,403);
  const before=(await f.root.collection('mentorAssignmentSnapshots').get()).docs.map(r=>r.data());
  await f.root.collection('sessionMentorOverrides').doc('fictional-a23-override').set({id:'fictional-a23-override',...primary,mentorId:'fictional-substitute'});
  assert.deepEqual((await (await f.personalRequest('/api/a2-3/context',undefined,sa.token)).json()).groups,[]);assert.equal((await f.call(d,f.target(),'GET',undefined,sa.token)).status,401);
  assert.deepEqual((await f.root.collection('mentorAssignmentSnapshots').get()).docs.map(r=>r.data()),before);
  assert.equal((await f.call(d,f.target(cross,'/api/roster'),'GET',undefined,sa.token)).status,401);
});

test('A2.3 associated device rejects account/link/session suspension and revocation, stale revisions and flag removal without legacy fallback',async t=>{
  const f=await mentorAccountFixture(t),u=await f.account(),s=await f.login(u),d=await f.activate();assert.equal((await f.associate(d,s.token)).status,200);
  const account=f.root.collection('msaAccounts').doc(u.uid),link=f.root.collection('mentorIdentityLinks').doc('fictional-mentor'),binding=f.root.collection('msaDeviceAssociations').doc(d.deviceId);
  const savedBinding=(await binding.get()).data();await binding.update({credentialId:'0'.repeat(64)});assert.equal((await f.call(d,f.target(),'GET',undefined,s.token)).status,401);assert.equal((await f.call(d)).status,401);await binding.set(savedBinding);
  await link.update({state:'revoked'});assert.equal((await f.call(d,f.target(),'GET',undefined,s.token)).status,401);assert.equal((await f.call(d)).status,401);await link.update({state:'active'});
  await binding.update({state:'revoked'});assert.equal((await f.call(d,f.target(),'GET',undefined,s.token)).status,401);await binding.update({state:'active'});
  await account.update({state:'suspended',revision:4});assert.equal((await f.call(d,f.target(),'GET',undefined,s.token)).status,401);assert.equal((await f.call(d)).status,401);assert.equal((await f.login(u)).response.status,401);
  assert.equal((await f.request('/api/admin/backup-assignments',{deviceId:d.deviceId,grants:[backup],reason:'Penugasan fiktif ditolak saat akun suspended',idempotencyKey:randomUUID()})).status,403);
  await account.update({state:'active',revision:5});const renewed=await f.login(u);assert.equal(renewed.response.status,200);assert.equal((await f.call(d,f.target(),'GET',undefined,renewed.token)).status,401);assert.equal((await f.associate(d,renewed.token)).status,403);
  const fresh=await f.activate();assert.equal((await f.associate(fresh,renewed.token)).status,200);
  assert.equal((await f.personalRequest('/api/a2-3/logout',{},renewed.token)).status,200);assert.equal((await f.call(fresh,f.target(),'GET',undefined,renewed.token)).status,401);assert.equal((await f.call(fresh)).status,401);
  delete process.env.ABC_MSA_A2_3;assert.equal((await f.call(fresh)).status,401);assert.equal((await fetch(f.mentorBase+'/mentor-account.html')).status,404);
  const unlinked=await f.activate();assert.equal((await f.call(unlinked)).status,200); // opt-out never converts linked devices to legacy
  const disabled=await createLocalAdminAuthentication(f);assert.equal(disabled.a1.mentor,undefined);const server=createRosterServer({...f,adminAuthentication:disabled});server.listen(0,'127.0.0.1');await once(server,'listening');
  try{assert.equal((await fetch('http://127.0.0.1:'+server.address().port+'/api/a2-3/context')).status,404);}finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});await disabled.close();}
});

test('A2.3 primary/backup attendance stays separate and session scoped; expired grants and revoked receipt retries remain denied',async t=>{
  const f=await mentorAccountFixture(t),u=await f.account(),s=await f.login(u),d=await f.activate();assert.equal((await f.associate(d,s.token)).status,200);
  const r=await f.request('/api/admin/backup-assignments',{deviceId:d.deviceId,grants:[backup],reason:'Backup fiktif untuk uji akun Mentor',idempotencyKey:randomUUID()});assert.equal(r.status,201);
  const contexts=await (await f.call(d,'/api/roster-context','GET',undefined,s.token)).json();assert.deepEqual(contexts.contexts.map(c=>c.accessKind??'primary').sort(),['backup','primary']);
  const save={expectedRevision:0,idempotencyKey:randomUUID(),records:[{studentId:'fictional-1',status:'present'},{studentId:'fictional-2',status:'absent'}]},backupSave={expectedRevision:0,idempotencyKey:randomUUID(),records:[{studentId:'fictional-backup-student',status:'present'}]};
  assert.equal((await f.call(d,f.target(),'PUT',save,s.token)).status,200);assert.equal((await f.call(d,f.target(backup),'PUT',backupSave,s.token)).status,200);
  assert.equal((await f.call(d,f.target(primary,'/api/attendance/finalize'),'POST',{expectedRevision:1,idempotencyKey:randomUUID(),confirm:true},s.token)).status,200);
  assert.equal((await f.call(d,f.target(primary,'/api/attendance/corrections'),'POST',{expectedRevision:2,idempotencyKey:randomUUID(),records:[{studentId:'fictional-1',status:'excused'}],reason:'Koreksi fiktif mempertahankan versi sebelumnya.'},s.token)).status,200);
  const batches=(await f.root.collection('sessions').where('serviceSessionId','==',primary.serviceSessionId).get()).docs.map(r=>r.data());assert.equal(batches.length,2);assert.equal(batches.find(b=>b.groupId==='g1').revision,3);assert.equal(batches.find(b=>b.groupId==='g2').revision,1);
  const past=(await f.root.collection('sessions').doc('fictional-batch').get()).data();assert.equal(past.records[0].name,'Siswa Fiktif Snapshot');
  const audits=(await f.root.collection('attendanceHistory').get()).docs.map(d=>d.data());assert.equal(audits.length,4);assert.ok(audits.every(a=>a.actorUid===u.uid&&a.accountRevision===3&&a.identityLinkRevision===1&&a.deviceAssociationRevision===1));
  assert.equal((await f.call(d,f.target({...backup,serviceSessionId:'demo-pakel-2026-10-09'}),'GET',undefined,s.token)).status,403);
  const backupRow=await r.json();assert.equal((await f.request('/api/admin/backup-assignments/'+backupRow.id+'/close',{reason:'Pencabutan backup fiktif',status:'revoked'})).status,200);assert.equal((await f.call(d,f.target(backup),'PUT',backupSave,s.token)).status,403);
  await f.root.collection('credentials').doc((await f.root.collection('msaDeviceAssociations').doc(d.deviceId).get()).data().credentialId).update({expiresAt:Date.now()-1});assert.equal((await f.call(d,f.target(),'GET',undefined,s.token)).status,401);
});

test('A2.3 revoke during write fails closed and authorization reads serialize actual concurrent revoke/write without partial history',async t=>{
  const f=await mentorAccountFixture(t),u=await f.account(),s=await f.login(u),d=await f.activate();assert.equal((await f.associate(d,s.token)).status,200);
  const personal=await f.adminAuthentication.a1.mentor.resolve('Bearer '+s.token),raw=f.signed(d,f.target(),'PUT',{},s.token),proof=await f.pairing.verifyRequest('Bearer '+d.credential,{method:'PUT',target:f.target(),body:'{}',timestamp:raw.headers['X-Device-Timestamp'],nonce:raw.headers['X-Device-Nonce'],signature:raw.headers['X-Device-Signature']});
  let entered,release;const reached=new Promise(r=>entered=r),hold=new Promise(r=>release=r);
  const attendance=createEmulatorAttendance({...f,now:Date.now,credentials:{authenticate:async(...args)=>{entered();await hold;return f.credentials.authenticate(...args);}}});
  const body={expectedRevision:0,idempotencyKey:randomUUID(),records:[{studentId:'fictional-1',status:'present'}]};
  const writing=attendance.executeAuthorized({authorization:'Bearer '+d.credential,proof,scope:primary,action:'save',body,personal});const settled=writing.catch(e=>e);await reached;await f.root.collection('msaAccounts').doc(u.uid).update({state:'suspended',revision:4});release();assert.equal((await settled).status,401);assert.equal((await f.root.collection('attendanceHistory').get()).size,0);assert.equal((await f.root.collection('attendanceSubmissions').get()).size,0);
  await f.root.collection('msaAccounts').doc(u.uid).update({state:'active',revision:5});const freshSession=await f.login(u),fresh=await f.activate();assert.equal((await f.associate(fresh,freshSession.token)).status,200);
  const race=await Promise.allSettled([f.call(fresh,f.target(),'PUT',body,freshSession.token),f.root.collection('mentorIdentityLinks').doc('fictional-mentor').update({state:'revoked',revision:2})]);assert.equal(race[0].status,'fulfilled');assert.ok([200,401].includes(race[0].value.status));assert.equal((await f.call(fresh,f.target(),'PUT',body,freshSession.token)).status,401);assert.equal((await f.call(fresh)).status,401);
  const history=(await f.root.collection('attendanceHistory').get()).docs.map(r=>r.data());assert.equal(history.length,race[0].value.status===200?1:0);
});
