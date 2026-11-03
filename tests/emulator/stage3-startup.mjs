import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readFile,rm,access} from 'node:fs/promises';
import {PassThrough} from 'node:stream';
import {createServer} from 'node:net';
import {runDemo,demoEnvironment,listen,verifyHub,waitFor,portOccupied,controllerPath,controlRequest,stopDemo,saveSnapshot,previousSnapshot,snapshotDirectory} from '../../local-demo.mjs';
import {spawnManagedEmulator} from '../../local-emulator.mjs';
import {DEMO_ADMIN} from '../../provision-demo.mjs';

test('Owned cold start/restart verifies dependencies and readiness, snapshots before graceful stop, and preserves the chosen password',{timeout:150000},async()=>{
  const original={...process.env},ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),base=await snapshotDirectory(),state=await mkdtemp(path.join(base,'test-owned-')),temp=path.join(state,'temp');await mkdir(temp);
  const reservations=await Promise.all(Array.from({length:5},()=>listen(createServer(),0))),ports=reservations.map(s=>s.address().port);await Promise.all(reservations.map(s=>new Promise(resolve=>s.close(resolve))));
  const [firestore,auth,hub,logging,websocket]=ports,config=path.join(state,'firebase.json'),address=controllerPath(state),input=new PassThrough(),output=new PassThrough(),logs=[];
  await writeFile(config,JSON.stringify({firestore:{rules:path.join(ROOT,'firestore.rules')},emulators:{firestore:{host:'127.0.0.1',port:firestore,websocketPort:websocket},auth:{host:'127.0.0.1',port:auth},hub:{host:'127.0.0.1',port:hub},logging:{host:'127.0.0.1',port:logging},ui:{enabled:false},singleProjectMode:true}}));
  const env={...demoEnvironment(original),TEMP:temp,TMP:temp,FIRESTORE_EMULATOR_HOST:'127.0.0.1:'+firestore,FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:'+auth,ABC_FIRESTORE_NAMESPACE:'test-owned-'+randomUUID()},checkHub=()=>verifyHub({ports,locatorDirectory:temp});
  const password=randomBytes(24).toString('base64url');let prompts=0,opened=0,child,running,failExport=false;
  const request=async(url,options={})=>{const response=await fetch(url.replace('http://127.0.0.1:4400','http://127.0.0.1:'+hub),{...options,signal:AbortSignal.timeout(options.timeout??3000)});assert.equal(response.ok,true);return response.json();};
  const settings={address,input,output,ports:[0,0,0],emulatorPorts:ports,environment:()=>env,checkHub,stateDirectory:async()=>state,askPassword:async()=>{assert.equal(++prompts,1);return password;},persist:async state=>{if(failExport){failExport=false;throw Error('Fictional export interruption');}return saveSnapshot(state,{verify:checkHub,request});},launchEmulator:({args,env})=>{args[args.indexOf('--config')+1]=config;child=spawnManagedEmulator(args,{cwd:state,env});return child;},open:async()=>{await checkHub();assert.equal((await controlRequest(address,'status')).phase,'ready');opened++;},log:message=>logs.push(message)};
  try{
    running=runDemo(settings);await waitFor(async()=>(await controlRequest(address,'status'))?.phase==='ready',{timeout:45000});
    await waitFor(async()=>opened===1,{timeout:5000});assert.equal(prompts,1);const first=await previousSnapshot(state);assert.ok(first);
    await runDemo(settings);assert.equal(opened,2);assert.equal(prompts,1);
    const admin='http://127.0.0.1:'+(await controlRequest(address,'status')).ports[1],login=value=>fetch(admin+'/api/admin/login',{method:'POST',headers:{Origin:admin,'Content-Type':'application/json'},body:JSON.stringify({email:DEMO_ADMIN.email,password:value})});
    assert.equal((await login(password)).status,200);assert.equal((await login(randomBytes(24).toString('base64url'))).status,401);
    failExport=true;await assert.rejects(stopDemo({address,log:()=>{}}),/Data belum tersimpan/);assert.equal(child.exitCode,null);assert.equal(await previousSnapshot(state),first);assert.equal((await controlRequest(address,'status')).phase,'save-error');
    await stopDemo({address,log:()=>{}});await running;running=null;
    assert.equal(child.exitCode,0);assert.notEqual(await previousSnapshot(state),first);await assert.rejects(access(path.join(state,'active.json')));
    assert.equal((await readFile(path.join(first,'snapshot-integrity.json'),'utf8')).includes('sha256'),true);
    await waitFor(async()=>!(await Promise.all(ports.map(portOccupied))).some(Boolean),{timeout:10000});
    running=runDemo(settings);await waitFor(async()=>(await controlRequest(address,'status'))?.phase==='ready',{timeout:45000});assert.equal(prompts,1);
    const restarted='http://127.0.0.1:'+(await controlRequest(address,'status')).ports[1];
    assert.equal((await fetch(restarted+'/api/admin/login',{method:'POST',headers:{Origin:restarted,'Content-Type':'application/json'},body:JSON.stringify({email:DEMO_ADMIN.email,password})})).status,200);
    await stopDemo({address,log:()=>{}});await running;running=null;assert.equal(child.exitCode,0);
    assert.equal(logs.join('\n').includes(password),false);
  }finally{
    if(running){await stopDemo({address,log:()=>{}});await running;}input.destroy();output.destroy();
    assert.equal(path.dirname(state),base);await rm(state,{recursive:true});
    for(const key of Object.keys(process.env))if(!(key in original))delete process.env[key];Object.assign(process.env,original);
  }
});
