import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,realpath,rename,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {inspectLocalService,stopLocalService,serviceSignature} from './local-service.mjs';
import {DEMO_PROJECT_ID} from './backend/emulator-config.mjs';
import {createFirestoreEmulatorRepositories} from './backend/firestore-emulator.mjs';
import {createLocalAdminAuthentication} from './backend/admin-auth.mjs';
import {initializeOwner} from './backend/admin-accounts.mjs';
import {createRosterServer} from './backend/server.mjs';
import {createAdminServer} from './admin-server.mjs';
import {createPrototypeServer} from './server.mjs';
import {provisioningConfig,provisionDemo,demoProvisioningRecords,askDemoPassword,recoverDemoPassword,DEMO_ADMIN,DEMO_NAMESPACE} from './provision-demo.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
export const PAGES=['http://127.0.0.1:4177','http://127.0.0.1:4176'];
const HUB='http://127.0.0.1:4400';
const EMULATOR_PORTS=[8080,9099,4400,4500,9150];
const APP_PORTS=[4175,4177,4176];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const fail=message=>Object.assign(Error(message),{demoSafe:true});
const exists=async target=>{try{await access(target);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
const within=(base,target)=>{const relative=path.relative(base,target);return relative!==''&&!relative.startsWith('..')&&!path.isAbsolute(relative);};

export function demoEnvironment(base=process.env){
  if(base.GOOGLE_APPLICATION_CREDENTIALS||base.FIREBASE_TOKEN||base.NODE_ENV==='production')throw fail('Mode cloud/produksi terdeteksi. Jalankan demo dari terminal lokal tanpa kredensial cloud.');
  for(const key of ['ABC_FIREBASE_PROJECT_ID','GCLOUD_PROJECT','GOOGLE_CLOUD_PROJECT'])if(base[key]&&base[key]!==DEMO_PROJECT_ID)throw fail('Project Firebase lain terdeteksi. Demo hanya menerima demo-abc-attendance.');
  const env={...base,ABC_ROSTER_ADAPTER:'firestore-emulator',ABC_ADMIN_AUTH_MODE:'firebase-auth-emulator',ABC_FIREBASE_PROJECT_ID:DEMO_PROJECT_ID,GCLOUD_PROJECT:DEMO_PROJECT_ID,GOOGLE_CLOUD_PROJECT:DEMO_PROJECT_ID,FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',ABC_FIRESTORE_NAMESPACE:DEMO_NAMESPACE,ABC_ADMIN_UIDS:JSON.stringify([DEMO_ADMIN.uid]),ABC_ROSTER_PORT:'4175',ABC_ADMIN_PORT:'4177',ABC_MENTOR_PORT:'4176',ABC_MENTOR_ORIGIN:PAGES[1],ABC_API_ORIGIN:'http://127.0.0.1:4175',ABC_JAVA_TCP_FALLBACK:'1'};
  delete env.ABC_EMULATOR_IMPORT_DIR;provisioningConfig(env);return env;
}
export function controllerPath(root=ROOT){
  const hash=createHash('sha256').update(path.resolve(root).toLowerCase()).digest('hex').slice(0,24);
  return process.platform==='win32'?'\\\\.\\pipe\\abc-attendance-'+hash:path.join(os.tmpdir(),'abc-attendance-'+hash+'.sock');
}
// Local OS IPC only. No HTTP control/provisioning endpoint or stored credential.
export function controlRequest(address,command){
  return new Promise((resolve,reject)=>{
    const socket=net.createConnection(address);let raw='',done=false;
    const finish=(error,value)=>{if(done)return;done=true;socket.destroy();if(error)reject(error);else resolve(value);};
    socket.setTimeout(2500,()=>finish(fail('Jendela demo tidak merespons. Periksa jendela ABC Attendance yang pertama.')));
    socket.once('connect',()=>socket.write(command+'\n'));
    socket.on('data',chunk=>{raw+=chunk;if(raw.length>1024)return finish(fail('Respons peluncur tidak valid.'));if(raw.includes('\n')){try{finish(null,JSON.parse(raw.trim()));}catch{finish(fail('Respons peluncur tidak valid.'));}}});
    socket.once('error',error=>['ENOENT','ECONNREFUSED'].includes(error.code)?finish(null,null):finish(error));
    socket.once('end',()=>{if(!done)finish(fail('Jendela demo terputus.'));});
  });
}
export async function createController(address,handler){
  const server=net.createServer(socket=>{
    let raw='';socket.setTimeout(2500,()=>socket.destroy());
    socket.on('data',chunk=>{raw+=chunk;if(raw.length>128){socket.destroy();return;}if(!raw.includes('\n'))return;const command=raw.trim();if(!['status','stop'].includes(command)){socket.end('{"phase":"invalid"}\n');return;}socket.end(JSON.stringify(handler(command))+'\n');});
    socket.on('error',()=>{});
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(address,resolve);});return server;
}
export function portOccupied(port){
  return new Promise(resolve=>{
    const socket=net.createConnection({host:'127.0.0.1',port});let done=false;
    const finish=value=>{if(done)return;done=true;socket.destroy();resolve(value);};
    socket.setTimeout(700,()=>finish(true));socket.once('connect',()=>finish(true));socket.once('error',e=>finish(e.code!=='ECONNREFUSED'));
  });
}
const json=async(url,options={})=>{
  const response=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(options.timeout??3000)});
  if(!response.ok)throw fail('Emulator lokal belum siap atau tidak merespons.');return response.json();
};
export function validHub(locator,hub,mapping){
  if(!Number.isSafeInteger(hub?.pid)||hub.pid!==locator?.pid||hub.host!=='127.0.0.1'||hub.port!==4400||!locator.origins?.includes(HUB))return false;
  for(const [name,port] of [['hub',4400],['auth',9099],['firestore',8080]]){
    const entry=mapping?.[name];if(entry?.host!=='127.0.0.1'||entry.port!==port||!entry.listen?.length||entry.listen.some(s=>s.address!=='127.0.0.1'||s.port!==port))return false;
  }
  return mapping.firestore.webSocketHost===undefined||mapping.firestore.webSocketHost==='127.0.0.1';
}
export async function verifyHub(){
  const [locator,hub,mapping]=await Promise.all([readFile(path.join(os.tmpdir(),'hub-'+DEMO_PROJECT_ID+'.json'),'utf8').then(JSON.parse),json(HUB+'/'),json(HUB+'/emulators')]);
  if(!validHub(locator,hub,mapping))throw fail('Port emulator sedang dipakai layanan yang tidak cocok. Tutup layanan tersebut secara manual; peluncur tidak akan mematikannya.');
  return hub;
}
export async function waitFor(check,{timeout=90000,alive=()=>true}={}){
  const end=Date.now()+timeout;
  while(Date.now()<end){if(!alive())throw fail('Proses emulator berhenti sebelum siap. Pastikan Java JDK 21+ dan dependensi proyek sudah tersedia.');try{if(await check())return;}catch{}await wait(300);}
  throw fail('Layanan belum siap setelah menunggu. Periksa port yang terpakai dan Java JDK 21+, lalu coba lagi.');
}
export async function snapshotDirectory(root=ROOT){
  const realRoot=await realpath(root),base=path.join(root,'.emulator-data');
  if(await exists(base)&&!within(realRoot,await realpath(base)))throw fail('Lokasi data demo berada di luar folder proyek; startup dibatalkan.');
  await mkdir(base,{recursive:true});const state=path.join(base,'local-demo-launcher');await mkdir(state,{recursive:true});
  if(!within(realRoot,await realpath(state)))throw fail('Lokasi snapshot tidak aman; startup dibatalkan.');return state;
}
export async function validateSnapshot(state,name){
  if(!/^snapshot-\d+-[a-f0-9-]{36}$/.test(name))throw fail('Snapshot demo tidak valid. Minta operator memeriksa folder data lokal; data tidak direset otomatis.');
  const target=path.join(state,name);
  if(!within(await realpath(state),await realpath(target)))throw fail('Snapshot demo berada di luar folder yang diizinkan.');
  const meta=JSON.parse(await readFile(path.join(target,'firebase-export-metadata.json'),'utf8'));
  if(meta.auth?.path!=='auth_export'||meta.firestore?.path!=='firestore_export')throw fail('Snapshot demo tidak lengkap; akun dan absensi tidak direset otomatis.');
  for(const part of ['auth_export','firestore_export'])if(!within(await realpath(target),await realpath(path.join(target,part))))throw fail('Isi snapshot berada di luar folder yang diizinkan.');
  return target;
}
export async function previousSnapshot(state){
  const pointer=path.join(state,'latest.json');if(!await exists(pointer))return null;
  try{return await validateSnapshot(state,JSON.parse(await readFile(pointer,'utf8')).name);}catch{throw fail('Snapshot terakhir tidak dapat dibaca. Minta operator memeriksanya; data tidak direset otomatis.');}
}
export async function saveSnapshot(state,{verify=verifyHub,request=json}={}){
  await verify();const name='snapshot-'+Date.now()+'-'+randomUUID(),target=path.join(state,name);
  await request(HUB+'/_admin/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:target,initiatedBy:'abc-local-demo',targets:['auth','firestore']}),timeout:60000});
  await validateSnapshot(state,name);const temporary=path.join(state,'latest-'+randomUUID()+'.tmp');await writeFile(temporary,JSON.stringify({name}),{flag:'wx'});await rename(temporary,path.join(state,'latest.json'));return target;
}
export async function prepareDemo(context,auth,{identity=DEMO_ADMIN,assertLocal,askPassword}={}){
  const refs=demoProvisioningRecords(identity).map(r=>context.root.collection(r.collection).doc(r.id));
  let user;try{user=await auth.getUser(identity.uid);}catch(e){if(e.code!=='auth/user-not-found')throw e;}
  if(user&&(user.email!==identity.email||user.disabled))throw fail('Akun admin demo berbeda atau dinonaktifkan. Akun tidak direset; hubungi operator.');
  const reused=!!user&&(await context.db.getAll(...refs)).every(s=>s.exists);
  if(!reused)await provisionDemo({...context,auth,identity,assertLocal,askPassword});
  assertLocal();let pairingReady=true;
  try{await context.pairing.adminContext(identity.uid);assertLocal();}catch(error){if(error.status!==403)throw error;pairingReady=false;}
  return {reused,pairingReady};
}
export async function appsReady({servers}){
  const [api,admin,mentor]=servers.map(s=>'http://127.0.0.1:'+s.address().port);
  for(const [url,status,mode] of [[api+'/api/admin/session',401,'test-foundation'],[admin+'/',200,'authenticated-admin-emulator'],[mentor+'/',200,'paired-local-fictional-roster']]){
    const response=await fetch(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(3000)});await response.body?.cancel();
    if(response.status!==status||response.headers.get('x-abc-mode')!==mode)throw fail('Aplikasi belum siap. Periksa jendela demo lalu coba Start kembali.');
  }
}
export async function listen(server,port){
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});return server;
}
export async function startDemoServers(context,{ports=APP_PORTS,check=()=>{},reused=[],resources={servers:[],auths:[]}}={}){
  const {servers,auths}=resources;
  try{
    if(reused[0])servers.push(borrowedServer(reused[0]));
    else{const apiAuth=await createLocalAdminAuthentication();auths.push(apiAuth);check();servers.push(await listen(createRosterServer({...context,adminAuthentication:apiAuth,mentorOrigin:PAGES[1]}),ports[0]));}
    if(reused[1])servers.push(borrowedServer(reused[1]));
    else{const adminAuth=await createLocalAdminAuthentication();auths.push(adminAuth);check();servers.push(await listen(createAdminServer({adminAuthentication:adminAuth,pairing:context.pairing}),ports[1]));}
    servers.push(reused[2]?borrowedServer(reused[2]):await listen(createPrototypeServer({mentorMode:true,apiOrigin:'http://127.0.0.1:'+servers[0].address().port}),ports[2]));check();
  }catch(error){await closeDemoServers({servers,auths});throw error;}
  return resources;
}
function borrowedServer(service){
  let stopped=false;
  return {address:()=>({port:service.port}),async stop(){if(!stopped){await stopLocalService(service);stopped=true;}}};
}
export async function closeDemoServers(resources){
  const {servers=[],auths=[]}=resources??{};
  await Promise.all(servers.map(server=>server.stop?server.stop():new Promise(resolve=>{server.close(resolve);server.closeIdleConnections();})));
  await Promise.all(auths.map(auth=>auth.close()));
}
export async function stopOwnedEmulator(child){
  if(!child||child.exitCode!==null||child.signalCode!==null)return;
  if(process.platform==='win32'){
    // Only the live child spawned by this launcher; never discover/kill by port,
    // process name, PID file, or a caller-supplied PID.
    await new Promise((resolve,reject)=>{const killer=spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});killer.once('error',reject);killer.once('exit',code=>code===0?resolve():reject(fail('Emulator milik peluncur belum berhenti. Periksa jendela demo.')));});
  }else{child.kill('SIGINT');await new Promise(resolve=>child.once('exit',resolve));}
}
export async function openPages(){
  for(const url of PAGES)await new Promise((resolve,reject)=>{const child=spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true,stdio:'ignore'});child.once('spawn',resolve);child.once('error',reject);});
}

export async function confirmPortRecovery({port,kind},{input=process.stdin,output=process.stdout,signal}={}){
  output.write('\nPort '+port+' sudah digunakan. '+(kind==='incompatible'?'Server ABC terverifikasi, tetapi konfigurasi atau versi berbeda. Ganti hanya server ini dengan konfigurasi demo? Data emulator tetap. Ketik GANTI untuk setuju; Enter untuk batal.':'Identitas/konfigurasi server belum terverifikasi (mungkin server ABC lama). Jangan hentikan proses yang tidak Anda kenal. Tutup server ABC lama melalui Ctrl+C di jendelanya. Jika bukan milik Anda, minta bantuan operator. Setelah port bebas, tekan Enter untuk mencoba lagi; ketik BATAL untuk keluar.')+'\n');
  if(!input.isTTY||!output.isTTY)return false;
  return new Promise(resolve=>{
    const terminal=createInterface({input,output});let answered=false;
    const cancel=()=>terminal.close();signal?.addEventListener('abort',cancel,{once:true});
    terminal.once('close',()=>{signal?.removeEventListener('abort',cancel);if(!answered)resolve(false);});
    terminal.question('Pilihan Anda: ',answer=>{answered=true;terminal.close();resolve(kind==='incompatible'?answer.trim().toUpperCase()==='GANTI':answer.trim()==='');});
    if(signal?.aborted)cancel();
  });
}
export async function resolveDemoPorts(ports,{inspect=inspectLocalService,occupied=portOccupied,confirm=confirmPortRecovery,stop=stopLocalService,log=console.log,check=()=>{},recover=false}={}){
  const reused=[],roles=['api','admin','mentor'];
  for(const [index,port] of ports.entries()){
    while(port&&await occupied(port)){
      check();const service=await inspect(port,roles[index]);check();
      if(service.kind==='compatible'&&!recover){reused[index]=service;log('Port '+port+': server ABC cocok dan sehat; digunakan kembali. Stop akan menutup server ini sebelum menyimpan snapshot.');break;}
      const kind=service.kind==='compatible'?'incompatible':service.kind;
      if(!await confirm({...service,kind}))throw fail('Startup dibatalkan. Port '+port+' sudah digunakan; tidak ada proses yang dimatikan tanpa verifikasi dan persetujuan.');
      check();
      if(kind==='incompatible'){
        const current=await inspect(port,roles[index]);
        if(current.status?.instance!==service.status.instance||current.kind==='unknown')throw fail('Identitas server berubah. Penggantian dibatalkan; coba Start kembali.');
        await stop(current);log('Server ABC pada port '+port+' ditutup dengan rapi. Data emulator dipertahankan.');
        await waitFor(async()=>!await occupied(port),{timeout:15000});
      }
    }
  }
  return reused;
}

export async function runDemo({open=openPages,log=console.log,address=controllerPath(),input=process.stdin,output=process.stdout,ports=APP_PORTS,environment=demoEnvironment,stateDirectory=snapshotDirectory,prepare=prepareDemo,persist=saveSnapshot,recover=false,askPassword=askDemoPassword,emulatorPorts=EMULATOR_PORTS,checkHub=verifyHub,confirmConflict}={}){
  const previous=await controlRequest(address,'status');
  if(previous){
    if(previous.phase!=='ready'){log('Demo sedang dimulai/dihentikan. Gunakan jendela ABC Attendance yang pertama.');return;}
    let healthy=false;
    try{if(previous.signature===await serviceSignature(environment())&&previous.ports?.length===3){await appsReady({servers:previous.ports.map(port=>({address:()=>({port})}))});await checkHub();healthy=true;}}catch{}
    if(healthy){await open();log('Demo sudah berjalan dan terverifikasi. Halaman Admin dan Mentor dibuka.');return;}
    const confirm=confirmConflict??(service=>confirmPortRecovery(service,{input,output}));
    if(!await confirm({port:'peluncur',kind:'incompatible'}))throw fail('Peluncur lama belum cocok/sehat. Startup dibatalkan; layanan dan data tetap.');
    await stopDemo({address,log});
  }
  Object.assign(process.env,environment());
  const abort=new AbortController(),config=JSON.stringify(provisioningConfig()),signature=await serviceSignature();
  let phase='starting',emulator,context,apps,control,terminal,canSave=false,stopping,bootstrap,finish;
  const finished=new Promise(resolve=>{finish=resolve;});
  const check=()=>{if(abort.signal.aborted)throw fail('Startup dibatalkan.');if(JSON.stringify(provisioningConfig())!==config)throw fail('Konfigurasi emulator berubah. Akses ditolak.');};
  const state=await stateDirectory();
  const stop=()=>{
    if(stopping)return stopping;
    stopping=(async()=>{
      phase='stopping';abort.abort();log('Menghentikan demo dan menyimpan data lokal…');
      await bootstrap?.catch(()=>{});await closeDemoServers(apps);apps=null;
      if(canSave)await persist(state);
      await context?.close();context=null;await stopOwnedEmulator(emulator);
      terminal?.close();phase='stopped';control.close();process.removeListener('SIGINT',onSignal);process.removeListener('SIGTERM',onSignal);
      log('Demo berhenti.'+(canSave?' Data lokal tersimpan.':'')+(emulator?'':' Layanan manual tidak diubah.'));finish();
    })().catch(error=>{phase='save-error';stopping=null;log('Demo belum ditutup: penyimpanan/penghentian belum terkonfirmasi. Emulator dipertahankan. Tekan Enter atau jalankan Stop ABC Attendance.cmd untuk mencoba lagi.');});return stopping;
  };
  const onSignal=()=>void stop();
  try{control=await createController(address,command=>{if(command==='stop')void stop();return {phase,...(phase==='ready'?{signature,ports:apps.servers.map(s=>s.address().port)}:{})};});}
  catch{const owner=await controlRequest(address,'status');if(owner){log('Peluncur lain sudah berjalan. Klik Start lagi setelah jendela pertama menyatakan Demo siap.');return;}throw fail('Peluncur lokal tidak dapat dibuka. Periksa jendela demo yang masih aktif.');}
  process.on('SIGINT',onSignal);process.on('SIGTERM',onSignal);
  bootstrap=(async()=>{
    log('1/4 · Memeriksa layanan lokal. Tunggu hingga muncul "Demo siap".');
    const reused=await resolveDemoPorts(ports,{log,check,recover,confirm:confirmConflict??(service=>confirmPortRecovery(service,{input,output,signal:abort.signal}))});check();
    const occupied=await Promise.all(emulatorPorts.map(portOccupied));check();
    if(occupied.some(Boolean)){
      try{await checkHub();}catch{throw fail('Port emulator (8080/9099/4400/4500/9150) sedang dipakai layanan yang belum lengkap atau tidak cocok. Tutup instance manual tersebut lalu klik Start lagi. Peluncur tidak mematikannya otomatis.');}
      log('Menggunakan Auth/Firestore Emulator demo yang sudah aktif.');
    }
    else{
      await access(path.join(ROOT,'node_modules/firebase-tools/lib/bin/firebase.js')).catch(()=>{throw fail('Dependensi emulator belum tersedia. Minta operator menyiapkan dependensi proyek dan Java JDK 21+.');});
      const snapshot=await previousSnapshot(state),env={...process.env};if(snapshot)env.ABC_EMULATOR_IMPORT_DIR=snapshot;
      log(snapshot?'Memulihkan data demo lokal…':'Menyalakan Auth/Firestore Emulator lokal…');
      emulator=spawn(process.execPath,[path.join(ROOT,'tests/emulator/run.mjs'),'start'],{cwd:ROOT,env,windowsHide:true,stdio:'ignore'});emulator.on('error',()=>{});
      await waitFor(()=>checkHub(),{alive:()=>!abort.signal.aborted&&emulator.exitCode===null&&emulator.signalCode===null});
    }
    canSave=true;check();context=await createFirestoreEmulatorRepositories();check();log('2/4 · Memeriksa akun Admin dan izin pairing.');
    const {initializeApp,deleteApp}=await import('firebase-admin/app'),{getAuth}=await import('firebase-admin/auth');
    const app=initializeApp({projectId:DEMO_PROJECT_ID},'demo-launcher-'+randomUUID());
    try{
      if(recover){
        log('Buat password Admin yang baru. Input tidak terlihat; ketik lalu tekan Enter.');
        await recoverDemoPassword({auth:getAuth(app),confirmed:true,assertLocal:check,askPassword:()=>askPassword({signal:abort.signal})});
        await persist(state);check();log('Password baru telah tersimpan. Gunakan password baru untuk login; sesi lama telah ditutup.');
      }
      const result=await prepare(context,getAuth(app),{assertLocal:check,askPassword:()=>{log('Akun pertama: buat password 12–128 karakter. Input tidak terlihat; ketik lalu Enter, kemudian ulangi.');return askPassword({signal:abort.signal});}});
      if(context.config.namespace===DEMO_NAMESPACE){
        const marker=await context.root.collection('adminSecurity').doc('owner').get();
        if(!marker.exists&&!await confirmOwner({input,output,signal:abort.signal}))throw fail('Penetapan Superadmin dibatalkan. Akun dan data tetap tersimpan; jalankan Start untuk mencoba lagi.');
        if(await initializeOwner({...context,auth:getAuth(app),...DEMO_ADMIN,confirmed:true})){await persist(state);check();log('Superadmin ditetapkan pada UID demo yang sama. Password dan izin pairing tetap.');}
      }
      if(!result.reused){await persist(state);check();}
      log(result.reused?'Akun dan data digunakan kembali. Password Anda tetap berlaku.':'Akun dan fixture tersimpan. Ingat password yang baru Anda buat.');
      if(!result.pairingReady)log('Perhatian: izin pairing dicabut atau tidak lengkap. Izin tersebut tetap dipertahankan; hubungi operator bila perlu.');
    }finally{await deleteApp(app);}
    check();log('3/4 · Menyiapkan halaman Admin dan Mentor…');
    // Recheck after emulator/provisioning work; never attach to a changed instance.
    for(const [index,service] of reused.entries())if(service){const current=await inspectLocalService(service.port,['api','admin','mentor'][index]);if(current.kind!=='compatible'||current.status.instance!==service.status.instance)throw fail('Server yang akan dipakai ulang berubah. Coba Start lagi.');}
    apps={servers:[],auths:[]};await startDemoServers(context,{ports,check,reused,resources:apps});check();await appsReady(apps);check();
    phase='ready';log('4/4 · Demo siap. Login Admin: '+DEMO_ADMIN.email+'\nGunakan password Anda. Lupa password? Klik Reset Admin Password.cmd.\nTekan Enter di jendela ini untuk menyimpan dan berhenti, atau klik Stop ABC Attendance.cmd.');
    try{await open();}catch{log('Browser belum terbuka. Buka http://127.0.0.1:4177 dan http://127.0.0.1:4176 secara manual.');}
  })();
  try{await bootstrap;}catch(error){log(error.demoSafe?error.message:recover?'Pemulihan belum terkonfirmasi. Password mungkin sudah berubah. Periksa koneksi lalu ulangi Reset Admin Password.cmd; absensi dan izin tetap.':'Demo belum siap. Periksa koneksi emulator, konfirmasi password dan akun demo. Password baru harus sama pada kedua isian dan minimal 12 karakter. Data tidak direset otomatis.');process.exitCode=1;await stop();}
  if(phase!=='stopped'){
    terminal=createInterface({input,output});terminal.on('line',()=>void stop());
    if(phase==='ready')setInterval(()=>{if(phase==='ready')checkHub().catch(()=>{log('Koneksi emulator terputus. Jangan menyimpan absensi sampai layanan pulih.');});},15000).unref();
  }
  await finished;
}
export function confirmRecovery({input=process.stdin,output=process.stdout}={}){
  output.write('\nPEMULIHAN PASSWORD ADMIN DEMO LOKAL\nAkun: '+DEMO_ADMIN.email+'\nPassword lama akan diganti dan sesi Admin ditutup. Absensi serta izin perangkat tetap.\n');
  return new Promise(resolve=>{
    const terminal=createInterface({input,output});let answered=false;
    terminal.once('close',()=>{if(!answered)resolve(false);});
    terminal.question('Ketik GANTI lalu Enter untuk melanjutkan. Enter saja untuk batal: ',answer=>{answered=true;terminal.close();resolve(answer.trim().toUpperCase()==='GANTI');});
  });
}
export function confirmOwner({input=process.stdin,output=process.stdout,signal}={}){
  output.write('\nPENETAPAN PEMILIK DEMO LOKAL\nAkun '+DEMO_ADMIN.email+' ('+DEMO_ADMIN.uid+') akan menjadi satu Superadmin awal. Password, izin dan data lama dipertahankan. Ketik TETAPKAN untuk setuju; Enter membatalkan.\n');
  if(!input.isTTY||!output.isTTY)return Promise.resolve(false);
  return new Promise(resolve=>{
    const terminal=createInterface({input,output});let done=false;const abort=()=>terminal.close();signal?.addEventListener('abort',abort,{once:true});
    terminal.once('close',()=>{signal?.removeEventListener('abort',abort);if(!done)resolve(false);});
    terminal.question('Pilihan Anda: ',answer=>{done=true;terminal.close();resolve(answer.trim()==='TETAPKAN');});if(signal?.aborted)abort();
  });
}
export async function recoverAndRun({confirm=confirmRecovery,log=console.log,...options}={}){
  // No changes, not even stopping an active launcher, before confirmation.
  if(!await confirm()){log('Pemulihan dibatalkan. Password dan layanan tidak diubah.');return;}
  (options.environment??demoEnvironment)();
  await stopDemo({address:options.address,log});
  return runDemo({...options,log,recover:true});
}
export async function stopDemo({address=controllerPath(),log=console.log}={}){
  const status=await controlRequest(address,'stop');if(!status){log('Demo dari peluncur ini tidak sedang berjalan. Layanan manual tidak diubah.');return;}
  log('Menunggu penyimpanan dan penghentian demo…');
  const end=Date.now()+90000;
  while(Date.now()<end){const current=await controlRequest(address,'status');if(!current){log('Demo berhenti.');return;}if(current.phase==='save-error')throw fail('Data belum tersimpan. Periksa jendela ABC Attendance lalu coba Stop lagi.');await wait(300);}
  throw fail('Demo masih menyimpan atau menunggu permintaan selesai. Periksa jendela pertama; jangan tutup paksa.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const command=process.argv[2];
  const work=process.platform!=='win32'?Promise.reject(fail('Peluncur ini khusus Windows.')):command==='start'?runDemo():command==='stop'?stopDemo():command==='recover'?recoverAndRun():Promise.reject(fail('Gunakan Start ABC Attendance.cmd, Stop ABC Attendance.cmd atau Reset Admin Password.cmd.'));
  work.catch(error=>{console.error(error.demoSafe?error.message:'Peluncur gagal. Periksa Node.js, Java JDK 21+, dependensi proyek dan layanan lokal. Tidak ada password/token yang dicetak.');process.exitCode=1;});
}
