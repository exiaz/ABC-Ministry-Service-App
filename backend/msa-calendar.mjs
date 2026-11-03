import {randomUUID} from 'node:crypto';
import {hash,fail} from './msa-accounts.mjs';
import {coreMutationInput} from './msa-core.mjs';
import {eventDate,eventInput} from './msa-events.mjs';
import {manualCalendarExport} from './msa-calendar-export.mjs';

const id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(v);
const denied=()=>fail(403,'Pelayanan atau izin kalender belum diizinkan.');
const readActions=['events:read','events:calendar:read'];
export function calendarFilter(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['organizationId','programId','from','to','status'].includes(k))||value.organizationId!==undefined&&!id(value.organizationId)||value.programId!==undefined&&value.programId!==''&&!id(value.programId)||value.status!==undefined&&!['all','draft','published','cancelled'].includes(value.status))fail(400,'Filter kalender tidak valid.');
  eventDate(value.from);eventDate(value.to);const days=(Date.parse(value.to)-Date.parse(value.from))/86400000;if(days<0||days>92)fail(400,'Pilih rentang kalender maksimal 93 hari.');return {...value,status:value.status??'published'};
}
export function publicationTransition(status,operation){
  if(status==='draft'&&operation==='publish')return 'published';
  if(status==='published'&&operation==='cancel')return 'cancelled';
  fail(409,'Perubahan status pelayanan tidak diizinkan. Muat ulang detail.');
}
export function createMsaCalendar({db,root,core,events,now=Date.now}){
  const enabled=events.calendarEnabled,{access,eligible,view}=events.authority,{bounded,selectedProgram}=core.authority,col=n=>root.collection(n);
  async function catalogRows(tx,actor,candidates){
    const organizations=[];
    for(const o of candidates){try{const v=await access(tx,actor,o.id,readActions),programs=await bounded(tx,col('msaCorePrograms').where('organizationId','==',o.id));organizations.push({id:o.id,name:v.o.name,permissions:v.g.permissions.filter(p=>p!=='events:pic'),programs:programs.map(p=>({id:p.id,name:p.name,status:p.status}))});}catch(e){if(e.status!==403)throw e;}}
    return organizations;
  }
  const picLabel=r=>'Anggota '+r.picMembershipId.slice(0,8);
  async function candidates(actor){enabled();return (await core.catalog(actor)).organizations;}
  return {
    enabled,
    authority:{candidates,catalogRows},
    async catalog(actor){const source=await candidates(actor);return db.runTransaction(async tx=>{enabled();const organizations=await catalogRows(tx,actor,source);if(!await actor.check())denied();enabled();return {organizations,policy:'provisional-fictional',limit:200,maxDays:93};});},
    async agenda(actor,value){
      enabled();const filter=calendarFilter(value),source=await candidates(actor);return db.runTransaction(async tx=>{
        const organizations=await catalogRows(tx,actor,source);let selected=organizations;if(filter.organizationId){selected=organizations.filter(o=>o.id===filter.organizationId);if(!selected.length)denied();}
        if(filter.programId){const p=(await tx.get(col('msaCorePrograms').doc(filter.programId))).data();if(!p||!selected.some(o=>o.id===p.organizationId))denied();selected=selected.filter(o=>o.id===p.organizationId);}
        const result=[];
        for(const org of selected){
          await access(tx,actor,org.id,readActions);const canDraft=org.permissions.includes('events:read'),visible=canDraft?['draft','published','cancelled']:['published','cancelled'],statuses=filter.status==='all'?visible:visible.filter(s=>s===filter.status);
          if(!statuses.length)continue;
          let query=col('msaServiceEvents').where('organizationId','==',org.id).where('status','in',statuses).where('startDate','>=',filter.from).where('startDate','<=',filter.to);
          if(filter.programId!==undefined)query=query.where('programId','==',filter.programId||null);
          let rows;try{rows=await bounded(tx,query);}catch(e){if(e.status===409)fail(409,'Kalender melebihi 200 pelayanan. Sempitkan rentang tanggal atau pilih satu organisasi.');throw e;}
          for(const row of rows)result.push({...view(row),organizationName:org.name,programName:row.programId===null?null:org.programs.find(p=>p.id===row.programId)?.name??'Program perlu ditinjau',picLabel:picLabel(row)});
          if(result.length>200)fail(409,'Kalender melebihi 200 pelayanan. Sempitkan rentang tanggal atau pilih satu organisasi.');
        }
        for(const org of selected)await access(tx,actor,org.id,readActions);enabled();if(!await actor.check())denied();return {events:result.sort((a,b)=>a.startAt-b.startAt||a.id.localeCompare(b.id)),limit:200,truncated:false,dateBasis:'event-local-date'};
      });
    },
    async detail(actor,org,eventId){
      enabled();if(!id(eventId))fail(400,'ID pelayanan tidak valid.');return db.runTransaction(async tx=>{
        const v=await access(tx,actor,org,readActions),row=(await tx.get(col('msaServiceEvents').doc(eventId))).data();if(!row||row.organizationId!==org||!['draft','published','cancelled'].includes(row.status)||row.status==='draft'&&!v.g.permissions.includes('events:read'))denied();
        const program=row.programId===null?null:(await tx.get(col('msaCorePrograms').doc(row.programId))).data();await access(tx,actor,org,readActions);enabled();
        // Calendar-only readers never receive previous draft versions or actors.
        return {event:{...view(row),organizationName:v.o.name,programName:program?.organizationId===org?program.name:null,picLabel:picLabel(row)},capabilities:{edit:!(row.seriesId&&row.startAt<=now())&&v.g.permissions.includes('events:read')&&v.g.permissions.includes('events:edit')&&row.status!=='cancelled'&&(row.status==='draft'||v.g.permissions.includes('events:publish')),publish:!(row.seriesId&&row.startAt<=now())&&row.status==='draft'&&v.g.permissions.includes('events:publish'),cancel:!(row.seriesId&&row.startAt<=now())&&row.status==='published'&&v.g.permissions.includes('events:cancel')}};
      });
    },
    async exportEvent(actor,org,eventId,value){
      enabled();if(!id(eventId))fail(400,'ID pelayanan tidak valid.');return db.runTransaction(async tx=>{
        await access(tx,actor,org,readActions);const row=(await tx.get(col('msaServiceEvents').doc(eventId))).data();if(!row||row.id!==eventId||row.organizationId!==org)denied();
        const result=manualCalendarExport({namespace:root.id,event:row,value,now:now()});await access(tx,actor,org,readActions);enabled();if(!await actor.check())denied();return result;
      });
    },
    async transition(actor,org,eventId,operation,value){
      enabled();if(!id(eventId)||!['publish','cancel'].includes(operation))fail(400,'Tindakan pelayanan tidak valid.');coreMutationInput(value,[]);const action='events:'+operation;
      return db.runTransaction(async tx=>{
        await access(tx,actor,org,action);const ref=col('msaServiceEvents').doc(eventId),receipt=col('msaEventReceipts').doc(hash(actor.uid+':'+value.requestId)),fingerprint=hash(JSON.stringify([operation,org,eventId,value.expectedRevision,value.reason,value.confirmed])),oldReceipt=(await tx.get(receipt)).data();
        if(oldReceipt){if(oldReceipt.fingerprint!==fingerprint)fail(409,'ID pengajuan telah digunakan.');await access(tx,actor,org,action);enabled();return oldReceipt.result;}
        const old=(await tx.get(ref)).data();if(!old||old.organizationId!==org)denied();if(old.revision!==value.expectedRevision)fail(409,'Pelayanan sudah berubah. Muat ulang detail sebelum melanjutkan.');if(old.seriesId&&old.startAt<=now())fail(409,'Pelayanan dalam seri yang sudah dimulai tidak dapat diubah.');const status=publicationTransition(old.status,operation);
        if(operation==='publish'){
          const fields=eventInput({requestId:value.requestId,expectedRevision:value.expectedRevision,reason:value.reason,confirmed:true,...Object.fromEntries(['name','startDate','startTime','timezone','venue','picMembershipId','programId'].map(k=>[k,old[k]]))});
          if(fields.startAt!==old.startAt||fields.timezone!==old.timezone)fail(409,'Waktu pelayanan perlu diperiksa ulang sebelum diterbitkan.');await selectedProgram(tx,org,old.programId);await eligible(tx,org,old.picMembershipId);
        }
        const at=now(),next={...old,status,revision:old.revision+1,updatedAt:at,updatedBy:actor.uid,...(operation==='publish'?{publishedAt:at,publishedBy:actor.uid}:{cancelledAt:at,cancelledBy:actor.uid,cancellationReason:value.reason.trim()})};
        await access(tx,actor,org,action);if(operation==='publish')await eligible(tx,org,old.picMembershipId);enabled();if(!await actor.check())denied();
        const result={updated:true,id:eventId,revision:next.revision,status};tx.set(ref,next);tx.create(col('msaEventAudit').doc(randomUUID()),{eventId,organizationId:org,actorUid:actor.uid,operation:'event-'+status,previous:old,next,reason:value.reason.trim(),at});tx.create(receipt,{fingerprint,result});return result;
      });
    }
  };
}
