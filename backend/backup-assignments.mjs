import {randomUUID} from 'node:crypto';
import {SCOPE_KEYS,validRosterScope} from './access-control.mjs';
import {adminPolicy} from './admin-accounts.mjs';
import {adminAuthConfig} from './admin-auth.mjs';
import {emulatorConfig} from './emulator-config.mjs';
import {PairingError,sameActivationAssignment,activationAccessEnd} from './device-pairing.mjs';
import {hash,devicePublicKey} from './device-proof.mjs';

const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const key=s=>JSON.stringify(SCOPE_KEYS.map(k=>s[k]));
const scope=s=>Object.fromEntries(SCOPE_KEYS.map(k=>[k,s[k]]));
const reason=v=>typeof v==='string'&&v.trim().length>0&&v.length<=500;
const denied=()=>{throw new PairingError(403,'Izin backup tidak mencakup perangkat atau kelompok ini.');};
const invalid=()=>{throw new PairingError(400,'Pilih perangkat aktif, kelompok dan alasan backup yang valid.');};
const permitted=(p,grants)=>p?.active===true&&Array.isArray(p.grants)&&grants.every(s=>p.grants.some(g=>key(g)===key(s)));

// Additive delegation only. Primary credentials, enrollment and mentor defaults
// are never rewritten. Reads join the same transaction as attendance writes.
export function createBackupAssignments({db,root,repository,now,config}){
  const col=name=>root.collection(name);
  const read=(tx,ref)=>tx?tx.get(ref):ref.get();
  const operator=async(uid,action,tx)=>{
    try{const current=emulatorConfig();if(current.host!==config.host||current.projectId!==config.projectId)denied();adminAuthConfig();await adminPolicy(root,uid,{tx,action});}catch{denied();}
    return (await read(tx,col('adminPairingPermissions').doc(uid))).data();
  };
  const check=async fn=>{if(!await fn())throw new PairingError(401,'Sesi admin tidak berlaku.');};
  async function deviceFor(tx,deviceId){
    if(!id(deviceId))return null;
    const d=(await read(tx,col('devices').doc(deviceId))).data();
    if(d?.id!==deviceId||d.kind!=='activation-v1'||d.binding!=='p256-v1'||d.state!=='active'||d.revokedAt!==null||!Number.isSafeInteger(d.expiresAt)||d.expiresAt<=now()||!validRosterScope(d.assignment))return null;
    try{devicePublicKey(d.publicKey);}catch{return null;}
    const primary=await repository.describe(d.assignment,{transaction:tx,mentorIdentity:true});
    if(!sameActivationAssignment(d.assignment,primary)||activationAccessEnd(primary)<=now())return null;
    const rows=await read(tx,col('credentials').where('deviceId','==',deviceId));
    const credentials=rows.docs.filter(row=>{const c=row.data();return c.binding==='p256-v1'&&c.revokedAt===null&&c.expiresAt===d.expiresAt&&Array.isArray(c.grants)&&c.grants.length===1&&key(c.grants[0])===key(primary);});
    if(credentials.length!==1)return null;
    return {deviceId,primary,expiresAt:d.expiresAt,credentialId:credentials[0].id};
  }
  async function valid(tx,row,device){
    if(!device||row.state!=='active'||row.deviceId!==device.deviceId||row.credentialId!==device.credentialId||!Number.isSafeInteger(row.expiresAt)||row.expiresAt<=now()||row.expiresAt>device.expiresAt||!sameActivationAssignment(row.primary,device.primary)||!Array.isArray(row.assignments)||!row.assignments.length||row.assignments.length>15)return false;
    let permission;try{permission=await operator(row.actor,'pairing:issue',tx);}catch(error){if(error instanceof PairingError)return false;throw error;}
    if(!permitted(permission,[row.primary,...row.assignments]))return false;
    for(const a of row.assignments){
      if(!validRosterScope(a)||a.schoolId!==device.primary.schoolId||a.serviceSessionId!==device.primary.serviceSessionId||a.groupId===device.primary.groupId||!sameActivationAssignment(a,await repository.describe(a,{transaction:tx,mentorIdentity:true})))return false;
    }
    return row.expiresAt>now();
  }
  const project=(row,state)=>({id:row.id,deviceId:row.deviceId,primary:row.primary,assignments:row.assignments,actor:row.actor,createdAt:row.createdAt,expiresAt:row.expiresAt,reason:row.reason,state,closedAt:row.closedAt,closedBy:row.closedBy,closeReason:row.closeReason});
  const event=(tx,event,actor,row)=>tx.create(col('authorizationEvents').doc(randomUUID()),{event,actor,at:now(),assignmentId:row.id,deviceId:row.deviceId,primary:row.primary,assignments:row.assignments,reason:event==='backup-assigned'?row.reason:row.closeReason,status:row.state,expiresAt:row.expiresAt});
  return {
    async resolve(device,entry,tx){
      if(device.kind!=='activation-v1')return [];
      const current={deviceId:device.id,primary:device.assignment,expiresAt:entry.expiresAt,credentialId:entry.credentialId};
      const rows=await read(tx,col('backupAssignments').where('deviceId','==',device.id)),result=[];
      for(const doc of rows.docs){const row=doc.data();if(await valid(tx,row,current))for(const a of row.assignments)result.push({...scope(a),assignmentId:row.id,mentorId:row.primary.mentorId});}
      return result;
    },
    async listBackups(uid,stillAuthorized=async()=>true){
      return db.runTransaction(async tx=>{
        const p=await operator(uid,'pairing:read',tx);if(!permitted(p,p?.grants??[])||!p?.grants?.length)denied();
        const devices=await tx.get(col('devices').where('kind','==','activation-v1')),candidates=[];
        for(const doc of devices.docs){const d=await deviceFor(tx,doc.id);if(d&&permitted(p,[d.primary]))candidates.push({deviceId:d.deviceId,assignment:d.primary,expiresAt:d.expiresAt});}
        const rows=await tx.get(col('backupAssignments')),assignments=[];
        for(const doc of rows.docs){const row=doc.data();if(!permitted(p,[row.primary,...row.assignments]))continue;const d=await deviceFor(tx,row.deviceId);assignments.push(project(row,row.state!=='active'?row.state:row.expiresAt<=now()?'expired':await valid(tx,row,d)?'active':'invalid'));}
        await check(stillAuthorized);return {candidates,assignments};
      });
    },
    async saveBackup(uid,{deviceId,grants,reason:why,idempotencyKey},stillAuthorized=async()=>true){
      if(!id(deviceId)||!Array.isArray(grants)||!grants.length||grants.length>15||grants.some(s=>!validRosterScope(s)||Object.keys(s).length!==3)||new Set(grants.map(key)).size!==grants.length||!reason(why)||!id(idempotencyKey)||idempotencyKey.length<16)invalid();
      const selected=grants.map(scope).sort((a,b)=>key(a).localeCompare(key(b))),assignmentId=hash(JSON.stringify([uid,idempotencyKey])),ref=col('backupAssignments').doc(assignmentId),fingerprint=hash(JSON.stringify([deviceId,selected,why.trim()]));
      return db.runTransaction(async tx=>{
        const p=await operator(uid,'pairing:issue',tx),device=await deviceFor(tx,deviceId);
        if(!device||!permitted(p,[device.primary,...selected])||selected.some(s=>s.schoolId!==device.primary.schoolId||s.serviceSessionId!==device.primary.serviceSessionId||s.groupId===device.primary.groupId))denied();
        const prior=(await tx.get(ref)).data();
        if(prior){if(prior.fingerprint!==fingerprint)throw new PairingError(409,'Kunci penugasan telah dipakai. Muat ulang.');const state=prior.state!=='active'?prior.state:prior.expiresAt<=now()?'expired':await valid(tx,prior,device)?'active':'invalid';await check(stillAuthorized);return project(prior,state);}
        const existing=(await tx.get(col('backupAssignments').where('deviceId','==',deviceId))).docs.map(d=>d.data());
        const current=new Set();for(const row of existing)if(await valid(tx,row,device))for(const a of row.assignments)current.add(key(a));
        if(selected.some(s=>current.has(key(s)))||current.size+selected.length>15)throw new PairingError(409,'Kelompok sudah dibackup atau batas 15 kelompok backup tercapai. Muat ulang.');
        const assignments=[];for(const s of selected){const a=await repository.describe(s,{transaction:tx,mentorIdentity:true,defaultIdentity:true});if(!a)denied();assignments.push(a);}
        const row={id:assignmentId,fingerprint,deviceId,credentialId:device.credentialId,primary:device.primary,assignments,actor:uid,createdAt:now(),expiresAt:Math.min(device.expiresAt,activationAccessEnd(device.primary)),reason:why.trim(),state:'active',closedAt:null,closedBy:null,closeReason:null};
        await check(stillAuthorized);if(row.expiresAt<=now())denied();
        tx.create(ref,row);event(tx,'backup-assigned',uid,row);return project(row,'active');
      });
    },
    async closeBackup(uid,assignmentId,{reason:why,status},stillAuthorized=async()=>true){
      if(!/^[a-f0-9]{64}$/.test(assignmentId)||!reason(why)||!['revoked','ended'].includes(status))invalid();
      return db.runTransaction(async tx=>{
        const p=await operator(uid,'pairing:revoke',tx),ref=col('backupAssignments').doc(assignmentId),row=(await tx.get(ref)).data();
        if(!row||!permitted(p,[row.primary,...row.assignments]))denied();
        await check(stillAuthorized);if(row.state!=='active')return project(row,row.state);
        const next={...row,state:status,closedAt:now(),closedBy:uid,closeReason:why.trim()};
        tx.update(ref,{state:status,closedAt:next.closedAt,closedBy:uid,closeReason:next.closeReason});event(tx,'backup-'+status,uid,next);return project(next,status);
      });
    }
  };
}
