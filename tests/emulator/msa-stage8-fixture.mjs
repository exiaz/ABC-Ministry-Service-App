import {randomUUID} from 'node:crypto';
import {migrationFixture,primary,backup} from './msa-a2-4c-fixture.mjs';
import {seedStage8Fixture,coreOrgA,coreOrgB} from '../fixtures/msa-core.mjs';
export {primary,backup,coreOrgA,coreOrgB};
export const coreControl=(patch={})=>({requestId:randomUUID(),expectedRevision:0,reason:'Perubahan fondasi organisasi fiktif untuk pengujian',confirmed:true,...patch});
export async function coreFixture(t,{seed=true}={}){
  const prior=process.env.ABC_MSA_STAGE8;process.env.ABC_MSA_STAGE8='1';const f=await migrationFixture(t);
  t.after(()=>{if(prior===undefined)delete process.env.ABC_MSA_STAGE8;else process.env.ABC_MSA_STAGE8=prior;});
  await f.adminAuthentication.a1.legacyPilot.claim({header:'Bearer '+f.token,username:'stage8.owner',password:f.password,expectedUid:f.uid,reason:'Binding identitas fiktif, bukan grant Stage 8',confirmed:true});
  if(seed)await seedStage8Fixture(f,{uid:f.uid,scope:primary,fictional:true,confirmed:true});
  const coreBase=org=>'/api/stage8/organizations'+(org?'/'+org:'');
  const grant=(u,org,role='viewer',patch={})=>f.request(coreBase(org)+'/memberships/'+u.uid,coreControl({role,status:'active',...patch}));
  return {...f,core:f.adminAuthentication.a1.core,coreBase,grant};
}
