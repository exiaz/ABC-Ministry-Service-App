import {randomUUID,createHash} from 'node:crypto';
import {adminPolicy} from './admin-accounts.mjs';
import {validRosterScope,validServiceSession,SCOPE_KEYS} from './access-control.mjs';
import {isValidDate} from '../dates.js';

const fail=(status,message)=>{throw Object.assign(Error(message),{status,adminAccountError:true});};
const key=s=>JSON.stringify(SCOPE_KEYS.map(k=>s[k]));
const digest=s=>createHash('sha256').update(s).digest('hex');
const validId=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(s);
const permission=p=>p?.active===true&&Array.isArray(p.grants)&&p.grants.length>0&&p.grants.length<=256&&p.grants.every(s=>validRosterScope(s)&&Object.keys(s).length===3)&&new Set(p.grants.map(key)).size===p.grants.length;
const scope=(visit,groupId)=>({schoolId:visit.schoolId,groupId,serviceSessionId:visit.id});
const exact=(p,s)=>permission(p)&&p.grants.some(g=>key(g)===key(s));
const groupAllowed=(p,schoolId,groupId)=>permission(p)&&p.grants.some(g=>g.schoolId===schoolId&&g.groupId===groupId);
const project=(v,groups,canEdit)=>({id:v.id,schoolId:v.schoolId,date:v.date,groupIds:groups,revision:v.revision??0,canEdit,dateHistory:(v.dateHistory??[]).map(h=>({from:h.from,to:h.to,changedAt:h.changedAt}))});

// Only explicit authenticated commands create sessions or extend exact grants.
// Selecting a date and GET never write sessions, permissions or attendance.
export function createServiceCalendar({db,root,now,assertLocal,currentAdmin}){
  const col=name=>root.collection(name);
  const operator=async(tx,uid,action)=>{assertLocal();const p=await adminPolicy(root,uid,{tx,action});if(!['superadmin','pic'].includes(p.role))fail(403,'Gunakan akun Superadmin atau PIC yang aktif.');return p;};
  return {
    async listServices(uid,check){
      return db.runTransaction(async tx=>{
        const actor=await operator(tx,uid,'pairing:read'),p=(await tx.get(col('adminPairingPermissions').doc(uid))).data();if(!permission(p))fail(403,'Cakupan jadwal tidak tersedia.');
        const snapshots=await tx.get(col('serviceSessions')),services=[];
        for(const row of snapshots.docs){const v=row.data();if(!validServiceSession(v)||v.id!==row.id||v.legacy||!Array.isArray(v.groupIds))continue;const groups=v.groupIds.filter(id=>exact(p,scope(v,id)));if(groups.length)services.push(project(v,groups,groups.length===v.groupIds.length&&(actor.role==='superadmin'||actor.actions.includes('pairing:issue'))));}
        assertLocal();await currentAdmin(check);return {services:services.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))};
      });
    },
    async saveService(uid,input,check){
      if(!input||Object.keys(input).some(k=>!['id','schoolId','date','groupIds','expectedRevision','idempotencyKey'].includes(k))||input.id!==undefined&&!validId(input.id)||!validId(input.schoolId)||!isValidDate(input.date)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||!Array.isArray(input.groupIds)||!input.groupIds.length||input.groupIds.length>16||input.groupIds.some(id=>!validId(id))||new Set(input.groupIds).size!==input.groupIds.length||typeof input.idempotencyKey!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(input.idempotencyKey))fail(400,'Pilih sekolah, tanggal, kelompok dan versi jadwal yang valid.');
      const command=structuredClone(input),id=command.id??randomUUID(),fingerprint=digest(JSON.stringify({...command,groupIds:[...command.groupIds].sort()})),receiptRef=col('serviceSubmissions').doc(digest(JSON.stringify([uid,command.idempotencyKey])));
      return db.runTransaction(async tx=>{
        await operator(tx,uid,'pairing:issue');
        const owner=(await tx.get(col('adminSecurity').doc('owner'))).data();if(!validId(owner?.uid))fail(403,'Pemilik aplikasi belum dikonfigurasi.');
        const uids=[...new Set([uid,owner.uid])],permissions=await tx.getAll(...uids.map(id=>col('adminPairingPermissions').doc(id))),p=permissions[uids.indexOf(uid)].data();
        if(!permission(p)||command.groupIds.some(g=>!groupAllowed(p,command.schoolId,g)))fail(403,'Jadwal melampaui sekolah atau kelompok yang diizinkan.');
        const ref=col('serviceSessions').doc(id),old=(await tx.get(ref)).data(),receipt=(await tx.get(receiptRef)).data();
        if(receipt){
          if(receipt.fingerprint!==fingerprint)fail(409,'Kunci penyimpanan sudah dipakai untuk perubahan lain.');
          const v=(await tx.get(col('serviceSessions').doc(receipt.serviceSessionId))).data();if(!validServiceSession(v)||v.groupIds.some(g=>!exact(p,scope(v,g))))fail(403,'Cakupan jadwal sudah berubah.');
          assertLocal();await currentAdmin(check);return {service:project(v,v.groupIds,true),duplicateSubmission:true};
        }
        if(command.id&&(!validServiceSession(old)||old.legacy)||!command.id&&old)fail(409,'Jadwal tidak tersedia untuk perubahan ini.');
        if((old?.revision??0)!==command.expectedRevision)fail(409,'Jadwal sudah berubah. Muat ulang sebelum menyimpan.');
        if(old&&(old.schoolId!==command.schoolId||old.groupIds.some(g=>!exact(p,scope(old,g)))))fail(403,'Seluruh cakupan jadwal harus diizinkan. Sekolah sesi tetap.');
        if(old&&old.groupIds.some(g=>!command.groupIds.includes(g)))fail(409,'Kelompok sesi yang sudah dikonfigurasi harus tetap disertakan.');
        const [school,...groups]=(await tx.getAll(col('schools').doc(command.schoolId),...command.groupIds.map(id=>col('groups').doc(id)))).map(d=>d.data());
        if(school?.id!==command.schoolId||groups.some((g,i)=>g?.id!==command.groupIds[i]||g.schoolId!==command.schoolId||g.retired))fail(400,'Sekolah dan kelompok tidak sesuai.');
        const lock=col('attendanceSessionLocks').doc(id);await tx.get(lock);
        const batches=await tx.get(col('sessions').where('serviceSessionId','==',id)),overrides=await tx.get(col('sessionMentorOverrides').where('serviceSessionId','==',id));
        if([...batches.docs,...overrides.docs].some(d=>!command.groupIds.includes(d.data().groupId)))fail(409,'Kelompok yang sudah memiliki absensi atau penugasan harus tetap disertakan.');
        const v={...old,id,schoolId:command.schoolId,date:command.date,groupIds:[...command.groupIds],revision:command.expectedRevision+1,updatedAt:now(),...(!old?{createdAt:now(),createdBy:uid,fictional:true}:{})};
        if(old&&old.date!==v.date)v.dateHistory=[...(old.dateHistory??[]),{from:old.date,to:v.date,changedAt:new Date(now()).toISOString()}];
        const updatedPermissions=permissions.map(snapshot=>{
          const value=snapshot.data();if(!permission(value)||v.groupIds.some(g=>!groupAllowed(value,v.schoolId,g)))fail(403,'Izin pemilik atau operator tidak mencakup kelompok ini.');
          const grants=new Map(value.grants.map(s=>[key(s),s]));for(const g of v.groupIds){const next=scope(v,g);grants.set(key(next),next);}if(grants.size>256)fail(409,'Batas cakupan lokal tercapai. Minta Superadmin meninjau izin lama tanpa menghapus riwayat.');return {...value,grants:[...grants.values()]};
        });
        // Account metadata follows the authoritative permission documents. Role
        // revisions are unchanged for this explicit additive operation; every
        // subsequent request still rechecks exact server grants and revocation.
        const accounts=await tx.getAll(...uids.map(id=>col('adminAccounts').doc(id)));
        assertLocal();await currentAdmin(check);
        tx.set(ref,v);
        for(const [i,p] of updatedPermissions.entries()){tx.set(permissions[i].ref,p);if(accounts[i].data()?.role==='pic')tx.update(accounts[i].ref,{grants:p.grants});}
        tx.create(receiptRef,{fingerprint,serviceSessionId:id,at:now()});
        tx.create(col('authorizationEvents').doc(randomUUID()),{event:old?'service-updated':'service-created',actor:uid,at:now(),serviceSessionId:id,previous:old?{date:old.date,groupIds:old.groupIds,revision:old.revision??0}:null,next:{date:v.date,groupIds:v.groupIds,revision:v.revision}});
        return {service:project(v,v.groupIds,true),duplicateSubmission:false};
      });
    }
  };
}
