import {randomBytes,randomUUID} from 'node:crypto';
import {validRosterScope,SCOPE_KEYS} from './access-control.mjs';
import {emulatorConfig} from './emulator-config.mjs';
import {adminAuthConfig} from './admin-auth.mjs';
import {hash,devicePublicKey,validDeviceProof} from './device-proof.mjs';
import {SCHOOL_CONFIG,GROUP_CONFIG} from '../group-config.js';
import {toRosterContext} from './roster.mjs';

export class PairingError extends Error{
  constructor(status,message){super(message);this.status=status;}
}
const invalid=()=>new PairingError(400,'Kode pairing tidak valid atau tidak berlaku.');
const denied=()=>new PairingError(403,'Cakupan pairing tidak diizinkan.');
const copy=grants=>grants.map(scope=>Object.fromEntries(SCOPE_KEYS.map(key=>[key,scope[key]])));
const validGrants=grants=>Array.isArray(grants)&&grants.length>0&&grants.length<=16&&grants.every(scope=>validRosterScope(scope)&&Object.keys(scope).length===3)&&new Set(grants.map(s=>JSON.stringify(copy([s])[0]))).size===grants.length;
const permitted=(permission,grants)=>permission?.active===true&&validGrants(permission.grants)&&validGrants(grants)&&grants.every(scope=>permission.grants.some(p=>SCOPE_KEYS.every(k=>p[k]===scope[k])));
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(id);

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
  const relations=async(tx,grants)=>{
    for(const s of grants){
      const [school,group,visit]=(await tx.getAll(col('schools').doc(s.schoolId),col('groups').doc(s.groupId),col('serviceSessions').doc(s.serviceSessionId))).map(d=>d.data());
      if(school?.id!==s.schoolId||group?.id!==s.groupId||group.schoolId!==s.schoolId||visit?.id!==s.serviceSessionId||visit.schoolId!==s.schoolId||!visit.groupIds?.includes(s.groupId))throw denied();
    }
  };
  const limit=async(action,identity,max)=>{
    assertLocal();const ref=col('pairingLimits').doc(hash(action+':'+identity));
    await db.runTransaction(async tx=>{
      const value=(await tx.get(ref)).data(),time=now(),window=Math.floor(time/60000);
      if(value?.window===window&&value.count>=max)throw new PairingError(429,'Terlalu banyak percobaan. Coba lagi nanti.');
      tx.set(ref,{window,count:value?.window===window?value.count+1:1});
    });
  };
  return {
    limit,
    async adminContext(uid,stillAuthorized=async()=>true){
      if(!assertAdminLocal().uids.includes(uid))throw denied();
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
        const permission=(await tx.get(permissionRef(uid))).data();
        if(!permitted(permission,scopes))throw denied();
        await relations(tx,scopes);assertAdminLocal();await currentAdmin(stillAuthorized);
        return {contexts};
      });
    },
    async listDevices(uid,stillAuthorized=async()=>true){
      if(!assertAdminLocal().uids.includes(uid))throw denied();
      return db.runTransaction(async tx=>{
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
    async issue(uid,{grants,codeTtlMs=300000,grantTtlMs=3600000},stillAuthorized=async()=>true){
      if(!assertAdminLocal().uids.includes(uid))throw denied();
      if(!validGrants(grants)||!Number.isSafeInteger(codeTtlMs)||codeTtlMs<1000||codeTtlMs>600000||!Number.isSafeInteger(grantTtlMs)||grantTtlMs<1000||grantTtlMs>3600000)throw new PairingError(400,'Parameter pairing tidak valid.');
      const scopes=copy(grants);
      if(!permitted((await permissionRef(uid).get()).data(),scopes))throw denied();
      // Preserve existing relation/roster rules, then recheck relations and
      // server permission in the transaction that commits the issuance.
      for(const scope of scopes)if(!await repository.read(scope))throw denied();
      const code=randomBytes(16).toString('base64url'),pairingId=hash(code),ref=col('pairingCodes').doc(pairingId);
      const result=await db.runTransaction(async tx=>{
        if(!permitted((await tx.get(permissionRef(uid))).data(),scopes))throw denied();
        await relations(tx,scopes);assertAdminLocal();await currentAdmin(stillAuthorized);
        const expiresAt=now()+codeTtlMs;
        tx.create(ref,{codeHash:pairingId,issuedBy:uid,grants:scopes,expiresAt,grantTtlMs,state:'pending',createdAt:now()});
        event(tx,'pairing-issued',uid,{pairingId});
        return {pairingId,code,expiresAt};
      });return result;
    },
    async redeem({code,publicKey},proof){
      assertAdminLocal();
      if(typeof code!=='string'||!/^[A-Za-z0-9_-]{22}$/.test(code))throw invalid();
      try{devicePublicKey(publicKey);}catch{throw invalid();}
      if(!validDeviceProof(publicKey,{...proof,token:code},now()))throw invalid();
      const pairingId=hash(code),ref=col('pairingCodes').doc(pairingId),deviceId=randomUUID();
      return db.runTransaction(async tx=>{
        const entry=(await tx.get(ref)).data();
        if(!entry||entry.codeHash!==pairingId||entry.state!=='pending'||!Number.isSafeInteger(entry.expiresAt)||entry.expiresAt<=now()||!validGrants(entry.grants))throw invalid();
        if(!assertAdminLocal().uids.includes(entry.issuedBy)||!permitted((await tx.get(permissionRef(entry.issuedBy))).data(),entry.grants))throw invalid();
        try{await relations(tx,entry.grants);}catch{throw invalid();}
        assertLocal();
        if(!validDeviceProof(publicKey,{...proof,token:code},now())||entry.expiresAt<=now())throw invalid();
        const prepared=prepareCredential({deviceId,grants:entry.grants,ttlMs:entry.grantTtlMs});
        prepared.entry.binding='p256-v1';
        stageCredential(tx,prepared,{id:deviceId,state:'active',createdAt:now(),revokedAt:null,binding:'p256-v1',publicKey,grants:copy(entry.grants),expiresAt:prepared.entry.expiresAt});
        tx.update(ref,{state:'redeemed',redeemedAt:now(),deviceId});
        event(tx,'pairing-redeemed','device-pairing',{pairingId,deviceId});
        return {deviceId,credential:prepared.token,expiresAt:prepared.entry.expiresAt};
      });
    },
    async revokeCode(uid,pairingId,stillAuthorized=async()=>true){
      assertAdminLocal();if(!/^[a-f0-9]{64}$/.test(pairingId))throw invalid();
      return db.runTransaction(async tx=>{
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
      return {deviceId:entry.deviceId,state:'active',expiresAt:entry.expiresAt,grants:copy(entry.grants)};
    }
  };
}
