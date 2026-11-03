import {coreFixture,coreControl,coreOrgA,coreOrgB} from './msa-stage8-fixture.mjs';
import {seedEventGrant} from '../fixtures/msa-events.mjs';
import {coreMembershipId} from '../../backend/msa-core.mjs';
export {coreOrgA,coreOrgB,coreControl};
export async function eventFixture(t,{seed=true}={}){
  const prior=process.env.ABC_MSA_STAGE9A;process.env.ABC_MSA_STAGE9A='1';const f=await coreFixture(t);
  t.after(()=>{if(prior===undefined)delete process.env.ABC_MSA_STAGE9A;else process.env.ABC_MSA_STAGE9A=prior;});
  const eventGrant=(uid,organizationId,permissions)=>seedEventGrant(f,{uid,organizationId,permissions,fictional:true,confirmed:true});
  if(seed)for(const org of [coreOrgA,coreOrgB])await eventGrant(f.uid,org);
  const eventBase=org=>'/api/stage9a/organizations'+(org?'/'+org+'/events':'');
  const draft=(patch={},org=coreOrgA)=>coreControl({name:'Pelayanan Reguler Fiktif',startDate:'2026-11-03',startTime:'09:30',timezone:'Asia/Jakarta',venue:'Ruang Pelayanan Fiktif',picMembershipId:coreMembershipId(org,f.uid),programId:null,...patch});
  return {...f,eventGrant,eventBase,draft,events:f.adminAuthentication.a1.events};
}
