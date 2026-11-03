import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {deviceRevocationInput} from '../backend/msa-device-lifecycle.mjs';
const valid=()=>({requestId:randomUUID(),expectedRevision:1,expectedAccountRevision:3,reason:'Perangkat fiktif diganti',confirmed:true});
test('Account device revocation requires explicit confirmation, reason, exact revisions and bounded fields',()=>{
  assert.equal(deviceRevocationInput(valid()).confirmed,true);
  for(const patch of [{confirmed:false},{confirmed:undefined},{expectedRevision:0},{expectedAccountRevision:1.5},{reason:'x'},{reason:'abcde\n'},{reason:'x'.repeat(301)},{requestId:'not-a-uuid'},{uid:'another-account'},{credential:'forged'}])assert.throws(()=>deviceRevocationInput({...valid(),...patch}));
});
