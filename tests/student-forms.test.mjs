import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {seed,getSession} from '../data.js';
import {applyStudentSchema,initialStudentContext,studentGroups,attendanceStudentContext,addTemporaryStudent,saveRegisteredStudent,mentorStudent} from '../student-data.js';
import {saveService} from '../scheduling.js';
mock.timers.enable({apis:['Date'],now:new Date('2026-10-21T05:00:00Z')});
const values={gender:'male',name:'Siswa Fiktif Form',schoolClass:'4A',schoolId:'s1',groupId:'g13'};
function context(db,groupId='g13',schoolId='s1',date='2026-10-16'){
  const visit=saveService(db,{schoolId,date,groupIds:db.groups.filter(g=>g.schoolId===schoolId&&!g.retired).map(g=>g.id)}),batch=getSession(db,groupId,visit.id);
  return {schoolId,groupId,serviceSessionId:visit.id,sessionId:batch.id,serviceDate:date};
}

test('Mentor inherits school, group, service and fixed mentor; only name/class/gender are accepted',()=>{
  const db=seed(),ctx=context(db),before=db.students.length,resolved=attendanceStudentContext(db,ctx);
  assert.equal(resolved.school.name,'SDN Pacarkeling V');assert.equal(resolved.group.name,'Hagai');assert.equal(resolved.defaultMentor.name,'Kak Louis');
  const p=addTemporaryStudent(db,ctx,{...values,schoolId:'s2',groupId:'g4',dateOfBirth:'2015-01-01',guardianName:'Wali Fiktif',address:'Alamat Fiktif'});
  assert.equal(p.schoolId,'s1');assert.equal(p.groupId,'g13');assert.equal(p.serviceSessionId,ctx.serviceSessionId);assert.equal(p.serviceDate,'2026-10-16');assert.equal(p.defaultMentorId,'mentor-louis');
  assert.equal(p.schoolClass,'4A');assert.equal(p.state,'pending');assert.equal(db.students.length,before);
  for(const key of ['dateOfBirth','guardianName','address'])assert.ok(!Object.hasOwn(p,key));
});
test('Stale and incompatible mentor context cannot add students or change attendance',()=>{
  const db=seed(),ctx=context(db),before=structuredClone(db);
  for(const invalid of [{...ctx,schoolId:'s2'},{...ctx,groupId:'g4'},{...ctx,serviceSessionId:'demo-pakel-2026-10-23'},{...ctx,serviceDate:'2026-10-09'}])assert.throws(()=>addTemporaryStudent(db,invalid,values));
  assert.deepEqual(db,before);
});
test('Name and class required; duplicates in the same service are rejected',()=>{
  const db=seed(),ctx=context(db);
  assert.throws(()=>addTemporaryStudent(db,ctx,{name:'Siswa',schoolClass:''}),/Kelas/);
  assert.throws(()=>addTemporaryStudent(db,ctx,{name:'',schoolClass:'3'}),/Nama/);
  addTemporaryStudent(db,ctx,values);
  assert.throws(()=>addTemporaryStudent(db,ctx,{...values,name:' siswa  fiktif form '}),/sudah ada/);
});
test('Global admin context stays empty, explicit context is prefilled, incompatible group is cleared',()=>{
  const db=seed();db.mentorPreferences={schoolId:'s1',groupId:'g13'};
  assert.deepEqual(initialStudentContext(db),{schoolId:'',groupId:''});
  assert.deepEqual(initialStudentContext(db,{schoolId:'s1',groupId:'g13'}),{schoolId:'s1',groupId:'g13'});
  assert.deepEqual(initialStudentContext(db,{groupId:'g13'}),{schoolId:'s1',groupId:'g13'});
  assert.deepEqual(initialStudentContext(db,{schoolId:'s2',groupId:'g13'}),{schoolId:'s2',groupId:''});
  assert.equal(studentGroups(db,'s1').length,8);assert.equal(studentGroups(db,'s2').length,4);assert.equal(studentGroups(db,'s3').length,4);
  assert.ok(studentGroups(db,'s2').every(g=>g.schoolId==='s2'));
});
test('Admin profiles accept null optionals and can be completed or cleared later without changing history',()=>{
  const db=seed(),history=structuredClone(db.sessions),groups=structuredClone(db.groups),assignments=structuredClone(db.defaultMentorAssignments);
  const student=saveRegisteredStudent(db,values,{admin:true});
  assert.deepEqual(db.studentPrivateProfiles[student.id],{dateOfBirth:null,guardianName:null,address:null});
  saveRegisteredStudent(db,{...values,schoolClass:'5',dateOfBirth:'2015-02-03',guardianName:'Wali Fiktif',address:'Jl. Contoh Fiktif 1'},{id:student.id,admin:true});
  assert.equal(db.studentPrivateProfiles[student.id].guardianName,'Wali Fiktif');
  assert.equal(db.students.find(s=>s.id===student.id).schoolClass,'5');
  saveRegisteredStudent(db,{...values,schoolId:'s2',groupId:'g4',dateOfBirth:'',guardianName:' ',address:''},{id:student.id,admin:true});
  assert.equal(student.id,db.students.at(-1).id);assert.equal(student.schoolId,'s2');assert.equal(student.groupId,'g4');
  assert.deepEqual(db.studentPrivateProfiles[student.id],{dateOfBirth:null,guardianName:null,address:null});
  assert.deepEqual(db.sessions,history);assert.deepEqual(db.groups,groups);assert.deepEqual(db.defaultMentorAssignments,assignments);
});
test('Admin required context, role, class and date validations reject without partial changes',()=>{
  const db=seed(),before=structuredClone(db);
  assert.throws(()=>saveRegisteredStudent(db,values),/admin/);
  for(const invalid of [{...values,schoolId:''},{...values,schoolId:'s2'},{...values,schoolClass:''},{...values,dateOfBirth:'2026-02-30'},{...values,dateOfBirth:'2027-01-01'}])assert.throws(()=>saveRegisteredStudent(db,invalid,{admin:true}));
  assert.deepEqual(db,before);
});
test('Approval preserves attendance records, provisional identity and source context while registering for future rosters',()=>{
  const db=seed(),ctx=context(db),p=addTemporaryStudent(db,ctx,values);
  const batch=db.sessions.find(s=>s.id===ctx.sessionId);batch.records.at(-1).status='present';batch.state='completed';
  const attendance=structuredClone(db.sessions),origin=structuredClone(p);
  const student=saveRegisteredStudent(db,{...values,dateOfBirth:'2016-06-20'},{provisionalId:p.id,admin:true});
  assert.equal(student.id,p.id);assert.equal(p.state,'approved');assert.equal(student.studentStatus,'active');
  assert.equal(p.schoolId,origin.schoolId);assert.equal(p.sessionId,origin.sessionId);assert.equal(p.approvedStudentId,p.id);
  assert.deepEqual(db.sessions,attendance);
  const next=context(db,'g13','s1','2026-10-23');assert.ok(db.sessions.find(s=>s.id===next.sessionId).records.some(r=>r.studentId===p.id&&!r.provisional));
  assert.throws(()=>saveRegisteredStudent(db,values,{provisionalId:p.id,admin:true}),/ditinjau/);
});
test('Approval checks registered students across school groups and inactive students before creating a permanent duplicate',()=>{
  const db=seed(),ctx=context(db),name=db.students[0].name,p=addTemporaryStudent(db,ctx,{...values,name});
  db.students[0].active=false;const before=structuredClone(db);
  assert.throws(()=>saveRegisteredStudent(db,{...values,name},{provisionalId:p.id,admin:true}),/sudah terdaftar/);
  assert.deepEqual(db,before);
});
test('Schema migration adds null unknowns without inventing class, changing IDs, attendance or assignments, and is idempotent',()=>{
  const db=seed();delete db.studentSchemaRevision;delete db.studentPrivateProfiles;
  for(const s of db.students)for(const key of ['schoolId','schoolClass','studentStatus'])delete s[key];
  const history=structuredClone(db.sessions),ids=db.students.map(s=>s.id),assignments=structuredClone(db.defaultMentorAssignments);
  assert.equal(applyStudentSchema(db).changed,true);
  assert.equal(db.students[0].schoolClass,null);assert.equal(db.students[0].schoolId,'s1');assert.equal(db.students[0].studentStatus,'active');
  assert.deepEqual(db.students.map(s=>s.id),ids);assert.deepEqual(db.sessions,history);assert.deepEqual(db.defaultMentorAssignments,assignments);
  const after=structuredClone(db);assert.equal(applyStudentSchema(db).changed,false);assert.deepEqual(db,after);
});
test('Mentor payloads and new attendance snapshots exclude all optional private profile fields',()=>{
  const db=seed(),student=saveRegisteredStudent(db,{...values,dateOfBirth:'2015-01-01',guardianName:'Wali Fiktif Rahasia',address:'Alamat Fiktif Rahasia'},{admin:true});
  const publicStudent=mentorStudent({...student,...db.studentPrivateProfiles[student.id]});
  for(const key of ['dateOfBirth','guardianName','address'])assert.ok(!Object.hasOwn(publicStudent,key));
  const ctx=context(db),batch=db.sessions.find(s=>s.id===ctx.sessionId);
  const output=JSON.stringify(batch);assert.ok(!output.includes('Wali Fiktif Rahasia'));assert.ok(!output.includes('Alamat Fiktif Rahasia'));assert.ok(!output.includes('2015-01-01'));
});
