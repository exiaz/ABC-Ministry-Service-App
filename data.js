import {applyStudentSchema,mentorStudent} from './student-data.js';
import {SCHOOL_CONFIG,GROUP_CONFIG,GROUP_CONFIG_REVISION,RETIRED_GROUP_IDS} from './group-config.js';
import {applyServiceConfiguration,annotateRecord,TIME_ZONE} from './scheduling.js';
import {jakartaToday} from './dates.js';
import {INITIAL_DEFAULTS} from './mentor-config.js';
import {applyMentorConfiguration,effectiveMentor,captureMentorAssignment} from './assignments.js';

export const CURRENT = jakartaToday();
const LEGACY_DATES = ['2026-10-21', '2026-10-14', '2026-10-07'];
export const KEY = 'abc-school-prototype-v1';
export const statuses = {unmarked: 'Belum Diabsen', present: 'Hadir', excused: 'Izin', absent: 'Tidak Hadir'};
export function seed() {
  const schools = SCHOOL_CONFIG.map(s=>({...s}));
  const names = ['Alya Putri','Bima Pratama','Citra Lestari','Daffa Saputra','Elena Kirana','Farhan Aditya','Gita Larasati','Hana Amelia','Iqbal Ramadhan','Jihan Maharani','Kevin Wijaya','Luna Permata','Mika Ananta','Nadia Safira','Oscar Mahendra','Putri Anindya','Rafi Nugraha','Salsa Azzahra','Tio Pranata','Vania Melati','Wira Santoso','Yasmin Zahra','Zaki Firmansyah','Amara Dewi','Bagas Surya','Clara Natali','Davin Arya','Elsa Maharani','Fajar Bagaskara','Grace Natalia'];
  const groups = GROUP_CONFIG.map(({id,schoolId,name})=>({id,schoolId,name}));
  // Keep the original fictional students and associations; additional groups start empty.
  const rosterGroups = GROUP_CONFIG.filter(g=>Number.isInteger(g.demoRosterIndex)).sort((a,b)=>a.demoRosterIndex-b.demoRosterIndex);
  const students = rosterGroups.flatMap((g) => {const i=g.demoRosterIndex;return Array.from({length: i%3 === 0 ? 12 : 10}, (_,j) => ({id:`st-${i}-${j}`,groupId:g.id,name:names[(i*7+j)%names.length],active:true}));});
  const sessions = [];
  LEGACY_DATES.forEach((date,di) => rosterGroups.forEach((g,gi) => {
    if (di === 0 && gi === 0) return;
    if (di === 0 && gi > 5) return;
    const complete = di > 0 || gi === 1 || gi === 3;
    const records = students.filter(s => s.groupId === g.id).map((s,i) => ({studentId:s.id,name:s.name,status:complete ? (i===3?'excused':i===7?'absent':'present') : i<4?'present':'unmarked',provisional:false}));
    sessions.push({id:`${date}_${g.id}`,date,groupId:g.id,schoolId:g.schoolId,groupName:g.name,schoolName:schools.find(s=>s.id===g.schoolId).name,mentor:INITIAL_DEFAULTS.find(m=>m.groupId===g.id).name,state:complete?'completed':'draft',records,updatedAt:`${date}T03:30:00Z`});
  }));
  const db={version:1,groupConfigRevision:GROUP_CONFIG_REVISION,authorized:false,schools,groups,students,sessions,provisionals:[]};
  applyServiceConfiguration(db);
  applyMentorConfiguration(db);
  // Fictional examples: a completed past visit and a partially marked visit.
  for(const visitId of ['demo-pakel-2026-10-09','demo-airlangga-2026-10-16']){
    const visit=db.serviceSessions.find(v=>v.id===visitId);
    for(const gid of visit.groupIds){const batch=getSession(db,gid,visit.id);batch.records.forEach((r,i)=>r.status=visit.schoolId==='s1'?(i===3?'excused':i===7?'absent':'present'):(i<3?'present':'unmarked'));batch.state=visit.schoolId==='s1'?'completed':'draft';batch.updatedAt=visit.date+'T03:30:00Z';}
  }
  applyStudentSchema(db);
  return db;
}

// One-time, additive migration. Attendance/student/provisional objects are never touched.
// Refuse collisions instead of merging groups or moving existing relationships.
export function applyGroupConfiguration(db) {
  if(db.groupConfigRevision===GROUP_CONFIG_REVISION)return {changed:false,issues:[]};
  const issues=[];
  for(const target of GROUP_CONFIG){
    const existing=db.groups.find(g=>g.id===target.id);
    if(existing&&existing.schoolId!==target.schoolId)issues.push(`ID ${target.id} terhubung ke sekolah lain.`);
    if(db.groups.some(g=>g.schoolId===target.schoolId&&g.id!==target.id&&g.name.trim().toLowerCase()===target.name.toLowerCase()))issues.push(`Kelompok ${target.name} sudah digunakan oleh ID lain di ${target.schoolId}.`);
  }
  if(issues.length)return {changed:false,issues};
  for(const target of SCHOOL_CONFIG){
    const existing=db.schools.find(s=>s.id===target.id);
    if(existing)existing.name=target.name;else db.schools.push({...target});
  }
  for(const target of GROUP_CONFIG){
    const existing=db.groups.find(g=>g.id===target.id);
    if(existing)existing.name=target.name;
    else db.groups.push({id:target.id,schoolId:target.schoolId,name:target.name});
  }
  for(const id of RETIRED_GROUP_IDS){const group=db.groups.find(g=>g.id===id);if(group)group.retired=true;}
  const order=new Map(GROUP_CONFIG.map((g,i)=>[g.id,i]));
  db.groups.sort((a,b)=>(order.get(a.id)??Infinity)-(order.get(b.id)??Infinity));
  db.groupConfigRevision=GROUP_CONFIG_REVISION;
  return {changed:true,issues:[]};
}

// Use current directory labels on every screen while retaining historical snapshots intact.
export function groupDisplayName(db,item){return db.groups.find(g=>g.id===(item.groupId||item.id))?.name||item.groupName||item.name;}
export function schoolDisplayName(db,item){return db.schools.find(s=>s.id===item.schoolId)?.name||item.schoolName;}
export function getSession(db, groupId, serviceSessionId) {
  const visit=db.serviceSessions?.find(v=>v.id===serviceSessionId);
  const g=db.groups.find(g=>g.id===groupId);
  if(!visit||visit.provisional||!g||visit.schoolId!==g.schoolId||!visit.groupIds.includes(groupId))throw Error('Kelompok dan tanggal pelayanan tidak sesuai. Pilih kembali jadwal.');
  let session = db.sessions.find(s => s.groupId===groupId && s.serviceSessionId===serviceSessionId);
  if (!session) {
    const usedStudents=new Set(db.sessions.filter(s=>s.serviceSessionId===serviceSessionId).flatMap(s=>s.records.map(r=>r.studentId)));
    session={id:`${serviceSessionId}_${groupId}`,serviceSessionId,date:visit.date,groupId,schoolId:g.schoolId,groupName:g.name,schoolName:db.schools.find(s=>s.id===g.schoolId).name,mentor:effectiveMentor(db,groupId,serviceSessionId).name,state:'draft',records:[],updatedAt:null};
    session.records=db.students.filter(s=>s.groupId===groupId&&s.active&&!usedStudents.has(s.id)).map(s=>{const student=mentorStudent(s);return annotateRecord(session,{studentId:student.id,name:student.name,schoolClass:student.schoolClass,gender:student.gender,status:'unmarked',provisional:false});});
    db.sessions.push(session);
    captureMentorAssignment(db,groupId,serviceSessionId);
  }
  return session;
}
export function count(records) { return records.reduce((out,r) => {out[r.status]++; return out;}, {present:0,excused:0,absent:0,unmarked:0}); }
export function dateLabel(date, short=false) { return new Intl.DateTimeFormat('id-ID',{day:'numeric',month:short?'short':'long',year:'numeric',timeZone:TIME_ZONE}).format(new Date(date+'T12:00:00+07:00')); }
export function escape(value) { return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
