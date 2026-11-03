import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarFilter,publicationTransition} from '../backend/msa-calendar.mjs';
import {eventPermissions,calendarPermissions} from '../backend/msa-events.mjs';
import {migrationCheckpoint,compareMigrationCheckpoints} from '../backend/msa-migration.mjs';
import {hash} from '../backend/msa-accounts.mjs';
test('Stage 9B.1 publication lifecycle is one-way and publishing/cancellation are separate explicit powers',()=>{
  assert.equal(publicationTransition('draft','publish'),'published');assert.equal(publicationTransition('published','cancel'),'cancelled');
  for(const [s,op] of [['draft','cancel'],['published','publish'],['cancelled','publish'],['cancelled','cancel'],['cancelled','restore'],['published','draft']])assert.throws(()=>publicationTransition(s,op),e=>e.status===409);
  assert.ok(!eventPermissions.includes('events:publish'));assert.deepEqual(calendarPermissions,['events:calendar:read','events:publish','events:cancel']);
});
test('Stage 9B.1 calendar rejects unbounded/invalid ranges, status/scope injections and preserves nullable program filter',()=>{
  const v={from:'2026-11-01',to:'2026-11-30'};assert.equal(calendarFilter(v).status,'published');assert.equal(calendarFilter({...v,programId:''}).programId,'');
  for(const patch of [{from:undefined},{to:'2027-03-01'},{to:'2026-10-31'},{to:'2026-13-01'},{status:['draft']},{status:'public'},{organizationId:'../all'},{programId:null},{uid:'other'}])assert.throws(()=>calendarFilter({...v,...patch}),e=>e.status===400);
});
test('Stage 9B.1 checkpoint already covers lifecycle metadata, immutable history and revoked publish grants without restore',()=>{
  const checkpoint=t=>migrationCheckpoint(t,[],hash('fictional-history')),before=checkpoint({msaServiceEvents:[{id:'e',status:'draft',revision:1}],msaEventGrants:[{id:'g',permissions:['events:publish'],status:'active'}]}),after=checkpoint({msaServiceEvents:[{id:'e',status:'published',publishedAt:123,revision:2}],msaEventGrants:[{id:'g',permissions:['events:publish'],status:'revoked'}]});assert.notEqual(before.securityDigest,after.securityDigest);assert.equal(compareMigrationCheckpoints(after,before,{snapshotSealed:true,expectedMappingVerified:true}).verdict,'NO-GO');
});
