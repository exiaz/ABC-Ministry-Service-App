import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile,writeFile,readdir,stat,realpath,rename} from 'node:fs/promises';

const MANIFEST='snapshot-integrity.json';
const within=(base,target)=>{const relative=path.relative(base,target);return relative!==''&&!relative.startsWith('..')&&!path.isAbsolute(relative);};
async function inventory(target){
  const base=await realpath(target),files=[];
  async function scan(folder){
    for(const entry of await readdir(folder,{withFileTypes:true})){
      const file=path.join(folder,entry.name),name=path.relative(target,file).split(path.sep).join('/');
      if(entry.isSymbolicLink()||!within(base,await realpath(file)))throw Error('Snapshot memuat tautan/lokasi yang tidak aman.');
      if(name===MANIFEST)continue;
      if(entry.isDirectory())await scan(file);
      else if(entry.isFile()){
        const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);
        files.push({name,size:(await stat(file)).size,sha256:hash.digest('hex')});
      }else throw Error('Snapshot memuat jenis berkas yang tidak didukung.');
    }
  }
  await scan(target);return files.sort((a,b)=>a.name.localeCompare(b.name,'en'));
}
export async function verifySnapshotContents(target){
  const meta=JSON.parse(await readFile(path.join(target,'firebase-export-metadata.json'),'utf8'));
  if(meta.auth?.path!=='auth_export'||meta.firestore?.path!=='firestore_export')throw Error('Snapshot Auth/Firestore tidak lengkap.');
  const files=await inventory(target),names=new Map(files.map(file=>[file.name,file]));
  for(const name of ['auth_export/accounts.json','auth_export/config.json']){
    if(!names.get(name)?.size)throw Error('Berkas akun snapshot tidak lengkap.');
  }
  const accounts=JSON.parse(await readFile(path.join(target,'auth_export/accounts.json'),'utf8'));
  const config=JSON.parse(await readFile(path.join(target,'auth_export/config.json'),'utf8'));
  if(!Array.isArray(accounts.users)||!config||typeof config!=='object'||Array.isArray(config))throw Error('Format akun snapshot tidak valid.');
  const metadata=meta.firestore.metadata_file;
  if(typeof metadata!=='string'||!metadata.startsWith('firestore_export/')||!names.get(metadata)?.size)throw Error('Metadata Firestore snapshot tidak lengkap.');
  let manifest;
  try{manifest=JSON.parse(await readFile(path.join(target,MANIFEST),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  if(manifest&&(manifest.version!==1||manifest.projectId!=='demo-abc-attendance'||JSON.stringify(manifest.files)!==JSON.stringify(files)))throw Error('Checksum snapshot berbeda. Snapshot lama dipertahankan; minta operator memeriksa data.');
  return {files,sealed:!!manifest};
}
export async function sealSnapshot(target){
  const {files}=await verifySnapshotContents(target);
  await writeFile(path.join(target,MANIFEST),JSON.stringify({version:1,projectId:'demo-abc-attendance',files}),{flag:'wx'});
  await verifySnapshotContents(target);
}
export async function pointToSnapshot(state,name){
  const temporary=path.join(state,'latest-'+randomUUID()+'.tmp');
  await writeFile(temporary,JSON.stringify({name,integrity:'sha256'}),{flag:'wx'});await rename(temporary,path.join(state,'latest.json'));
}
