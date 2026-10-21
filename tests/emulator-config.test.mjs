import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {once} from 'node:events';
import {emulatorConfig,repositoryMode,DEMO_PROJECT_ID} from '../backend/emulator-config.mjs';
import {createConfiguredRepositories} from '../backend/configured-repositories.mjs';
import {createFirestoreEmulatorRepositories} from '../backend/firestore-emulator.mjs';

const valid={ABC_ROSTER_ADAPTER:'firestore-emulator',ABC_FIREBASE_PROJECT_ID:DEMO_PROJECT_ID,FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080'};
test('Emulator configuration rejects missing mode/project/host, cloud credentials, remote targets and invalid namespaces',()=>{
  assert.equal(repositoryMode({}),'in-memory');assert.throws(()=>repositoryMode({ABC_ROSTER_ADAPTER:'production'}));
  assert.deepEqual(emulatorConfig(valid),{projectId:DEMO_PROJECT_ID,host:'127.0.0.1:8080',port:8080,namespace:'development'});
  for(const change of [{ABC_ROSTER_ADAPTER:undefined},{ABC_FIREBASE_PROJECT_ID:undefined},{ABC_FIREBASE_PROJECT_ID:'real-project'},{FIRESTORE_EMULATOR_HOST:undefined},{FIRESTORE_EMULATOR_HOST:'firestore.googleapis.com:443'},{FIRESTORE_EMULATOR_HOST:'192.168.1.1:8080'},{FIRESTORE_EMULATOR_HOST:'http://127.0.0.1:8080'},{FIRESTORE_EMULATOR_HOST:'localhost:8080'},{FIRESTORE_EMULATOR_HOST:'127.0.0.1:65536'},{FIRESTORE_EMULATOR_HOST:'127.0.0.1:0'},{GOOGLE_APPLICATION_CREDENTIALS:'forbidden.json'},{FIREBASE_TOKEN:'not-a-real-token'},{GCLOUD_PROJECT:'real-project'},{GOOGLE_CLOUD_PROJECT:'real-project'},{ABC_FIRESTORE_NAMESPACE:'../escape'}]){
    assert.throws(()=>emulatorConfig({...valid,...change}));
  }
});

test('Default remains empty in-memory and explicitly enabled missing/unavailable emulator fails without fallback',async()=>{
  const previous={...process.env};
  try{
    delete process.env.ABC_ROSTER_ADAPTER;
    const memory=await createConfiguredRepositories();
    assert.equal(await memory.credentials.authenticate('Bearer ABC2026'),null);
    assert.equal(await memory.repository.read({schoolId:'s1',groupId:'g1',serviceSessionId:'x'}),null);await memory.close();
    process.env.ABC_ROSTER_ADAPTER='firestore-emulator';delete process.env.FIRESTORE_EMULATOR_HOST;
    await assert.rejects(createConfiguredRepositories());
    const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');
    const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
    Object.assign(process.env,valid,{FIRESTORE_EMULATOR_HOST:'127.0.0.1:'+port});
    await assert.rejects(createFirestoreEmulatorRepositories(),/Emulator lokal tidak tersedia/);
  }finally{
    for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];
    Object.assign(process.env,previous);
  }
});
