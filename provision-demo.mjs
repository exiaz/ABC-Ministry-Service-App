import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {emitKeypressEvents} from 'node:readline';
import {emulatorConfig} from './backend/emulator-config.mjs';
import {adminAuthConfig} from './backend/admin-auth.mjs';
import {createFirestoreEmulatorRepositories} from './backend/firestore-emulator.mjs';
import {fixtureRecords} from './tests/emulator/fixture.mjs';
import {deviceManagementSource} from './tests/emulator/device-management-source.mjs';

export const DEMO_ADMIN=Object.freeze({uid:'demo-admin-local',email:'admin.demo@abc-attendance.test'});
export const DEMO_NAMESPACE='local-demo-m2b5b';
export function provisioningConfig(env=process.env){
  if(env.NODE_ENV==='production'||!env.ABC_FIRESTORE_NAMESPACE)throw Error('Namespace demo eksplisit wajib diatur; mode produksi ditolak.');
  const store=emulatorConfig(env),auth=adminAuthConfig({...env,ABC_ADMIN_UIDS:'[]'});
  return Object.freeze({store,auth});
}

// Terminal only: no argv/env password, pipe fallback, echo, masking or logging.
export function hiddenInput(prompt,{input=process.stdin,output=process.stdout,signal}={}){
  if(!input.isTTY||!output.isTTY||typeof input.setRawMode!=='function')throw Error('Jalankan langsung di terminal PowerShell interaktif; input password lewat pipe ditolak.');
  return new Promise((resolve,reject)=>{
    let value='',done=false;const raw=input.isRaw??false,flowing=input.readableFlowing===true;
    const finish=(error)=>{
      if(done)return;done=true;input.removeListener('keypress',press);input.removeListener('end',end);input.removeListener('error',failure);signal?.removeEventListener('abort',end);
      input.setRawMode(raw);if(!flowing)input.pause();output.write('\n');const result=value;value='';if(error)reject(error);else resolve(result);
    };
    const end=()=>finish(Error('Input password dibatalkan.')),failure=()=>end();
    const press=(text,key={})=>{
      if(key.ctrl&&['c','d'].includes(key.name)){end();return;}
      if(['return','enter'].includes(key.name)){finish();return;}
      if(key.name==='backspace'){value=Array.from(value).slice(0,-1).join('');return;}
      if(!key.ctrl&&!key.meta&&text&&!/[\u0000-\u001f\u007f]/.test(text))value+=text;
    };
    emitKeypressEvents(input);input.on('keypress',press);input.once('end',end);input.once('error',failure);input.setRawMode(true);input.resume();output.write(prompt);
    signal?.addEventListener('abort',end,{once:true});if(signal?.aborted)end();
  });
}
export async function askDemoPassword(options={}){
  let password=await hiddenInput('Password admin fiktif (12–128 karakter, tidak tampil): ',options);
  try{
    if(password.length<12||password.length>128)throw Error('Password memerlukan 12–128 karakter. Jalankan ulang.');
    if(password!==await hiddenInput('Ulangi password (tidak tampil): ',options))throw Error('Konfirmasi password berbeda. Jalankan ulang.');
    return password;
  }finally{password='';}
}
// Trusted local operator recovery only. No HTTP route; fixed fictional identity,
// explicit confirmation and the same strict emulator guards as provisioning.
export async function recoverDemoPassword({auth,confirmed=false,assertLocal=()=>{},askPassword=askDemoPassword}){
  if(confirmed!==true)return {changed:false};
  const initial=JSON.stringify(provisioningConfig());
  const check=()=>{if(JSON.stringify(provisioningConfig())!==initial||!adminAuthConfig().uids.includes(DEMO_ADMIN.uid))throw Error('Konfigurasi emulator berubah atau UID demo belum diizinkan; pemulihan dibatalkan.');assertLocal();};
  const checkUser=user=>{if(user.uid!==DEMO_ADMIN.uid||user.email!==DEMO_ADMIN.email||user.disabled)throw Error('Akun demo tidak cocok atau dinonaktifkan. Pemulihan tidak mengaktifkan akun atau mengubah izin.');};
  check();checkUser(await auth.getUser(DEMO_ADMIN.uid));
  let password=await askPassword();
  try{
    if(typeof password!=='string'||password.length<12||password.length>128)throw Error('Password memerlukan 12–128 karakter.');
    check();
    // Emulator tokens/revocation have second precision. Cross the boundary
    // after closing old server contexts so a fresh login cannot share the old
    // token's timestamp/hash and revocation also rejects the old auth_time.
    const nextSecond=(Math.floor(Date.now()/1000)+1)*1000;
    await new Promise(resolve=>setTimeout(resolve,Math.max(0,nextSecond-Date.now())+10));
    check();checkUser(await auth.getUser(DEMO_ADMIN.uid));check();await auth.updateUser(DEMO_ADMIN.uid,{password});
    // Launcher closes the old admission contexts before recovery. Also revoke
    // Firebase sessions; no grants, devices or Firestore records are written.
    await auth.revokeRefreshTokens(DEMO_ADMIN.uid);check();return {changed:true};
  }finally{password='';}
}
const userOrNull=async read=>{try{return await read();}catch(e){if(e.code==='auth/user-not-found')return null;throw e;}};

// Create-only provisioning. Existing differences fail closed; never reset a
// password, re-enable an account, replace permission or overwrite attendance.
export function demoProvisioningRecords(identity=DEMO_ADMIN){
  const {source,grants}=deviceManagementSource();delete source.studentPrivateProfiles;
  return [...fixtureRecords(source),{collection:'adminPairingPermissions',id:identity.uid,data:{active:true,grants}}];
}
export async function provisionDemo({auth,db,root,assertLocal,askPassword=askDemoPassword,identity=DEMO_ADMIN}){
  const records=demoProvisioningRecords(identity);
  const refs=records.map(r=>root.collection(r.collection).doc(r.id));
  const missing=snapshots=>snapshots.flatMap((snapshot,i)=>{
    if(snapshot.exists&&!isDeepStrictEqual(snapshot.data(),records[i].data))throw Error('Record demo berbeda: '+records[i].collection+'/'+records[i].id+'. Tidak ditimpa; gunakan namespace demo kosong atau tinjau lewat operator.');
    return snapshot.exists?[]:[i];
  });
  assertLocal();missing(await db.getAll(...refs));
  const [user,emailOwner]=await Promise.all([userOrNull(()=>auth.getUser(identity.uid)),userOrNull(()=>auth.getUserByEmail(identity.email))]);
  if(user&&(user.email!==identity.email||user.disabled)||emailOwner&&emailOwner.uid!==identity.uid)throw Error('Identitas admin demo bertentangan atau nonaktif; akun tidak diubah.');
  let created=false;
  if(!user){
    let password=await askPassword();
    try{
      if(typeof password!=='string'||password.length<12||password.length>128)throw Error('Password memerlukan 12–128 karakter.');
      assertLocal();await auth.createUser({...identity,password});created=true;
    }finally{password='';}
  }
  const count=await db.runTransaction(async tx=>{
    const pending=missing(await tx.getAll(...refs));assertLocal();
    for(const i of pending)tx.create(refs[i],records[i].data);
    return pending.length;
  });
  assertLocal();return {uid:identity.uid,email:identity.email,accountCreated:created,recordsCreated:count};
}

async function main(){
  if(process.argv.length!==2)throw Error('Gunakan npm.cmd run demo:provision tanpa argumen; password hanya melalui prompt tersembunyi.');
  if(!process.stdin.isTTY||!process.stdout.isTTY)throw Error('Jalankan helper di terminal PowerShell interaktif, tanpa pipe atau redirect.');
  const initial=JSON.stringify(provisioningConfig()),assertLocal=()=>{if(JSON.stringify(provisioningConfig())!==initial)throw Error('Konfigurasi emulator berubah; setup ditolak.');};
  const {initializeApp,deleteApp}=await import('firebase-admin/app'),{getAuth}=await import('firebase-admin/auth');
  let context,app;
  try{
    context=await createFirestoreEmulatorRepositories();assertLocal();
    app=initializeApp({projectId:context.config.projectId},'demo-provision-'+randomUUID());const auth=getAuth(app);
    await auth.listUsers(1);assertLocal();
    const result=await provisionDemo({auth,...context,assertLocal});
    console.log('Setup demo selesai. '+(result.accountCreated?'Akun fiktif dibuat.':'Akun sudah ada; password tetap.'));
    console.log('UID: '+result.uid+'\nEmail: '+result.email+'\nNamespace: '+context.config.namespace+'\nRecord baru: '+result.recordsCreated);
    console.log("Atur pada terminal API dan admin: $env:ABC_ADMIN_UIDS='[\""+result.uid+"\"]'");
  }finally{if(app)await deleteApp(app);await context?.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{
    // Never dump SDK errors, payloads, passwords, tokens or stack traces.
    const safe=error.message?.startsWith('Record demo berbeda:')||['Identitas admin demo bertentangan','Password memerlukan','Konfirmasi password berbeda','Input password dibatalkan','Gunakan npm.cmd','Jalankan helper','Namespace demo eksplisit','Mode emulator','Firestore Emulator wajib','Auth Emulator wajib','Kredensial cloud','Konfigurasi project','Konfigurasi emulator berubah','Namespace emulator'].some(s=>error.message?.startsWith(s));
    console.error(safe?error.message:'Setup belum selesai. Periksa konfigurasi/koneksi Auth dan Firestore Emulator. Data yang sudah dibuat dipertahankan; jalankan ulang setelah diperiksa.');process.exitCode=1;
  });
}
