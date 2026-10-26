import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {PassThrough} from 'node:stream';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {listen,demoEnvironment,resolveDemoPorts,confirmPortRecovery,runDemo,controllerPath,createController,snapshotDirectory} from '../local-demo.mjs';
import {registerLocalService,inspectLocalService,stopLocalService,serviceSignature,serviceRequest,servicePath} from '../local-service.mjs';

async function fixture(t,{role='api',env=demoEnvironment({}),healthy=true}={}){
  const server=await listen(http.createServer((req,res)=>{res.writeHead(healthy?401:200,{'X-ABC-Mode':'test-foundation'});res.end('{}');}),0);
  let lifecycle,stops=0;
  const stop=async()=>{stops++;await new Promise(resolve=>{server.close(resolve);server.closeIdleConnections();});await lifecycle.close();};
  lifecycle=await registerLocalService(server,{role,env,stop});
  t.after(async()=>{if(server.listening)await stop();});
  return {server,port:server.address().port,stops:()=>stops,env};
}

test('Exact emulator config, allowlist, origins and source signature are required for reuse',async t=>{
  const f=await fixture(t);
  const inspected=await inspectLocalService(f.port,'api',{env:f.env});assert.equal(inspected.kind,'compatible');
  for(const key of ['ABC_FIRESTORE_NAMESPACE','ABC_ADMIN_UIDS','FIREBASE_AUTH_EMULATOR_HOST','ABC_MENTOR_ORIGIN','ABC_API_ORIGIN','ABC_ADMIN_AUTH_MODE','ABC_MSA_A1','ABC_MSA_USERNAME_PILOT','ABC_MSA_A2_2','ABC_MSA_A2_3','ABC_MSA_A2_4A','ABC_MSA_A2_4B','ABC_MSA_A2_4C']){
    assert.equal((await inspectLocalService(f.port,'api',{env:{...f.env,[key]:'different'}})).kind,'incompatible');
  }
  assert.notEqual(await serviceSignature(f.env),await serviceSignature({...f.env,FIREBASE_TOKEN:'fictional-rejected'}));
  assert.equal((await inspectLocalService(f.port,'mentor',{env:f.env})).kind,'unknown');
  const reuse=await resolveDemoPorts([f.port],{inspect:(port,role)=>inspectLocalService(port,role,{env:f.env}),log:()=>{},confirm:()=>assert.fail('Tidak boleh meminta konfirmasi server cocok.')});
  assert.equal(reuse[0].status.instance,inspected.status.instance);assert.equal(f.stops(),0);
  await stopLocalService(inspected);assert.equal(f.stops(),1);assert.equal(f.server.listening,false);
  await stopLocalService(inspected);assert.equal(f.stops(),1);
});

test('Stale/config-incompatible server is replaced only after confirmation; cancel preserves it',async t=>{
  const f=await fixture(t),inspect=(port,role)=>inspectLocalService(port,role,{env:{...f.env,ABC_FIRESTORE_NAMESPACE:'changed'}});
  await assert.rejects(resolveDemoPorts([f.port],{inspect,log:()=>{},confirm:async()=>false}),/dibatalkan/);assert.equal(f.stops(),0);
  let confirmed=0;const reused=await resolveDemoPorts([f.port],{inspect,log:()=>{},confirm:async service=>{assert.equal(service.kind,'incompatible');confirmed++;return true;}});
  assert.equal(confirmed,1);assert.equal(f.stops(),1);assert.equal(reused.length,0);
});

test('Unhealthy service or unrelated HTTP service cannot be reused or stopped by identification headers alone',async t=>{
  const f=await fixture(t,{healthy:false});assert.equal((await inspectLocalService(f.port,'api',{env:f.env})).kind,'unknown');
  await assert.rejects(resolveDemoPorts([f.port],{log:()=>{},confirm:async()=>false}),/dibatalkan/);assert.equal(f.stops(),0);
  const external=await listen(http.createServer((req,res)=>{res.writeHead(401,{'X-ABC-Mode':'test-foundation'});res.end();}),0);
  t.after(()=>new Promise(resolve=>external.close(resolve)));assert.equal((await inspectLocalService(external.address().port,'api')).kind,'unknown');
});

test('Unknown conflict can be retried in the same launcher after its owner closes it; new instance is never stopped',async()=>{
  let occupied=true,confirmations=0,stops=0;
  const result=await resolveDemoPorts([4175],{occupied:async()=>occupied,inspect:async()=>({kind:'unknown',port:4175}),confirm:async()=>{confirmations++;occupied=false;return true;},stop:()=>stops++,log:()=>{}});
  assert.equal(result.length,0);assert.equal(confirmations,1);assert.equal(stops,0);
  let inspections=0;
  await assert.rejects(resolveDemoPorts([4175],{occupied:async()=>true,inspect:async()=>({kind:'incompatible',port:4175,status:{instance:String(++inspections)}}),confirm:async()=>true,stop:()=>stops++,log:()=>{}}),/berubah/);assert.equal(stops,0);
});

test('Lifecycle stop requires the current instance; stale stop cannot stop a replacement',async t=>{
  const f=await fixture(t),service=await inspectLocalService(f.port,'api',{env:f.env});
  await serviceRequest(servicePath(f.port),{command:'stop',instance:randomUUID()});assert.equal(f.stops(),0);
  await assert.rejects(stopLocalService({...service,status:{...service.status,instance:randomUUID()}}),/berubah/);assert.equal(f.stops(),0);
});

test('Changed source bytes mark a live process stale even when configuration and health match',async()=>{
  const root=await mkdtemp(path.join(await snapshotDirectory(),'test-source-')),env=demoEnvironment({});
  const file=path.join(root,'sample.mjs');await writeFile(file,'// versi awal');
  const server=await listen(http.createServer((req,res)=>{res.writeHead(401,{'X-ABC-Mode':'test-foundation'});res.end();}),0);let lifecycle;
  const stop=async()=>{await new Promise(resolve=>{server.close(resolve);server.closeIdleConnections();});await lifecycle.close();};
  try{
    lifecycle=await registerLocalService(server,{role:'api',env,root,stop});
    assert.equal((await inspectLocalService(server.address().port,'api',{env,root})).kind,'compatible');
    await writeFile(file,'// versi berikutnya');
    const stale=await inspectLocalService(server.address().port,'api',{env,root});assert.equal(stale.kind,'incompatible');
    await stopLocalService(stale);
  }finally{if(server.listening)await stop();await rm(root,{recursive:true});}
});

test('Recovery prompt defaults to cancel; unknown ports permit retry only without destructive actions',async()=>{
  async function answer(kind,value){const input=new PassThrough(),output=new PassThrough();input.isTTY=true;output.isTTY=true;output.on('data',()=>{});const pending=confirmPortRecovery({port:4175,kind},{input,output});input.write(value+'\n');const result=await pending;input.destroy();output.destroy();return result;}
  assert.equal(await answer('incompatible',''),false);assert.equal(await answer('incompatible','GANTI'),true);
  assert.equal(await answer('unknown',''),true);assert.equal(await answer('unknown','BATAL'),false);
});

test('Old launcher without configuration attestation never opens pages or silently replaces services',async t=>{
  const address=controllerPath(path.resolve('old-'+randomUUID()));let stops=0;
  const controller=await createController(address,command=>{if(command==='stop')stops++;return {phase:'ready',ports:[4175,4177,4176]};});
  t.after(()=>new Promise(resolve=>controller.close(resolve)));
  await assert.rejects(runDemo({address,confirmConflict:async()=>false,open:()=>assert.fail('Browser tidak boleh dibuka.'),log:()=>{}}),/dibatalkan/);assert.equal(stops,0);
});
