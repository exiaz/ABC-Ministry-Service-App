import {validServiceSession} from './access-control.mjs';
import {effectiveMentor} from '../assignments.js';

// Shared output allowlist also protects the async boundary from adapter extras.
export function toRosterResponse(scope,rows){
  if(!Array.isArray(rows))throw Error('Data roster tidak valid.');
  const students=rows.map(s=>{
    const id=s.studentId??s.id;
    if(typeof id!=='string'||typeof s.name!=='string'||(s.schoolClass!=null&&typeof s.schoolClass!=='string'))throw Error('Data roster tidak valid.');
    return {id,name:s.name,schoolClass:s.schoolClass??null};
  });
  return {schoolId:scope.schoolId,groupId:scope.groupId,serviceSessionId:scope.serviceSessionId,students};
}

export function toRosterContext(scope,value){
  const result=Object.fromEntries(['schoolId','groupId','serviceSessionId','schoolName','groupName','serviceDate','mentorName'].map(key=>[key,value?.[key]]));
  if(!['schoolId','groupId','serviceSessionId'].every(key=>result[key]===scope[key])||!['schoolName','groupName','mentorName'].every(key=>typeof result[key]==='string'&&result[key].trim())||!/^\d{4}-\d{2}-\d{2}$/.test(result.serviceDate??'')||Number.isNaN(Date.parse(result.serviceDate+'T12:00:00Z'))||new Date(result.serviceDate+'T12:00:00Z').toISOString().slice(0,10)!==result.serviceDate)throw Error('Metadata roster tidak valid.');
  return result;
}
export function describeRosterScope(db,scope){
  const {schoolId,groupId,serviceSessionId}=scope,school=db.schools.find(s=>s.id===schoolId),group=db.groups.find(g=>g.id===groupId&&g.schoolId===schoolId),visit=db.serviceSessions.find(v=>v.id===serviceSessionId&&v.schoolId===schoolId&&v.groupIds.includes(groupId));
  if(!school||!group||!validServiceSession(visit))return null;
  return toRosterContext(scope,{...scope,schoolName:school.name,groupName:group.name,serviceDate:visit.date,mentorName:effectiveMentor(db,groupId,serviceSessionId).name});
}

// Separate, read-only test repository. Never imports seed() or browser storage.
export function createRosterRepository(source={schools:[],groups:[],serviceSessions:[],sessions:[],students:[]}){
  const db=structuredClone(source);
  return {
    describe(scope){return describeRosterScope(db,scope);},
    read({schoolId,groupId,serviceSessionId}){
      const group=db.groups.find(g=>g.id===groupId&&g.schoolId===schoolId);
      const visit=db.serviceSessions.find(s=>s.id===serviceSessionId&&s.schoolId===schoolId&&s.groupIds.includes(groupId));
      if(!db.schools.some(s=>s.id===schoolId)||!group||!validServiceSession(visit))return null;
      const batch=db.sessions.find(s=>s.schoolId===schoolId&&s.groupId===groupId&&s.serviceSessionId===serviceSessionId);
      // Existing batches retain their roster snapshot. No getSession(): GET must
      // never create batches, modify planned groups, or rewrite attendance.
      const used=new Set(db.sessions.filter(s=>s.serviceSessionId===serviceSessionId).flatMap(s=>s.records.map(r=>r.studentId)));
      const rows=batch?batch.records:db.students.filter(s=>s.schoolId===schoolId&&s.groupId===groupId&&s.active&&!used.has(s.id));
      return toRosterResponse({schoolId,groupId,serviceSessionId},rows);
    }
  };
}
