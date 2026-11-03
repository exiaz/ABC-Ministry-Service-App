import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {eventInput,eventDate,eventPermissions} from '../backend/msa-events.mjs';
import {seedEventGrant} from './fixtures/msa-events.mjs';
import {migrationCheckpoint} from '../backend/msa-migration.mjs';
import {hash} from '../backend/msa-accounts.mjs';
const value=()=>({requestId:randomUUID(),expectedRevision:0,reason:'Pembuatan draf fiktif',confirmed:true,name:'Pelayanan',startDate:'2028-02-29',startTime:'09:30',venue:'Aula fiktif',picMembershipId:'a'.repeat(64),programId:null});
test('Stage 9A validates strict draft fields, calendar date, explicit Indonesian timezone and no privilege injection',()=>{
  const v=eventInput(value());assert.equal(v.timezone,'Asia/Jakarta');assert.equal(new Date(v.startAt).toISOString(),'2028-02-29T02:30:00.000Z');assert.equal(v.programId,null);
  for(const patch of [{name:''},{name:'\u202eBohong'},{venue:''},{startDate:'2026-02-29'},{startDate:'2026-13-01'},{startTime:'24:00'},{startTime:'10:60'},{startTime:'9:30'},{startTime:['09:30']},{timezone:['Asia/Jakarta']},{timezone:null},{picMembershipId:['a'.repeat(64)]},{timezone:'UTC'},{timezone:'__proto__'},{picMembershipId:'name-match'},{programId:undefined},{organizationId:'other'},{status:'published'},{permissions:['events:publish']},{expectedRevision:-1}])assert.throws(()=>eventInput({...value(),...patch}),e=>e.status===400);
  for(const date of ['1999-01-01','2101-01-01','2026-04-31','2026-00-01','2026-01-00'])assert.throws(()=>eventDate(date),e=>e.status===400);
  for(const [timezone,hour] of [['Asia/Makassar','01'],['Asia/Jayapura','00']])assert.equal(new Date(eventInput({...value(),timezone}).startAt).toISOString(),'2028-02-29T'+hour+':30:00.000Z');
  assert.ok(!eventPermissions.includes('events:publish'));
});
test('Stage 9A fixture refuses operational scope and checkpoint detects event grant revocation while preserving old empty digest',async()=>{
  await assert.rejects(seedEventGrant({root:{id:'operational'},config:{projectId:'demo-abc-attendance'}},{uid:'f',fictional:true,confirmed:true}),e=>e.status===403);
  const digest=t=>migrationCheckpoint(t,[],hash('history')).securityDigest;assert.equal(digest({}),digest({msaEventGrants:[],msaServiceEvents:[],msaEventAudit:[]}));assert.notEqual(digest({msaEventGrants:[{id:'x',status:'active'}]}),digest({msaEventGrants:[{id:'x',status:'revoked'}]}));
});
