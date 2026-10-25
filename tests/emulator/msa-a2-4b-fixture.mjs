import {randomUUID} from 'node:crypto';
import {lifecycleFixture} from './msa-a2-4a-fixture.mjs';
export {primary,backup} from './msa-a2-4a-fixture.mjs';
export const evidence={method:'in-person',reference:'Pemilik fiktif diperiksa langsung dengan bukti terpisah',confirmed:true};
export async function recoveryFixture(t){
  const previous=process.env.ABC_MSA_A2_4B;process.env.ABC_MSA_A2_4B='1';const f=await lifecycleFixture(t);
  t.after(()=>{if(previous===undefined)delete process.env.ABC_MSA_A2_4B;else process.env.ABC_MSA_A2_4B=previous;});
  const recovery=f.adminAuthentication.a1.recovery;
  const submit=u=>f.request('/api/a2-4b/request',{username:u.username,requestId:randomUUID()},'');
  const rows=async()=> (await (await f.request('/api/a2-4b/queue')).json()).requests;
  const review=async(r,patch={},token=f.token)=>f.request('/api/a2-4b/requests/'+r.id+'/review',{requestId:randomUUID(),expectedRevision:r.revision,expectedAccountRevision:r.accountRevision,reason:'Tinjauan pemulihan fiktif dengan bukti independen',decision:'approve',confirmed:true,evidence,...patch},token);
  const approved=async u=>{await submit(u);const r=(await rows()).find(r=>r.uid===u.uid);const response=await review(r);if(response.status!==200)throw Error('Persetujuan fixture gagal '+response.status+' '+await response.text());return r;};
  const reset=value=>f.request('/api/a2-4b/reset',value,'');
  return {...f,recovery,submit,rows,recoveryReview:review,approved,reset};
}
