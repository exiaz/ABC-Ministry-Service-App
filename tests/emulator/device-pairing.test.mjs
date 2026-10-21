import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {fork} from 'node:child_process';
import {randomUUID,randomBytes,webcrypto} from 'node:crypto';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {emulatorFixture} from './fixture.mjs';
import {fictionalRosterData,scope} from '../fixtures/roster.mjs';
import {createLocalAdminAuthentication} from '../../backend/admin-auth.mjs';
import {createRosterServer} from '../../backend/server.mjs';
import {proofMessage,hash} from '../../backend/device-proof.mjs';
import {createFirestoreEmulatorRepositories} from '../../backend/firestore-emulator.mjs';

const roster='/api/roster?'+new URLSearchParams(scope);
async function device(){
  const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
  assert.equal(keys.privateKey.extractable,false);
  const publicKey=Buffer.from(await webcrypto.subtle.exportKey('spki',keys.publicKey)).toString('base64url');
  return {publicKey,async headers(token,method,target,body='',time=Date.now(),nonce=randomBytes(16).toString('base64url')){
    const timestamp=String(time);
    const signature=Buffer.from(await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,proofMessage({method,target,token,body,timestamp,nonce}))).toString('base64url');
    return {'X-Device-Timestamp':timestamp,'X-Device-Nonce':nonce,'X-Device-Signature':signature};
  }};
}
async function fixture(t){
  let time=Date.now();const c=await emulatorFixture({source:fictionalRosterData(),now:()=>time});
  const previous=process.env.ABC_ADMIN_UIDS,uid='fictional-'+randomUUID();process.env.ABC_ADMIN_UIDS=JSON.stringify([uid]);
  const app=initializeApp({projectId:c.config.projectId},'pairing-admin-'+randomUUID()),auth=getAuth(app);
  const email=uid+'@example.invalid',password=randomBytes(32).toString('base64url');
  await auth.createUser({uid,email,password});
  const adminAuthentication=await createLocalAdminAuthentication(),adminToken=await adminAuthentication.signIn({email,password});
  await c.root.collection('adminPairingPermissions').doc(uid).set({active:true,grants:[scope]});
  await c.root.collection('defaultMentorAssignments').doc('fictional-default').set({id:'fictional-default',groupId:scope.groupId,mentorId:'fictional-mentor',effectiveFrom:'2026-10-01'});
  await c.root.collection('sessionMentorOverrides').doc('fictional-override').set({id:'fictional-override',groupId:scope.groupId,serviceSessionId:scope.serviceSessionId,mentorId:'fictional-substitute'});
  const before=await Promise.all(['schools','groups','students','serviceSessions','sessions','studentPrivateProfiles','defaultMentorAssignments','sessionMentorOverrides'].map(async name=>[name,(await c.root.collection(name).get()).docs.map(d=>d.data())]));
  const server=createRosterServer({...c,adminAuthentication});server.listen(0,'127.0.0.1');await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port;
  t.after(async()=>{
    await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
    await adminAuthentication.close();await auth.deleteUser(uid);await deleteApp(app);
    if(previous===undefined)delete process.env.ABC_ADMIN_UIDS;else process.env.ABC_ADMIN_UIDS=previous;
    const after=await Promise.all(before.map(async([name])=>[name,(await c.root.collection(name).get()).docs.map(d=>d.data())]));
    assert.deepEqual(after,before);await c.close();
  });
  const admin=(target,body,token=adminToken,method='POST')=>fetch(base+target,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)})});
  const issue=async(options={})=>{const response=await admin('/api/admin/pairing-codes',{grants:[scope],...options});assert.equal(response.status,201);return response.json();};
  const redeem=async(code,d,extra={})=>{
    const target='/api/pairing/redeem',body=JSON.stringify({code,publicKey:d.publicKey,...extra});
    return fetch(base+target,{method:'POST',body,headers:{'Content-Type':'application/json',...await d.headers(code,'POST',target,body,time)}});
  };
  const request=async(credential,d,target=roster,headers={})=>fetch(base+target,{headers:{Authorization:'Bearer '+credential,...await d.headers(credential,'GET',target,'',time),...headers}});
  const paired=async(options={})=>{
    const code=await issue(options),d=await device(),response=await redeem(code.code,d);assert.equal(response.status,201);
    return {...await response.json(),d,code};
  };
  return {...c,uid,auth,adminToken,adminAuthentication,base,admin,issue,redeem,request,paired,now:()=>time,advance:ms=>{time+=ms;}};
}

test('Pairing issues one device, hashes all secrets, binds requests to a nonextractable Web Crypto key and preserves snapshots',async t=>{
  const f=await fixture(t),p=await f.paired();
  assert.match(p.deviceId,/^[a-f0-9-]{36}$/);assert.match(p.code.code,/^[A-Za-z0-9_-]{22}$/);assert.match(p.credential,/^[A-Za-z0-9_-]{43}$/);
  const entry=(await f.root.collection('pairingCodes').doc(p.code.pairingId).get()).data();
  assert.equal(entry.codeHash,hash(p.code.code));assert.equal(entry.state,'redeemed');
  const credential=(await f.root.collection('credentials').doc(hash(p.credential)).get()).data();assert.deepEqual(credential.grants,[scope]);
  const stored=JSON.stringify(await Promise.all(['pairingCodes','devices','credentials','authorizationEvents','pairingLimits'].map(async name=>(await f.root.collection(name).get()).docs.map(d=>({id:d.id,...d.data()})))));
  assert.equal(stored.includes(p.code.code),false);assert.equal(stored.includes(p.credential),false);
  const response=await f.request(p.credential,p.d);assert.equal(response.status,200);
  assert.deepEqual((await response.json()).students,[{id:'fictional-1',name:'Siswa Fiktif Snapshot',schoolClass:'4A'}]);
  assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('access-control-allow-origin'),null);
  assert.equal((await fetch(f.base+roster,{headers:{Authorization:'Bearer '+p.credential,'X-Device-Id':p.deviceId}})).status,401);
  assert.equal(await f.credentials.authenticate('Bearer '+p.credential),null);
  assert.equal((await f.request(p.credential,await device())).status,401);
  const status=await f.request(p.credential,p.d,'/api/device/status');assert.equal(status.status,200);
  assert.deepEqual(await status.json(),{deviceId:p.deviceId,state:'active',expiresAt:p.expiresAt,grants:[scope]});
  assert.equal((await f.redeem(p.code.code,p.d)).status,400);
});

test('Expired, invalid, reused and revoked codes share safe errors and never create another credential',async t=>{
  const f=await fixture(t),d=await device(),expired=await f.issue({codeTtlMs:1000});f.advance(1000);
  const revoked=await f.issue();assert.equal((await f.admin('/api/admin/pairing-codes/'+revoked.pairingId+'/revoke',{})).status,200);
  for(const code of [expired.code,revoked.code,randomBytes(16).toString('base64url'),'ABC2026']){
    const response=await f.redeem(code,d);assert.equal(response.status,400);
    assert.deepEqual(await response.json(),{error:'Kode pairing tidak valid atau tidak berlaku.'});
  }
  const p=await f.paired();assert.equal((await f.redeem(p.code.code,d)).status,400);
  assert.equal((await f.root.collection('credentials').get()).size,1);assert.equal((await f.root.collection('devices').get()).size,1);
});

test('Simultaneous redemption and revocation are atomic: at most one code winner and no partial credentials',async t=>{
  const f=await fixture(t),code=await f.issue();
  const responses=await Promise.all(Array.from({length:5},async()=>f.redeem(code.code,await device())));
  assert.deepEqual(responses.map(r=>r.status).sort(),[201,400,400,400,400]);
  assert.equal((await f.root.collection('credentials').get()).size,1);assert.equal((await f.root.collection('devices').get()).size,1);
  const other=await f.issue(),d=await device();
  const [redeem,revoke]=await Promise.all([f.redeem(other.code,d),f.admin('/api/admin/pairing-codes/'+other.pairingId+'/revoke',{})]);
  assert.equal(revoke.status,200);assert.ok([201,400].includes(redeem.status));
  const stored=(await f.root.collection('pairingCodes').doc(other.pairingId).get()).data();
  assert.equal(stored.state,redeem.status===201?'redeemed':'revoked');
  assert.equal((await f.root.collection('credentials').get()).size,redeem.status===201?2:1);
});

test('Admin authentication and exact server pairing permissions are required, without client role or scope escalation',async t=>{
  const f=await fixture(t),body={grants:[scope]};
  for(const headers of [{},{Authorization:'Bearer ABC2026','X-Admin':'true',Cookie:'adminUnlocked=true'}]){
    const response=await fetch(f.base+'/api/admin/pairing-codes',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});assert.equal(response.status,401);
  }
  const mentor=await f.deviceAuthorization.issue({deviceId:'fictional-legacy',grants:[scope]});
  assert.equal((await f.admin('/api/admin/pairing-codes',body,mentor)).status,401);
  const perm=f.root.collection('adminPairingPermissions').doc(f.uid);await perm.delete();
  assert.equal((await f.admin('/api/admin/pairing-codes',body)).status,403);
  await perm.set({active:true,grants:[scope]});
  for(const changes of [{schoolId:'s2',groupId:'g4',serviceSessionId:'demo-airlangga-2026-10-16'},{groupId:'g2'},{schoolId:'s2'},{serviceSessionId:'demo-pakel-2026-10-23'},{groupId:'*'}]){
    const response=await f.admin('/api/admin/pairing-codes',{grants:[{...scope,...changes}]});assert.ok([400,403].includes(response.status));
  }
  const code=await f.issue(),d=await device();
  assert.equal((await f.redeem(code.code,d,{deviceId:'chosen-device',grants:[{...scope,schoolId:'s2'}]})).status,400);
  await perm.set({active:false,grants:[scope]});assert.equal((await f.redeem(code.code,d)).status,400);
  assert.equal((await f.root.collection('pairingCodes').get()).size,1);assert.equal((await f.root.collection('credentials').get()).size,1);
});

test('Paired grants enforce school/group/session boundaries and expiry, with scoped admin device status/revocation',async t=>{
  const f=await fixture(t),p=await f.paired({grantTtlMs:1000});
  for(const changes of [{schoolId:'s2'},{groupId:'g2'},{serviceSessionId:'demo-pakel-2026-10-23'}])assert.equal((await f.request(p.credential,p.d,'/api/roster?'+new URLSearchParams({...scope,...changes}))).status,403);
  f.advance(1000);assert.equal((await f.request(p.credential,p.d)).status,401);
  const path='/api/admin/devices/'+p.deviceId;
  const expired=await f.admin(path,undefined,f.adminToken,'GET');assert.equal(expired.status,200);assert.equal((await expired.json()).state,'expired');
  const q=await f.paired(),qpath='/api/admin/devices/'+q.deviceId;
  await f.root.collection('adminPairingPermissions').doc(f.uid).set({active:true,grants:[{...scope,groupId:'g2'}]});
  assert.equal((await f.admin(qpath+'/revoke',{})).status,403);assert.equal((await f.admin(qpath,undefined,f.adminToken,'GET')).status,403);
  await f.root.collection('adminPairingPermissions').doc(f.uid).set({active:true,grants:[scope]});
  const revoked=await f.admin(qpath+'/revoke',{});assert.equal(revoked.status,200);assert.equal((await revoked.json()).state,'revoked');
  assert.equal((await f.request(q.credential,q.d)).status,401);assert.equal((await f.request(q.credential,q.d,'/api/device/status')).status,401);
  assert.equal((await f.admin(qpath+'/revoke',{})).status,200);
});

test('Device proof rejects replay, request tampering, stale timestamps and stolen credentials',async t=>{
  const f=await fixture(t),p=await f.paired(),headers={Authorization:'Bearer '+p.credential,...await p.d.headers(p.credential,'GET',roster,'',f.now())};
  const requests=await Promise.all([fetch(f.base+roster,{headers}),fetch(f.base+roster,{headers})]);assert.deepEqual(requests.map(r=>r.status).sort(),[200,401]);
  assert.equal((await fetch(f.base+'/api/device/status',{headers})).status,401);
  const stale=await p.d.headers(p.credential,'GET',roster,'',f.now()-61000);assert.equal((await fetch(f.base+roster,{headers:{...headers,...stale}})).status,401);
  assert.equal((await f.request(p.credential,p.d,roster,{'X-Device-Signature':'x'.repeat(86)})).status,401);
  assert.equal((await f.request(p.credential,p.d,roster,{'X-Device-Nonce':'client-selected-id'})).status,401);
});

test('Persistent rate limits include invalid requests, ignore forwarded identities and survive a new backend context',async t=>{
  const f=await fixture(t);
  for(let i=0;i<10;i++){
    const response=await fetch(f.base+'/api/pairing/redeem',{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':'127.0.0.'+(i+1)},body:'{}'});assert.equal(response.status,400);
  }
  const blocked=await fetch(f.base+'/api/pairing/redeem',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(blocked.status,429);assert.equal(blocked.headers.get('retry-after'),'60');
  assert.deepEqual(await blocked.json(),{error:'Terlalu banyak percobaan. Coba lagi nanti.'});
  const previous=process.env.ABC_FIRESTORE_NAMESPACE;let fresh;
  try{process.env.ABC_FIRESTORE_NAMESPACE=f.config.namespace;fresh=await createFirestoreEmulatorRepositories({now:f.now});}
  finally{if(previous===undefined)delete process.env.ABC_FIRESTORE_NAMESPACE;else process.env.ABC_FIRESTORE_NAMESPACE=previous;}
  try{await assert.rejects(fresh.pairing.limit('redeem','127.0.0.1',10),error=>error.status===429);}finally{await fresh.close();}
  f.advance(60000);assert.equal((await f.redeem(randomBytes(16).toString('base64url'),await device())).status,400);
  assert.equal((await f.root.collection('credentials').get()).size,0);
  await f.root.collection('pairingLimits').doc(hash('admin:'+f.uid)).set({window:Math.floor(f.now()/60000),count:20});
  assert.equal((await f.admin('/api/admin/pairing-codes',{grants:[scope]})).status,429);
});

test('Actual API restart preserves device/key grants, nonce replay rejection, and device revocation',async t=>{
  const f=await fixture(t),p=await f.paired();
  async function start(){
    const child=fork(new URL('./server-process.mjs',import.meta.url),[],{env:{...process.env,ABC_FIRESTORE_NAMESPACE:f.config.namespace},stdio:['ignore','ignore','inherit','ipc'],windowsHide:true});
    const ready=await Promise.race([once(child,'message'),once(child,'exit').then(()=>{throw Error('API uji berhenti sebelum siap.');})]);
    const stop=async()=>{if(child.exitCode!==null)return;const done=once(child,'exit');child.send('stop');await done;};t.after(stop);
    return {base:'http://127.0.0.1:'+ready[0].port,stop};
  }
  const headers={Authorization:'Bearer '+p.credential,...await p.d.headers(p.credential,'GET',roster,'',f.now())};
  const a=await start();assert.equal((await fetch(a.base+roster,{headers})).status,200);await a.stop();
  const b=await start();assert.equal((await fetch(b.base+roster,{headers})).status,401);
  const target='/api/pairing/redeem',body=JSON.stringify({code:p.code.code,publicKey:p.d.publicKey});
  assert.equal((await fetch(b.base+target,{method:'POST',body,headers:{'Content-Type':'application/json',...await p.d.headers(p.code.code,'POST',target,body,f.now())}})).status,400);
  const next={Authorization:'Bearer '+p.credential,...await p.d.headers(p.credential,'GET',roster,'',f.now())};
  assert.equal((await fetch(b.base+roster,{headers:next})).status,200);
  await f.admin('/api/admin/devices/'+p.deviceId+'/revoke',{});await b.stop();
  const c=await start();assert.equal((await fetch(c.base+roster,{headers:{Authorization:'Bearer '+p.credential,...await p.d.headers(p.credential,'GET',roster)}})).status,401);
});

test('Admin authorization lost during I/O cannot commit pairing issuance',async t=>{
  const f=await fixture(t);
  await assert.rejects(f.pairing.issue(f.uid,{grants:[scope]},async()=>false),error=>error.status===401);
  assert.equal((await f.root.collection('pairingCodes').get()).size,0);assert.equal((await f.root.collection('authorizationEvents').get()).size,0);
});

test('Missing or malformed persisted binding cannot downgrade a paired credential to bearer-only access',async t=>{
  const f=await fixture(t),p=await f.paired(),ref=f.root.collection('devices').doc(p.deviceId),original=(await ref.get()).data();
  for(const change of [{publicKey:undefined},{binding:undefined},{binding:'unknown'},{publicKey:'invalid'}]){
    const altered={...original,...change};for(const key of Object.keys(altered))if(altered[key]===undefined)delete altered[key];
    await ref.set(altered);
    assert.equal(await f.credentials.authenticate('Bearer '+p.credential),null);
    assert.equal((await f.request(p.credential,p.d)).status,401);
  }
  await ref.set(original);
  await f.root.collection('credentials').doc(hash(p.credential)).update({binding:'unknown'});
  assert.equal((await f.request(p.credential,p.d)).status,401);
  const legacy=await f.deviceAuthorization.issue({deviceId:'fictional-unbound-legacy',grants:[scope]});
  assert.ok(await f.credentials.authenticate('Bearer '+legacy));
  assert.equal((await fetch(f.base+roster,{headers:{Authorization:'Bearer '+legacy}})).status,200);
});

test('Malformed/oversized bodies, invalid key proofs, query and origin injection fail without consuming codes',async t=>{
  const f=await fixture(t),code=await f.issue(),d=await device();
  for(const [body,headers,status] of [
    ['{',{'Content-Type':'application/json'},400],
    ['x'.repeat(9000),{'Content-Type':'application/json'},413],
    [JSON.stringify({code:code.code,publicKey:d.publicKey}),{'Content-Type':'application/json',Origin:'https://untrusted.invalid'},400],
    [JSON.stringify({code:code.code,publicKey:d.publicKey}),{'Content-Type':'text/plain'},400]
  ])assert.equal((await fetch(f.base+'/api/pairing/redeem',{method:'POST',body,headers})).status,status);
  assert.equal((await f.redeem(code.code,{publicKey:'invalid',headers:d.headers})).status,400);
  const missingProof=await fetch(f.base+'/api/pairing/redeem',{method:'POST',body:JSON.stringify({code:code.code,publicKey:d.publicKey}),headers:{'Content-Type':'application/json'}});assert.equal(missingProof.status,400);
  assert.equal((await f.root.collection('credentials').get()).size,0);
  assert.equal((await f.root.collection('pairingCodes').doc(code.pairingId).get()).data().state,'pending');
  assert.equal((await fetch(f.base+'/api/pairing/redeem?role=admin',{method:'POST',body:'{}',headers:{'Content-Type':'application/json'}})).status,400);
  assert.equal((await f.redeem(code.code,d)).status,201);
});
