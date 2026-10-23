import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {access,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const fail=message=>Object.assign(Error(message),{demoSafe:true});
export async function checkPrerequisites({root=ROOT,env=process.env,nodeVersion=process.versions.node,run=spawnSync}={}){
  if(Number(nodeVersion.split('.')[0])<22)throw fail('Node.js 22+ diperlukan. Minta operator memperbarui Node.js, lalu buka Start kembali.');
  for(const file of ['node_modules/firebase-admin/package.json','node_modules/firebase-tools/lib/bin/firebase.js']){
    try{await access(path.join(root,file));}catch{throw fail('Dependensi proyek belum lengkap. Minta operator menjalankan npm.cmd ci di folder proyek, lalu coba lagi.');}
  }
  const java=env.JAVA_HOME?path.join(env.JAVA_HOME,'bin',process.platform==='win32'?'java.exe':'java'):'java';
  const version=run(java,['-version'],{encoding:'utf8',windowsHide:true,timeout:10000,env});
  if(version.status!==0||!/(?:openjdk|java) version "(?:2[1-9]|[3-9]\d)\./.test((version.stderr??'')+(version.stdout??'')))throw fail('Java JDK 21+ belum tersedia. Periksa JAVA_HOME atau PATH, lalu buka Start kembali.');
  const info=JSON.parse(await readFile(path.join(root,'node_modules/firebase-tools/lib/emulator/downloadableEmulatorInfo.json'),'utf8'));
  const cache=env.FIREBASE_EMULATORS_PATH||path.join(os.homedir(),'.cache/firebase/emulators');
  try{await access(path.join(cache,info.firestore.downloadPathRelativeToCacheDir));}
  catch{throw fail('Cache Firestore Emulator belum tersedia. Minta operator menyiapkan emulator sesuai README; Start tidak mengunduh otomatis.');}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  checkPrerequisites().catch(error=>{console.error(error.message);process.exitCode=1;});
}
