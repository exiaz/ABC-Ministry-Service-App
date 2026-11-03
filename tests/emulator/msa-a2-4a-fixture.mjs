import {mentorAccountFixture} from './msa-a2-3-fixture.mjs';
export {primary,backup} from './msa-a2-3-fixture.mjs';
export async function lifecycleFixture(t){
  const previous=process.env.ABC_MSA_A2_4A;process.env.ABC_MSA_A2_4A='1';
  const f=await mentorAccountFixture(t);
  t.after(()=>{if(previous===undefined)delete process.env.ABC_MSA_A2_4A;else process.env.ABC_MSA_A2_4A=previous;});
  return f;
}
