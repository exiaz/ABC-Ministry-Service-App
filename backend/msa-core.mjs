import {randomUUID} from 'node:crypto';
import {hash,fail} from './msa-accounts.mjs';
import {validRosterScope,SCOPE_KEYS} from './access-control.mjs';

export const coreRoles=Object.freeze({owner:['organization:read','programs:read','programs:write','memberships:read','memberships:manage','legacy:read'],manager:['organization:read','programs:read','programs:write','memberships:read'],viewer:['organization:read','programs:read']});
export const coreMembershipId=(organizationId,uid)=>hash(JSON.stringify([organizationId,uid]));
const id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(v);
const keys=(v,allowed)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>allowed.includes(k));
const text=(v,min,max)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max&&!/[\p{Cc}\p{Cf}\p{Cs}]/u.test(v);
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
const denied=()=>fail(403,'Akun atau izin organisasi belum diizinkan.');
export function coreProgramReference(value){if(value===null)return null;if(!id(value))fail(400,'Program tidak valid.');return value;}
export function coreMutationInput(value,allowed){
  if(!keys(value,['requestId','expectedRevision','reason','confirmed',...allowed])||!/^[-\da-f]{36}$/i.test(value.requestId??'')||!/^\w{8}-\w{4}-4\w{3}-[89ab]\w{3}-\w{12}$/i.test(value.requestId)||!Number.isSafeInteger(value.expectedRevision)||value.expectedRevision<0||!text(value.reason,5,300)||value.confirmed!==true)fail(400,'Isi alasan, konfirmasi dan revisi pengajuan yang valid.');
}
const metadata=value=>{
  if(!keys(value,['note'])||value.note!==undefined&&!text(value.note,0,300))fail(400,'Catatan organisasi tidak valid.');return value.note===undefined?{}:{note:value.note.trim()};
};
const organization=r=>({id:r.id,name:r.name,status:r.status,metadata:r.metadata,revision:r.revision,ownership:'explicit-test-policy'});
const program=r=>({id:r.id,organizationId:r.organizationId,name:r.name,description:r.description,status:r.status,revision:r.revision});

export function createMsaCore({db,root,auth,repository,assertEnabled,now=Date.now}){
  const col=n=>root.collection(n),orgs=col('msaCoreOrganizations'),programs=col('msaCorePrograms'),members=col('msaCoreMemberships');
  const enabled=()=>{assertEnabled();if(process.env.ABC_MSA_STAGE8!=='1'||!root.id.startsWith('test-'))fail(503,'Fondasi MSA uji tidak aktif.');};
  async function subject(tx,uid){
    if(typeof uid!=='string'||!/^[-\w]{1,128}$/.test(uid))denied();
    const [p,a,l]=(await tx.getAll(col('msaAccounts').doc(uid),col('adminAccounts').doc(uid),col('msaLegacyUsernameLinks').doc(uid))).map(d=>d.data());
    if(p&&a)denied();
    if(p){if(p.uid!==uid||p.state!=='active'||p.provisioning!=='ready'||p.identity?.state!=='verified'||p.recoveryLock||!Number.isSafeInteger(p.revision)||p.revision<1||!Number.isSafeInteger(p.identity.revision??p.revision))denied();return {uid,accountRevision:p.revision,identityRevision:p.identity.revision??p.revision};}
    if(a?.uid!==uid||a.state!=='active'||l?.uid!==uid||l.state!=='active'||l.identity?.state!=='verified'||!Number.isSafeInteger(a.revision)||a.revision<1||!Number.isSafeInteger(l.revision)||l.revision<1)denied();return {uid,accountRevision:a.revision,identityRevision:l.revision};
  }
  const bound=(g,s)=>g?.uid===s.uid&&g.status==='active'&&Number.isSafeInteger(g.revision)&&g.revision>0&&g.accountRevision===s.accountRevision&&g.identityRevision===s.identityRevision;
  async function principal(tx,actor){enabled();if(!actor||!await actor.check())denied();const s=await subject(tx,actor.uid);if(actor.revision!==s.accountRevision)denied();return s;}
  async function platform(tx,actor){const s=await principal(tx,actor),g=(await tx.get(col('msaCorePlatformGrants').doc(s.uid))).data();if(!bound(g,s)||!same(g.permissions,['organizations:manage']))denied();return s;}
  async function member(tx,actor,organizationId,action){
    if(!id(organizationId))denied();const s=await principal(tx,actor),[o,m]=(await tx.getAll(orgs.doc(organizationId),members.doc(coreMembershipId(organizationId,s.uid)))).map(d=>d.data());
    if(o?.id!==organizationId||o.status!=='active'||!Number.isSafeInteger(o.revision)||o.revision<1||!/^[-\w]{1,128}$/.test(o.ownerUid??'')||!bound(m,s)||m.organizationId!==organizationId||!coreRoles[m.role]?.includes(action)||!same(m.permissions,coreRoles[m.role])||m.role==='owner'&&o.ownerUid!==s.uid)denied();return {s,o,m};
  }
  async function bounded(tx,query){const rows=await tx.get(query.limit(201));if(rows.size>200)fail(409,'Batas data pilot tercapai. Hubungi operator untuk peninjauan.');return rows.docs.map(d=>d.data());}
  const event=(tx,actor,operation,organizationId,reason,previous,next)=>tx.create(col('msaCoreAudit').doc(randomUUID()),{actorUid:actor.uid,operation,organizationId,reason:reason.trim(),previous,next,at:now()});
  async function mutate(actor,operation,organizationId,value,authorize,fn,targetId=organizationId){
    enabled();return db.runTransaction(async tx=>{
      await authorize(tx);const receipt=col('msaCoreReceipts').doc(hash(actor.uid+':'+value.requestId)),old=(await tx.get(receipt)).data(),fingerprint=hash(JSON.stringify([operation,organizationId,targetId,stable(value)]));
      if(old){if(old.fingerprint!==fingerprint)fail(409,'ID pengajuan telah digunakan.');return old.result;}
      const change=await fn(tx);await authorize(tx);enabled();if(!await actor.check())denied();
      const result={updated:true,id:change.id,revision:change.next.revision};change.write();event(tx,actor,operation,organizationId,value.reason,change.previous??null,change.next);tx.create(receipt,{fingerprint,result});return result;
    });
  }
  const expected=(row,value)=>{if((row?.revision??0)!==value.expectedRevision)fail(409,'Data sudah berubah. Muat ulang sebelum mencoba lagi.');};
  async function selectedProgram(tx,organizationId,programId){
    const selected=coreProgramReference(programId);if(selected===null)return null;
    const p=(await tx.get(programs.doc(selected))).data();if(p?.id!==selected||p.organizationId!==organizationId||p.status!=='active')denied();return p;
  }
  return {
    enabled,
    async catalog(actor){return db.runTransaction(async tx=>{
      const s=await principal(tx,actor),g=(await tx.get(col('msaCorePlatformGrants').doc(s.uid))).data(),isPlatform=bound(g,s)&&same(g.permissions,['organizations:manage']);
      const assignments=await bounded(tx,members.where('uid','==',s.uid)),organizations=[];
      for(const m of assignments){try{const v=await member(tx,actor,m.organizationId,'organization:read');organizations.push({...organization(v.o),role:v.m.role,permissions:v.m.permissions});}catch(e){if(e.status!==403)throw e;}}
      const platformOrganizations=isPlatform?(await bounded(tx,orgs)).map(organization):[];await principal(tx,actor);enabled();
      return {organizations,platformOrganizations,platform:isPlatform,policy:'provisional-fictional',eventsImplemented:false};
    });},
    async saveOrganization(actor,organizationId,value){
      coreMutationInput(value,['name','status','metadata','ownerUid']);if(!id(organizationId)||!text(value.name,2,120)||!['active','inactive'].includes(value.status))fail(400,'Nama atau status organisasi tidak valid.');const info=metadata(value.metadata??{});
      return mutate(actor,'organization-saved',organizationId,value,tx=>platform(tx,actor),async tx=>{
        const ref=orgs.doc(organizationId),old=(await tx.get(ref)).data();expected(old,value);let owner;
        if(!old){owner=await subject(tx,value.ownerUid);const user=await auth.getUser(owner.uid);if(user.disabled)denied();if(value.status!=='active')fail(400,'Organisasi baru dimulai aktif.');const existing=await tx.get(members.doc(coreMembershipId(organizationId,owner.uid)));if(existing.exists)denied();}
        else if(value.ownerUid!==undefined&&value.ownerUid!==old.ownerUid)fail(400,'Pergantian pemilik memerlukan prosedur terpisah.');
        const next={id:organizationId,name:value.name.trim(),status:value.status,metadata:value.metadata===undefined?(old?.metadata??{}):info,ownerUid:old?.ownerUid??owner.uid,revision:(old?.revision??0)+1,createdAt:old?.createdAt??now(),updatedAt:now()};
        return {id:organizationId,previous:old,next,write:()=>{tx.set(ref,next);if(owner){const membership={id:coreMembershipId(organizationId,owner.uid),organizationId,...owner,role:'owner',permissions:coreRoles.owner,status:'active',revision:1,createdAt:now(),updatedAt:now()};tx.create(members.doc(membership.id),membership);event(tx,actor,'ownership-assigned',organizationId,value.reason,null,membership);}}};
      });
    },
    async listPrograms(actor,organizationId){return db.runTransaction(async tx=>{const v=await member(tx,actor,organizationId,'programs:read'),rows=await bounded(tx,programs.where('organizationId','==',organizationId));await member(tx,actor,organizationId,'programs:read');return {organization:organization(v.o),programs:rows.map(program),canWrite:v.m.permissions.includes('programs:write'),programOptional:true};});},
    async validateProgram(actor,organizationId,programId){return db.runTransaction(async tx=>{await member(tx,actor,organizationId,'programs:read');const p=await selectedProgram(tx,organizationId,programId);await member(tx,actor,organizationId,'programs:read');return {organizationId,programId:p?.id??null};});},
    async saveProgram(actor,organizationId,programId,value){
      coreMutationInput(value,['name','description','status']);if(!id(programId)||!text(value.name,2,120)||!text(value.description??'',0,500)||!['active','inactive'].includes(value.status))fail(400,'Nama, deskripsi atau status program tidak valid.');
      return mutate(actor,'program-saved',organizationId,value,tx=>member(tx,actor,organizationId,'programs:write'),async tx=>{
        const ref=programs.doc(programId),old=(await tx.get(ref)).data();if(old&&old.organizationId!==organizationId)denied();expected(old,value);
        const next={id:programId,organizationId,name:value.name.trim(),description:(value.description??old?.description??'').trim(),status:value.status,revision:(old?.revision??0)+1,createdAt:old?.createdAt??now(),updatedAt:now()};return {id:programId,previous:old,next,write:()=>tx.set(ref,next)};
      },programId);
    },
    async listMembers(actor,organizationId){return db.runTransaction(async tx=>{
      await member(tx,actor,organizationId,'memberships:read');const rows=await bounded(tx,members.where('organizationId','==',organizationId)),result=[];
      for(const m of rows){let effective=false;try{effective=!!coreRoles[m.role]&&bound(m,await subject(tx,m.uid))&&same(m.permissions,coreRoles[m.role])&&(m.role!=='owner'||(await tx.get(orgs.doc(organizationId))).data()?.ownerUid===m.uid);if(effective)effective=!(await auth.getUser(m.uid)).disabled;}catch(e){if(e.status!==403)throw e;}result.push({id:m.id,memberReference:hash(m.uid).slice(0,16),role:m.role,status:m.status,revision:m.revision,permissions:m.permissions,effective});}
      await member(tx,actor,organizationId,'memberships:read');return {memberships:result};
    });},
    async saveMember(actor,organizationId,uid,value){
      coreMutationInput(value,['role','status']);if(!['manager','viewer'].includes(value.role)||!['active','revoked'].includes(value.status)||!/^[-\w]{1,128}$/.test(uid??''))fail(400,'Peran atau status anggota tidak valid.');
      return mutate(actor,'membership-saved',organizationId,value,tx=>member(tx,actor,organizationId,'memberships:manage'),async tx=>{
        const o=(await tx.get(orgs.doc(organizationId))).data();if(uid===o.ownerUid||uid===actor.uid)denied();const ref=members.doc(coreMembershipId(organizationId,uid)),old=(await tx.get(ref)).data();expected(old,value);if(old&&(old.uid!==uid||old.organizationId!==organizationId))denied();if(!old&&value.status!=='active')fail(400,'Anggota belum memiliki pemberian izin.');
        let target;if(value.status==='active'){target=await subject(tx,uid);const user=await auth.getUser(uid);if(user.disabled)denied();}else{if(old.role!==value.role)fail(400,'Pencabutan harus mempertahankan peran sebelumnya.');target={uid,accountRevision:old.accountRevision,identityRevision:old.identityRevision};}
        const next={id:ref.id,organizationId,...target,role:value.role,permissions:coreRoles[value.role],status:value.status,revision:(old?.revision??0)+1,createdAt:old?.createdAt??now(),updatedAt:now()};return {id:ref.id,previous:old,next,write:()=>tx.set(ref,next)};
      },uid);
    },
    async legacy(actor,organizationId,value){
      if(!keys(value,SCOPE_KEYS)||Object.keys(value).length!==3||!validRosterScope(value))fail(400,'Referensi absensi lama tidak valid.');
      return db.runTransaction(async tx=>{
        await member(tx,actor,organizationId,'legacy:read');const source=(await tx.get(col('msaCoreLegacySources').doc(organizationId))).data();
        if(source?.namespace!==root.id||source.organizationId!==organizationId||source.status!=='active'||!source.scopes?.some(s=>same(s,value)))denied();
        const context=repository&&await repository.describe(value,{transaction:tx,mentorIdentity:true,defaultIdentity:true});if(!context)denied();
        const ref=hash(JSON.stringify([root.id,...SCOPE_KEYS.map(k=>value[k])])),mapping=(await tx.get(col('msaCoreLegacyMappings').doc(ref))).data();await member(tx,actor,organizationId,'legacy:read');
        // Stage 9 does not exist. Even a trusted proposed mapping is not an
        // event, a migration approval, an attendance grant or a backfill.
        return {readOnly:true,legacy:{namespace:root.id,...value,mentorId:context.mentorId,defaultMentorId:context.defaultMentorId},mapping:{state:mapping?'requires-review':'unmapped',organizationId:null,programId:null,eventId:null},eventsImplemented:false,attendanceAccess:false};
      });
    }
  };
}
