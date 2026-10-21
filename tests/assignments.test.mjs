import test,{mock} from 'node:test';
mock.timers.enable({apis:['Date'],now:new Date('2026-10-21T05:00:00Z')});
import assert from 'node:assert/strict';
import {seed,getSession} from '../data.js';
import {applyMentorConfiguration,defaultMentorAt,effectiveMentor,setTemporaryMentor,setPermanentMentor,addInitialDefault} from '../assignments.js';
import {saveService} from '../scheduling.js';
import {attendanceExportRows} from '../reports.js';
import {mentorSelectionLabel,groupsWithAssignmentsView,assignmentControls} from '../assignment-ui.js';

const friday='demo-pakel-2026-10-23';
const visit=(db,date)=>saveService(db,{schoolId:'s1',date,groupIds:['g1','g2','g3']});

test('Each group has one default assignment and mentor identity is independent from group identity',()=>{
  const db=seed(),next=visit(db,'2026-11-06');
  assert.equal(db.mentors.length,8);assert.equal(db.defaultMentorAssignments.length,16);
  for(const g of db.groups){const rows=db.defaultMentorAssignments.filter(a=>a.groupId===g.id);assert.equal(rows.length,1);assert.ok(db.mentors.some(m=>m.id===rows[0].mentorId));assert.equal(g.mentor,undefined);}
  assert.equal(effectiveMentor(db,'g1',friday).mentorId,'mentor-lupi');assert.equal(effectiveMentor(db,'g1',next.id).mentorId,'mentor-lupi');
  assert.equal(mentorSelectionLabel(db,'g1',friday).includes('Kak Lupi'),true);
});
test('Temporary replacement affects exactly one group/service slot and never changes default or student attendance',()=>{
  const db=seed(),next=visit(db,'2026-11-06');getSession(db,'g1',friday).records[0].status='present';
  const sessions=structuredClone(db.sessions),students=structuredClone(db.students),groups=structuredClone(db.groups),defaults=structuredClone(db.defaultMentorAssignments);
  setTemporaryMentor(db,{groupId:'g1',serviceSessionId:friday,mentorId:'mentor-akris'});
  assert.equal(effectiveMentor(db,'g1',friday).name,'Kak Akris');assert.equal(defaultMentorAt(db,'g1').name,'Kak Lupi');
  assert.equal(effectiveMentor(db,'g1',next.id).name,'Kak Lupi');assert.equal(effectiveMentor(db,'g2',friday).name,'Kak Yulius');
  assert.deepEqual(db.sessions,sessions);assert.deepEqual(db.students,students);assert.deepEqual(db.groups,groups);assert.deepEqual(db.defaultMentorAssignments,defaults);
  assert.match(mentorSelectionLabel(db,'g1',friday),/Kak Lupi[\s\S]*Pengganti sesi ini: Kak Akris/);
});
test('Temporary duplicates are refused; explicit update retains previous assignment in the audit record',()=>{
  const db=seed(),first=setTemporaryMentor(db,{groupId:'g1',serviceSessionId:friday,mentorId:'mentor-akris'});
  assert.throws(()=>setTemporaryMentor(db,{groupId:'g1',serviceSessionId:friday,mentorId:'mentor-devid'}),/Sudah ada pengganti/);
  setTemporaryMentor(db,{groupId:'g1',serviceSessionId:friday,mentorId:'mentor-devid'},first.id);
  assert.equal(db.sessionMentorOverrides.length,1);assert.equal(db.mentorAssignmentEvents.at(-1).previous.mentorId,'mentor-akris');assert.equal(db.mentorAssignmentEvents.at(-1).next.mentorId,'mentor-devid');
  assert.equal(effectiveMentor(JSON.parse(JSON.stringify(db)),'g1',friday).mentorId,'mentor-devid');
});
test('Permanent assignment uses the effective date across subsequent sessions and preserves old assignment snapshots',()=>{
  const db=seed(),nov=visit(db,'2026-11-06'),later=visit(db,'2026-11-13');
  getSession(db,'g1',friday).records[0].status='excused';
  const sessions=structuredClone(db.sessions),historical=effectiveMentor(db,'g1','legacy-s1-2026-10-14');
  setPermanentMentor(db,{groupId:'g1',mentorId:'mentor-chriz',effectiveFrom:'2026-11-01'});
  assert.equal(defaultMentorAt(db,'g1','2026-10-31').mentorId,'mentor-lupi');assert.equal(defaultMentorAt(db,'g1','2026-11-01').mentorId,'mentor-chriz');
  assert.equal(effectiveMentor(db,'g1',friday).mentorId,'mentor-lupi');assert.equal(effectiveMentor(db,'g1',nov.id).mentorId,'mentor-chriz');assert.equal(effectiveMentor(db,'g1',later.id).mentorId,'mentor-chriz');
  assert.deepEqual(effectiveMentor(db,'g1','legacy-s1-2026-10-14'),historical);assert.deepEqual(db.sessions,sessions);
  assert.equal(db.defaultMentorAssignments.filter(a=>a.groupId==='g1').length,2);
  assert.throws(()=>setPermanentMentor(db,{groupId:'g1',mentorId:'mentor-akris',effectiveFrom:'2026-10-01'}),/lampau/);
});
test('Future batches use the effective mentor even if attendance was already started; override has precedence',()=>{
  const db=seed(),batch=getSession(db,'g1',friday),before=structuredClone(batch);
  setTemporaryMentor(db,{groupId:'g1',mentorId:'mentor-akris',serviceSessionId:friday});
  setPermanentMentor(db,{groupId:'g1',mentorId:'mentor-chriz',effectiveFrom:'2026-10-23'});
  assert.equal(defaultMentorAt(db,'g1','2026-10-23').name,'Kak Chriz');assert.equal(effectiveMentor(db,'g1',friday).name,'Kak Akris');
  assert.deepEqual(batch,before);
  const snapshots=db.mentorAssignmentSnapshots.filter(s=>s.groupId==='g1'&&s.serviceSessionId===friday);assert.equal(snapshots.at(-1).mentorId,'mentor-akris');assert.ok(snapshots.some(s=>s.mentorId==='mentor-lupi'));
});
test('Permanent duplicate start dates are refused, explicit edits preserve prior values, and later plans remain distinct',()=>{
  const db=seed(),first=setPermanentMentor(db,{groupId:'g1',mentorId:'mentor-chriz',effectiveFrom:'2026-11-01'});
  assert.throws(()=>setPermanentMentor(db,{groupId:'g1',mentorId:'mentor-devid',effectiveFrom:'2026-11-01'}),/Sudah ada penugasan/);
  setPermanentMentor(db,{groupId:'g1',mentorId:'mentor-devid',effectiveFrom:'2026-11-01'},first.id);
  setPermanentMentor(db,{groupId:'g1',mentorId:'mentor-akris',effectiveFrom:'2026-12-01'});
  assert.equal(defaultMentorAt(db,'g1','2026-11-30').mentorId,'mentor-devid');assert.equal(defaultMentorAt(db,'g1','2026-12-01').mentorId,'mentor-akris');
  assert.equal(db.defaultMentorAssignments.filter(a=>a.groupId==='g1'&&a.effectiveFrom==='2026-11-01').length,1);
  assert.equal(db.mentorAssignmentEvents[1].previous.mentorId,'mentor-chriz');
});
test('Invalid people, cross-school/group slots and past overrides cannot mutate assignments or attendance',()=>{
  const db=seed(),before=structuredClone(db);
  for(const values of [{groupId:'g1',mentorId:'missing',serviceSessionId:friday},{groupId:'g4',mentorId:'mentor-lupi',serviceSessionId:friday},{groupId:'g1',mentorId:'mentor-lupi',serviceSessionId:'legacy-s1-2026-10-14'},{groupId:'g1',mentorId:'mentor-lupi',serviceSessionId:'demo-pakel-2026-10-09'}])assert.throws(()=>setTemporaryMentor(db,values));
  assert.deepEqual(db,before);
});
test('Legacy names migrate into people, defaults and historic snapshots without touching original groups or attendance',()=>{
  const db=seed();for(const key of ['mentors','defaultMentorAssignments','sessionMentorOverrides','mentorAssignmentSnapshots','mentorAssignmentEvents','mentorConfigRevision'])delete db[key];
  db.groups[0].mentor='Kak Default Lama';const old=db.sessions.find(s=>s.groupId==='g1'&&s.date==='2026-10-14');old.mentor='Kak Pengganti Arsip';
  const groups=structuredClone(db.groups),sessions=structuredClone(db.sessions),students=structuredClone(db.students);
  assert.equal(applyMentorConfiguration(db).changed,true);
  assert.equal(defaultMentorAt(db,'g1').name,'Kak Lupi');assert.equal(effectiveMentor(db,'g1',old.serviceSessionId).name,'Kak Pengganti Arsip');
  assert.deepEqual(db.sessions,sessions);assert.deepEqual(db.students,students);assert.deepEqual(db.groups,groups);
  assert.equal(db.defaultMentorAssignments.length,16);assert.equal(applyMentorConfiguration(db).changed,false);
});
test('A replacement follows the stable service ID on reschedule and is absent from other services',()=>{
  const db=seed(),other=visit(db,'2026-11-06');setTemporaryMentor(db,{groupId:'g1',mentorId:'mentor-akris',serviceSessionId:friday});
  saveService(db,{schoolId:'s1',date:'2026-10-30',groupIds:['g1','g2','g3']},friday);
  assert.equal(effectiveMentor(db,'g1',friday).mentorId,'mentor-akris');assert.equal(effectiveMentor(db,'g1',other.id).mentorId,'mentor-lupi');
});
test('Rescheduling cannot detach a temporary mentor from its group or school',()=>{
  const db=seed();setTemporaryMentor(db,{groupId:'g1',mentorId:'mentor-akris',serviceSessionId:friday});const before=structuredClone(db);
  assert.throws(()=>saveService(db,{schoolId:'s1',date:'2026-10-30',groupIds:['g2','g3']},friday),/pengganti mentor/);
  assert.throws(()=>saveService(db,{schoolId:'s2',date:'2026-11-06',groupIds:['g4']},friday),/pengganti mentor/);
  assert.deepEqual(db,before);
});
test('Reports expose the effective mentor and source while historical exports and student statuses are preserved',()=>{
  const db=seed(),batch=getSession(db,'g1',friday);batch.records[0].status='present';
  const before=structuredClone(db.sessions);setTemporaryMentor(db,{groupId:'g1',mentorId:'mentor-akris',serviceSessionId:friday});
  const rows=attendanceExportRows(db,{serviceSessionId:friday,groupId:'g1'});
  assert.ok(rows.slice(4).every(r=>r[10]==='Kak Akris'&&r[11]==='mentor-akris'&&r[12]==='Pengganti sementara'));
  assert.deepEqual(db.sessions,before);
  const history=attendanceExportRows(db,{serviceSessionId:'legacy-s1-2026-10-14',groupId:'g1'});assert.ok(history.slice(4).every(r=>r[10]==='Kak Lupi'));
  assert.match(groupsWithAssignmentsView(db,()=>''),/Mentor tetap/);assert.match(assignmentControls(db,'g1','temporary'),/Mentor tetap Kak Lupi tidak berubah/);
});
test('New groups receive an independent initial default and cannot get a second initial assignment',()=>{
  const db=seed();db.groups.push({id:'custom',schoolId:'s1',name:'Kelompok Demo'});addInitialDefault(db,'custom','mentor-devid');
  assert.equal(defaultMentorAt(db,'custom').mentorId,'mentor-devid');assert.throws(()=>addInitialDefault(db,'custom','mentor-akris'),/sudah memiliki/);
});
