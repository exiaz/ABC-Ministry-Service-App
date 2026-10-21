import {INITIAL_DEFAULTS,MENTOR_CONFIG_REVISION,APPROVED_MENTOR_IDS} from './mentor-config.js';
import {jakartaToday} from './dates.js';

const stamp=()=>new Date().toISOString();
const uid=()=>globalThis.crypto.randomUUID();
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T12:00:00+07:00'))&&new Date(value+'T12:00:00+07:00').toISOString().slice(0,10)===value;
export function mentorName(db,id){return db.mentors?.find(m=>m.id===id)?.name||'Mentor belum ditugaskan';}
export function defaultMentorAt(db,groupId,date=jakartaToday()){
  const assignment=(db.defaultMentorAssignments||[]).filter(a=>a.groupId===groupId&&a.effectiveFrom<=date&&(!a.disabledFrom||date<a.disabledFrom)).sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  return {mentorId:assignment?.mentorId,name:mentorName(db,assignment?.mentorId),source:'default',assignmentId:assignment?.id,effectiveFrom:assignment?.effectiveFrom};
}
export function effectiveMentor(db,groupId,serviceSessionId){
  const visit=db.serviceSessions?.find(v=>v.id===serviceSessionId);
  if(!visit)return defaultMentorAt(db,groupId);
  if(visit.legacy||visit.date<jakartaToday()){
    const snapshot=(db.mentorAssignmentSnapshots||[]).filter(s=>s.groupId===groupId&&s.serviceSessionId===serviceSessionId&&s.serviceDate===visit.date).at(-1);
    if(snapshot)return {...snapshot,name:snapshot.mentorName||mentorName(db,snapshot.mentorId),historical:true};
  }
  const override=db.sessionMentorOverrides?.find(o=>o.groupId===groupId&&o.serviceSessionId===serviceSessionId);
  if(override&&(!override.disabledFrom||visit.date<override.disabledFrom))return {mentorId:override.mentorId,name:mentorName(db,override.mentorId),source:'temporary',assignmentId:override.id};
  return defaultMentorAt(db,groupId,visit.date);
}
export function captureMentorAssignment(db,groupId,serviceSessionId,info=effectiveMentor(db,groupId,serviceSessionId)){
  const visit=db.serviceSessions.find(v=>v.id===serviceSessionId);
  if(!visit||!info.mentorId)return;
  db.mentorAssignmentSnapshots ||= [];
  const prior=db.mentorAssignmentSnapshots.filter(s=>s.groupId===groupId&&s.serviceSessionId===serviceSessionId&&s.serviceDate===visit.date).at(-1);
  if(prior&&prior.mentorId===info.mentorId&&prior.source===info.source&&prior.assignmentId===info.assignmentId)return;
  db.mentorAssignmentSnapshots.push({id:uid(),groupId,serviceSessionId,serviceDate:visit.date,mentorId:info.mentorId,mentorName:info.name,source:info.source,assignmentId:info.assignmentId||null,capturedAt:stamp()});
}
export function syncFutureMentorSnapshots(db,groupId){
  for(const visit of db.serviceSessions||[])if(!visit.legacy&&visit.date>=jakartaToday()&&visit.groupIds.includes(groupId))captureMentorAssignment(db,groupId,visit.id);
}
function checkPeople(db,groupId,mentorId){
  if(!db.groups.some(g=>g.id===groupId))throw Error('Kelompok tidak ditemukan.');
  if(!selectableMentors(db).some(m=>m.id===mentorId))throw Error('Pilih mentor yang tersedia.');
}
function logChange(db,type,previous,next){db.mentorAssignmentEvents ||= [];db.mentorAssignmentEvents.push({id:uid(),type,previous:previous?structuredClone(previous):null,next:structuredClone(next),changedAt:stamp()});}
export function setTemporaryMentor(db,{groupId,serviceSessionId,mentorId},existingId=null){
  checkPeople(db,groupId,mentorId);
  const visit=db.serviceSessions.find(v=>v.id===serviceSessionId);
  const group=db.groups.find(g=>g.id===groupId);
  if(!visit||visit.schoolId!==group.schoolId||!visit.groupIds.includes(groupId))throw Error('Pilih pelayanan yang menyertakan kelompok ini.');
  if(visit.legacy||visit.date<jakartaToday())throw Error('Penugasan pada pelayanan lampau dikunci agar riwayat tetap utuh.');
  const existing=db.sessionMentorOverrides.find(a=>a.groupId===groupId&&a.serviceSessionId===serviceSessionId);
  if(existing&&existing.id!==existingId)throw Error('Sudah ada pengganti pada pelayanan ini. Muat ulang form untuk memperbaruinya.');
  if(existingId&&(!existing||existing.id!==existingId))throw Error('Penugasan telah berubah. Muat ulang form.');
  const previous=existing?structuredClone(existing):null;
  const next={...(existing||{id:uid()}),groupId,serviceSessionId,mentorId,updatedAt:stamp()};
  delete next.disabledFrom;
  if(existing){Object.assign(existing,next);delete existing.disabledFrom;}else db.sessionMentorOverrides.push(next);
  logChange(db,'temporary',previous,next);syncFutureMentorSnapshots(db,groupId);
  return next;
}
export function setPermanentMentor(db,{groupId,mentorId,effectiveFrom},existingId=null){
  checkPeople(db,groupId,mentorId);
  if(!validDate(effectiveFrom))throw Error('Pilih tanggal efektif yang valid.');
  if(effectiveFrom<jakartaToday())throw Error('Tanggal efektif tidak boleh mendahului hari ini (WIB); penugasan lampau tetap dipertahankan.');
  const sameDate=db.defaultMentorAssignments.find(a=>a.groupId===groupId&&a.effectiveFrom===effectiveFrom&&!a.disabledFrom);
  const existing=existingId?db.defaultMentorAssignments.find(a=>a.id===existingId&&a.groupId===groupId&&!a.baseline):null;
  if(existingId&&!existing)throw Error('Rencana penugasan tidak ditemukan.');
  if(existing&&existing.effectiveFrom<jakartaToday())throw Error('Riwayat penugasan lampau tidak dapat diubah.');
  if(sameDate&&sameDate.id!==existingId)throw Error('Sudah ada penugasan tetap mulai tanggal ini. Muat ulang form untuk memperbaruinya.');
  const previous=existing?structuredClone(existing):null;
  const next={...(existing||{id:uid()}),groupId,mentorId,effectiveFrom,baseline:false,updatedAt:stamp()};
  delete next.disabledFrom;
  if(existing){Object.assign(existing,next);delete existing.disabledFrom;}else db.defaultMentorAssignments.push(next);
  logChange(db,'permanent',previous,next);syncFutureMentorSnapshots(db,groupId);
  return next;
}
export function addInitialDefault(db,groupId,mentorId){
  checkPeople(db,groupId,mentorId);
  if(db.defaultMentorAssignments.some(a=>a.groupId===groupId))throw Error('Kelompok sudah memiliki mentor tetap.');
  const assignment={id:uid(),groupId,mentorId,effectiveFrom:jakartaToday(),baseline:false,updatedAt:stamp()};
  db.defaultMentorAssignments.push(assignment);logChange(db,'initial',null,assignment);return assignment;
}
export function applyMentorConfiguration(db){
  if(db.mentorConfigRevision===MENTOR_CONFIG_REVISION)return {changed:false,issues:[]};
  const issues=[],defaults=new Set(),overrides=new Set();
  for(const a of (db.defaultMentorAssignments||[]).filter(a=>!a.disabledFrom)){const key=a.groupId+'_'+a.effectiveFrom;if(defaults.has(key))issues.push('Penugasan tetap ganda perlu ditinjau.');defaults.add(key);}
  for(const a of db.sessionMentorOverrides||[]){const key=a.groupId+'_'+a.serviceSessionId;if(overrides.has(key))issues.push('Pengganti sesi ganda perlu ditinjau.');overrides.add(key);}
  if(issues.length)return {changed:false,issues};
  db.mentors ||= [];db.defaultMentorAssignments ||= [];db.sessionMentorOverrides ||= [];db.mentorAssignmentSnapshots ||= [];db.mentorAssignmentEvents ||= [];
  function ensureMentor(name,preferredId){let person=db.mentors.find(m=>m.name.toLowerCase()===name.toLowerCase());if(!person){person={id:preferredId||uid(),name,fictional:true};db.mentors.push(person);}return person.id;}
  const canonical=name=>{const bare=name.replace(/^Kak\s+/i,'').trim();const key=bare.toLowerCase();return 'Kak '+(key==='lous'||key==='louis'?'Louis':key==='chris'||key==='chriz'?'Chriz':bare);};
  for(const person of db.mentors)person.name=canonical(person.name);
  for(const target of INITIAL_DEFAULTS){
    const aliases=db.mentors.filter(m=>m.name===target.name&&m.id!==target.mentorId);
    for(const alias of aliases){
      for(const rows of [db.defaultMentorAssignments,db.sessionMentorOverrides,db.mentorAssignmentSnapshots])for(const row of rows)if(row.mentorId===alias.id)row.mentorId=target.mentorId;
      for(const event of db.mentorAssignmentEvents)for(const row of [event.previous,event.next])if(row?.mentorId===alias.id)row.mentorId=target.mentorId;
      db.mentors=db.mentors.filter(m=>m.id!==alias.id);
    }
  }
  for(const row of db.mentorAssignmentSnapshots)if(row.mentorName)row.mentorName=canonical(row.mentorName);
  for(const row of [...db.sessions,...db.groups])if(row.mentor)row.mentor=canonical(row.mentor);
  INITIAL_DEFAULTS.forEach(m=>ensureMentor(m.name,m.mentorId));
  // Freeze historical assignments before replacing obsolete sample baselines.
  for(const visit of db.serviceSessions||[])if(visit.legacy||visit.date<jakartaToday()){
    for(const groupId of visit.groupIds){
      if(!db.mentorAssignmentSnapshots.some(s=>s.groupId===groupId&&s.serviceSessionId===visit.id&&s.serviceDate===visit.date)){
        const batch=db.sessions.find(s=>s.groupId===groupId&&s.serviceSessionId===visit.id);
        const old=effectiveMentor(db,groupId,visit.id);
        if(batch?.mentor){old.name=canonical(batch.mentor);old.mentorId=ensureMentor(old.name);old.source='legacy-snapshot';}
        captureMentorAssignment(db,groupId,visit.id,old);
      }
    }
  }
  if(db.mentorConfigRevision===1){
    for(const target of INITIAL_DEFAULTS){
      const baseline=db.defaultMentorAssignments.find(a=>a.groupId===target.groupId&&a.baseline);
      if(baseline&&baseline.mentorId!==target.mentorId){
        const previous=structuredClone(baseline);baseline.mentorId=target.mentorId;
        logChange(db,'configuration',previous,baseline);
      }
    }
  }
  for(const group of db.groups){
    if(db.defaultMentorAssignments.some(a=>a.groupId===group.id))continue;
    const name=INITIAL_DEFAULTS.find(m=>m.groupId===group.id)?.name||group.mentor?.trim()||`Kak Pendamping ${group.name}`;
    const mentorId=ensureMentor(name);
    db.defaultMentorAssignments.push({id:'baseline-'+group.id,groupId:group.id,mentorId,effectiveFrom:'0001-01-01',baseline:true});
  }
  for(const batch of db.sessions){
    if(db.mentorAssignmentSnapshots.some(s=>s.groupId===batch.groupId&&s.serviceSessionId===batch.serviceSessionId))continue;
    const info=defaultMentorAt(db,batch.groupId,batch.date);
    const name=batch.mentor?.trim()||info.name;
    captureMentorAssignment(db,batch.groupId,batch.serviceSessionId,{mentorId:ensureMentor(name),name,source:'legacy-snapshot',assignmentId:null});
  }
  for(const person of db.mentors)person.selectable=APPROVED_MENTOR_IDS.has(person.id);
  // Preserve past snapshots and the original assignments; retire unauthorized demo plans from today.
  const today=jakartaToday();
  for(const rows of [db.defaultMentorAssignments,db.sessionMentorOverrides])for(const assignment of rows){
    if(!APPROVED_MENTOR_IDS.has(assignment.mentorId)&&!assignment.disabledFrom){
      const previous=structuredClone(assignment);assignment.disabledFrom=today;
      logChange(db,'retire-demo',previous,assignment);
    }
  }
  for(const target of INITIAL_DEFAULTS){
    const current=defaultMentorAt(db,target.groupId,today);
    if(!APPROVED_MENTOR_IDS.has(current.mentorId)){
      const next={id:'config-3-'+target.groupId,groupId:target.groupId,mentorId:target.mentorId,effectiveFrom:today,baseline:false,configuration:true};
      db.defaultMentorAssignments.push(next);logChange(db,'configuration',null,next);
    }
    syncFutureMentorSnapshots(db,target.groupId);
  }
  db.mentorConfigRevision=MENTOR_CONFIG_REVISION;
  return {changed:true,issues:[]};
}

export const selectableMentors=db=>(db.mentors||[]).filter(m=>APPROVED_MENTOR_IDS.has(m.id));
