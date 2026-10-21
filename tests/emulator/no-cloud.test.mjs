import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {emulatorFixture} from './fixture.mjs';
import {fictionalRosterData,scope} from '../fixtures/roster.mjs';

test('SDK initialization and repository operations attempt no non-loopback network connections or metadata lookup',async()=>{
  const original=net.Socket.prototype.connect,attempts=[],warnings=[];
  const warning=entry=>{if(entry.name==='MetadataLookupWarning')warnings.push(entry.message);};
  process.on('warning',warning);
  net.Socket.prototype.connect=function(...args){
    const values=Array.isArray(args[0])?args[0]:args;
    const first=values[0];
    const host=first&&typeof first==='object'?first.host:typeof values[1]==='string'?values[1]:undefined;
    if(host&&!['127.0.0.1','::1','localhost'].includes(host)){
      attempts.push(host);throw Error('Tes melarang koneksi non-loopback.');
    }
    return original.apply(this,args);
  };
  let context;
  try{
    context=await emulatorFixture({source:fictionalRosterData()});
    const token=await context.credentials.issue({grants:[scope]});
    assert.ok(await context.credentials.authenticate('Bearer '+token));
    assert.ok(await context.repository.read(scope));await context.credentials.revoke(token);
    await context.close();context=null;
    assert.deepEqual(attempts,[]);assert.deepEqual(warnings,[]);
  }finally{
    if(context)await context.close();
    net.Socket.prototype.connect=original;process.off('warning',warning);
  }
});
