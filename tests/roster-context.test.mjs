import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {fictionalRosterData,scope} from './fixtures/roster.mjs';
import {createInMemoryCredentialRepository,createInMemoryRosterRepository,createAuthorizedRosterRepository} from '../backend/repositories.mjs';
import {createRosterServer} from '../backend/server.mjs';

test('Roster context includes only granted metadata with historical/default/temporary mentor semantics and no student profiles',async()=>{
  const source=fictionalRosterData(),before=structuredClone(source),credentials=createInMemoryCredentialRepository(),repository=createInMemoryRosterRepository(source);
  const future={...scope,serviceSessionId:'demo-pakel-2026-10-23'},token=await credentials.issue({grants:[scope,future]});
  const result=await createAuthorizedRosterRepository({credentials,repository}).contextAuthorized('Bearer '+token);
  assert.equal(result.kind,'ok');assert.equal(result.contexts.length,2);
  assert.deepEqual(result.contexts[0],{...scope,schoolName:'Sekolah Fiktif Satu',groupName:'Hosea Fiktif',serviceDate:'2026-10-09',mentorName:'Kak Riwayat Fiktif'});
  assert.equal(result.contexts[1].mentorName,'Kak Pengganti Fiktif');assert.equal(JSON.stringify(result).includes('FIKTIF_PRIVAT'),false);
  assert.deepEqual(source,before);
});
test('Context authentication precedes storage, validates relations, and rechecks revocation after delayed metadata reads',async()=>{
  const credentials=createInMemoryCredentialRepository(),repository=createInMemoryRosterRepository(fictionalRosterData());let reads=0;
  const wrapped={describe:async s=>{reads++;return repository.describe(s);}};
  const authorized=createAuthorizedRosterRepository({credentials,repository:wrapped});
  assert.equal((await authorized.contextAuthorized()).kind,'unauthenticated');assert.equal(reads,0);
  const invalid=await credentials.issue({grants:[{...scope,schoolId:'s2'}]});assert.equal((await authorized.contextAuthorized('Bearer '+invalid)).kind,'forbidden');
  const token=await credentials.issue({grants:[scope]});
  const changed=createAuthorizedRosterRepository({credentials,repository:{async describe(s){await credentials.revoke(token);return repository.describe(s);}}});
  assert.equal((await changed.contextAuthorized('Bearer '+token)).kind,'unauthenticated');
});
test('Context boundary strips adapter extras and rejects mismatched scope, missing metadata and storage failure',async()=>{
  const credentials=createInMemoryCredentialRepository(),repository=createInMemoryRosterRepository(fictionalRosterData()),token=await credentials.issue({grants:[scope]});
  const value=await repository.describe(scope);
  const boundary=entry=>createAuthorizedRosterRepository({credentials,repository:{async describe(){return entry;}}}).contextAuthorized('Bearer '+token);
  assert.deepEqual((await boundary({...value,dateOfBirth:'2015-01-01',guardianName:'FIKTIF_PRIVAT',students:[{secret:'FIKTIF_PRIVAT'}]})).contexts,[value]);
  await assert.rejects(boundary({...value,schoolId:'s2'}));await assert.rejects(boundary({...value,schoolName:undefined}));
  await assert.rejects(createAuthorizedRosterRepository({credentials,repository:{async describe(){throw Error('Kesalahan uji fiktif');}}}).contextAuthorized('Bearer '+token));
});
test('Read-only context HTTP enforces authentication, rejects caller parameters and never enables administrative CORS',async t=>{
  const credentials=createInMemoryCredentialRepository(),repository=createInMemoryRosterRepository(fictionalRosterData()),token=await credentials.issue({grants:[scope]});
  const origin='http://127.0.0.1:4176',server=createRosterServer({credentials,repository,mentorOrigin:origin});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));const base='http://127.0.0.1:'+server.address().port;
  assert.equal((await fetch(base+'/api/roster-context')).status,401);
  const response=await fetch(base+'/api/roster-context',{headers:{Authorization:'Bearer '+token,Origin:origin}});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('access-control-allow-origin'),origin);
  assert.equal((await response.json()).contexts.length,1);
  assert.equal((await fetch(base+'/api/roster-context?schoolId=s2',{headers:{Authorization:'Bearer '+token}})).status,400);
  assert.equal((await fetch(base+'/api/roster-context',{method:'POST',headers:{Authorization:'Bearer '+token}})).status,405);
  const denied=await fetch(base+'/api/roster-context',{headers:{Authorization:'Bearer '+token,Origin:'http://127.0.0.1:4173'}});assert.equal(denied.status,403);assert.equal(denied.headers.get('access-control-allow-origin'),null);
  const admin=await fetch(base+'/api/admin/pairing-codes',{headers:{Origin:origin}});assert.equal(admin.headers.get('access-control-allow-origin'),null);
});
