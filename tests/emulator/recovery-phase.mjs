import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createFirestoreEmulatorRepositories} from '../../backend/firestore-emulator.mjs';
import {createAuthorizedRosterRepository} from '../../backend/repositories.mjs';
import {fictionalRosterData,scope} from '../fixtures/roster.mjs';

// Two separate emulator lifetimes. Random test bearer values arrive in the child
// environment and remain in memory; only hashes enter the exported fixture data.
const phase=process.argv[2];
if(!['seed','verify'].includes(phase)||!process.env.ABC_FIRESTORE_NAMESPACE?.startsWith('recovery-'))throw Error('Mode pemulihan uji tidak valid.');
const tokens=Object.fromEntries(['VALID','REVOKED','DEVICE_REVOKED','EXPIRED'].map(key=>[key,process.env['ABC_RECOVERY_'+key]]));
if(!Object.values(tokens).every(value=>/^[A-Za-z0-9_-]{43}$/.test(value??'')))throw Error('Kredensial pemulihan fiktif tidak tersedia.');
const c=await createFirestoreEmulatorRepositories(),hash=value=>createHash('sha256').update(value).digest('hex');
try{
  if(phase==='seed'){
    const source=fictionalRosterData(),batch=c.db.batch();
    for(const name of ['schools','groups','students','serviceSessions','sessions'])for(const record of source[name])batch.create(c.root.collection(name).doc(record.id),record);
    await batch.commit();
    const issued=await c.deviceAuthorization.issue({deviceId:'fictional-recovery-active',grants:[scope],ttlMs:3600000});
    const entry=(await c.root.collection('credentials').doc(hash(issued)).get()).data();
    for(const key of ['VALID','REVOKED','EXPIRED'])await c.root.collection('credentials').doc(hash(tokens[key])).create({...entry,expiresAt:key==='EXPIRED'?Date.now()-1000:entry.expiresAt});
    const deviceToken=await c.deviceAuthorization.issue({deviceId:'fictional-recovery-revoked',grants:[scope],ttlMs:3600000});
    const other=(await c.root.collection('credentials').doc(hash(deviceToken)).get()).data();
    await c.root.collection('credentials').doc(hash(tokens.DEVICE_REVOKED)).create(other);
    await c.credentials.revoke(tokens.REVOKED);await c.deviceAuthorization.revoke('fictional-recovery-revoked');
  }
  assert.ok(await c.credentials.authenticate('Bearer '+tokens.VALID));
  for(const key of ['REVOKED','DEVICE_REVOKED','EXPIRED'])assert.equal(await c.credentials.authenticate('Bearer '+tokens[key]),null);
  const authorized=createAuthorizedRosterRepository(c);
  const roster=await authorized.readAuthorized('Bearer '+tokens.VALID,scope);
  assert.equal(roster.kind,'ok');assert.deepEqual(roster.roster.students,[{id:'fictional-1',name:'Siswa Fiktif Snapshot',schoolClass:'4A'}]);
  assert.equal((await c.root.collection('sessions').doc('fictional-batch').get()).data().id,'fictional-batch');
  const events=await c.root.collection('authorizationEvents').get();assert.equal(events.size,4);
  for(const doc of events.docs){
    assert.deepEqual(Object.keys(doc.data()).sort(),['actor','at','credentialId','deviceId','event']);
    for(const token of Object.values(tokens))assert.equal(JSON.stringify(doc.data()).includes(token),false);
  }
  console.log('PASS pemulihan '+phase+': valid/revoked/device-revoked/expired, roster, ID dan audit.');
}finally{await c.close();}
