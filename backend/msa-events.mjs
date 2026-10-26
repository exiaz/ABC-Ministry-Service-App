import {randomUUID} from 'node:crypto';
import {hash,fail} from './msa-accounts.mjs';
import {coreMembershipId,coreMutationInput} from './msa-core.mjs';

// Provisional trusted grants only. Publication is deliberately ungrantable.
export const eventPermissions=Object.freeze(['events:read','events:create','events:edit','events:pic']);
export const eventTimezones=Object.freeze({'Asia/Jakarta':7,'Asia/Makassar':8,'Asia/Jayapura':9});
const id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(v);
const clean=(v,max)=>typeof v==='string'&&v.trim().length>=2&&v.length<=max&&!/[\p{Cc}\p{Cf}\p{Cs}]/u.test(v);
export function eventDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'2000-01-01'||value>'2100-12-31'||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)fail(400,'Tanggal pelayanan tidak valid (2000–2100).');return value;
}
export function eventInput(value){
  coreMutationInput(value,['name','startDate','startTime','timezone','venue','picMembershipId','programId']);
  if(!clean(value.name,120)||!clean(value.venue,180)||typeof value.startTime!=='string'||!/^\d{2}:\d{2}$/.test(value.startTime)||value.startTime>'23:59'||value.startTime.slice(3)>'59'||value.timezone!==undefined&&typeof value.timezone!=='string'||!Object.hasOwn(eventTimezones,value.timezone??'Asia/Jakarta')||typeof value.picMembershipId!=='string'||!/^[a-f0-9]{64}$/.test(value.picMembershipId)||value.programId!==null&&!id(value.programId))fail(400,'Lengkapi nama, waktu, zona waktu, tempat, PIC internal dan pilihan program yang valid.');
  const startDate=eventDate(value.startDate),timezone=value.timezone??'Asia/Jakarta',startAt=Date.parse(startDate+'T'+value.startTime+':00Z')-eventTimezones[timezone]*3600000;
  return {name:value.name.trim(),startDate,startTime:value.startTime,timezone,startAt,venue:value.venue.trim(),picMembershipId:value.picMembershipId,programId:value.programId};
}
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const denied=()=>fail(403,'Izin pelayanan atau PIC organisasi belum diizinkan.');
const view=r=>({id:r.id,organizationId:r.organizationId,name:r.name,startDate:r.startDate,startTime:r.startTime,timezone:r.timezone,startAt:r.startAt,venue:r.venue,picMembershipId:r.picMembershipId,programId:r.programId,status:r.status,revision:r.revision,createdAt:r.createdAt,updatedAt:r.updatedAt});

export function createMsaEvents({db,root,auth,core,now=Date.now}){
  const col=n=>root.collection(n),events=col('msaServiceEvents'),grants=col('msaEventGrants'),{member,bound,bounded,selectedProgram}=core.authority;
  const enabled=()=>{core.enabled();if(process.env.ABC_MSA_STAGE9A!=='1'||!root.id.startsWith('test-'))fail(503,'Draf pelayanan uji tidak aktif.');};
  async function access(tx,actor,org,action){
    enabled();const v=await member(tx,actor,org,'organization:read'),g=(await tx.get(grants.doc(coreMembershipId(org,actor.uid)))).data();
    if(!bound(g,v.s)||g.organizationId!==org||g.membershipRevision!==v.m.revision||!Array.isArray(g.permissions)||!g.permissions.length||new Set(g.permissions).size!==g.permissions.length||g.permissions.some(p=>!eventPermissions.includes(p))||!g.permissions.includes(action))denied();return {...v,g};
  }
  const targetActor=uid=>({uid,check:async()=>{try{return !(await auth.getUser(uid)).disabled;}catch{return false;}}});
  async function eligible(tx,org,membershipId){
    const m=(await tx.get(col('msaCoreMemberships').doc(membershipId))).data();if(m?.id!==membershipId||m.organizationId!==org||coreMembershipId(org,m.uid)!==membershipId)denied();
    // Resolve the actual verified identity and grant, never a name/phone match.
    const a=targetActor(m.uid);a.revision=m.accountRevision;await access(tx,a,org,'events:pic');return {m,a};
  }
  return {
    enabled,
    async catalog(actor){
      enabled();const catalog=await core.catalog(actor);const organizations=[];
      for(const o of catalog.organizations){try{const v=await db.runTransaction(tx=>access(tx,actor,o.id,'events:read'));organizations.push({id:o.id,name:o.name,permissions:v.g.permissions.filter(p=>p!=='events:pic')});}catch(e){if(e.status!==403)throw e;}}
      enabled();if(!await actor.check())denied();return {organizations,policy:'provisional-fictional',publishAvailable:false};
    },
    async options(actor,org){return db.runTransaction(async tx=>{
      await access(tx,actor,org,'events:read');const programs=await bounded(tx,col('msaCorePrograms').where('organizationId','==',org)),members=await bounded(tx,col('msaCoreMemberships').where('organizationId','==',org)),pics=[];
      for(const m of members){try{await eligible(tx,org,m.id);pics.push({id:m.id,label:'Anggota '+m.id.slice(0,8)+(m.uid===actor.uid?' (Anda)':'')});}catch(e){if(e.status!==403)throw e;}}
      await access(tx,actor,org,'events:read');return {programs:programs.filter(p=>p.status==='active').map(p=>({id:p.id,name:p.name})),pics};
    });},
    async list(actor,org,filter={}){
      if(!filter||Object.keys(filter).some(k=>!['programId','from','to'].includes(k)))fail(400,'Filter pelayanan tidak valid.');
      if(filter.from!==undefined)eventDate(filter.from);if(filter.to!==undefined)eventDate(filter.to);if(filter.from&&filter.to&&filter.from>filter.to)fail(400,'Rentang tanggal tidak valid.');
      return db.runTransaction(async tx=>{
        await access(tx,actor,org,'events:read');if(filter.programId!==undefined)await selectedProgram(tx,org,filter.programId===''?null:filter.programId);
        const rows=await bounded(tx,events.where('organizationId','==',org));await access(tx,actor,org,'events:read');
        return {events:rows.filter(r=>(filter.programId===undefined||r.programId===(filter.programId||null))&&(!filter.from||r.startDate>=filter.from)&&(!filter.to||r.startDate<=filter.to)).sort((a,b)=>a.startAt-b.startAt||a.id.localeCompare(b.id)).map(view)};
      });
    },
    async detail(actor,org,eventId){
      if(!id(eventId))fail(400,'ID pelayanan tidak valid.');return db.runTransaction(async tx=>{await access(tx,actor,org,'events:read');const row=(await tx.get(events.doc(eventId))).data();if(!row||row.organizationId!==org)denied();const history=await bounded(tx,col('msaEventAudit').where('eventId','==',eventId));await access(tx,actor,org,'events:read');
        return {event:view(row),history:history.filter(h=>h.organizationId===org).sort((a,b)=>a.next.revision-b.next.revision).map(h=>({revision:h.next.revision,actorReference:hash(h.actorUid).slice(0,16),at:h.at,previous:h.previous?view(h.previous):null,next:view(h.next)}))};});
    },
    async save(actor,org,eventId,value){
      enabled();if(!id(eventId))fail(400,'ID pelayanan tidak valid.');const fields=eventInput(value),action=value.expectedRevision===0?'events:create':'events:edit';
      return db.runTransaction(async tx=>{
        await access(tx,actor,org,action);const receipt=col('msaEventReceipts').doc(hash(actor.uid+':'+value.requestId)),fingerprint=hash(JSON.stringify([org,eventId,stable(value)])),oldReceipt=(await tx.get(receipt)).data();
        if(oldReceipt){if(oldReceipt.fingerprint!==fingerprint)fail(409,'ID pengajuan telah digunakan.');await access(tx,actor,org,action);return oldReceipt.result;}
        const ref=events.doc(eventId),old=(await tx.get(ref)).data();if(old&&old.organizationId!==org)denied();if((old?.revision??0)!==value.expectedRevision)fail(409,'Draf sudah berubah. Muat ulang detail sebelum menyunting lagi.');if(old&&old.status!=='draft')denied();
        await selectedProgram(tx,org,fields.programId);const pic=await eligible(tx,org,fields.picMembershipId);
        const at=now(),next={id:eventId,organizationId:org,...fields,status:'draft',revision:(old?.revision??0)+1,createdAt:old?.createdAt??at,createdBy:old?.createdBy??actor.uid,updatedAt:at,updatedBy:actor.uid};
        await access(tx,actor,org,action);await eligible(tx,org,pic.m.id);enabled();if(!await actor.check())denied();
        const result={updated:true,id:eventId,revision:next.revision};tx.set(ref,next);tx.create(col('msaEventAudit').doc(randomUUID()),{eventId,organizationId:org,actorUid:actor.uid,operation:old?'draft-edited':'draft-created',reason:value.reason.trim(),previous:old??null,next,at});tx.create(receipt,{fingerprint,result});return result;
      });
    }
  };
}
