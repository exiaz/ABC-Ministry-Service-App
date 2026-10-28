import test from 'node:test';
import assert from 'node:assert/strict';
import {visualMetadata,visualMutation,visualSlot} from '../backend/msa-visual-contract.mjs';

const bad=fn=>assert.throws(fn,error=>error.status===400);
test('Visual slots are explicit and reject paths, unimplemented slots and inherited names',()=>{
  for(const slot of ['welcome','login','registration','dashboard'])assert.equal(visualSlot(slot),slot);
  for(const slot of ['../login','program','campaign','constructor','LOGIN','',null])bad(()=>visualSlot(slot));
});
test('Visual metadata permits descriptive or decorative alt and bounded focal points',()=>{
  assert.deepEqual(visualMetadata({alt:'  Gambar pelayanan  ',x:0,y:100}),{alt:'Gambar pelayanan',x:0,y:100});
  assert.deepEqual(visualMetadata({alt:'',x:50,y:45}),{alt:'',x:50,y:45});
  for(const value of [{alt:'x',x:-1,y:50},{alt:'x',x:50,y:101},{alt:'x',x:1.5,y:0},{alt:'a\n',x:0,y:0},{alt:'x'.repeat(161),x:0,y:0},{alt:'x',x:0,y:0,file:'../x'}])bad(()=>visualMetadata(value));
});
test('Visual publication commands require confirmation, revision, reason and bounded request identity',()=>{
  const valid={expectedRevision:0,requestId:'fictional_1',reason:'Pembaruan gambar',confirmed:true};
  assert.deepEqual(visualMutation(valid),valid);
  for(const value of [{...valid,expectedRevision:-1},{...valid,expectedRevision:1.5},{...valid,requestId:'../x'},{...valid,reason:'abc'},{...valid,reason:'alasan\nbaru'},{...valid,confirmed:false},{...valid,slot:'login'}])bad(()=>visualMutation(value));
});
