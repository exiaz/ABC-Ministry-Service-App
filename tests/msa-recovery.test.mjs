import test from 'node:test';
import assert from 'node:assert/strict';
import {recoveryPassword} from '../backend/msa-recovery.mjs';
import {recoverPilotAccount,pilotEnvironment} from '../local-auth-pilot.mjs';
import {demoEnvironment} from '../local-demo.mjs';
test('A2.4B password policy matches registration and rejects controls/unpaired surrogates',()=>{
  for(const value of ['x'.repeat(12),'x'.repeat(128)])assert.equal(recoveryPassword(value),true);
  for(const value of [undefined,'x'.repeat(11),'x'.repeat(129),'x'.repeat(12)+'\n','x'.repeat(12)+'\u200b','x'.repeat(12)+'\ud800'])assert.equal(recoveryPassword(value),false);
  assert.equal(pilotEnvironment({}).ABC_MSA_A2_4B,'1');assert.equal(demoEnvironment({}).ABC_MSA_A2_4B,undefined);
});
test('Trusted pilot delivery stays in memory, preserves authorization for retry and clears it on completion',async()=>{
  const delivery={id:'fictional-request',secret:'fictional-secret'},calls=[];let fail=true;
  const recovery={deliver:async username=>{calls.push(username);return delivery;},reset:async value=>{calls.push(Object.keys(value));if(fail)throw Object.assign(Error(),{status:503});return {reset:true};}};
  const first=await recoverPilotAccount({recovery,username:'fictional',askPassword:async()=>'fictional-password'});assert.equal(first.delivery,delivery);assert.match(first.error,/Akses ditutup/);
  fail=false;const second=await recoverPilotAccount({recovery,username:'fictional',delivery:first.delivery,askPassword:async()=>'fictional-password'});assert.equal(second.delivery,undefined);assert.equal(second.result.reset,true);assert.equal(calls.filter(x=>x==='fictional').length,1);
});
