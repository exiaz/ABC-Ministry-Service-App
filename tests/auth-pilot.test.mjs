import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {pilotEnvironment,requireFreePilotPorts,pilotSource,PILOT_PORTS,PILOT_ADDRESS} from '../local-auth-pilot.mjs';
import {demoEnvironment,controllerPath,controlRequest,createController,listen} from '../local-demo.mjs';
import {serviceSignature} from '../local-service.mjs';
import {wrapPilotServer} from '../local-auth-pilot-ui.mjs';
import {createPrototypeServer} from '../server.mjs';
import {jakartaToday} from '../dates.js';
import {runPilot} from '../local-auth-pilot.mjs';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';

test('Pilot uses fresh test namespace, isolated ports and scoped flags; invalid/cloud configuration fails closed',()=>{
  const base={ABC_EMULATOR_IMPORT_DIR:'ignored-regular-snapshot'},first=pilotEnvironment(base),second=pilotEnvironment(base);
  assert.match(first.ABC_FIRESTORE_NAMESPACE,/^test-auth-pilot-/);assert.notEqual(first.ABC_FIRESTORE_NAMESPACE,second.ABC_FIRESTORE_NAMESPACE);
  for(const key of ['ABC_MSA_A1','ABC_MSA_USERNAME_PILOT','ABC_MSA_A2_2','ABC_MSA_A2_3','ABC_MSA_A2_4A','ABC_MSA_A2_4B','ABC_MSA_A2_4C','ABC_MSA_STAGE8','ABC_MSA_STAGE9A','ABC_MSA_STAGE9B1','ABC_MSA_STAGE9B2'])assert.equal(first[key],'1');
  assert.equal(first.ABC_EMULATOR_IMPORT_DIR,undefined);assert.equal(base.ABC_EMULATOR_IMPORT_DIR,'ignored-regular-snapshot');
  assert.equal(first.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8280');assert.equal(first.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9299');
  assert.notEqual(PILOT_ADDRESS,controllerPath());
  for(const base of [{GOOGLE_APPLICATION_CREDENTIALS:'no'},{FIREBASE_TOKEN:'no'},{NODE_ENV:'production'},{GCLOUD_PROJECT:'real-project'},{FIRESTORE_EMULATOR_HOST:'example.com:8080'}])assert.throws(()=>pilotEnvironment(base));
  for(const ports of [[8080,...PILOT_PORTS.slice(1)],[8280,8280,...PILOT_PORTS.slice(2)],PILOT_PORTS.slice(1)])assert.throws(()=>pilotEnvironment({},{ports}));
  const regular=demoEnvironment({});assert.equal(regular.ABC_MSA_A2_3,undefined);assert.equal(regular.ABC_MSA_A2_4A,undefined);assert.equal(regular.ABC_MSA_A2_4B,undefined);assert.equal(regular.ABC_MSA_STAGE8,undefined);assert.equal(regular.ABC_MSA_STAGE9A,undefined);assert.equal(regular.ABC_MSA_STAGE9B1,undefined);assert.equal(regular.ABC_FIRESTORE_NAMESPACE,'local-demo-m2b5b');
});
test('Pilot detects occupied ports and leaves unrelated listener alive',async()=>{
  const server=await listen(net.createServer(socket=>socket.end()),0);
  try{await assert.rejects(requireFreePilotPorts([server.address().port]),/sedang digunakan/);assert.equal(server.listening,true);}finally{await new Promise(resolve=>server.close(resolve));}
});
test('Failed prerequisites stop before provisioning/browser and release the pilot controller',async()=>{
  const prior={...process.env},exitCode=process.exitCode,messages=[],address=controllerPath(path.resolve('pilot-failure-'+randomUUID()));
  try{
    await runPilot({base:{},address,prerequisites:async()=>{throw Error('fictional prerequisite failure');},askPassword:async()=>{assert.fail('Password must not be requested');},open:async()=>{assert.fail('Browser must not open');},log:s=>messages.push(s)});
    assert.equal(process.exitCode,1);assert.ok(messages.some(s=>s.includes('Pilot belum siap')));assert.ok(messages.some(s=>s.includes('Pilot berhenti')));assert.deepEqual({...process.env},prior);
    assert.equal(await controlRequest(address,'status'),null);
  }finally{process.exitCode=exitCode;}
});
test('Windows Start launcher refuses production configuration before starting services',{skip:process.platform!=='win32'},async()=>{
  const result=await new Promise((resolve,reject)=>{
    let output='';const child=spawn('cmd.exe',['/d','/c','Start MSA.cmd'],{cwd:path.resolve(import.meta.dirname,'..'),env:{...process.env,NODE_ENV:'production'},windowsHide:true});
    child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);child.stdin.end('\n');child.once('error',reject);child.once('exit',code=>resolve({code,output}));
  });
  assert.equal(result.code,1);assert.match(result.output,/Mode cloud\/produksi terdeteksi/);
});
test('Pilot fixture uses a current stable session, distinct backup and no historical attendance/private profiles',()=>{
  const source=pilotSource(),session=source.serviceSessions.find(v=>v.id==='fictional-a23-current');
  assert.equal(session.date,jakartaToday());assert.deepEqual(session.groupIds,['g1','g2']);assert.deepEqual(source.sessions,[]);assert.equal(source.studentPrivateProfiles,undefined);
  assert.equal(source.defaultMentorAssignments.find(v=>v.groupId==='g2').mentorId,'fictional-substitute');
  assert.equal(source.groups.find(v=>v.id==='g1').name,'Hosea');assert.equal(source.groups.find(v=>v.id==='g2').name,'Obaja');
});

test('Pilot reuse requires matching portal mode, source signature and ports; incompatible instances stay alive',async()=>{
  const signature=await serviceSignature({}),address=controllerPath(path.resolve('pilot-reuse-'+randomUUID()));
  let status={phase:'ready',protocol:1,unified:true,signature,ports:[...PILOT_PORTS]},stops=0,opens=0;
  const controller=await createController(address,command=>{if(command==='stop')stops++;return status;});
  const attempt=()=>runPilot({base:{},address,unified:true,open:async()=>{opens++;},log:()=>{},prerequisites:async()=>assert.fail('Reuse must not provision or start emulators')});
  try{
    await attempt();assert.equal(opens,1);
    const matching={...status};
    for(const incompatible of [{phase:'ready'},{...matching,unified:false},{...matching,signature:'0'.repeat(64)},{...matching,protocol:0},{...matching,ports:[...PILOT_PORTS].reverse()}]){
      status=incompatible;await assert.rejects(attempt(),/mode, versi aplikasi atau port berbeda/);assert.equal(opens,1);assert.equal(stops,0);assert.deepEqual(await controlRequest(address,'status'),status);
    }
    status={...matching,phase:'starting'};await attempt();assert.equal(opens,1);assert.equal(stops,0);
  }finally{await new Promise(resolve=>controller.close(resolve));}
});
test('Pilot mentor root is gated personal login while regular mentor root and launchers remain legacy',async()=>{
  const prior={...process.env},env=pilotEnvironment({});Object.assign(process.env,env);
  const options={mentorOrigin:'http://127.0.0.1:4276',adminOrigin:'http://127.0.0.1:4277'};
  const pilot=await listen(wrapPilotServer(createPrototypeServer({mentorMode:true}),{...options,mentor:true}),0),regular=await listen(createPrototypeServer({mentorMode:true}),0);
  try{
    const read=async(server,route='/')=>{const r=await fetch('http://127.0.0.1:'+server.address().port+route);return {status:r.status,body:await r.text()};};
    assert.match((await read(pilot)).body,/id="account-login"/);assert.match((await read(pilot)).body,/PILOT LOKAL/);
    assert.match((await read(regular)).body,/id="pairing-root"/);assert.doesNotMatch((await read(regular)).body,/pilot-nav/);
    assert.match((await read(pilot,'/pilot.html')).body,/peninjau.pilot/);assert.equal((await read(regular,'/pilot.html')).status,404);
    delete process.env.ABC_MSA_A2_4B;assert.doesNotMatch((await read(pilot)).body,/Lupa kata sandi/);assert.equal((await read(pilot,'/account-recovery.html')).status,404);process.env.ABC_MSA_A2_4B='1';
    delete process.env.ABC_MSA_A2_3;assert.equal((await read(pilot)).status,404);
    const launcher=await readFile(new URL('../Start MSA.cmd',import.meta.url),'utf8');assert.match(launcher,/local-msa.mjs/);assert.doesNotMatch(launcher,/local-demo.mjs/);
  }finally{
    await Promise.all([pilot,regular].map(s=>new Promise(resolve=>{s.close(resolve);s.closeAllConnections();})));
    for(const key of Object.keys(process.env))if(!(key in prior))delete process.env[key];Object.assign(process.env,prior);
  }
});
