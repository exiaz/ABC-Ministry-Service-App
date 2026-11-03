import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {migrationFixture,primary,backup} from './msa-a2-4c-fixture.mjs';
import {simulateUsernameMapping,migrationCheckpoint,compareMigrationCheckpoints,verifyMigrationRollback} from '../../backend/msa-migration.mjs';
import {sealSnapshot} from '../../local-snapshots.mjs';
import {hash} from '../../backend/msa-accounts.mjs';
import {createLocalAdminAuthentication} from '../../backend/admin-auth.mjs';
const snapshot=async f=>{const tables={};for(const c of await f.root.listCollections())tables[c.id]=(await c.get()).docs.map(d=>({...d.data(),id:d.id})).sort((a,b)=>a.id.localeCompare(b.id));return tables;};
const providers=async f=>(await f.auth.listUsers(1000)).users.map(u=>u.toJSON());
const credentialFacts=rows=>rows.map(u=>Object.fromEntries(['uid','email','disabled','passwordHash','passwordSalt','customClaims'].map(k=>[k,u[k]])));
const worker=async(f,value,mode)=>{
  const child=fork(new URL('./msa-recovery-worker.mjs',import.meta.url),[],{env:process.env,stdio:['ignore','ignore','ignore','ipc'],windowsHide:true});
  try{const response=once(child,'message',{signal:AbortSignal.timeout(15000)});child.send({mode,value});const [message]=await response;if(mode==='crash-after-provider'){assert.equal(message.phase,'provider-updated');const exit=once(child,'exit');child.kill();await exit;}else await once(child,'exit');return message;}
  finally{if(child.exitCode===null&&child.signalCode===null){const exit=once(child,'exit');child.kill();await exit;}}
};
test('A2.4C authorized read-only inventory classifies records without secrets or domain/Auth writes; PIC/personal/foreign origin and live gate denied',async t=>{
  const f=await migrationFixture(t),u=await f.account(),s=await f.login(u),d=await f.activate(),legacy=await f.activate();await f.associate(d,s.token);
  assert.equal((await f.call(d,f.target(),'PUT',{expectedRevision:0,idempotencyKey:randomUUID(),records:[{studentId:'fictional-1',status:'present'}]},s.token)).status,200);
  await f.request('/api/admin/backup-assignments',{deviceId:d.deviceId,grants:[backup],reason:'Backup fiktif untuk inventaris',idempotencyKey:randomUUID()});
  const before=await snapshot(f),authBefore=await providers(f),response=await f.request('/api/a2-4c/preflight');assert.equal(response.status,200);const r=await response.json();assert.equal(r.readOnly,true);assert.equal(r.productionVerdict,'NO-GO');assert.ok(r.records.some(r=>r.code==='unresolved-legacy'));assert.ok(r.records.some(r=>r.code==='linked-device'));assert.ok(r.records.some(r=>r.code==='mentor-linked'));assert.ok(r.records.some(r=>r.code==='backup-recheck'));
  console.log('A2.4C fictional inventory: '+JSON.stringify({summary:r.summary,dryRunVerdict:r.dryRunVerdict,productionVerdict:r.productionVerdict,blockers:r.productionBlockers.map(b=>b.code)}));
  assert.equal(hash(JSON.stringify(await snapshot(f))),hash(JSON.stringify(before)));assert.equal(hash(JSON.stringify(await providers(f))),hash(JSON.stringify(authBefore)));
  const text=JSON.stringify(r);for(const secret of [f.uid,u.uid,u.username,u.phone,u.password,d.deviceId,d.credential,legacy.deviceId,'providerAlias','challengeHash','passwordHash','studentId',f.email])assert.ok(!text.includes(secret),'unexpected private data in report');
  assert.equal((await f.request('/api/a2-4c/preflight',undefined,'')).status,401);assert.equal((await f.request('/api/a2-4c/preflight',undefined,s.token)).status,403);
  const email='preflight-pic-'+randomUUID()+'@example.invalid',pw=randomBytes(24).toString('base64url'),created=await f.request('/api/admin/accounts',{email,password:pw,actions:['pairing:read'],grants:[primary]}),{uid}=await created.json();f.created.push(uid);const token=await f.adminAuthentication.signIn({email,password:pw});assert.equal((await f.request('/api/a2-4c/preflight',undefined,token)).status,403);
  assert.equal((await f.request('/api/a2-4c/preflight',undefined,f.token,{Origin:'https://example.invalid'})).status,403);assert.equal((await f.request('/api/a2-4c/preflight',{})).status,405);assert.equal((await f.request('/api/a2-4c/preflight?uid='+u.uid)).status,405);
  assert.equal((await f.root.collection('msaDeviceAssociations').doc(legacy.deviceId).get()).exists,false);
  delete process.env.ABC_MSA_A2_4C;assert.equal((await f.request('/api/a2-4c/preflight')).status,503);
});
test('A2.4C fictional momor1n/PIC bindings preserve original provider passwords, owner and scoped permissions; detached dry-run never applies proposals',async t=>{
  const f=await migrationFixture(t),email='mapping-pic-'+randomUUID()+'@example.invalid',pw=randomBytes(24).toString('base64url'),created=await f.request('/api/admin/accounts',{email,password:pw,actions:['pairing:read'],grants:[primary]}),{uid}=await created.json();f.created.push(uid);const token=await f.adminAuthentication.signIn({email,password:pw});
  // Trusted fictional setup uses A2.1; inventory/dry-run below perform no writes.
  const bind=(id,session,password,username)=>f.adminAuthentication.a1.legacyPilot.claim({expectedUid:id,header:'Bearer '+session,password,username,reason:'Fixture binding fiktif sebelum baseline dry run',confirmed:true});
  const authBefore=credentialFacts(await providers(f)),owner=(await f.root.collection('adminSecurity').doc('owner').get()).data(),role=(await f.root.collection('adminAccounts').doc(uid).get()).data();
  await bind(f.uid,f.token,f.password,'momor1n');await bind(uid,token,pw,'pilot.pic');
  assert.equal(hash(JSON.stringify(credentialFacts(await providers(f)))),hash(JSON.stringify(authBefore)));assert.equal(hash(JSON.stringify((await f.root.collection('adminSecurity').doc('owner').get()).data())),hash(JSON.stringify(owner)));assert.equal(hash(JSON.stringify((await f.root.collection('adminAccounts').doc(uid).get()).data())),hash(JSON.stringify(role)));
  const before=await snapshot(f),p=await providers(f),plan=simulateUsernameMapping(before,p,[{uid:f.uid,username:'MOMOR1N',reauthenticatedUid:f.uid,identityVerified:true},{uid,username:'Pilot.Pic',reauthenticatedUid:uid,identityVerified:true}]);assert.equal(plan.verdict,'GO');assert.equal(plan.mutations,0);assert.equal(plan.uidRoleScopeOwnerHistoryPreserved,true);assert.equal(hash(JSON.stringify(await snapshot(f))),hash(JSON.stringify(before)));assert.equal(hash(JSON.stringify(await providers(f))),hash(JSON.stringify(p)));
  const r=await (await f.request('/api/a2-4c/preflight')).json();assert.ok(r.records.filter(r=>r.kind==='legacy-account').every(r=>r.status==='ready'));
  const superadmin=await f.signIn({username:'MOMOR1N',password:f.password}),pic=await f.signIn({username:'pilot.pic',password:pw});assert.equal(superadmin.uid,f.uid);assert.equal(pic.uid,uid);assert.equal((await f.request('/api/admin/session',undefined,superadmin.token)).status,200);assert.equal((await f.request('/api/admin/accounts',undefined,pic.token)).status,403);assert.equal((await f.request('/api/a2-4c/preflight',undefined,pic.token)).status,403);
  assert.equal(simulateUsernameMapping(before,p,[{uid,username:'MOMOR1N',reauthenticatedUid:uid,identityVerified:true}]).verdict,'NO-GO');
});
test('A2.4C duplicate identities, conflicting registry/link/device and suspended/revoked states remain unclaimed or denied; rollback refuses stale security',async t=>{
  const f=await migrationFixture(t),u=await f.account(),s=await f.login(u),d=await f.activate();await f.associate(d,s.token);const old=await snapshot(f),p=await providers(f),baseline=migrationCheckpoint(old,p,hash(JSON.stringify([old.sessions,old.attendanceHistory])));
  const second=await f.register();await f.root.collection('msaUsernames').doc(u.username.toUpperCase()).set({uid:second.uid,state:'ready'});
  await f.root.collection('msaAccounts').doc(u.uid).update({state:'suspended',revision:4});await f.root.collection('msaDeviceAssociations').doc(d.deviceId).update({state:'revoked',revision:2});await f.root.collection('devices').doc(d.deviceId).update({state:'revoked',msaAccountBinding:{uid:u.uid,revision:2}});
  const before=await snapshot(f),r=await (await f.request('/api/a2-4c/preflight')).json();for(const code of ['possible-duplicate','username-conflict','retained-denial','mentor-conflict'])assert.ok(r.records.some(r=>r.code===code),code);assert.equal(r.dryRunVerdict,'NO-GO');assert.equal(hash(JSON.stringify(await snapshot(f))),hash(JSON.stringify(before)));assert.equal((await f.login(u)).response.status,401);assert.equal((await f.call(d)).status,401);
  const current=migrationCheckpoint(before,await providers(f),hash(JSON.stringify([before.sessions,before.attendanceHistory])));assert.equal(compareMigrationCheckpoints(current,baseline,{snapshotSealed:true,expectedMappingVerified:true}).verdict,'NO-GO');assert.equal(compareMigrationCheckpoints(current,current,{snapshotSealed:true,expectedMappingVerified:true}).restoreAuthorized,false);
});
test('A2.4C actual worker crash after Firebase success leaves durable lock; restarted/foreign worker cannot retry or bypass suspension',async t=>{
  const f=await migrationFixture(t),u=await f.account(),s=await f.login(u),d=await f.activate();await f.associate(d,s.token);await f.approved(u);const delivery=await f.recovery.deliver(u.username),password=randomBytes(24).toString('base64url'),value={...delivery,password};
  await worker(f,value,'crash-after-provider');let a=(await f.root.collection('msaAccounts').doc(u.uid).get()).data();assert.equal(a.recoveryLock,delivery.id);assert.equal(a.revision,4);assert.equal((await f.login(u)).response.status,401);assert.equal((await f.login({...u,password})).response.status,401);
  // Direct verifier proves provider success while all domain sessions stay shut.
  assert.equal((await f.verifyPassword(a.providerAlias,password)).uid,u.uid);assert.equal((await f.call(d,'/api/device/status','GET',undefined,s.token)).status,401);
  assert.equal((await worker(f,value,'reset')).status,403);
  const restarted=await createLocalAdminAuthentication({...f,repository:f.repository,mentorAccounts:f.mentorAccounts});try{await assert.rejects(restarted.a1.authorize('Bearer '+s.token),e=>e.status===401);}finally{await restarted.close();}
  const before=await snapshot(f),r=await (await f.request('/api/a2-4c/preflight')).json();assert.ok(r.records.some(r=>r.code==='recovery-lock'));assert.ok(r.records.some(r=>r.code==='uncertain-recovery'));assert.equal(hash(JSON.stringify(await snapshot(f))),hash(JSON.stringify(before)));
  assert.equal((await f.request('/api/a1/accounts/'+u.uid+'/change',{state:'suspended',expectedRevision:4,requestId:randomUUID(),reason:'Suspension fiktif sesudah worker crash'})).status,200);assert.equal((await worker(f,value,'reset')).status,403);a=(await f.root.collection('msaAccounts').doc(u.uid).get()).data();assert.equal(a.state,'suspended');assert.equal(a.recoveryLock,delivery.id);
});

test('A2.4C real isolated Auth/Firestore export seal passes only current checkpoint; stale export after revoke is NO-GO even with feature flag off',{timeout:90000},async t=>{
  const f=await migrationFixture(t),u=await f.account(),s=await f.login(u),d=await f.activate();await f.associate(d,s.token);
  const before=await snapshot(f),p=await providers(f),history=hash(JSON.stringify([before.sessions,before.attendanceHistory,before.mentorAssignmentSnapshots])),checkpoint=migrationCheckpoint(before,p,history);
  await mkdir('.emulator-data/migration-qa',{recursive:true});const directory=await mkdtemp(path.resolve('.emulator-data/migration-qa/real-export-'));
  const ports=JSON.parse(process.env.ABC_STAGE3_TEST_PORTS),response=await fetch('http://127.0.0.1:'+ports[2]+'/_admin/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:directory,initiatedBy:'abc-migration-test',targets:['auth','firestore']}),signal:AbortSignal.timeout(60000)});assert.equal(response.status,200);await response.body?.cancel();
  await writeFile(path.join(directory,'migration-checkpoint.json'),JSON.stringify(checkpoint));await sealSnapshot(directory);assert.equal((await verifyMigrationRollback(checkpoint,directory,{expectedMappingVerified:true})).verdict,'GO');
  assert.equal(hash(JSON.stringify(await snapshot(f))),hash(JSON.stringify(before)));assert.equal(hash(JSON.stringify(await providers(f))),hash(JSON.stringify(p)));
  assert.equal((await f.request('/api/a2-4/accounts/'+u.uid+'/devices/'+d.deviceId+'/revoke',{expectedRevision:1,expectedAccountRevision:3,requestId:randomUUID(),reason:'Revokasi fiktif sesudah snapshot baseline',confirmed:true})).status,200);
  const after=await snapshot(f),current=migrationCheckpoint(after,await providers(f),hash(JSON.stringify([after.sessions,after.attendanceHistory,after.mentorAssignmentSnapshots])));delete process.env.ABC_MSA_A2_4C;
  const result=await verifyMigrationRollback(current,directory,{expectedMappingVerified:true});assert.equal(result.verdict,'NO-GO');assert.equal(result.restoreAuthorized,false);assert.equal((await f.call(d,'/api/device/status','GET',undefined,s.token)).status,401);assert.equal((await f.root.collection('msaDeviceAssociations').doc(d.deviceId).get()).data().state,'revoked');
});
