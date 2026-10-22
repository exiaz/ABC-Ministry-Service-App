import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {generateKeyPairSync,sign,randomBytes,randomUUID} from 'node:crypto';
import {emulatorFixture} from './fixture.mjs';
import {fictionalRosterData,scope} from '../fixtures/roster.mjs';
import {createRosterServer} from '../../backend/server.mjs';
import {createFirestoreEmulatorRepositories} from '../../backend/firestore-emulator.mjs';
import {hash,proofMessage} from '../../backend/device-proof.mjs';

const nextFriday={...scope,serviceSessionId:'demo-pakel-2026-10-23'};
const groupTwo={...scope,groupId:'g2'};
const patch=(expectedRevision,records,extra={})=>({expectedRevision,idempotencyKey:randomUUID(),records,...extra});
const mark=(studentId,status)=>({studentId,status});
const finalize=expectedRevision=>({expectedRevision,idempotencyKey:randomUUID(),confirm:true});
async function fixture(t,{source=fictionalRosterData(),grants=[scope,nextFriday,groupTwo],ttlMs=300000}={}){
  let time=Date.parse('2026-10-22T16:59:59Z'); // One second before Friday in WIB.
  const c=await emulatorFixture({source,now:()=>time}),server=createRosterServer({...c,mentorOrigin:'http://127.0.0.1:4176'});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});await c.close();});
  const pair=async(scopes=grants,ttl=ttlMs)=>{
    const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),publicKey=keys.publicKey.export({type:'spki',format:'der'}).toString('base64url'),deviceId=randomUUID();
    const token=await c.deviceAuthorization.issue({deviceId,grants:scopes,ttlMs:ttl});
    await c.root.collection('credentials').doc(hash(token)).update({binding:'p256-v1'});
    await c.root.collection('devices').doc(deviceId).update({binding:'p256-v1',publicKey});
    return {token,keys,deviceId};
  };
  const device=await pair(),base='http://127.0.0.1:'+server.address().port;
  const headers=(d,method,target,body='')=>{
    const timestamp=String(time),nonce=randomBytes(16).toString('base64url');
    return {Authorization:'Bearer '+d.token,'Content-Type':'application/json','X-Device-Timestamp':timestamp,'X-Device-Nonce':nonce,'X-Device-Signature':sign('sha256',proofMessage({method,target,token:d.token,body,timestamp,nonce}),{key:d.keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};
  };
  const target=(s=scope,suffix='')=>'/api/attendance'+suffix+'?'+new URLSearchParams(s);
  const call=(method='GET',body,s=scope,suffix='',d=device,extraHeaders={})=>{
    const path=target(s,suffix),raw=body===undefined?'':JSON.stringify(body);
    return fetch(base+path,{method,headers:{...headers(d,method,path,raw),...extraHeaders},...(method==='GET'?{}:{body:raw})});
  };
  const read=async(s=scope)=>{const r=await call('GET',undefined,s);assert.equal(r.status,200);return r.json();};
  const data=async name=>(await c.root.collection(name).get()).docs.map(d=>({docId:d.id,...d.data()}));
  return {...c,server,base,device,pair,headers,target,call,read,data,now:()=>time,advance:ms=>{time+=ms;}};
}

test('Attendance reads are minimal, side-effect free, preserve legacy IDs and return unmarked for a new Friday',async t=>{
  const f=await fixture(t),before=await f.data('sessions');
  const old=await f.read();assert.equal(old.batchId,'fictional-batch');assert.equal(old.revision,0);assert.equal(old.state,'completed');
  assert.deepEqual(old.records,[{studentId:'fictional-1',status:'present',updatedAt:null}]);
  const fresh=await f.read(nextFriday);assert.equal(fresh.batchId,null);assert.equal(fresh.state,'not-started');assert.deepEqual(fresh.records.map(r=>r.status),['unmarked','unmarked']);
  const response=await f.call();assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('access-control-allow-origin'),null);
  assert.deepEqual(Object.keys(await response.json()).sort(),['schoolId','groupId','serviceSessionId','batchId','revision','state','updatedAt','finalizedAt','records'].sort());
  assert.equal(JSON.stringify([old,fresh]).includes('FIKTIF_PRIVAT'),false);
  assert.deepEqual(await f.data('sessions'),before);assert.deepEqual(await f.data('attendanceHistory'),[]);assert.deepEqual(await f.data('attendanceSubmissions'),[]);
});

test('Draft writes preserve unmarked; finalization requires confirmation, all explicit marks, and server WIB date',async t=>{
  const f=await fixture(t);
  let r=await f.call('PUT',patch(0,[mark('fictional-1','present')]),nextFriday);assert.equal(r.status,200);
  let draft=await r.json();const batchId=draft.batchId;
  assert.equal(draft.state,'draft');assert.equal(draft.revision,1);assert.equal(draft.records[1].status,'unmarked');
  assert.equal((await f.call('POST',finalize(1),nextFriday,'/finalize')).status,409);
  r=await f.call('PUT',patch(1,[mark('fictional-2','unmarked')]),nextFriday);assert.equal(r.status,200);
  f.advance(1000);
  assert.equal((await f.call('POST',finalize(2),nextFriday,'/finalize')).status,409);
  assert.equal((await f.call('POST',{...finalize(2),confirm:false},nextFriday,'/finalize')).status,400);
  assert.equal((await f.call('PUT',patch(2,[mark('fictional-2','excused')]),nextFriday)).status,200);
  const submit=finalize(3);r=await f.call('POST',submit,nextFriday,'/finalize');assert.equal(r.status,200);
  const completed=await r.json();assert.equal(completed.state,'completed');assert.equal(completed.revision,4);assert.equal(completed.batchId,batchId);assert.ok(completed.finalizedAt);
  r=await f.call('POST',submit,nextFriday,'/finalize');assert.equal(r.status,200);assert.deepEqual(await r.json(),completed);
  assert.equal((await f.call('POST',finalize(4),nextFriday,'/finalize')).status,409);
  assert.equal((await f.call('PUT',patch(4,[mark('fictional-1','absent')]),nextFriday)).status,409);
  assert.equal((await f.read()).records[0].status,'present');
  assert.equal((await f.data('attendanceHistory')).length,4);assert.equal((await f.data('sessions')).length,2);
});

test('Corrections preserve exact historical baseline and every version, timestamps, stable IDs, and require refinalization',async t=>{
  const f=await fixture(t),original=(await f.root.collection('sessions').doc('fictional-batch').get()).data();
  await f.root.collection('students').doc('fictional-1').update({active:false,groupId:'g2'});
  const body=patch(0,[mark('fictional-1','absent')],{reason:'Koreksi fiktif setelah tinjauan'});
  let r=await f.call('POST',body,scope,'/corrections');assert.equal(r.status,200);
  const corrected=await r.json();assert.equal(corrected.batchId,original.id);assert.equal(corrected.state,'draft');assert.equal(corrected.records[0].status,'absent');assert.ok(corrected.records[0].updatedAt);assert.equal(corrected.finalizedAt,null);
  r=await f.call('POST',body,scope,'/corrections');assert.equal(r.status,200);assert.deepEqual(await r.json(),corrected);
  assert.equal((await f.call('POST',patch(1,[mark('fictional-1','excused')],{reason:'Ulang'}),scope,'/corrections')).status,409);
  f.advance(1000);assert.equal((await f.call('POST',finalize(1),scope,'/finalize')).status,200);
  f.advance(1000);assert.equal((await f.call('POST',patch(2,[mark('fictional-1','excused')],{reason:'Koreksi kedua fiktif'}),scope,'/corrections')).status,200);
  const history=(await f.data('attendanceHistory')).sort((a,b)=>a.revision-b.revision);
  assert.deepEqual(history.map(h=>h.revision),[0,1,2,3]);assert.deepEqual(history[0].snapshot,original);
  assert.deepEqual(history.map(h=>h.snapshot.records[0].status),['present','absent','absent','excused']);
  assert.deepEqual(history.map(h=>h.action),['baseline','correct','finalize','correct']);assert.equal(history[1].reason,body.reason);
  assert.ok(history[2].at>history[1].at);assert.equal(history[1].deviceId,f.device.deviceId);assert.equal(history[1].credentialId,hash(f.device.token));
  assert.equal(JSON.stringify(await f.read()).includes('FIKTIF_PRIVAT'),false);assert.equal(JSON.stringify(history).includes(f.device.token),false);
  assert.equal((await f.data('studentPrivateProfiles'))[0].guardianName,'WALI_FIKTIF_PRIVAT');
});

test('Duplicate submissions and concurrent writers commit once; stale revisions and reused keys cannot overwrite',async t=>{
  const f=await fixture(t),q=await f.pair(),body=patch(0,[mark('fictional-1','present')]);
  const replies=await Promise.all(Array.from({length:3},()=>f.call('PUT',body,nextFriday)));
  assert.deepEqual(replies.map(r=>r.status),[200,200,200]);
  const values=await Promise.all(replies.map(r=>r.json()));assert.deepEqual(values[0],values[1]);assert.deepEqual(values[0],values[2]);
  assert.equal((await f.data('attendanceHistory')).length,1);assert.equal((await f.data('attendanceSubmissions')).length,1);
  assert.equal((await f.call('PUT',{...body,records:[mark('fictional-1','absent')]},nextFriday)).status,409);
  const writers=await Promise.all([f.call('PUT',patch(1,[mark('fictional-1','excused')]),nextFriday),f.call('PUT',patch(1,[mark('fictional-1','absent')]),nextFriday,'',q)]);
  assert.deepEqual(writers.map(r=>r.status).sort(),[200,409]);assert.equal((await f.read(nextFriday)).revision,2);
  // Replaying an old key returns its original outcome without rolling state back.
  const retry=await f.call('PUT',body,nextFriday);assert.deepEqual(await retry.json(),values[0]);assert.equal((await f.read(nextFriday)).revision,2);
  assert.equal((await f.data('attendanceHistory')).length,2);assert.equal((await f.data('attendanceSubmissions')).length,2);
});

test('Enrollment, session membership, cross-group duplicate claims and invalid scope are validated on the server',async t=>{
  const source=fictionalRosterData();source.sessions=[];
  const f=await fixture(t,{source});
  for(const studentId of ['fictional-inactive','fictional-other','unknown'])assert.equal((await f.call('PUT',patch(0,[mark(studentId,'present')]),scope)).status,403);
  assert.equal((await f.call('PUT',patch(0,[mark('fictional-1','present')]),scope)).status,200);
  await f.root.collection('students').doc('fictional-1').update({groupId:'g2'});
  assert.deepEqual((await f.read(groupTwo)).records,[]);
  const replies=await Promise.all([f.call('PUT',patch(1,[mark('fictional-1','excused')]),scope),f.call('PUT',patch(0,[mark('fictional-1','present')]),groupTwo)]);
  assert.deepEqual(replies.map(r=>r.status),[200,403]);
  assert.equal((await f.data('sessions')).length,1);
  await f.root.collection('serviceSessions').doc(scope.serviceSessionId).update({groupIds:['g2']});
  assert.equal((await f.call()).status,403);assert.equal((await f.call('PUT',patch(2,[mark('fictional-1','present')]))).status,403);
  assert.equal((await f.data('attendanceHistory')).length,2);
});

test('Missing, forged, legacy, expired, revoked and out-of-scope credentials deny every attendance operation',async t=>{
  const f=await fixture(t,{grants:[scope],ttlMs:1000});
  const operations=[['GET',undefined,''],['PUT',patch(0,[mark('fictional-1','present')]),''],['POST',finalize(0),'/finalize'],['POST',patch(0,[mark('fictional-1','excused')],{reason:'Fiktif'}),'/corrections']];
  for(const [method,body,suffix] of operations){
    for(const Authorization of ['', 'Bearer ABC2026','Bearer '+randomBytes(32).toString('base64url')])assert.equal((await f.call(method,body,scope,suffix,f.device,{Authorization})).status,401);
    for(const changes of [{schoolId:'s2'},{groupId:'g2'},{serviceSessionId:nextFriday.serviceSessionId}])assert.equal((await f.call(method,body,{...scope,...changes},suffix)).status,403);
    assert.equal((await f.call(method,body,scope,suffix,f.device,{'X-Device-Signature':'x'.repeat(86)})).status,401);
  }
  const token=await f.credentials.issue({deviceId:'fictional-legacy',grants:[scope]});
  assert.equal((await f.call('GET',undefined,scope,'',{...f.device,token})).status,401);
  f.advance(1000);for(const [method,body,suffix] of operations)assert.equal((await f.call(method,body,scope,suffix)).status,401);
  const q=await f.pair([scope]);await f.deviceAuthorization.revoke(q.deviceId);
  for(const [method,body,suffix] of operations)assert.equal((await f.call(method,body,scope,suffix,q)).status,401);
  const credentialRevoked=await f.pair([scope]);await f.credentials.revoke(credentialRevoked.token);
  assert.equal((await f.call('GET',undefined,scope,'',credentialRevoked)).status,401);
  assert.equal((await f.data('attendanceHistory')).length,0);assert.equal((await f.data('attendanceSubmissions')).length,0);
});

test('Signed bodies and nonces prevent tampering/replay; malformed JSON, oversized requests, methods and ambiguous scopes fail safely',async t=>{
  const f=await fixture(t),path=f.target(nextFriday),body=JSON.stringify(patch(0,[mark('fictional-1','present')])),headers=f.headers(f.device,'PUT',path,body);
  const tampered=await fetch(f.base+path,{method:'PUT',headers,body:body.replace('present','absent')});assert.equal(tampered.status,401);
  const r=await fetch(f.base+path,{method:'PUT',headers,body});assert.equal(r.status,200);
  assert.equal((await fetch(f.base+path,{method:'PUT',headers,body})).status,401);
  assert.equal((await f.call('DELETE')).status,405);
  assert.equal((await f.call('PUT',{},scope,'',f.device,{'Content-Type':'text/plain'})).status,400);
  assert.equal((await f.call('PUT',{value:'x'.repeat(33000)})).status,413);
  for(const raw of ['{','null','[]']){
    const r=await fetch(f.base+path,{method:'PUT',headers:f.headers(f.device,'PUT',path,raw),body:raw});assert.equal(r.status,400);
  }
  for(const suffix of ['&schoolId=s1','&role=admin','&deviceId=fictional']){
    const target=f.target()+suffix,r=await fetch(f.base+target,{headers:f.headers(f.device,'GET',target)});assert.equal(r.status,400);
  }
  assert.equal((await f.call('GET',undefined,scope,'',f.device,{Origin:'http://127.0.0.1:4173'})).status,403);
  assert.equal((await f.call('POST',patch(0,[mark('fictional-1','present')],{reason:' '}),scope,'/corrections')).status,400);
  assert.equal((await f.data('attendanceHistory')).length,1);
});

test('Expiry during storage denies an atomic write; concurrent revocation leaves no usable credential or partial write',async t=>{
  const source=fictionalRosterData();source.sessions=[];
  const f=await fixture(t,{source,ttlMs:1000}),authenticate=f.credentials.authenticate;
  let advanced=false;
  f.credentials.authenticate=async(...args)=>{const principal=await authenticate(...args);if(args[2]&&!advanced){advanced=true;f.advance(1000);}return principal;};
  assert.equal((await f.call('PUT',patch(0,[mark('fictional-1','present')]))).status,401);
  assert.equal((await f.data('sessions')).length,0);assert.equal((await f.data('attendanceHistory')).length,0);assert.equal((await f.data('attendanceSubmissions')).length,0);
  f.credentials.authenticate=authenticate;
  const q=await f.pair([scope]);
  const [write,revoked]=await Promise.all([f.call('PUT',patch(0,[mark('fictional-1','present')]),scope,'',q),f.deviceAuthorization.revoke(q.deviceId)]);
  assert.equal(revoked,true);assert.ok([200,401].includes(write.status));
  assert.equal((await f.call('GET',undefined,scope,'',q)).status,401);
  const count=write.status===200?1:0;
  for(const name of ['sessions','attendanceHistory','attendanceSubmissions'])assert.equal((await f.data(name)).length,count);
});

test('Receipts persist across adapter restart; rescheduling preserves session and batch IDs; invalid legacy duplicates fail closed',async t=>{
  const f=await fixture(t),body=patch(0,[mark('fictional-1','present')]),r=await f.call('PUT',body,nextFriday);assert.equal(r.status,200);const initial=await r.json();
  await f.root.collection('serviceSessions').doc(nextFriday.serviceSessionId).update({date:'2026-10-16',dateHistory:['2026-10-23']});
  const previous=process.env.ABC_FIRESTORE_NAMESPACE;let restarted;
  try{process.env.ABC_FIRESTORE_NAMESPACE=f.config.namespace;restarted=await createFirestoreEmulatorRepositories({now:f.now});}
  finally{if(previous===undefined)delete process.env.ABC_FIRESTORE_NAMESPACE;else process.env.ABC_FIRESTORE_NAMESPACE=previous;}
  try{
    const proof={deviceId:f.device.deviceId};
    assert.deepEqual(await restarted.attendance.executeAuthorized({authorization:'Bearer '+f.device.token,proof,scope:nextFriday,action:'save',body}),initial);
  }finally{await restarted.close();}
  assert.equal((await f.call('POST',finalize(1),nextFriday,'/finalize')).status,409); // still unmarked
  assert.equal((await f.call('PUT',patch(1,[mark('fictional-2','absent')]),nextFriday)).status,200);
  assert.equal((await f.call('POST',finalize(2),nextFriday,'/finalize')).status,200);
  assert.equal((await f.read(nextFriday)).batchId,initial.batchId);
  const original=(await f.root.collection('sessions').doc('fictional-batch').get()).data();
  await f.root.collection('sessions').doc('fictional-duplicate').set({...original,id:'fictional-duplicate'});
  assert.equal((await f.call()).status,409);
  assert.equal((await f.call('POST',patch(0,[mark('fictional-1','excused')],{reason:'Fiktif'}),scope,'/corrections')).status,409);
});

test('Concurrent finalization has one winner, empty rosters cannot finalize, and a history write failure rolls back all changes',async t=>{
  const f=await fixture(t);
  assert.equal((await f.call('POST',finalize(0),groupTwo,'/finalize')).status,409);
  assert.equal((await f.call('PUT',patch(0,[mark('fictional-1','present'),mark('fictional-2','absent')]),nextFriday)).status,200);
  f.advance(1000);
  const replies=await Promise.all([f.call('POST',finalize(1),nextFriday,'/finalize'),f.call('POST',finalize(1),nextFriday,'/finalize')]);
  assert.deepEqual(replies.map(r=>r.status).sort(),[200,409]);assert.equal((await f.read(nextFriday)).revision,2);
  assert.equal((await f.data('attendanceHistory')).length,2);
  // Inject a server storage conflict, then verify the batch, baseline and
  // idempotency receipt were not partially committed by the failed correction.
  const ref=f.root.collection('attendanceHistory').doc(hash(JSON.stringify(['fictional-batch',1])));
  await ref.create({fictionalConflict:true});
  const before=await Promise.all(['sessions','attendanceHistory','attendanceSubmissions','studentPrivateProfiles','mentorAssignmentSnapshots'].map(f.data));
  const response=await f.call('POST',patch(0,[mark('fictional-1','excused')],{reason:'Koreksi fiktif gagal'}),scope,'/corrections');
  assert.equal(response.status,500);assert.deepEqual(await response.json(),{error:'Absensi tidak dapat diproses.'});
  const after=await Promise.all(['sessions','attendanceHistory','attendanceSubmissions','studentPrivateProfiles','mentorAssignmentSnapshots'].map(f.data));
  assert.deepEqual(after,before);
});
