import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {coreFixture,coreControl,coreOrgA,coreOrgB,primary,backup} from './msa-stage8-fixture.mjs';
import {coreMembershipId,createMsaCore} from '../../backend/msa-core.mjs';
import {hash} from '../../backend/msa-accounts.mjs';
import {migrationCheckpoint,compareMigrationCheckpoints} from '../../backend/msa-migration.mjs';
const privateSnapshot=async f=>{const result={};for(const c of await f.root.listCollections())if(!c.id.startsWith('msaCore'))result[c.id]=(await c.get()).docs.map(d=>({...d.data(),id:d.id}));return hash(JSON.stringify(result));};
const coreSnapshot=async f=>{const result={};for(const c of await f.root.listCollections())if(c.id.startsWith('msaCore'))result[c.id]=(await c.get()).docs.map(d=>({...d.data(),id:d.id}));return result;};
const read=(f,org,section,session=f.token)=>f.request(f.coreBase(org)+'/'+section,undefined,session);

test('Stage 8 does not inherit legacy titles; feature gate, origins, trusted fixture and unrelated catalogs fail closed',async t=>{
  const f=await coreFixture(t,{seed:false});const catalog=await (await f.request(f.coreBase())).json();assert.deepEqual(catalog.organizations,[]);assert.equal(catalog.platform,false);
  assert.equal((await f.request(f.coreBase('new-org'),coreControl({name:'Organisasi baru',status:'active',ownerUid:f.uid}))).status,403);assert.equal((await f.root.collection('msaCoreOrganizations').get()).size,0);
  assert.equal((await f.request(f.coreBase(),undefined,'')).status,401);assert.equal((await f.request(f.coreBase(),undefined,f.token,{Origin:'https://example.invalid'})).status,403);assert.equal((await f.request(f.coreBase()+'?uid='+f.uid)).status,400);
  assert.equal((await f.request('/api/stage8/events',{})).status,404);delete process.env.ABC_MSA_STAGE8;assert.equal((await f.request(f.coreBase())).status,503);assert.equal((await fetch(f.base+'/msa-core.html')).status,503);
});

test('Stage 8 organizations/programs coexist, preserve stable IDs and optional program; platform authority grants no operational access',async t=>{
  const f=await coreFixture(t),catalog=await (await f.request(f.coreBase())).json();assert.equal(catalog.organizations.length,2);assert.equal(catalog.platform,true);
  const a=await (await read(f,coreOrgA,'programs')).json(),b=await (await read(f,coreOrgB,'programs')).json();assert.equal(a.programs.length,1);assert.equal(b.programs.length,2);assert.ok(a.programs.every(p=>p.organizationId===coreOrgA));assert.ok(b.programs.every(p=>p.organizationId===coreOrgB));
  const pcount=(await f.root.collection('msaCorePrograms').get()).size;assert.equal((await f.core.validateProgram(f.actor,coreOrgA,null)).programId,null);assert.equal((await f.root.collection('msaCorePrograms').get()).size,pcount);await assert.rejects(f.core.validateProgram(f.actor,coreOrgA,b.programs[0].id),e=>e.status===403);
  const next=await f.register();await f.review(next,{scope:primary});const session=await f.signIn(next),org='configurable-'+randomUUID(),before=await privateSnapshot(f);
  assert.equal((await f.request(f.coreBase(org),coreControl({name:'Organisasi Tanpa Program',ownerUid:next.uid,status:'active',metadata:{note:'Kebijakan fiktif, belum operasional.'}}))).status,200);
  assert.equal((await read(f,org,'programs')).status,403);const empty=await (await read(f,org,'programs',session.token)).json();assert.equal(empty.programs.length,0);assert.equal((await (await f.request(f.coreBase(),undefined,session.token)).json()).platform,false);assert.equal((await f.request(f.coreBase('owner-cannot-platform'),coreControl({name:'Organisasi baru ditolak',status:'active',ownerUid:next.uid}),session.token)).status,403);
  const membershipBefore=hash(JSON.stringify((await coreSnapshot(f)).msaCoreMemberships));
  const value=coreControl({name:'Pelayanan Khusus Fiktif',description:'Program generik; bukan schema Natal.',status:'active'}),id='generic-'+randomUUID();assert.equal((await f.request(f.coreBase(org)+'/programs/'+id,value,session.token)).status,200);assert.equal((await f.request(f.coreBase(org)+'/programs/'+id,value,session.token)).status,200);
  assert.equal((await f.request(f.coreBase(org)+'/programs/'+id+'-other',value,session.token)).status,409);assert.equal((await f.root.collection('msaCorePrograms').doc(id+'-other').get()).exists,false);
  const stored=(await f.root.collection('msaCorePrograms').doc(id).get()).data();assert.equal(stored.organizationId,org);assert.equal(stored.revision,1);assert.equal(hash(JSON.stringify((await coreSnapshot(f)).msaCoreMemberships)),membershipBefore);assert.equal((await f.root.collection('msaAccounts').doc(next.uid).get()).data().roles.length,0);
  assert.equal((await f.request(f.coreBase(org)+'/programs/'+id,coreControl({expectedRevision:1,name:'Program tetap ber-ID sama',status:'inactive'}),session.token)).status,200);const changed=(await f.root.collection('msaCorePrograms').doc(id).get()).data();assert.equal(changed.id,id);assert.equal(changed.revision,2);assert.equal(changed.description,stored.description);
  assert.equal((await f.request(f.coreBase(org),coreControl({expectedRevision:1,name:'Organisasi dinonaktifkan',status:'inactive'}))).status,200);assert.equal((await read(f,org,'programs',session.token)).status,403);const inactive=(await f.root.collection('msaCoreOrganizations').doc(org).get()).data();assert.equal(inactive.ownerUid,next.uid);assert.equal(inactive.metadata.note,'Kebijakan fiktif, belum operasional.');
  assert.equal((await f.request(f.coreBase(coreOrgB)+'/programs/'+a.programs[0].id,coreControl({name:'Pindah ilegal',description:'',status:'active'}))).status,403);
  assert.equal((await f.request(f.coreBase(org),coreControl({expectedRevision:2,name:'Pemilik diganti',ownerUid:f.uid,status:'active'}))).status,400);
  // The original two organizations did not backfill any A1 catalog or legacy table.
  assert.equal((await f.root.collection('msaOrganizations').get()).size,2);assert.equal(await privateSnapshot(f),before);assert.equal((await f.root.collection('msaCoreEvents').get()).size,0);
});

test('Stage 8 one verified identity has independent manager/viewer grants, no escalation, explicit revocation and stale account denial',async t=>{
  const f=await coreFixture(t),u=await f.account(),session=await f.signIn(u);assert.equal((await read(f,coreOrgA,'programs',session.token)).status,403);
  const grant=coreControl({role:'manager',status:'active'});assert.equal((await f.request(f.coreBase(coreOrgA)+'/memberships/'+u.uid,grant)).status,200);assert.equal((await f.request(f.coreBase(coreOrgA)+'/memberships/'+u.uid,grant)).status,200);assert.equal((await f.grant(u,coreOrgB,'viewer')).status,200);
  assert.equal((await f.request(f.coreBase(coreOrgA)+'/memberships/'+f.uid,grant)).status,409);
  assert.equal((await read(f,coreOrgA,'programs',session.token)).status,200);assert.equal((await read(f,coreOrgB,'programs',session.token)).status,200);assert.equal((await read(f,coreOrgA,'memberships',session.token)).status,200);assert.equal((await read(f,coreOrgB,'memberships',session.token)).status,403);
  const value=coreControl({name:'Program dikelola',description:'Fiktif',status:'active'});assert.equal((await f.request(f.coreBase(coreOrgA)+'/programs/manager-program',value,session.token)).status,200);assert.equal((await f.request(f.coreBase(coreOrgB)+'/programs/viewer-denied',value,session.token)).status,403);
  assert.equal((await f.request(f.coreBase(coreOrgA)+'/memberships/'+u.uid,coreControl({role:'owner',status:'active'}),session.token)).status,400);
  assert.equal((await f.request(f.coreBase(coreOrgA)+'/memberships/'+f.uid,coreControl({role:'manager',status:'active',expectedRevision:1}),session.token)).status,403);
  assert.equal((await f.request(f.coreBase(coreOrgA)+'/programs/inject',coreControl({name:'Program',status:'active',organizationId:coreOrgB,permissions:['memberships:manage']}),session.token)).status,400);
  const rev=coreControl({expectedRevision:1,role:'manager',status:'revoked'});assert.equal((await f.request(f.coreBase(coreOrgA)+'/memberships/'+u.uid,rev)).status,200);assert.equal((await read(f,coreOrgA,'programs',session.token)).status,403);assert.equal((await read(f,coreOrgB,'programs',session.token)).status,200);
  assert.equal((await f.request('/api/a1/accounts/'+u.uid+'/change',{state:'suspended',expectedRevision:3,requestId:randomUUID(),reason:'Suspension fiktif menguji membership stale'})).status,200);
  assert.equal((await f.grant(u,coreOrgB,'viewer',{expectedRevision:1,status:'revoked'})).status,200);
  assert.equal((await f.request('/api/a1/accounts/'+u.uid+'/change',{state:'active',expectedRevision:4,requestId:randomUUID(),reason:'Reaktivasi tidak memulihkan grant lama'})).status,200);const fresh=await f.signIn(u);
  for(const org of [coreOrgA,coreOrgB])assert.equal((await read(f,org,'programs',fresh.token)).status,403);
  assert.equal((await f.grant(u,coreOrgA,'manager',{expectedRevision:2})).status,200);assert.equal((await read(f,coreOrgA,'programs',fresh.token)).status,200);assert.equal((await read(f,coreOrgB,'programs',fresh.token)).status,403);
});

test('Stage 8 concurrent writes, stale revisions, authorization lost before write and core revocation checkpoint never restore access',async t=>{
  const f=await coreFixture(t),u=await f.account(),s=await f.signIn(u);await f.grant(u,coreOrgA,'manager');
  const before=await coreSnapshot(f),baseline=migrationCheckpoint(before,[],hash('fictional-history'));
  const values=[coreControl({name:'Program satu',description:'',status:'active'}),coreControl({name:'Program dua',description:'',status:'active'})],responses=await Promise.all(values.map(v=>f.request(f.coreBase(coreOrgA)+'/programs/racing-program',v,s.token)));assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal((await f.root.collection('msaCorePrograms').doc('racing-program').get()).data().revision,1);
  let start,release;const reached=new Promise(r=>start=r),wait=new Promise(r=>release=r);let held=false;
  const actor={kind:'msa',uid:u.uid,revision:3,check:async()=>{if(!held){held=true;start();await wait;}try{return (await f.adminAuthentication.a1.authorize('Bearer '+s.token)).uid===u.uid;}catch{return false;}}};
  const service=createMsaCore({...f,assertEnabled:()=>f.core.enabled()}),writing=service.saveProgram(actor,coreOrgA,'after-revoke',coreControl({name:'Harus ditolak',status:'active',description:''})).catch(e=>e);await reached;
  assert.equal((await f.grant(u,coreOrgA,'manager',{expectedRevision:1,status:'revoked'})).status,200);release();assert.equal((await writing).status,403);assert.equal((await f.root.collection('msaCorePrograms').doc('after-revoke').get()).exists,false);
  const after=await coreSnapshot(f),current=migrationCheckpoint(after,[],hash('fictional-history'));assert.equal(compareMigrationCheckpoints(current,baseline,{snapshotSealed:true,expectedMappingVerified:true}).verdict,'NO-GO');
  const invalid=coreControl({expectedRevision:99,role:'manager',status:'active'});assert.equal((await f.request(f.coreBase(coreOrgA)+'/memberships/'+u.uid,invalid)).status,409);assert.equal((await read(f,coreOrgA,'programs',s.token)).status,403);
});

test('Stage 8 legacy adapter requires exact trusted source, stays unmapped/read-only and preserves effective Mentor, attendance history and IDs',async t=>{
  const f=await coreFixture(t),u=await f.account(),s=await f.login(u),d=await f.activate();await f.associate(d,s.token);
  assert.equal((await f.call(d,f.target(),'PUT',{expectedRevision:0,idempotencyKey:randomUUID(),records:[{studentId:'fictional-1',status:'present'}]},s.token)).status,200);const before=await privateSnapshot(f);
  const path=f.coreBase(coreOrgA)+'/legacy?'+new URLSearchParams(primary),r=await (await f.request(path)).json();assert.equal(r.readOnly,true);assert.equal(r.mapping.state,'unmapped');assert.equal(r.mapping.organizationId,null);assert.equal(r.mapping.programId,null);assert.equal(r.mapping.eventId,null);assert.equal(r.legacy.serviceSessionId,primary.serviceSessionId);assert.equal(r.legacy.mentorId,'fictional-mentor');assert.equal(r.attendanceAccess,false);
  assert.equal(await privateSnapshot(f),before);assert.equal((await f.root.collection('msaCoreLegacyMappings').get()).size,0);assert.equal((await f.root.collection('msaCoreEvents').get()).size,0);
  assert.equal((await f.request(f.coreBase(coreOrgB)+'/legacy?'+new URLSearchParams(primary))).status,403);assert.equal((await f.request(f.coreBase(coreOrgA)+'/legacy?'+new URLSearchParams(backup))).status,403);assert.equal((await f.request(path+'&namespace=other')).status,400);
  const id=hash(JSON.stringify([f.root.id,primary.schoolId,primary.groupId,primary.serviceSessionId]));await f.root.collection('msaCoreLegacyMappings').doc(id).create({state:'proposed',organizationId:coreOrgA,eventId:'fictional-future-event'});const proposed=await (await f.request(path)).json();assert.equal(proposed.mapping.state,'requires-review');assert.equal(proposed.mapping.eventId,null);assert.equal(await privateSnapshot(f),before);
});

test('Stage 8 provider disable, recovery locks and corrupted membership/identity cannot authorize even with existing login or platform title',async t=>{
  const f=await coreFixture(t),u=await f.account(),s=await f.signIn(u);await f.grant(u,coreOrgA,'manager');
  await f.auth.updateUser(u.uid,{disabled:true});assert.equal((await read(f,coreOrgA,'programs',s.token)).status,401);await f.auth.updateUser(u.uid,{disabled:false});
  const fresh=await f.signIn(u);await f.root.collection('msaAccounts').doc(u.uid).update({recoveryLock:'fictional-uncertain'});assert.equal((await read(f,coreOrgA,'programs',fresh.token)).status,401);await f.root.collection('msaAccounts').doc(u.uid).update({recoveryLock:null});
  await f.root.collection('msaCoreMemberships').doc(coreMembershipId(coreOrgA,u.uid)).update({revision:0});assert.equal((await read(f,coreOrgA,'programs',fresh.token)).status,403);await f.root.collection('msaCoreMemberships').doc(coreMembershipId(coreOrgA,u.uid)).update({revision:1});
  await f.root.collection('msaCoreMemberships').doc(coreMembershipId(coreOrgA,u.uid)).update({permissions:['organizations:manage','programs:write']});assert.equal((await read(f,coreOrgA,'programs',fresh.token)).status,403);
  const email='stage8-pic-'+randomUUID()+'@example.invalid',password=randomBytes(24).toString('base64url'),created=await f.request('/api/admin/accounts',{email,password,actions:['pairing:read'],grants:[primary]}),{uid}=await created.json();f.created.push(uid);const token=await f.adminAuthentication.signIn({email,password});assert.equal((await read(f,coreOrgA,'programs',token)).status,403);
});
