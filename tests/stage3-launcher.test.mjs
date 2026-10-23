import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {PassThrough} from 'node:stream';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {pathToFileURL} from 'node:url';
import {spawnManagedEmulator,stopManagedEmulator} from '../local-emulator.mjs';
import {checkPrerequisites} from '../local-prerequisites.mjs';
import {verifySnapshotContents} from '../local-snapshots.mjs';
import {saveSnapshot,previousSnapshot,interruptedSnapshot,snapshotDirectory,confirmInterrupted,runDemo,controllerPath,controlRequest,waitFor,stopDemo,demoEnvironment} from '../local-demo.mjs';
import {fakeSnapshot} from './fixtures/snapshot.mjs';

async function folder(t){
  const base=await snapshotDirectory(),state=await mkdtemp(path.join(base,'test-stage3-'));
  t.after(async()=>{assert.equal(path.dirname(state),base);await rm(state,{recursive:true});});return state;
}
const persist=state=>saveSnapshot(state,{verify:async()=>{},request:async(url,options)=>fakeSnapshot(JSON.parse(options.body).path)});

test('Dependencies fail before launch for missing packages, unsupported Node/Java and missing emulator cache',async t=>{
  const root=await folder(t);
  await assert.rejects(checkPrerequisites({root,nodeVersion:'20.0.0'}),/Node.js 22/);
  await assert.rejects(checkPrerequisites({root}),/npm.cmd ci/);
  for(const file of ['node_modules/firebase-admin/package.json','node_modules/firebase-tools/lib/bin/firebase.js','node_modules/firebase-tools/lib/emulator/downloadableEmulatorInfo.json']){await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),'{}');}
  const java=version=>()=>({status:0,stderr:'openjdk version "'+version+'.0.1"',stdout:''});
  await assert.rejects(checkPrerequisites({root,run:java(17)}),/JDK 21/);
  await writeFile(path.join(root,'node_modules/firebase-tools/lib/emulator/downloadableEmulatorInfo.json'),JSON.stringify({firestore:{downloadPathRelativeToCacheDir:'fictional.jar'}}));
  await assert.rejects(checkPrerequisites({root,run:java(21),env:{FIREBASE_EMULATORS_PATH:root}}),/Cache/);
  await writeFile(path.join(root,'fictional.jar'),'test');await checkPrerequisites({root,run:java(21),env:{FIREBASE_EMULATORS_PATH:root}});
});

test('Snapshot history/checksums preserve the last pointer after corrupt or partial exports and detect later tampering',async t=>{
  const state=await folder(t),first=await persist(state),second=await persist(state);
  assert.notEqual(first,second);assert.equal(await previousSnapshot(state),second);
  assert.equal((await verifySnapshotContents(first)).sealed,true);
  assert.equal((await readdir(state)).filter(name=>name.startsWith('snapshot-')).length,2);
  await assert.rejects(saveSnapshot(state,{verify:async()=>{},request:async(url,options)=>{const target=JSON.parse(options.body).path;await fakeSnapshot(target);await rm(path.join(target,'auth_export/accounts.json'));}}));
  assert.equal(await previousSnapshot(state),second);
  await writeFile(path.join(second,'auth_export/config.json'),'{"changed":true}');
  await assert.rejects(previousSnapshot(state),/tidak dapat dibaca/);
  assert.equal((await verifySnapshotContents(first)).sealed,true);
});

test('Missing snapshot pointer or a removed required manifest never becomes an empty-data startup',async t=>{
  const state=await folder(t),saved=await persist(state),pointer=await readFile(path.join(state,'latest.json'));
  await rm(path.join(state,'latest.json'));await assert.rejects(previousSnapshot(state),/data kosong tidak dibuat/);
  await writeFile(path.join(state,'latest.json'),pointer);await rm(path.join(saved,'snapshot-integrity.json'));
  await assert.rejects(previousSnapshot(state),/tidak dapat dibaca/);
});

test('Parent disconnect requests one graceful child shutdown without discovering or killing other processes',async t=>{
  const state=await folder(t),closed=path.join(state,'closed.json'),module=pathToFileURL(path.resolve('local-emulator.mjs')).href;
  const script='process.on("SIGINT",()=>{require("node:fs").writeFileSync('+JSON.stringify(closed)+',"{}");process.exit(0)});process.send({ready:true});setInterval(()=>{},1000)';
  const supervisor=spawn(process.execPath,['--input-type=module','-e','import {spawnManagedEmulator} from '+JSON.stringify(module)+';const child=spawnManagedEmulator(["-e",'+JSON.stringify(script)+']);child.once("message",()=>process.exit(0));'],{windowsHide:true,stdio:'ignore'});
  const [code]=await once(supervisor,'exit');assert.equal(code,0);
  await waitFor(async()=>{try{return (await readFile(closed,'utf8'))==='{}';}catch{return false;}},{timeout:5000});
});

test('An abnormal owned-child shutdown cannot be reported as PASS',async()=>{
  const child=spawnManagedEmulator(['-e','process.on("SIGINT",()=>process.exit(7));process.send({ready:true});setInterval(()=>{},1000)']);
  await once(child,'message');await assert.rejects(stopManagedEmulator(child),/tidak normal/);assert.equal(child.exitCode,7);
});

test('Simple Stage 3 command reports FAIL with exit code 1 when Java prerequisites are missing',async()=>{
  const child=spawn(process.execPath,['tests/stage3.mjs'],{env:{...process.env,JAVA_HOME:path.resolve('missing-jdk-'+randomUUID())},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',value=>output+=value);child.stderr.on('data',value=>output+=value);
  const [code]=await once(child,'exit');assert.equal(code,1);assert.match(output,/FAIL/);assert.match(output,/JDK 21/);
});

test('Interrupted recovery requires explicit confirmation, preserves history and prefers a complete rescue export',async t=>{
  const state=await folder(t),first=await persist(state),rescueName='snapshot-'+Date.now()+'-'+randomUUID();
  await fakeSnapshot(path.join(state,rescueName));await writeFile(path.join(state,'active.json'),JSON.stringify({rescueName}));
  await assert.rejects(interruptedSnapshot(state,{confirm:async()=>false}),/dibatalkan/);assert.equal(await previousSnapshot(state),first);
  assert.equal(await interruptedSnapshot(state,{confirm:async name=>{assert.equal(name,rescueName);return true;}}),path.join(state,rescueName));
  assert.equal((await verifySnapshotContents(path.join(state,rescueName))).sealed,true);
  const input=new PassThrough(),output=new PassThrough();input.isTTY=true;output.isTTY=true;output.on('data',()=>{});
  const pending=confirmInterrupted(rescueName,{input,output});input.write('\n');assert.equal(await pending,false);input.destroy();output.destroy();
  const empty=await folder(t);await writeFile(path.join(empty,'active.json'),JSON.stringify({rescueName}));
  await assert.rejects(interruptedSnapshot(empty,{confirm:()=>assert.fail('Incomplete data cannot be restored.')}),/belum ada snapshot lengkap/);
});

test('Stopping during prerequisites cancels startup without opening pages or leaking the controller',async t=>{
  const state=await folder(t),address=controllerPath(state),input=new PassThrough(),output=new PassThrough(),original={...process.env};
  let release,started;const gate=new Promise(resolve=>{release=resolve;}),ready=new Promise(resolve=>{started=resolve;});
  try{
    const running=runDemo({address,input,output,stateDirectory:async()=>state,environment:()=>demoEnvironment({}),prerequisites:async()=>{started();await gate;},open:()=>assert.fail('Browser must not open.'),log:()=>{}});
    await ready;const stopping=stopDemo({address,log:()=>{}});await waitFor(async()=>(await controlRequest(address,'status'))?.phase==='stopping',{timeout:3000});release();await stopping;await running;
    assert.equal(await controlRequest(address,'status'),null);
  }finally{release();input.destroy();output.destroy();for(const key of Object.keys(process.env))if(!(key in original))delete process.env[key];Object.assign(process.env,original);process.exitCode=undefined;}
});
