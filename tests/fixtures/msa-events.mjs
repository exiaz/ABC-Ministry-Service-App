import {coreMembershipId} from '../../backend/msa-core.mjs';
import {eventPermissions} from '../../backend/msa-events.mjs';
import {fail} from '../../backend/msa-accounts.mjs';

// Trusted fixture, not an HTTP permission-management operation.
export async function seedEventGrant({db,root,config},{uid,organizationId,permissions=eventPermissions,fictional=false,confirmed=false}){
  if(!fictional||!confirmed||process.env.ABC_MSA_STAGE9A!=='1'||!root.id.startsWith('test-')||config.projectId!=='demo-abc-attendance'||!permissions.length||permissions.some(p=>!eventPermissions.includes(p)))fail(403,'Grant pelayanan hanya untuk fixture emulator fiktif.');
  const id=coreMembershipId(organizationId,uid);return db.runTransaction(async tx=>{
    const m=(await tx.get(root.collection('msaCoreMemberships').doc(id))).data();if(m?.uid!==uid||m.status!=='active'||m.organizationId!==organizationId)fail(403,'Membership eksplisit diperlukan.');
    const next={uid,organizationId,accountRevision:m.accountRevision,identityRevision:m.identityRevision,membershipRevision:m.revision,status:'active',permissions:[...permissions],revision:1};
    tx.create(root.collection('msaEventGrants').doc(id),next);tx.create(root.collection('msaEventAudit').doc('grant-'+id),{organizationId,actorUid:uid,operation:'fixture-event-granted',next,at:Date.now(),reason:'Grant event dan kelayakan PIC diberikan eksplisit oleh fixture trusted.'});
  });
}
