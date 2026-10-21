import test,{mock} from 'node:test';
mock.timers.enable({apis:['Date'],now:new Date('2026-10-21T05:00:00Z')});
import assert from 'node:assert/strict';
import {seed,getSession,count} from '../data.js';
import {applyServiceConfiguration,isFriday,longDate,saveService,scheduledForSchool,availableGroups,addAttendanceRecord,serviceProgress,serviceTiming,reportEntries} from '../scheduling.js';
import {attendanceExportRows} from '../reports.js';
import {dateSelectionView} from '../service-ui.js';

test('Explicit fictional Fridays follow 2/1/1 frequency without generating other Fridays',()=>{
  const db=seed(),visits=db.serviceSessions.filter(s=>!s.legacy);
  assert.equal(visits.length,4);assert.ok(visits.every(s=>isFriday(s.date)&&s.fictional));
  assert.deepEqual(db.schools.map(s=>visits.filter(v=>v.schoolId===s.id).length),[2,1,1]);
  assert.ok(!visits.some(v=>v.date==='2026-10-02'));
  assert.match(longDate('2026-10-23'),/^Jumat, 23 Oktober 2026$/);
  assert.ok(!isFriday('2026-10-21'));assert.ok(!isFriday('2026-02-30'));
});
test('Mentor date and group selections are isolated by scheduled school and service ID',()=>{
  const db=seed();
  assert.deepEqual(scheduledForSchool(db,'s1').map(v=>v.date),['2026-10-09','2026-10-23']);
  assert.deepEqual(scheduledForSchool(db,'s2').map(v=>v.date),['2026-10-16']);
  assert.deepEqual(availableGroups(db,'demo-kertajaya-2026-10-30').map(g=>g.id),['g7','g8','g9']);
  assert.throws(()=>getSession(db,'g4','demo-pakel-2026-10-23'),/tidak sesuai/);
  assert.throws(()=>getSession(db,'g1','2026-10-23'),/tidak sesuai/);
});
test('Same student on two Pakel Fridays gets independent attendance; duplicate records in one visit are refused',()=>{
  const db=seed(),first=getSession(db,'g1','demo-pakel-2026-10-09'),second=getSession(db,'g1','demo-pakel-2026-10-23');
  const original=structuredClone(first.records);second.records[0].status='excused';
  assert.equal(second.records[0].studentId,first.records[0].studentId);assert.deepEqual(first.records,original);
  assert.notEqual(first.serviceSessionId,second.serviceSessionId);
  assert.throws(()=>addAttendanceRecord(db,second,{studentId:first.records[0].studentId,name:'Duplikat',status:'present'}),/sudah tercatat/);
  const moved=db.students.find(s=>s.id===second.records[0].studentId);moved.groupId='g2';
  const other=getSession(db,'g2',second.serviceSessionId);assert.ok(!other.records.some(r=>r.studentId===moved.id));
  assert.ok(second.records.every(r=>r.schoolId==='s1'&&r.serviceSessionId===second.serviceSessionId&&r.serviceDate===second.date&&r.groupId==='g1'));
});
test('Admin rejects duplicate dates, non-Fridays and wrong-school groups without changing data',()=>{
  const db=seed(),original=structuredClone(db);
  for(const data of [{schoolId:'s1',date:'2026-10-23',groupIds:['g1']},{schoolId:'s1',date:'2026-10-22',groupIds:['g1']},{schoolId:'s1',date:'2026-11-06',groupIds:['g4']},{schoolId:'s1',date:'2026-11-06',groupIds:[]}])assert.throws(()=>saveService(db,data));
  assert.deepEqual(db,original);
});
test('Rescheduling retains service and attendance IDs, students, statuses and original-date history',()=>{
  const db=seed(),id='demo-pakel-2026-10-23',batch=getSession(db,'g1',id);batch.records[0].status='excused';
  const original=structuredClone(batch),visit=saveService(db,{schoolId:'s1',date:'2026-10-30',groupIds:['g1','g2','g3']},id);
  assert.equal(visit.id,id);assert.equal(batch.id,original.id);assert.equal(batch.date,'2026-10-30');
  assert.deepEqual(batch.records.map(r=>[r.studentId,r.status]),original.records.map(r=>[r.studentId,r.status]));
  assert.ok(batch.records.every(r=>r.serviceSessionId===id&&r.serviceDate==='2026-10-30'));
  assert.equal(visit.dateHistory[0].from,'2026-10-23');assert.equal(getSession(db,'g1',id),batch);
  assert.throws(()=>saveService(db,{schoolId:'s2',date:'2026-11-06',groupIds:['g4']},id),/Sekolah tidak/);
  assert.throws(()=>saveService(db,{schoolId:'s1',date:'2026-11-06',groupIds:['g2']},id),/harus tetap/);
});
test('Legacy migration preserves original dates/IDs/statuses, canonical school IDs and rosters',()=>{
  const db=seed();db.sessions=db.sessions.filter(s=>s.id.startsWith('2026-'));delete db.serviceSessions;delete db.serviceConfigRevision;
  db.schools[0].name='SDN Pacarkeling V (Pakel)';db.schools[1].name='SDN Airlangga';db.schools[2].name='SDN Kertajaya';
  for(const b of db.sessions){delete b.serviceSessionId;for(const r of b.records)for(const k of ['schoolId','serviceSessionId','serviceDate','groupId'])delete r[k];}
  const before=structuredClone(db);assert.equal(applyServiceConfiguration(db).changed,true);
  assert.deepEqual(db.students,before.students);assert.equal(db.sessions.length,before.sessions.length);
  db.sessions.forEach((s,i)=>{assert.equal(s.id,before.sessions[i].id);assert.equal(s.date,before.sessions[i].date);assert.deepEqual(s.records.map(r=>[r.studentId,r.status]),before.sessions[i].records.map(r=>[r.studentId,r.status]));});
  assert.equal(db.schools[1].name,'SDN Airlangga III');assert.equal(applyServiceConfiguration(db).changed,false);
  assert.ok(scheduledForSchool(db,'s1').every(v=>isFriday(v.date)));
});
test('Reports and export distinguish dates by service ID and support month/school/date/group filters',()=>{
  const db=seed(),rows=reportEntries(db,{schoolId:'s1',month:'2026-10',groupId:'g1'});
  assert.equal(rows.filter(r=>!r.visit.legacy).length,2);
  const filtered=reportEntries(db,{schoolId:'s1',month:'2026-10',serviceSessionId:'demo-pakel-2026-10-09',groupId:'g1'});
  assert.equal(filtered.length,1);assert.equal(count(filtered[0].batch.records).present,10);
  const exported=attendanceExportRows(db,{schoolId:'s1',month:'2026-10',groupId:'g1'});
  assert.ok(exported.some(r=>r[2]==='demo-pakel-2026-10-09'&&r[3]==='2026-10-09'));
  assert.ok(exported.some(r=>r[2]==='demo-pakel-2026-10-23'&&r[3]==='2026-10-23'));
  assert.deepEqual(reportEntries(db,{month:'2026-11'}),[]);
});
test('Empty schedules, selected dates, and pending/in-progress/completed timing are visible',()=>{
  const db=seed(),visit=db.serviceSessions.find(s=>s.id==='demo-pakel-2026-10-23');
  const icon=()=>'',steps=()=>'';
  assert.match(dateSelectionView(db,'s1',visit.date,icon,steps,{open:true,month:'2026-10'}),/calendar-day selected/);
  assert.equal(serviceTiming(visit,'2026-10-21'),'upcoming');assert.equal(serviceTiming(visit,'2026-10-23'),'active');
  assert.equal(serviceProgress(db,visit).state,'pending');getSession(db,'g1',visit.id);assert.equal(serviceProgress(db,visit).state,'draft');
  assert.equal(serviceProgress(db,db.serviceSessions.find(s=>s.id==='demo-pakel-2026-10-09')).state,'completed');
  db.serviceSessions=db.serviceSessions.filter(v=>v.schoolId!=='s3');assert.match(dateSelectionView(db,'s3','2026-10-16',icon,steps),/Belum dijadwalkan/);
});
