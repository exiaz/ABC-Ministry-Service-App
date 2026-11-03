import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,generateKeyPairSync,sign} from 'node:crypto';
import {once} from 'node:events';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {emulatorFixture} from './fixture.mjs';
import {hagai} from './device-management-source.mjs';
import {provisionDemo,provisioningConfig} from '../../provision-demo.mjs';
import {createLocalAdminAuthentication} from '../../backend/admin-auth.mjs';
import {createAdminServer} from '../../admin-server.mjs';
import {createRosterServer} from '../../backend/server.mjs';
import {proofMessage} from '../../backend/device-proof.mjs';

async function setup(t){
  provisioningConfig();const c=await emulatorFixture(),uid='demo-admin-test-'+randomUUID(),identity={uid,email:uid+'@abc-attendance.test'};
  const app=initializeApp({projectId:c.config.projectId},'demo-provision-test-'+randomUUID()),auth=getAuth(app),password=randomBytes(24).toString('base64url');
  const previous=process.env.ABC_ADMIN_UIDS;process.env.ABC_ADMIN_UIDS=JSON.stringify([uid]);
  t.after(async()=>{await auth.deleteUsers([uid]);await deleteApp(app);await c.close();if(previous===undefined)delete process.env.ABC_ADMIN_UIDS;else process.env.ABC_ADMIN_UIDS=previous;});
  const assertLocal=()=>provisioningConfig();
  return {...c,auth,identity,password,assertLocal,askPassword:async()=>password};
}
async function server(t,instance){instance.listen(0,'127.0.0.1');await once(instance,'listening');t.after(()=>new Promise(resolve=>{instance.close(resolve);instance.closeAllConnections();}));return 'http://127.0.0.1:'+instance.address().port;}

test('Provisioned demo is idempotent, admits the matching UID and pairs Hagai with Kak Louis through the existing APIs',async t=>{
  const c=await setup(t),created=await provisionDemo(c);assert.equal(created.accountCreated,true);assert.equal(created.recordsCreated,48);
  assert.equal((await c.root.collection('studentPrivateProfiles').get()).size,0);
  await c.root.collection('sessions').doc('existing-history').create({id:'existing-history',records:[],serviceSessionId:'another-session'});
  const again=await provisionDemo({...c,askPassword:()=>{throw Error('Password tidak boleh diminta ulang.');}});assert.equal(again.accountCreated,false);assert.equal(again.recordsCreated,0);assert.equal((await c.root.collection('sessions').doc('existing-history').get()).exists,true);
  const authentication=await createLocalAdminAuthentication();t.after(()=>authentication.close());
  const token=await authentication.signIn({email:c.identity.email,password:c.password}),base=await server(t,createAdminServer({adminAuthentication:authentication,pairing:c.pairing}));
  const admin=(target,body)=>fetch(base+target,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,Origin:base,'Content-Type':'application/json'},...(body?{body:JSON.stringify(target==='/api/admin/pairing-codes'?{idempotencyKey:randomUUID(),...body}:body)}:{})});
  const contexts=await admin('/api/admin/pairing-context');assert.equal(contexts.status,200);const metadata=(await contexts.json()).contexts;assert.equal(metadata.length,16);assert.equal(metadata.find(s=>s.groupId==='g13').mentorName,'Kak Louis');
  const issue=await admin('/api/admin/pairing-codes',{grants:[hagai]});assert.equal(issue.status,201);const {code}=await issue.json();
  const mentorBase=await server(t,createRosterServer(c)),keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),publicKey=keys.publicKey.export({type:'spki',format:'der'}).toString('base64url');
  const headers=(token,method,target,body='')=>{const timestamp=String(Date.now()),nonce=randomBytes(16).toString('base64url');return {'Content-Type':'application/json','X-Device-Timestamp':timestamp,'X-Device-Nonce':nonce,'X-Device-Signature':sign('sha256',proofMessage({method,target,body,token,timestamp,nonce}),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};};
  const target='/api/pairing/redeem',body=JSON.stringify({code,publicKey}),redeem=await fetch(mentorBase+target,{method:'POST',body,headers:headers(code,'POST',target,body)});assert.equal(redeem.status,201);
  const {credential}=await redeem.json(),rosterTarget='/api/roster?'+new URLSearchParams(hagai),roster=await fetch(mentorBase+rosterTarget,{headers:{...headers(credential,'GET',rosterTarget),Authorization:'Bearer '+credential}});assert.equal(roster.status,200);assert.deepEqual((await roster.json()).students,[{id:'fictional-hagai',name:'Siswa Hagai Fiktif',schoolClass:'4A'}]);
});
test('Provisioning refuses changed records, revoked permission and conflicting accounts without overwriting them',async t=>{
  const c=await setup(t);await provisionDemo(c);
  const permission=c.root.collection('adminPairingPermissions').doc(c.identity.uid);await permission.update({active:false});
  await assert.rejects(provisionDemo(c),/Record demo berbeda/);assert.equal((await permission.get()).data().active,false);
  const original=(await c.root.collection('schools').doc('s1').get()).data();await c.root.collection('schools').doc('s1').update({name:'Nama yang sudah disunting'});
  await assert.rejects(provisionDemo(c),/Record demo berbeda/);assert.equal((await c.root.collection('schools').doc('s1').get()).data().name,'Nama yang sudah disunting');
  await c.root.collection('schools').doc('s1').set(original);await permission.update({active:true});await c.auth.updateUser(c.identity.uid,{disabled:true});
  await assert.rejects(provisionDemo(c),/nonaktif/);assert.equal((await c.auth.getUser(c.identity.uid)).disabled,true);
});
test('Concurrent record changes abort the create-only transaction and configuration drift prevents account creation',async t=>{
  const c=await setup(t);
  await assert.rejects(provisionDemo({...c,assertLocal:()=>{throw Error('Konfigurasi berubah');}}),/Konfigurasi berubah/);await assert.rejects(c.auth.getUser(c.identity.uid),{code:'auth/user-not-found'});
  await assert.rejects(provisionDemo({...c,askPassword:async()=>{await c.root.collection('schools').doc('s1').create({id:'s1',name:'Jangan ditimpa'});return c.password;}}),/Record demo berbeda/);
  assert.equal((await c.root.collection('groups').get()).size,0);assert.equal((await c.root.collection('adminPairingPermissions').get()).size,0);assert.equal((await c.root.collection('schools').doc('s1').get()).data().name,'Jangan ditimpa');
});
