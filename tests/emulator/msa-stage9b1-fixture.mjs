import {eventFixture,coreOrgA,coreOrgB,coreControl} from './msa-stage9a-fixture.mjs';
import {calendarPermissions,eventPermissions} from '../../backend/msa-events.mjs';
export {coreOrgA,coreOrgB,coreControl};
export async function calendarFixture(t){
  const prior=process.env.ABC_MSA_STAGE9B1;process.env.ABC_MSA_STAGE9B1='1';const f=await eventFixture(t,{seed:false});
  t.after(()=>{if(prior===undefined)delete process.env.ABC_MSA_STAGE9B1;else process.env.ABC_MSA_STAGE9B1=prior;});
  for(const org of [coreOrgA,coreOrgB])await f.eventGrant(f.uid,org,[...eventPermissions,...calendarPermissions]);
  const calendarBase=(org,eventId)=>'/api/stage9b1/organizations/'+org+'/events/'+eventId;
  const save=(eventId,patch={},org=coreOrgA,token=f.token)=>f.request(f.eventBase(org)+'/'+eventId,f.draft(patch,org),token);
  const transition=(eventId,operation='publish',patch={},org=coreOrgA,token=f.token)=>f.request(calendarBase(org,eventId)+'/'+operation,coreControl({expectedRevision:1,reason:'Tindakan status pelayanan fiktif terverifikasi',...patch}),token);
  const agenda=(patch={},token=f.token)=>f.request('/api/stage9b1/calendar?'+new URLSearchParams({from:'2026-11-01',to:'2026-11-30',...patch}),undefined,token);
  return {...f,calendar:f.adminAuthentication.a1.calendar,calendarBase,save,transition,agenda};
}
