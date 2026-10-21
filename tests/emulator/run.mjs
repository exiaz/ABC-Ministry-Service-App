import {spawn,spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';
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
env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';env.CI='true';
if(env.JAVA_HOME)env.PATH=path.join(env.JAVA_HOME,'bin')+path.delimiter+env.PATH;
const command=process.argv[2]??'test';
if(!['test','start'].includes(command))throw Error('Perintah emulator tidak valid.');
const args=[path.join(root,'node_modules/firebase-tools/lib/bin/firebase.js'),command==='test'?'emulators:exec':'emulators:start','--only','firestore','--project',DEMO_PROJECT_ID,'--non-interactive'];
if(command==='test')args.push('node --test tests/emulator/*.test.mjs');
const child=spawn(process.execPath,args,{cwd:root,env,stdio:'inherit',windowsHide:true});
child.on('error',()=>{console.error('Firebase CLI lokal tidak dapat dijalankan.');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
