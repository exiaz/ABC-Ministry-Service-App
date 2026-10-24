import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {registrationFixture,scope,proof} from './msa-a2-2-fixture.mjs';
import {createMsaRegistration} from '../../backend/msa-registration.mjs';
import {hash} from '../../backend/msa-accounts.mjs';
import {createLocalAdminAuthentication} from '../../backend/admin-auth.mjs';
import {createAdminServer} from '../../admin-server.mjs';
import {createRosterServer} from '../../backend/server.mjs';

test('A2.2 registration pending, generic duplicates, case-insensitive races, replay and private applicant boundary',async t=>{
  const f=await registrationFixture(t),v=f.value();
  const results=await Promise.all([f.register(v),f.register(v)]);assert.deepEqual(results.map(r=>r.response.status),[202,202]);const u=results[0];
  const r=(await f.root.collection('msaAccounts').doc(u.uid).get()).data();assert.equal(r.state,'pending');assert.equal(r.identity.state,'unverified');assert.deepEqual(r.roles,[]);assert.deepEqual(r.eligibleRoles,[]);assert.equal(r.phone.state,'supplied');assert.equal(r.phone.normalized,'+6281234567890');
  assert.equal((await f.root.collection('msaIdentityEvents').where('targetUid','==',u.uid).get()).size,1);
  const duplicate=await f.register({...v,requestId:randomUUID(),username:v.username.toUpperCase(),password:'Other-fictitious-password'});assert.equal(duplicate.response.status,202);assert.deepEqual(duplicate.body,u.body);
  const race=f.value(),out=await Promise.all([f.register(race),f.register({...race,requestId:randomUUID(),username:race.username.toUpperCase()})]);assert.deepEqual(out.map(x=>x.response.status),[202,202]);assert.equal(new Set(out.map(x=>x.uid)).size,1);
  assert.equal((await f.root.collection('msaAccounts').where('origin','==','a2-2').get()).size,2);
  const existing=await f.enroll({username:'existing.fixture'}),collision=await f.register({...f.value(),username:'EXISTING.FIXTURE'});assert.equal(collision.response.status,202);assert.equal(collision.uid,existing.uid);assert.equal((await f.signIn(existing)).response.status,200);assert.equal((await f.call(existing.uid)).status,403);
  assert.equal((await f.signIn(u)).response.status,401);
  for(const path of ['/api/a2-2/queue','/api/a2-2/accounts/'+u.uid,'/api/a1/accounts','/api/a1/audit'])assert.equal((await f.request(path,undefined,'')).status,401);
  for(const body of [{...f.value(),roles:['superadmin']},{...f.value(),username:'\u212Aak.Xyz'},{...f.value(),fullName:'Test\u200bNama'}])assert.equal((await f.request('/api/a2-2/register',body,'')).status,400);
  const all=JSON.stringify((await f.root.collection('msaAccounts').get()).docs.map(d=>d.data()));assert.equal(all.includes(v.password),false);assert.equal(JSON.stringify(u.body).includes(u.uid),false);assert.equal(JSON.stringify(u.body).includes('@'),false);
});

test('A2.2 partial Auth before/after creation and Firestore finalization failures resume same UID without credential overwrite',async t=>{
  const f=await registrationFixture(t);
  for(const mode of ['before-auth','after-auth','finalize']){
    const v=f.value();let failed=false,calls=0;
    const service=createMsaRegistration({...f,assertEnabled:()=>f.adminAuthentication.a1.registration.enabled(),db:{runTransaction:async fn=>{calls++;if(mode==='finalize'&&calls===4){failed=true;throw Error('Finalisasi fiktif gagal.');}return f.db.runTransaction(fn);}},auth:{getUser:uid=>f.auth.getUser(uid),createUser:async args=>{if(!failed&&mode==='before-auth'){failed=true;throw Error('Provider fiktif belum tersedia.');}const u=await f.auth.createUser(args);if(!failed&&mode==='after-auth'){failed=true;throw Error('Balasan provider fiktif hilang.');}return u;}}});
    await assert.rejects(service.register(v),e=>e.status===503);const claim=(await f.root.collection('msaUsernames').doc(v.username).get()).data();f.created.push(claim.uid);
    assert.equal((await f.root.collection('msaAccounts').doc(claim.uid).get()).data().provisioning,'failed');assert.equal(claim.state,'reserved');
    if(mode!=='before-auth')await assert.rejects(service.register({...v,password:'Wrong-fictitious-password'}),e=>e.status===503);
    assert.equal((await service.register(v)).received,true);
    const row=(await f.root.collection('msaAccounts').doc(claim.uid).get()).data();assert.equal(row.provisioning,'ready');assert.equal(row.state,'pending');assert.equal((await f.verifyPassword(row.providerAlias,v.password)).uid,row.uid);
    const events=await f.root.collection('msaIdentityEvents').where('targetUid','==',row.uid).get();assert.equal(events.size,1);assert.equal(JSON.stringify(events.docs.map(d=>d.data())).includes(v.password),false);
  }
});

test('A2.2 review requires independent evidence, records pending/rejection reasons, and never grants roles or phone verification',async t=>{
  const f=await registrationFixture(t),u=await f.register(),other=await f.register();
  const detail=await f.call(u.uid);assert.equal(detail.status,200);const d=await detail.json();assert.equal(d.warnings.samePhone,1);assert.equal(d.warnings.sameName,1);assert.equal(d.account.phone.state,'supplied');
  const member=await f.enroll(),login=await f.signIn(member);assert.equal((await f.review(u,{},login.token)).status,403);
  for(const evidence of [undefined,{method:'same-name',reference:'Nama dan nomor cocok',confirmed:true},{...proof,confirmed:false}])assert.equal((await f.review(u,{evidence})).status,400);
  assert.equal((await f.review(u,{decision:'pending',evidence:undefined,reason:'Bukti independen belum tersedia.'})).status,200);
  assert.equal((await f.review(u,{expectedRevision:2,decision:'reject',evidence:undefined,reason:'Bukti fiktif tidak dapat dikonfirmasi.'})).status,200);
  assert.equal((await f.signIn(u)).response.status,401);
  const value={expectedRevision:3,requestId:randomUUID(),reason:'Bukti fiktif baru telah diperiksa langsung.',decision:'approve',scope,evidence:proof};
  assert.deepEqual((await Promise.all([f.call(u.uid,'review',value),f.call(u.uid,'review',value)])).map(r=>r.status),[200,200]);
  assert.equal((await f.call(u.uid,'review',{...value,reason:'Replay berbeda ditolak.'})).status,409);
  const row=(await f.root.collection('msaAccounts').doc(u.uid).get()).data();assert.equal(row.state,'active');assert.equal(row.identity.state,'verified');assert.equal(row.revision,4);assert.deepEqual(row.roles,[]);assert.deepEqual(row.eligibleRoles,[]);assert.equal(row.phone.verifiedAt,null);
  const events=(await (await f.call(u.uid)).json()).events;assert.equal(events.length,4);assert.ok(events.slice(1).every(e=>e.actorUid===f.uid&&e.scope.schoolId===scope.schoolId&&e.previousRevision+1===e.revision&&e.reason));
  assert.equal((await f.review(other,{state:'active'})).status,400);
});

test('A2.2 PIC queue and review need explicit per-account Superadmin delegation and exact current scope',async t=>{
  const f=await registrationFixture(t),u=await f.register(),other=await f.register();
  await f.root.collection('adminPairingPermissions').doc(f.uid).set({active:true,grants:[scope]});
  const create=await f.request('/api/admin/accounts',{email:'pic-'+randomUUID()+'@example.invalid',password:'Fictitious-PIC-password-2026',actions:['pairing:read'],grants:[scope]});assert.equal(create.status,201);const {uid}=await create.json();f.created.push(uid);
  const picRow=(await f.root.collection('adminAccounts').doc(uid).get()).data(),picToken=(await (await f.login({email:picRow.email,password:'Fictitious-PIC-password-2026'})).json()).token;
  assert.deepEqual((await (await f.request('/api/a2-2/queue',undefined,picToken)).json()).accounts,[]);assert.equal((await f.review(u,{},picToken)).status,403);assert.equal((await f.call(u.uid,undefined,undefined,picToken)).status,403);
  const delegation={expectedRevision:1,requestId:randomUUID(),reason:'Delegasi fiktif untuk PIC sesuai cakupan.',reviewerUid:uid,scope};
  assert.equal((await f.call(u.uid,'delegate',delegation,picToken)).status,403);assert.equal((await f.call(u.uid,'delegate',delegation)).status,200);
  const queue=await (await f.request('/api/a2-2/queue',undefined,picToken)).json();assert.deepEqual(queue.accounts.map(a=>a.uid),[u.uid]);
  assert.equal((await f.call(other.uid,undefined,undefined,picToken)).status,403);
  assert.equal((await f.review(u,{expectedRevision:2,scope:{...scope,groupId:'g2'}},picToken)).status,403);
  assert.equal((await f.review(u,{expectedRevision:2},picToken)).status,200);
  assert.equal((await f.link(u,{expectedRevision:3},picToken)).status,200);
  assert.equal((await f.change(other.uid,{role:'superadmin',scope:{organizationId:null}},picToken)).status,403);
  await f.root.collection('adminAccounts').doc(uid).update({revision:2});
  assert.equal((await f.call(u.uid,undefined,undefined,picToken)).status,401);
  const renewed=(await (await f.login({email:picRow.email,password:'Fictitious-PIC-password-2026'})).json()).token;
  assert.equal((await f.call(u.uid,undefined,undefined,renewed)).status,403);
  assert.equal((await f.call(u.uid)).status,200);
});

test('A2.2 concurrent mentor claims, transactional receipts, defaults and history preservation with no access/device inheritance',async t=>{
  const f=await registrationFixture(t),a=await f.register(),b=await f.register(),legacyCollections=['schools','groups','serviceSessions','sessions','mentors','defaultMentorAssignments','mentorAssignmentSnapshots','devices','credentials','backupAssignments','adminAccounts','adminSecurity'];
  const snapshot=async()=>Object.fromEntries(await Promise.all(legacyCollections.map(async name=>[name,(await f.root.collection(name).get()).docs.map(d=>[d.id,d.data()])]))),before=await snapshot();
  assert.equal((await f.link(a,{expectedRevision:1})).status,403);
  for(const u of [a,b])assert.equal((await f.review(u)).status,200);
  const value={expectedRevision:2,requestId:randomUUID(),reason:'Konfirmasi Mentor fiktif dari bukti independen.',mentorId:'fictional-mentor',scope,evidence:proof};
  const secondValue={...value,requestId:randomUUID()},results=await Promise.all([f.call(a.uid,'link',value),f.call(b.uid,'link',secondValue)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const winner=results[0].status===200?a:b,loser=winner===a?b:a;
  const winningValue=winner===a?value:secondValue;assert.equal((await f.call(winner.uid,'link',winningValue)).status,200);assert.equal((await f.call(winner.uid,'link',{...winningValue,mentorId:'fictional-substitute'})).status,409);
  assert.equal((await f.call(winner.uid,'link',Object.fromEntries(Object.entries(winningValue).reverse()))).status,200);
  assert.equal((await f.link(loser)).status,409);assert.equal((await f.root.collection('mentorIdentityLinks').get()).size,1);
  const events=await f.root.collection('msaIdentityEvents').where('operation','==','mentor-linked').get();assert.equal(events.size,1);assert.equal(events.docs[0].data().mentorId,'fictional-mentor');
  const defaults=await (await f.call(winner.uid,'defaults')).json();assert.deepEqual(defaults,{mentorId:'fictional-mentor',assignments:[scope],attendanceAccess:false,deviceAccess:false});
  assert.deepEqual(await snapshot(),before);
  const session=await f.signIn(winner);assert.equal(session.response.status,200);
  const profile=await (await f.request('/api/a1/session',undefined,session.token)).json();assert.deepEqual(profile.identity,{state:'verified'});assert.equal(JSON.stringify(profile).includes(proof.reference),false);assert.equal(JSON.stringify(profile).includes('+6281234567890'),false);
  for(const path of ['/api/admin/session','/api/a1/accounts','/api/a2-2/queue'])assert.ok([401,403].includes((await f.request(path,undefined,session.token)).status));
  assert.equal((await f.request('/api/a1/access',{role:'volunteer',scope:{organizationId:'org-a'}},session.token)).status,403);
  assert.equal(await f.credentials.authenticate('Bearer '+session.token),null);
  const api=createRosterServer({...f});api.listen(0,'127.0.0.1');await once(api,'listening');
  try{for(const target of ['/api/device/status','/api/roster-context','/api/roster?'+new URLSearchParams(scope)])assert.equal((await fetch('http://127.0.0.1:'+api.address().port+target,{headers:{Authorization:'Bearer '+session.token}})).status,401);}finally{await new Promise(resolve=>{api.close(resolve);api.closeAllConnections();});}
  assert.equal((await f.change(winner.uid,{expectedRevision:3,state:'suspended',role:undefined,scope:undefined,status:undefined})).status,200);assert.equal((await f.request('/api/a1/session',undefined,session.token)).status,401);assert.equal((await f.signIn(winner)).response.status,401);assert.equal((await f.call(winner.uid,'defaults')).status,403);
});

test('A2.2 rejects substitution/cross-scope links, cannot review legacy/A1 identities and resolves effective assignments read-only',async t=>{
  const f=await registrationFixture(t),u=await f.register(),a1=await f.enroll();
  assert.equal((await f.review({uid:a1.uid})).status,403);assert.equal((await f.review({uid:f.uid})).status,403);
  assert.equal((await f.review(u)).status,200);
  assert.equal((await f.link(u,{mentorId:'fictional-substitute'})).status,403);
  assert.equal((await f.link(u,{scope:{...scope,serviceSessionId:'demo-pakel-2026-10-23'}})).status,403);
  assert.equal((await f.link(u)).status,200);
  await f.root.collection('defaultMentorAssignments').doc('new-default').set({id:'new-default',groupId:'g1',mentorId:'fictional-substitute',effectiveFrom:'2026-10-01'});
  assert.deepEqual((await (await f.call(u.uid,'defaults')).json()).assignments,[]);
  assert.equal((await f.root.collection('sessions').doc('fictional-batch').get()).data().records[0].name,'Siswa Fiktif Snapshot');
  assert.equal((await f.root.collection('mentorAssignmentSnapshots').doc('fictional-mentor-snapshot').get()).data().mentorId,'fictional-mentor');
});

test('A2.2 registration rate limits persist, origin/method/query/body safeguards and live/default/off-namespace gates fail closed',async t=>{
  const f=await registrationFixture(t),v=f.value();
  assert.equal((await f.request('/api/a2-2/register',v,'',{Origin:'https://evil.example'})).status,403);
  assert.equal((await f.request('/api/a2-2/register?role=superadmin',v,'')).status,400);
  assert.equal((await f.request('/api/a2-2/register',{...v,fullName:'a'.repeat(5000)},'')).status,413);
  for(let i=0;i<8;i++)assert.equal((await f.register(v)).response.status,202);
  assert.equal((await f.register(v)).response.status,429);
  const restarted=await createLocalAdminAuthentication({repository:f.repository});try{await assert.rejects(restarted.a1.registration.register(v),e=>e.status===429);}finally{await restarted.close();}
  await f.root.collection('msaIntakeLimits').doc(hash('review:'+f.uid)).set({window:Math.floor(Date.now()/60000),count:120});
  const limited=await f.request('/api/a2-2/queue');assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'60');assert.equal((await f.call('missing','defaults')).status,429);
  delete process.env.ABC_MSA_A2_2;
  const disabled=await createLocalAdminAuthentication({repository:f.repository}),server=createAdminServer({adminAuthentication:disabled});server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    assert.equal(disabled.a1.registration,undefined);const base='http://127.0.0.1:'+server.address().port;
    for(const target of ['/register.html','/identity-review.html','/msa-registration-ui.js','/msa-intake.css','/api/a2-2/queue'])assert.equal((await fetch(base+target)).status,404);
    assert.equal((await f.request('/api/a2-2/queue')).status,503);
  }finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});await disabled.close();}
  process.env.ABC_MSA_A2_2='1';const original=process.env.ABC_FIRESTORE_NAMESPACE;process.env.ABC_FIRESTORE_NAMESPACE='a2-2-not-a-test';
  const operational=await createLocalAdminAuthentication();try{assert.equal(operational.a1.registration,undefined);}finally{await operational.close();process.env.ABC_FIRESTORE_NAMESPACE=original;}
});
