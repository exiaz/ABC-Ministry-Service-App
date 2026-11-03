import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestCredentialStore,canReadRoster} from '../backend/access-control.mjs';
import {createRosterRepository} from '../backend/roster.mjs';
import {scope,fictionalRosterData} from './fixtures/roster.mjs';

test('Test credentials are unpredictable, expiring, revocable and invalid after a store restart',()=>{
  let time=1000;
  const store=createTestCredentialStore({now:()=>time});
  const first=store.issue({grants:[scope],ttlMs:100}),second=store.issue({grants:[scope]});
  assert.match(first,/^[A-Za-z0-9_-]{43}$/);assert.notEqual(first,second);
  assert.equal(canReadRoster(store.authenticate('Bearer '+first),scope),true);
  time=1100;assert.equal(store.authenticate('Bearer '+first),null);
  assert.equal(store.revoke(second),true);assert.equal(store.authenticate('Bearer '+second),null);
  assert.equal(createTestCredentialStore().authenticate('Bearer '+first),null);
});

test('Missing, invented, malformed and hardcoded demo credentials cannot authenticate',()=>{
  const store=createTestCredentialStore();
  for(const header of [undefined,'','ABC2026','Bearer ABC2026','Bearer '+'x'.repeat(43),'Basic abc','Bearer abc Bearer def']){
    assert.equal(store.authenticate(header),null);
  }
  assert.equal(canReadRoster(null,scope),false);
  assert.equal(canReadRoster({admin:true,authorized:true},scope),false);
});

test('Scopes require the exact school/group/service tuple and cannot be changed through references',()=>{
  const store=createTestCredentialStore(),grant={...scope};
  const token=store.issue({grants:[grant]});grant.groupId='g2';
  const principal=store.authenticate('Bearer '+token);
  assert.equal(canReadRoster(principal,scope),true);
  for(const change of [{schoolId:'s2'},{groupId:'g2'},{serviceSessionId:'demo-pakel-2026-10-23'}]){
    assert.equal(canReadRoster(principal,{...scope,...change}),false);
  }
  principal.grants[0].groupId='g2';
  assert.equal(canReadRoster(store.authenticate('Bearer '+token),{...scope,groupId:'g2'}),false);
  for(const options of [{grants:[]},{grants:[{...scope,groupId:'*'}]},{grants:[scope],ttlMs:0},{grants:[scope],ttlMs:3600001},{grants:[scope],ttlMs:NaN}]){
    assert.throws(()=>store.issue(options));
  }
});

test('Roster reads preserve snapshots, historical attendance and IDs while excluding private fields',()=>{
  const source=fictionalRosterData(),before=structuredClone(source),repository=createRosterRepository(source);
  const result=repository.read(scope);
  assert.deepEqual(result,{...scope,students:[{id:'fictional-1',name:'Siswa Fiktif Snapshot',schoolClass:'4A'}]});
  assert.deepEqual(source,before);
  result.students[0].name='Mutasi respons';source.sessions[0].records[0].name='Mutasi sumber';
  assert.equal(repository.read(scope).students[0].name,'Siswa Fiktif Snapshot');
});

test('Unstarted roster is read without creating a batch or using inactive/cross-school students',()=>{
  const source=fictionalRosterData(),before=structuredClone(source),repository=createRosterRepository(source);
  const result=repository.read({...scope,serviceSessionId:'demo-pakel-2026-10-23'});
  assert.deepEqual(result.students.map(s=>s.id),['fictional-1','fictional-2']);
  assert.equal(result.students[1].schoolClass,null);assert.deepEqual(source,before);
  assert.equal(repository.read({...scope,schoolId:'s2'}),null);
  assert.equal(repository.read({...scope,groupId:'g4'}),null);
  assert.equal(repository.read({...scope,serviceSessionId:'unknown'}),null);
  assert.equal(createRosterRepository().read(scope),null);
});
