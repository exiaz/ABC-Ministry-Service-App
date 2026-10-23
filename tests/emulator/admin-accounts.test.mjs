import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,generateKeyPairSync,sign} from 'node:crypto';
import {proofMessage} from '../../backend/device-proof.mjs';
import {emulatorFixture} from './fixture.mjs';
import {adminLoginFixture} from './admin-login-fixture.mjs';
import {deviceManagementSource,hagai} from './device-management-source.mjs';
import {initializeOwner,createAdminAccounts} from '../../backend/admin-accounts.mjs';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {createLocalAdminAuthentication} from '../../backend/admin-auth.mjs';

async function fixture(t){
  const original=process.env.ABC_FIRESTORE_NAMESPACE,{source,grants}=deviceManagementSource(),c=await emulatorFixture({source});
  process.env.ABC_FIRESTORE_NAMESPACE=c.config.namespace;
  const f=await adminLoginFixture(t,{pairing:c.pairing});
  await c.root.collection('adminPairingPermissions').doc(f.uid).set({active:true,grants});
  t.after(async()=>{const cleanup=initializeApp({projectId:'demo-abc-attendance'},'cleanup-'+randomUUID());try{const pics=await c.root.collection('adminAccounts').where('role','==','pic').get();if(pics.size)await getAuth(cleanup).deleteUsers(pics.docs.map(d=>d.id));}finally{await deleteApp(cleanup);await c.close();if(original===undefined)delete process.env.ABC_FIRESTORE_NAMESPACE;else process.env.ABC_FIRESTORE_NAMESPACE=original;}});
  const initialize=confirmed=>initializeOwner({...c,auth:f.auth,uid:f.uid,email:f.email,confirmed});
  const login=async(email=f.email,password=f.password)=>{
    const response=await fetch(f.base+'/api/admin/login',{method:'POST',headers:{Origin:f.base,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    return {status:response.status,...(response.ok?await response.json():{})};
  };
  const request=(token,path,body)=>fetch(f.base+path,{method:body===undefined?'GET':'POST',headers:{Origin:f.base,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {...c,...f,grants,initialize,login,request};
}

test('Explicit owner migration reuses UID/password/permissions; PIC roles enforce action/scope and independent revocation',async t=>{
  const f=await fixture(t),before=(await f.root.collection('adminPairingPermissions').doc(f.uid).get()).data();
  const preserved=async()=>Object.fromEntries(await Promise.all(['students','serviceSessions','sessions','mentorAssignmentSnapshots','defaultMentorAssignments'].map(async name=>[name,(await f.root.collection(name).get()).docs.map(d=>({id:d.id,data:d.data()}))])));
  const historyBefore=await preserved();
  await assert.rejects(f.initialize(false));assert.equal(await f.initialize(true),true);assert.equal(await f.initialize(true),false);
  assert.deepEqual((await f.root.collection('adminPairingPermissions').doc(f.uid).get()).data(),before);
  assert.equal((await f.root.collection('adminAccounts').where('role','==','superadmin').get()).size,1);
  await assert.rejects(initializeOwner({...f,uid:f.uid,email:'different@example.invalid',confirmed:true}));
  const owner=await f.login();assert.equal(owner.status,200);
  assert.equal((await (await f.request(owner.token,'/api/admin/session')).json()).role,'superadmin');
  const password=randomBytes(24).toString('base64url'),email='pic-'+randomUUID()+'@abc-attendance.test';
  const body={email,password,actions:['pairing:read','pairing:issue'],grants:[hagai]};
  assert.equal((await f.request(owner.token,'/api/admin/accounts',{...body,role:'superadmin'})).status,400);
  const created=await f.request(owner.token,'/api/admin/accounts',body);assert.equal(created.status,201);const {uid}=await created.json();
  const pic=await f.login(email,password);assert.equal(pic.status,200);
  assert.equal((await f.request(pic.token,'/api/admin/accounts')).status,403);
  assert.equal((await f.request(pic.token,'/api/admin/accounts',body)).status,403);
  assert.equal((await f.request(pic.token,'/api/admin/accounts/'+f.uid,{})).status,403);
  const context=await f.request(pic.token,'/api/admin/pairing-context');assert.equal(context.status,200);assert.equal((await context.json()).contexts.length,1);
  const issue=await f.request(pic.token,'/api/admin/pairing-codes',{grants:[hagai]});assert.equal(issue.status,201);const code=await issue.json();
  const other=f.grants.find(s=>s.groupId!==hagai.groupId||s.serviceSessionId!==hagai.serviceSessionId);
  assert.equal((await f.request(pic.token,'/api/admin/pairing-codes',{grants:[other]})).status,403);
  assert.equal((await f.request(pic.token,'/api/admin/pairing-codes/'+code.pairingId+'/revoke',{})).status,403);
  const body2={...body,email:'pic-'+randomUUID()+'@abc-attendance.test'};
  assert.equal((await f.request(owner.token,'/api/admin/accounts',body2)).status,201);
  const pic2=await f.login(body2.email,password);assert.equal(pic2.status,200);
  const restarted=await createLocalAdminAuthentication();
  try{const token=await restarted.signIn({email:body2.email,password});assert.equal((await restarted.authorize('Bearer '+token)).role,'pic');}finally{await restarted.close();}
  const update={expectedRevision:1,state:'disabled',actions:body.actions,grants:body.grants};
  assert.equal((await f.request(owner.token,'/api/admin/accounts/'+uid,update)).status,200);
  const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),publicKey=keys.publicKey.export({type:'spki',format:'der'}).toString('base64url');
  const raw=JSON.stringify({code:code.code,publicKey}),timestamp=String(Date.now()),nonce=randomBytes(16).toString('base64url');
  const proof={method:'POST',target:'/api/pairing/redeem',body:raw,timestamp,nonce,signature:sign('sha256',proofMessage({token:code.code,method:'POST',target:'/api/pairing/redeem',body:raw,timestamp,nonce}),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};
  await assert.rejects(f.pairing.redeem({code:code.code,publicKey},proof));
  assert.equal((await f.request(pic.token,'/api/admin/session')).status,401);assert.equal((await f.login(email,password)).status,401);
  assert.equal((await f.request(pic2.token,'/api/admin/session')).status,200);
  await assert.rejects(f.pairing.issue(uid,{grants:[hagai]}));
  assert.equal((await f.request(owner.token,'/api/admin/accounts/'+uid,update)).status,409);
  assert.equal((await f.request(owner.token,'/api/admin/accounts/'+uid,{...update,expectedRevision:2,state:'active',actions:['pairing:read']})).status,200);
  const again=await f.login(email,password);assert.equal(again.status,200);
  assert.equal((await f.request(again.token,'/api/admin/pairing-codes',{grants:[hagai]})).status,403);
  assert.equal((await f.request(owner.token,'/api/admin/accounts/'+uid,{...update,expectedRevision:3,state:'revoked'})).status,200);
  assert.equal((await f.request(again.token,'/api/admin/devices')).status,401);
  assert.equal((await f.request(owner.token,'/api/admin/accounts/'+f.uid,update)).status,403);
  const list=await f.request(owner.token,'/api/admin/accounts');assert.equal(list.status,200);const text=await list.text();assert.equal(text.includes(password),false);assert.equal(text.includes(code.code),false);
  assert.ok((await f.root.collection('authorizationEvents').where('event','==','pic-created').get()).size===2);
  await f.root.collection('adminPairingPermissions').doc(f.uid).update({active:false});
  const second=(await f.root.collection('adminAccounts').where('email','==',body2.email).get()).docs[0];
  assert.equal((await f.request(owner.token,'/api/admin/accounts/'+second.id,{...update,state:'disabled'})).status,200);
  assert.equal((await f.request(owner.token,'/api/admin/accounts/'+second.id,{...update,expectedRevision:2,state:'active'})).status,403);
  assert.deepEqual(await preserved(),historyBefore);
  const changes=(await f.root.collection('authorizationEvents').where('event','==','pic-disabled').get()).docs.map(d=>d.data());assert.ok(changes.every(e=>e.previous.revision+1===e.next.revision));
});

test('Failed Auth setup cannot leave a usable PIC, and scope escalation/invalid enrollment never commits an active account',async t=>{
  const f=await fixture(t);await f.initialize(true);
  const manager=createAdminAccounts({...f,auth:{createUser:async()=>{throw Error('Simulasi Auth gagal');}}});
  const body={email:'failure-'+randomUUID()+'@abc-attendance.test',password:randomBytes(24).toString('base64url'),actions:['pairing:read'],grants:[hagai]};
  await assert.rejects(manager.create(f.uid,body,async()=>true));
  const rows=await f.root.collection('adminAccounts').where('role','==','pic').get();assert.equal(rows.size,1);assert.equal(rows.docs[0].data().state,'setup-failed');
  assert.equal((await f.root.collection('adminPairingPermissions').doc(rows.docs[0].id).get()).data().active,false);
  await assert.rejects(manager.create(f.uid,{...body,actions:['accounts:manage']},async()=>true));
  await assert.rejects(manager.create(f.uid,{...body,grants:[{...hagai,schoolId:'s3'}]},async()=>true));
  let checks=0;await assert.rejects(manager.create(f.uid,{...body,email:'expired-'+randomUUID()+'@abc-attendance.test'},async()=>++checks===1));
  assert.equal((await f.root.collection('adminAccounts').where('role','==','pic').get()).size,1);
  const owner=await f.login();assert.equal(owner.status,200);
  await f.auth.revokeRefreshTokens(f.uid);await f.auth.updateUser(f.uid,{disabled:true});
  assert.equal((await f.request(owner.token,'/api/admin/accounts')).status,401);
  assert.equal((await f.request('forged','/api/admin/accounts')).status,401);
});
