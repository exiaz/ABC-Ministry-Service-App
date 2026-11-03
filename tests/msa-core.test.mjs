import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {coreRoles,coreMembershipId,coreMutationInput,coreProgramReference} from '../backend/msa-core.mjs';
import {seedStage8Fixture} from './fixtures/msa-core.mjs';
import {migrationCheckpoint} from '../backend/msa-migration.mjs';
import {hash} from '../backend/msa-accounts.mjs';
test('Stage 8 explicit scoped roles separate platform, programs and membership powers; membership keys include organization',()=>{
  assert.ok(coreRoles.owner.includes('memberships:manage'));assert.ok(!coreRoles.manager.includes('memberships:manage'));assert.ok(!coreRoles.viewer.includes('programs:write'));for(const permissions of Object.values(coreRoles))assert.ok(!permissions.includes('organizations:manage'));assert.notEqual(coreMembershipId('a','same-person'),coreMembershipId('b','same-person'));
  const checkpoint=tables=>migrationCheckpoint(tables,[],hash('history')).securityDigest;assert.equal(checkpoint({}),checkpoint({msaCoreMemberships:[]}));assert.notEqual(checkpoint({}),checkpoint({msaCoreMemberships:[{id:'m',status:'revoked'}]}));
});
test('Stage 8 program is explicitly nullable and mutation control rejects client privilege fields and stale/invalid shape',()=>{
  assert.equal(coreProgramReference(null),null);assert.equal(coreProgramReference('stable-program'),'stable-program');for(const v of [undefined,'',true,'../program'])assert.throws(()=>coreProgramReference(v));
  const value={requestId:randomUUID(),expectedRevision:0,reason:'Alasan perubahan fiktif',confirmed:true,name:'Program'};assert.doesNotThrow(()=>coreMutationInput(value,['name']));for(const patch of [{permissions:['organizations:manage']},{ownerUid:'other'},{expectedRevision:-1},{confirmed:false},{reason:'\u202eberubah'},{requestId:'bad'}])assert.throws(()=>coreMutationInput({...value,...patch},['name']));
});
test('Stage 8 fixture provisioning refuses operational namespace and absent trusted confirmation before any database call',async()=>{
  const context={root:{id:'operational'},config:{projectId:'demo-abc-attendance'}};await assert.rejects(seedStage8Fixture(context,{uid:'fictional',fictional:true,confirmed:true}),e=>e.status===403);await assert.rejects(seedStage8Fixture({...context,root:{id:'test-fictional'}},{uid:'fictional'}),e=>e.status===403);
});
