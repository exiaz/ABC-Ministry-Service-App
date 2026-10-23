import {createServiceCalendar} from './service-calendar.mjs';
import {randomBytes,randomUUID} from 'node:crypto';
import {validRosterScope,validServiceSession,SCOPE_KEYS} from './access-control.mjs';
import {emulatorConfig} from './emulator-config.mjs';
import {adminAuthConfig} from './admin-auth.mjs';
import {hash,devicePublicKey,validDeviceProof} from './device-proof.mjs';
import {SCHOOL_CONFIG,GROUP_CONFIG} from '../group-config.js';
import {toRosterContext} from './roster.mjs';
import {adminPolicy} from './admin-accounts.mjs';

export class PairingError extends Error{
  constructor(status,message){super(message);this.status=status;}
}
const invalid=()=>new PairingError(400,'Kode pairing tidak valid atau tidak berlaku.');
const denied=()=>new PairingError(403,'Cakupan pairing tidak diizinkan.');
const copy=grants=>grants.map(scope=>Object.fromEntries(SCOPE_KEYS.map(key=>[key,scope[key]])));
const validGrants=(grants,max=16)=>Array.isArray(grants)&&grants.length>0&&grants.length<=max&&grants.every(scope=>validRosterScope(scope)&&Object.keys(scope).length===3)&&new Set(grants.map(s=>JSON.stringify(copy([s])[0]))).size===grants.length;
const permitted=(permission,grants)=>permission?.active===true&&validGrants(permission.grants,256)&&validGrants(grants,256)&&grants.every(scope=>permission.grants.some(p=>SCOPE_KEYS.every(k=>p[k]===scope[k])));
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(id);
export const ACTIVATION_CODE_TTL_MS=48*60*60*1000;
// Exclusive next midnight in WIB; redemption expiry is independent of this cap.
export const activationAccessEnd=assignment=>Date.parse(assignment?.serviceDate+'T23:59:59.999+07:00')+1;
const assignmentKeys=[...SCOPE_KEYS,'serviceDate','mentorId'];
export const sameActivationAssignment=(a,b)=>!!a&&!!b&&assignmentKeys.every(key=>a[key]===b[key]);

// Only constructed by the validated Firestore Emulator adapter. No memory/cloud
// fallback and no public operation to grant administrative pairing permissions.
export function createEmulatorDevicePairing({db,root,config,repository,now,prepareCredential,stageCredential,stageDeviceRevoke}){
  const col=name=>root.collection(name);
  const assertLocal=()=>{
    try{const current=emulatorConfig();if(current.projectId===config.projectId&&current.host===config.host)return;}catch{}
    throw new PairingError(503,'Pairing emulator lokal tidak tersedia.');
  };
  const assertAdminLocal=()=>{
    assertLocal();try{return adminAuthConfig();}catch{throw new PairingError(503,'Pairing emulator lokal tidak tersedia.');}
  };
  const currentAdmin=async check=>{if(!await check())throw new PairingError(401,'Token admin tidak valid atau tidak berlaku.');};
  const event=(tx,event,actor,fields)=>tx.create(col('authorizationEvents').doc(randomUUID()),{event,actor,at:now(),...fields});
  const permissionRef=uid=>{if(!validId(uid))throw denied();return col('adminPairingPermissions').doc(uid);};
  const authorizeOperator=async(uid,action,tx)=>{assertAdminLocal();try{await adminPolicy(root,uid,{tx,action});}catch{throw denied();}};
  const relations=async(tx,grants)=>{
    for(const s of grants){
      const [school,group,visit]=(await tx.getAll(col('schools').doc(s.schoolId),col('groups').doc(s.groupId),col('serviceSessions').doc(s.serviceSessionId))).map(d=>d.data());
      if(school?.id!==s.schoolId||group?.id!==s.groupId||group.schoolId!==s.schoolId||!validServiceSession(visit)||visit?.id!==s.serviceSessionId||visit.schoolId!==s.schoolId||!visit.groupIds?.includes(s.groupId))throw denied();
    }
  };
  const assignmentFor=async(tx,scope)=>{
    const value=await repository.describe(scope,{transaction:tx,mentorIdentity:true});
    if(!value||!validId(value.mentorId))throw denied();
    return {...toRosterContext(scope,value),mentorId:value.mentorId};
  };
  const assignmentMetadata=value=>{if(!validId(value?.mentorId))throw denied();return {...toRosterContext(value,value),mentorId:value.mentorId};};
  const codeMetadata=entry=>({pairingId:entry.codeHash,createdAt:entry.createdAt,expiresAt:entry.expiresAt,state:entry.state==='pending'&&entry.expiresAt<=now()?'expired':entry.state,assignment:assignmentMetadata(entry.assignment)});
  const limit=async(action,identity,max,units=1)=>{
    if(!Number.isSafeInteger(units)||units<1||units>16)throw new PairingError(400,'Jumlah permintaan tidak valid.');
    assertLocal();const ref=col('pairingLimits').doc(hash(action+':'+identity));
    await db.runTransaction(async tx=>{
      const value=(await tx.get(ref)).data(),time=now(),window=Math.floor(time/60000);
      if((value?.window===window?value.count:0)+units>max)throw new PairingError(429,'Terlalu banyak percobaan. Coba lagi nanti.');
      tx.set(ref,{window,count:(value?.window===window?value.count:0)+units});
    });
  };
  return {
    ...createServiceCalendar({db,root,now,assertLocal:assertAdminLocal,currentAdmin}),
    limit,
    async issueActivation(uid,{grants,idempotencyKey},stillAuthorized=async()=>true){
      await authorizeOperator(uid,'pairing:issue');
      if(!validGrants(grants)||typeof idempotencyKey!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey))throw new PairingError(400,'Pilih kelompok dan kunci penerbitan yang valid.');
      const scopes=copy(grants),fingerprint=hash(JSON.stringify([...scopes].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))));
      const receiptRef=col('pairingSubmissions').doc(hash(JSON.stringify([uid,'activation-v1',idempotencyKey])));
      const secrets=scopes.map(()=>{const code=randomBytes(16).toString('base64url');return {code,pairingId:hash(code)};});
      const result=await db.runTransaction(async tx=>{
        await authorizeOperator(uid,'pairing:issue',tx);
        if(!permitted((await tx.get(permissionRef(uid))).data(),scopes))throw denied();
        await relations(tx,scopes);
        const assignments=await Promise.all(scopes.map(scope=>assignmentFor(tx,scope))),receipt=(await tx.get(receiptRef)).data();
        assertAdminLocal();await currentAdmin(stillAuthorized);
        if(receipt){
          if(receipt.fingerprint!==fingerprint)throw new PairingError(409,'Kunci penerbitan sudah dipakai untuk pilihan lain. Muat ulang sebelum mencoba lagi.');
          if(receipt.kind!=='activation-v1'||!Array.isArray(receipt.codes)||receipt.codes.length!==scopes.length)throw new PairingError(503,'Receipt penerbitan tidak dapat diperiksa.');
          if(receipt.codes.some(row=>!/^[a-f0-9]{64}$/.test(row.pairingId)))throw new PairingError(503,'Receipt penerbitan tidak dapat diperiksa.');
          const entries=await tx.getAll(...receipt.codes.map(row=>col('pairingCodes').doc(row.pairingId)));
          if(entries.some((row,index)=>!row.exists||row.data().codeHash!==receipt.codes[index].pairingId))throw new PairingError(503,'Receipt penerbitan tidak dapat diperiksa.');
          assertAdminLocal();await currentAdmin(stillAuthorized);
          return {duplicate:true,codes:entries.map(row=>codeMetadata(row.data()))};
        }
        const createdAt=now(),expiresAt=createdAt+ACTIVATION_CODE_TTL_MS,codes=[];
        for(const [index,assignment] of assignments.entries()){
          const secret=secrets[index],entry={codeHash:secret.pairingId,kind:'activation-v1',issuedBy:uid,grants:[scopes[index]],assignment,createdAt,expiresAt,state:'pending'};
          tx.create(col('pairingCodes').doc(secret.pairingId),entry);
          event(tx,'pairing-issued',uid,{pairingId:secret.pairingId,assignment:Object.fromEntries(assignmentKeys.map(key=>[key,assignment[key]]))});
          codes.push(codeMetadata(entry));
        }
        tx.create(receiptRef,{kind:'activation-v1',fingerprint,codes});
        return {codes:codes.map((entry,index)=>({...entry,code:secrets[index].code}))};
      });
      if(result.duplicate)throw Object.assign(new PairingError(409,'Penerbitan sudah diproses. Kode tidak dapat ditampilkan ulang. Periksa daftar kode sebelum menerbitkan pengganti.'),{duplicateSubmission:true,codes:result.codes});
      return result;
    },
    async listCodes(uid,stillAuthorized=async()=>true){
      await authorizeOperator(uid,'pairing:read');
      return db.runTransaction(async tx=>{
        await authorizeOperator(uid,'pairing:read',tx);
        const permission=(await tx.get(permissionRef(uid))).data();
        if(!permitted(permission,permission?.grants))throw denied();
        const rows=await tx.get(col('pairingCodes').where('kind','==','activation-v1')),codes=[];
        for(const row of rows.docs){
          const entry=row.data();if(!permitted(permission,entry.grants))continue;
          if(entry.codeHash!==row.id||!/^[a-f0-9]{64}$/.test(entry.codeHash)||entry.grants.length!==1||!['pending','redeemed','revoked'].includes(entry.state)||!Number.isSafeInteger(entry.createdAt)||entry.expiresAt!==entry.createdAt+ACTIVATION_CODE_TTL_MS)continue;
          const value=codeMetadata(entry);
          if(value.state==='pending'){
            try{if(!sameActivationAssignment(entry.assignment,await assignmentFor(tx,entry.grants[0])))value.state='invalid';}catch{value.state='invalid';}
            if(value.state==='pending'&&activationAccessEnd(entry.assignment)<=now())value.state='service-ended';
          }
          codes.push(value);
        }
        assertAdminLocal();await currentAdmin(stillAuthorized);
        return {codes:codes.sort((a,b)=>b.createdAt-a.createdAt||a.pairingId.localeCompare(b.pairingId))};
      });
    },
    async adminContext(uid,stillAuthorized=async()=>true){
      await authorizeOperator(uid,'pairing:read');
      const initial=(await permissionRef(uid).get()).data();
      if(!permitted(initial,initial?.grants))throw denied();
      const scopes=copy(initial.grants);
      const contexts=await Promise.all(scopes.map(async scope=>{
        const school=SCHOOL_CONFIG.find(s=>s.id===scope.schoolId),group=GROUP_CONFIG.find(g=>g.id===scope.groupId&&g.schoolId===scope.schoolId);
        if(!school||!group)throw denied();
        const metadata=toRosterContext(scope,await repository.describe(scope));
        return {...metadata,schoolName:school.name,groupName:group.name};
      }));
      return db.runTransaction(async tx=>{
        await authorizeOperator(uid,'pairing:read',tx);
        const permission=(await tx.get(permissionRef(uid))).data();
        if(!permitted(permission,scopes))throw denied();
        await relations(tx,scopes);assertAdminLocal();await currentAdmin(stillAuthorized);
        return {contexts};
      });
    },
    async listDevices(uid,stillAuthorized=async()=>true){
      await authorizeOperator(uid,'pairing:read');
      return db.runTransaction(async tx=>{
        await authorizeOperator(uid,'pairing:read',tx);
        const permission=(await tx.get(permissionRef(uid))).data();
        if(!permitted(permission,permission?.grants))throw denied();
        const snapshots=await tx.get(col('devices').where('binding','==','p256-v1'));
        const devices=[];
        for(const snapshot of snapshots.docs){
          const entry=snapshot.data();
          // A partially permitted device is never listed; revoke requires the
          // same full-grant permission as the existing adminDevice operation.
          if(!permitted(permission,entry.grants))continue;
          if(!validId(entry.id)||entry.id!==snapshot.id||!['active','revoked'].includes(entry.state)||!Number.isSafeInteger(entry.expiresAt)||!Number.isSafeInteger(entry.createdAt)||!(entry.revokedAt===null||Number.isSafeInteger(entry.revokedAt)))throw denied();
          const events=(await tx.get(col('authorizationEvents').where('deviceId','==',entry.id))).docs.map(d=>d.data()).filter(e=>['pairing-redeemed','pairing-device-revoked','device-revoked'].includes(e.event)&&Number.isSafeInteger(e.at)&&typeof e.actor==='string');
          events.sort((a,b)=>b.at-a.at||Number(b.event==='pairing-device-revoked')-Number(a.event==='pairing-device-revoked'));
          const last=events[0];
          devices.push({deviceId:entry.id,state:entry.state==='revoked'?'revoked':entry.expiresAt<=now()?'expired':'active',expiresAt:entry.expiresAt,createdAt:entry.createdAt,revokedAt:entry.revokedAt,grants:copy(entry.grants),lastEvent:last?{event:last.event,at:last.at,actor:last.actor}:null});
        }
        assertAdminLocal();await currentAdmin(stillAuthorized);
        return {devices:devices.sort((a,b)=>b.createdAt-a.createdAt||a.deviceId.localeCompare(b.deviceId))};
      });
    },
    async issue(uid,{grants,codeTtlMs=300000,grantTtlMs=3600000,idempotencyKey},stillAuthorized=async()=>true){
      await authorizeOperator(uid,'pairing:issue');
      if(!validGrants(grants)||!Number.isSafeInteger(codeTtlMs)||codeTtlMs<1000||codeTtlMs>600000||!Number.isSafeInteger(grantTtlMs)||grantTtlMs<1000||grantTtlMs>3600000)throw new PairingError(400,'Parameter pairing tidak valid.');
      const scopes=copy(grants);
      if(idempotencyKey!==undefined&&(typeof idempotencyKey!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey)))throw new PairingError(400,'Kunci idempotensi penerbitan tidak valid.');
      const receiptRef=idempotencyKey===undefined?null:col('pairingSubmissions').doc(hash(JSON.stringify([uid,idempotencyKey])));
      const fingerprint=hash(JSON.stringify({scopes:[...scopes].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),codeTtlMs,grantTtlMs}));
      if(!permitted((await permissionRef(uid).get()).data(),scopes))throw denied();
      // Preserve existing relation/roster rules, then recheck relations and
      // server permission in the transaction that commits the issuance.
      for(const scope of scopes)if(!await repository.read(scope))throw denied();
      const code=randomBytes(16).toString('base64url'),pairingId=hash(code),ref=col('pairingCodes').doc(pairingId);
      const result=await db.runTransaction(async tx=>{
        await authorizeOperator(uid,'pairing:issue',tx);
        if(!permitted((await tx.get(permissionRef(uid))).data(),scopes))throw denied();
        await relations(tx,scopes);assertAdminLocal();await currentAdmin(stillAuthorized);
        const receipt=receiptRef?(await tx.get(receiptRef)).data():null;
        assertAdminLocal();await currentAdmin(stillAuthorized);
        if(receipt){
          if(receipt.fingerprint!==fingerprint)throw new PairingError(409,'Kunci penerbitan sudah dipakai untuk pilihan lain. Muat ulang sebelum mencoba lagi.');
          return {duplicate:true,pairingId:receipt.pairingId,expiresAt:receipt.expiresAt};
        }
        const expiresAt=now()+codeTtlMs;
        tx.create(ref,{codeHash:pairingId,issuedBy:uid,grants:scopes,expiresAt,grantTtlMs,state:'pending',createdAt:now()});
        event(tx,'pairing-issued',uid,{pairingId});
        if(receiptRef)tx.create(receiptRef,{fingerprint,pairingId,expiresAt});
        return {pairingId,code,expiresAt};
      });
      if(result.duplicate)throw Object.assign(new PairingError(409,'Permintaan sudah diproses. Kode hanya ditampilkan sekali; batalkan kode terakhir atau tunggu kedaluwarsa sebelum menerbitkan lagi.'),{duplicateSubmission:true,pairingId:result.pairingId,expiresAt:result.expiresAt});
      return result;
    },
    async redeem({code,publicKey},proof){
      assertAdminLocal();
      if(typeof code!=='string'||!/^[A-Za-z0-9_-]{22}$/.test(code))throw invalid();
      try{devicePublicKey(publicKey);}catch{throw invalid();}
      if(!validDeviceProof(publicKey,{...proof,token:code},now()))throw invalid();
      const pairingId=hash(code),ref=col('pairingCodes').doc(pairingId),deviceId=randomUUID();
      return db.runTransaction(async tx=>{
        const entry=(await tx.get(ref)).data();
        const activation=entry?.kind==='activation-v1';let accessEnd;
        const rejected=state=>Object.assign(new PairingError(400,{invalid:'Kode aktivasi tidak valid. Minta kode baru kepada PIC.',expired:'Kode aktivasi kedaluwarsa. Minta kode baru kepada PIC.',used:'Kode aktivasi sudah dipakai. Gunakan izin perangkat yang tersimpan atau minta kode baru.',revoked:'Kode aktivasi telah dicabut. Hubungi PIC.','service-ended':'Tanggal pelayanan sudah berakhir. Hubungi PIC.'}[state]),{codeState:state});
        if(activation){
          if(entry.codeHash!==pairingId||!validGrants(entry.grants)||entry.grants.length!==1||!Number.isSafeInteger(entry.createdAt)||entry.expiresAt!==entry.createdAt+ACTIVATION_CODE_TTL_MS)throw rejected('invalid');
          if(entry.state==='revoked')throw rejected('revoked');
          if(entry.state==='redeemed')throw rejected('used');
          if(entry.state!=='pending')throw rejected('invalid');
          if(entry.expiresAt<=now())throw rejected('expired');
          try{await authorizeOperator(entry.issuedBy,'pairing:issue',tx);if(!permitted((await tx.get(permissionRef(entry.issuedBy))).data(),entry.grants)||!sameActivationAssignment(entry.assignment,await assignmentFor(tx,entry.grants[0])))throw denied();}catch{throw rejected('invalid');}
          accessEnd=activationAccessEnd(entry.assignment);
          if(!Number.isSafeInteger(accessEnd))throw rejected('invalid');
          if(accessEnd<=now())throw rejected('service-ended');
        }
        if(!entry||entry.codeHash!==pairingId||entry.state!=='pending'||!Number.isSafeInteger(entry.expiresAt)||entry.expiresAt<=now()||!validGrants(entry.grants))throw invalid();
        try{await authorizeOperator(entry.issuedBy,'pairing:issue',tx);}catch{throw invalid();}
        if(!permitted((await tx.get(permissionRef(entry.issuedBy))).data(),entry.grants))throw invalid();
        try{await relations(tx,entry.grants);}catch{throw invalid();}
        assertLocal();
        if(!validDeviceProof(publicKey,{...proof,token:code},now()))throw invalid();
        if(entry.expiresAt<=now())throw activation?rejected('expired'):invalid();
        const redeemedAt=now();
        if(activation&&accessEnd<=redeemedAt)throw rejected('service-ended');
        const prepared=prepareCredential({deviceId,grants:entry.grants,ttlMs:activation?3600000:entry.grantTtlMs});
        if(activation)prepared.entry.expiresAt=Math.min(prepared.entry.expiresAt,redeemedAt+3600000,accessEnd);
        prepared.entry.binding='p256-v1';
        stageCredential(tx,prepared,{id:deviceId,state:'active',createdAt:redeemedAt,revokedAt:null,binding:'p256-v1',publicKey,grants:copy(entry.grants),expiresAt:prepared.entry.expiresAt,...(activation?{kind:'activation-v1',assignment:assignmentMetadata(entry.assignment)}:{})});
        tx.update(ref,{state:'redeemed',redeemedAt,deviceId});
        event(tx,'pairing-redeemed','device-pairing',{pairingId,deviceId});
        return {deviceId,credential:prepared.token,expiresAt:prepared.entry.expiresAt};
      });
    },
    async revokeCode(uid,pairingId,stillAuthorized=async()=>true){
      assertAdminLocal();if(!/^[a-f0-9]{64}$/.test(pairingId))throw invalid();
      return db.runTransaction(async tx=>{
        await authorizeOperator(uid,'pairing:revoke',tx);
        const ref=col('pairingCodes').doc(pairingId),entry=(await tx.get(ref)).data();
        const permission=(await tx.get(permissionRef(uid))).data();
        if(!entry||!permitted(permission,entry.grants))throw denied();
        assertAdminLocal();await currentAdmin(stillAuthorized);
        if(entry.state==='pending'){tx.update(ref,{state:'revoked',revokedAt:now()});event(tx,'pairing-revoked',uid,{pairingId});}
        return {pairingId,state:entry.state==='pending'?'revoked':entry.state};
      });
    },
    async adminDevice(uid,deviceId,revoke=false,stillAuthorized=async()=>true){
      assertAdminLocal();if(!validId(deviceId))throw denied();
      return db.runTransaction(async tx=>{
        await authorizeOperator(uid,revoke?'pairing:revoke':'pairing:read',tx);
        const entry=(await tx.get(col('devices').doc(deviceId))).data(),permission=(await tx.get(permissionRef(uid))).data();
        if(entry?.id!==deviceId||!entry.publicKey||!permitted(permission,entry.grants))throw denied();
        assertAdminLocal();await currentAdmin(stillAuthorized);
        if(revoke&&entry.state==='active'&&entry.revokedAt===null){stageDeviceRevoke(tx,deviceId);event(tx,'pairing-device-revoked',uid,{deviceId});}
        return {deviceId,state:revoke?'revoked':entry.state==='revoked'?'revoked':entry.expiresAt<=now()?'expired':'active',expiresAt:entry.expiresAt,grants:copy(entry.grants)};
      });
    },
    async verifyRequest(authorization,proof){
      assertLocal();
      const match=typeof authorization==='string'&&/^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization);
      if(!match)return null;
      const credentialId=hash(match[1]);
      return db.runTransaction(async tx=>{
        const entry=(await tx.get(col('credentials').doc(credentialId))).data();
        if(!entry||entry.binding!=='p256-v1'||!validId(entry.deviceId)||entry.revokedAt!==null||entry.expiresAt<=now())return null;
        const device=(await tx.get(col('devices').doc(entry.deviceId))).data();
        if(device?.id!==entry.deviceId||device.binding!=='p256-v1'||device.state!=='active'||device.revokedAt!==null||!device.publicKey||!validDeviceProof(device.publicKey,{...proof,token:match[1]},now()))return null;
        // Stable per-device nonce document bounds storage. Prune old nonces and
        // enforce a bounded request budget, including across API restarts.
        const ref=col('deviceProofNonces').doc(entry.deviceId),stored=(await tx.get(ref)).data(),time=now();
        const nonces=(stored?.nonces??[]).filter(n=>n.expiresAt>=time);
        if(nonces.some(n=>n.value===proof.nonce)||nonces.length>=120)return null;
        assertLocal();
        tx.set(ref,{nonces:[...nonces,{value:proof.nonce,expiresAt:Number(proof.timestamp)+60000}]});
        return {deviceId:entry.deviceId};
      });
    },
    async status(authorization,proof){
      const match=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization??'');
      if(!proof?.deviceId||!match)return null;
      const entry=(await col('credentials').doc(hash(match[1])).get()).data();
      if(entry?.deviceId!==proof.deviceId)return null;
      const device=(await col('devices').doc(entry.deviceId).get()).data();
      return {deviceId:entry.deviceId,state:'active',expiresAt:entry.expiresAt,grants:copy(entry.grants),...(device?.kind==='activation-v1'?{assignment:assignmentMetadata(device.assignment)}:{})};
    }
  };
}
