import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {seed,getSession,applyGroupConfiguration} from '../data.js';
import {activeGroups} from '../group-config.js';
import {applyMentorConfiguration,defaultMentorAt,effectiveMentor,setTemporaryMentor,setPermanentMentor} from '../assignments.js';
import {jakartaToday,recentFriday,shiftMonth} from '../dates.js';
import {selectFridayService,saveService,isFriday,canSubmitAttendance,submitAttendance,mentorGroups} from '../scheduling.js';
import {calendarGrid,dateSelectionView} from '../service-ui.js';
mock.timers.enable({apis:['Date'],now:new Date('2026-10-21T05:00:00Z')});

test('Jakarta day and latest Friday use WIB at UTC midnight boundaries',()=>{
  assert.equal(jakartaToday(new Date('2026-10-22T17:00:00Z')),'2026-10-23');
  assert.equal(recentFriday('2026-10-23'),'2026-10-23');
  assert.equal(recentFriday('2026-10-21'),'2026-10-16');
  assert.equal(recentFriday('2027-01-01'),'2027-01-01');
  assert.equal(shiftMonth('2026-12',1),'2027-01');assert.equal(shiftMonth('2026-01',-1),'2025-12');
});
test('Calendar is a compact popover with month/year controls and all weekdays enabled',()=>{
  const db=seed(),html=dateSelectionView(db,'s1','2026-10-16',()=>'',()=>'',{open:true,month:'2026-10'});
  assert.match(html,/aria-expanded="true"/);assert.match(html,/role="dialog"/);assert.doesNotMatch(html,/date-card/);
  assert.match(html,/id="calendar-month"/);assert.match(html,/id="calendar-year"/);assert.match(html,/Bulan sebelumnya/);assert.match(html,/Bulan berikutnya/);
  for(const month of ['2026-10','2026-11','2027-01','2028-02']){
    const grid=calendarGrid(month,'2026-10-16');
    const days=[...grid.matchAll(/data-action="calendar-date" data-id="([^"]+)"[^>]*>/g)];
    assert.equal(days.length,{'2026-10':31,'2026-11':30,'2027-01':31,'2028-02':29}[month]);
    for(const match of days)assert.equal(match[0].includes('disabled'),false);
  }
});
test('Selecting any unscheduled date never creates a service, even with an old confirmation flag',()=>{
  const db=seed(),before=structuredClone(db);
  for(const date of ['2026-10-02','2026-10-01'])assert.throws(()=>selectFridayService(db,'s1',date,{confirmed:true}),/Belum dijadwalkan/);
  assert.deepEqual(db,before);const visit=saveService(db,{schoolId:'s1',date:'2026-10-01',groupIds:['g1']});assert.equal(selectFridayService(db,'s1',visit.date),visit);
});
test('All 16 active groups have authoritative subtitles and one shared Chriz identity',()=>{
  const db=seed(),mapping={Hosea:'Lupi',Amos:'Chriz',Obaja:'Yulius',Zefanya:'Gabby',Zakharia:'Eva',Hagai:'Louis',Yunus:'Akris',Yoel:'Devid'};
  assert.equal(activeGroups(db).length,16);assert.equal(db.mentors.length,8);
  for(const g of activeGroups(db))assert.equal(defaultMentorAt(db,g.id).name,'Kak '+mapping[g.name]);
  assert.equal(new Set(db.groups.filter(g=>g.name==='Amos').map(g=>defaultMentorAt(db,g.id).mentorId)).size,1);
  assert.equal(new Set(db.groups.filter(g=>g.name==='Amos').map(g=>g.id)).size,3);
});
test('School/date/group selection keeps roster and history isolated and limits groups to the configured session',()=>{
  const db=seed();
  for(const school of db.schools){
    const visit=saveService(db,{schoolId:school.id,date:'2026-10-16',groupIds:activeGroups(db).filter(g=>g.schoolId===school.id).map(g=>g.id)});
    assert.equal(mentorGroups(db,visit.id).length,activeGroups(db).filter(g=>g.schoolId===school.id).length);
    for(const {id:groupId} of mentorGroups(db,visit.id)){const batch=getSession(db,groupId,visit.id);assert.deepEqual(batch.records.map(r=>r.studentId),db.students.filter(s=>s.active&&s.groupId===groupId).map(s=>s.id));}
  }
  const older=saveService(db,{schoolId:'s1',date:'2026-10-02',groupIds:['g1']});
  const a=getSession(db,'g1',older.id),b=getSession(db,'g1','demo-pakel-2026-10-09');const original=structuredClone(b);
  a.records[0].status='excused';submitAttendance(db,a);assert.deepEqual(b,original);
  assert.equal(getSession(db,'g1',older.id),a);
  a.state='draft';a.records[0].status='present';submitAttendance(db,a);assert.equal(a.state,'completed');assert.deepEqual(b,original);
});
test('Future submission is blocked without changing records, then allowed on service date',()=>{
  const db=seed(),visit=selectFridayService(db,'s1','2026-10-23'),batch=getSession(db,'g1',visit.id),before=structuredClone(batch);
  assert.equal(canSubmitAttendance(db,batch,'2026-10-22'),false);
  assert.throws(()=>submitAttendance(db,batch,'2026-10-22'),/tanggal pelayanan/);assert.deepEqual(batch,before);
  assert.equal(canSubmitAttendance(db,batch,'2026-10-23'),true);assert.equal(submitAttendance(db,batch,'2026-10-23'),true);
});
test('Version 1 migration preserves every roster, attendance and historical assignment with retired groups retained',()=>{
  const db=seed();db.groupConfigRevision=1;db.mentorConfigRevision=1;
  db.groups=db.groups.filter(g=>g.id!=='g18');db.groups.find(g=>g.id==='g4').name='Hagai';db.groups.find(g=>g.id==='g15').name='Hosea';
  for(const [id,name] of [['g16','Yunus'],['g17','Yoel']])db.groups.push({id,schoolId:'s2',name});
  db.mentors.push({id:'old-person',name:'Kak Mentor Lama'});
  db.defaultMentorAssignments.find(a=>a.groupId==='g1').mentorId='old-person';
  const snap=db.mentorAssignmentSnapshots.find(s=>s.groupId==='g1'&&s.serviceDate==='2026-10-14');snap.mentorId='old-person';snap.mentorName='Kak Mentor Lama';
  const history=structuredClone(effectiveMentor(db,'g1',snap.serviceSessionId));
  const before=structuredClone(db);
  assert.deepEqual(applyGroupConfiguration(db).issues,[]);assert.deepEqual(applyMentorConfiguration(db).issues,[]);
  assert.equal(activeGroups(db).length,16);assert.equal(db.groups.length,18);
  for(const g of before.groups)assert.ok(db.groups.some(n=>n.id===g.id&&n.schoolId===g.schoolId));
  assert.deepEqual(db.students,before.students);assert.deepEqual(db.sessions,before.sessions);assert.deepEqual(db.provisionals,before.provisionals);
  assert.deepEqual(effectiveMentor(db,'g1',snap.serviceSessionId),history);
  assert.equal(defaultMentorAt(db,'g1').name,'Kak Lupi');
  const migrated=structuredClone(db);assert.equal(applyGroupConfiguration(db).changed,false);assert.equal(applyMentorConfiguration(db).changed,false);assert.deepEqual(db,migrated);
});
test('Spelling aliases resolve to single canonical people without changing attendance statuses',()=>{
  const db=seed();db.mentorConfigRevision=1;
  const aliases=[['alias-c','Kak '+'Chr'+'is','mentor-chriz'],['alias-l','Kak '+'Lo'+'us','mentor-louis']];
  for(const [id,name] of aliases)db.mentors.push({id,name});
  db.sessionMentorOverrides.push({id:'alias-override',groupId:'g1',serviceSessionId:'demo-pakel-2026-10-23',mentorId:'alias-c'});
  const before=structuredClone(db.sessions);applyMentorConfiguration(db);
  assert.equal(db.sessionMentorOverrides.at(-1).mentorId,'mentor-chriz');
  for(const [id,,target] of aliases){assert.ok(!db.mentors.some(m=>m.id===id));assert.equal(db.mentors.filter(m=>m.id===target).length,1);}
  assert.deepEqual(db.sessions,before);
});
test('Admin temporary and effective permanent assignments preserve all attendance and past snapshots',()=>{
  const db=seed(),first=selectFridayService(db,'s1','2026-10-23'),second=saveService(db,{schoolId:'s1',date:'2026-11-06',groupIds:['g1']});
  getSession(db,'g1',first.id).records[0].status='present';const before=structuredClone(db.sessions),snapshots=structuredClone(db.mentorAssignmentSnapshots);
  setTemporaryMentor(db,{groupId:'g1',serviceSessionId:first.id,mentorId:'mentor-eva'});
  setPermanentMentor(db,{groupId:'g1',effectiveFrom:'2026-11-01',mentorId:'mentor-chriz'});
  assert.equal(effectiveMentor(db,'g1',first.id).name,'Kak Eva');assert.equal(effectiveMentor(db,'g1',second.id).name,'Kak Chriz');
  assert.deepEqual(db.sessions,before);for(const snapshot of snapshots)assert.deepEqual(db.mentorAssignmentSnapshots.find(s=>s.id===snapshot.id),snapshot);
});
