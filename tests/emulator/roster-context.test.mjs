import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {generateKeyPairSync,sign,randomBytes,randomUUID} from 'node:crypto';
import {emulatorFixture} from './fixture.mjs';
import {fictionalRosterData,scope} from '../fixtures/roster.mjs';
import {createRosterServer} from '../../backend/server.mjs';
import {hash,proofMessage} from '../../backend/device-proof.mjs';

async function fixture(t){
  let time=Date.now();const c=await emulatorFixture({source:fictionalRosterData(),now:()=>time});
  const server=createRosterServer({...c,mentorOrigin:'http://127.0.0.1:4176'});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});await c.close();});
  const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),publicKey=keys.publicKey.export({type:'spki',format:'der'}).toString('base64url'),deviceId=randomUUID();
  const issue=async(grants=[scope],ttlMs=300000)=>{
    const token=await c.deviceAuthorization.issue({deviceId,grants,ttlMs});
    await c.root.collection('credentials').doc(hash(token)).update({binding:'p256-v1'});
    await c.root.collection('devices').doc(deviceId).update({binding:'p256-v1',publicKey});return token;
  };
  const get=async(token,target='/api/roster-context')=>{
    const timestamp=String(time),nonce=randomBytes(16).toString('base64url'),signature=sign('sha256',proofMessage({method:'GET',target,token,body:'',timestamp,nonce}),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
    return fetch('http://127.0.0.1:'+server.address().port+target,{headers:{Origin:'http://127.0.0.1:4176',Authorization:'Bearer '+token,'X-Device-Timestamp':timestamp,'X-Device-Nonce':nonce,'X-Device-Signature':signature}});
  };
  return {...c,deviceId,issue,get,advance:ms=>{time+=ms;}};
}
test('Firestore navigation and roster expose only authorized tuples and explicit public fields without changing snapshots',async t=>{
  const c=await fixture(t),future={...scope,serviceSessionId:'demo-pakel-2026-10-23'},token=await c.issue([scope,future]);
  const before=await Promise.all(['sessions','studentPrivateProfiles','defaultMentorAssignments','sessionMentorOverrides','mentorAssignmentSnapshots'].map(async n=>[n,(await c.root.collection(n).get()).docs.map(d=>d.data())]));
  const response=await c.get(token);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  const navigation=await response.json();assert.equal(navigation.contexts.length,2);assert.equal(navigation.contexts[0].mentorName,'Kak Riwayat Fiktif');assert.equal(navigation.contexts[1].mentorName,'Kak Pengganti Fiktif');
  assert.equal(navigation.contexts.every(c=>c.schoolId==='s1'&&c.groupId==='g1'),true);assert.equal(JSON.stringify(navigation).includes('FIKTIF_PRIVAT'),false);
  const roster=await c.get(token,'/api/roster?'+new URLSearchParams(scope));assert.equal(roster.status,200);
  const value=await roster.json();assert.deepEqual(value.students,[{id:'fictional-1',name:'Siswa Fiktif Snapshot',schoolClass:'4A'}]);
  const next=await c.get(token,'/api/roster?'+new URLSearchParams(future));assert.equal((await next.json()).students.length,2);
  for(const change of [{schoolId:'s2'},{groupId:'g2'},{serviceSessionId:'unknown'}])assert.equal((await c.get(token,'/api/roster?'+new URLSearchParams({...scope,...change}))).status,403);
  const after=await Promise.all(before.map(async([n])=>[n,(await c.root.collection(n).get()).docs.map(d=>d.data())]));assert.deepEqual(after,before);
});
test('Invalid, expired and revoked bound credentials deny both metadata and roster; empty permitted rosters are explicit',async t=>{
  const c=await fixture(t),empty={...scope,groupId:'g2'},token=await c.issue([scope,empty],1000),path='/api/roster?'+new URLSearchParams(scope);
  const response=await c.get(token,'/api/roster?'+new URLSearchParams(empty));assert.equal(response.status,200);assert.deepEqual((await response.json()).students,[]);
  for(const target of ['/api/roster-context',path])assert.equal((await c.get(randomBytes(32).toString('base64url'),target)).status,401);
  c.advance(1000);for(const target of ['/api/roster-context',path])assert.equal((await c.get(token,target)).status,401);
  const current=await c.issue();await c.deviceAuthorization.revoke(c.deviceId);
  for(const target of ['/api/roster-context',path])assert.equal((await c.get(current,target)).status,401);
});
