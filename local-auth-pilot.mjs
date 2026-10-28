import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {mkdir,mkdtemp,writeFile,realpath} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {checkPrerequisites} from './local-prerequisites.mjs';
import {spawnManagedEmulator,stopManagedEmulator} from './local-emulator.mjs';
import {demoEnvironment,controllerPath,controlRequest,createController,portOccupied,verifyHub,waitFor,listen,closeDemoServers,appsReady} from './local-demo.mjs';
import {createFirestoreEmulatorRepositories} from './backend/firestore-emulator.mjs';
import {createLocalAdminAuthentication} from './backend/admin-auth.mjs';
import {initializeOwner} from './backend/admin-accounts.mjs';
import {createRosterServer} from './backend/server.mjs';
import {createAdminServer} from './admin-server.mjs';
import {createPrototypeServer} from './server.mjs';
import {askDemoPassword,hiddenInput} from './provision-demo.mjs';
import {fictionalRosterData} from './tests/fixtures/roster.mjs';
import {fixtureRecords} from './tests/emulator/fixture.mjs';
import {jakartaToday} from './dates.js';
import {SCHOOL_CONFIG,GROUP_CONFIG} from './group-config.js';
import {wrapPilotServer} from './local-auth-pilot-ui.mjs';
import {serviceSignature} from './local-service.mjs';
import {seedCalendarFixture} from './tests/fixtures/msa-calendar.mjs';
import {calendarPermissions,eventPermissions} from './backend/msa-events.mjs';
import {seedEventGrant} from './tests/fixtures/msa-events.mjs';
import {seedStage8Fixture} from './tests/fixtures/msa-core.mjs';
import {coreMembershipId} from './backend/msa-core.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
export const PILOT_PORTS=Object.freeze([8280,9299,4480,4580,9250,4275,4277,4276]);
export const PILOT_ADDRESS=controllerPath(path.join(ROOT,'auth-pilot'));
export const PILOT_USERNAME='peninjau.pilot';
export const PIC_USERNAME='pic.pilot';
const safe=message=>Object.assign(Error(message),{pilotSafe:true});

export function pilotEnvironment(base=process.env,{ports=PILOT_PORTS,id=randomUUID()}={}){
  demoEnvironment(base); // Retain the existing explicit cloud/production refusal.
  if(!/^[a-f0-9-]{36}$/.test(id)||ports.length!==8||new Set(ports).size!==8||ports.some(p=>!Number.isSafeInteger(p)||p<1024||p>65535||[4173,4175,4176,4177,8080,9099,4400,4500,9150].includes(p)))throw safe('Konfigurasi port atau identitas pilot tidak valid.');
  for(const key of ['FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST'])if(base[key]&&!/^127\.0\.0\.1:[1-9]\d{0,4}$/.test(base[key]))throw safe('Alamat emulator dari lingkungan tidak aman.');
  const [firestore,auth,,,,api,admin,mentor]=ports;
  const env={...base,ABC_ROSTER_ADAPTER:'firestore-emulator',ABC_ADMIN_AUTH_MODE:'firebase-auth-emulator',ABC_FIREBASE_PROJECT_ID:'demo-abc-attendance',GCLOUD_PROJECT:'demo-abc-attendance',GOOGLE_CLOUD_PROJECT:'demo-abc-attendance',FIRESTORE_EMULATOR_HOST:'127.0.0.1:'+firestore,FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:'+auth,ABC_FIRESTORE_NAMESPACE:'test-auth-pilot-'+id,ABC_ADMIN_UIDS:JSON.stringify(['pilot-reviewer-'+id]),ABC_ROSTER_PORT:String(api),ABC_ADMIN_PORT:String(admin),ABC_MENTOR_PORT:String(mentor),ABC_API_ORIGIN:'http://127.0.0.1:'+api,ABC_MENTOR_ORIGIN:'http://127.0.0.1:'+mentor,ABC_MSA_A1:'1',ABC_MSA_USERNAME_PILOT:'1',ABC_MSA_A2_2:'1',ABC_MSA_A2_3:'1',ABC_MSA_A2_4A:'1',ABC_MSA_A2_4B:'1',ABC_MSA_A2_4C:'1',ABC_MSA_STAGE8:'1',ABC_MSA_STAGE9A:'1',ABC_MSA_STAGE9B1:'1',ABC_MSA_STAGE9B2:'1',ABC_JAVA_TCP_FALLBACK:'1'};
  delete env.ABC_EMULATOR_IMPORT_DIR;return env;
}

export async function requireFreePilotPorts(ports=PILOT_PORTS){
  const occupied=await Promise.all(ports.map(portOccupied));
  if(occupied.some(Boolean))throw safe('Pilot dibatalkan: port '+ports.filter((p,i)=>occupied[i]).join(', ')+' sedang digunakan. Tutup layanan yang Anda kenal melalui jendelanya. Pilot tidak mengambil alih atau mematikan proses lain.');
}

export function pilotSource(){
  const source=fictionalRosterData();
  // Admin pairing uses the existing display directory. Keep pilot labels equal
  // on both pages; only these fictional fixture records are seeded.
  for(const school of source.schools)school.name=SCHOOL_CONFIG.find(s=>s.id===school.id)?.name??school.name;
  for(const group of source.groups)group.name=GROUP_CONFIG.find(g=>g.id===group.id)?.name??group.name;
  source.serviceSessions.push({id:'fictional-a23-current',schoolId:'s1',date:jakartaToday(),groupIds:['g1','g2']});
  source.defaultMentorAssignments.push({id:'fictional-backup-default',groupId:'g2',mentorId:'fictional-substitute',effectiveFrom:'2026-01-01'});
  source.students.push({id:'fictional-backup-student',name:'Siswa Backup Fiktif',schoolClass:'4A',schoolId:'s1',groupId:'g2',active:true});
  delete source.studentPrivateProfiles;source.sessions=[];return source;
}

export async function preparePilot(context,{auth,adminAuthentication,password,picPassword,check}){
  check();
  if(!context.config.namespace.startsWith('test-auth-pilot-'))throw safe('Namespace fixture pilot tidak valid.');
  const uid=JSON.parse(process.env.ABC_ADMIN_UIDS)[0],email=uid+'@example.invalid';
  // Fresh emulator + namespace, create-only. No reset, account rewrite or HTTP provisioning.
  const batch=context.db.batch();
  for(const r of fixtureRecords(pilotSource()))batch.create(context.root.collection(r.collection).doc(r.id),r.data);
  batch.create(context.root.collection('adminPairingPermissions').doc(uid),{active:true,grants:['g1','g2'].map(groupId=>({schoolId:'s1',groupId,serviceSessionId:'fictional-a23-current'}))});
  await batch.commit();check();
  await auth.createUser({uid,email,password});check();
  await initializeOwner({...context,auth,uid,email,confirmed:true});check();
  const token=await adminAuthentication.signIn({email,password});
  try{await adminAuthentication.a1.legacyPilot.claim({header:'Bearer '+token,username:PILOT_USERNAME,password,expectedUid:uid,reason:'Penyiapan peninjau fiktif melalui peluncur lokal terisolasi',confirmed:true});}
  finally{adminAuthentication.revoke(token);}
  if(process.env.ABC_MSA_STAGE8==='1')await seedStage8Fixture(context,{uid,fictional:true,confirmed:true,scope:{schoolId:'s1',groupId:'g1',serviceSessionId:'fictional-a23-current'}});
  if(process.env.ABC_MSA_STAGE9A==='1')for(const organizationId of ['fictional-abc-movement','fictional-yayasan-abc'])await seedEventGrant(context,{uid,organizationId,permissions:process.env.ABC_MSA_STAGE9B1==='1'?[...eventPermissions,...calendarPermissions]:eventPermissions,fictional:true,confirmed:true});
  if(process.env.ABC_MSA_STAGE9B1==='1')await seedCalendarFixture(context,{uid,auth,events:adminAuthentication.a1.events,calendar:adminAuthentication.a1.calendar,fictional:true,confirmed:true});
  if(picPassword){
    if(picPassword===password)throw safe('Kata sandi Admin harus berbeda dari peninjau.');
    const ownerToken=await adminAuthentication.signIn({email,password});
    try{
      const checkOwner=async()=>(await adminAuthentication.authorize('Bearer '+ownerToken)).kind==='ok';
      const created=await adminAuthentication.accounts.create(uid,{email:'pic-'+randomUUID()+'@example.invalid',password:picPassword,actions:['pairing:read','pairing:issue'],grants:[{schoolId:'s1',groupId:'g1',serviceSessionId:'fictional-a23-current'}]},checkOwner);
      const user=await auth.getUser(created.uid),picToken=await adminAuthentication.signIn({email:user.email,password:picPassword});
      try{await adminAuthentication.a1.legacyPilot.claim({header:'Bearer '+picToken,username:PIC_USERNAME,password:picPassword,expectedUid:created.uid,reason:'Setup eksplisit identitas PIC fiktif terpisah oleh operator lokal',confirmed:true});}finally{adminAuthentication.revoke(picToken);}
      const a1=adminAuthentication.a1,actor=await adminAuthentication.authorize('Bearer '+ownerToken);
      // These are explicit fixture grants, never derived from the PIC label.
      const ownerActor={...actor,check:checkOwner};
      await a1.core.saveMember(ownerActor,'fictional-abc-movement',created.uid,{role:'viewer',status:'active',expectedRevision:0,requestId:randomUUID(),reason:'Membership satu organisasi untuk fixture PIC terbatas',confirmed:true});
      await seedEventGrant(context,{uid:created.uid,organizationId:'fictional-abc-movement',permissions:[...eventPermissions,'events:calendar:read'],fictional:true,confirmed:true});
      const startDate=new Date(Date.parse(jakartaToday()+'T00:00:00Z')+86400000).toISOString().slice(0,10),id='fictional-pic-upcoming';
      const control=()=>({requestId:randomUUID(),expectedRevision:0,reason:'Contoh pelayanan mendatang untuk PIC fiktif terbatas',confirmed:true});
      await a1.events.save(ownerActor,'fictional-abc-movement',id,{...control(),name:'Pelayanan PIC Fiktif',startDate,startTime:'09:00',timezone:'Asia/Jakarta',venue:'Aula Fiktif',programId:null,picMembershipId:coreMembershipId('fictional-abc-movement',created.uid)});
      await a1.calendar.transition(ownerActor,'fictional-abc-movement',id,'publish',{...control(),expectedRevision:1});
    }finally{adminAuthentication.revoke(ownerToken);}
  }
  check();
}

export async function openPilotPages({adminOrigin}){
  for(const url of [adminOrigin+'/'])await new Promise((resolve,reject)=>{
    const child=spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true,stdio:'ignore'});child.once('spawn',resolve);child.once('error',reject);
  });
}

// Restricted test delivery is an in-process call from the launcher's local
// terminal. No pipe/HTTP endpoint, file, URL, clipboard or log receives secrets.
export async function recoverPilotAccount({recovery,username,askPassword,delivery}){
  const challenge=delivery??await recovery.deliver(username);
  try{let password=await askPassword();try{return {result:await recovery.reset({...challenge,password})};}finally{password='';}}
  catch(error){return {...(error.status===403?{}:{delivery:challenge}),error:error.status===503?'Pemulihan belum selesai. Akses ditutup; ulangi perintah yang sama.':'Pemulihan belum berhasil. Periksa tinjauan, kata sandi dan batas waktu, lalu ulangi perintah.'};}
}

export async function runPilot({base=process.env,ports=PILOT_PORTS,address=PILOT_ADDRESS,askPassword=askDemoPassword,askPicPassword=askDemoPassword,askRecoveryPassword,prerequisites=checkPrerequisites,open=openPilotPages,input=process.stdin,output=process.stdout,log=console.log,onReady,unified=false}={}){
  const env=pilotEnvironment(base,{ports}),prior={...process.env};
  // Exclude fresh namespace/UID values: reuse compares the running source and
  // launcher contract, not credentials or a newly generated fixture identity.
  const signature=await serviceSignature({ABC_MSA_VISUAL_V1A:env.ABC_MSA_VISUAL_V1A});
  const existing=await controlRequest(address,'status');
  if(existing){
    if(existing.protocol!==1||existing.unified!==unified||existing.signature!==signature||JSON.stringify(existing.ports)!==JSON.stringify(ports))throw safe('Instance MSA yang berjalan memakai mode, versi aplikasi atau port berbeda. Hentikan melalui Stop MSA.cmd atau Enter di jendela launcher, lalu jalankan Start MSA.cmd kembali. Instance lama tidak diubah.');
    log('Pilot sudah berjalan. Membuka kembali portal MSA.');if(existing.phase==='ready')await open({adminOrigin:'http://127.0.0.1:'+ports[6]});return;
  }
  let phase='starting',emulator,context,app,terminal,monitor,bootstrap,stopping,controller;
  let recovery;const deliveries=new Map();
  const resources={servers:[],auths:[]},abort=new AbortController();
  let finish;const finished=new Promise(resolve=>finish=resolve);
  const check=()=>{if(abort.signal.aborted)throw safe('Penyiapan pilot dibatalkan.');for(const key of Object.keys(env))if(process.env[key]!==env[key])throw safe('Konfigurasi pilot berubah; akses ditutup.');};
  const stop=()=>{
    if(phase==='stopped')return Promise.resolve();if(stopping)return stopping;
    abort.abort();clearInterval(monitor);
    stopping=(async()=>{
      if(bootstrap)await bootstrap.catch(()=>{});phase='stopping';log('Menghentikan pilot dan menutup data sementara…');
      await closeDemoServers(resources);resources.servers.length=0;resources.auths.length=0;
      await context?.close();context=null;
      if(app){const {deleteApp}=await import('firebase-admin/app');await deleteApp(app);app=null;}
      await stopManagedEmulator(emulator);terminal?.close();controller?.close();
      process.removeListener('SIGINT',onSignal);process.removeListener('SIGTERM',onSignal);
      for(const key of Object.keys(process.env))if(!(key in prior))delete process.env[key];Object.assign(process.env,prior);
      phase='stopped';log('Pilot berhenti. Data sementara tidak disimpan. Demo reguler tidak diubah.');finish();
    })().catch(()=>{stopping=null;phase='stop-error';log('Penghentian pilot belum terkonfirmasi. Biarkan jendela ini terbuka dan jalankan Stop MSA.cmd lagi.');});return stopping;
  };
  const onSignal=()=>void stop();
  controller=await createController(address,async command=>{if(command==='stop')await stop();return {phase,protocol:1,unified,signature,ports};});
  process.on('SIGINT',onSignal);process.on('SIGTERM',onSignal);
  bootstrap=(async()=>{
    log('1/4 · Memeriksa prasyarat dan port pilot. Data fiktif dimulai dari awal.');
    await prerequisites();await requireFreePilotPorts(ports);
    Object.assign(process.env,env);delete process.env.ABC_EMULATOR_IMPORT_DIR;check();
    const parent=path.join(ROOT,'.emulator-data/auth-pilot');await mkdir(parent,{recursive:true});
    const realRoot=await realpath(ROOT),realParent=await realpath(parent),relative=path.relative(realRoot,realParent);
    if(relative.startsWith('..')||path.isAbsolute(relative))throw safe('Folder diagnostik pilot berada di luar proyek.');
    const state=await mkdtemp(path.join(parent,'run-')),temp=path.join(state,'temp');await mkdir(temp);
    const [firestore,auth,hub,logging,websocket,api,admin,mentor]=ports,config=path.join(state,'firebase.json');
    await writeFile(config,JSON.stringify({firestore:{rules:path.join(ROOT,'firestore.rules'),indexes:path.join(ROOT,'firestore.indexes.json')},emulators:{firestore:{host:'127.0.0.1',port:firestore,websocketPort:websocket},auth:{host:'127.0.0.1',port:auth},hub:{host:'127.0.0.1',port:hub},logging:{host:'127.0.0.1',port:logging},ui:{enabled:false},singleProjectMode:true}}));
    const childEnv={...env,TEMP:temp,TMP:temp,CI:'true',JAVA_TOOL_OPTIONS:(env.JAVA_TOOL_OPTIONS??'')+' -Djdk.net.unixdomain.tmpdir="'+path.join(state,'no-unix-sockets')+'"'};
    if(childEnv.JAVA_HOME){const key=Object.keys(childEnv).find(k=>k.toLowerCase()==='path')??'PATH';childEnv[key]=path.join(childEnv.JAVA_HOME,'bin')+path.delimiter+(childEnv[key]??'');}
    check();await requireFreePilotPorts(ports);
    emulator=spawnManagedEmulator([path.join(ROOT,'node_modules/firebase-tools/lib/bin/firebase.js'),'emulators:start','--only','firestore,auth','--project','demo-abc-attendance','--config',config,'--non-interactive'],{cwd:state,env:childEnv,logFile:path.join(state,'emulator.log')});
    const ready=async()=>{if(emulator.exitCode!==null||emulator.signalCode!==null)throw safe('Emulator milik pilot sudah berhenti.');const hub=await verifyHub({ports:ports.slice(0,5),locatorDirectory:temp});if(hub.pid!==emulator.pid)throw safe('Identitas emulator tidak cocok dengan proses pilot.');return hub;};
    await waitFor(()=>ready(),{alive:()=>!abort.signal.aborted&&emulator.exitCode===null&&emulator.signalCode===null});check();
    log('2/4 · Buat kata sandi peninjau fiktif (12–128 karakter). Input tidak terlihat; ketik lalu Enter dan ulangi.');
    let password=await askPassword({input,output,signal:abort.signal});
    try{
      if(typeof password!=='string'||password.length<12||password.length>128)throw safe('Kata sandi harus 12–128 karakter. Nyalakan ulang pilot.');
      check();await ready();context=await createFirestoreEmulatorRepositories();
      const {initializeApp}=await import('firebase-admin/app'),{getAuth}=await import('firebase-admin/auth');
      app=initializeApp({projectId:'demo-abc-attendance'},'auth-pilot-'+randomUUID());
      const adminAuthentication=await createLocalAdminAuthentication(context);resources.auths.push(adminAuthentication);
      recovery=adminAuthentication.a1.recovery;
      let picPassword;
      try{
        if(unified){log('Buat kata sandi Admin fiktif terpisah (12–128 karakter), lalu ulangi.');picPassword=await askPicPassword({input,output,signal:abort.signal});if(typeof picPassword!=='string'||picPassword.length<12||picPassword.length>128||picPassword===password)throw safe('Kata sandi Admin harus 12–128 karakter dan berbeda dari peninjau.');}
        await preparePilot(context,{auth:getAuth(app),adminAuthentication,password,picPassword,check});
      }finally{picPassword='';}
      log('3/4 · Menyiapkan halaman Mentor dan peninjau…');
      const options={mentorOrigin:'http://127.0.0.1:'+mentor,adminOrigin:'http://127.0.0.1:'+admin};
      const apiAuthentication=await createLocalAdminAuthentication(context);resources.auths.push(apiAuthentication);
      resources.servers.push(await listen(createRosterServer({...context,adminAuthentication:apiAuthentication,mentorOrigin:options.mentorOrigin}),api));
      resources.servers.push(await listen(wrapPilotServer(createAdminServer({adminAuthentication,pairing:context.pairing,portal:unified}),{...options,unified}),admin));
      resources.servers.push(await listen(wrapPilotServer(createPrototypeServer({mentorMode:true,apiOrigin:'http://127.0.0.1:'+api,visual:adminAuthentication.a1.visual}),{...options,mentor:true,unified}),mentor));
      check();await ready();await appsReady(resources);phase='ready';
      log('4/4 · Pilot siap — hanya data fiktif.\nPeninjau: '+PILOT_USERNAME+' (kata sandi yang baru Anda buat).\nMentor: '+options.mentorOrigin+'/\nPanduan: '+options.mentorOrigin+'/pilot.html\nPendaftaran: '+options.adminOrigin+'/register.html\nTinjauan: '+options.adminOrigin+'/identity-review.html\nPemulihan: '+options.adminOrigin+'/account-recovery.html\nAdmin / aktivasi: '+options.adminOrigin+'/username.html\nSesudah review pemulihan disetujui, operator tepercaya mengetik: pulihkan <username>. Pemilik mengisi kata sandi baru sendiri tanpa tampil.\nTekan Enter untuk berhenti atau klik Stop MSA.cmd. Semua data pilot sementara.');
      if(unified)log('Portal MSA: '+options.adminOrigin+'/ · Admin: '+PIC_USERNAME+' (kata sandi Admin yang baru dibuat).');
      await onReady?.({context,options,resources,state,stop});
      try{await open(options);}catch{log('Browser belum terbuka. Gunakan tautan pilot di atas.');}
      monitor=setInterval(()=>{if(phase==='ready')void ready().then(()=>appsReady(resources)).then(check).catch(()=>{log('Layanan pilot terputus. Akses ditutup; nyalakan ulang untuk memakai data fiktif baru.');void stop();});},5000);monitor.unref();
    }finally{password='';}
  })();
  try{await bootstrap;}catch(error){log(error.pilotSafe||error.demoSafe?error.message:'Pilot belum siap. Periksa prasyarat, emulator dan kata sandi. Rincian rahasia tidak dicetak.');process.exitCode=1;await stop();}
  const attachTerminal=()=>{
    if(phase!=='ready')return;
    terminal=createInterface({input,output});terminal.once('close',()=>void stop());
    terminal.on('line',line=>{
      if(!line.trim()){void stop();return;}
      const match=/^pulihkan ([A-Za-z0-9][A-Za-z0-9._-]{2,31})$/.exec(line.trim());
      if(!match){log('Gunakan pulihkan <username> untuk pemulihan fiktif, atau Enter untuk berhenti.');return;}
      // Remove readline completely before hidden input so it cannot echo keys.
      terminal.removeAllListeners('close');terminal.removeAllListeners('line');terminal.close();terminal=null;
      void (async()=>{
        const username=match[1].toLowerCase();
        try{
          check();log('Pemilik akun: isi kata sandi baru sendiri. Operator tidak perlu mengetahuinya.');
          const ask=askRecoveryPassword??(async()=>{let password=await hiddenInput('Kata sandi baru (12–128 karakter, tidak tampil): ',{input,output,signal:abort.signal});try{if(password!==await hiddenInput('Ulangi kata sandi baru (tidak tampil): ',{input,output,signal:abort.signal}))throw Error();return password;}finally{password='';}});
          const r=await recoverPilotAccount({recovery,username,askPassword:ask,delivery:deliveries.get(username)});
          if(r.delivery)deliveries.set(username,r.delivery);else deliveries.delete(username);
          log(r.error??r.result.message);
        }catch{log('Pemulihan ditolak. Periksa persetujuan baru dan masa berlaku. Akun owner tidak dipulihkan melalui pilot.');}
        finally{attachTerminal();}
      })();
    });
  };
  attachTerminal();
  await finished;
}

export async function stopPilot({address=PILOT_ADDRESS,log=console.log}={}){
  const status=await controlRequest(address,'stop');
  if(!status){log('Pilot tidak sedang berjalan. Layanan lain tidak diubah.');return;}
  if(status.phase!=='stopped')throw safe('Penghentian belum terkonfirmasi. Periksa jendela pilot lalu coba Stop lagi.');
  log('Pilot berhenti; layanan milik pilot telah ditutup.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const command=process.argv[2];
  const work=process.platform!=='win32'||process.argv.length!==3?Promise.reject(safe('Gunakan peluncur Windows Start/Stop MSA.cmd.')):command==='start'?runPilot():command==='stop'?stopPilot():Promise.reject(safe('Perintah pilot tidak valid.'));
  work.catch(error=>{console.error(error.pilotSafe||error.demoSafe?error.message:'Peluncur pilot gagal. Periksa Node.js, Java, dependensi dan port lokal.');process.exitCode=1;});
}
