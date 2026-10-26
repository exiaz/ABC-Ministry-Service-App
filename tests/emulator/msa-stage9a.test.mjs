import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {eventFixture,coreOrgA,coreOrgB} from './msa-stage9a-fixture.mjs';
import {coreMembershipId} from '../../backend/msa-core.mjs';
import {createMsaEvents} from '../../backend/msa-events.mjs';
import {hash} from '../../backend/msa-accounts.mjs';
import {coreFixture} from './msa-stage8-fixture.mjs';
const snapshot=async f=>{const tables={};for(const c of await f.root.listCollections())if(!['msaServiceEvents','msaEventReceipts','msaEventAudit'].includes(c.id))tables[c.id]=(await c.get()).docs.map(d=>({id:d.id,...d.data()}));return hash(JSON.stringify(tables));};
const save=(f,id,v=f.draft(),org=coreOrgA,token=f.token)=>f.request(f.eventBase(org)+'/'+id,v,token);

test('Stage 9A stays unavailable when only Stage 8 is enabled',async t=>{
  const f=await coreFixture(t);assert.equal(f.adminAuthentication.a1.events,undefined);assert.equal((await f.request('/api/stage9a/organizations')).status,404);assert.equal((await fetch(f.base+'/msa-events.html')).status,404);assert.equal((await f.root.collection('msaEventGrants').get()).size,0);
});

test('Stage 9A requires independent grant, feature gates, same origin, strict routes and queries; legacy titles alone grant nothing',async t=>{
  const f=await eventFixture(t,{seed:false});assert.deepEqual((await (await f.request(f.eventBase())).json()).organizations,[]);assert.equal((await save(f,'denied')).status,403);
  await f.eventGrant(f.uid,coreOrgA);assert.equal((await f.request(f.eventBase(),undefined,'')).status,401);assert.equal((await f.request(f.eventBase(),undefined,f.token,{Origin:'https://example.invalid'})).status,403);
  for(const suffix of ['?uid=foreign','?from=2026-11-01&from=2026-11-02','?to=2026-13-01','?from=2026-12-01&to=2026-11-01'])assert.equal((await f.request(f.eventBase(coreOrgA)+suffix)).status,400);
  assert.equal((await f.request('/api/stage9a/organizations/'+coreOrgA+'/options?scope=all')).status,400);assert.equal((await f.request(f.eventBase(coreOrgA)+'/x/publish',{})).status,404);
  delete process.env.ABC_MSA_STAGE9A;assert.equal((await save(f,'gate-off')).status,503);assert.equal((await fetch(f.base+'/msa-events.html')).status,503);process.env.ABC_MSA_STAGE9A='1';delete process.env.ABC_MSA_STAGE8;assert.equal((await save(f,'foundation-off')).status,503);
});
test('Stage 9A regular/ad hoc drafts with nullable program, filters, stable reschedule ID, timestamps, audit and no unrelated writes',async t=>{
  const f=await eventFixture(t),before=await snapshot(f),regular=f.draft({programId:'fictional-goes-to-school'}),adHoc=f.draft({name:'Pelayanan Mendadak Fiktif',startDate:'2026-11-08',startTime:'19:15',timezone:'Asia/Jayapura'});
  assert.equal((await save(f,'regular',regular)).status,200);assert.equal((await save(f,'adhoc',adHoc)).status,200);assert.equal((await save(f,'yayasan',f.draft({programId:'fictional-pojok-ceria'},coreOrgB),coreOrgB)).status,200);
  const filter=async query=>(await (await f.request(f.eventBase(coreOrgA)+query)).json()).events;
  assert.equal((await filter('')).length,2);assert.deepEqual((await filter('?programId=')).map(e=>e.id),['adhoc']);assert.deepEqual((await filter('?programId=fictional-goes-to-school&from=2026-11-01&to=2026-11-03')).map(e=>e.id),['regular']);assert.equal((await filter('?from=2026-12-01')).length,0);
  assert.equal((await save(f,'regular',f.draft({expectedRevision:1,name:'Pelayanan Diubah',startDate:'2026-11-09',startTime:'08:00',programId:'fictional-goes-to-school'}))).status,200);
  const detail=await (await f.request(f.eventBase(coreOrgA)+'/regular')).json(),row=(await f.root.collection('msaServiceEvents').doc('regular').get()).data();assert.equal(detail.event.id,'regular');assert.equal(detail.event.revision,2);assert.equal(detail.event.status,'draft');assert.equal(detail.history.length,2);assert.equal(detail.history[1].previous.startDate,'2026-11-03');assert.equal(row.createdBy,f.uid);assert.equal(row.updatedBy,f.uid);assert.ok(row.updatedAt>=row.createdAt);assert.ok(!JSON.stringify(detail).includes(f.uid));
  assert.equal(await snapshot(f),before);assert.equal((await f.root.collection('msaCorePrograms').get()).size,3);assert.equal((await f.root.collection('msaEventAudit').where('eventId','==','adhoc').get()).size,1);
});
test('Stage 9A server rejects invalid required fields, foreign program/PIC, unverified or unauthorized PIC and privilege escalation',async t=>{
  const f=await eventFixture(t),u=await f.account();await f.grant(u,coreOrgA,'viewer');
  for(const patch of [{startTime:['09:30']},{timezone:['Asia/Jakarta']},{picMembershipId:['a'.repeat(64)]},{name:''},{startDate:''},{startTime:''},{venue:''},{picMembershipId:''},{programId:'fictional-pojok-ceria'},{picMembershipId:coreMembershipId(coreOrgB,f.uid)},{picMembershipId:coreMembershipId(coreOrgA,u.uid)},{status:'published'},{permissions:['events:publish']},{organizationId:coreOrgB}])assert.ok([400,403].includes((await save(f,'invalid-'+randomUUID(),f.draft(patch))).status));
  await f.eventGrant(u.uid,coreOrgA,['events:pic']);const before=await snapshot(f),v=f.draft({picMembershipId:coreMembershipId(coreOrgA,u.uid)});assert.equal((await save(f,'pic-no-escalation',v)).status,200);assert.equal(await snapshot(f),before);const s=await f.signIn(u);assert.equal((await save(f,'pic-cannot-create',v,coreOrgA,s.token)).status,403);
  await f.auth.updateUser(u.uid,{disabled:true});assert.equal((await save(f,'disabled-pic',f.draft({picMembershipId:v.picMembershipId}))).status,403);await f.auth.updateUser(u.uid,{disabled:false});
  await f.root.collection('msaAccounts').doc(u.uid).update({recoveryLock:'uncertain'});assert.equal((await save(f,'locked-pic',f.draft({picMembershipId:v.picMembershipId}))).status,403);
  assert.equal((await f.root.collection('msaServiceEvents').get()).size,1);
});
test('Stage 9A read/create/edit permissions are distinct and cross-organization access defaults to deny',async t=>{
  const f=await eventFixture(t),u=await f.account(),s=await f.signIn(u);await f.grant(u,coreOrgA,'viewer');await f.eventGrant(u.uid,coreOrgA,['events:read','events:create']);
  assert.equal((await save(f,'own-scope',f.draft(),coreOrgA,s.token)).status,200);assert.equal((await f.request(f.eventBase(coreOrgA)+'/own-scope',undefined,s.token)).status,200);assert.equal((await save(f,'own-scope',f.draft({expectedRevision:1}),coreOrgA,s.token)).status,403);
  for(const path of [f.eventBase(coreOrgB),f.eventBase(coreOrgB)+'/own-scope','/api/stage9a/organizations/'+coreOrgB+'/options'])assert.equal((await f.request(path,undefined,s.token)).status,403);
  assert.equal((await save(f,'cross-create',f.draft({},coreOrgB),coreOrgB,s.token)).status,403);assert.equal((await save(f,'own-scope',f.draft({},coreOrgB),coreOrgB)).status,403);
  const catalog=await (await f.request(f.eventBase(),undefined,s.token)).json();assert.deepEqual(catalog.organizations.map(o=>o.id),[coreOrgA]);assert.equal(catalog.publishAvailable,false);assert.equal((await f.request('/api/stage9a/organizations/'+coreOrgA+'/options',undefined,s.token)).status,200);
  const grantRef=f.root.collection('msaEventGrants').doc(coreMembershipId(coreOrgA,u.uid));await grantRef.update({permissions:['events:read','events:edit'],revision:2});assert.equal((await save(f,'own-scope',f.draft({expectedRevision:1}),coreOrgA,s.token)).status,200);assert.equal((await save(f,'edit-cannot-create',f.draft(),coreOrgA,s.token)).status,403);await grantRef.update({permissions:['events:read'],revision:3});assert.equal((await save(f,'own-scope',f.draft({expectedRevision:2}),coreOrgA,s.token)).status,403);
  await grantRef.update({permissions:['events:read','events:publish']});assert.equal((await f.request(f.eventBase(coreOrgA),undefined,s.token)).status,403);
});
test('Stage 9A concurrent edits and same/different request retries produce one revision and one audit per mutation',async t=>{
  const f=await eventFixture(t),value=f.draft();const responses=await Promise.all([save(f,'retry',value),save(f,'retry',value)]);assert.deepEqual(responses.map(r=>r.status),[200,200]);assert.equal((await f.root.collection('msaEventAudit').where('eventId','==','retry').get()).size,1);
  assert.equal((await save(f,'other-target',value)).status,409);assert.equal((await save(f,'retry',{...value,name:'Different body'})).status,409);assert.equal((await save(f,'cross-receipt',value,coreOrgB)).status,409);
  const edits=[f.draft({expectedRevision:1,name:'Edit satu'}),f.draft({expectedRevision:1,name:'Edit dua'})],changed=await Promise.all(edits.map(v=>save(f,'retry',v)));assert.deepEqual(changed.map(r=>r.status).sort(),[200,409]);assert.equal((await f.root.collection('msaServiceEvents').doc('retry').get()).data().revision,2);assert.equal((await f.root.collection('msaEventAudit').where('eventId','==','retry').get()).size,2);
});
test('Stage 9A revocation, membership regrant, suspension/reactivation and transaction authorization loss cannot restore stale event access',async t=>{
  const f=await eventFixture(t),u=await f.account(),s=await f.signIn(u);await f.grant(u,coreOrgA,'manager');await f.eventGrant(u.uid,coreOrgA);const v=f.draft();assert.equal((await save(f,'before-revoke',v,coreOrgA,s.token)).status,200);
  let reached,release;const started=new Promise(r=>reached=r),wait=new Promise(r=>release=r);let checks=0;
  const actor={uid:u.uid,revision:3,check:async()=>{if(++checks===1){reached();await wait;}return true;}};
  const service=createMsaEvents({...f,core:f.core}),writing=service.save(actor,coreOrgA,'revocation-race',f.draft()).catch(e=>e);await started;
  assert.equal((await f.grant(u,coreOrgA,'manager',{expectedRevision:1,status:'revoked'})).status,200);release();const outcome=await writing;assert.equal(outcome.status,403,JSON.stringify({code:outcome.code,message:outcome.message}));assert.equal((await f.root.collection('msaServiceEvents').doc('revocation-race').get()).exists,false);assert.equal((await save(f,'before-revoke',v,coreOrgA,s.token)).status,403);
  await f.grant(u,coreOrgA,'manager',{expectedRevision:2});assert.equal((await f.request(f.eventBase(coreOrgA),undefined,s.token)).status,403);
  const grantRef=f.root.collection('msaEventGrants').doc(coreMembershipId(coreOrgA,u.uid));await grantRef.update({membershipRevision:3,revision:2});assert.equal((await f.request(f.eventBase(coreOrgA),undefined,s.token)).status,200);
  assert.equal((await f.request('/api/a1/accounts/'+u.uid+'/change',{state:'suspended',expectedRevision:3,requestId:randomUUID(),reason:'Penangguhan fiktif untuk tes event'})).status,200);assert.equal((await f.request(f.eventBase(coreOrgA),undefined,s.token)).status,401);
  assert.equal((await f.request('/api/a1/accounts/'+u.uid+'/change',{state:'active',expectedRevision:4,requestId:randomUUID(),reason:'Reaktivasi tidak memulihkan event grant'})).status,200);const fresh=await f.signIn(u);assert.equal((await f.request(f.eventBase(coreOrgA),undefined,fresh.token)).status,403);
});

test('Stage 9A rechecks actor before commit and revoked PIC/member/provider blocks assignment without partial rows',async t=>{
  const f=await eventFixture(t),u=await f.account();await f.grant(u,coreOrgA,'viewer');await f.eventGrant(u.uid,coreOrgA,['events:pic']);const membershipId=coreMembershipId(coreOrgA,u.uid),value=f.draft({picMembershipId:membershipId}),ref=f.root.collection('msaEventGrants').doc(membershipId);
  let checks=0;const service=createMsaEvents({...f,core:f.core}),actor={...f.actor,check:async()=>++checks===1};await assert.rejects(service.save(actor,coreOrgA,'lost-auth',value),e=>e.status===403);assert.equal((await f.root.collection('msaServiceEvents').doc('lost-auth').get()).exists,false);assert.equal((await f.root.collection('msaEventAudit').where('eventId','==','lost-auth').get()).size,0);
  await ref.update({status:'revoked'});assert.equal((await save(f,'revoked-pic-grant',value)).status,403);await ref.update({status:'active'});await f.grant(u,coreOrgA,'viewer',{expectedRevision:1,status:'revoked'});assert.equal((await save(f,'revoked-pic-member',value)).status,403);
  await f.auth.updateUser(f.uid,{disabled:true});assert.equal((await save(f,'disabled-actor')).status,401);assert.equal((await f.request(f.eventBase(coreOrgA))).status,401);
});
