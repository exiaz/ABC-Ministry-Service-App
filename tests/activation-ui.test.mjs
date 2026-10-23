import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminActivation,activationCodesFrom} from '../admin-activation.js';
import {createSecureMentor} from '../secure-mentor.js';
const assignment={schoolId:'s1',groupId:'g13',serviceSessionId:'fictional-stage4',serviceDate:'2026-10-23',mentorId:'mentor-louis',mentorName:'Kak Louis',schoolName:'SDN Pacarkeling V',groupName:'Hagai'};
const row=(index=0)=>{const createdAt=Date.now();return ({pairingId:String(index+1).repeat(64),createdAt,expiresAt:createdAt+172800000,state:'pending',assignment:{...assignment,...(index?{groupId:'g1',groupName:'Yoel'}:{})}});};
function fixture(){
  const calls=[],client={state:{phase:'active'},async readActivationCodes(){return {codes:[]};},async issueActivationCodes(body){calls.push(structuredClone(body));return {codes:body.grants.map((s,i)=>({...row(i),assignment:{...row(i).assignment,...s},code:String.fromCharCode(65+i).repeat(22)}))};}};
  const panel=createAdminActivation(client,()=>{}),grants=[0,1].map(i=>Object.fromEntries(['schoolId','groupId','serviceSessionId'].map(id=>[id,row(i).assignment[id]])));
  return {panel,client,calls,grants};
}
test('48-hour code projection drops raw secrets/private extras and rejects malformed assignments or expiry',()=>{
  const source=row();assert.deepEqual(activationCodesFrom({codes:[{...source,code:'SECRET',assignment:{...source.assignment,guardianName:'PRIVATE'}}]}),[source]);
  for(const patch of [{expiresAt:source.expiresAt+1},{state:'unknown'},{assignment:{...assignment,mentorId:'../private'}},{assignment:{...assignment,serviceDate:'2026-02-30'}}])assert.throws(()=>activationCodesFrom({codes:[{...source,...patch}]}));
});
test('Bulk UI preserves one idempotent intent, reveals each code once, and ignores results after logout',async()=>{
  const f=fixture();await f.panel.load();let release;const issue=f.client.issueActivationCodes;
  f.client.issueActivationCodes=async body=>{await new Promise(resolve=>{release=resolve;});return issue(body);};
  const pending=f.panel.issue(f.grants);await f.panel.issue(f.grants);release();await pending;
  assert.equal(f.calls.length,1);assert.equal(f.panel.rows.length,2);assert.match(f.calls[0].idempotencyKey,/^[a-f0-9-]{36}$/);assert.match(f.panel.view(),/A{22}/);assert.match(f.panel.view(),/B{22}/);
  assert.equal(JSON.stringify(f.panel.rows).includes('A'.repeat(22)),false);f.panel.hide();assert.equal(f.panel.view().includes('A'.repeat(22)),false);
  const next=f.panel.issue(f.grants);f.client.state.phase='signed-out';f.panel.reset();release();await next;assert.deepEqual(f.panel.rows,[]);assert.equal(f.panel.view().includes('B'.repeat(22)),false);
});
test('Ambiguous bulk retries use the same key, do not redisplay codes, and revocation waits for verified readback',async()=>{
  const f=fixture(),calls=[];await f.panel.load();const metadata=[row()];
  f.client.issueActivationCodes=async body=>{calls.push(structuredClone(body));if(calls.length===1)throw Error();throw Object.assign(Error(),{status:409,duplicateSubmission:true,codes:metadata});};
  await f.panel.issue([f.grants[0]]);f.panel.reset({preserveIntent:true});await f.panel.load();await f.panel.retry();assert.deepEqual(calls[0],calls[1]);assert.equal(f.panel.rows.length,1);assert.equal(f.panel.view().includes('data-activation-code'),false);
  let revoked=0;f.client.revokePairingCode=async id=>{revoked++;return {pairingId:id,state:'revoked'};};
  await f.panel.revoke(metadata[0].pairingId);assert.equal(revoked,0);
  f.client.readActivationCodes=async()=>({codes:[{...metadata[0],state:'revoked'}]});await f.panel.revoke(metadata[0].pairingId,true);assert.equal(revoked,1);assert.equal(f.panel.rows[0].state,'revoked');
});
test('Resolved server assignment opens its roster without manual school/date/group choices and rejects mismatched context',async()=>{
  let contexts=[assignment],reads=0;
  const client={state:{phase:'active',assignment},async readContexts(){return {contexts};},async readRoster(s){reads++;return {...s,students:[]};},async readAttendance(s){return {...s,batchId:null,state:'not-started',revision:0,updatedAt:null,finalizedAt:null,records:[]};}};
  const panel=createSecureMentor({client,render:()=>{},icon:()=>'',steps:()=>'',art:()=>'',openModal:()=>{},closeModal:()=>{}});
  await panel.refresh();await new Promise(resolve=>setImmediate(resolve));assert.equal(reads,1);assert.match(panel.view(),/Penugasan dipilih oleh server/);assert.doesNotMatch(panel.view(),/data-action="select-school"|data-action="select-group"|data-action="back-groups"/);
  panel.action('select-group','g1');assert.equal(reads,1);contexts=[{...assignment,groupId:'g1'}];await panel.refresh();assert.match(panel.view(),/data-state="context-error"/);assert.equal(reads,1);
});
