import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {confirmOwner} from '../local-demo.mjs';
import {adminPolicy} from '../backend/admin-accounts.mjs';

test('Initial owner prompt defaults to cancel and requires the explicit local confirmation',async()=>{
  for(const [answer,expected] of [['',false],['GANTI',false],['TETAPKAN',true]]){
    const input=new PassThrough(),output=new PassThrough();input.isTTY=true;output.isTTY=true;output.on('data',()=>{});
    const pending=confirmOwner({input,output});input.write(answer+'\n');assert.equal(await pending,expected);input.destroy();output.destroy();
  }
});
test('Owner setup rejects noninteractive confirmation and handles shutdown cancellation',async()=>{
  const input=new PassThrough(),output=new PassThrough();assert.equal(await confirmOwner({input,output}),false);
  input.isTTY=true;output.isTTY=true;const abort=new AbortController();const pending=confirmOwner({input,output,signal:abort.signal});abort.abort();assert.equal(await pending,false);input.destroy();output.destroy();
});
test('Role storage failure never falls back to the old UID allowlist',async()=>{
  const root={collection:()=>({doc:()=>({get:async()=>{throw Error('Emulator tidak tersedia');}})})};
  await assert.rejects(adminPolicy(root,'demo-admin-local'),/Emulator tidak tersedia/);
});
