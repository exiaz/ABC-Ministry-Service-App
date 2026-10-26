import {calendarFixture,coreOrgA,coreOrgB,coreControl} from './msa-stage9b1-fixture.mjs';
export {coreOrgA,coreOrgB,coreControl};
export async function schedulingFixture(t){
  const prior=process.env.ABC_MSA_STAGE9B2;process.env.ABC_MSA_STAGE9B2='1';const f=await calendarFixture(t);
  t.after(()=>{if(prior===undefined)delete process.env.ABC_MSA_STAGE9B2;else process.env.ABC_MSA_STAGE9B2=prior;});
  const schedule=(patch={},org=coreOrgA)=>{const {requestId,expectedRevision,reason,confirmed,...fields}=f.draft({},org);return {...fields,frequency:'weekly',weekday:2,endDate:'2026-11-24',...patch};};
  const path=(org=coreOrgA)=>'/api/stage9b2/organizations/'+org;
  const preview=(value=schedule(),org=coreOrgA,token=f.token)=>f.request(path(org)+'/preview',value,token);
  const prepare=async(patch={},org=coreOrgA)=>{const value=schedule(patch,org),response=await preview(value,org);if(response.status!==200)throw Error(JSON.stringify(await response.json()));return coreControl({schedule:value,previewToken:(await response.json()).previewToken});};
  const create=(seriesId,value,org=coreOrgA,token=f.token)=>f.request(path(org)+'/series/'+seriesId,value,token);
  return {...f,schedule,path,preview,prepare,create,scheduling:f.adminAuthentication.a1.scheduling};
}
