import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {seed,getSession} from '../data.js';
import {groupManagementRows} from '../assignment-ui.js';
import {applyMentorConfiguration,defaultMentorAt,selectableMentors,setTemporaryMentor,setPermanentMentor,effectiveMentor} from '../assignments.js';
import {INITIAL_DEFAULTS} from '../mentor-config.js';
import {applyStudentSchema,saveRegisteredStudent,addTemporaryStudent} from '../student-data.js';
import {birthdayOverview,birthdayInYear,ageOn} from '../birthdays.js';
import {studentExportData,attendanceExportData} from '../reports.js';
import {planStudentImport,commitStudentImport,importBirthdate} from '../student-import.js';
import {selectFridayService} from '../scheduling.js';
mock.timers.enable({apis:['Date'],now:new Date('2026-10-21T05:00:00Z')});
const student={name:'Siswa Fiktif Éka',schoolClass:'3A',gender:'male',schoolId:'s1',groupId:'g13'};
test('Group management filters use existing group IDs with 8/4/4 configured groups',()=>{
  const db=seed(),original=structuredClone(db.groups);
  assert.equal(groupManagementRows(db).length,16);
  for(const [schoolId,count] of [['s1',8],['s2',4],['s3',4]])assert.equal(groupManagementRows(db,{schoolId}).length,count);
  assert.equal(groupManagementRows(db,{schoolId:'s1',groupId:'g13'}).length,1);
  assert.equal(groupManagementRows(db,{schoolId:'s2',groupId:'g13'}).length,0);assert.deepEqual(db.groups,original);
});
test('Authoritative defaults and selectable mentors exclude retired demo people while keeping history',()=>{
  const db=seed();for(const target of INITIAL_DEFAULTS)assert.equal(defaultMentorAt(db,target.groupId).mentorId,target.mentorId);
  db.mentorConfigRevision=2;db.mentors.push({id:'demo-raka',name:'Kak Raka'});
  const assignment={id:'unexpected',groupId:'g1',mentorId:'demo-raka',effectiveFrom:'2026-10-21',baseline:false};db.defaultMentorAssignments.push(assignment);
  const history=structuredClone(db.sessions),snapshots=structuredClone(db.mentorAssignmentSnapshots);
  applyMentorConfiguration(db);
  assert.equal(defaultMentorAt(db,'g1').name,'Kak Lupi');assert.equal(assignment.disabledFrom,'2026-10-21');
  assert.equal(selectableMentors(db).length,8);assert.ok(!selectableMentors(db).some(m=>m.name.includes('Raka')));
  assert.ok(db.mentors.some(m=>m.id==='demo-raka'));assert.deepEqual(db.sessions,history);
  for(const snapshot of snapshots)assert.deepEqual(db.mentorAssignmentSnapshots.find(s=>s.id===snapshot.id),snapshot);
  assert.throws(()=>setTemporaryMentor(db,{groupId:'g1',serviceSessionId:'demo-pakel-2026-10-23',mentorId:'demo-raka'}),/mentor/);
  setTemporaryMentor(db,{groupId:'g1',serviceSessionId:'demo-pakel-2026-10-23',mentorId:'mentor-louis'});
});
test('Gender migration leaves unknown values null and attendance unchanged, with no inference',()=>{
  const db=seed();db.studentSchemaRevision=1;db.students[0].name='Nama Fiktif';delete db.students[0].gender;db.students[1].gender='Perempuan';
  const before=structuredClone(db.sessions);applyStudentSchema(db);assert.equal(db.students[0].gender,null);assert.equal(db.students[1].gender,'female');assert.deepEqual(db.sessions,before);
  assert.equal(applyStudentSchema(db).changed,false);
});
test('Both creation paths require exactly male/female, and approval retains the selected gender',()=>{
  const db=seed();for(const gender of [null,'','unknown','other','Laki-laki'])assert.throws(()=>saveRegisteredStudent(db,{...student,gender},{admin:true}),/Jenis Kelamin/);
  const visit=selectFridayService(db,'s1','2026-10-16',{confirmed:true}),batch=getSession(db,'g13',visit.id),ctx={schoolId:'s1',groupId:'g13',serviceSessionId:visit.id,sessionId:batch.id,serviceDate:visit.date};
  assert.throws(()=>addTemporaryStudent(db,ctx,{...student,gender:''}),/Jenis Kelamin/);
  const pending=addTemporaryStudent(db,ctx,{...student,gender:'female'}),before=structuredClone(db.sessions);
  const approved=saveRegisteredStudent(db,{...student,gender:pending.gender},{provisionalId:pending.id,admin:true});
  assert.equal(approved.gender,'female');assert.deepEqual(db.sessions,before);
});
function birthdayFixture(){
  const db=seed();db.students=[
    {id:'a',name:'Anak Fiktif A',schoolId:'s1',groupId:'g1',active:true},
    {id:'b',name:'Anak Fiktif B',schoolId:'s2',groupId:'g4',active:true},
    {id:'c',name:'Anak Fiktif C',schoolId:'s1',groupId:'g13',active:true},
    {id:'d',name:'Anak Fiktif D',schoolId:'s1',groupId:'g13',active:true},
    {id:'e',name:'Anak Fiktif E',schoolId:'s1',groupId:'g1',active:false}];
  db.studentPrivateProfiles={a:{dateOfBirth:'2015-10-21'},b:{dateOfBirth:'2016-11-20'},c:{dateOfBirth:'2016-10-03'},d:{dateOfBirth:null},e:{dateOfBirth:'2014-10-22'}};return db;
}
test('Birthday tracker filters active students, sorts day, counts nulls, and includes the 30-day boundary',()=>{
  const db=birthdayFixture(),before=structuredClone(db),summary=birthdayOverview(db,{admin:true,month:10});
  assert.equal(summary.total,4);assert.equal(summary.missing,1);assert.deepEqual(summary.monthly.map(e=>e.student.id),['c','a']);
  assert.deepEqual(summary.upcoming.map(e=>[e.student.id,e.days]),[['a',0],['b',30]]);
  assert.equal(summary.monthly[1].age,11);
  const filtered=birthdayOverview(db,{admin:true,month:10,schoolId:'s1',groupId:'g13'});assert.equal(filtered.monthly.length,1);assert.equal(filtered.missing,1);
  assert.equal(birthdayOverview(db,{admin:true,month:1}).monthly.length,0);assert.deepEqual(db,before);
  assert.throws(()=>birthdayOverview(db,{month:10}),/admin/);
});
test('February 29 uses February 28 in non-leap years, keeps original DOB and handles year rollover',()=>{
  assert.equal(birthdayInYear('2016-02-29',2027),'2027-02-28');assert.equal(birthdayInYear('2016-02-29',2028),'2028-02-29');
  assert.equal(ageOn('2016-02-29','2027-02-27'),10);assert.equal(ageOn('2016-02-29','2027-02-28'),11);
  const db=birthdayFixture();db.studentPrivateProfiles.a.dateOfBirth='2015-01-02';
  assert.ok(birthdayOverview(db,{admin:true,month:12},'2026-12-20').upcoming.some(e=>e.nextBirthday==='2027-01-02'));
});
test('Student export uses actual source IDs, scopes and gender; private columns require explicit admin choice',()=>{
  const db=seed(),saved=saveRegisteredStudent(db,{...student,dateOfBirth:'2016-02-29',guardianName:'Wali Fiktif',address:'Alamat Fiktif'},{admin:true});
  const filtered=studentExportData(db,{admin:true,schoolId:'s1',groupId:'g13'});assert.equal(filtered.count,1);assert.equal(filtered.rows[4][0],saved.id);assert.equal(filtered.rows[4][6],'Laki-laki');
  assert.equal(filtered.rows[3].length,10);assert.ok(!JSON.stringify(filtered.rows).includes('Alamat Fiktif'));
  const privateData=studentExportData(db,{admin:true,schoolId:'s1',groupId:'g13',privateProfiles:true});assert.deepEqual(privateData.rows[4].slice(10),['2016-02-29','Wali Fiktif','Alamat Fiktif']);
  assert.equal(studentExportData(db,{admin:true,scope:'all'}).count,db.students.length);
  assert.throws(()=>studentExportData(db,{privateProfiles:true}),/admin/);
});
test('Attendance export matches per-date statuses/class snapshots and marks pending or incomplete groups',()=>{
  const db=seed(),batch=getSession(db,'g1','demo-pakel-2026-10-23');batch.records[0].status='excused';batch.records[0].schoolClass='3A';
  const current=attendanceExportData(db,{serviceSessionId:batch.serviceSessionId,groupId:'g1'});assert.equal(current.count,12);
  assert.equal(current.rows[4][8],'Izin');assert.equal(current.rows[4][9],'Draf');assert.equal(current.rows[4][15],'3A');assert.equal(current.rows[4][16],batch.id);
  const old=attendanceExportData(db,{serviceSessionId:'demo-pakel-2026-10-09',groupId:'g1'});assert.equal(old.rows[4][8],'Hadir');assert.equal(old.rows[4][9],'Selesai');
  const all=attendanceExportData(db,{},'all');assert.equal(all.rows.length-4,all.count+all.pending);
});
test('Public student export can be re-imported unchanged with legacy blanks and stable IDs',()=>{
  const db=seed(),rows=studentExportData(db,{admin:true,scope:'all'}).rows,before=structuredClone(db);
  const plan=planStudentImport(db,{rows},{admin:true});assert.deepEqual(plan.errors,[]);assert.equal(plan.created,0);assert.equal(plan.updated,0);assert.equal(plan.skipped,96);
  commitStudentImport(db,plan,{admin:true});assert.deepEqual(db,before);
});
test('Import creates validated IDs, preserves Unicode, then upserts without duplicates or attendance changes',()=>{
  const db=seed(),before=structuredClone(db.sessions),rows=[['ID siswa','Nama lengkap','Sekolah','Kelas sekolah','Kelompok ABC','Jenis kelamin','Status siswa','Tanggal lahir'],['source-001','Anak Fiktif Éléna','SDN Pacarkeling V','3B','Hagai','Perempuan','Aktif','29/02/2016'],['source-002','Anak Fiktif Budi','SDN Airlangga III','4','Amos','Laki-laki','Aktif','']];
  const plan=planStudentImport(db,{rows},{admin:true});assert.deepEqual(plan.errors,[]);assert.equal(plan.created,2);assert.ok(!db.students.some(s=>s.id==='source-001'));
  commitStudentImport(db,plan,{admin:true});assert.equal(db.students.find(s=>s.id==='source-001').gender,'female');assert.equal(db.studentPrivateProfiles['source-001'].dateOfBirth,'2016-02-29');
  const again=planStudentImport(db,{rows},{admin:true});assert.equal(again.created,0);assert.equal(again.skipped,2);commitStudentImport(db,again,{admin:true});
  assert.equal(db.students.filter(s=>s.id==='source-001').length,1);assert.deepEqual(db.sessions,before);
});
test('Import errors are atomic, reject wrong groups/duplicate IDs/missing gender, and stale preview cannot commit',()=>{
  const db=seed(),header=['ID siswa','Nama lengkap','ID sekolah','Kelas sekolah','ID kelompok','Jenis kelamin'];
  assert.throws(()=>planStudentImport(db,{rows:[header]},{admin:true}),/Tidak ada/);
  const plan=planStudentImport(db,{rows:[header,['bad-a','Anak Fiktif A','s1','3','g4','Laki-laki'],['bad-b','Anak Fiktif B','s1','3','g13',''],['same','Anak Fiktif C','s1','3','g13','Perempuan'],['same','Anak Fiktif D','s1','3','g13','Perempuan']]},{admin:true});
  assert.equal(plan.errors.length,3);const before=structuredClone(db);assert.throws(()=>commitStudentImport(db,plan,{admin:true}),/Perbaiki/);assert.deepEqual(db,before);
  const valid=planStudentImport(db,{rows:[header,['new-id','Anak Fiktif E','s1','3','g13','Perempuan']]},{admin:true});db.students[0].name='Perubahan Fiktif';assert.throws(()=>commitStudentImport(db,valid,{admin:true}),/berubah/);
});
test('Excel serial dates and 1904 workbooks map to date-only birthdays without inventing missing values',()=>{
  assert.equal(importBirthdate('',false),null);assert.equal(importBirthdate('1',true),'1904-01-02');assert.equal(importBirthdate('61'),'1900-03-01');assert.throws(()=>importBirthdate('60'),/valid/);assert.throws(()=>importBirthdate('31/02/2015'),/Tanggal/);
});

test('Retired demo plans can be explicitly reassigned to an approved mentor without losing the audit',()=>{
  const db=seed();db.mentorConfigRevision=2;db.mentors.push({id:'retired-demo',name:'Kak Raka'});
  db.sessionMentorOverrides.push({id:'retired-temp',groupId:'g1',mentorId:'retired-demo',serviceSessionId:'demo-pakel-2026-10-23'});
  db.defaultMentorAssignments.push({id:'retired-permanent',groupId:'g1',mentorId:'retired-demo',effectiveFrom:'2026-11-01',baseline:false});
  applyMentorConfiguration(db);
  setTemporaryMentor(db,{groupId:'g1',mentorId:'mentor-eva',serviceSessionId:'demo-pakel-2026-10-23'},'retired-temp');
  assert.equal(effectiveMentor(db,'g1','demo-pakel-2026-10-23').mentorId,'mentor-eva');
  setPermanentMentor(db,{groupId:'g1',mentorId:'mentor-chriz',effectiveFrom:'2026-11-01'},'retired-permanent');
  assert.equal(defaultMentorAt(db,'g1','2026-11-01').mentorId,'mentor-chriz');
  assert.ok(db.mentorAssignmentEvents.some(e=>e.type==='retire-demo'&&e.previous.mentorId==='retired-demo'));
});
