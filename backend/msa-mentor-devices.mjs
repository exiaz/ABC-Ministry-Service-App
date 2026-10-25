import {randomUUID} from 'node:crypto';
import {emulatorConfig} from './emulator-config.mjs';
import {adminAuthConfig} from './admin-auth.mjs';
import {hash,fail} from './msa-accounts.mjs';
import {SCOPE_KEYS,validRosterScope} from './access-control.mjs';
import {sameActivationAssignment} from './device-pairing.mjs';
import {createMsaDeviceLifecycle} from './msa-device-lifecycle.mjs';

const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const scopeKey=s=>JSON.stringify(SCOPE_KEYS.map(k=>s?.[k]));
const scope=s=>Object.fromEntries(SCOPE_KEYS.map(k=>[k,s[k]]));
const denied=()=>fail(403,'Akun, penugasan atau perangkat belum diizinkan. Hubungi PIC.');
const get=(tx,ref)=>tx?tx.get(ref):ref.get();
const matches=(b,d,e,credentialId,a,l)=>b&&d.msaAccountBinding&&b.state==='active'&&b.deviceId===d.id&&b.uid===a.uid&&b.accountRevision===a.revision&&b.linkRevision===l.revision&&b.mentorId===l.mentorId&&b.credentialId===credentialId&&b.revision===d.msaAccountBinding.revision&&d.msaAccountBinding.uid===b.uid&&d.kind==='activation-v1'&&d.assignment?.mentorId===l.mentorId&&scopeKey(d.assignment)===scopeKey(l.scope)&&sameActivationAssignment(b.primary,d.assignment)&&e.expiresAt===d.expiresAt;

export function assertMentorAccountMode(config){
  try{
    if(process.env.ABC_MSA_A1!=='1'||process.env.ABC_MSA_A2_2!=='1'||process.env.ABC_MSA_A2_3!=='1'||!config.namespace.startsWith('test-')||JSON.stringify(emulatorConfig())!==JSON.stringify(config))throw Error();
    adminAuthConfig();
  }catch{fail(503,'Alur akun Mentor uji tidak aktif.');}
}

// Durable markers are enforced even when the feature is off or this service is
// not mounted. A linked credential can never silently become legacy again.
export function createMsaMentorDevices({db,root,config,repository,credentials,now}){
  const col=name=>root.collection(name),enabled=()=>assertMentorAccountMode(config);
  const identity=async(tx,personal)=>{
    enabled();
    if(!personal||!id(personal.uid)||!Number.isSafeInteger(personal.revision)||!Number.isSafeInteger(personal.expiresAt)||!/^[a-f0-9]{64}$/.test(personal.sessionId??''))denied();
    const [a,s]=(await Promise.all([get(tx,col('msaAccounts').doc(personal.uid)),get(tx,col('msaMentorSessions').doc(personal.sessionId))])).map(d=>d.data());
    if(a?.uid!==personal.uid||a.provisioning!=='ready'||a.state!=='active'||a.identity?.state!=='verified'||a.revision!==personal.revision||!a.mentorLink||s?.uid!==a.uid||s.state!=='active'||s.revision!==a.revision||!Number.isSafeInteger(s.expiresAt)||s.expiresAt!==personal.expiresAt||s.expiresAt<=now()||personal.expiresAt<=now())denied();
    const link=(await get(tx,col('mentorIdentityLinks').doc(a.mentorLink.mentorId))).data();
    if(link?.uid!==a.uid||link.state!=='active'||link.mentorId!==a.mentorLink.mentorId||link.revision!==a.mentorLink.revision||scopeKey(link.scope)!==scopeKey(a.mentorLink.scope)||scopeKey(link.scope)!==scopeKey(a.identity.scope)||!validRosterScope(link.scope))denied();
    return {account:a,link};
  };
  const assignment=async(tx,link)=>{
    const current=await repository.describe(link.scope,{transaction:tx,mentorIdentity:true,defaultIdentity:true});
    return current?.mentorId===link.mentorId?current:null;
  };
  const sessionRow=async(tx,p)=>{
    enabled();const a=(await tx.get(col('msaAccounts').doc(p.uid))).data();
    if(a?.state!=='active'||a.provisioning!=='ready'||a.identity?.state!=='verified'||a.revision!==p.revision||!a.mentorLink)denied();
    const link=(await tx.get(col('mentorIdentityLinks').doc(a.mentorLink.mentorId))).data();
    if(link?.uid!==a.uid||link.state!=='active'||link.revision!==a.mentorLink.revision||scopeKey(link.scope)!==scopeKey(a.mentorLink.scope))denied();return a;
  };
  const api={
    enabled,
    async admit(personal){
      return db.runTransaction(async tx=>{
        await sessionRow(tx,personal);const ref=col('msaMentorSessions').doc(personal.sessionId),old=(await tx.get(ref)).data();
        if(old)denied();tx.create(ref,{uid:personal.uid,revision:personal.revision,expiresAt:personal.expiresAt,state:'active',createdAt:now()});
      });
    },
    async logout(personal){
      enabled();return db.runTransaction(async tx=>{const ref=col('msaMentorSessions').doc(personal.sessionId),s=(await tx.get(ref)).data();if(s?.uid===personal.uid&&s.state==='active')tx.update(ref,{state:'revoked',revokedAt:now()});});
    },
    async context(personal){
      return db.runTransaction(async tx=>{const {account,link}=await identity(tx,personal),current=await assignment(tx,link);return {fullName:account.fullName,mentorId:link.mentorId,groups:current?[current]:[]};});
    },
    async check({transaction:tx,device,entry,credentialId,personal}){
      const binding=(await get(tx,col('msaDeviceAssociations').doc(device.id))).data();
      if(!binding&&!device.msaAccountBinding)return personal?false:true;
      try{
        const {account,link}=await identity(tx,personal);
        if(!matches(binding,device,entry,credentialId,account,link))return false;
        if(!await assignment(tx,link))return false;
        return {uid:account.uid,accountRevision:account.revision,linkRevision:link.revision,associationRevision:binding.revision};
      }catch(e){if(e.adminAccountError)return false;throw e;}
    },
    async eligible(device,entry,credentialId,tx){
      const b=(await get(tx,col('msaDeviceAssociations').doc(device.id))).data();if(!b&&!device.msaAccountBinding)return true;
      try{
        enabled();if(!b) return false;const a=(await get(tx,col('msaAccounts').doc(b.uid))).data(),l=(await get(tx,col('mentorIdentityLinks').doc(b.mentorId))).data();
        return a?.state==='active'&&a.provisioning==='ready'&&a.identity?.state==='verified'&&a.mentorLink?.mentorId===b.mentorId&&a.mentorLink.revision===l?.revision&&l?.uid===a.uid&&l.state==='active'&&scopeKey(a.mentorLink.scope)===scopeKey(l.scope)&&scopeKey(a.identity.scope)===scopeKey(l.scope)&&matches(b,device,entry,credentialId,a,l)&&!!await assignment(tx,l);
      }catch(e){if(e.adminAccountError)return false;throw e;}
    },
    async deviceStatus(personal,authorization,proof){
      return db.runTransaction(async tx=>{
        const {link}=await identity(tx,personal),current=await assignment(tx,link);if(!current||!proof?.deviceId)denied();
        const ref=col('devices').doc(proof.deviceId),device=(await tx.get(ref)).data(),binding=(await tx.get(col('msaDeviceAssociations').doc(proof.deviceId))).data();
        if(device?.kind!=='activation-v1'||device.assignment?.mentorId!==link.mentorId||!sameActivationAssignment(device.assignment,current))denied();
        if(!await credentials.authenticate(authorization,proof,tx,binding||device.msaAccountBinding?personal:undefined))denied();
        return {deviceId:device.id,state:'active',expiresAt:device.expiresAt,assignment:current,associated:!!binding};
      });
    },
    async associate(personal,authorization,proof,{requestId}={}){
      if(typeof requestId!=='string'||!/^[a-f0-9-]{36}$/.test(requestId))fail(400,'Pengajuan perangkat tidak valid.');
      return db.runTransaction(async tx=>{
        const {account,link}=await identity(tx,personal),primary=await assignment(tx,link);if(!primary||!proof?.deviceId)denied();
        const ref=col('devices').doc(proof.deviceId),device=(await tx.get(ref)).data(),bindingRef=col('msaDeviceAssociations').doc(proof.deviceId),binding=(await tx.get(bindingRef)).data();
        if(device?.kind!=='activation-v1'||!sameActivationAssignment(device.assignment,primary))denied();
        if(!await credentials.authenticate(authorization,proof,tx,binding||device.msaAccountBinding?personal:undefined))denied();
        if(binding)return {associated:true,revision:binding.revision};
        const next={uid:account.uid,deviceId:device.id,mentorId:link.mentorId,credentialId:hash(authorization.slice(7)),primary,accountRevision:account.revision,linkRevision:link.revision,revision:1,state:'active',createdAt:now()};
        enabled();if(device.expiresAt<=now())denied();
        tx.create(bindingRef,next);tx.update(ref,{msaAccountBinding:{uid:account.uid,revision:1}});
        tx.create(col('msaDeviceAssociationEvents').doc(randomUUID()),{actorUid:account.uid,targetDeviceId:device.id,mentorId:link.mentorId,scope:scope(primary),accountRevision:account.revision,linkRevision:link.revision,revision:1,reason:'Mentor mengonfirmasi pemakaian perangkat berizin dengan bukti perangkat.',requestIdHash:hash(requestId),at:now()});
        return {associated:true,revision:1};
      });
    }
  };
  api.lifecycle=createMsaDeviceLifecycle({db,root,now,eligible:api.eligible,enabled:()=>{enabled();if(process.env.ABC_MSA_A2_4A!=='1')fail(503,'Pengelolaan perangkat akun uji tidak aktif.');}});
  api.ownDevices=p=>api.lifecycle.list(p.uid,async tx=>(await identity(tx,p)).account);
  api.revokeOwnDevice=(p,deviceId,value)=>api.lifecycle.revoke(p.uid,deviceId,value,p.uid,async tx=>(await identity(tx,p)).account);
  return api;
}

export function createMsaMentorAuthentication({a1,devices}){
  const resolve=async header=>{
    devices.enabled();const p=await a1.authorize(header);
    if(p.kind!=='msa')denied();return {uid:p.uid,revision:p.revision,expiresAt:p.expiresAt,sessionId:hash(header.slice(7))};
  };
  return {
    enabled:devices.enabled,
    async login(value){
      devices.enabled();const result=await a1.login(value),header='Bearer '+result.token;
      try{const p=await resolve(header);await devices.admit(p);return {token:result.token,...await devices.context(p),...(process.env.ABC_MSA_A2_4A==='1'?{deviceManagement:true}:{})};}
      catch(e){a1.logout(header);if(e.status===503)throw e;denied();}
    },
    resolve,
    async context(header){return {...await devices.context(await resolve(header)),...(process.env.ABC_MSA_A2_4A==='1'?{deviceManagement:true}:{})};},
    async listDevices(header){return devices.ownDevices(await resolve(header));},
    async revokeDevice(header,deviceId,value){return devices.revokeOwnDevice(await resolve(header),deviceId,value);},
    async logout(header){const p=await resolve(header);await devices.logout(p);a1.logout(header);return {signedOut:true};},
    async deviceStatus(header,authorization,proof){return devices.deviceStatus(await resolve(header),authorization,proof);},
    async associate(header,authorization,proof,value){return devices.associate(await resolve(header),authorization,proof,value);}
  };
}
