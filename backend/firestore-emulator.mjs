import {createHash,randomBytes,randomUUID} from 'node:crypto';
import net from 'node:net';
import {emulatorConfig} from './emulator-config.mjs';
import {validRosterScope,SCOPE_KEYS} from './access-control.mjs';
import {toRosterResponse} from './roster.mjs';

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

  const credentials={
    async issue({grants,ttlMs=300000,deviceId=randomUUID()}){
      if(!validDevice(deviceId)||!Number.isSafeInteger(ttlMs)||ttlMs<=0||ttlMs>3600000||!Array.isArray(grants)||!grants.length||!grants.every(validRosterScope))throw Error('Cakupan atau masa berlaku kredensial uji tidak valid.');
      const token=randomBytes(32).toString('base64url');
      const entry={deviceId,expiresAt:now()+ttlMs,revokedAt:null,grants:copyGrants(grants)};
      const device=collection('devices').doc(deviceId),credential=collection('credentials').doc(digest(token)),event=collection('authorizationEvents').doc(randomUUID());
      await db.runTransaction(async transaction=>{
        const snapshot=await transaction.get(device);
        if(snapshot.exists&&(snapshot.data().id!==deviceId||snapshot.data().state!=='active'||snapshot.data().revokedAt!==null))throw Error('Perangkat tidak aktif; penerbitan izin ditolak.');
        if(!snapshot.exists)transaction.create(device,{id:deviceId,state:'active',createdAt:now(),revokedAt:null});
        transaction.create(credential,entry);
        transaction.create(event,audit('credential-issued',deviceId,credential.id));
      });
      return token;
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
    async authenticate(authorization){
      const match=typeof authorization==='string'&&/^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization);
      if(!match)return null;
      const snapshot=await collection('credentials').doc(digest(match[1])).get(),entry=snapshot.data();
      if(!entry||!validDevice(entry.deviceId)||entry.revokedAt!==null||!Number.isSafeInteger(entry.expiresAt)||entry.expiresAt<=now()||!Array.isArray(entry.grants)||!entry.grants.length||!entry.grants.every(validRosterScope))return null;
      const device=(await collection('devices').doc(entry.deviceId).get()).data();
      if(device?.id!==entry.deviceId||device.state!=='active'||device.revokedAt!==null||entry.expiresAt<=now())return null;
      return {expiresAt:entry.expiresAt,grants:copyGrants(entry.grants)};
    }
  };

  const repository={
    async read(scope){
      if(!validRosterScope(scope))return null;
      const {schoolId,groupId,serviceSessionId}=scope;
      const snapshots=await db.getAll(collection('schools').doc(schoolId),collection('groups').doc(groupId),collection('serviceSessions').doc(serviceSessionId));
      const [school,group,visit]=snapshots.map(s=>s.data());
      if(!school||school.id!==schoolId||group?.id!==groupId||group.schoolId!==schoolId||visit?.id!==serviceSessionId||visit.schoolId!==schoolId||!Array.isArray(visit.groupIds)||!visit.groupIds.includes(groupId))return null;
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
      const ref=collection('devices').doc(deviceId),event=collection('authorizationEvents').doc(randomUUID());
      return db.runTransaction(async transaction=>{
        const snapshot=await transaction.get(ref),entry=snapshot.data();
        if(!entry||entry.state!=='active'||entry.revokedAt!==null)return false;
        transaction.update(ref,{state:'revoked',revokedAt:now()});
        transaction.create(event,audit('device-revoked',deviceId));return true;
      });
    }
  };
  // db/root are trusted test-fixture hooks only; never exposed by the API.
  return {credentials,repository,deviceAuthorization,close,db,root,config};
}
