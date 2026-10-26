import {coreMembershipId,coreRoles} from '../../backend/msa-core.mjs';
import {hash,fail} from '../../backend/msa-accounts.mjs';
export const coreOrgA='fictional-abc-movement',coreOrgB='fictional-yayasan-abc';
export async function seedStage8Fixture({db,root,config},{uid,scope,fictional=false,confirmed=false}){
  if(!fictional||!confirmed||process.env.ABC_MSA_STAGE8!=='1'||!root.id.startsWith('test-')||config.projectId!=='demo-abc-attendance')fail(403,'Fixture Stage 8 hanya untuk persetujuan trusted pada emulator fiktif.');
  return db.runTransaction(async tx=>{
    const [account,identity]=(await tx.getAll(root.collection('adminAccounts').doc(uid),root.collection('msaLegacyUsernameLinks').doc(uid))).map(d=>d.data());
    if(account?.uid!==uid||account.state!=='active'||identity?.uid!==uid||identity.state!=='active'||identity.identity?.state!=='verified')fail(403,'Fixture memerlukan UID lama yang terverifikasi.');
    const binding={uid,accountRevision:account.revision,identityRevision:identity.revision},at=Date.now(),records=[];
    records.push(['msaCorePlatformGrants',uid,{...binding,status:'active',permissions:['organizations:manage'],revision:1,reason:'Grant platform eksplisit hanya untuk fixture fiktif.'}]);
    records.push(['msaCoreAudit',hash('fixture-platform:'+uid),{actorUid:uid,organizationId:null,operation:'fixture-platform-granted',reason:'Grant platform diberikan eksplisit oleh setup trusted fiktif.',next:{...binding,status:'active',permissions:['organizations:manage'],revision:1},at}]);
    for(const [id,name] of [[coreOrgA,'ABC Movement'],[coreOrgB,'Yayasan Anak Bintang Cemerlang']]){
      records.push(['msaCoreOrganizations',id,{id,name,status:'active',metadata:{note:'Data fiktif; kepemilikan operasional belum disahkan.'},ownerUid:uid,revision:1,createdAt:at,updatedAt:at}]);
      const memberId=coreMembershipId(id,uid);records.push(['msaCoreMemberships',memberId,{id:memberId,organizationId:id,...binding,role:'owner',permissions:coreRoles.owner,status:'active',revision:1,createdAt:at,updatedAt:at}]);
      records.push(['msaCoreAudit',hash('fixture-owner:'+id),{actorUid:uid,organizationId:id,operation:'fixture-ownership-granted',reason:'Kepemilikan dan membership diberikan eksplisit pada fixture, bukan dari jabatan legacy.',at}]);
    }
    for(const [id,organizationId,name] of [['fictional-goes-to-school',coreOrgA,'ABC Goes to School'],['fictional-pojok-ceria',coreOrgB,'Pojok Ceria'],['fictional-bangkit-indonesia',coreOrgB,'Bangkit Indonesia']])records.push(['msaCorePrograms',id,{id,organizationId,name,description:'Contoh program fiktif yang dapat dikonfigurasi.',status:'active',revision:1,createdAt:at,updatedAt:at}]);
    if(scope)records.push(['msaCoreLegacySources',coreOrgA,{organizationId:coreOrgA,namespace:root.id,scopes:[scope],status:'active',reason:'Izin baca sumber fiktif eksplisit; bukan mapping atau persetujuan migrasi.'}]);
    const refs=records.map(([c,id])=>root.collection(c).doc(id)),existing=await tx.getAll(...refs);if(existing.some(d=>d.exists))fail(409,'Fixture Stage 8 sudah ada; tidak ditimpa.');
    records.forEach(([, ,value],i)=>tx.create(refs[i],value));return {organizations:2,programs:3};
  });
}
