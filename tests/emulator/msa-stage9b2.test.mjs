import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {schedulingFixture,coreOrgA,coreOrgB,coreControl} from './msa-stage9b2-fixture.mjs';
import {calendarFixture} from './msa-stage9b1-fixture.mjs';
import {coreMembershipId} from '../../backend/msa-core.mjs';
import {createMsaScheduling} from '../../backend/msa-scheduling.mjs';
const tables=async(f,exclude=[])=>{const result={};for(const c of await f.root.listCollections())if(!exclude.includes(c.id))result[c.id]=(await c.get()).docs.map(d=>({id:d.id,...d.data()}));return result;};
const eventTables=['msaRecurrenceSeries','msaServiceEvents','msaEventAudit','msaEventReceipts'];

test('Stage 9B.2 is independently disabled and rejects anonymous, origin, query and body injection',async t=>{
  const off=await calendarFixture(t);assert.equal(off.adminAuthentication.a1.scheduling,undefined);assert.equal((await off.request('/api/stage9b2/dashboard')).status,404);
  const f=await schedulingFixture(t);assert.equal((await f.request('/api/stage9b2/dashboard',undefined,'')).status,401);assert.equal((await f.request('/api/stage9b2/dashboard',undefined,f.token,{Origin:'https://example.invalid'})).status,403);assert.equal((await f.request('/api/stage9b2/dashboard?uid=other')).status,400);
  const v=await f.prepare();for(const patch of [{confirmed:false},{expectedRevision:1},{status:'published'},{previewToken:'invalid'}])assert.equal((await f.create('bad',{...v,...patch})).status,400);
  delete process.env.ABC_MSA_STAGE9B2;assert.equal((await f.create('off',v)).status,503);
});
test('Preview is read-only; weekly creation atomically writes independent drafts/audits and preserves all non-event domains',async t=>{
  const f=await schedulingFixture(t),all=await tables(f),before=await tables(f,eventTables),v=await f.prepare({programId:'fictional-goes-to-school'});assert.deepEqual(await tables(f),all);
  const response=await f.create('weekly',v);assert.equal(response.status,200);const result=await response.json();assert.equal(result.events.length,4);assert.equal(new Set(result.events.map(e=>e.id)).size,4);
  for(const [i,row] of result.events.entries()){assert.equal(row.seriesId,'weekly');assert.equal(row.occurrenceIndex,i);assert.equal(row.status,'draft');assert.equal(row.programId,'fictional-goes-to-school');assert.equal(row.revision,1);assert.equal(row.organizationId,coreOrgA);}
  const history=(await f.root.collection('msaEventAudit').where('seriesId','==','weekly').get()).docs.map(d=>d.data());assert.equal(history.length,4);assert.ok(history.every(h=>h.actorUid===f.uid&&h.source==='stage9b2-preview-confirmed'&&h.previous===null));assert.deepEqual(await tables(f,eventTables),before);
  const other=await (await f.create('weekly-b',await f.prepare({},coreOrgB),coreOrgB)).json();assert.equal(other.events[0].organizationId,coreOrgB);assert.equal(other.events[0].programId,null);assert.deepEqual(await tables(f,eventTables),before);
  assert.equal((await f.agenda()).status,200);assert.equal((await (await f.agenda()).json()).events.length,0);
});
test('Concurrent retries and competing series requests never duplicate occurrences or partially commit',async t=>{
  const f=await schedulingFixture(t),v=await f.prepare();const replies=await Promise.all([f.create('racing',v),f.create('racing',v)]);assert.deepEqual(replies.map(r=>r.status),[200,200]);assert.deepEqual(await replies[0].json(),await replies[1].json());assert.equal((await f.root.collection('msaServiceEvents').get()).size,4);
  assert.equal((await f.create('other',v)).status,409);assert.equal((await f.create('racing',{...v,requestId:randomUUID()})).status,409);
  const next=await f.prepare(),competing=await Promise.all([f.create('compete',next),f.create('compete',{...next,requestId:randomUUID()})]);assert.deepEqual(competing.map(r=>r.status).sort(),[200,409]);assert.equal((await f.root.collection('msaServiceEvents').get()).size,8);
  const before=await tables(f);assert.equal((await f.create('limit',{...v,requestId:randomUUID(),schedule:{...v.schedule,endDate:'2027-02-01'}})).status,400);assert.deepEqual(await tables(f),before);
  await f.root.collection('msaEventGrants').doc(coreMembershipId(coreOrgA,f.uid)).update({permissions:['events:read','events:pic']});const revoked=await tables(f);assert.equal((await f.create('racing',v)).status,403);assert.deepEqual(await tables(f),revoked);
});
test('Exactly twelve weekly occurrences and one-time creation succeed; thirteenth and past creation do not write',async t=>{
  const f=await schedulingFixture(t),v=await f.prepare({endDate:'2027-01-19'}),response=await f.create('twelve',v);assert.equal(response.status,200);assert.equal((await response.json()).events.length,12);
  const once=await f.prepare({frequency:'once',endDate:'2026-11-03'});assert.equal((await (await f.create('once',once)).json()).events.length,1);const before=await tables(f);
  assert.equal((await f.preview(f.schedule({endDate:'2027-01-26'}))).status,400);const past=await f.prepare({startDate:'2020-01-07',endDate:'2020-01-07',frequency:'once'});assert.equal((await f.create('past',past)).status,409);assert.deepEqual(await tables(f),before);
});
test('Commit binds preview fields and current organization/program/PIC revisions with no partial writes',async t=>{
  const f=await schedulingFixture(t),v=await f.prepare({programId:'fictional-goes-to-school'}),program=f.root.collection('msaCorePrograms').doc('fictional-goes-to-school');
  await program.update({revision:2});let before=await tables(f);assert.equal((await f.create('stale',v)).status,409);assert.deepEqual(await tables(f),before);
  const fresh=await f.prepare();assert.equal((await f.create('tamper',{...fresh,schedule:{...fresh.schedule,venue:'Tempat diubah setelah pratinjau'}})).status,409);
  await program.update({status:'inactive'});assert.equal((await f.preview(f.schedule({programId:'fictional-goes-to-school'}))).status,403);
  const pic=f.root.collection('msaEventGrants').doc(coreMembershipId(coreOrgA,f.uid));await pic.update({revision:2});before=await tables(f);assert.equal((await f.create('pic-stale',fresh)).status,409);assert.deepEqual(await tables(f),before);
  await pic.update({status:'revoked'});assert.equal((await f.create('pic-revoked',fresh)).status,403);
});
test('Cross-organization, missing explicit grants, revoked membership and suspended PIC are denied',async t=>{
  const f=await schedulingFixture(t),v=await f.prepare(),u=await f.account(),s=await f.signIn(u);await f.grant(u,coreOrgA,'manager');
  assert.equal((await f.preview(f.schedule(),coreOrgA,s.token)).status,403);await f.eventGrant(u.uid,coreOrgA,['events:read','events:create']);assert.equal((await f.create('foreign',v,coreOrgB,s.token)).status,403);
  assert.equal((await f.preview(f.schedule({picMembershipId:coreMembershipId(coreOrgB,f.uid)}))).status,403);assert.equal((await f.preview(f.schedule({programId:'fictional-pojok-ceria'}))).status,403);
  await f.grant(u,coreOrgA,'manager',{expectedRevision:1,status:'revoked'});assert.equal((await f.preview(f.schedule(),coreOrgA,s.token)).status,403);
  await f.auth.updateUser(f.uid,{disabled:true});const before=await tables(f);assert.equal((await f.create('suspended',v,coreOrgA,s.token)).status,403);assert.deepEqual(await tables(f),before);
});
test('Authority failure before commit leaves no series, event, audit or receipt',async t=>{
  const f=await schedulingFixture(t),v=await f.prepare(),before=await tables(f);let checks=0;const actor={...f.actor,check:async()=>++checks<3},s=createMsaScheduling({...f,core:f.core,events:f.events,calendar:f.calendar});await assert.rejects(s.create(actor,coreOrgA,'denied',v),e=>e.status===403);assert.deepEqual(await tables(f),before);
});
test('A write failure rolls back the entire bounded transaction; suspended PIC and stale membership never commit',async t=>{
  const f=await schedulingFixture(t),v=await f.prepare(),before=await tables(f);let writes=0;
  const db={runTransaction:fn=>f.db.runTransaction(tx=>fn(new Proxy(tx,{get(target,key){if(key==='create')return (...args)=>{if(++writes===4)throw Error('fictional write failure');return target.create(...args);};const item=target[key];return typeof item==='function'?item.bind(target):item;}})))};
  const s=createMsaScheduling({...f,db,core:f.core,events:f.events,calendar:f.calendar});await assert.rejects(s.create(f.actor,coreOrgA,'rollback',v),/fictional write failure/);assert.deepEqual(await tables(f),before);
  const pic=await f.account();await f.grant(pic,coreOrgA,'viewer');await f.eventGrant(pic.uid,coreOrgA,['events:pic']);const assigned=await f.prepare({picMembershipId:coreMembershipId(coreOrgA,pic.uid)});await f.auth.updateUser(pic.uid,{disabled:true});const protectedBefore=await tables(f);assert.equal((await f.create('suspended-pic',assigned)).status,403);assert.deepEqual(await tables(f),protectedBefore);
  await f.auth.updateUser(pic.uid,{disabled:false});await f.root.collection('msaCoreMemberships').doc(coreMembershipId(coreOrgA,pic.uid)).update({revision:2});assert.equal((await f.create('stale-membership',assigned)).status,403);
});
test('Individual edit, publish and cancellation retain series identity and leave siblings/history untouched',async t=>{
  const f=await schedulingFixture(t),v=await f.prepare(),r=await (await f.create('individual',v)).json(),[first,...siblings]=r.events,before=await Promise.all(siblings.map(e=>f.root.collection('msaServiceEvents').doc(e.id).get().then(d=>d.data())));
  assert.equal((await f.save(first.id,{expectedRevision:1,startDate:'2026-11-04'})).status,200);assert.equal((await f.save(first.id,{expectedRevision:1,name:'Stale edit'})).status,409);assert.equal((await f.transition(first.id,'publish',{expectedRevision:2})).status,200);assert.equal((await f.transition(first.id,'cancel',{expectedRevision:3})).status,200);
  const detail=await (await f.request(f.eventBase(coreOrgA)+'/'+first.id)).json();assert.equal(detail.event.seriesId,'individual');assert.equal(detail.event.id,first.id);assert.deepEqual(detail.history.map(h=>h.next.revision),[1,2,3,4]);assert.equal(detail.history[0].next.startDate,'2026-11-03');assert.deepEqual(await Promise.all(siblings.map(e=>f.root.collection('msaServiceEvents').doc(e.id).get().then(d=>d.data()))),before);
  const historical=f.root.collection('msaServiceEvents').doc(siblings[0].id);await historical.update({startAt:1});assert.equal((await f.save(siblings[0].id,{expectedRevision:1})).status,409);assert.equal((await f.transition(siblings[0].id)).status,409);assert.deepEqual((await (await f.request(f.calendarBase(coreOrgA,siblings[0].id))).json()).capabilities,{edit:false,publish:false,cancel:false});
});
test('Dashboard personalizes PIC and action drafts, denies draft/foreign exposure and has explicit limits',async t=>{
  const f=await schedulingFixture(t),u=await f.account(),s=await f.signIn(u);await f.grant(u,coreOrgA,'viewer');await f.eventGrant(u.uid,coreOrgA,['events:calendar:read']);
  await f.save('visible');await f.transition('visible');await f.save('private');await f.save('foreign',{},coreOrgB);await f.transition('foreign','publish',{},coreOrgB);
  const path='/api/stage9b2/dashboard',owner=await (await f.request(path)).json(),reader=await (await f.request(path,undefined,s.token)).json();assert.equal(owner.upcoming.length,2);assert.equal(owner.assigned.length,3);assert.equal(owner.drafts.length,1);assert.deepEqual(reader.upcoming.map(e=>e.id),['visible']);assert.deepEqual(reader.assigned,[]);assert.deepEqual(reader.drafts,[]);assert.ok(!JSON.stringify(reader).includes('private'));assert.ok(!JSON.stringify(reader).includes(coreOrgB));
  await f.root.collection('msaEventGrants').doc(coreMembershipId(coreOrgA,u.uid)).update({permissions:['events:read','events:pic']});await f.save('assigned-private',{picMembershipId:coreMembershipId(coreOrgA,u.uid)});const pic=await (await f.request(path,undefined,s.token)).json();assert.deepEqual(pic.assigned.map(e=>e.id),['assigned-private']);assert.deepEqual(pic.drafts,[]);
  const row=(await f.root.collection('msaServiceEvents').doc('visible').get()).data(),batch=f.db.batch();for(let i=0;i<201;i++)batch.create(f.root.collection('msaServiceEvents').doc('limit-'+i),{...row,id:'limit-'+i});await batch.commit();const overflow=await f.request(path);assert.equal(overflow.status,409);assert.match((await overflow.json()).error,/200 pelayanan/);
});
test('Dashboard ninety-day horizon includes the last local WIT date and excludes instants beyond the horizon',async t=>{
  const f=await schedulingFixture(t),at=Date.parse('2026-11-03T18:00:00Z'),horizon=at+90*86400000;
  for(const [id,offset] of [['edge',-1800000],['outside',3600000]]){const local=new Date(horizon+offset+9*3600000).toISOString();assert.equal((await f.save(id,{startDate:local.slice(0,10),startTime:local.slice(11,16),timezone:'Asia/Jayapura'})).status,200);assert.equal((await f.transition(id)).status,200);}
  const s=createMsaScheduling({...f,core:f.core,events:f.events,calendar:f.calendar,now:()=>at}),result=await s.dashboard(f.actor);assert.deepEqual(result.upcoming.map(e=>e.id),['edge']);
});
