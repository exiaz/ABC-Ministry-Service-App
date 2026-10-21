import {defaultMentorAt,effectiveMentor} from './assignments.js';
import {isValidDate,addAttendanceRecord} from './scheduling.js';
import {jakartaToday} from './dates.js';

const uid=()=>globalThis.crypto.randomUUID();
const clean=value=>String(value??'').trim();
const normalized=value=>clean(value).replace(/\s+/g,' ').toLocaleLowerCase('id-ID');
export function normalizeGender(value){const key=normalized(value);return ['male','laki-laki','l'].includes(key)?'male':['female','perempuan','p'].includes(key)?'female':null;}
export const STUDENT_SCHEMA_REVISION=2;
export function studentGroups(db,schoolId,selected=''){
  return db.groups.filter(g=>g.schoolId===schoolId&&(!g.retired||g.id===selected));
}
function schoolGroup(db,schoolId,groupId){
  const school=db.schools.find(s=>s.id===schoolId),group=db.groups.find(g=>g.id===groupId&&g.schoolId===schoolId);
  if(!school||!group)throw Error('Pilih sekolah dan kelompok dari sekolah yang sama.');
  return {school,group};
}
export function initialStudentContext(db,{student=null,schoolId='',groupId=''}={}){
  // Explicit admin context only: never fall back to hidden mentor preferences.
  if(student){groupId=student.groupId;schoolId=db.groups.find(g=>g.id===groupId)?.schoolId||'';}
  if(!schoolId&&groupId)schoolId=db.groups.find(g=>g.id===groupId)?.schoolId||'';
  const school=db.schools.find(s=>s.id===schoolId);
  const group=school&&db.groups.find(g=>g.id===groupId&&g.schoolId===school.id);
  return {schoolId:school?.id||'',groupId:group?.id||''};
}
export function attendanceStudentContext(db,{schoolId,groupId,serviceSessionId,sessionId,serviceDate}){
  const {school,group}=schoolGroup(db,schoolId,groupId);
  const visit=db.serviceSessions.find(v=>v.id===serviceSessionId&&v.schoolId===schoolId&&v.groupIds.includes(groupId));
  const batch=db.sessions.find(s=>s.id===sessionId&&s.schoolId===schoolId&&s.groupId===groupId&&s.serviceSessionId===serviceSessionId&&s.date===visit?.date);
  if(!visit||!batch||(serviceDate&&serviceDate!==visit.date))throw Error('Konteks pelayanan sudah berubah. Buka kembali formulir dari absensi yang aktif.');
  return {school,group,visit,batch,defaultMentor:defaultMentorAt(db,groupId,visit.date),mentor:effectiveMentor(db,groupId,visit.id)};
}
export function mentorStudent(student){
  // Deliberate allowlist: private profile fields never enter attendance payloads.
  return {id:student.id,name:student.name,schoolClass:student.schoolClass??null,gender:student.gender??null,schoolId:student.schoolId,groupId:student.groupId,studentStatus:student.studentStatus,active:student.active};
}
export function applyStudentSchema(db){
  if(db.studentSchemaRevision===STUDENT_SCHEMA_REVISION)return {changed:false,issues:[]};
  const issues=[];
  for(const student of db.students)if(!db.groups.some(g=>g.id===student.groupId))issues.push(`Kelompok siswa ${student.id} tidak ditemukan.`);
  if(issues.length)return {changed:false,issues};
  db.studentPrivateProfiles ||= {};
  for(const student of db.students){
    student.schoolId=db.groups.find(g=>g.id===student.groupId).schoolId;
    student.schoolClass=clean(student.schoolClass)||null;
    student.gender=normalizeGender(student.gender);
    student.studentStatus=student.active?'active':'inactive';
    const profile=db.studentPrivateProfiles[student.id]||{};
    for(const key of ['dateOfBirth','guardianName','address']){
      profile[key]=clean(profile[key]??student[key])||null;
      delete student[key];
    }
    db.studentPrivateProfiles[student.id]=profile;
  }
  for(const p of db.provisionals){
    const batch=db.sessions.find(s=>s.id===p.sessionId);
    p.schoolId ||= batch?.schoolId||db.groups.find(g=>g.id===p.groupId)?.schoolId||null;
    p.serviceSessionId ||= batch?.serviceSessionId||null;
    p.serviceDate ||= batch?.date||null;
    p.schoolClass=clean(p.schoolClass)||null;
    p.gender=normalizeGender(p.gender);
    p.studentStatus=p.state;
  }
  db.studentSchemaRevision=STUDENT_SCHEMA_REVISION;
  return {changed:true,issues:[]};
}
function requiredStudent(values){
  const name=clean(values.name),schoolClass=clean(values.schoolClass);
  if(!name||name.length>70||!schoolClass||schoolClass.length>20)throw Error('Isi Nama Lengkap (maks. 70 karakter) dan Kelas Sekolah (maks. 20 karakter).');
  if(!Object.hasOwn(GENDERS,values.gender))throw Error('Pilih Jenis Kelamin: Laki-laki atau Perempuan.');
  return {name,schoolClass,gender:values.gender};
}
export function addTemporaryStudent(db,context,values){
  const {batch,visit,defaultMentor}=attendanceStudentContext(db,context);
  if(batch.state==='completed')throw Error('Buka koreksi absensi sebelum menambah siswa.');
  const {name,schoolClass,gender}=requiredStudent(values);
  if(db.sessions.some(s=>s.serviceSessionId===visit.id&&s.records.some(r=>normalized(r.name)===normalized(name))))throw Error('Nama sudah ada pada pelayanan ini. Periksa daftar siswa sebelum menambahkannya.');
  const p={id:uid(),name,schoolClass,gender,schoolId:batch.schoolId,groupId:batch.groupId,sessionId:batch.id,serviceSessionId:visit.id,serviceDate:visit.date,defaultMentorId:defaultMentor.mentorId,state:'pending',studentStatus:'pending'};
  addAttendanceRecord(db,batch,{studentId:p.id,name,schoolClass,gender,status:'unmarked',provisional:true});
  db.provisionals.push(p);batch.updatedAt=new Date().toISOString();return p;
}
export function saveRegisteredStudent(db,values,{id=null,provisionalId=null,newId=null,admin=false}={}){
  if(!admin)throw Error('Hanya admin yang dapat mengubah profil siswa.');
  const existing=id?db.students.find(s=>s.id===id):null;
  if(id&&!existing)throw Error('Siswa tidak ditemukan.');
  const pending=provisionalId?db.provisionals.find(p=>p.id===provisionalId&&p.state==='pending'):null;
  if(provisionalId&&!pending)throw Error('Pengajuan sudah ditinjau atau tidak ditemukan.');
  const {name,schoolClass,gender}=requiredStudent(values),{school,group}=schoolGroup(db,values.schoolId,values.groupId);
  if(group.retired&&existing?.groupId!==group.id&&pending?.groupId!==group.id)throw Error('Pilih kelompok aktif.');
  if(!(existing&&existing.schoolId===school.id&&normalized(existing.name)===normalized(name))&&db.students.some(s=>s.id!==existing?.id&&s.schoolId===school.id&&normalized(s.name)===normalized(name)))throw Error('Nama sudah terdaftar di sekolah ini, termasuk siswa nonaktif. Periksa dan lengkapi profil yang ada; jangan membuat duplikat.');
  const dateOfBirth=clean(values.dateOfBirth)||null,guardianName=clean(values.guardianName)||null,address=clean(values.address)||null;
  if(dateOfBirth&&(!isValidDate(dateOfBirth)||dateOfBirth>jakartaToday()))throw Error('Tanggal lahir harus valid dan tidak boleh di masa depan.');
  if((guardianName?.length||0)>100||(address?.length||0)>300)throw Error('Nama wali maksimal 100 karakter dan alamat maksimal 300 karakter.');
  if(newId&&['__proto__','constructor','prototype'].includes(newId))throw Error('ID siswa tidak valid.');
  if(newId&&(db.students.some(s=>s.id===newId)||db.provisionals.some(p=>p.id===newId)))throw Error('ID siswa sudah digunakan.');
  const student=existing||{id:pending?.id||newId||uid(),active:true};
  Object.assign(student,{name,schoolClass,gender,schoolId:school.id,groupId:group.id,studentStatus:student.active?'active':'inactive'});
  if(!existing)db.students.push(student);
  db.studentPrivateProfiles ||= {};
  db.studentPrivateProfiles[student.id]={dateOfBirth,guardianName,address};
  if(pending){pending.state='approved';pending.studentStatus='approved';pending.approvedStudentId=student.id;}
  // Attendance snapshots (including the temporary student ID) are never rewritten.
  return student;
}

export const GENDERS={male:'Laki-laki',female:'Perempuan'};
