import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthorizedRosterRepository} from '../../backend/repositories.mjs';
import {scope,fictionalRosterData} from '../fixtures/roster.mjs';

const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};

export function registerRepositoryContracts(adapter){
  const setup=async t=>{
    let now=1000;
    const data=fictionalRosterData();
    const {credentials,repository,close}=await adapter.create({now:()=>now,source:data});
    if(close)t.after(close);
    const authorized=createAuthorizedRosterRepository({credentials,repository});
    return {credentials,repository,authorized,data,advance:value=>{now=value;}};
  };

  test(`${adapter.name}: credential and roster operations return Promises with legacy result shapes`,async t=>{
    const {credentials,repository,authorized}=await setup(t);
    const issuing=credentials.issue({grants:[scope]});assert.ok(issuing instanceof Promise);
    const token=await issuing,authenticating=credentials.authenticate('Bearer '+token);assert.ok(authenticating instanceof Promise);
    const principal=await authenticating;assert.deepEqual(principal,{expiresAt:301000,grants:[scope]});
    const reading=repository.read(scope);assert.ok(reading instanceof Promise);
    const roster=await reading;
    assert.deepEqual(roster,{...scope,students:[{id:'fictional-1',name:'Siswa Fiktif Snapshot',schoolClass:'4A'}]});
    const result=authorized.readAuthorized('Bearer '+token,scope);assert.ok(result instanceof Promise);
    assert.deepEqual(await result,{kind:'ok',roster});
    const revoking=credentials.revoke(token);assert.ok(revoking instanceof Promise);assert.equal(await revoking,true);
    assert.equal(await credentials.revoke(token),false);
  });

  test(`${adapter.name}: missing, malformed, unknown and demo credentials deny by default`,async t=>{
    const {credentials,authorized}=await setup(t);
    for(const header of [undefined,'','Bearer ABC2026','Basic abc','Bearer '+'x'.repeat(43)]){
      assert.equal(await credentials.authenticate(header),null);
      assert.deepEqual(await authorized.readAuthorized(header,scope),{kind:'unauthenticated'});
    }
    assert.deepEqual(await authorized.readAuthorized(undefined,null),{kind:'unauthenticated'});
    await assert.rejects(credentials.issue({grants:[]}));
    await assert.rejects(credentials.issue({grants:[{...scope,groupId:'*'}]}));
    await assert.rejects(credentials.issue({grants:[scope],ttlMs:0}));
    await assert.rejects(credentials.issue({grants:[scope],ttlMs:3600001}));
  });

  test(`${adapter.name}: expiration and revocation deny access on subsequent reads`,async t=>{
    const {credentials,authorized,advance}=await setup(t);
    const expiring=await credentials.issue({grants:[scope],ttlMs:100});
    assert.equal((await authorized.readAuthorized('Bearer '+expiring,scope)).kind,'ok');
    advance(1100);assert.equal(await credentials.authenticate('Bearer '+expiring),null);
    assert.deepEqual(await authorized.readAuthorized('Bearer '+expiring,scope),{kind:'unauthenticated'});
    const token=await credentials.issue({grants:[scope]});await credentials.revoke(token);
    assert.deepEqual(await authorized.readAuthorized('Bearer '+token,scope),{kind:'unauthenticated'});
  });

  test(`${adapter.name}: exact school/group/session grants are enforced before reading any roster`,async t=>{
    const {credentials,repository}=await setup(t);let reads=0;
    const authorized=createAuthorizedRosterRepository({credentials,repository:{async read(value){reads++;return repository.read(value);}}});
    const token=await credentials.issue({grants:[scope]});
    for(const changes of [{schoolId:'s2'},{groupId:'g2'},{serviceSessionId:'demo-pakel-2026-10-23'}]){
      assert.deepEqual(await authorized.readAuthorized('Bearer '+token,{...scope,...changes}),{kind:'forbidden'});
    }
    assert.deepEqual(await authorized.readAuthorized(undefined,scope),{kind:'unauthenticated'});
    assert.deepEqual(await authorized.readAuthorized('Bearer '+token,null),{kind:'invalid-scope'});
    assert.equal(reads,0);
    assert.equal((await authorized.readAuthorized('Bearer '+token,scope)).kind,'ok');assert.equal(reads,1);
    const wrong={...scope,schoolId:'s2'},badToken=await credentials.issue({grants:[wrong]});
    assert.deepEqual(await authorized.readAuthorized('Bearer '+badToken,wrong),{kind:'forbidden'});
  });

  test(`${adapter.name}: reads preserve historical data, snapshots, IDs and private-field exclusion`,async t=>{
    const {credentials,authorized,repository,data}=await setup(t),before=structuredClone(data);
    const token=await credentials.issue({grants:[scope]});
    const result=await authorized.readAuthorized('Bearer '+token,scope);
    assert.deepEqual(result.roster,{...scope,students:[{id:'fictional-1',name:'Siswa Fiktif Snapshot',schoolClass:'4A'}]});
    result.roster.students[0].name='Mutasi respons';
    assert.equal((await repository.read(scope)).students[0].name,'Siswa Fiktif Snapshot');
    const future=await repository.read({...scope,serviceSessionId:'demo-pakel-2026-10-23'});
    assert.deepEqual(future.students.map(s=>s.id),['fictional-1','fictional-2']);
    assert.deepEqual(data,before);
  });

  test(`${adapter.name}: returned grants and caller-owned scope cannot change repository authority`,async t=>{
    const {credentials,repository}=await setup(t),grant={...scope};
    const token=await credentials.issue({grants:[grant]});grant.groupId='g2';
    const principal=await credentials.authenticate('Bearer '+token);principal.grants[0].groupId='g2';
    assert.deepEqual((await credentials.authenticate('Bearer '+token)).grants,[scope]);
    const started=deferred(),release=deferred();
    const authorized=createAuthorizedRosterRepository({credentials:{async authenticate(header){started.resolve();await release.promise;return credentials.authenticate(header);}},repository});
    const request={...scope},pending=authorized.readAuthorized('Bearer '+token,request);
    await started.promise;request.groupId='g2';release.resolve();
    assert.equal((await pending).kind,'ok');
  });

  test(`${adapter.name}: credential revocation or expiration while awaiting storage denies the response`,async t=>{
    for(const change of ['revoke','expire']){
      const {credentials,repository,advance}=await setup(t);
      const token=await credentials.issue({grants:[scope],ttlMs:100});
      const started=deferred(),release=deferred();
      const authorized=createAuthorizedRosterRepository({credentials,repository:{async read(value){started.resolve();await release.promise;return repository.read(value);}}});
      const pending=authorized.readAuthorized('Bearer '+token,scope);await started.promise;
      if(change==='revoke')await credentials.revoke(token);else advance(1100);
      release.resolve();assert.deepEqual(await pending,{kind:'unauthenticated'});
    }
  });

  test(`${adapter.name}: async boundary strips adapter extras and rejects mismatched response scope`,async t=>{
    const {credentials,repository}=await setup(t),token=await credentials.issue({grants:[scope]});
    const publicRoster=await repository.read(scope);
    const authorized=createAuthorizedRosterRepository({credentials,repository:{async read(){return {...publicRoster,studentPrivateProfiles:{guardianName:'WALI_FIKTIF'},students:publicRoster.students.map(s=>({...s,dateOfBirth:'2015-01-01',guardianName:'WALI_FIKTIF',address:'ALAMAT_FIKTIF'}))};}}});
    assert.deepEqual(await authorized.readAuthorized('Bearer '+token,scope),{kind:'ok',roster:publicRoster});
    const mismatch=createAuthorizedRosterRepository({credentials,repository:{async read(){return {...publicRoster,schoolId:'s2'};}}});
    assert.deepEqual(await mismatch.readAuthorized('Bearer '+token,scope),{kind:'forbidden'});
  });

  test(`${adapter.name}: adapter failures reject without falling back or reading unauthorized data`,async t=>{
    const {credentials,repository}=await setup(t),token=await credentials.issue({grants:[scope]});
    const error=new Error('Kegagalan penyimpanan fiktif');let reads=0;
    const unavailable=createAuthorizedRosterRepository({credentials:{async authenticate(){throw error;}},repository:{async read(){reads++;return repository.read(scope);}}});
    await assert.rejects(unavailable.readAuthorized('Bearer '+token,scope),error);assert.equal(reads,0);
    const failedRead=createAuthorizedRosterRepository({credentials,repository:{async read(){throw error;}}});
    await assert.rejects(failedRead.readAuthorized('Bearer '+token,scope),error);
  });
}
