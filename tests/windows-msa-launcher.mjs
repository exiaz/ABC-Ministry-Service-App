import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {controlRequest,waitFor,portOccupied} from '../local-demo.mjs';
import {PILOT_ADDRESS,PILOT_PORTS} from '../local-auth-pilot.mjs';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';

const root=path.resolve(import.meta.dirname,'..');
const cmd=file=>{
  const child=spawn('cmd.exe',['/d','/c',file],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe']});let output='';
  child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
  const exited=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code));});
  return {child,exited,output:()=>output};
};
const shellExecute=file=>new Promise((resolve,reject)=>{
  // ShellExecute for the existing .cmd association, same launch action used by
  // Explorer double-click. Hidden console avoids disrupting the operator.
  const child=execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop'; Start-Process -FilePath ([Console]::In.ReadLine()) -WindowStyle Hidden"],{cwd:root,windowsHide:true},error=>error?reject(Error('Windows ShellExecute failed')):resolve());
  child.stdin.end(path.join(root,file)+'\n');
});

test('Windows CMD and ShellExecute: no terminal password input, ready portal, duplicate Start and Stop/Start',{skip:process.platform!=='win32',timeout:240000},async()=>{
  assert.equal(await controlRequest(PILOT_ADDRESS,'status'),null,'Do not interfere with an existing pilot');
  const evidence=[],first=cmd('Start MSA.cmd');
  const ownerUid=async()=>{
    const prior=process.env.FIREBASE_AUTH_EMULATOR_HOST;process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9299';
    const app=initializeApp({projectId:'demo-abc-attendance'},'windows-launcher-check-'+Date.now());
    try{const users=await getAuth(app).listUsers();const owner=users.users.find(user=>user.uid.startsWith('pilot-reviewer-'));assert.ok(owner);return owner.uid;}
    finally{await deleteApp(app);if(prior===undefined)delete process.env.FIREBASE_AUTH_EMULATOR_HOST;else process.env.FIREBASE_AUTH_EMULATOR_HOST=prior;}
  };
  const ready=async()=>{let result;await waitFor(async()=>{const status=await controlRequest(PILOT_ADDRESS,'status');if(status?.phase==='ready'){result=status;return true;}return false;},{timeout:120000});return result;};
  const stopped=async()=>waitFor(async()=>!(await Promise.all(PILOT_PORTS.map(portOccupied))).some(Boolean),{timeout:20000});
  try{
    const status=await ready();assert.equal(status.unified,true);
    const response=await fetch('http://127.0.0.1:4277/');assert.equal(response.status,200);assert.ok((await response.text()).includes('portal-welcome'));
    assert.equal(/Input tidak|Buat kata sandi|Ulangi password/.test(first.output()),false);
    assert.ok(first.output().includes('Pilot siap'));evidence.push('CMD cold start: ready without writing any stdin; Opsi G portal HTTP 200');
    const firstOwnerUid=await ownerUid();
    const duplicate=cmd('Start MSA.cmd');duplicate.child.stdin.end();assert.equal(await duplicate.exited,0);assert.ok(duplicate.output().includes('Pilot sudah berjalan'));
    assert.equal((await controlRequest(PILOT_ADDRESS,'status')).signature,status.signature);evidence.push('Duplicate CMD Start: compatible existing instance reused');
    const stop=cmd('Stop MSA.cmd');stop.child.stdin.end();assert.equal(await stop.exited,0);assert.equal(await first.exited,0);await stopped();evidence.push('Stop CMD: all eight owned ports released');
    await shellExecute('Start MSA.cmd');const restarted=await ready();assert.equal(restarted.unified,true);
    assert.equal((await fetch('http://127.0.0.1:4277/')).status,200);
    const setup=await fetch('http://127.0.0.1:4277/api/local-account-setup?username=momor1n',{headers:{Origin:'http://127.0.0.1:4277','X-MSA-Local-Setup':'1'}});
    assert.equal((await setup.json()).state,'idle');assert.notEqual(await ownerUid(),firstOwnerUid);evidence.push('ShellExecute .cmd association: restart ready, new owner UID and credential setup fresh/idle');
    const native=await fetch('http://127.0.0.1:4277/api/local-account-setup',{method:'POST',headers:{Origin:'http://127.0.0.1:4277','Content-Type':'application/json','X-MSA-Local-Setup':'1'},body:JSON.stringify({username:'momor1n'})});assert.equal(native.status,202);await native.text();
    await new Promise(resolve=>setTimeout(resolve,1500));
    await shellExecute('Stop MSA.cmd');await stopped();evidence.push('ShellExecute Stop with native setup pending: owned dialog drained and all eight owned ports released');
    const folder=path.resolve('.emulator-data/windows-msa-launcher');await mkdir(folder,{recursive:true});
    await writeFile(path.join(folder,'evidence.json'),JSON.stringify({platform:process.platform,method:'Actual cmd.exe and Windows ShellExecute .cmd association; no physical mouse double-click',checks:evidence,manualNativePasswordEntry:false},null,2));
    console.log(evidence.join('\n'));
  }finally{
    if(await controlRequest(PILOT_ADDRESS,'status')){const stop=cmd('Stop MSA.cmd');stop.child.stdin.end();await stop.exited;}first.child.stdin.end();
  }
});
