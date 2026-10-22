import {SCHOOL_CONFIG,GROUP_CONFIG} from '../../group-config.js';
import {INITIAL_DEFAULTS} from '../../mentor-config.js';

export const hagai={schoolId:'s1',groupId:'g13',serviceSessionId:'demo-pakel-2026-10-09'};
// Shared fictional schema/IDs for isolated tests and the trusted local demo CLI.
export function deviceManagementSource(){
  const dates={s1:'2026-10-09',s2:'2026-10-16',s3:'2026-10-30'},sessionIds={s1:hagai.serviceSessionId,s2:'demo-airlangga-2026-10-16',s3:'demo-kertajaya-2026-10-30'};
  const source={schools:SCHOOL_CONFIG.map(({id,name})=>({id,name})),groups:GROUP_CONFIG.map(({id,name,schoolId})=>({id,name,schoolId})),mentors:[...new Map(INITIAL_DEFAULTS.map(m=>[m.mentorId,{id:m.mentorId,name:m.name}])).values()],defaultMentorAssignments:INITIAL_DEFAULTS.map(m=>({id:'fictional-default-'+m.groupId,groupId:m.groupId,mentorId:m.mentorId,effectiveFrom:'2026-01-01'})),serviceSessions:SCHOOL_CONFIG.map(s=>({id:sessionIds[s.id],schoolId:s.id,date:dates[s.id],groupIds:GROUP_CONFIG.filter(g=>g.schoolId===s.id).map(g=>g.id)})),sessions:[],students:[{id:'fictional-hagai',schoolId:'s1',groupId:'g13',name:'Siswa Hagai Fiktif',schoolClass:'4A',active:true}],studentPrivateProfiles:{'fictional-hagai':{guardianName:'PRIVAT_DILARANG',address:'PRIVAT_DILARANG'}}};
  const grants=GROUP_CONFIG.map(g=>({schoolId:g.schoolId,groupId:g.id,serviceSessionId:sessionIds[g.schoolId]}));return {source,grants};
}
