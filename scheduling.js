import {SCHOOL_CONFIG} from './group-config.js';
import {SAMPLE_SERVICES,SERVICE_CONFIG_REVISION} from './service-config.js';
import {syncFutureMentorSnapshots} from './assignments.js';

import {TIME_ZONE,jakartaToday} from './dates.js';
export {TIME_ZONE} from './dates.js';
export function isValidDate(date){return typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date+'T12:00:00+07:00'))&&new Date(date+'T12:00:00+07:00').toISOString().slice(0,10)===date;}
export function isFriday(date){return isValidDate(date)&&new Intl.DateTimeFormat('en-US',{weekday:'long',timeZone:TIME_ZONE}).format(new Date(date+'T12:00:00+07:00'))==='Friday';}
export function longDate(date){return new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:TIME_ZONE}).format(new Date(date+'T12:00:00+07:00'));}
export function monthLabel(month){return new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric',timeZone:TIME_ZONE}).format(new Date(month+'-01T12:00:00+07:00'));}
export function availableGroups(db,serviceId){const visit=db.serviceSessions?.find(s=>s.id===serviceId);return visit?visit.groupIds.map(id=>db.groups.find(g=>g.id===id&&g.schoolId===visit.schoolId)).filter(Boolean):[];}
export function serviceProgress(db,visit){
  const rows=db.sessions.filter(s=>s.serviceSessionId===visit.id&&visit.groupIds.includes(s.groupId));
  const completed=rows.filter(s=>s.state==='completed').length;
  return {total:visit.groupIds.length,completed,state:completed===visit.groupIds.length&&completed>0?'completed':rows.length?'draft':'pending'};
}
export function serviceTiming(visit,today=jakartaToday()){return visit.date>today?'upcoming':visit.date===today?'active':'past';}
export function scheduledForSchool(db,schoolId){return (db.serviceSessions||[]).filter(v=>v.schoolId===schoolId&&!v.legacy&&isFriday(v.date)).sort((a,b)=>a.date.localeCompare(b.date));}
export function annotateRecord(session,record){Object.assign(record,{schoolId:session.schoolId,serviceSessionId:session.serviceSessionId,serviceDate:session.date,groupId:session.groupId});return record;}
export function addAttendanceRecord(db,session,record){
  if(db.sessions.some(s=>s.serviceSessionId===session.serviceSessionId&&s.records.some(r=>r.studentId===record.studentId)))throw Error('Siswa ini sudah tercatat pada tanggal pelayanan yang sama.');
  session.records.push(annotateRecord(session,record));return record;
}
export function applyServiceConfiguration(db){
  // School renames are independent of group configuration and never change school IDs.
  let renamed=false;
  for(const target of SCHOOL_CONFIG){const school=db.schools.find(s=>s.id===target.id);if(school){if(school.name!==target.name||school.monthlyVisits!==target.monthlyVisits)renamed=true;school.name=target.name;school.monthlyVisits=target.monthlyVisits;}}
  if(db.serviceConfigRevision===SERVICE_CONFIG_REVISION)return {changed:renamed,issues:[]};
  const keys=new Set(),issues=[];
  for(const batch of db.sessions)for(const record of batch.records){const key=`${batch.serviceSessionId||batch.schoolId+'_'+batch.date}_${record.studentId}`;if(keys.has(key))issues.push(`Siswa ${record.studentId} memiliki catatan ganda pada ${batch.date}.`);keys.add(key);}
  if(issues.length)return {changed:renamed,issues};
  db.serviceSessions ||= [];
  for(const batch of db.sessions){
    if(!batch.serviceSessionId){
      let visit=db.serviceSessions.find(v=>v.legacy&&v.schoolId===batch.schoolId&&v.date===batch.date);
      if(!visit){visit={id:`legacy-${batch.schoolId}-${batch.date}`,schoolId:batch.schoolId,date:batch.date,groupIds:[],legacy:true,fictional:true};db.serviceSessions.push(visit);}
      batch.serviceSessionId=visit.id;if(!visit.groupIds.includes(batch.groupId))visit.groupIds.push(batch.groupId);
    }
    batch.records.forEach(r=>annotateRecord(batch,r));
  }
  for(const sample of SAMPLE_SERVICES){
    if(!db.serviceSessions.some(v=>v.schoolId===sample.schoolId&&v.date===sample.date))db.serviceSessions.push({...sample,groupIds:[...sample.groupIds],fictional:true,legacy:false});
  }
  db.serviceConfigRevision=SERVICE_CONFIG_REVISION;
  return {changed:true,issues:[]};
}

export function saveService(db,values,id){
  const original=id?db.serviceSessions.find(s=>s.id===id):null;
  if(id&&!original)throw Error('Jadwal tidak ditemukan.');
  if(original?.legacy)throw Error('Arsip lama dipertahankan pada tanggal aslinya.');
  if(!db.schools.some(s=>s.id===values.schoolId))throw Error('Pilih sekolah yang tersedia.');
  if(!isFriday(values.date))throw Error('Pilih tanggal pelayanan pada hari Jumat.');
  if(db.serviceSessions.some(s=>s.id!==id&&s.schoolId===values.schoolId&&s.date===values.date))throw Error('Sekolah ini sudah memiliki jadwal pada Jumat tersebut.');
  const groupIds=[...new Set(values.groupIds)];
  if(!groupIds.length||groupIds.some(gid=>!db.groups.some(g=>g.id===gid&&g.schoolId===values.schoolId)))throw Error('Pilih minimal satu kelompok dari sekolah yang sama.');
  const batches=db.sessions.filter(s=>s.serviceSessionId===id);
  if(batches.length&&original.schoolId!==values.schoolId)throw Error('Sekolah tidak dapat diganti setelah absensi dimulai.');
  if(batches.some(s=>!groupIds.includes(s.groupId)))throw Error('Kelompok yang sudah memiliki absensi harus tetap disertakan.');
  const replacements=(db.sessionMentorOverrides||[]).filter(a=>a.serviceSessionId===id);
  if(replacements.length&&original.schoolId!==values.schoolId)throw Error('Sekolah tidak dapat diganti saat ada pengganti mentor untuk pelayanan ini.');
  if(replacements.some(a=>!groupIds.includes(a.groupId)))throw Error('Kelompok yang memiliki pengganti mentor harus tetap disertakan pada pelayanan ini.');
  const visit=original||{id:globalThis.crypto.randomUUID(),fictional:true,legacy:false};
  if(original&&original.date!==values.date){visit.dateHistory ||= [];visit.dateHistory.push({from:original.date,to:values.date,changedAt:new Date().toISOString()});}
  Object.assign(visit,{schoolId:values.schoolId,date:values.date,groupIds});
  if(!original)db.serviceSessions.push(visit);
  for(const batch of batches){batch.date=visit.date;batch.records.forEach(r=>annotateRecord(batch,r));}
  if(db.mentorConfigRevision)for(const groupId of visit.groupIds)syncFutureMentorSnapshots(db,groupId);
  return visit;
}

export function reportEntries(db,{schoolId='',month='',serviceSessionId='',groupId=''}={}){
  return (db.serviceSessions||[]).filter(v=>(!schoolId||v.schoolId===schoolId)&&(!month||v.date.startsWith(month))&&(!serviceSessionId||v.id===serviceSessionId))
    .sort((a,b)=>b.date.localeCompare(a.date)||a.schoolId.localeCompare(b.schoolId))
    .flatMap(visit=>availableGroups(db,visit.id).filter(g=>!groupId||g.id===groupId).map(group=>({visit,group,batch:db.sessions.find(s=>s.serviceSessionId===visit.id&&s.groupId===group.id)})));
}

// The mentor UI calls this only after explicit confirmation for a new Friday.
export function selectFridayService(db,schoolId,date,{confirmed=false}={}){
  if(!isFriday(date))throw Error('Pilih tanggal pelayanan pada hari Jumat.');
  const existing=db.serviceSessions.find(v=>v.schoolId===schoolId&&v.date===date);
  if(existing)return existing;
  if(!confirmed)throw Error('Konfirmasi diperlukan untuk pelayanan yang belum dijadwalkan.');
  const visit=saveService(db,{schoolId,date,groupIds:db.groups.filter(g=>g.schoolId===schoolId&&!g.retired).map(g=>g.id)});
  visit.provisional=true;return visit;
}
export function canSubmitAttendance(db,session,today=jakartaToday()){
  const visit=db.serviceSessions.find(v=>v.id===session.serviceSessionId);
  return !!visit&&visit.schoolId===session.schoolId&&visit.groupIds.includes(session.groupId)&&visit.date<=today;
}
export function submitAttendance(db,session,today=jakartaToday()){
  if(!canSubmitAttendance(db,session,today))throw Error('Absensi dapat dikirim mulai tanggal pelayanan (WIB).');
  if(session.state==='completed'||!session.records.length)return false;
  session.records.forEach(r=>{if(r.status==='unmarked')r.status='absent';});
  session.state='completed';session.updatedAt=new Date().toISOString();return true;
}

export function mentorGroups(db,serviceId){
  const visit=db.serviceSessions.find(v=>v.id===serviceId);
  return visit?db.groups.filter(g=>g.schoolId===visit.schoolId&&!g.retired):[];
}
