import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomBytes,randomUUID,generateKeyPairSync,sign} from 'node:crypto';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {emulatorFixture} from './fixture.mjs';
import {adminLoginFixture} from './admin-login-fixture.mjs';
import {deviceManagementSource,hagai} from './device-management-source.mjs';
import {initializeOwner} from '../../backend/admin-accounts.mjs';
import {createRosterServer} from '../../backend/server.mjs';
import {createFirestoreEmulatorRepositories} from '../../backend/firestore-emulator.mjs';
import {proofMessage} from '../../backend/device-proof.mjs';

async function fixture(t){
  const previous=process.env.ABC_FIRESTORE_NAMESPACE,{source,grants}=deviceManagementSource(),c=await emulatorFixture({source});process.env.ABC_FIRESTORE_NAMESPACE=c.config.namespace;
  const f=await adminLoginFixture(t,{pairing:c.pairing}),api=createRosterServer(c);api.listen(0,'127.0.0.1');await once(api,'listening');
  t.after(async()=>{
    await new Promise(resolve=>{api.close(resolve);api.closeAllConnections();});
    const app=initializeApp({projectId:'demo-abc-attendance'},'stage2-cleanup-'+randomUUID());
    try{const rows=await c.root.collection('adminAccounts').where('role','==','pic').get();if(rows.size)await getAuth(app).deleteUsers(rows.docs.map(d=>d.id));}finally{await deleteApp(app);await c.close();if(previous===undefined)delete process.env.ABC_FIRESTORE_NAMESPACE;else process.env.ABC_FIRESTORE_NAMESPACE=previous;}
  });
  await c.root.collection('adminPairingPermissions').doc(f.uid).set({active:true,grants});await initializeOwner({...c,auth:f.auth,uid:f.uid,email:f.email,confirmed:true});
  const owner=(await (await f.login()).json()).token;
  const admin=(token,path,body)=>fetch(f.base+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,Origin:f.base,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const pic=async scopes=>{const email='pic-'+randomUUID()+'@abc-attendance.test',password=randomBytes(24).toString('base64url');const response=await admin(owner,'/api/admin/accounts',{email,password,grants:scopes,actions:['pairing:read','pairing:issue','pairing:revoke']});assert.equal(response.status,201);const {uid}=await response.json();const login=await f.login({email,password});assert.equal(login.status,200);return {uid,token:(await login.json()).token};};
  const issue=(token,scopes=[hagai],key=randomUUID())=>admin(token,'/api/admin/pairing-codes',{grants:scopes,idempotencyKey:key});
  const pair=async token=>{
    const response=await issue(token);assert.equal(response.status,201);const code=(await response.json()).code;
    const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),publicKey=keys.publicKey.export({type:'spki',format:'der'}).toString('base64url');
    let credential=code;const headers=(method,target,body='')=>{const timestamp=String(Date.now()),nonce=randomBytes(16).toString('base64url');return {Authorization:'Bearer '+credential,'Content-Type':'application/json','X-Device-Timestamp':timestamp,'X-Device-Nonce':nonce,'X-Device-Signature':sign('sha256',proofMessage({method,target,body,token:credential,timestamp,nonce}),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};};
    const base='http://127.0.0.1:'+api.address().port,body=JSON.stringify({code,publicKey}),redeem=await fetch(base+'/api/pairing/redeem',{method:'POST',headers:headers('POST','/api/pairing/redeem',body),body});assert.equal(redeem.status,201);credential=(await redeem.json()).credential;
    return async(action,command,scope=hagai)=>{const target='/api/attendance'+(action==='read'?'':action==='save'?'':action==='correct'?'/corrections':'/'+action)+'?'+new URLSearchParams(scope),method=action==='read'?'GET':action==='save'?'PUT':'POST',raw=command?JSON.stringify(command):'';return fetch(base+target,{method,headers:headers(method,target,raw),...(command?{body:raw}:{})});};
  };
  const records=async name=>(await c.root.collection(name).get()).docs.map(d=>({id:d.id,...d.data()}));
  return {...c,...f,owner,admin,pic,issue,pair,records,grants};
}

test('Same-ID-token admin logins remain independent without accepting raw or forged handles',async t=>{
  const f=await fixture(t),original=globalThis.fetch;
  const url='http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-emulator';
  const raw=(await (await original(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:f.email,password:f.password,returnSecureToken:true})})).json()).idToken;
  try{
    globalThis.fetch=(target,options)=>String(target)===url?Promise.resolve(new Response(JSON.stringify({idToken:raw}),{headers:{'Content-Type':'application/json'}})):original(target,options);
    const [a,b]=await Promise.all([f.adminAuthentication.signIn({email:f.email,password:f.password}),f.adminAuthentication.signIn({email:f.email,password:f.password})]);
    assert.equal(a===b,false);assert.equal(a.split('~')[0]===b.split('~')[0],true);
    assert.equal((await f.adminAuthentication.authorize('Bearer '+raw)).kind,'unauthenticated');
    assert.equal((await f.adminAuthentication.authorize('Bearer '+raw+'~'+randomBytes(32).toString('base64url'))).kind,'unauthenticated');
    assert.equal((await f.admin(a,'/api/admin/session')).status,200);assert.equal((await f.admin(b,'/api/admin/session')).status,200);
    assert.equal((await f.admin(a,'/api/admin/logout',{})).status,200);assert.equal((await f.admin(a,'/api/admin/session')).status,401);assert.equal((await f.admin(b,'/api/admin/session')).status,200);
  }finally{globalThis.fetch=original;}
});

test('Concurrent owner/PIC issuance commits one code per intent; receipts survive restart, enforce scope and never store codes',async t=>{
  const f=await fixture(t),other=f.grants.find(s=>s.schoolId!=='s1'),[a,b]=await Promise.all([f.pic([hagai]),f.pic([other])]);
  const key=randomUUID(),results=await Promise.all([f.issue(a.token,[hagai],key),f.issue(a.token,[hagai],key)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
  const success=await results.find(r=>r.status===201).json(),duplicate=await results.find(r=>r.status===409).json();assert.equal(duplicate.pairingId,success.pairingId);assert.equal('code' in duplicate,false);
  assert.equal((await f.records('pairingCodes')).length,1);assert.equal((await f.records('pairingSubmissions')).length,1);assert.equal((await f.records('authorizationEvents')).filter(r=>r.event==='pairing-issued').length,1);
  assert.equal(JSON.stringify(await f.records('pairingSubmissions')).includes(success.code),false);assert.equal(JSON.stringify(await f.records('pairingSubmissions')).includes(key),false);
  const restarted=await createFirestoreEmulatorRepositories();
  try{await assert.rejects(restarted.pairing.issue(a.uid,{grants:[hagai],idempotencyKey:key}),e=>e.status===409&&e.duplicateSubmission===true);}finally{await restarted.close();}
  assert.equal((await f.admin(a.token,'/api/admin/pairing-codes',{grants:[hagai]})).status,400);
  assert.equal((await f.admin(a.token,'/api/admin/pairing-codes',{grants:[hagai],idempotencyKey:key,codeTtlMs:1000})).status,409);
  assert.equal((await f.issue(b.token,[hagai],key)).status,403);
  assert.equal((await f.admin(b.token,'/api/admin/pairing-codes/'+success.pairingId+'/revoke',{})).status,403);
  const separate=await Promise.all([f.issue(f.owner,[hagai],key),f.issue(b.token,[other],key)]);assert.deepEqual(separate.map(r=>r.status),[201,201]);
  assert.equal((await f.admin(a.token,'/api/admin/logout',{})).status,200);assert.equal((await f.admin(b.token,'/api/admin/session')).status,200);assert.equal((await f.admin(f.owner,'/api/admin/session')).status,200);
});

test('Two paired mentors share one batch safely through duplicate saves, conflicts, finalization and corrections',async t=>{
  const f=await fixture(t),pic=await f.pic([hagai]),[a,b]=await Promise.all([f.pair(f.owner),f.pair(pic.token)]);
  const command=(revision,status,key=randomUUID())=>({expectedRevision:revision,idempotencyKey:key,records:[{studentId:'fictional-hagai',status}]});
  const first=command(0,'present'),duplicates=await Promise.all([a('save',first),a('save',first)]);assert.deepEqual(duplicates.map(r=>r.status),[200,200]);assert.deepEqual(await duplicates[0].json(),await duplicates[1].json());
  assert.equal((await f.records('sessions')).length,1);assert.equal((await f.records('attendanceHistory')).length,1);
  const changes=await Promise.all([a('save',command(1,'excused')),b('save',command(1,'absent'))]);assert.deepEqual(changes.map(r=>r.status).sort(),[200,409]);
  const latest=await (await a('read')).json();assert.equal(latest.revision,2);
  assert.equal((await a('save',first)).status,200);assert.equal((await (await b('read')).json()).revision,2);
  assert.equal((await a('save',{...first,records:[{studentId:'fictional-hagai',status:'absent'}]})).status,409);
  const finalize={expectedRevision:2,idempotencyKey:randomUUID(),confirm:true};
  const finals=await Promise.all([a('finalize',finalize),b('finalize',{...finalize,idempotencyKey:randomUUID()})]);assert.deepEqual(finals.map(r=>r.status).sort(),[200,409]);
  const corrected=await a('correct',{...command(3,'present'),reason:'Koreksi fiktif setelah konfirmasi'});assert.equal(corrected.status,200);
  const state=await (await b('read')).json();assert.equal(state.revision,4);assert.equal(state.state,'draft');
  const history=await f.records('attendanceHistory');assert.equal(history.length,4);assert.deepEqual(history.map(r=>r.revision).sort(),[1,2,3,4]);assert.equal(history.find(r=>r.revision===1).snapshot.records[0].status,'present');
  assert.equal((await f.records('attendanceSubmissions')).length,4);assert.equal((await f.records('sessions')).length,1);
  assert.equal((await b('save',command(4,'present'),{...hagai,groupId:'g1'})).status,403);
  assert.equal((await (await a('read')).json()).revision,4);
});
