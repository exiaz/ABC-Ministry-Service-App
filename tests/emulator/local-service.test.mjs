import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {PassThrough} from 'node:stream';
import {mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {emulatorFixture} from './fixture.mjs';
import {adminLoginFixture} from './admin-login-fixture.mjs';
import {launcherRuntime,launcherEnvironment} from './launcher-runtime.mjs';
import {inspectLocalService,stopLocalService} from '../../local-service.mjs';
import {listen,prepareDemo,runDemo,waitFor,controllerPath,controlRequest,stopDemo,snapshotDirectory,previousSnapshot} from '../../local-demo.mjs';

test('Real manual API/Admin/Mentor are reused with auth intact; Stop leaves manual applications and emulators alive',{timeout:60000},async t=>{
  const runtime=launcherRuntime(),original={...process.env},c=await emulatorFixture(),f=await adminLoginFixture(t),identity={uid:f.uid,email:f.email},hub=await runtime.checkHub();
  const reservations=await Promise.all(Array.from({length:3},()=>listen(createServer(),0))),ports=reservations.map(s=>s.address().port);
  await Promise.all(reservations.map(s=>new Promise(resolve=>s.close(resolve))));
  const env={...launcherEnvironment(original),ABC_FIRESTORE_NAMESPACE:c.config.namespace,ABC_ADMIN_UIDS:JSON.stringify([f.uid]),ABC_ROSTER_PORT:String(ports[0]),ABC_ADMIN_PORT:String(ports[1]),ABC_MENTOR_PORT:String(ports[2]),ABC_API_ORIGIN:'http://127.0.0.1:'+ports[0],ABC_MENTOR_ORIGIN:'http://127.0.0.1:'+ports[2]};
  Object.assign(process.env,env);
  await prepareDemo(c,f.auth,{identity,assertLocal:()=>{},askPassword:()=>assert.fail('Akun lama tidak memerlukan password baru.')});
  const children=['backend/server.mjs','admin-server.mjs','mentor-server.mjs'].map(file=>spawn(process.execPath,[path.resolve(file)],{env,windowsHide:true,stdio:'ignore'}));
  const roles=['api','admin','mentor'],state=await mkdtemp(path.join(await snapshotDirectory(),'test-reuse-')),address=controllerPath(path.resolve('reuse-'+randomUUID())),input=new PassThrough(),output=new PassThrough(),logs=[];let running,opened=0;
  try{
    await waitFor(async()=>{const services=await Promise.all(ports.map((port,i)=>inspectLocalService(port,roles[i],{env})));return services.every(s=>s.kind==='compatible');},{timeout:15000,alive:()=>children.every(child=>child.exitCode===null)});
    const before=await Promise.all(ports.map((port,i)=>inspectLocalService(port,roles[i],{env})));
    const options={...runtime,ports,address,input,output,environment:()=>env,stateDirectory:async()=>state,prepare:(ctx,auth,settings)=>prepareDemo(ctx,auth,{...settings,identity}),open:async()=>{opened++;},log:s=>logs.push(s),confirmConflict:()=>assert.fail('Server cocok tidak perlu diganti.')};
    running=runDemo(options);await waitFor(async()=>((await controlRequest(address,'status'))?.phase==='ready'),{timeout:15000});
    const after=await Promise.all(ports.map((port,i)=>inspectLocalService(port,roles[i],{env})));
    assert.deepEqual(after.map(s=>s.status.instance),before.map(s=>s.status.instance));
    const base='http://127.0.0.1:'+ports[1];
    assert.equal((await fetch(base+'/api/admin/devices')).status,401);
    const login=await fetch(base+'/api/admin/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:f.email,password:f.password})});assert.equal(login.status,200);
    const {token}=await login.json();assert.equal((await fetch(base+'/api/admin/devices',{headers:{Authorization:'Bearer '+token}})).status,200);
    await runDemo(options);assert.equal(opened,2);assert.equal(children.every(child=>child.exitCode===null),true);
    await stopDemo({address,log:()=>{}});await running;running=null;
    assert.ok(await previousSnapshot(state));assert.equal((await runtime.checkHub()).pid,hub.pid);
    assert.equal((await c.root.collection('students').doc('fictional-hagai').get()).exists,true);
    assert.equal(logs.filter(s=>s.includes('digunakan kembali. Stop')).length,3);
    assert.equal(logs.join('\n').includes(f.password),false);assert.equal(logs.join('\n').includes(token),false);
    assert.equal(children.every(child=>child.exitCode===null),true);
    assert.equal((await fetch(base+'/api/admin/devices',{headers:{Authorization:'Bearer '+token}})).status,200);
  }finally{
    if(running){await stopDemo({address,log:()=>{}});await running;}
    for(const [i,port] of ports.entries()){const service=await inspectLocalService(port,roles[i],{env});if(service.kind!=='unknown')await stopLocalService(service);}
    input.destroy();output.destroy();await c.close();await rm(state,{recursive:true});
    for(const key of Object.keys(process.env))if(!(key in original))delete process.env[key];Object.assign(process.env,original);
  }
});
