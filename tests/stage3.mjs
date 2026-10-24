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
  if(process.argv.slice(2).some(arg=>!['--from-browser','--a1','--a2-1','--a2-2'].includes(arg))||process.argv.length>3)throw Error('Pilihan pengujian tidak valid.');
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
    const integration=(await readdir(path.join(ROOT,'tests/emulator'))).filter(name=>name.endsWith('.test.mjs')&&(!a1Only||name==='msa-a1.test.mjs')&&(!a2Only||['msa-a1.test.mjs','msa-a2-1.test.mjs'].includes(name))&&(!a22Only||name==='msa-a2-2.test.mjs')).map(name=>'tests/emulator/'+name);
    const browser=(a22Only?['msa-a2-2-ui.mjs']:a1Only?['msa-a1-ui.mjs']:a2Only?['msa-a1-ui.mjs','msa-a2-1-ui.mjs']:['admin-accounts-ui.mjs','admin-login-ui.mjs','device-management-ui.mjs','mentor-attendance-ui.mjs','backup-ui.mjs','msa-a1-ui.mjs','msa-a2-1-ui.mjs','msa-a2-2-ui.mjs']).map(name=>'tests/emulator/'+name);
    if(!fromBrowser)await run(a22Only?'Integrasi AUTH A2.2':a1Only?'Integrasi AUTH A1':a2Only?'Integrasi AUTH A1/A2.1':'Auth/RBAC, pairing, absensi, konkurensi dan launcher',['--test','--test-concurrency=1',...integration],env);
    // Screenshots go to this run's ignored directory, never historical evidence.
    await run(a22Only?'Chrome AUTH A2.2':a1Only?'Chrome AUTH A1':a2Only?'Chrome AUTH A1/A2.1':'Regresi Chrome Superadmin/PIC/Mentor',['--test','--test-concurrency=1',...browser.map(file=>path.join(ROOT,file))],env,state);
    if(!a1Only&&!a2Only&&!a22Only){
      await run('Kalender demo, laporan dan offline (data fiktif)',[''+path.join(ROOT,'tests/browser.mjs')],env,state);
      await run('Cold recovery dan startup/shutdown milik peluncur',['--test','--test-concurrency=1','tests/emulator/local-demo-recovery.mjs','tests/emulator/stage3-startup.mjs'],env);
    }
  }finally{
    await stopManagedEmulator(child);
    await waitFor(async()=>!(await Promise.all(ports.map(portOccupied))).some(Boolean),{timeout:10000});
    console.log('Emulator tes ditutup. Artefak fiktif terisolasi: '+state);
  }
  console.log('\nPASS · '+(a22Only?'AUTH A2.2':a2Only?'AUTH A2.1 + A1':a1Only?'AUTH A1':fromBrowser?'Chrome, kalender demo/offline dan cold lifecycle':'Stage 3–6 + AUTH A1/A2.1/A2.2')+'. Data operasional dan snapshot launcher tidak dipakai sebagai fixture.');
}
main().catch(error=>{console.error('\nFAIL · '+(error.demoSafe?error.message:error.message?.startsWith('Pengujian gagal:')?error.message:'Prasyarat, layanan atau penghentian tes belum terkonfirmasi. Periksa keluaran di atas dan README.'));process.exitCode=1;});
