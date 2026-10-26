import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdtemp,mkdir,writeFile,readdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {checkPrerequisites} from '../local-prerequisites.mjs';
import {spawnManagedEmulator,stopManagedEmulator} from '../local-emulator.mjs';
import {demoEnvironment,listen,waitFor,verifyHub,portOccupied} from '../local-demo.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Resume the remaining checks after a browser-only assertion repair, without
// repeating an already passing integration run. Default still runs everything.
const fromBrowser=process.argv[2]==='--from-browser';
const a1Only=process.argv[2]==='--a1';
const a2Only=process.argv[2]==='--a2-1';
const a22Only=process.argv[2]==='--a2-2';
const a23Only=process.argv[2]==='--a2-3';
const stage9aOnly=process.argv[2]==='--stage9a';
const stage8Only=process.argv[2]==='--stage8';
const a24cOnly=process.argv[2]==='--a2-4c';
const a24bOnly=process.argv[2]==='--a2-4b';
const a24Only=process.argv[2]==='--a2-4a';
async function run(label,args,env=process.env,cwd=ROOT){
  console.log('\nUJI · '+label);
  const code=await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,args,{cwd,env,stdio:'inherit',windowsHide:true});
    child.once('error',reject);child.once('exit',code=>resolve(code??1));
  });
  console.log((code===0?'PASS':'FAIL')+' · '+label);
  if(code!==0)throw Error('Pengujian gagal: '+label);
}
async function main(){
  // Validate the caller's environment, but never import operational snapshots or
  // attach to its running emulators. Every test child gets disposable ports/data.
  const base=demoEnvironment();await checkPrerequisites();
  if(process.argv.slice(2).some(arg=>!['--from-browser','--a1','--a2-1','--a2-2','--a2-3','--a2-4a','--a2-4b','--a2-4c','--stage8','--stage9a'].includes(arg))||process.argv.length>3)throw Error('Pilihan pengujian tidak valid.');
  if(!fromBrowser){
    await run('Sintaks dan import',['tests/check.mjs']);
    const unit=(await readdir(path.join(ROOT,'tests'))).filter(name=>name.endsWith('.test.mjs')&&(!a1Only||name==='msa-accounts.test.mjs')).map(name=>'tests/'+name);
    await run(a1Only?'Unit AUTH A1':'Regresi unit Stage 1–6',['--test','--test-concurrency=1',...unit]);
  }
  const parent=path.join(ROOT,'.emulator-data/stage3-tests');await mkdir(parent,{recursive:true});
  const state=await mkdtemp(path.join(parent,'run-')),temp=path.join(state,'temp');await mkdir(temp);
  const reservations=await Promise.all(Array.from({length:5},()=>listen(createServer(),0)));
  const ports=reservations.map(server=>server.address().port);await Promise.all(reservations.map(server=>new Promise(resolve=>server.close(resolve))));
  const [firestore,auth,hub,logging,websocket]=ports,config=path.join(state,'firebase.json');
  await writeFile(config,JSON.stringify({firestore:{rules:path.join(ROOT,'firestore.rules'),indexes:path.join(ROOT,'firestore.indexes.json')},emulators:{firestore:{host:'127.0.0.1',port:firestore,websocketPort:websocket},auth:{host:'127.0.0.1',port:auth},hub:{host:'127.0.0.1',port:hub},logging:{host:'127.0.0.1',port:logging},ui:{enabled:false},singleProjectMode:true}}));
  const env={...base,ABC_FIRESTORE_NAMESPACE:'stage3-isolated',FIRESTORE_EMULATOR_HOST:'127.0.0.1:'+firestore,FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:'+auth,ABC_STAGE3_TEST_PORTS:JSON.stringify(ports),TEMP:temp,TMP:temp,CI:'true',JAVA_TOOL_OPTIONS:(base.JAVA_TOOL_OPTIONS??'')+' -Djdk.net.unixdomain.tmpdir="'+path.join(state,'no-unix-sockets')+'"'};
  if(env.JAVA_HOME){const key=Object.keys(env).find(key=>key.toLowerCase()==='path')??'PATH';env[key]=path.join(env.JAVA_HOME,'bin')+path.delimiter+(env[key]??'');}
  console.log('Emulator tes terisolasi: '+state);
  const child=spawnManagedEmulator([path.join(ROOT,'node_modules/firebase-tools/lib/bin/firebase.js'),'emulators:start','--only','firestore,auth','--project','demo-abc-attendance','--config',config,'--non-interactive'],{cwd:state,env,logFile:path.join(state,'emulator.log')});
  try{
    await waitFor(()=>verifyHub({ports,locatorDirectory:temp}),{alive:()=>child.exitCode===null&&child.signalCode===null});
    const integration=(await readdir(path.join(ROOT,'tests/emulator'))).filter(name=>name.endsWith('.test.mjs')&&(!a1Only||name==='msa-a1.test.mjs')&&(!a2Only||['msa-a1.test.mjs','msa-a2-1.test.mjs'].includes(name))&&(!a22Only||name==='msa-a2-2.test.mjs')&&(!a23Only||name==='msa-a2-3.test.mjs')&&(!a24Only||name==='msa-a2-4a.test.mjs')&&(!a24bOnly||name==='msa-a2-4b.test.mjs')&&(!a24cOnly||name==='msa-a2-4c.test.mjs')&&(!stage8Only||name==='msa-stage8.test.mjs')&&(!stage9aOnly||name==='msa-stage9a.test.mjs')).map(name=>'tests/emulator/'+name);
    const browser=(stage9aOnly?['msa-stage9a-ui.mjs']:stage8Only?['msa-stage8-ui.mjs']:a24cOnly?['msa-a2-4c-ui.mjs']:a24bOnly?['msa-a2-4b-ui.mjs']:a24Only?['msa-a2-4a-ui.mjs']:a23Only?['msa-a2-3-ui.mjs']:a22Only?['msa-a2-2-ui.mjs']:a1Only?['msa-a1-ui.mjs']:a2Only?['msa-a1-ui.mjs','msa-a2-1-ui.mjs']:['admin-accounts-ui.mjs','admin-login-ui.mjs','device-management-ui.mjs','mentor-attendance-ui.mjs','backup-ui.mjs','msa-a1-ui.mjs','msa-a2-1-ui.mjs','msa-a2-2-ui.mjs','msa-a2-3-ui.mjs','msa-a2-4a-ui.mjs','msa-a2-4b-ui.mjs','msa-a2-4c-ui.mjs','msa-stage8-ui.mjs','msa-stage9a-ui.mjs']).map(name=>'tests/emulator/'+name);
    if(!fromBrowser)await run(stage9aOnly?'Stage 9A':stage8Only?'Integrasi Stage 8':a24cOnly?'Integrasi AUTH A2.4C':a24bOnly?'Integrasi AUTH A2.4B':a24Only?'Integrasi AUTH A2.4A':a23Only?'Integrasi AUTH A2.3':a22Only?'Integrasi AUTH A2.2':a1Only?'Integrasi AUTH A1':a2Only?'Integrasi AUTH A1/A2.1':'Auth/RBAC, pairing, absensi, konkurensi dan launcher',['--test','--test-concurrency=1',...integration],env);
    // Screenshots go to this run's ignored directory, never historical evidence.
    await run(stage9aOnly?'Stage 9A':stage8Only?'Chrome Stage 8':a24cOnly?'Chrome AUTH A2.4C':a24bOnly?'Chrome AUTH A2.4B':a24Only?'Chrome AUTH A2.4A':a23Only?'Chrome AUTH A2.3':a22Only?'Chrome AUTH A2.2':a1Only?'Chrome AUTH A1':a2Only?'Chrome AUTH A1/A2.1':'Regresi Chrome Superadmin/PIC/Mentor',['--test','--test-concurrency=1',...browser.map(file=>path.join(ROOT,file))],env,state);
    if(!a1Only&&!a2Only&&!a22Only&&!a23Only&&!a24Only&&!a24bOnly&&!a24cOnly&&!stage8Only&&!stage9aOnly){
      await run('Kalender demo, laporan dan offline (data fiktif)',[''+path.join(ROOT,'tests/browser.mjs')],env,state);
      await run('Cold recovery dan startup/shutdown milik peluncur',['--test','--test-concurrency=1','tests/emulator/local-demo-recovery.mjs','tests/emulator/stage3-startup.mjs'],env);
    }
  }finally{
    await stopManagedEmulator(child);
    await waitFor(async()=>!(await Promise.all(ports.map(portOccupied))).some(Boolean),{timeout:10000});
    console.log('Emulator tes ditutup. Artefak fiktif terisolasi: '+state);
  }
  console.log('\nPASS · '+(stage9aOnly?'Stage 9A':stage8Only?'Stage 8':a24cOnly?'AUTH A2.4C':a24bOnly?'AUTH A2.4B':a24Only?'AUTH A2.4A':a23Only?'AUTH A2.3':a22Only?'AUTH A2.2':a2Only?'AUTH A2.1 + A1':a1Only?'AUTH A1':fromBrowser?'Chrome, kalender demo/offline dan cold lifecycle':'Stage 3–6 + AUTH A1/A2.1/A2.2/A2.3/A2.4A/A2.4B/A2.4C + Stage 8/9A')+'. Data operasional dan snapshot launcher tidak dipakai sebagai fixture.');
}
main().catch(error=>{console.error('\nFAIL · '+(error.demoSafe?error.message:error.message?.startsWith('Pengujian gagal:')?error.message:'Prasyarat, layanan atau penghentian tes belum terkonfirmasi. Periksa keluaran di atas dan README.'));process.exitCode=1;});
