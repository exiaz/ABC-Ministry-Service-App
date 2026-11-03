import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {analyzeMigration,simulateUsernameMapping,migrationCheckpoint,compareMigrationCheckpoints,verifyMigrationRollback,migrationVerdict} from '../backend/msa-migration.mjs';
import {hash} from '../backend/msa-accounts.mjs';
import {sealSnapshot} from '../local-snapshots.mjs';
const fixture=()=>({adminAccounts:[{id:'owner-fictional',uid:'owner-fictional',role:'superadmin',state:'active',revision:1}],adminSecurity:[{id:'owner',uid:'owner-fictional'}]});
const users=[{uid:'owner-fictional',disabled:false}],proposal={uid:'owner-fictional',username:'momor1n',reauthenticatedUid:'owner-fictional',identityVerified:true};
test('A2.4C verdicts and detached fictional momor1n mapping preserve original UID/owner/roles and reject escalation/collisions',()=>{
  assert.equal(migrationVerdict([]),'GO');assert.equal(migrationVerdict(['unknown']),'NO-GO');assert.equal(migrationVerdict(['review']),'CONDITIONAL GO');assert.equal(migrationVerdict(['ready','blocked']),'NO-GO');
  const t=fixture(),before=JSON.stringify(t),report=simulateUsernameMapping(t,users,[proposal]);assert.equal(report.verdict,'GO');assert.equal(report.mutations,0);assert.equal(report.uidRoleScopeOwnerHistoryPreserved,true);assert.equal(JSON.stringify(t),before);
  for(const patch of [{uid:'new-privileged-uid'},{reauthenticatedUid:'other'},{identityVerified:false},{username:'Kelvin'}])assert.equal(simulateUsernameMapping(t,users,[{...proposal,...patch}]).verdict,'NO-GO');
  t.adminAccounts.push({id:'pic-fictional',uid:'pic-fictional',role:'pic',state:'active'});assert.equal(simulateUsernameMapping(t,[...users,{uid:'pic-fictional',disabled:false}],[proposal,{...proposal,uid:'pic-fictional',reauthenticatedUid:'pic-fictional',username:'MOMOR1N'}]).verdict,'NO-GO');
});
test('A2.4C inventory is redacted, distinguishes review/blocked/retained denial and never infers duplicate ownership',()=>{
  const t=fixture();Object.assign(t,{msaAccounts:[{id:'person-one',uid:'person-one',canonical:'person.one',fullName:'Nama Rahasia Fiktif',phone:{normalized:'+6281234567890'},providerAlias:'private-alias@example.invalid',state:'suspended',roles:[],revision:2},{id:'person-two',uid:'person-two',canonical:'person.two',fullName:'Nama Rahasia Fiktif',phone:{normalized:'+6281234567890'},state:'active',provisioning:'ready',identity:{state:'verified'},roles:[],revision:1,recoveryLock:'secret-request'}],msaUsernames:[{id:'person.one',uid:'person-one',state:'ready'},{id:'person.two',uid:'person-two',state:'ready'},{id:'PERSON.ONE',uid:'person-two',state:'ready'}],devices:[{id:'legacy-secret-device',state:'active',expiresAt:99999}],msaRecoveryRequests:[{id:'secret-request',uid:'person-two',state:'resetting',challengeHash:'hash-secret'}],msaMentorSessions:[{id:'hash-session',uid:'person-one',state:'active',revision:1,expiresAt:99999}]});
  const before=JSON.stringify(t),r=analyzeMigration(t,[...users,{uid:'person-one'},{uid:'person-two'}],{now:100});assert.equal(r.productionVerdict,'NO-GO');assert.equal(r.dryRunVerdict,'NO-GO');
  for(const code of ['possible-duplicate','username-conflict','unresolved-legacy','recovery-lock','uncertain-recovery','stale-session','retained-denial'])assert.ok(r.records.some(r=>r.code===code),code);
  for(const secret of ['Nama Rahasia','+628','private-alias','person-one','secret-request','legacy-secret-device','hash-secret','hash-session'])assert.ok(!JSON.stringify(r).includes(secret));assert.equal(JSON.stringify(t),before);
});
test('A2.4C rollback check rejects changed security/epoch/lock/history and verifies actual sealed copied artifacts without restoring them',async()=>{
  const t=fixture(),current=migrationCheckpoint(t,users,hash('fictional-history-digest')),same=structuredClone(current);
  assert.equal(compareMigrationCheckpoints(current,same,{snapshotSealed:true,expectedMappingVerified:true}).verdict,'GO');assert.equal(compareMigrationCheckpoints(current,same).verdict,'NO-GO');
  for(const tables of [{...t,adminAccounts:[{...t.adminAccounts[0],state:'suspended',revision:2}]},{...t,msaRecoveryRequests:[{id:'r',state:'resetting'}]},{...t,msaAccounts:[{id:'p',securityEpoch:2,recoveryLock:'r'}]},{...t,devices:[{id:'d',state:'revoked'}]}])assert.equal(compareMigrationCheckpoints(migrationCheckpoint(tables,users,hash('fictional-history-digest')),same,{snapshotSealed:true,expectedMappingVerified:true}).verdict,'NO-GO');
  assert.equal(compareMigrationCheckpoints(current,{...same,historyDigest:'different-history'},{snapshotSealed:true,expectedMappingVerified:true}).verdict,'NO-GO');
  await mkdir('.emulator-data/migration-qa',{recursive:true});const dir=await mkdtemp(path.resolve('.emulator-data/migration-qa/snapshot-'));for(const n of ['auth_export','firestore_export'])await mkdir(path.join(dir,n));
  for(const [n,v] of Object.entries({'firebase-export-metadata.json':{auth:{path:'auth_export'},firestore:{path:'firestore_export',metadata_file:'firestore_export/metadata'}},'auth_export/accounts.json':{users:[]},'auth_export/config.json':{},'migration-checkpoint.json':same}))await writeFile(path.join(dir,n),JSON.stringify(v));await writeFile(path.join(dir,'firestore_export/metadata'),'fictional-metadata');
  assert.equal((await verifyMigrationRollback(current,dir,{expectedMappingVerified:true})).verdict,'NO-GO');await sealSnapshot(dir);const checked=await verifyMigrationRollback(current,dir,{expectedMappingVerified:true});assert.equal(checked.verdict,'GO');assert.equal(checked.restoreAuthorized,false);
  await writeFile(path.join(dir,'migration-checkpoint.json'),JSON.stringify({...same,securityDigest:'tampered'}));assert.equal((await verifyMigrationRollback(current,dir,{expectedMappingVerified:true})).verdict,'NO-GO');
});
