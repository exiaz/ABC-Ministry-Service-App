import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {normalizeUsername,normalizePhone,reserveUsername,hash,fail} from './msa-accounts.mjs';
import {adminPolicy} from './admin-accounts.mjs';
import {validRosterScope,SCOPE_KEYS} from './access-control.mjs';

const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const keys=(v,allowed)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>allowed.includes(k));
const scopeKey=s=>JSON.stringify(SCOPE_KEYS.map(k=>s?.[k]));
const stable=v=>v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const reason=v=>typeof v==='string'&&v.trim().length>=5&&v.length<=300&&!/[\p{Cc}\p{Cf}]/u.test(v);
const evidence=v=>keys(v,['method','reference','confirmed'])&&['in-person','trusted-record'].includes(v.method)&&reason(v.reference)&&v.confirmed===true;
const generic={received:true,message:'Permintaan diterima. Pendaftaran yang memenuhi syarat menunggu tinjauan identitas. Jika perlu mencoba kembali, gunakan pengajuan yang sama.'};

export function registrationInput(value){
  if(!keys(value,['fullName','phone','username','password','requestId'])||!uuid(value.requestId)||typeof value.fullName!=='string'||typeof value.password!=='string'||value.password.length<12||value.password.length>128||/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value.password))fail(400,'Isi data dengan benar dan gunakan kata sandi 12–128 karakter.');
  const fullName=value.fullName.normalize('NFC').trim().replace(/ +/g,' ');
  if(fullName.length<2||fullName.length>120||!/[\p{L}]/u.test(fullName)||/[^\p{L}\p{M} .’'-]/u.test(fullName))fail(400,'Nama lengkap harus 2–120 karakter huruf dengan pemisah nama yang wajar.');
  const username=normalizeUsername(value.username),phone=normalizePhone(value.phone);
  if(!phone)fail(400,'Nomor HP wajib diisi.');
  return {fullName,username,phone};
}

// This service cannot be constructed on an operational namespace. All methods
// recheck the live feature/config gates, including after provider provisioning.
export function createMsaRegistration({db,root,auth,assertEnabled,verifyPassword,repository,now=Date.now}){
  const col=name=>root.collection(name),accounts=col('msaAccounts');
  const enabled=()=>{assertEnabled();if(!root.id.startsWith('test-'))fail(503,'Pendaftaran hanya tersedia pada namespace tes terisolasi.');};
  enabled();
  const limit=async(kind,key,max)=>{
    enabled();await db.runTransaction(async tx=>{
      const ref=col('msaIntakeLimits').doc(hash(kind+':'+key)),row=(await tx.get(ref)).data(),window=Math.floor(now()/60000),count=row?.window===window?row.count:0;
      if(count>=max)fail(429,'Permintaan belum dapat diproses. Coba lagi nanti.');tx.set(ref,{window,count:count+1});
    });
  };
  const reviewer=async(tx,actor,row)=>{
    enabled();if(!actor||!await actor.check())fail(403,'Peninjau tidak diizinkan.');
    if(actor.kind==='legacy'){
      const p=await adminPolicy(root,actor.uid,{tx});if(p.revision!==actor.revision)fail(403,'Izin peninjau berubah.');
      if(p.role==='superadmin')return {superadmin:true};
      if(p.role==='pic'){
        const a=(await tx.get(col('adminAccounts').doc(actor.uid))).data(),permissions=(await tx.get(col('adminPairingPermissions').doc(actor.uid))).data(),assignment=row?.reviewAssignment;
        if(!row)return {superadmin:false};
        if(assignment?.reviewerUid===actor.uid&&assignment.reviewerRevision===p.revision&&a.grants?.some(s=>scopeKey(s)===scopeKey(assignment.scope))&&permissions?.active&&permissions.grants?.some(s=>scopeKey(s)===scopeKey(assignment.scope)))return {superadmin:false,scope:assignment.scope};
      }
    }else if(actor.kind==='msa'){
      const a=(await tx.get(accounts.doc(actor.uid))).data();
      if(a?.state==='active'&&a.identity?.state==='verified'&&a.revision===actor.revision&&a.roles?.some(g=>g.role==='superadmin'&&g.status==='active'&&g.scope.organizationId===null))return {superadmin:true};
    }
    fail(403,'Akun atau cakupan tinjauan tidak diizinkan.');
  };
  const read=async(tx,uid)=>{
    if(!id(uid))fail(400,'Akun tidak valid.');const r=(await tx.get(accounts.doc(uid))).data();
    if(r?.origin!=='a2-2'||r.provisioning!=='ready')fail(403,'Akun atau cakupan tinjauan tidak diizinkan.');return r;
  };
  const scope=async(tx,s)=>{
    if(!keys(s,SCOPE_KEYS)||Object.keys(s).length!==3||!validRosterScope(s)||!repository||!await repository.describe(s,{transaction:tx}))fail(400,'Cakupan sekolah, kelompok dan pelayanan tidak valid.');
    return Object.fromEntries(SCOPE_KEYS.map(k=>[k,s[k]]));
  };
  const duplicates=async(tx,row)=>{
    const all=await tx.get(accounts.limit(201));if(all.size>200)fail(409,'Batas registry tes tercapai.');
    // Only counts leave the service. Names/phones are warnings, never proof.
    const others=all.docs.map(d=>d.data()).filter(a=>a.uid!==row.uid);
    return {sameName:others.filter(a=>a.fullName?.normalize('NFC').toLocaleLowerCase('id-ID')===row.fullName.toLocaleLowerCase('id-ID')).length,samePhone:others.filter(a=>a.phone?.normalized===row.phone.normalized).length};
  };
  const project=r=>({uid:r.uid,username:r.username,fullName:r.fullName,state:r.state,revision:r.revision,identity:r.identity,phone:r.phone,reviewAssignment:r.reviewAssignment??null,mentorLink:r.mentorLink??null});
  const control=value=>{
    if(!uuid(value?.requestId)||!Number.isSafeInteger(value.expectedRevision)||value.expectedRevision<1||!reason(value.reason))fail(400,'Revisi, ID pengajuan dan alasan wajib diisi.');
  };
  const mutate=async(actor,uid,value,operation,fn)=>{
    enabled();control(value);await limit('review',actor.uid,120);
    return db.runTransaction(async tx=>{
      const row=await read(tx,uid),power=await reviewer(tx,actor,row);
      if(uid===actor.uid)fail(403,'Tinjauan identitas sendiri ditolak.');
      const ref=col('msaIdentityReceipts').doc(hash(actor.uid+':'+value.requestId)),prior=(await tx.get(ref)).data(),fingerprint=hash(JSON.stringify([operation,uid,stable(value)]));
      if(prior){if(prior.fingerprint!==fingerprint)fail(409,'ID pengajuan telah digunakan.');return prior.result;}
      if(row.revision!==value.expectedRevision)fail(409,'Akun sudah berubah. Muat ulang sebelum mencoba lagi.');
      const {patch,extra,eventScope}=await fn(tx,row,power);
      // All reads, including session reauthorization, precede any writes.
      enabled();if(!await actor.check())fail(403,'Sesi peninjau berakhir.');
      const revision=row.revision+1,result={updated:true,revision};
      tx.update(accounts.doc(uid),{...patch,revision,updatedAt:now()});extra?.(revision);
      tx.create(col('msaIdentityEvents').doc(randomUUID()),{operation,actorUid:actor.uid,targetUid:uid,mentorId:value.mentorId??null,reviewerUid:value.reviewerUid??null,scope:eventScope??null,reason:value.reason.trim(),evidence:value.evidence??null,previousRevision:row.revision,revision,at:now()});
      tx.create(ref,{fingerprint,result});return result;
    });
  };
  return {
    enabled,
    async register(value){
      enabled();await limit('register','global',60);
      let canonical;try{canonical=normalizeUsername(value?.username).canonical;}catch{canonical='!invalid';}
      await limit('register-name',canonical,8);
      const input=registrationInput(value),{fullName,username,phone}=input,start=Date.now();
      const uid='msa-'+hash(root.path+':registration:'+value.requestId).slice(0,40),ref=accounts.doc(uid),claim=col('msaUsernames').doc(username.canonical),alias=uid+'@msa.example.invalid';
      const fingerprint=hash(JSON.stringify([fullName,username.canonical,phone.normalized]));
      try{
        try{await db.runTransaction(tx=>reserveUsername(tx,ref,claim,{uid,origin:'a2-2',username:username.display,canonical:username.canonical,providerAlias:alias,fullName,profile:{},phone,state:'pending',identity:{state:'unverified'},eligibleRoles:[],roles:[],revision:1,provisioning:'reserved',intakeFingerprint:fingerprint,createdAt:now()},r=>r.origin==='a2-2'&&r.intakeFingerprint===fingerprint));}
        catch(e){if(e.status===409)return generic;throw e;}
        const existing=(await ref.get()).data();if(existing.provisioning==='ready')return generic;
        try{
          let user;
          try{user=await auth.createUser({uid,email:alias,password:value.password});}
          catch(e){if(e.code!=='auth/uid-already-exists'&&e.code!=='auth/email-already-exists')throw e;user=await verifyPassword(alias,value.password);}
          if(user.uid!==uid)throw Error();enabled();
          await db.runTransaction(async tx=>{
            const [a,c]=await tx.getAll(ref,claim);enabled();
            if(a.data()?.intakeFingerprint!==fingerprint||c.data()?.uid!==uid)throw Error();
            if(a.data().provisioning==='ready')return;
            tx.update(ref,{provisioning:'ready'});tx.update(claim,{state:'ready'});
            tx.create(col('msaIdentityEvents').doc(randomUUID()),{operation:'registered',actorUid:uid,targetUid:uid,scope:null,reason:'Pendaftaran fiktif menunggu tinjauan.',previousRevision:0,revision:1,at:now()});
          });
        }catch{
          // A failed or uncertain provider write retains the UID/reservation.
          // Concurrent success must never be overwritten by a failed worker.
          await db.runTransaction(async tx=>{const a=await tx.get(ref);if(a.exists&&a.data().provisioning!=='ready')tx.update(ref,{provisioning:'failed'});});
          fail(503,'Pendaftaran belum dapat diselesaikan. Coba lagi dengan pengajuan yang sama.');
        }
        return generic;
      }finally{await delay(Math.max(0,150-(Date.now()-start)));}
    },
    async queue(actor){
      await limit('review',actor.uid,120);
      return db.runTransaction(async tx=>{
        const p=await reviewer(tx,actor),query=p.superadmin?accounts.where('origin','==','a2-2'):accounts.where('reviewAssignment.reviewerUid','==',actor.uid),rows=await tx.get(query.limit(201));
        if(rows.size>200)fail(409,'Batas antrean tes tercapai.');const result=[];
        for(const d of rows.docs){const r=d.data();if(r.provisioning!=='ready')continue;try{await reviewer(tx,actor,r);}catch(e){if(e.status===403)continue;throw e;}result.push({uid:r.uid,fullName:r.fullName,username:r.username,state:r.state,revision:r.revision});}
        enabled();return {superadmin:p.superadmin,accounts:result};
      });
    },
    async detail(actor,uid){
      await limit('review',actor.uid,120);
      return db.runTransaction(async tx=>{
        const r=await read(tx,uid);await reviewer(tx,actor,r);const warnings=await duplicates(tx,r),events=await tx.get(col('msaIdentityEvents').where('targetUid','==',uid).limit(100));
        await reviewer(tx,actor,r);return {account:project(r),warnings,events:events.docs.map(d=>d.data()).sort((a,b)=>a.at-b.at)};
      });
    },
    async delegate(actor,uid,value){
      if(!keys(value,['expectedRevision','requestId','reason','reviewerUid','scope']))fail(400,'Delegasi tidak valid.');
      return mutate(actor,uid,value,'delegated',async(tx,row,p)=>{
        if(!p.superadmin||!id(value.reviewerUid)||value.reviewerUid===uid)fail(403,'Hanya Superadmin dapat mendelegasikan tinjauan.');
        const s=await scope(tx,value.scope),pic=(await tx.get(col('adminAccounts').doc(value.reviewerUid))).data(),permission=(await tx.get(col('adminPairingPermissions').doc(value.reviewerUid))).data();
        if(pic?.role!=='pic'||pic.state!=='active'||!permission?.active||!pic.grants?.some(g=>scopeKey(g)===scopeKey(s))||!permission.grants?.some(g=>scopeKey(g)===scopeKey(s)))fail(403,'PIC tidak memiliki cakupan tersebut.');
        return {patch:{reviewAssignment:{reviewerUid:value.reviewerUid,reviewerRevision:pic.revision,scope:s,delegatedBy:actor.uid,reason:value.reason.trim()}},eventScope:s};
      });
    },
    async review(actor,uid,value){
      if(!keys(value,['expectedRevision','requestId','reason','decision','scope','evidence'])||!['approve','reject','pending'].includes(value.decision))fail(400,'Keputusan tinjauan tidak valid.');
      return mutate(actor,uid,value,'review-'+value.decision,async(tx,row,p)=>{
        if(!['pending','rejected'].includes(row.state)||row.identity.state==='verified')fail(409,'Akun tidak dalam antrean tinjauan.');
        const s=await scope(tx,value.scope);if(!p.superadmin&&scopeKey(p.scope)!==scopeKey(s))fail(403,'Tinjauan di luar cakupan delegasi.');
        await duplicates(tx,row); // Conflicts require human review of independent evidence.
        if(value.decision==='approve'){
          if(!evidence(value.evidence))fail(400,'Persetujuan memerlukan bukti independen dan konfirmasi peninjau.');
          const user=await auth.getUser(uid);if(user.disabled)fail(403,'Akun provider tidak aktif.');
          return {patch:{state:'active',identity:{state:'verified',scope:s,actorUid:actor.uid,verifiedAt:now(),method:value.evidence.method,reference:value.evidence.reference,revision:row.revision+1}},eventScope:s};
        }
        if(value.evidence!==undefined)fail(400,'Bukti hanya dicatat untuk persetujuan eksplisit.');
        return {patch:{state:value.decision==='reject'?'rejected':'pending',identity:{state:'unverified'}},eventScope:s};
      });
    },
    async link(actor,uid,value){
      if(!keys(value,['expectedRevision','requestId','reason','scope','mentorId','evidence'])||!id(value.mentorId)||!evidence(value.evidence))fail(400,'Penautan memerlukan Mentor dan bukti independen yang dikonfirmasi.');
      return mutate(actor,uid,value,'mentor-linked',async(tx,row,p)=>{
        if(row.state!=='active'||row.identity.state!=='verified')fail(403,'Identitas belum terverifikasi atau akun tidak aktif.');
        const s=await scope(tx,value.scope);
        if(scopeKey(row.identity.scope)!==scopeKey(s)||!p.superadmin&&scopeKey(p.scope)!==scopeKey(s))fail(403,'Penautan di luar cakupan tinjauan.');
        const context=await repository.describe(s,{transaction:tx,mentorIdentity:true,defaultIdentity:true});
        if(context?.defaultMentorId!==value.mentorId||context.mentorId!==value.mentorId)fail(403,'Mentor bukan penugasan tetap dan efektif pada cakupan ini.');
        const ref=col('mentorIdentityLinks').doc(value.mentorId),claim=(await tx.get(ref)).data(),legacy=(await tx.get(col('adminAccounts').doc(uid))).data(),user=await auth.getUser(uid);
        if(legacy||user.disabled||claim||row.mentorLink)fail(409,'Identitas sudah ditautkan atau memerlukan penanganan konflik oleh Superadmin.');
        const binding={uid,mentorId:value.mentorId,scope:s,state:'active',actorUid:actor.uid,reason:value.reason.trim(),evidence:value.evidence,createdAt:now(),revision:1};
        return {patch:{mentorLink:{mentorId:value.mentorId,scope:s,revision:1}},extra:revision=>tx.create(ref,{...binding,accountRevision:revision}),eventScope:s};
      });
    },
    async defaults(actor,uid){
      await limit('review',actor.uid,120);
      return db.runTransaction(async tx=>{
        const r=await read(tx,uid);await reviewer(tx,actor,r);
        if(r.state!=='active'||r.identity.state!=='verified'||!r.mentorLink)fail(403,'Identitas belum ditautkan atau akun tidak aktif.');
        const binding=(await tx.get(col('mentorIdentityLinks').doc(r.mentorLink.mentorId))).data();
        if(binding?.uid!==uid||binding.state!=='active'||scopeKey(binding.scope)!==scopeKey(r.mentorLink.scope))fail(403,'Tautan identitas tidak berlaku.');
        const context=await repository.describe(binding.scope,{transaction:tx,mentorIdentity:true,defaultIdentity:true});
        await reviewer(tx,actor,r);
        return {mentorId:binding.mentorId,assignments:context?.defaultMentorId===binding.mentorId&&context.mentorId===binding.mentorId?[binding.scope]:[],attendanceAccess:false,deviceAccess:false};
      });
    }
  };
}
