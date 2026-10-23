import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import path from 'node:path';
import {emulatorFixture} from './fixture.mjs';
import {adminLoginFixture} from './admin-login-fixture.mjs';
import {launcherRuntime,launcherEnvironment} from './launcher-runtime.mjs';
import {prepareDemo,runDemo,controllerPath,controlRequest,stopDemo,waitFor,snapshotDirectory,previousSnapshot} from '../../local-demo.mjs';

test('Launcher provisions/reuses fictional data, starts protected servers, handles duplicate launch, exports on stop and leaves borrowed emulators alive',async t=>{
  const runtime=launcherRuntime(),original={...process.env},c=await emulatorFixture(),f=await adminLoginFixture(t),identity={uid:f.uid,email:f.email},hub=await runtime.checkHub();
  await f.auth.deleteUser(f.uid); // First launch starts with no account for this isolated fixture UID.
  const state=await mkdtemp(path.join(await snapshotDirectory(),'test-launch-')),address=controllerPath(path.resolve('integration-'+randomUUID())),input=new PassThrough(),output=new PassThrough(),logs=[];let opened=0,failExport=false,passwordPrompts=0;
  const environment=()=>({...launcherEnvironment(original),ABC_FIRESTORE_NAMESPACE:c.config.namespace,ABC_ADMIN_UIDS:JSON.stringify([f.uid])});
  const options={...runtime,address,input,output,ports:[0,0,0],environment,stateDirectory:async()=>state,askPassword:async()=>{passwordPrompts++;return f.password;},open:async()=>{opened++;},log:s=>logs.push(s),prepare:(ctx,auth,settings)=>prepareDemo(ctx,auth,{...settings,identity}),persist:async state=>{if(failExport){failExport=false;throw Error('Gangguan export sementara');}return runtime.persist(state);}};
  let running;
  try{
    running=runDemo(options);await waitFor(async()=>{const s=await controlRequest(address,'status');return s?.phase==='ready';},{timeout:15000});
    assert.equal(passwordPrompts,1);const status=await controlRequest(address,'status'),[api,admin,mentor]=status.ports;
    assert.equal((await fetch('http://127.0.0.1:'+api+'/api/admin/devices')).status,401);
    const login=await fetch('http://127.0.0.1:'+admin+'/api/admin/login',{method:'POST',headers:{Origin:'http://127.0.0.1:'+admin,'Content-Type':'application/json'},body:JSON.stringify({email:f.email,password:f.password})});assert.equal(login.status,200);
    const {token}=await login.json(),metadata=await fetch('http://127.0.0.1:'+admin+'/api/admin/pairing-context',{headers:{Authorization:'Bearer '+token}});assert.equal(metadata.status,200);assert.equal((await metadata.json()).contexts.find(s=>s.groupId==='g13').mentorName,'Kak Louis');
    const mentorPage=await fetch('http://127.0.0.1:'+mentor);assert.equal(mentorPage.headers.get('x-abc-mode'),'paired-local-fictional-roster');assert.match(await mentorPage.text(),new RegExp('127.0.0.1:'+api));
    await runDemo(options);assert.equal(opened,2);
    const student=c.root.collection('students').doc('fictional-hagai');await student.update({schoolClass:'5B'});
    await c.root.collection('adminPairingPermissions').doc(f.uid).update({active:false});
    await c.root.collection('sessions').doc('retained-history').create({id:'retained-history',records:[],serviceSessionId:'another-visit'});
    const initialSnapshot=await previousSnapshot(state);assert.ok(initialSnapshot);failExport=true;
    await assert.rejects(stopDemo({address,log:s=>logs.push(s)}),/Data belum tersimpan/);assert.equal((await controlRequest(address,'status')).phase,'save-error');assert.equal(await previousSnapshot(state),initialSnapshot);assert.equal((await runtime.checkHub()).pid,hub.pid);
    await stopDemo({address,log:s=>logs.push(s)});await running;running=null;assert.equal((await runtime.checkHub()).pid,hub.pid);
    const snapshot=await previousSnapshot(state);assert.ok(snapshot);const exported=JSON.parse(await readFile(path.join(snapshot,'firebase-export-metadata.json'),'utf8'));assert.equal(exported.auth.path,'auth_export');assert.equal(exported.firestore.path,'firestore_export');
    running=runDemo(options);await waitFor(async()=>{const s=await controlRequest(address,'status');return s?.phase==='ready';},{timeout:15000});
    assert.equal(passwordPrompts,1);assert.equal((await student.get()).data().schoolClass,'5B');assert.equal((await c.root.collection('adminPairingPermissions').doc(f.uid).get()).data().active,false);assert.equal((await c.root.collection('sessions').doc('retained-history').get()).exists,true);
    input.write('\n');await running;running=null;assert.equal(await controlRequest(address,'status'),null);assert.equal((await runtime.checkHub()).pid,hub.pid);assert.equal(logs.join('\n').includes(f.password),false);assert.equal(logs.join('\n').includes(token),false);
  }finally{
    if(running){await stopDemo({address,log:()=>{}});await running;}input.destroy();output.destroy();await c.close();
    assert.equal(path.resolve(state).startsWith(path.resolve(await snapshotDirectory())+path.sep),true);await rm(state,{recursive:true});
    for(const key of Object.keys(process.env))if(!(key in original))delete process.env[key];Object.assign(process.env,original);
  }
});
