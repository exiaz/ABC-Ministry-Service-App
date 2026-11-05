import {createHmac,randomBytes} from 'node:crypto';
import {buildWorkbook} from '../xlsx.js';
import {readWorkbook} from '../xlsx-reader.js';
import {parseWorkbookXml} from './workbook-xml.mjs';
import {hash,fail} from './msa-accounts.mjs';
import {validRosterScope,SCOPE_KEYS} from './access-control.mjs';

export const workbookType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const workbookLimit=20*1024*1024;
export function sendWorkbook(send,file,filename){
  send(200,file,{'Content-Type':workbookType,'Content-Disposition':'attachment; filename="'+filename+'"'});
}
const columns=['ID siswa','Nama siswa','Kelas sekolah'];
const adminColumns=[...columns,'Jenis kelamin'];
const genderValues=new Map([['male','male'],['laki-laki','male'],['l','male'],['female','female'],['perempuan','female'],['p','female']]);
const safeCell=value=>{
  const text=String(value??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'');
  return /^\s*[=+\-@]/u.test(text)?"'"+text:text;
};
const studentId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value)&&!/^__.*__$/.test(value);
const text=(value,max)=>typeof value==='string'&&value.length<=max&&!/[\p{Cc}\p{Cf}\p{Cs}\uFFFE\uFFFF]/u.test(value);
const scopeInput=value=>{
  if(!validRosterScope(value)||Object.keys(value).length!==SCOPE_KEYS.length)fail(400,'Cakupan roster tidak valid.');
  return Object.fromEntries(SCOPE_KEYS.map(key=>[key,value[key]]));
};
export async function xlsxFile(rows,{attendance=false,admin=false}={}){
  const labels=attendance?[...columns,'Status absensi','ID sekolah','ID kelompok','ID pelayanan','Tanggal pelayanan']:admin?adminColumns:columns;
  const workbook=buildWorkbook([labels,...rows.map(row=>row.map(safeCell))],{sheetName:attendance?'Absensi':'Siswa'});
  return Buffer.from(await workbook.arrayBuffer());
}
async function importRows(bytes){
  let parsed;
  try{parsed=await readWorkbook(new Blob([bytes]),{parseXml:parseWorkbookXml,cellTypes:true});}
  catch{fail(400,'Berkas XLSX tidak valid atau berisi formula.');}
  const [header,...rows]=parsed.rows;
  if(header?.length!==adminColumns.length||adminColumns.some((label,i)=>header[i]?.value!==label)||!rows.length||rows.length>5000)fail(400,'Gunakan header ID siswa, Nama siswa, Kelas sekolah, Jenis kelamin dan isi 1–5000 siswa.');
  const ids=new Set();
  return rows.map(([id,name,schoolClass,genderCell,...extra],i)=>{
    const value=id?.value,fullName=name?.value?.trim(),className=schoolClass?.value?.trim()??'';
    const suppliedGender=genderCell?.value.trim().toLowerCase()??'',gender=genderValues.get(suppliedGender)??null;
    if((suppliedGender&&!gender)||extra.length||!studentId(value)||!['s','inlineStr'].includes(id.type)||ids.has(value)||!text(fullName,120)||!fullName||!text(className,64))fail(400,`Data siswa tidak valid pada baris ${i+2}. Gunakan ID unik dalam format teks.`);
    ids.add(value);
    return {id:value,name:fullName,schoolClass:className||null,gender};
  });
}

export function createMsaXlsx({db,root,repository,accounts,enabled,now}){
  const col=name=>root.collection(name);
  const secret=randomBytes(32);
  const sign=fingerprint=>createHmac('sha256',secret).update(fingerprint).digest('hex');
  const authorize=(tx,actor)=>{enabled();return accounts.authorizeManager(tx,actor);};
  const roster=async(tx,scope)=>{
    if(!await repository.describe(scope,{transaction:tx}))fail(403,'Cakupan roster tidak tersedia.');
    return (await tx.get(col('students').where('schoolId','==',scope.schoolId).where('groupId','==',scope.groupId))).docs;
  };
  const snapshot=docs=>hash(JSON.stringify(docs.map(d=>[d.id,d.updateTime.seconds,d.updateTime.nanoseconds]).sort()));
  const loadPlan=async(tx,scope,rows)=>{
    const docs=await roster(tx,scope);
    const existing=await tx.getAll(...rows.map(row=>col('students').doc(row.id)));
    if(existing.some(d=>{
      const data=d.data();
      return d.exists&&(data.id!==d.id||data.schoolId!==scope.schoolId||data.groupId!==scope.groupId);
    }))fail(409,'Satu atau beberapa ID siswa tidak dapat digunakan dalam cakupan ini.');
    const changes=rows.map((row,i)=>{
      const current=existing[i].data();
      if(current&&current.name===row.name&&(current.schoolClass??null)===row.schoolClass&&(current.gender??null)===row.gender)return null;
      if(!row.schoolClass||!row.gender)fail(400,'Kelas sekolah dan jenis kelamin wajib diisi pada baris '+(i+2)+'.');
      return {ref:existing[i].ref,row,create:!current};
    }).filter(Boolean);
    const created=changes.filter(change=>change.create).length;
    if(created&&docs.filter(d=>d.data().active===true).length+created>300)fail(409,'Kelompok akan melebihi batas 300 siswa aktif pada absensi.');
    return {docs,changes,created};
  };
  const fileRows=docs=>docs.filter(d=>d.data().active===true).map(d=>{
    const row=d.data();
    return [d.id,row.name,row.schoolClass??'',row.gender??''];
  });
  return {
    enabled,
    authorizeUpload:actor=>db.runTransaction(tx=>authorize(tx,actor)),
    async exportStudents(actor,value){
      const scope=scopeInput(value.scope);
      if(Object.keys(value).some(key=>!['scope','expectedRevision'].includes(key)))fail(400,'Parameter ekspor tidak valid.');
      return db.runTransaction(async tx=>{
        await authorize(tx,actor);
        const docs=await roster(tx,scope),revision=snapshot(docs);
        if(value.expectedRevision===undefined)return {revision};
        if(value.expectedRevision!==revision)fail(409,'Roster telah berubah. Muat revisi terbaru.');
        const file=await xlsxFile(fileRows(docs),{admin:true});
        await authorize(tx,actor);
        tx.create(col('msaXlsxAudit').doc(),{operation:'export-students',actorUid:actor.uid,scope,revision,at:now()});
        return file;
      });
    },
    async preview(actor,requestedScope,bytes){
      const scope=scopeInput(requestedScope);
      const rows=await importRows(bytes);
      return db.runTransaction(async tx=>{
        await authorize(tx,actor);
        const {docs,changes,created}=await loadPlan(tx,scope,rows);
        const revision=snapshot(docs),previewId=sign(hash(JSON.stringify([actor.kind,actor.uid,actor.revision,scope,revision,rows])));
        return {previewId,revision,created,updated:changes.length-created,unchanged:rows.length-changes.length,rows};
      });
    },
    async confirm(actor,requestedScope,bytes,{expectedRevision,previewId,idempotencyKey}){
      const scope=scopeInput(requestedScope);
      if(![expectedRevision,previewId].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v))||typeof idempotencyKey!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey))fail(400,'Revisi, ID pratinjau dan kunci idempotensi wajib diisi.');
      const rows=await importRows(bytes);
      const fingerprint=hash(JSON.stringify([actor.kind,actor.uid,actor.revision,scope,expectedRevision,rows]));
      return db.runTransaction(async tx=>{
        await authorize(tx,actor);
        const ref=col('msaXlsxReceipts').doc(hash(JSON.stringify([actor.kind,actor.uid,idempotencyKey])));
        const prior=(await tx.get(ref)).data();
        if(prior){
          if(prior.fingerprint!==fingerprint||prior.previewId!==previewId)fail(409,'Kunci idempotensi sudah digunakan.');
          return prior.result;
        }
        if(previewId!==sign(fingerprint))fail(409,'Berkas atau cakupan berbeda dari pratinjau.');
        const {docs,changes,created}=await loadPlan(tx,scope,rows);
        if(snapshot(docs)!==expectedRevision)fail(409,'Roster telah berubah. Buat pratinjau baru.');
        await authorize(tx,actor);
        for(const {ref,row,create} of changes){
          const {id,name,schoolClass,gender}=row;
          if(create)tx.create(ref,{id,name,schoolClass,gender,schoolId:scope.schoolId,groupId:scope.groupId,active:true});
          else tx.update(ref,{name,schoolClass,gender});
        }
        const result={created,updated:changes.length-created,unchanged:rows.length-changes.length};
        tx.create(col('msaXlsxAudit').doc(),{operation:'import-students',actorUid:actor.uid,scope,expectedRevision,...result,at:now()});
        tx.create(ref,{fingerprint,previewId,result});
        return result;
      });
    }
  };
}
