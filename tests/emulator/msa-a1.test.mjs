import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {msaFixture} from './msa-a1-fixture.mjs';
import {createMsaAccounts} from '../../backend/msa-accounts.mjs';
import {createLocalAdminAuthentication} from '../../backend/admin-auth.mjs';
import {createAdminServer} from '../../admin-server.mjs';
import {once} from 'node:events';

test('A1 isolated username login, private registry, concurrent uniqueness and partial Auth setup fail closed',async t=>{
  const f=await msaFixture(t),user=await f.enroll({username:'Kak.Fiktif'});
  const login=await f.signIn({...user,username:' kak.FIKTIF '});assert.equal(login.response.status,200);assert.match(login.token,/^[A-Za-z0-9_-]{43}$/);
  assert.equal((await f.signIn({...user,username:'\u212Aak.Fiktif'})).response.status,401);
  const session=await f.request('/api/a1/session',undefined,login.token);assert.equal(session.status,200);const profile=await session.json();assert.equal(profile.uid,user.uid);assert.equal(profile.phoneState,'supplied');
  assert.equal(JSON.stringify(profile).includes('@msa.example.invalid'),false);
  assert.equal((await f.request('/api/admin/session',undefined,login.token)).status,401);
  assert.equal((await f.request('/api/a1/accounts',undefined,login.token)).status,403);
  assert.equal((await f.change(f.uid)).status,403);
  assert.equal((await f.request('/api/a1/register',{username:'anything'},'')).status,401);
  const bad=await f.signIn({...user,password:'wrong-password'}),missing=await f.signIn({...user,username:'missing-account'});assert.equal(bad.response.status,401);assert.equal(bad.error,missing.error);
  const invalidNamed=await f.enroll({username:'invalid'});assert.equal((await f.signIn({...invalidNamed,username:'***'})).response.status,401);
  const username='race-'+randomUUID().slice(0,8),value={...user.value,username,requestId:randomUUID()};
  const results=await Promise.allSettled([f.adminAuthentication.a1.accounts.provisionFixture(value),f.adminAuthentication.a1.accounts.provisionFixture({...value,username:username.toUpperCase(),requestId:randomUUID()})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);f.created.push(results.find(r=>r.status==='fulfilled').value.uid);
  const repeat=await f.adminAuthentication.a1.accounts.provisionFixture(user.value);assert.equal(repeat.uid,user.uid);
  const failing=createMsaAccounts({...f,assertLocal:()=>{},auth:{createUser:async()=>{throw Error('Gagal fiktif');}}}),failedValue={...value,username:'failed-'+randomUUID().slice(0,8),requestId:randomUUID()};
  await assert.rejects(failing.provisionFixture(failedValue));
  const claim=(await f.root.collection('msaUsernames').doc(failedValue.username).get()).data(),failed=(await f.root.collection('msaAccounts').doc(claim.uid).get()).data();assert.equal(failed.provisioning,'failed');assert.equal(claim.state,'reserved');
  const retry=await failing.provisionFixture(failedValue);assert.equal(retry.uid,claim.uid);assert.equal(retry.provisioning,'failed');
  assert.equal((await f.signIn({username:failedValue.username,password:failedValue.password})).response.status,401);
  const raw=await f.auth.getUser(user.uid),provider=await fetch('http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-emulator',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:raw.email,password:user.password,returnSecureToken:true})}),{idToken}=await provider.json();
  const firestore='http://'+process.env.FIRESTORE_EMULATOR_HOST+'/v1/projects/demo-abc-attendance/databases/(default)/documents/'+f.root.path+'/msaAccounts/'+user.uid;
  assert.equal((await fetch(firestore,{headers:{Authorization:'Bearer '+idToken}})).status,403);
  assert.equal((await fetch(firestore,{method:'PATCH',headers:{Authorization:'Bearer '+idToken,'Content-Type':'application/json'},body:JSON.stringify({fields:{state:{stringValue:'active'}}})})).status,403);
  assert.equal((await f.request('/api/a1/session',undefined,idToken)).status,401);
  const other=await f.enroll(),otherProvider=await f.auth.getUser(other.uid),accountRef=f.root.collection('msaAccounts').doc(user.uid);
  await accountRef.update({providerAlias:otherProvider.email});
  assert.equal((await f.signIn({...user,password:other.password})).response.status,401);
  await accountRef.update({providerAlias:raw.email});
  await f.auth.updateUser(user.uid,{disabled:true});assert.equal((await f.request('/api/a1/session',undefined,login.token)).status,401);await f.auth.updateUser(user.uid,{disabled:false});
  const serial=JSON.stringify((await f.root.collection('msaAccounts').get()).docs.map(d=>d.data()));assert.equal(serial.includes(user.password),false);
  await f.request('/api/a1/logout',{},login.token);assert.equal((await f.request('/api/a1/session',undefined,login.token)).status,401);
});

test('A1 Superadmin scoped multi-role changes, idempotency, stale sessions, eligibility, audit and HTTP escalation denial',async t=>{
  const f=await msaFixture(t),user=await f.enroll(),other=await f.enroll(),initial=await f.signIn(user);
  const requestId=randomUUID(),value={expectedRevision:1,requestId,reason:'Pengujian hak PIC berscope',role:'pic',scope:{organizationId:'org-a',programId:'program-org-a'},status:'active'};
  const promotion=await Promise.all([f.request('/api/a1/accounts/'+user.uid+'/change',value),f.request('/api/a1/accounts/'+user.uid+'/change',value)]);assert.deepEqual(promotion.map(r=>r.status),[200,200]);
  assert.equal((await f.root.collection('msaAccounts').doc(user.uid).get()).data().roles.length,1);
  assert.equal((await f.request('/api/a1/session',undefined,initial.token)).status,401);
  let pic=await f.signIn(user);assert.equal(pic.response.status,200);
  assert.equal((await f.request('/api/a1/access',{role:'pic',scope:{organizationId:'org-a',programId:'program-org-a',eventId:'event-org-a'}},pic.token)).status,200);
  for(const scope of [{organizationId:'org-b'},{organizationId:'org-a'},{organizationId:'org-a',programId:'program-org-b'}])assert.equal((await f.request('/api/a1/access',{role:'pic',scope},pic.token)).status,403);
  assert.equal((await f.change(user.uid,{expectedRevision:2,role:'superadmin',scope:{organizationId:null}},pic.token)).status,403);
  assert.equal((await f.change(other.uid,{role:'admin'},pic.token)).status,403);
  assert.equal((await f.request('/api/a1/audit',undefined,pic.token)).status,403);
  assert.equal((await f.change(user.uid,{expectedRevision:2,role:'admin',scope:{organizationId:'org-b'}})).status,200);
  assert.equal((await f.request('/api/a1/access',{role:'pic',scope:{organizationId:'org-a',programId:'program-org-a'}},pic.token)).status,401);
  const admin=await f.signIn(user);assert.equal((await f.change(other.uid,{role:'superadmin',scope:{organizationId:null}},admin.token)).status,403);
  assert.equal((await f.request('/api/a1/access',{role:'admin',scope:{organizationId:'org-a'}},admin.token)).status,403);
  assert.equal((await f.request('/api/a1/access',{role:'admin',scope:{organizationId:'org-b'}},admin.token)).status,200);
  assert.equal((await f.change(user.uid,{expectedRevision:3,role:'pic',scope:{organizationId:'org-a',programId:'program-org-a'},status:'revoked'})).status,200);
  pic=await f.signIn(user);assert.equal((await f.request('/api/a1/access',{role:'pic',scope:{organizationId:'org-a',programId:'program-org-a'}},pic.token)).status,403);
  assert.equal((await f.request('/api/a1/access',{role:'admin',scope:{organizationId:'org-b'}},pic.token)).status,200);
  for(const options of [{state:'suspended'},{state:'disabled'},{verified:false},{state:'pending'},{eligibleRoles:[]}]){
    const denied=await f.enroll(options);assert.equal((await f.change(denied.uid)).status,403);
  }
  assert.equal((await f.change('missing-account')).status,403);
  const providerDisabled=await f.enroll();await f.auth.updateUser(providerDisabled.uid,{disabled:true});assert.equal((await f.change(providerDisabled.uid)).status,403);
  assert.equal((await f.change(other.uid,{scope:{organizationId:'org-a',eventId:'event-org-b'}})).status,403);
  const stateChange={expectedRevision:4,requestId:randomUUID(),reason:'Penangguhan akun fiktif',state:'suspended'};
  assert.equal((await f.request('/api/a1/accounts/'+user.uid+'/change',stateChange)).status,200);
  assert.equal((await f.request('/api/a1/session',undefined,pic.token)).status,401);assert.equal((await f.signIn(user)).response.status,401);
  assert.equal((await f.request('/api/a1/accounts/'+user.uid+'/change',{...stateChange,expectedRevision:5,requestId:randomUUID(),state:'active'})).status,200);
  assert.equal((await f.request('/api/a1/session',undefined,pic.token)).status,401);
  const list=await f.request('/api/a1/accounts?search='+encodeURIComponent(other.username));assert.equal((await list.json()).accounts.length,1);
  const audit=await f.request('/api/a1/audit'),events=(await audit.json()).events;assert.equal(events.length,5);assert.ok(events.every(e=>e.actorUid===f.uid&&e.previous.revision+1===e.next.revision&&e.reason&&e.at));
  assert.equal((await f.request('/api/a1/accounts',undefined,f.token,{Origin:'https://evil.example'})).status,403);
  assert.equal((await f.request('/api/a1/accounts/'+other.uid+'/change',value,'forged')).status,401);
});

test('A1 last Superadmin, self mutation, concurrent removal, rate limit persistence and disabled flag',async t=>{
  const f=await msaFixture(t),first=await f.enroll(),second=await f.enroll();
  assert.equal((await f.change(first.uid,{role:'superadmin',scope:{organizationId:null}})).status,200);
  const sa=await f.signIn(first);
  assert.equal((await f.change(first.uid,{expectedRevision:2,role:'superadmin',scope:{organizationId:null},status:'revoked'},sa.token)).status,403);
  assert.equal((await f.change(first.uid,{expectedRevision:2,role:'superadmin',scope:{organizationId:null},status:'revoked'})).status,409);
  assert.equal((await f.change(second.uid,{role:'superadmin',scope:{organizationId:null}},sa.token)).status,200);
  await f.auth.updateUser(second.uid,{disabled:true});assert.equal((await f.change(first.uid,{expectedRevision:2,role:'superadmin',scope:{organizationId:null},status:'revoked'})).status,409);await f.auth.updateUser(second.uid,{disabled:false});
  const removals=await Promise.all([first,second].map(u=>f.change(u.uid,{expectedRevision:2,role:'superadmin',scope:{organizationId:null},status:'revoked'})));assert.deepEqual(removals.map(r=>r.status).sort(),[200,409]);
  for(let i=0;i<8;i++)assert.equal((await f.signIn({username:'guess-fictitious',password:'incorrect-password'})).response.status,401);
  assert.equal((await f.signIn({username:'guess-fictitious',password:'incorrect-password'})).response.status,429);
  const restarted=await createLocalAdminAuthentication();try{await assert.rejects(restarted.a1.login({username:'guess-fictitious',password:'incorrect-password'}),e=>e.status===429);}finally{await restarted.close();}
  delete process.env.ABC_MSA_A1;
  const disabled=await createLocalAdminAuthentication(),server=createAdminServer({adminAuthentication:disabled});server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    assert.equal(disabled.a1,undefined);const base='http://127.0.0.1:'+server.address().port;
    for(const path of ['/a1.html','/msa-users.js','/api/a1/login'])assert.equal((await fetch(base+path)).status,404);
  }finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});await disabled.close();}
  assert.equal((await f.request('/api/a1/accounts')).status,500); // live flag removal fails closed
});
