import {recoveryFixture} from './msa-a2-4b-fixture.mjs';
export {primary,backup} from './msa-a2-4b-fixture.mjs';
export async function migrationFixture(t){
  const prior=process.env.ABC_MSA_A2_4C;process.env.ABC_MSA_A2_4C='1';const f=await recoveryFixture(t);
  t.after(()=>{if(prior===undefined)delete process.env.ABC_MSA_A2_4C;else process.env.ABC_MSA_A2_4C=prior;});return f;
}
