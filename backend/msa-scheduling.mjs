import {hash,fail} from './msa-accounts.mjs';
import {coreMembershipId,coreMutationInput} from './msa-core.mjs';
import {eventDate,eventInput} from './msa-events.mjs';

const fieldKeys=['name','startDate','startTime','timezone','venue','picMembershipId','programId'];
const id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(v);
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const digest=v=>hash(JSON.stringify(stable(v)));
const denied=()=>fail(403,'Izin penjadwalan organisasi belum diizinkan.');
export function recurrencePlan(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>![...fieldKeys,'frequency','weekday','endDate'].includes(k))||!['once','weekly'].includes(value.frequency)||typeof value.timezone!=='string'||!Number.isInteger(value.weekday)||value.weekday<0||value.weekday>6)fail(400,'Pilih jadwal, hari dan zona waktu yang eksplisit.');
  const fields=eventInput({...Object.fromEntries(fieldKeys.map(k=>[k,value[k]])),requestId:'00000000-0000-4000-8000-000000000000',expectedRevision:0,confirmed:true,reason:'Pratinjau jadwal pelayanan'});
  eventDate(value.endDate);const start=Date.parse(fields.startDate),end=Date.parse(value.endDate);
  if(end<start||(end-start)/86400000>89||new Date(start).getUTCDay()!==value.weekday||value.frequency==='once'&&end!==start)fail(400,'Tanggal mulai harus sesuai hari pilihan. Rentang maksimal 90 hari; jadwal sekali memiliki tanggal akhir yang sama.');
  const dates=[];for(let at=start;at<=end;at+=7*86400000){dates.push(new Date(at).toISOString().slice(0,10));if(value.frequency==='once')break;}
  if(dates.length>12)fail(400,'Maksimal 12 pelayanan dalam satu seri. Pendekkan tanggal akhir.');
  return {fields,frequency:value.frequency,weekday:value.weekday,endDate:value.endDate,dates};
}

export function createMsaScheduling({db,root,core,events,calendar,now=Date.now}){
  const col=n=>root.collection(n),{access,eligible,view}=events.authority,{bounded,selectedProgram}=core.authority;
  const enabled=()=>{calendar.enabled();if(process.env.ABC_MSA_STAGE9B2!=='1'||!root.id.startsWith('test-'))fail(503,'Jadwal berulang dan beranda uji tidak aktif.');};
  async function validate(tx,actor,org,plan){
    const a=await access(tx,actor,org,'events:create');await selectedProgram(tx,org,plan.fields.programId);const pic=await eligible(tx,org,plan.fields.picMembershipId),program=plan.fields.programId===null?null:(await tx.get(col('msaCorePrograms').doc(plan.fields.programId))).data();
    return digest([org,plan,a.o.revision,a.m.revision,a.g.revision,a.s,pic.m,(await access(tx,pic.a,org,'events:pic')).g,program]);
  }
  return {
    enabled,
    async preview(actor,org,value){enabled();const plan=recurrencePlan(value);return db.runTransaction(async tx=>{const previewToken=await validate(tx,actor,org,plan);enabled();if(!await actor.check())denied();return {dates:plan.dates,timezone:plan.fields.timezone,status:'draft',previewToken};});},
    async create(actor,org,seriesId,value){
      enabled();if(!id(seriesId))fail(400,'ID seri tidak valid.');coreMutationInput(value,['schedule','previewToken']);if(value.expectedRevision!==0||typeof value.previewToken!=='string'||!/^[a-f0-9]{64}$/.test(value.previewToken))fail(400,'Pratinjau dan revisi seri baru diperlukan.');
      const plan=recurrencePlan(value.schedule),fingerprint=digest(['series-create',org,seriesId,value]);
      return db.runTransaction(async tx=>{
        await access(tx,actor,org,'events:create');const receipt=col('msaEventReceipts').doc(hash(actor.uid+':'+value.requestId)),oldReceipt=(await tx.get(receipt)).data();
        if(oldReceipt){if(oldReceipt.fingerprint!==fingerprint)fail(409,'ID pengajuan telah digunakan.');enabled();if(!await actor.check())denied();return oldReceipt.result;}
        const ref=col('msaRecurrenceSeries').doc(seriesId),old=(await tx.get(ref)).data();if(old){if(old.organizationId!==org)denied();fail(409,'Seri sudah dibuat. Gunakan ID pengajuan semula untuk mencoba kembali.');}
        if(await validate(tx,actor,org,plan)!==value.previewToken)fail(409,'Organisasi, program atau izin PIC berubah. Pratinjau ulang sebelum menyimpan.');
        const at=now(),rows=plan.dates.map((date,index)=>({...plan.fields,startDate:date,startAt:plan.fields.startAt+(Date.parse(date)-Date.parse(plan.fields.startDate)),id:'occ-'+hash(JSON.stringify([org,seriesId,index])),organizationId:org,seriesId,occurrenceIndex:index,status:'draft',revision:1,createdAt:at,createdBy:actor.uid,updatedAt:at,updatedBy:actor.uid}));
        if(rows.some(r=>r.startAt<=at))fail(409,'Jadwal baru harus dimulai setelah waktu sekarang. Pratinjau ulang tanggal pelayanan.');
        const existing=await tx.getAll(...rows.map(r=>col('msaServiceEvents').doc(r.id)));if(existing.some(d=>d.exists))fail(409,'Identitas pelayanan dalam seri sudah digunakan.');
        // All reads and live authority checks precede the first write.
        if(await validate(tx,actor,org,plan)!==value.previewToken)fail(409,'Izin berubah. Pratinjau ulang jadwal.');enabled();if(!await actor.check())denied();
        const series={id:seriesId,organizationId:org,...plan.fields,frequency:plan.frequency,weekday:plan.weekday,endDate:plan.endDate,occurrenceIds:rows.map(r=>r.id),revision:1,createdAt:at,createdBy:actor.uid,source:'stage9b2-preview-confirmed'};
        tx.create(ref,series);
        for(const row of rows){tx.create(col('msaServiceEvents').doc(row.id),row);tx.create(col('msaEventAudit').doc('created-'+row.id),{eventId:row.id,organizationId:org,seriesId,actorUid:actor.uid,operation:'draft-created',source:series.source,reason:value.reason.trim(),previous:null,next:row,at});}
        const result={updated:true,id:seriesId,revision:1,events:rows.map(view)};tx.create(receipt,{fingerprint,result});return result;
      });
    },
    async dashboard(actor){
      enabled();const source=await calendar.authority.candidates(actor);return db.runTransaction(async tx=>{
        const organizations=await calendar.authority.catalogRows(tx,actor,source),at=now(),from=new Date(at-86400000).toISOString().slice(0,10),to=new Date(at+90*86400000+9*3600000).toISOString().slice(0,10),upcoming=[],assigned=[],drafts=[],unique=new Set();
        for(const org of organizations){
          const ownPic=coreMembershipId(org.id,actor.uid),canDraft=org.permissions.includes('events:read'),attention=canDraft&&org.permissions.some(p=>['events:edit','events:publish'].includes(p));
          let published,internal=[];
          try{
            published=await bounded(tx,col('msaServiceEvents').where('organizationId','==',org.id).where('status','==','published').where('startDate','>=',from).where('startDate','<=',to));
            if(canDraft){let query=col('msaServiceEvents').where('organizationId','==',org.id).where('status','==','draft');if(!attention)query=query.where('picMembershipId','==',ownPic);internal=await bounded(tx,query);}
          }catch(e){if(e.status===409)fail(409,'Beranda melebihi 200 pelayanan. Gunakan kalender dengan rentang atau organisasi yang lebih sempit.');throw e;}
          for(const row of [...published,...internal]){
            if(row.status==='published'&&(row.startAt<at||row.startAt>at+90*86400000))continue;
            const e={...view(row),organizationName:org.name,programName:row.programId===null?null:org.programs.find(p=>p.id===row.programId)?.name??'Program perlu ditinjau'};
            unique.add(row.id);if(unique.size>200)fail(409,'Beranda melebihi 200 pelayanan. Gunakan kalender dengan rentang atau organisasi yang lebih sempit.');
            if(row.status==='published')upcoming.push(e);if(row.picMembershipId===ownPic&&(row.status==='published'||row.startAt>=at&&row.startAt<=at+90*86400000))assigned.push(e);if(row.status==='draft'&&attention&&(!row.seriesId||row.startAt>at))drafts.push(e);
          }
        }
        for(const org of organizations)await access(tx,actor,org.id,['events:read','events:calendar:read']);enabled();if(!await actor.check())denied();
        const sort=rows=>rows.sort((a,b)=>a.startAt-b.startAt||a.id.localeCompare(b.id));return {upcoming:sort(upcoming),assigned:sort(assigned),drafts:sort(drafts),organizations:organizations.map(o=>({id:o.id,name:o.name,canCreate:o.permissions.includes('events:read')&&o.permissions.includes('events:create')})),limit:200,truncated:false,horizonDays:90,asOf:at};
      });
    }
  };
}
