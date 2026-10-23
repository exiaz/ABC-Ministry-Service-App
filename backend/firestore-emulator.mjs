import {createHash,randomBytes,randomUUID} from 'node:crypto';
import net from 'node:net';
import {emulatorConfig} from './emulator-config.mjs';
import {validRosterScope,validServiceSession,SCOPE_KEYS} from './access-control.mjs';
import {toRosterResponse,describeRosterScope} from './roster.mjs';
import {effectiveMentor} from '../assignments.js';
import {createEmulatorDevicePairing,sameActivationAssignment} from './device-pairing.mjs';
import {createEmulatorAttendance} from './attendance.mjs';

const digest=token=>createHash('sha256').update(token).digest('hex');
const tokenValid=token=>typeof token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(token);
const copyGrants=grants=>grants.map(scope=>Object.fromEntries(SCOPE_KEYS.map(key=>[key,scope[key]])));

async function requireLocalListener(port){
  await new Promise((resolve,reject)=>{
    const socket=net.createConnection({host:'127.0.0.1',port});
    socket.setTimeout(1500);
    socket.once('connect',()=>{socket.destroy();resolve();});
    socket.once('error',()=>reject(Error('Firestore Emulator lokal tidak tersedia; akses ditolak.')));
    socket.once('timeout',()=>{socket.destroy();reject(Error('Firestore Emulator lokal tidak tersedia; akses ditolak.'));});
  });
}

/** Emulator-only implementation of the M2A.1 contracts. No seeding HTTP route. */
export async function createFirestoreEmulatorRepositories({now=Date.now}={}){
  const config=emulatorConfig();
  await requireLocalListener(config.port);
  const {initializeApp,deleteApp}=await import('firebase-admin/app');
  const {getFirestore}=await import('firebase-admin/firestore');
  // The explicit project and plaintext loopback host force the SDK emulator path
  // (its emulator owner header); no service account or Google login is used.
  const app=initializeApp({projectId:config.projectId},'abc-emulator-'+randomUUID());
  const db=getFirestore(app);
  // Explicit universe also prevents google-auth-library from probing GCE/ADC
  // metadata just to discover its default universe. This is not an endpoint.
  db.settings({host:config.host,ssl:false,universeDomain:'googleapis.com'});
  const root=db.collection('emulatorNamespaces').doc(config.namespace);
  const collection=name=>root.collection(name);
  const audit=(event,deviceId,credentialId=null)=>({event,deviceId,credentialId,at:now(),actor:'local-trusted-process'});
  const validDevice=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(id);
  const close=async()=>{await db.terminate();await deleteApp(app);};
  try{
    // Establish a real Firestore connection now; never silently use another store.
    await collection('schools').limit(1).get();
  }catch(error){await close();throw error;}

  const prepareCredential=({grants,ttlMs=300000,deviceId=randomUUID()})=>{
      if(!validDevice(deviceId)||!Number.isSafeInteger(ttlMs)||ttlMs<=0||ttlMs>3600000||!Array.isArray(grants)||!grants.length||!grants.every(validRosterScope))throw Error('Cakupan atau masa berlaku kredensial uji tidak valid.');
      const token=randomBytes(32).toString('base64url');
      const entry={deviceId,expiresAt:now()+ttlMs,revokedAt:null,grants:copyGrants(grants)};
      return {token,entry,device:collection('devices').doc(deviceId),credential:collection('credentials').doc(digest(token))};
  };
  const stageCredential=(transaction,prepared,newDevice)=>{
    const {entry,device,credential}=prepared;
    if(newDevice)transaction.create(device,newDevice);
    transaction.create(credential,entry);
    transaction.create(collection('authorizationEvents').doc(randomUUID()),audit('credential-issued',entry.deviceId,credential.id));
  };
  const stageDeviceRevoke=(transaction,deviceId)=>{
    transaction.update(collection('devices').doc(deviceId),{state:'revoked',revokedAt:now()});
    transaction.create(collection('authorizationEvents').doc(randomUUID()),audit('device-revoked',deviceId));
  };
  const credentials={
    async issue({grants,ttlMs=300000,deviceId=randomUUID()}){
      const prepared=prepareCredential({grants,ttlMs,deviceId}),{device}=prepared;
      await db.runTransaction(async transaction=>{
        const snapshot=await transaction.get(device);
        if(snapshot.exists&&(snapshot.data().id!==deviceId||snapshot.data().state!=='active'||snapshot.data().revokedAt!==null))throw Error('Perangkat tidak aktif; penerbitan izin ditolak.');
        stageCredential(transaction,prepared,snapshot.exists?null:{id:deviceId,state:'active',createdAt:now(),revokedAt:null});
      });
      return prepared.token;
    },
    async revoke(token){
      if(!tokenValid(token))return false;
      const ref=collection('credentials').doc(digest(token));
      return db.runTransaction(async transaction=>{
        const snapshot=await transaction.get(ref),entry=snapshot.data();
        if(!snapshot.exists||entry.revokedAt!==null)return false;
        transaction.update(ref,{revokedAt:now()});
        transaction.create(collection('authorizationEvents').doc(randomUUID()),audit('credential-revoked',entry.deviceId??null,ref.id));
        return true;
      });
    },
    async authenticate(authorization,requestProof,transaction){
      // Internal transaction context lets attendance share these exact checks
      // and conflict atomically with credential/device revocation.
      const read=ref=>transaction?transaction.get(ref):ref.get();
      const match=typeof authorization==='string'&&/^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization);
      if(!match)return null;
      const snapshot=await read(collection('credentials').doc(digest(match[1]))),entry=snapshot.data();
      if(!entry||!validDevice(entry.deviceId)||entry.revokedAt!==null||!Number.isSafeInteger(entry.expiresAt)||entry.expiresAt<=now()||!Array.isArray(entry.grants)||!entry.grants.length||!entry.grants.every(validRosterScope))return null;
      const device=(await read(collection('devices').doc(entry.deviceId))).data();
      if(device?.id!==entry.deviceId||device.state!=='active'||device.revokedAt!==null||entry.expiresAt<=now())return null;
      const bound=entry.binding!==undefined||device.binding!==undefined||device.publicKey!==undefined;
      if(bound&&(entry.binding!=='p256-v1'||device.binding!=='p256-v1'||typeof device.publicKey!=='string'||requestProof?.deviceId!==entry.deviceId))return null;
      if(device.kind==='activation-v1'){
        if(entry.grants.length!==1||!sameActivationAssignment(device.assignment,await repository.describe(entry.grants[0],{transaction,mentorIdentity:true}))||device.expiresAt!==entry.expiresAt)return null;
      }
      return {expiresAt:entry.expiresAt,grants:copyGrants(entry.grants)};
    }
  };

  const repository={
    async describe(scope,{transaction,mentorIdentity=false}={}){
      if(!validRosterScope(scope))return null;
      const getAll=(...refs)=>transaction?transaction.getAll(...refs):db.getAll(...refs);
      const {schoolId,groupId,serviceSessionId}=scope;
      const [school,group,visit]=(await getAll(collection('schools').doc(schoolId),collection('groups').doc(groupId),collection('serviceSessions').doc(serviceSessionId))).map(d=>d.data());
      if(school?.id!==schoolId||group?.id!==groupId||group.schoolId!==schoolId||!validServiceSession(visit)||visit?.id!==serviceSessionId||visit.schoolId!==schoolId||!Array.isArray(visit.groupIds)||!visit.groupIds.includes(groupId))return null;
      const names=['defaultMentorAssignments','sessionMentorOverrides','mentorAssignmentSnapshots'];
      const snapshots=await Promise.all(names.map(name=>{
        let query=collection(name).where('groupId','==',groupId);
        if(name!=='defaultMentorAssignments')query=query.where('serviceSessionId','==',serviceSessionId);
        return transaction?transaction.get(query):query.get();
      }));
      const model={schools:[school],groups:[group],serviceSessions:[visit],...Object.fromEntries(names.map((name,i)=>[name,snapshots[i].docs.map(d=>d.data())]))};
      model.mentorAssignmentSnapshots.sort((a,b)=>(a.capturedAt??'').localeCompare(b.capturedAt??''));
      const mentorIds=[...new Set(names.flatMap(name=>model[name].map(r=>r.mentorId)).filter(validDevice))];
      model.mentors=mentorIds.length?(await getAll(...mentorIds.map(id=>collection('mentors').doc(id)))).filter(d=>d.exists).map(d=>d.data()):[];
      const context=describeRosterScope(model,scope);
      if(!mentorIdentity)return context;
      const mentorId=effectiveMentor(model,groupId,serviceSessionId).mentorId;
      if(!validDevice(mentorId)||!model.mentors.some(mentor=>mentor.id===mentorId))return null;
      return {...context,mentorId};
    },
    async read(scope){
      if(!validRosterScope(scope))return null;
      const {schoolId,groupId,serviceSessionId}=scope;
      const snapshots=await db.getAll(collection('schools').doc(schoolId),collection('groups').doc(groupId),collection('serviceSessions').doc(serviceSessionId));
      const [school,group,visit]=snapshots.map(s=>s.data());
      if(!school||school.id!==schoolId||group?.id!==groupId||group.schoolId!==schoolId||!validServiceSession(visit)||visit?.id!==serviceSessionId||visit.schoolId!==schoolId||!Array.isArray(visit.groupIds)||!visit.groupIds.includes(groupId))return null;
      const batches=await collection('sessions').where('serviceSessionId','==',serviceSessionId).get();
      const all=batches.docs.map(s=>s.data()),matching=all.filter(s=>s.groupId===groupId&&s.schoolId===schoolId);
      if(matching.length>1)throw Error('Batch roster tidak unik.');
      if(matching.length)return toRosterResponse(scope,matching[0].records);
      const used=new Set(all.flatMap(s=>s.records.map(r=>r.studentId)));
      const students=await collection('students').where('schoolId','==',schoolId).where('groupId','==',groupId).where('active','==',true).get();
      return toRosterResponse(scope,students.docs.map(s=>s.data()).filter(s=>!used.has(s.id)));
    }
  };
  // Trusted server/local-operator boundary only. No HTTP grant/admin endpoint.
  // Reuse existing roster relation checks and credential issuance; do not mint a
  // second kind of token or accept browser-supplied roles/device flags.
  const deviceAuthorization={
    async issue({deviceId,grants,ttlMs=300000}){
      if(!validDevice(deviceId)||!Array.isArray(grants)||!grants.length||!grants.every(validRosterScope))throw Error('Perangkat atau cakupan izin tidak valid.');
      const scopes=copyGrants(grants);
      for(const scope of scopes)if(!await repository.read(scope))throw Error('Sekolah, kelompok, atau pelayanan tidak sesuai.');
      return credentials.issue({deviceId,grants:scopes,ttlMs});
    },
    async revoke(deviceId){
      if(!validDevice(deviceId))return false;
      const ref=collection('devices').doc(deviceId);
      return db.runTransaction(async transaction=>{
        const snapshot=await transaction.get(ref),entry=snapshot.data();
        if(!entry||entry.state!=='active'||entry.revokedAt!==null)return false;
        stageDeviceRevoke(transaction,deviceId);return true;
      });
    }
  };
  // db/root are trusted test-fixture hooks only; never exposed by the API.
  const pairing=createEmulatorDevicePairing({db,root,config,repository,now,prepareCredential,stageCredential,stageDeviceRevoke});
  const attendance=createEmulatorAttendance({db,root,credentials,now});
  return {credentials,repository,deviceAuthorization,pairing,attendance,close,db,root,config};
}
