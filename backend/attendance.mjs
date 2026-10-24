import {createHash} from 'node:crypto';
import {canReadRoster,validRosterScope,validServiceSession,SCOPE_KEYS} from './access-control.mjs';
import {toRosterResponse} from './roster.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
const statuses=new Set(['present','excused','absent','unmarked']);
export class AttendanceError extends Error{
  constructor(status,message){super(message);this.status=status;}
}
const deny=()=>{throw new AttendanceError(403,'Cakupan absensi tidak diizinkan.');};
const conflict=message=>{throw new AttendanceError(409,message);};
const invalid=()=>{throw new AttendanceError(400,'Parameter absensi tidak valid.');};

export function attendanceCommand(action,body){
  const keys=['expectedRevision','idempotencyKey',...(action==='finalize'?['confirm']:action==='correct'?['records','reason']:['records'])];
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!keys.includes(k))||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||typeof body.idempotencyKey!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(body.idempotencyKey))invalid();
  const result={expectedRevision:body.expectedRevision,idempotencyKey:body.idempotencyKey};
  if(action==='finalize'){
    if(body.confirm!==true)invalid();
    return {...result,confirm:true};
  }
  if(!Array.isArray(body.records)||!body.records.length||body.records.length>300||body.records.some(r=>!r||Object.keys(r).length!==2||!id(r.studentId)||!statuses.has(r.status))||new Set(body.records.map(r=>r.studentId)).size!==body.records.length)invalid();
  result.records=body.records.map(r=>({studentId:r.studentId,status:r.status})).sort((a,b)=>a.studentId.localeCompare(b.studentId));
  if(action==='correct'){
    if(typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>500)invalid();
    result.reason=body.reason.trim();
  }
  return result;
}

// Explicit allowlist: historical source batches may contain legacy private extras.
function response(scope,batch,records){
  return {...scope,batchId:batch?.id??null,revision:batch?.revision??0,state:batch?.state??'not-started',updatedAt:batch?.updatedAt??null,finalizedAt:batch?.finalizedAt??null,
    records:records.map(r=>({studentId:r.studentId,status:r.status,updatedAt:r.updatedAt??null}))};
}

/** Emulator-only authorized AttendanceRepository. No in-memory/cloud fallback. */
export function createEmulatorAttendance({db,root,credentials,now}){
  const col=name=>root.collection(name);
  return {
    async executeAuthorized({authorization,proof,scope:requested,action,body}){
      const scope=validRosterScope(requested)?Object.fromEntries(SCOPE_KEYS.map(k=>[k,requested[k]])):null;
      // Capture all caller data before awaiting storage.
      const input=body===undefined?undefined:structuredClone(body);
      return db.runTransaction(async tx=>{
        let backupOperator;
        const authorize=async()=>{
          const principal=await credentials.authenticate(authorization,proof,tx);
          // Attendance requires the existing verified paired-device capability,
          // including when a trusted legacy credential exists in the emulator.
          if(!principal||!proof?.deviceId)throw new AttendanceError(401,'Kredensial perangkat tidak valid atau tidak berlaku.');
          if(!scope)invalid();
          if(!canReadRoster(principal,scope))deny();
          backupOperator=principal.backupGrants?.find(g=>SCOPE_KEYS.every(k=>g[k]===scope[k]));
        };
        await authorize();
        if(!['read','save','finalize','correct'].includes(action))invalid();
        const command=action==='read'?null:attendanceCommand(action,input);
        const {schoolId,groupId,serviceSessionId}=scope;
        const [school,group,visit]=(await tx.getAll(col('schools').doc(schoolId),col('groups').doc(groupId),col('serviceSessions').doc(serviceSessionId))).map(d=>d.data());
        if(school?.id!==schoolId||group?.id!==groupId||group.schoolId!==schoolId||!validServiceSession(visit)||visit?.id!==serviceSessionId||visit.schoolId!==schoolId||!Array.isArray(visit.groupIds)||!visit.groupIds.includes(groupId))deny();
        const lock=col('attendanceSessionLocks').doc(serviceSessionId),guard=(await tx.get(lock)).data();
        const batches=(await tx.get(col('sessions').where('serviceSessionId','==',serviceSessionId))).docs;
        const matching=batches.filter(d=>d.data().groupId===groupId);
        if(matching.length>1||matching.some(d=>d.data().schoolId!==schoolId))conflict('Batch absensi tidak unik atau tidak sesuai.');
        const stored=matching[0],batch=stored?.data();
        if(batch&&(!id(batch.id)||batch.id!==stored.id||!['draft','completed'].includes(batch.state)||!Array.isArray(batch.records)||batch.revision!==undefined&&(!Number.isSafeInteger(batch.revision)||batch.revision<0)))conflict('Batch absensi tidak valid.');
        const otherIds=new Set(batches.filter(d=>d.id!==stored?.id).flatMap(d=>d.data().records.map(r=>r.studentId)));
        let records;
        if(batch){
          // Existing roster is authoritative enrollment for that historical
          // session even after student movement/deactivation. Never rebuild it.
          records=batch.records;
        }else{
          const rows=(await tx.get(col('students').where('schoolId','==',schoolId).where('groupId','==',groupId).where('active','==',true))).docs;
          if(rows.some(d=>d.id!==d.data().id))conflict('Identitas siswa tidak sesuai.');
          records=toRosterResponse(scope,rows.map(d=>d.data()).filter(s=>!otherIds.has(s.id))).students.map(s=>({studentId:s.id,name:s.name,schoolClass:s.schoolClass,status:'unmarked'}));
        }
        if(records.length>300||records.some(r=>!id(r.studentId)||!statuses.has(r.status)||otherIds.has(r.studentId))||new Set(records.map(r=>r.studentId)).size!==records.length)conflict('Roster absensi tidak valid atau siswa tercatat ganda.');
        if(action==='read'){
          await authorize();return response(scope,batch,records);
        }
        const batchId=batch?.id??'attendance-'+hash(JSON.stringify([serviceSessionId,groupId]));
        const receiptRef=col('attendanceSubmissions').doc(hash(JSON.stringify([proof.deviceId,command.idempotencyKey])));
        const receipt=(await tx.get(receiptRef)).data();
        const fingerprint=hash(JSON.stringify({scope,action,command}));
        if(receipt){
          if(receipt.fingerprint!==fingerprint)conflict('Kunci idempotensi sudah dipakai untuk permintaan lain.');
          await authorize();return receipt.response;
        }
        const revision=batch?.revision??0;
        if(command.expectedRevision!==revision)conflict('Absensi sudah berubah. Muat ulang sebelum menyimpan.');
        if(action==='correct'&&batch?.state!=='completed')conflict('Koreksi hanya tersedia untuk absensi selesai.');
        if(action!=='correct'&&batch?.state==='completed')conflict('Absensi selesai terkunci. Gunakan koreksi.');
        const at=new Date(now()).toISOString();
        if(action==='finalize'){
          const date=visit.date;
          if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)conflict('Tanggal pelayanan tidak valid.');
          if(date>new Date(now()+7*3600000).toISOString().slice(0,10))conflict('Pelayanan mendatang belum dapat diselesaikan.');
          if(!batch||!records.length||records.some(r=>r.status==='unmarked'))conflict('Tandai seluruh siswa secara eksplisit sebelum menyelesaikan absensi.');
        }else{
          const allowed=new Set(records.map(r=>r.studentId));
          if(command.records.some(r=>!allowed.has(r.studentId)))deny();
          const changes=new Map(command.records.map(r=>[r.studentId,r.status]));
          records=records.map(r=>changes.has(r.studentId)?{...r,status:changes.get(r.studentId),updatedAt:at}:r);
        }
        const next={...batch,id:batchId,...scope,records,state:action==='finalize'?'completed':'draft',revision:revision+1,updatedAt:at,finalizedAt:action==='finalize'?at:null};
        const result=response(scope,next,records);
        // Recheck expiry after I/O. Credential/device reads belong to this same
        // transaction, so revocation/grant changes invalidate its commit.
        await authorize();
        const history=rev=>col('attendanceHistory').doc(hash(JSON.stringify([batchId,rev])));
        if(batch&&revision===0)tx.create(history(0),{batchId,revision:0,action:'baseline',at,previousUpdatedAt:batch.updatedAt??null,snapshot:batch});
        tx.create(history(next.revision),{batchId,revision:next.revision,action,at,deviceId:proof.deviceId,credentialId:hash(authorization.slice(7)),reason:command.reason??null,...(backupOperator?{backupAssignmentId:backupOperator.assignmentId,backupMentorId:backupOperator.mentorId}:{}),snapshot:next});
        tx.set(stored?.ref??col('sessions').doc(batchId),next);
        // All group mutations for a service share this guard. It prevents a
        // moved student from being claimed twice by concurrent first writers.
        tx.set(lock,{version:(guard?.version??0)+1});
        tx.create(receiptRef,{fingerprint,response:result,at});
        return result;
      });
    }
  };
}
