import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {randomBytes,randomUUID} from 'node:crypto';
import path from 'node:path';
import {recoverDemoPassword,DEMO_ADMIN} from '../provision-demo.mjs';
import {demoEnvironment,confirmRecovery,recoverAndRun,createController,controllerPath,controlRequest} from '../local-demo.mjs';

test('Recovery confirmation defaults to cancel and leaves an active launcher untouched',async t=>{
  const input=new PassThrough(),output=new PassThrough();let text='';output.on('data',data=>text+=data);
  const cancelled=confirmRecovery({input,output});input.write('\n');assert.equal(await cancelled,false);assert.match(text,/Absensi serta izin perangkat tetap/);
  const confirmed=confirmRecovery({input,output});input.write('GANTI\n');assert.equal(await confirmed,true);input.destroy();output.destroy();
  const address=controllerPath(path.resolve('recovery-cancel-'+randomUUID()));let stopped=0;
  const server=await createController(address,command=>{if(command==='stop')stopped++;return {phase:'ready'};});t.after(()=>new Promise(resolve=>server.close(resolve)));
  await recoverAndRun({address,confirm:async()=>false,log:()=>{},environment:()=>{throw Error('Tidak boleh memulai aplikasi.');}});assert.equal(stopped,0);assert.equal((await controlRequest(address,'status')).phase,'ready');
});
test('Trusted recovery only updates the fixed demo password after explicit confirmation and local guards',async()=>{
  const original={...process.env};Object.assign(process.env,demoEnvironment({}));const calls=[],secret=randomBytes(24).toString('base64url');
  const auth={async getUser(uid){calls.push(['read',uid]);return {...DEMO_ADMIN,disabled:false};},async updateUser(uid,values){calls.push(['update',uid,Object.keys(values)]);assert.equal(values.password===secret,true);},async revokeRefreshTokens(uid){calls.push(['revoke',uid]);}};
  try{
    assert.deepEqual(await recoverDemoPassword({auth,confirmed:false}),{changed:false});assert.deepEqual(await recoverDemoPassword({auth,confirmed:'GANTI'}),{changed:false});assert.equal(calls.length,0);
    assert.deepEqual(await recoverDemoPassword({auth,confirmed:true,askPassword:async()=>secret}),{changed:true});assert.deepEqual(calls.filter(c=>c[0]==='update'),[['update',DEMO_ADMIN.uid,['password']]]);assert.deepEqual(calls.at(-1),['revoke',DEMO_ADMIN.uid]);
    for(const badUser of [{...DEMO_ADMIN,email:'another@example.invalid'},{...DEMO_ADMIN,disabled:true},{...DEMO_ADMIN,uid:'another-uid'}])await assert.rejects(recoverDemoPassword({auth:{...auth,async getUser(){return badUser;}},confirmed:true,askPassword:async()=>secret}),/tidak cocok/);
    const updates=calls.filter(c=>c[0]==='update').length;
    await assert.rejects(recoverDemoPassword({auth,confirmed:true,askPassword:async()=>{process.env.FIREBASE_AUTH_EMULATOR_HOST='example.com:9099';return secret;}}));assert.equal(calls.filter(c=>c[0]==='update').length,updates);
  }finally{for(const key of Object.keys(process.env))if(!(key in original))delete process.env[key];Object.assign(process.env,original);}
});
