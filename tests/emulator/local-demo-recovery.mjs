import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {snapshotDirectory,listen,waitFor,portOccupied,saveSnapshot,previousSnapshot,stopOwnedEmulator,prepareDemo} from '../../local-demo.mjs';
import {provisionDemo,DEMO_ADMIN} from '../../provision-demo.mjs';
import {createFirestoreEmulatorRepositories} from '../../backend/firestore-emulator.mjs';
import {createLocalAdminAuthentication} from '../../backend/admin-auth.mjs';

test('Owned emulators export and restart with the same admin password, modified roster and fictional history',async()=>{
  const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),base=await snapshotDirectory(),state=await mkdtemp(path.join(base,'test-recovery-'));
  const reservations=await Promise.all(Array.from({length:5},()=>listen(createServer(),0))),ports=reservations.map(s=>s.address().port);await Promise.all(reservations.map(s=>new Promise(resolve=>s.close(resolve))));
  const [firestore,auth,hub,logging,websocket]=ports,origin='http://127.0.0.1:'+hub,original={...process.env};
  let child,context,app,authentication;
  try{
    await mkdir(path.join(state,'temp'));const configFile=path.join(state,'firebase.json');
    await writeFile(configFile,JSON.stringify({firestore:{rules:path.join(projectRoot,'firestore.rules')},emulators:{firestore:{host:'127.0.0.1',port:firestore,websocketPort:websocket},auth:{host:'127.0.0.1',port:auth},hub:{host:'127.0.0.1',port:hub},logging:{host:'127.0.0.1',port:logging},ui:{enabled:false},singleProjectMode:true}}));
    Object.assign(process.env,{ABC_ROSTER_ADAPTER:'firestore-emulator',ABC_ADMIN_AUTH_MODE:'firebase-auth-emulator',ABC_FIREBASE_PROJECT_ID:'demo-abc-attendance',GCLOUD_PROJECT:'demo-abc-attendance',GOOGLE_CLOUD_PROJECT:'demo-abc-attendance',FIRESTORE_EMULATOR_HOST:'127.0.0.1:'+firestore,FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:'+auth,ABC_FIRESTORE_NAMESPACE:'launcher-recovery-'+randomUUID(),ABC_ADMIN_UIDS:JSON.stringify([DEMO_ADMIN.uid])});
    const env={...process.env,CI:'true',TEMP:path.join(state,'temp'),TMP:path.join(state,'temp'),JAVA_TOOL_OPTIONS:(process.env.JAVA_TOOL_OPTIONS??'')+' -Djdk.net.unixdomain.tmpdir="'+path.join(state,'no-unix-sockets')+'"'};
    const request=async(url,options={})=>{const response=await fetch(url.replace('http://127.0.0.1:4400',origin),{...options,signal:AbortSignal.timeout(options.timeout??2500)});if(!response.ok)throw Error('Emulator tes belum siap.');return response.json();};
    const start=async snapshot=>{
      const args=[path.join(projectRoot,'node_modules/firebase-tools/lib/bin/firebase.js'),'emulators:start','--only','firestore,auth','--project','demo-abc-attendance','--config',configFile,'--non-interactive'];if(snapshot)args.push('--import='+snapshot);
      child=spawn(process.execPath,args,{cwd:state,env,windowsHide:true,stdio:'ignore'});child.on('error',()=>{});
      await waitFor(async()=>{const value=await request(origin+'/emulators');return value.auth?.port===auth&&value.firestore?.port===firestore;},{alive:()=>child.exitCode===null&&child.signalCode===null});
    };
    const {initializeApp,deleteApp}=await import('firebase-admin/app'),{getAuth}=await import('firebase-admin/auth');
    await start();context=await createFirestoreEmulatorRepositories();app=initializeApp({projectId:'demo-abc-attendance'},'launcher-recovery-'+randomUUID());
    const password=randomBytes(24).toString('base64url');await provisionDemo({...context,auth:getAuth(app),assertLocal:()=>{},askPassword:async()=>password});
    await context.root.collection('students').doc('fictional-hagai').update({schoolClass:'5B'});await context.root.collection('attendanceHistory').doc('fictional-preserved').create({id:'fictional-preserved',revision:1,status:'unmarked'});
    const snapshot=await saveSnapshot(state,{verify:()=>request(origin+'/emulators'),request});assert.equal(await previousSnapshot(state),snapshot);
    await context.close();context=null;await deleteApp(app);app=null;await stopOwnedEmulator(child);await waitFor(async()=>!(await Promise.all(ports.map(portOccupied))).some(Boolean),{timeout:10000});
    await start(snapshot);context=await createFirestoreEmulatorRepositories();app=initializeApp({projectId:'demo-abc-attendance'},'launcher-recovery-'+randomUUID());
    authentication=await createLocalAdminAuthentication();const token=await authentication.signIn({email:DEMO_ADMIN.email,password});assert.equal((await authentication.authorize('Bearer '+token)).kind,'ok');
    assert.equal((await context.root.collection('students').doc('fictional-hagai').get()).data().schoolClass,'5B');assert.equal((await context.root.collection('attendanceHistory').doc('fictional-preserved').get()).data().revision,1);
    assert.equal((await prepareDemo(context,getAuth(app),{assertLocal:()=>{},askPassword:()=>{throw Error('Password tidak boleh direset.');}})).reused,true);
    await authentication.close();authentication=null;await context.close();context=null;await deleteApp(app);app=null;
  }finally{
    await authentication?.close();await context?.close();if(app){const {deleteApp}=await import('firebase-admin/app');await deleteApp(app);}await stopOwnedEmulator(child);
    assert.equal(path.resolve(state).startsWith(path.resolve(base)+path.sep),true);await rm(state,{recursive:true});
    for(const key of Object.keys(process.env))if(!(key in original))delete process.env[key];Object.assign(process.env,original);
  }
});
