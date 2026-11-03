import {randomUUID} from 'node:crypto';
import {coreMembershipId} from '../../backend/msa-core.mjs';
import {fail} from '../../backend/msa-accounts.mjs';
import {jakartaToday} from '../../dates.js';
export async function seedCalendarFixture({root,config},{uid,auth,events,calendar,fictional=false,confirmed=false}){
  if(!fictional||!confirmed||process.env.ABC_MSA_STAGE9B1!=='1'||!root.id.startsWith('test-')||config.projectId!=='demo-abc-attendance')fail(403,'Fixture kalender hanya untuk emulator fiktif.');
  const account=(await root.collection('adminAccounts').doc(uid).get()).data(),actor={uid,revision:account?.revision,check:async()=>!(await auth.getUser(uid)).disabled},startDate=jakartaToday();
  for(const [id,organizationId,name,startTime,timezone,programId] of [
    ['fictional-regular-event','fictional-abc-movement','Pelayanan Reguler Fiktif','09:00','Asia/Jakarta','fictional-goes-to-school'],
    ['fictional-adhoc-event','fictional-yayasan-abc','Pelayanan Ad Hoc Fiktif','10:00','Asia/Makassar',null]
  ]){
    const control=()=>({requestId:randomUUID(),expectedRevision:0,reason:'Penyiapan jadwal fiktif oleh fixture trusted',confirmed:true});
    await events.save(actor,organizationId,id,{...control(),name,startDate,startTime,timezone,programId,venue:'Aula Pelayanan Fiktif',picMembershipId:coreMembershipId(organizationId,uid)});
    await calendar.transition(actor,organizationId,id,'publish',{...control(),expectedRevision:1});
  }
}
