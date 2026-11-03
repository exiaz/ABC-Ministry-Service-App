import {randomUUID} from 'node:crypto';
import {hash,fail} from './msa-accounts.mjs';

const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const denied=()=>fail(403,'Perangkat akun tidak dapat dikelola dengan izin ini.');
export function deviceRevocationInput(value){
  if(!value||Array.isArray(value)||Object.keys(value).some(k=>!['expectedRevision','expectedAccountRevision','requestId','reason','confirmed'].includes(k))||value.confirmed!==true||!Number.isSafeInteger(value.expectedRevision)||value.expectedRevision<1||!Number.isSafeInteger(value.expectedAccountRevision)||value.expectedAccountRevision<1||typeof value.requestId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value.requestId)||typeof value.reason!=='string'||value.reason.trim().length<5||value.reason.length>300||/[\p{Cc}\p{Cf}]/u.test(value.reason))fail(400,'Pencabutan memerlukan konfirmasi, alasan dan revisi yang valid.');
  return {...value,reason:value.reason.trim()};
}

// authorize is a trusted server callback, never a request field. Every read and
// mutation joins its account/reviewer/device checks in the same transaction.
export function createMsaDeviceLifecycle({db,root,enabled,eligible,now}){
  const col=name=>root.collection(name);
  const state=async(tx,a,b,d)=>{
    if(b.state==='revoked'||d?.state==='revoked'||d?.revokedAt)return 'revoked';
    if(a.state!=='active')return a.state==='suspended'?'suspended':'blocked';
    if(!d||d.id!==b.deviceId||!Number.isSafeInteger(d.expiresAt))return 'stale';
    if(d.expiresAt<=now())return 'expired';
    if(!/^[a-f0-9]{64}$/.test(b.credentialId??''))return 'stale';
    const c=(await tx.get(col('credentials').doc(b.credentialId))).data();
    if(!c||c.deviceId!==d.id||c.revokedAt!==null)return 'revoked';
    return await eligible(d,c,b.credentialId,tx)?'active':'stale';
  };
  return {
    enabled,
    async list(uid,authorize){
      if(!id(uid))denied();enabled();
      return db.runTransaction(async tx=>{
        const a=await authorize(tx);if(a.uid!==uid)denied();
        const rows=await tx.get(col('msaDeviceAssociations').where('uid','==',uid).limit(101));
        if(rows.size>100)fail(409,'Batas perangkat uji tercapai. Hubungi penanggung jawab.');
        const devices=[];
        for(const doc of rows.docs){
          const b=doc.data();if(!id(b.deviceId)||b.deviceId!==doc.id)denied();
          await authorize(tx,b);
          const d=(await tx.get(col('devices').doc(b.deviceId))).data();
          devices.push({deviceId:b.deviceId,state:await state(tx,a,b,d),revision:b.revision,createdAt:b.createdAt,expiresAt:d?.expiresAt??null,revokedAt:b.revokedAt??d?.revokedAt??null,groupName:b.primary?.groupName??'',serviceDate:b.primary?.serviceDate??'',canRevoke:a.deviceRevokeAllowed!==false&&b.state==='active'&&d?.msaAccountBinding?.uid===uid&&d.msaAccountBinding.revision===b.revision});
        }
        await authorize(tx);enabled();
        return {accountState:a.state,accountRevision:a.revision,devices:devices.sort((a,b)=>b.createdAt-a.createdAt),legacyMigration:'unresolved',reauthorization:'new-activation-only'};
      });
    },
    async revoke(uid,deviceId,value,actorUid,authorize){
      if(!id(uid)||!id(deviceId)||!id(actorUid))denied();enabled();const v=deviceRevocationInput(value);
      return db.runTransaction(async tx=>{
        const a=await authorize(tx);if(a.uid!==uid)denied();
        if(a.revision!==v.expectedAccountRevision)fail(409,'Akun sudah berubah. Muat ulang sebelum mencabut perangkat.');
        const bindingRef=col('msaDeviceAssociations').doc(deviceId),deviceRef=col('devices').doc(deviceId),receipt=col('msaDeviceLifecycleReceipts').doc(hash(actorUid+':'+v.requestId));
        const [b,d,old]=(await tx.getAll(bindingRef,deviceRef,receipt)).map(s=>s.data());
        if(b?.uid!==uid||b.deviceId!==deviceId||d?.id!==deviceId||d.msaAccountBinding?.uid!==uid||d.msaAccountBinding.revision!==b.revision)denied();
        await authorize(tx,b);
        const fingerprint=hash(JSON.stringify([uid,deviceId,v.expectedRevision,v.expectedAccountRevision,v.reason]));
        await authorize(tx);enabled();
        if(old){if(old.fingerprint!==fingerprint)fail(409,'Pengajuan pencabutan sudah digunakan. Muat ulang.');return old.result;}
        if(b.revision!==v.expectedRevision||b.state!=='active')fail(409,'Perangkat sudah berubah. Muat ulang sebelum mencoba lagi.');
        const revision=b.revision+1,at=now(),result={revoked:true,revision};
        tx.update(bindingRef,{state:'revoked',revision,revokedAt:at,revokedBy:actorUid,reason:v.reason});
        tx.update(deviceRef,{state:'revoked',revokedAt:d.revokedAt??at,msaAccountBinding:{uid,revision}});
        const event={event:'account-device-revoked',actorUid,targetUid:uid,targetDeviceId:deviceId,mentorId:b.mentorId,scope:Object.fromEntries(['schoolId','groupId','serviceSessionId'].map(k=>[k,b.primary[k]])),reason:v.reason,previousRevision:b.revision,revision,accountRevision:a.revision,at};
        tx.create(col('msaDeviceAssociationEvents').doc(randomUUID()),event);
        tx.create(col('authorizationEvents').doc(randomUUID()),{...event,actor:actorUid,deviceId});
        tx.create(receipt,{fingerprint,result});return result;
      });
    }
  };
}
