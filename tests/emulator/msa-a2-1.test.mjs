import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pilotFixture} from './msa-a2-1-fixture.mjs';
import {hagai} from './device-management-source.mjs';
import {createLocalAdminAuthentication} from '../../backend/admin-auth.mjs';
import {createAdminServer} from '../../admin-server.mjs';
import {once} from 'node:events';

const snapshot=async f=>{
  const result={};for(const name of ['adminSecurity','adminAccounts','adminPairingPermissions','authorizationEvents','schools','groups','mentors','students','studentPrivateProfiles','serviceSessions','sessions','defaultMentorAssignments','mentorAssignmentSnapshots','backupAssignments'])result[name]=(await f.root.collection(name).get()).docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.id.localeCompare(b.id));return result;
};

test('A2.1 trusted self binding preserves owner/PIC UID, passwords, exact permissions and all ministry data; broker grants no new role',async t=>{
  const f=await pilotFixture(t),before=await snapshot(f),ownerBefore=await f.auth.getUser(f.uid),picBefore=await f.auth.getUser(f.pic.uid);
  assert.deepEqual(await f.pilot.inspect({header:'Bearer '+f.token,username:' MOMOR1N '}),{canonical:'momor1n',available:true});
  await assert.rejects(f.pilot.claim(f.binding(f.uid,f.token,'wrong-password','momor1n')),e=>e.status===401);
  assert.equal((await f.root.collection('msaUsernames').get()).size,0);
  await assert.rejects(f.pilot.claim({...f.binding(f.uid,f.token,f.password,'momor1n'),confirmed:false}),e=>e.status===403);
  await assert.rejects(f.pilot.claim(f.binding(f.pic.uid,f.token,f.password,'momor1n')),e=>e.status===403);
  const result=await f.pilot.claim(f.binding(f.uid,f.token,f.password,'momor1n'));assert.equal(result.uid,f.uid);
  const repeated=await f.pilot.claim(f.binding(f.uid,f.token,f.password,'MOMOR1N'));assert.equal(repeated.alreadyBound,true);
  assert.equal((await f.root.collection('msaAuthorizationEvents').get()).size,1);
  await assert.rejects(f.pilot.claim(f.binding(f.uid,f.token,f.password,'renamed-owner')),e=>e.status===409);
  await assert.rejects(f.pilot.claim(f.binding(f.pic.uid,f.pic.token,f.pic.password,'momor1n')),e=>e.status===409);
  await f.pilot.claim(f.binding(f.pic.uid,f.pic.token,f.pic.password,'pilot.pic'));
  assert.deepEqual(await snapshot(f),before);assert.equal((await f.root.collection('msaAccounts').get()).size,0);
  for(const [uid,previous] of [[f.uid,ownerBefore],[f.pic.uid,picBefore]]){const user=await f.auth.getUser(uid);for(const key of ['uid','email','disabled','passwordHash','passwordSalt','customClaims'])assert.deepEqual(user[key],previous[key]);}
  const owner=await f.signIn({username:'Momor1n',password:f.password}),pic=await f.signIn({username:'pilot.pic',password:f.pic.password});assert.equal(owner.response.status,200);assert.equal(pic.response.status,200);assert.equal(owner.uid,f.uid);assert.equal(pic.uid,f.pic.uid);
  assert.equal((await f.request('/api/admin/session',undefined,owner.token)).status,200);
  const policy=await (await f.request('/api/admin/session',undefined,pic.token)).json();assert.equal(policy.uid,f.pic.uid);assert.equal(policy.role,'pic');
  const context=await (await f.request('/api/admin/pairing-context',undefined,pic.token)).json();assert.equal(context.contexts.length,1);assert.equal(context.contexts[0].groupId,hagai.groupId);
  assert.equal((await f.request('/api/a1/accounts',undefined,pic.token)).status,403);
  assert.equal((await f.request('/api/admin/accounts',{},pic.token)).status,403);
  assert.equal((await f.request('/api/admin/pairing-codes',{idempotencyKey:randomUUID(),grants:[hagai]},pic.token)).status,403);
  const body=JSON.stringify(await (await f.request('/api/admin/session',undefined,owner.token)).json());assert.equal(body.includes(f.email),false);assert.equal(body.includes('@'),false);
  for(const route of ['/api/a1/claim','/api/a1/legacy-username','/api/a1/bind'])assert.equal((await f.request(route,f.binding(f.uid,f.token,f.password,'evil'))).status,404);
  assert.equal((await f.request('/api/admin/accounts/'+f.uid,{expectedRevision:1,state:'disabled'},owner.token)).status,403);
  await f.request('/api/admin/logout',{},pic.token);assert.equal((await f.request('/api/admin/session',undefined,pic.token)).status,401);
  assert.equal((await f.request('/api/admin/session',undefined,f.pic.token)).status,200);
  // Revocation remains governed by the original PIC account revision.
  const fresh=await f.signIn({username:'pilot.pic',password:f.pic.password});assert.equal(fresh.response.status,200);
  const disabled=await f.request('/api/admin/accounts/'+f.pic.uid,{expectedRevision:1,state:'disabled'});assert.equal(disabled.status,200);
  assert.equal((await f.request('/api/admin/session',undefined,fresh.token)).status,401);assert.equal((await f.signIn({username:'pilot.pic',password:f.pic.password})).response.status,401);
});

test('A2.1 concurrent claims, untrusted sessions, personal A1 tokens, live binding revocation and flags fail closed',async t=>{
  const f=await pilotFixture(t);
  await assert.rejects(f.pilot.claim(f.binding(f.uid,'invented',f.password,'momor1n')),e=>e.status===403);
  const results=await Promise.allSettled([f.pilot.claim(f.binding(f.uid,f.token,f.password,'Race.Pilot')),f.pilot.claim(f.binding(f.pic.uid,f.pic.token,f.pic.password,'race.pilot'))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const winner=results.find(r=>r.status==='fulfilled').value,credentials=winner.uid===f.uid?{username:'race.pilot',password:f.password}:{username:'race.pilot',password:f.pic.password};
  const session=await f.signIn(credentials);assert.equal(session.response.status,200);
  await f.root.collection('msaLegacyUsernameLinks').doc(winner.uid).update({state:'revoked',revision:2});assert.equal((await f.request('/api/admin/session',undefined,session.token)).status,401);
  const personal=await f.enroll({username:'unprivileged.pilot'}),login=await f.signIn(personal);assert.equal(login.response.status,200);
  assert.equal((await f.request('/api/admin/session',undefined,login.token)).status,401); // username itself is never authority
  await assert.rejects(f.pilot.claim(f.binding(personal.uid,login.token,personal.password,'new-name')),e=>e.status===403);
  delete process.env.ABC_MSA_USERNAME_PILOT;
  await assert.rejects(f.pilot.inspect({header:'Bearer '+f.token,username:'momor1n'}),e=>e.status===503);
  const disabled=await createLocalAdminAuthentication(),server=createAdminServer({adminAuthentication:disabled});server.listen(0,'127.0.0.1');await once(server,'listening');
  try{assert.equal(disabled.a1.legacyPilot,undefined);assert.equal((await fetch('http://127.0.0.1:'+server.address().port+'/username.html')).status,404);}finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});await disabled.close();}
  process.env.ABC_MSA_USERNAME_PILOT='1';const previous=process.env.ABC_FIRESTORE_NAMESPACE;process.env.ABC_FIRESTORE_NAMESPACE='development';
  const ordinary=await createLocalAdminAuthentication();try{assert.equal(ordinary.a1.legacyPilot,undefined);}finally{await ordinary.close();process.env.ABC_FIRESTORE_NAMESPACE=previous;}
});
