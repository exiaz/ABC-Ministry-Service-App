import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {emulatorFixture} from './fixture.mjs';
import {fictionalRosterData,scope} from '../fixtures/roster.mjs';
import {createAuthorizedRosterRepository} from '../../backend/repositories.mjs';
import {createRosterServer} from '../../backend/server.mjs';

const route=values=>'/api/roster?'+new URLSearchParams(values);
async function fixture(t,source=fictionalRosterData(),now=Date.now){
  const context=await emulatorFixture({source,now});t.after(context.close);return context;
}
async function startAPI(t,adapters){
  const server=createRosterServer(adapters);server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  return 'http://127.0.0.1:'+server.address().port;
}
async function apiProcess(t,namespace){
  const child=fork(fileURLToPath(new URL('./server-process.mjs',import.meta.url)),[],{env:{...process.env,ABC_FIRESTORE_NAMESPACE:namespace},stdio:['ignore','ignore','pipe','ipc'],windowsHide:true});
  let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk;});
  const port=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{child.kill();reject(Error('API uji tidak siap. '+stderr));},15000);
    child.once('message',message=>{clearTimeout(timer);resolve(message.port);});
    child.once('exit',code=>{clearTimeout(timer);reject(Error('API uji berhenti: '+code+' '+stderr));});
    child.once('error',reject);
  });
  const stop=async()=>{
    if(child.exitCode!==null)return;
    const finished=once(child,'exit');child.send('stop');
    const timer=setTimeout(()=>child.kill(),5000);try{await finished;}finally{clearTimeout(timer);}
  };
  t.after(stop);return {base:'http://127.0.0.1:'+port,stop};
}

test('Firestore namespaces isolate roster, hashed credentials and grants',async t=>{
  const a=await fixture(t),b=await fixture(t,{schools:[],groups:[],students:[],serviceSessions:[],sessions:[]});
  const token=await a.credentials.issue({grants:[scope]});
  assert.equal(await b.credentials.authenticate('Bearer '+token),null);assert.equal(await b.repository.read(scope),null);
  assert.notEqual(a.config.namespace,b.config.namespace);
  const stored=await a.root.collection('credentials').get();assert.equal(stored.size,1);
  assert.equal(stored.docs[0].id,createHash('sha256').update(token).digest('hex'));
  assert.equal(JSON.stringify(stored.docs[0].data()).includes(token),false);
  assert.deepEqual(stored.docs[0].data().grants,[scope]);
  const student=await a.root.collection('students').doc('fictional-1').get();assert.equal(student.data().id,'fictional-1');
});

test('A real API process restart preserves roster and grant validity, then preserves revocation',async t=>{
  const context=await fixture(t),token=await context.credentials.issue({grants:[scope]});
  const headers={Authorization:'Bearer '+token};
  const first=await apiProcess(t,context.config.namespace);
  const firstResponse=await fetch(first.base+route(scope),{headers});assert.equal(firstResponse.status,200);
  const original=await firstResponse.json();await first.stop();
  const second=await apiProcess(t,context.config.namespace);
  const response=await fetch(second.base+route(scope),{headers});assert.equal(response.status,200);assert.deepEqual(await response.json(),original);
  await context.credentials.revoke(token);assert.equal((await fetch(second.base+route(scope),{headers})).status,401);
  await second.stop();
  const third=await apiProcess(t,context.config.namespace);
  assert.equal((await fetch(third.base+route(scope),{headers})).status,401);
});

test('Firestore API enforces authorization, field filtering and static asset isolation',async t=>{
  const context=await fixture(t),base=await startAPI(t,context);
  const token=await context.credentials.issue({grants:[scope]}),headers={Authorization:'Bearer '+token};
  assert.equal((await fetch(base+route(scope))).status,401);
  assert.equal((await fetch(base+route({...scope,admin:'true'}),{headers:{Cookie:'adminUnlocked=true'}})).status,401);
  assert.equal((await fetch(base+route({...scope,groupId:'g2'}),{headers})).status,403);
  const response=await fetch(base+route(scope),{headers});assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(await response.json(),{...scope,students:[{id:'fictional-1',name:'Siswa Fiktif Snapshot',schoolClass:'4A'}]});
  for(const target of ['/data.js','/backend/firestore-emulator.mjs','/tests/emulator/fixture.mjs','/firebase.json','/.firebaserc','/firestore.rules']){
    assert.equal((await fetch(base+target,{headers})).status,404);
  }
});

test('Rules deny direct unauthenticated browser-style reads and writes to emulator data',async t=>{
  const context=await fixture(t);
  const url='http://'+context.config.host+'/v1/projects/'+context.config.projectId+'/databases/(default)/documents/emulatorNamespaces/'+context.config.namespace+'/studentPrivateProfiles/fictional-1';
  const response=await fetch(url);assert.equal(response.status,403);
  assert.equal((await response.json()).error.status,'PERMISSION_DENIED');
  const write=await fetch(url,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields:{guardianName:{stringValue:'GAGAL_FIKTIF'}}})});
  assert.equal(write.status,403);
});

test('Roster reads do not rewrite stored attendance snapshots or private profiles',async t=>{
  const context=await fixture(t);
  const batch=context.root.collection('sessions').doc('fictional-batch'),profile=context.root.collection('studentPrivateProfiles').doc('fictional-1');
  const before=[(await batch.get()).data(),(await profile.get()).data()];
  const token=await context.credentials.issue({grants:[scope]});
  const authorized=createAuthorizedRosterRepository(context);
  await authorized.readAuthorized('Bearer '+token,scope);
  await context.repository.read({...scope,serviceSessionId:'demo-pakel-2026-10-23'});
  assert.deepEqual([(await batch.get()).data(),(await profile.get()).data()],before);
  assert.equal((await context.root.collection('sessions').get()).size,1);
});

test('Expired and malformed stored credentials fail closed without granting wildcard access',async t=>{
  let now=1000;const context=await fixture(t,fictionalRosterData(),()=>now);
  const token=await context.credentials.issue({grants:[scope],ttlMs:10});now=1010;
  assert.equal(await context.credentials.authenticate('Bearer '+token),null);
  const other=await context.credentials.issue({grants:[scope]});
  const ref=context.root.collection('credentials').doc(createHash('sha256').update(other).digest('hex'));
  await ref.update({grants:[{...scope,groupId:'*'}]});
  assert.equal(await context.credentials.authenticate('Bearer '+other),null);
});
