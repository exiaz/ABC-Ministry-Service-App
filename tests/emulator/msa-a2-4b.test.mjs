import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {recoveryFixture,primary,backup,evidence} from './msa-a2-4b-fixture.mjs';
import {createMsaRecovery} from '../../backend/msa-recovery.mjs';
import {createEmulatorAttendance} from '../../backend/attendance.mjs';
const password=()=>randomBytes(24).toString('base64url');
const change=(f,u,state,expectedRevision)=>f.request('/api/a1/accounts/'+u.uid+'/change',{state,expectedRevision,requestId:randomUUID(),reason:'Perubahan status fiktif bersamaan pemulihan'});

test('A2.4B generic valid/unknown requests, persistent budgets, deduplication, gates and no public delivery',async t=>{
  const f=await recoveryFixture(t),u=await f.account();
  const known=await f.submit(u),unknown=await f.submit({username:'unknown-username'});assert.equal(known.status,202);assert.equal(unknown.status,202);assert.deepEqual(await known.json(),await unknown.json());
  await Promise.all([f.submit(u),f.submit(u)]);assert.equal((await f.rows()).length,1);assert.equal((await f.login(u)).response.status,200);
  assert.equal((await f.request('/api/a2-4b/deliver',{username:u.username},'')).status,401);
  assert.equal((await f.personalRequest('/api/a2-3/recovery-request',{username:'unknown-mentor',requestId:randomUUID()})).status,202);
  for(let i=0;i<8;i++)await f.submit({username:'limited-username'});
  assert.equal((await f.submit({username:'limited-username'})).status,429);
  // Reconstruct the service to prove the budget survives service restart.
  const again=createMsaRecovery({...f,registration:f.adminAuthentication.a1.registration,assertEnabled:()=>{}});
  await assert.rejects(again.request({username:'limited-username',requestId:randomUUID()}),e=>e.status===429);
  assert.equal((await f.request('/api/a2-4b/request',{username:'Kelvin',requestId:randomUUID()},'')).status,400);
  assert.equal((await f.request('/api/a2-4b/request',{username:u.username,phone:'081234567890',requestId:randomUUID()},'')).status,400);
  delete process.env.ABC_MSA_A2_4B;assert.equal((await f.submit(u)).status,503);await assert.rejects(f.recovery.deliver(u.username),e=>e.status===503);
});

test('A2.4B independent reviews, pending/reject/revoke, idempotency and Superadmin owner exclusion',async t=>{
  const f=await recoveryFixture(t),u=await f.account();await f.submit(u);let r=(await f.rows())[0];
  assert.equal((await f.recoveryReview(r,{},'')).status,401);const s=await f.signIn(u);assert.equal((await f.recoveryReview(r,{},s.token)).status,403);
  assert.equal((await f.recoveryReview(r,{evidence:undefined})).status,400);
  assert.equal((await f.recoveryReview(r,{evidence:{method:'phone-match',reference:'Nomor sama dengan profil fiktif',confirmed:true}})).status,400);
  await assert.rejects(f.recovery.deliver(u.username),e=>e.status===403);
  for(const decision of ['pending','reject','pending']){assert.equal((await f.recoveryReview(r,{decision,evidence:undefined})).status,200);r=(await f.rows())[0];assert.equal(r.state,decision==='reject'?'rejected':'pending');}
  const options={requestId:randomUUID()};assert.equal((await f.recoveryReview(r,options)).status,200);assert.equal((await f.recoveryReview(r,options)).status,200);r=(await f.rows())[0];
  assert.equal((await f.recoveryReview(r,{decision:'revoke',evidence:undefined})).status,200);await assert.rejects(f.recovery.deliver(u.username),e=>e.status===403);
  const owner=await f.enroll();await f.root.collection('msaAccounts').doc(owner.uid).update({origin:'a2-2',roles:[{role:'superadmin',status:'active',scope:{organizationId:null}}]});
  assert.equal((await f.submit(owner)).status,202);assert.equal((await f.rows()).some(r=>r.uid===owner.uid),false);
  const self=await f.register();await f.review(self,{scope:primary});await f.root.collection('msaAccounts').doc(self.uid).update({roles:[{role:'superadmin',status:'active',scope:{organizationId:null}}]});
  await f.root.collection('msaAccounts').doc(u.uid).update({roles:[{role:'superadmin',status:'active',scope:{organizationId:null}}]});
  const actor={kind:'msa',uid:u.uid,revision:3,check:async()=>true};await assert.rejects(f.recovery.review(actor,r.id,{expectedRevision:r.revision,expectedAccountRevision:3,requestId:randomUUID(),reason:'Tinjauan diri sendiri fiktif',decision:'approve',confirmed:true,evidence}),e=>e.status===403);
});

test('A2.4B explicit recovery delegation uses live PIC revision and exact scope, independent of identity delegation',async t=>{
  const f=await recoveryFixture(t),u=await f.account(),email='recovery-pic-'+randomUUID()+'@example.invalid',pw=password();
  const created=await f.request('/api/admin/accounts',{email,password:pw,actions:['pairing:read'],grants:[primary]}),{uid}=await created.json();assert.equal(created.status,201);f.created.push(uid);
  const token=await f.adminAuthentication.signIn({email,password:pw});
  await f.request('/api/a2-2/accounts/'+u.uid+'/delegate',{expectedRevision:3,requestId:randomUUID(),reason:'Delegasi identitas fiktif bukan izin recovery',reviewerUid:uid,scope:primary});
  await f.submit(u);let r=(await f.rows())[0];assert.equal((await f.recoveryReview(r,{},token)).status,403);
  assert.equal((await f.recoveryReview(r,{decision:'delegate',reviewerUid:uid,evidence:undefined})).status,200);r=(await f.rows())[0];
  assert.equal((await f.request('/api/a2-4b/queue',undefined,token)).status,200);assert.equal((await f.recoveryReview(r,{},token)).status,200);
  await f.request('/api/admin/accounts/'+uid,{state:'active',expectedRevision:1,actions:['pairing:read'],grants:[backup]});
  const fresh=await f.adminAuthentication.signIn({email,password:pw});r=(await f.rows())[0];assert.equal((await f.recoveryReview(r,{decision:'revoke',evidence:undefined},fresh)).status,403);
});

test('A2.4B reset preserves UID/username/link/roles/history, closes sessions/devices/backup and requires new activation',async t=>{
  const f=await recoveryFixture(t),u=await f.account(),s=await f.login(u),d=await f.activate();assert.equal((await f.associate(d,s.token)).status,200);
  await f.request('/api/admin/backup-assignments',{deviceId:d.deviceId,grants:[backup],reason:'Backup fiktif sebelum pemulihan',idempotencyKey:randomUUID()});
  const body={expectedRevision:0,idempotencyKey:randomUUID(),records:[{studentId:'fictional-1',status:'present'}]};assert.equal((await f.call(d,f.target(),'PUT',body,s.token)).status,200);
  const history=JSON.stringify((await f.root.collection('attendanceHistory').get()).docs.map(d=>d.data())),sessions=JSON.stringify((await f.root.collection('sessions').get()).docs.map(d=>d.data())),before=(await f.root.collection('msaAccounts').doc(u.uid).get()).data();
  await f.approved(u);const delivery=await f.recovery.deliver(u.username),newPassword=password();
  await assert.rejects(f.recovery.deliver(u.username),e=>e.status===409);
  const queue=JSON.stringify(await f.rows());for(const secret of [delivery.secret,'challengeHash','providerAlias'])assert.ok(!queue.includes(secret));
  const result=await f.reset({...delivery,password:newPassword});assert.equal(result.status,200,await result.text());
  assert.equal((await f.reset({...delivery,password:newPassword})).status,403);assert.equal((await f.login(u)).response.status,401);
  const fresh=await f.login({...u,password:newPassword});assert.equal(fresh.response.status,200);assert.equal((await f.signIn({...u,password:newPassword})).uid,u.uid);assert.equal((await f.auth.getUser(u.uid)).uid,u.uid);
  for(const token of [s.token,fresh.token,undefined]){assert.equal((await f.call(d,'/api/device/status','GET',undefined,token)).status,401);assert.equal((await f.call(d,f.target(backup),'GET',undefined,token)).status,401);assert.equal((await f.call(d,f.target(),'PUT',body,token)).status,401);}
  assert.equal((await f.personalRequest('/api/a2-3/context',undefined,s.token)).status,401);assert.equal((await f.associate(d,fresh.token)).status,403);
  const other=await f.activate();assert.equal((await f.associate(other,fresh.token)).status,200);
  const after=(await f.root.collection('msaAccounts').doc(u.uid).get()).data();for(const field of ['uid','username','mentorLink','roles','state','identity'])assert.deepEqual(after[field],before[field]);assert.equal(after.revision,4);assert.equal(after.securityEpoch,1);assert.equal(after.recoveryLock,null);
  assert.equal(JSON.stringify((await f.root.collection('attendanceHistory').get()).docs.map(d=>d.data())),history);assert.equal(JSON.stringify((await f.root.collection('sessions').get()).docs.map(d=>d.data())),sessions);
  const stored=JSON.stringify((await f.root.collection('msaRecoveryRequests').get()).docs.map(d=>d.data()));assert.ok(!stored.includes(newPassword)&&!stored.includes(delivery.secret));
});

test('A2.4B expiry, revision/revocation, concurrent requests and competing resets fail closed',async t=>{
  const f=await recoveryFixture(t),u=await f.account();await Promise.all([f.submit(u),f.submit(u)]);assert.equal((await f.rows()).length,1);
  await f.recoveryReview((await f.rows())[0]);const delivery=await f.recovery.deliver(u.username);
  await f.root.collection('msaRecoveryRequests').doc(delivery.id).update({expiresAt:Date.now()-1});assert.equal((await f.reset({...delivery,password:password()})).status,403);
  await f.root.collection('msaRecoveryRequests').doc(delivery.id).update({expiresAt:Date.now()+600000});
  const resets=await Promise.all([f.reset({...delivery,password:password()}),f.reset({...delivery,password:password()})]);assert.equal(resets.filter(r=>r.status===200).length,1);assert.ok(resets.some(r=>[403,409].includes(r.status)));
  assert.equal((await f.root.collection('msaRecoveryEvents').where('operation','==','reset-completed').get()).size,1);
  const second=await f.register();await f.review(second,{scope:primary});await f.approved(second);const revoked=await f.recovery.deliver(second.username);let r=(await f.rows()).find(r=>r.uid===second.uid);assert.equal((await f.recoveryReview(r,{decision:'revoke',evidence:undefined})).status,200);assert.equal((await f.reset({...revoked,password:password()})).status,403);
});

test('A2.4B partial provider/database failure retains durable denial and same-operation retry reconciles idempotently',async t=>{
  const f=await recoveryFixture(t),u=await f.account(),s=await f.login(u);await f.approved(u);const delivery=await f.recovery.deliver(u.username),pw=password();
  let failProvider=true,failDatabase=true;
  const auth={getUser:uid=>f.auth.getUser(uid),updateUser:async(...args)=>{if(failProvider){failProvider=false;throw Error('fictional provider failure before write');}return f.auth.updateUser(...args);},revokeRefreshTokens:async uid=>{await f.auth.revokeRefreshTokens(uid);if(failDatabase){failDatabase=false;throw Error('fictional lost provider acknowledgement');}}};
  const recovery=createMsaRecovery({...f,auth,registration:f.adminAuthentication.a1.registration,assertEnabled:()=>{}});
  const value={...delivery,password:pw};await assert.rejects(recovery.reset(value),e=>e.status===503);assert.equal((await f.login(u)).response.status,401);assert.equal((await f.personalRequest('/api/a2-3/context',undefined,s.token)).status,401);
  const requestRef=f.root.collection('msaRecoveryRequests').doc(delivery.id),worker=(await requestRef.get()).data().worker;
  await requestRef.update({worker:'fictional-different-process'});await assert.rejects(recovery.reset(value),e=>e.status===403);await requestRef.update({worker});
  await assert.rejects(recovery.reset(value),e=>e.status===503);assert.equal((await f.login({...u,password:pw})).response.status,401);
  let injected=false;const db={runTransaction:fn=>f.db.runTransaction(async tx=>{const proxy=new Proxy(tx,{get(target,key){if(key==='update')return(ref,patch)=>{if(!injected&&patch.state==='completed'){injected=true;throw Error('fictional Firestore finalization failure');}return target.update(ref,patch);};const v=target[key];return typeof v==='function'?v.bind(target):v;}});return fn(proxy);})};
  const interrupted=createMsaRecovery({...f,db,auth,registration:f.adminAuthentication.a1.registration,assertEnabled:()=>{}});
  await assert.rejects(interrupted.reset(value),e=>e.status===503);assert.equal((await f.login({...u,password:pw})).response.status,401);
  assert.equal((await recovery.reset(value)).reset,true);assert.equal((await f.login({...u,password:pw})).response.status,200);
  await assert.rejects(recovery.reset(value),e=>e.status===403);assert.equal((await f.root.collection('msaRecoveryEvents').where('operation','==','reset-prepared').get()).size,1);assert.equal((await f.root.collection('msaRecoveryEvents').where('operation','==','reset-completed').get()).size,1);
});

test('A2.4B reset versus suspension/revoke/attendance races cannot restore privileges or write partial history',async t=>{
  const f=await recoveryFixture(t),u=await f.account(),s=await f.login(u),d=await f.activate();await f.associate(d,s.token);await f.approved(u);const delivery=await f.recovery.deliver(u.username);
  let enter,release;const reached=new Promise(r=>enter=r),hold=new Promise(r=>release=r);
  const auth={getUser:uid=>f.auth.getUser(uid),updateUser:async(...args)=>{enter();await hold;return f.auth.updateUser(...args);},revokeRefreshTokens:uid=>f.auth.revokeRefreshTokens(uid)};
  const recovery=createMsaRecovery({...f,auth,registration:f.adminAuthentication.a1.registration,assertEnabled:()=>{}}),pw=password(),resetting=recovery.reset({...delivery,password:pw}).catch(e=>e);await reached;
  assert.equal((await f.login(u)).response.status,401);assert.equal((await change(f,u,'suspended',4)).status,200);
  assert.equal((await f.request('/api/a2-4/accounts/'+u.uid+'/devices/'+d.deviceId+'/revoke',{expectedRevision:1,expectedAccountRevision:5,requestId:randomUUID(),reason:'Pencabutan perangkat saat pemulihan fiktif',confirmed:true})).status,200);
  const body={expectedRevision:0,idempotencyKey:randomUUID(),records:[{studentId:'fictional-1',status:'present'}]};assert.equal((await f.call(d,f.target(),'PUT',body,s.token)).status,401);
  release();assert.equal((await resetting).status,503);const a=(await f.root.collection('msaAccounts').doc(u.uid).get()).data();assert.equal(a.state,'suspended');assert.equal(a.recoveryLock,delivery.id);assert.equal((await f.login({...u,password:pw})).response.status,401);assert.equal((await change(f,u,'active',5)).status,403);
  assert.equal((await f.root.collection('attendanceHistory').get()).size,0);
  assert.equal((await f.root.collection('msaDeviceAssociations').doc(d.deviceId).get()).data().state,'revoked');
  // The attendance transaction must re-read the account after reset preparation.
  const other=await f.register();await f.review(other,{scope:backup});await f.link(other,{scope:backup,mentorId:'fictional-substitute'});const os=await f.login(other),od=await f.activate(backup);await f.associate(od,os.token);await f.approved(other);const next=await f.recovery.deliver(other.username);
  const personal=await f.adminAuthentication.a1.mentor.resolve('Bearer '+os.token),raw=f.signed(od,f.target(backup),'PUT',{},os.token),proof=await f.pairing.verifyRequest('Bearer '+od.credential,{method:'PUT',target:f.target(backup),body:'{}',timestamp:raw.headers['X-Device-Timestamp'],nonce:raw.headers['X-Device-Nonce'],signature:raw.headers['X-Device-Signature']});
  let reachedWrite,continueWrite;const started=new Promise(r=>reachedWrite=r),wait=new Promise(r=>continueWrite=r),attendance=createEmulatorAttendance({...f,now:Date.now,credentials:{authenticate:async(...args)=>{reachedWrite();await wait;return f.credentials.authenticate(...args);}}});
  const writing=attendance.executeAuthorized({authorization:'Bearer '+od.credential,proof,scope:backup,action:'save',body:{...body,records:[{studentId:'fictional-backup-student',status:'present'}]},personal}).catch(e=>e);await started;assert.equal((await f.reset({...next,password:password()})).status,200);continueWrite();assert.equal((await writing).status,401);assert.equal((await f.root.collection('attendanceHistory').get()).size,0);
});

test('A2.4B approval revision drift and challenge revocation during an in-flight provider write never unlock the account',async t=>{
  const f=await recoveryFixture(t),u=await f.account();await f.approved(u);const delivery=await f.recovery.deliver(u.username);
  await f.root.collection('msaAccounts').doc(u.uid).update({revision:4});assert.equal((await f.reset({...delivery,password:password()})).status,403);
  let r=(await f.rows())[0];assert.equal((await f.recoveryReview(r)).status,200);const fresh=await f.recovery.deliver(u.username);assert.equal((await f.reset({...delivery,password:password()})).status,403);
  let enter,release;const started=new Promise(r=>enter=r),hold=new Promise(r=>release=r),pw=password();
  const auth={getUser:uid=>f.auth.getUser(uid),updateUser:async(...args)=>{enter();await hold;return f.auth.updateUser(...args);},revokeRefreshTokens:uid=>f.auth.revokeRefreshTokens(uid)},recovery=createMsaRecovery({...f,auth,registration:f.adminAuthentication.a1.registration,assertEnabled:()=>{}});
  const writing=recovery.reset({...fresh,password:pw}).catch(e=>e);await started;r=(await f.rows())[0];assert.equal(r.state,'resetting');assert.equal((await f.recoveryReview(r,{decision:'revoke',evidence:undefined})).status,200);release();assert.equal((await writing).status,503);
  assert.equal((await f.login({...u,password:pw})).response.status,401);assert.equal((await f.root.collection('msaAccounts').doc(u.uid).get()).data().recoveryLock,fresh.id);assert.equal((await f.root.collection('msaRecoveryRequests').doc(fresh.id).get()).data().state,'revoked');
});
