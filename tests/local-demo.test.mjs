import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {PassThrough} from 'node:stream';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {demoEnvironment,controllerPath,createController,controlRequest,portOccupied,listen,validHub,previousSnapshot,saveSnapshot,snapshotDirectory,stopOwnedEmulator,stopDemo,runDemo} from '../local-demo.mjs';
import {hiddenInput} from '../provision-demo.mjs';

test('Launcher fixes the shared demo configuration and rejects cloud credentials and projects',()=>{
  const env=demoEnvironment({ABC_ADMIN_UIDS:'[]',ABC_FIRESTORE_NAMESPACE:'other',ABC_EMULATOR_IMPORT_DIR:'stale'});
  assert.equal(env.ABC_FIRESTORE_NAMESPACE,'local-demo-m2b5b');assert.equal(env.ABC_ADMIN_UIDS,'["demo-admin-local"]');assert.equal(env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8080');assert.equal(env.ABC_ADMIN_PORT,'4177');assert.equal(env.ABC_EMULATOR_IMPORT_DIR,undefined);
  for(const base of [{GOOGLE_APPLICATION_CREDENTIALS:'key.json'},{FIREBASE_TOKEN:'secret'},{NODE_ENV:'production'},{GCLOUD_PROJECT:'real-project'},{ABC_FIREBASE_PROJECT_ID:'other'}])assert.throws(()=>demoEnvironment(base));
});
test('Local IPC handles duplicate launch and stop without provisioning, opening another server or trusting a PID file',async t=>{
  const address=controllerPath(path.resolve('ipc-test-'+randomUUID()));let stopped=0,opened=0;
  const server=await createController(address,command=>{if(command==='stop')stopped++;return {phase:'starting'};});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  assert.equal((await controlRequest(address,'status')).phase,'starting');assert.equal((await controlRequest(address,'untrusted')).phase,'invalid');
  await runDemo({address,open:async()=>{opened++;},log:()=>{},environment:()=>{throw Error('Duplikasi tidak boleh memulai setup.');}});assert.equal(opened,0);
  assert.equal((await controlRequest(address,'stop')).phase,'starting');assert.equal(stopped,1);
  assert.equal(await controlRequest(controllerPath(path.resolve('missing-'+randomUUID())),'status'),null);
});
test('Port detection identifies an occupied service and never terminates it',async t=>{
  const server=await listen(createServer(socket=>socket.end()),0),port=server.address().port;t.after(()=>new Promise(resolve=>server.close(resolve)));
  assert.equal(await portOccupied(port),true);assert.equal(server.listening,true);
});
test('An unknown occupied application port aborts launch before provisioning and leaves the service alive',async t=>{
  const original={...process.env},exitCode=process.exitCode,server=await listen(createServer(socket=>socket.end()),0),messages=[],address=controllerPath(path.resolve('port-conflict-'+randomUUID()));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  try{
    await runDemo({ports:[server.address().port],address,environment:()=>demoEnvironment({}),stateDirectory:async()=>'',prepare:()=>{throw Error('Provisioning tidak boleh berjalan.');},open:()=>{throw Error('Browser tidak boleh dibuka.');},log:s=>messages.push(s)});
    assert.match(messages.join('\n'),/sudah digunakan/);assert.equal(server.listening,true);assert.equal(await controlRequest(address,'status'),null);
  }finally{for(const key of Object.keys(process.env))if(!(key in original))delete process.env[key];Object.assign(process.env,original);process.exitCode=exitCode;}
});
test('Emulator reuse requires a matching project locator, PID, exact loopback ports and listeners',()=>{
  const locator={pid:123,origins:['http://127.0.0.1:4400']},hub={pid:123,host:'127.0.0.1',port:4400};
  const mapping=Object.fromEntries([['hub',4400],['auth',9099],['firestore',8080]].map(([name,port])=>[name,{host:'127.0.0.1',port,listen:[{address:'127.0.0.1',port}]}]));
  assert.equal(validHub(locator,hub,mapping),true);assert.equal(validHub({...locator,pid:124},hub,mapping),false);assert.equal(validHub(locator,{...hub,host:'localhost'},mapping),false);
  const exposed=structuredClone(mapping);exposed.auth.listen[0].address='0.0.0.0';assert.equal(validHub(locator,hub,exposed),false);
});
test('Snapshot export updates the pointer only after a complete Auth/Firestore export; invalid, failed and traversal snapshots fail closed',async()=>{
  const state=await snapshotDirectory(),folder=await mkdtemp(path.join(state,'test-'));
  try{
    assert.equal(await previousSnapshot(folder),null);let exports=0;
    const saved=await saveSnapshot(folder,{verify:async()=>{},request:async(url,options)=>{
      const body=JSON.parse(options.body);assert.deepEqual(body.targets,['auth','firestore']);assert.equal(url,'http://127.0.0.1:4400/_admin/export');
      await mkdir(path.join(body.path,'auth_export'),{recursive:true});await mkdir(path.join(body.path,'firestore_export'));await writeFile(path.join(body.path,'firebase-export-metadata.json'),JSON.stringify({auth:{path:'auth_export'},firestore:{path:'firestore_export'}}));exports++;
    }});
    assert.equal(await previousSnapshot(folder),saved);assert.equal(exports,1);const pointer=await readFile(path.join(folder,'latest.json'),'utf8');
    await assert.rejects(saveSnapshot(folder,{verify:async()=>{},request:async()=>{throw Error('Export gagal');}}));assert.equal(await readFile(path.join(folder,'latest.json'),'utf8'),pointer);
    await writeFile(path.join(folder,'latest.json'),JSON.stringify({name:'../../outside'}));await assert.rejects(previousSnapshot(folder),/tidak dapat dibaca/);
  }finally{assert.equal(path.resolve(folder).startsWith(path.resolve(state)+path.sep),true);await rm(folder,{recursive:true});}
});
test('Stopping during hidden password entry clears input and restores the terminal without echoing it',async()=>{
  const input=new PassThrough(),output=new PassThrough(),abort=new AbortController();input.isTTY=true;output.isTTY=true;input.setRawMode=value=>{input.isRaw=value;};
  let printed='';output.on('data',data=>printed+=data);const pending=hiddenInput('Password: ',{input,output,signal:abort.signal}),secret=randomBytes(16).toString('base64url');input.write(secret);abort.abort();await assert.rejects(pending,/dibatalkan/);assert.equal(input.isRaw,false);assert.equal(printed.includes(secret),false);input.destroy();output.destroy();
});
test('Shutdown only targets a live owned child; unrelated listeners remain running',async t=>{
  const external=await listen(createServer(socket=>socket.end()),0);t.after(()=>new Promise(resolve=>external.close(resolve)));
  const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{windowsHide:true,stdio:'ignore'});await once(child,'spawn');
  await stopOwnedEmulator(child);await new Promise(resolve=>{if(child.exitCode!==null||child.signalCode!==null)resolve();else child.once('exit',resolve);});assert.equal(external.listening,true);
  await stopOwnedEmulator(child);await stopOwnedEmulator(undefined);
});
test('Stop command leaves manual services alone when no launcher exists',async()=>{
  const messages=[];await stopDemo({address:controllerPath(path.resolve('none-'+randomUUID())),log:s=>messages.push(s)});assert.match(messages[0],/Layanan manual tidak diubah/);
});
