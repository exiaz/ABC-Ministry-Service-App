import {spawn,spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {existsSync,realpathSync} from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import {DEMO_PROJECT_ID} from '../../backend/emulator-config.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const env={...process.env};
// Windows environment names are case-insensitive; avoid duplicate Path/PATH.
const originalPath=Object.entries(env).find(([key])=>key.toLowerCase()==='path')?.[1]??'';
for(const key of Object.keys(env))if(key.toLowerCase()==='path')delete env[key];
env.PATH=path.dirname(process.execPath)+path.delimiter+originalPath;
if(process.platform==='win32'&&env.ABC_JAVA_TCP_FALLBACK==='1'){
  // Some Windows sandboxes cannot connect AF_UNIX wakeup sockets. A nonexistent
  // socket directory makes JDK PipeImpl fall back to TCP; no OS/JDK files change.
  const disabled=path.join(root,'.firebase','unix-sockets-disabled');
  if(existsSync(disabled))throw Error('Direktori fallback socket harus tidak tersedia.');
  env.JAVA_TOOL_OPTIONS=(env.JAVA_TOOL_OPTIONS??'')+' -Djdk.net.unixdomain.tmpdir="'+disabled+'"';
}
if(env.GOOGLE_APPLICATION_CREDENTIALS||env.FIREBASE_TOKEN)throw Error('Hapus konfigurasi kredensial cloud sebelum menjalankan emulator lokal.');
for(const key of ['GCLOUD_PROJECT','GOOGLE_CLOUD_PROJECT','ABC_FIREBASE_PROJECT_ID']){
  if(env[key]&&env[key]!==DEMO_PROJECT_ID)throw Error('Project selain demo tidak diizinkan.');
}
const java=env.JAVA_HOME?path.join(env.JAVA_HOME,'bin',process.platform==='win32'?'java.exe':'java'):'java';
const version=spawnSync(java,['-version'],{encoding:'utf8',windowsHide:true});
if(version.status!==0||!/(?:openjdk|java) version "(?:2[1-9]|[3-9]\d)\./.test(version.stderr+version.stdout))throw Error('Java JDK 21+ wajib tersedia melalui JAVA_HOME atau PATH.');
env.ABC_ROSTER_ADAPTER='firestore-emulator';env.ABC_FIREBASE_PROJECT_ID=DEMO_PROJECT_ID;
env.GCLOUD_PROJECT=DEMO_PROJECT_ID;env.GOOGLE_CLOUD_PROJECT=DEMO_PROJECT_ID;
env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';env.CI='true';
env.ABC_ADMIN_AUTH_MODE='firebase-auth-emulator';env.ABC_ADMIN_UIDS='[]';
if(env.JAVA_HOME)env.PATH=path.join(env.JAVA_HOME,'bin')+path.delimiter+env.PATH;
const command=process.argv[2]??'test';
if(!['test','auth-test','admin-login-test','pairing-test','mentor-ui-test','roster-test','attendance-test','attendance-ui-test','start','recovery'].includes(command))throw Error('Perintah emulator tidak valid.');
const stateRoot=path.join(root,'.emulator-data');
const newSnapshot=()=>path.join(stateRoot,'snapshot-'+Date.now()+'-'+randomUUID());
function localSnapshot(value){
  const selected=path.resolve(root,value);
  const within=(base,target)=>target.toLowerCase().startsWith(base.toLowerCase()+path.sep);
  if(!within(stateRoot,selected)||!existsSync(path.join(selected,'firebase-export-metadata.json'))||!within(realpathSync(stateRoot),realpathSync(selected)))throw Error('Snapshot wajib berada di .emulator-data dan memiliki metadata export lokal.');
  return selected;
}
async function run(kind,script,options=[]){
  const args=[path.join(root,'node_modules/firebase-tools/lib/bin/firebase.js'),kind,'--only','firestore,auth','--project',DEMO_PROJECT_ID,'--non-interactive',...options];
  if(script)args.push(script);
  await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,args,{cwd:root,env,stdio:'inherit',windowsHide:true});
    child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('Perintah emulator gagal: '+code)));
  });
}
try{
  if(['test','auth-test','admin-login-test','pairing-test','mentor-ui-test','roster-test','attendance-test','attendance-ui-test'].includes(command))await run('emulators:exec',command==='admin-login-test'?'node --test tests/emulator/admin-login.test.mjs tests/emulator/admin-login-ui.mjs':command==='attendance-ui-test'?'node --test tests/emulator/mentor-attendance-ui.mjs':command==='attendance-test'?'node --test tests/emulator/attendance.test.mjs':command==='roster-test'?'node --test tests/emulator/roster-context.test.mjs tests/emulator/mentor-pairing-ui.mjs':command==='mentor-ui-test'?'node --test tests/emulator/mentor-pairing-ui.mjs':command==='auth-test'?'node --test tests/emulator/admin-auth.test.mjs':command==='pairing-test'?'node --test tests/emulator/device-pairing.test.mjs':'node --test tests/emulator/*.test.mjs');
  else if(command==='start'){
    const options=['--export-on-exit='+newSnapshot()];
    if(env.ABC_EMULATOR_IMPORT_DIR)options.push('--import='+localSnapshot(env.ABC_EMULATOR_IMPORT_DIR));
    await run('emulators:start',null,options);
  }else{
    const snapshot=newSnapshot();env.ABC_FIRESTORE_NAMESPACE='recovery-'+randomUUID();
    // Random fictional test credentials live only in this process/child env,
    // never in command arguments, logs, fixture files or the exported snapshot.
    for(const key of ['VALID','REVOKED','DEVICE_REVOKED','EXPIRED'])env['ABC_RECOVERY_'+key]=randomBytes(32).toString('base64url');
    await run('emulators:exec','node tests/emulator/recovery-phase.mjs seed',['--export-on-exit='+snapshot]);
    await run('emulators:exec','node tests/emulator/recovery-phase.mjs verify',['--import='+localSnapshot(snapshot)]);
    console.log('Pemulihan emulator lulus: grant, pencabutan, expiry, roster dan audit tetap sesuai snapshot.');
  }
}catch(error){console.error(error.message);process.exitCode=1;}
